#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// Add missing import for fetch (Node.js 18+ has global fetch, but for older versions use node-fetch)
// If using Node.js 18+, you can remove this import
// import fetch from "node-fetch";

class ExampleMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "example-mcp-server",
        version: "0.1.0",
      }
    ); // <-- FIX: close constructor argument

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private async handleHttpRequest(args: any) {
    if (!args || typeof args.url !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        "URL parameter is required"
      );
    }

    try {
      const method = args.method || 'GET';
      const timeout = args.timeout || 10000;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'User-Agent': 'MCP-Server/1.0',
          ...args.headers
        },
        signal: controller.signal
      };

      if (args.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        fetchOptions.body = args.body;
        if (!args.headers?.['Content-Type']) {
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Content-Type': 'application/json'
          };
        }
      }

      const response = await fetch(args.url, fetchOptions);
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      let responseData: any;

      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      return {
        content: [
          {
            type: "text",
            text: `HTTP ${method} ${args.url}\nStatus: ${response.status} ${response.statusText}\nContent-Type: ${contentType}\n\nResponse:\n${JSON.stringify(responseData, null, 2)}`,
          },
        ],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `HTTP request failed: ${errorMessage}`
      );
    }
  }

  private async handleWeatherAPI(args: any) {
    if (!args || typeof args.city !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        "City parameter is required"
      );
    }

    try {
      const units = args.units || 'metric';
      const apiKey = process.env.OPENWEATHER_API_KEY;

      if (!apiKey) {
        return {
          content: [
            {
              type: "text",
              text: "Weather API requires OPENWEATHER_API_KEY environment variable. You can get a free API key from https://openweathermap.org/api\n\nExample usage:\nOPENWEATHER_API_KEY=your_key_here npm start",
            },
          ],
        };
      }

      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(args.city)}&appid=${apiKey}&units=${units}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Weather API error: ${data.message || 'Unknown error'}`);
      }

      const unitSymbol = units === 'metric' ? '°C' : units === 'imperial' ? '°F' : 'K';

      return {
        content: [
          {
            type: "text",
            text: `Weather in ${data.name}, ${data.sys.country}:
