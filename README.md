# Stampchain MCP Server

A Model Context Protocol (MCP) server for interacting with Bitcoin Stamps data via the Stampchain API. This server provides tools for querying stamp information, collections, and blockchain data without requiring API authentication.

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [One-Line Install](#one-line-install-recommended)
  - [Manual Installation](#manual-installation)
- [⚙️ IDE Configuration](#️-ide-configuration)
  - [Claude Desktop](#claude-desktop)
  - [Cursor IDE](#cursor-ide)
  - [Windsurf IDE](#windsurf-ide)
  - [Claude Code (VS Code)](#claude-code-vs-code-extension)
  - [Universal MCP Config](#universal-mcp-configuration)
  - [Configuration Tips](#configuration-tips)
- [👨‍💻 Developer Use Cases](#-developer-use-cases)
  - [Data Integration](#-data-integration-tasks)
  - [Code Generation](#-code-generation-examples)
  - [Analytics & Monitoring](#-analytics--monitoring)
  - [Integration Patterns](#-integration-patterns)
  - [API Reference & Testing](#-api-reference--testing)
  - [Pro Tips](#-pro-tips-for-developers)
- [🔧 Development](#-development)
  - [Development Workflow](#development-workflow)
  - [Architecture](#architecture-overview)
  - [Testing](#testing)
  - [Environment Configuration](#environment-configuration)
- [📚 Documentation](#-documentation)
  - [API Documentation](#api-documentation)
  - [Deployment](#deployment)
- [🤝 Contributing](#-contributing)
- [📞 Support](#-support-and-resources)
- [📄 License](#-license)

---

## 🎯 What This MCP Server Provides

- **🖼️ Stamp Query Tools**: Search and retrieve information about Bitcoin Stamps
- **📦 Collection Explorer**: Browse and analyze stamp collections  
- **🪙 Token Information**: Access SRC-20 token deployment and minting data
- **🤖 AI-Powered Integration**: Generate code and get development assistance
- **📡 Real-time Data**: Access live Stampchain API data through your IDE

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn package manager
- Claude Desktop, Cursor, Windsurf, or Claude Code IDE

### Installation

#### One-Line Install (Recommended)

```bash
# Clone and setup in one command
git clone https://github.com/stampchain-io/stampchain-mcp && cd stampchain-mcp && npm run setup
```

This will:
1. Install all dependencies
2. Build the project
3. Automatically configure Claude Desktop (if installed)

#### Manual Installation

```bash
# Clone the repository
git clone https://github.com/stampchain-io/stampchain-mcp
cd stampchain-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Configure your IDE (see IDE Configuration section below)
```

#### For Development

```bash
# Run in development mode with hot reload
npm run dev
```

## ⚙️ IDE Configuration

The Stampchain MCP server can be configured with various AI-powered IDEs that support the Model Context Protocol. Below are configuration instructions for popular IDEs.

#### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "stampchain": {
      "command": "node",
      "args": ["/absolute/path/to/stampchain-mcp/dist/index.js"],
      "env": {
        "STAMPCHAIN_API_URL": "https://stampchain.io/api/v2",
        "API_TIMEOUT": "30000",
        "DEBUG": "stampchain-mcp:*"
      }
    }
  }
}
```

#### Cursor IDE

Add to your Cursor settings (`File > Preferences > Settings > Extensions > MCP`):

1. Open Cursor settings (JSON) by pressing `Cmd/Ctrl + Shift + P` and selecting "Preferences: Open Settings (JSON)"
2. Add the MCP configuration:

```json
{
  "mcp.servers": {
    "stampchain": {
      "command": "node",
      "args": ["/absolute/path/to/stampchain-mcp/dist/index.js"],
      "env": {
        "STAMPCHAIN_API_URL": "https://stampchain.io/api/v2"
      }
    }
  }
}
```

Alternatively, create an `.mcp/config.json` file in your workspace root:

```json
{
  "servers": {
    "stampchain": {
      "command": "node",
      "args": ["./dist/index.js"],
      "env": {
        "STAMPCHAIN_API_URL": "https://stampchain.io/api/v2"
      }
    }
  }
}
```

#### Windsurf IDE

Configure MCP in Windsurf by adding to your workspace settings:

1. Create or edit `.windsurf/mcp.json` in your workspace:

```json
{
  "mcpServers": {
    "stampchain": {
      "command": "node",
      "args": ["${workspaceFolder}/dist/index.js"],
      "env": {
        "STAMPCHAIN_API_URL": "https://stampchain.io/api/v2",
        "NODE_ENV": "production"
      },
      "capabilities": {
        "tools": true,
        "resources": false,
        "prompts": false
      }
    }
  }
}
```

2. Or configure globally in Windsurf settings (`Settings > AI Assistant > MCP Servers`).

#### Claude Code (VS Code Extension)

For the Claude Code extension in VS Code:

1. Open VS Code settings (`Cmd/Ctrl + ,`)
2. Search for "Claude Code MCP"
3. Add server configuration:

```json
{
  "claudeCode.mcpServers": [
    {
      "name": "stampchain",
      "command": "node",
      "args": ["${workspaceFolder}/dist/index.js"],
      "env": {
        "STAMPCHAIN_API_URL": "https://stampchain.io/api/v2"
      }
    }
  ]
}
```

Or add to your workspace `.vscode/settings.json`:

```json
{
  "claudeCode.mcpServers": [
    {
      "name": "stampchain",
      "command": "node",
      "args": ["./dist/index.js"],
      "env": {
        "STAMPCHAIN_API_URL": "https://stampchain.io/api/v2"
      }
    }
  ]
}
```

#### Universal MCP Configuration

For IDEs that support standard MCP configuration, create an `mcp.json` file in your project root:

```json
{
  "version": "1.0",
  "servers": {
    "stampchain": {
      "command": "node",
      "args": ["./dist/index.js"],
      "env": {
        "STAMPCHAIN_API_URL": "https://stampchain.io/api/v2",
        "API_TIMEOUT": "30000"
      },
      "capabilities": {
        "tools": {
          "enabled": true,
          "tools": [
            "get_stamp",
            "search_stamps",
            "get_stamp_collection",
            "get_src20_token",
            "list_stamp_collections"
          ]
        }
      }
    }
  }
}
```

#### Configuration Tips

1. **Path Resolution**: 
   - Use absolute paths for global installations
   - Use `${workspaceFolder}` or relative paths for workspace-specific setups
   - On Windows, use forward slashes or escape backslashes

2. **Environment Variables**:
   - `STAMPCHAIN_API_URL`: API endpoint (default: https://stampchain.io/api/v2)
   - `API_TIMEOUT`: Request timeout in milliseconds (default: 30000)
   - `DEBUG`: Enable debug logging with `stampchain-mcp:*`

3. **Development vs Production**:
   - For development, point to `dist/index.js` after building
   - For production, consider using the npm-installed version

4. **Verification**:
   - After configuration, restart your IDE
   - Check the MCP server status in your IDE's output/console
   - Test with a simple query like "get stamp 0"

## 👨‍💻 Developer Use Cases

The Stampchain MCP server enables developers to quickly integrate Bitcoin Stamps data into their applications through AI assistance. Here are common developer scenarios:

### 🔍 **Data Integration Tasks**

Ask Claude to help you:

**Fetch All Stamps for Your App:**
- *"Help me integrate the Stampchain API to fetch all stamps and display them in a React component"*
- *"Create a Python script to retrieve stamps and save them to a PostgreSQL database"*
- *"Build a Vue.js gallery component that shows the latest 50 stamps with pagination"*

**SRC-20 Token Integration:**
- *"Generate code to display SRC-20 tokens on my website based on my Next.js codebase"*
- *"Create an API endpoint that fetches token balances for a given Bitcoin address"*
- *"Build a token dashboard component showing supply, holders, and recent transfers"*

**Collection Analytics:**
- *"Help me build a collections analytics page showing volume and floor prices"*
- *"Create a collection ranking system based on holder count and activity"*
- *"Generate a chart component displaying collection trends over time"*

### 🛠 **Code Generation Examples**

The MCP server can help generate production-ready code for:

**Frontend Components:**
```
"Create a stamp gallery component for my React app that shows:
- Stamp image thumbnails
- Creator information
- Rarity indicators
- Click to view full details
Use TypeScript and Tailwind CSS to match my existing codebase"
```

**Backend Services:**
```
"Build a Node.js Express API that:
- Caches stamp data in Redis
- Provides search endpoints
- Handles rate limiting
- Returns paginated results
Include proper error handling and TypeScript types"
```

**Database Integration:**
```
"Create database schemas and migration scripts for:
- Storing stamp metadata
- Tracking collection statistics
- Indexing for fast searches
Use my existing PostgreSQL setup"
```

### 📊 **Analytics & Monitoring**

**Real-time Data Processing:**
- *"Help me set up WebSocket connections to monitor new stamp creations"*
- *"Create a data pipeline that processes stamp transactions and updates analytics"*
- *"Build alerting for specific stamp activities or price movements"*

**Custom Dashboards:**
- *"Generate a trading dashboard showing stamp market activity"*
- *"Create admin panels for managing stamp collections"*
- *"Build user portfolio pages showing owned stamps and values"*

### 🎯 **Integration Patterns**

**E-commerce Integration:**
```
"I'm building an NFT marketplace. Help me:
1. Integrate stamp listings with buy/sell functionality
2. Handle Bitcoin payments and transfers
3. Create user profiles with stamp collections
4. Add stamp search and filtering capabilities"
```

**Portfolio Tracking:**
```
"For my crypto portfolio app, help me:
1. Track user's stamp holdings
2. Calculate portfolio values
3. Show performance metrics
4. Generate tax reports for stamp transactions"
```

**Social Features:**
```
"Add social features to my app:
1. User profiles showing stamp collections
2. Following/followers for collectors
3. Activity feeds for stamp trading
4. Comments and ratings on stamps"
```

### 🚀 **Quick Start Queries**

Once you have the MCP server configured, try these developer-focused prompts:

**Getting Started:**
- *"Show me how to fetch the 10 most recent stamps and explain the data structure"*
- *"What's the best way to integrate stamp data into a JavaScript application?"*
- *"Help me understand the SRC-20 token API endpoints and response formats"*

**Code Review & Optimization:**
- *"Review my stamp fetching code and suggest performance improvements"*
- *"Help me add error handling to my Stampchain API integration"*
- *"Optimize my database queries for stamp search functionality"*

**Architecture Planning:**
- *"Design a scalable architecture for a stamp trading platform"*
- *"What's the best caching strategy for stamp metadata?"*
- *"Help me plan a microservices architecture for stamp analytics"*

### 📚 **API Reference & Testing**

**Postman Collection:**
Explore the complete Stampchain API with our comprehensive Postman collection:
- **Collection Link:** [Stampchain OpenAPI 3.0](https://www.postman.com/pepecola/bitcoin-stamps/collection/s41l9kv/stampchain-openapi-3-0)
- Test all endpoints interactively
- View request/response examples
- Copy code snippets for your preferred language
- Understand API parameters and data structures

**Using with the MCP Server:**
```
"I want to build a stamp search feature. Show me:
1. How to use the Postman collection to test the search API
2. Generate TypeScript interfaces based on the API responses
3. Create a React component that implements the search functionality
4. Add proper error handling and loading states"
```

### 💡 **Pro Tips for Developers**

1. **Start with Postman:** Test API endpoints in the Postman collection before coding
2. **Specify Your Tech Stack:** Mention your framework, database, and tools for tailored code generation
3. **Include Context:** Share relevant parts of your existing codebase for better integration
4. **Reference API Docs:** Point Claude to specific Postman endpoints when asking for help
5. **Ask for Testing:** Request unit tests and integration tests along with your code
6. **Request Documentation:** Ask for API documentation and code comments
7. **Iterate and Refine:** Build incrementally - start simple and add features

## 🔧 Development

### Development Workflow

1. **Run in development mode**:

   ```bash
   npm run dev
   ```

2. **Run tests**:

   ```bash
   npm test
   ```

3. **Build for production**:

   ```bash
   npm run build
   ```

### Architecture Overview

The system follows a Model Context Protocol (MCP) server architecture with:

- **Protocol**: MCP SDK for tool exposure
- **Language**: TypeScript/Node.js
- **API Client**: Axios for Stampchain API communication
- **Authentication**: None required (public API)
- **Deployment**: Local via Claude Desktop or standalone Node.js

For detailed architecture documentation, see [architecture/README.md](architecture/README.md).

## 📚 Documentation

### API Documentation

The project exposes MCP tools for Stampchain data access. For complete API documentation, see:

- [API Overview](api/README.md)
- [API Endpoints](api/api-endpoints.md)

### Stampchain API Base URLs

- Main API: `https://stampchain.io/api/v2`
- Public endpoints (no authentication required)

### Testing

The project uses Jest for testing. For testing documentation, see:

- [Testing Overview](testing/README.md)
- [Test Scripts](testing/test-scripts.md)

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Deployment

For deployment instructions, see:

- [Deployment Overview](deployment/README.md)
- [Quick Start MVP Deployment](deployment/quick-start-mvp.md)
- [MCP Server Configuration](deployment/port-configuration.md)

### Environment Configuration

The project requires minimal configuration:

```bash
# Stampchain API (no authentication required)
STAMPCHAIN_API_URL=https://stampchain.io/api/v2

# Optional: Request timeout (milliseconds)
API_TIMEOUT=30000

# Optional: Enable debug logging
DEBUG=stampchain-mcp:*
```

## 🤝 Contributing

1. **Documentation**: Update documentation for any changes
2. **Testing**: Ensure all tests pass before submitting changes
3. **Code Quality**: Follow the established linting and formatting rules
4. **MCP Standards**: Follow MCP SDK best practices for tool implementation

### Development Guidelines

- Follow TypeScript best practices
- Use the established project structure
- Write tests for new functionality
- Update documentation for API changes
- Use the delegation templates for complex tasks

## 📞 Support and Resources

- **Stampchain API**: https://stampchain.io/api/v2
- **MCP SDK Documentation**: https://modelcontextprotocol.io
- **Documentation**: This docs directory contains all project documentation
- **Issue Tracking**: GitHub Issues
- **Bitcoin Stamps Info**: https://stampchain.io

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Project Version**: 0.1.0  
**Last Updated**: 2025-01-19  
**Documentation Version**: 1.0
