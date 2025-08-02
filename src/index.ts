#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

class ExampleMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "example-mcp-server",
        version: "0.1.0",
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
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
            name: "multiply_numbers",
            description: "Multiply two numbers",
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

          case "multiply_numbers":
            if (typeof args.a !== 'number' || typeof args.b !== 'number') {
              throw new McpError(ErrorCode.InvalidParams, "Both 'a' and 'b' parameters must be numbers");
            }
            const multiply = args.a * args.b;
            return {
              content: [
                {
                  type: "text",
                  text: `${args.a} * ${args.b} = ${multiply}`,
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