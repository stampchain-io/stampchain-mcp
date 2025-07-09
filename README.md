# Stampchain MCP Server

A Model Context Protocol (MCP) server for interacting with Bitcoin Stamps and
SRC-20 token data via the Stampchain API. This server provides MCP-compatible
clients with tools to query Bitcoin Stamps, collections, and SRC-20 tokens.

## Features

- **Bitcoin Stamps Tools**: Get stamp details, search stamps, and retrieve
  recent stamps
- **Stamp Collections**: Query collections and search through collection data
- **SRC-20 Tokens**: Get token information and search through SRC-20 tokens
- **Type-safe**: Built with TypeScript and Zod validation
- **Comprehensive Testing**: Unit, integration, and API tests
- **Configurable**: Flexible configuration options for different environments

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/stampchain-io/stampchain-mcp.git
   cd stampchain-mcp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Test the installation:**
   ```bash
   npm run start
   ```

### MCP Client Integration

#### Claude Desktop

To use with Claude Desktop, add the following to your
`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stampchain": {
      "command": "node",
      "args": ["/path/to/stampchain-mcp/dist/index.js"],
      "cwd": "/path/to/stampchain-mcp"
    }
  }
}
```

**Alternative: Using npx (recommended)**

For easier setup without local installation:

```json
{
  "mcpServers": {
    "stampchain": {
      "command": "npx",
      "args": ["-y", "stampchain-mcp"]
    }
  }
}
```

_Note: Replace `/path/to/stampchain-mcp` with the actual path to your
installation directory._

#### Other MCP Clients

This server implements the standard MCP protocol and can be used with any
MCP-compatible client. Refer to your client's documentation for specific
configuration instructions. The server accepts connections via stdio transport.

## Available Tools

### Bitcoin Stamps

- `get_stamp` - Get detailed information about a specific stamp by ID
- `search_stamps` - Search stamps with various filters (creator, collection,
  etc.)
- `get_recent_stamps` - Get the most recently created stamps

### Stamp Collections

- `get_collection` - Get detailed information about a specific collection
- `search_collections` - Search collections with filters

### SRC-20 Tokens

- `get_token_info` - Get detailed information about a specific SRC-20 token
- `search_tokens` - Search SRC-20 tokens with various filters

## Configuration

The server can be configured through:

1. **Configuration file** (JSON format)
2. **Environment variables**
3. **Command line arguments**

### Example Configuration File

```json
{
  "api": {
    "baseUrl": "https://stampchain.io/api",
    "timeout": 30000,
    "retries": 3
  },
  "logging": {
    "level": "info"
  },
  "registry": {
    "maxTools": 1000,
    "validateOnRegister": true
  }
}
```

### Environment Variables

- `STAMPCHAIN_API_URL` - API base URL (default: https://stampchain.io/api)
- `STAMPCHAIN_LOG_LEVEL` - Logging level (debug, info, warn, error)
- `STAMPCHAIN_API_TIMEOUT` - API timeout in milliseconds

### Command Line Usage

```bash
# Start with default configuration
npm run start

# Start with custom config file
npm run start -- --config config.json

# Start with debug logging
npm run start -- --log-level debug

# Show available tools
npm run tools

# Show version information
npm run version
```

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the TypeScript project
- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Testing

The project includes comprehensive tests:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:api

# Run with coverage
npm run test:coverage

# Run tests in UI mode
npm run test:ui
```

### Project Structure

```
src/
├── api/           # API client and related utilities
├── config/        # Configuration management
├── interfaces/    # TypeScript interfaces
├── protocol/      # MCP protocol handlers
├── schemas/       # Zod validation schemas
├── tools/         # MCP tool implementations
├── utils/         # Utility functions
├── index.ts       # Main entry point
└── server.ts      # Server implementation
```

## API Reference

### Tool Parameters

All tools accept various parameters for filtering and pagination:

- `limit` - Number of results to return (default: 10, max: 100)
- `page` - Page number for pagination (default: 1)
- `sort` - Sort field and direction (e.g., "created_desc")

### Response Format

All tools return structured data with:

- `success` - Boolean indicating if the request was successful
- `data` - The requested data (stamps, collections, tokens)
- `pagination` - Pagination information when applicable
- `error` - Error details if the request failed

## Troubleshooting

### Common Issues

1. **Build Errors**: Ensure you have Node.js 18+ and run `npm install` first
2. **Connection Issues**: Check that the Stampchain API is accessible
3. **MCP Client Integration**: Verify the path in your configuration file is
   correct

### Debugging

Enable debug logging to see detailed information:

```bash
npm run start -- --debug
```

Or set the log level in your configuration:

```json
{
  "logging": {
    "level": "debug"
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

### Code Style

- Use TypeScript for all new code
- Follow the existing ESLint configuration
- Write tests for new features
- Update documentation as needed

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Issues**:
  [GitHub Issues](https://github.com/stampchain-io/stampchain-mcp/issues)
- **Documentation**: [Stampchain API Docs](https://stampchain.io/docs)
- **Community**: [Discord](https://discord.gg/stampchain)

## Changelog

### v0.1.0

- Initial release
- Basic Bitcoin Stamps, Collections, and SRC-20 tools
- MCP client integration
- Comprehensive test suite
