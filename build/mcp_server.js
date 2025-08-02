#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from "@modelcontextprotocol/sdk/types.js";
class ExampleMCPServer {
    server;
    constructor() {
        this.server = new Server({
            name: "example-mcp-server",
            version: "0.1.0",
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
        this.setupErrorHandling();
    }
    setupToolHandlers() {
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
                ],
            };
        });
        // Handle tool execution
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case "echo":
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Echo: ${args.text}`,
                                },
                            ],
                        };
                    case "add_numbers":
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
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`);
            }
        });
    }
    setupErrorHandling() {
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
//# sourceMappingURL=mcp_server.js.map