🌡️ Temperature: ${data.main.temp}${unitSymbol} (feels like ${data.main.feels_like}${unitSymbol})
🌤️ Condition: ${data.weather[0].main} - ${data.weather[0].description}
💧 Humidity: ${data.main.humidity}%
🌬️ Wind: ${data.wind.speed} ${units === 'metric' ? 'm/s' : 'mph'}
👁️ Visibility: ${data.visibility / 1000} km
🌅 Sunrise: ${new Date(data.sys.sunrise * 1000).toLocaleTimeString()}
🌇 Sunset: ${new Date(data.sys.sunset * 1000).toLocaleTimeString()}`,
          },
        ],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Weather API request failed: ${errorMessage}`
      );
    }
  }

  private async handleJsonPlaceholder(args: any) {
    if (!args || typeof args.endpoint !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Endpoint parameter is required"
      );
    }

    try {
      let url = `https://jsonplaceholder.typicode.com/${args.endpoint}`;

      if (args.id && typeof args.id === 'number') {
        url += `/${args.id}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: `JSONPlaceholder API - ${args.endpoint}${args.id ? ` (ID: ${args.id})` : ''}:\n\n${JSON.stringify(data, null, 2)}`,
          },
        ],
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `JSONPlaceholder API request failed: ${errorMessage}`
      );
    }
  }

  private setupToolHandlers() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "echo",
            description: "Echo back the input text",
            inputSchema: {
              type: "object",
              properties: {
                text: {
                  type: "string",
                  description: "Text to echo back",
                },
              },
              required: ["text"],
            },
          },
          {
            name: "add_numbers",
            description: "Add two numbers together",
            inputSchema: {
              type: "object",
              properties: {
                a: {
                  type: "number",
                  description: "First number",
                },
                b: {
                  type: "number",
                  description: "Second number",
                },
              },
              required: ["a", "b"],
            },
          },
          {
            name: "get_time",
            description: "Get the current time",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "file_operations",
            description: "Perform basic file operations (read, write, list)",
            inputSchema: {
              type: "object",
              properties: {
                operation: {
                  type: "string",
                  enum: ["read", "write", "list"],
                  description: "Type of file operation",
                },
                path: {
                  type: "string",
                  description: "File or directory path",
                },
                content: {
                  type: "string",
                  description: "Content to write (for write operation)",
                },
              },
              required: ["operation", "path"],
            },
          },
          {
            name: "http_request",
            description: "Make HTTP requests to APIs",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The URL to make the request to",
                },
                method: {
                  type: "string",
                  enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
                  description: "HTTP method",
                  default: "GET"
                },
                headers: {
                  type: "object",
                  description: "HTTP headers as key-value pairs",
                  additionalProperties: {
                    type: "string"
                  }
                },
                body: {
                  type: "string",
                  description: "Request body (for POST, PUT, PATCH)"
                },
                timeout: {
                  type: "number",
                  description: "Request timeout in milliseconds",
                  default: 10000
                }
              },
              required: ["url"],
            },
          },
          {
            name: "weather_api",
            description: "Get weather data for a city using OpenWeatherMap API",
            inputSchema: {
              type: "object",
              properties: {
                city: {
                  type: "string",
                  description: "City name (e.g., 'London', 'New York')",
                },
                units: {
                  type: "string",
                  enum: ["metric", "imperial", "kelvin"],
                  description: "Temperature units",
                  default: "metric"
                }
              },
              required: ["city"],
            },
          },
          {
            name: "json_placeholder",
            description: "Get sample data from JSONPlaceholder API (posts, users, todos)",
            inputSchema: {
              type: "object",
              properties: {
                endpoint: {
                  type: "string",
                  enum: ["posts", "users", "todos", "comments", "albums", "photos"],
                  description: "API endpoint to fetch data from",
                },
                id: {
                  type: "number",
                  description: "Optional ID to fetch specific item",
                }
              },
              required: ["endpoint"],
            },
          },
        ],
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!args) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Arguments are required"
        );
      }

      try {
        switch (name) {
          case "echo":
            if (typeof args.text !== 'string') {
              throw new McpError(ErrorCode.InvalidParams, "Text parameter is required");
            }
            return {
              content: [
                {
                  type: "text",
                  text: `Echo: ${args.text}`,
                },
              ],
            };

          case "add_numbers":
            if (typeof args.a !== 'number' || typeof args.b !== 'number') {
              throw new McpError(ErrorCode.InvalidParams, "Both 'a' and 'b' parameters must be numbers");
            }
            const sum = args.a + args.b;
            return {
              content: [
                {
                  type: "text",
                  text: `${args.a} + ${args.b} = ${sum}`,
                },
              ],
            };

          case "get_time":
            const now = new Date().toISOString();
            return {
              content: [
                {
                  type: "text",
                  text: `Current time: ${now}`,
                },
              ],
            };

          case "file_operations":
            return await this.handleFileOperations(args);

          case "http_request":
            return await this.handleHttpRequest(args);

          case "weather_api":
            return await this.handleWeatherAPI(args);

          case "json_placeholder":
            return await this.handleJsonPlaceholder(args);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorMessage}`
        );
      }
    });
  }

  private async handleFileOperations(args: any) {
    if (!args || typeof args.operation !== 'string' || typeof args.path !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Both 'operation' and 'path' parameters are required"
      );
    }

    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      switch (args.operation) {
        case "read":
          const content = await fs.readFile(args.path, 'utf8');
          return {
            content: [
              {
                type: "text",
                text: `File content of ${args.path}:\n${content}`,
              },
            ],
          };

        case "write":
          if (typeof args.content !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, "Content parameter is required for write operation");
          }
          await fs.writeFile(args.path, args.content, 'utf8');
          return {
            content: [
              {
                type: "text",
                text: `Successfully wrote to ${args.path}`,
              },
            ],
          };

        case "list":
          const stats = await fs.stat(args.path);
          if (stats.isDirectory()) {
            const files = await fs.readdir(args.path);
            const fileList = files.join('\n');
            return {
              content: [
                {
                  type: "text",
                  text: `Directory contents of ${args.path}:\n${fileList}`,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `${args.path} is a file (size: ${stats.size} bytes)`,
                },
              ],
            };
          }

        default:
          throw new McpError(
            ErrorCode.InvalidParams,
            `Unknown file operation: ${args.operation}`
          );
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `File operation failed: ${errorMessage}`
      );
    }
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Example MCP server running on stdio");
  }
}

// Start the server
const server = new ExampleMCPServer();
server.run().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});