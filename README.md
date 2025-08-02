# Example MCP Server

An example implementation of a Model Context Protocol (MCP) server using `src/index.ts`.

## Prerequisites

- Node.js v18 or newer
- npm

## Installation

```sh
npm install
```

## Build

Compile the TypeScript source code:

```sh
npm run build
```

## Run the Server

Start the MCP server:

```sh
npm start
```

Or directly:

```sh
node build/index.js
```

## Development

To automatically rebuild and restart on changes:

```sh
npm run dev
```

## MCP Inspector

To inspect the server with the MCP Inspector:

```sh
npm run mcp-inspector
```

## Usage

The server exposes several tools:

- `echo`: Echoes back input text.
- `add_numbers`: Adds two numbers.
- `multiply_numbers`: Multiplies two numbers.
- `get_time`: Returns the current time.
- `file_operations`: Read, write, or list files/directories.

See `src/index.ts` for implementation details.

## License

MIT
