# Protocol Module Documentation

The protocol module implements the Model Context Protocol (MCP) server functionality, handling all communication between Claude Desktop and the Stampchain MCP Server.

## Architecture Overview

```
┌─────────────────────┐
│  Claude Desktop     │
│  (MCP Client)       │
└──────────┬──────────┘
           │ MCP Protocol
           │ (JSON-RPC)
┌──────────▼──────────┐
│  Protocol Manager   │
├─────────────────────┤
│  Middleware Stack   │
├─────────────────────┤
│  Protocol Handlers  │
├─────────────────────┤
│  Connection Handler │
└─────────────────────┘
           │
┌──────────▼──────────┐
│   Tool Registry     │
│   API Client        │
└─────────────────────┘
```

## Components

### 1. Protocol Manager (`manager.ts`)

The main orchestrator for the MCP server:

```typescript
const manager = new ProtocolManager({
  toolRegistry,
  apiClient,
  config,
});

// Connect to transport
await manager.connect(transport);
```

**Responsibilities:**

- Creates and configures the MCP server
- Registers request and notification handlers
- Manages connection lifecycle
- Provides server statistics

### 2. Protocol Handlers (`handlers.ts`)

Implements handlers for all MCP protocol methods:

```typescript
const handlers = new ProtocolHandlers({
  toolRegistry,
  apiClient,
  config,
});
```

**Supported Methods:**

- `tools/list` - List available tools
- `tools/call` - Execute a specific tool
- `resources/list` - List resources (not implemented)
- `resources/read` - Read resource (not implemented)
- `prompts/list` - List prompts (not implemented)
- `prompts/get` - Get prompt (not implemented)
- `completion/complete` - Completions (not implemented)
- `notifications/level` - Set logging level

### 3. Middleware System (`middleware.ts`)

Provides request/response processing pipeline:

```typescript
const middleware = new MiddlewareManager(config);

// Add custom middleware
middleware.use(async (request, next) => {
  console.log('Before request:', request.method);
  const result = await next();
  console.log('After request');
  return result;
});
```

**Built-in Middleware:**

- **Validation** - Validates request structure
- **Logging** - Logs all requests/responses
- **Rate Limiting** - Prevents abuse
- **Error Handling** - Standardizes error responses
- **Metrics** - Collects usage statistics

### 4. Connection Handler (`connection.ts`)

Manages client connections and sessions:

```typescript
const connectionHandler = new ConnectionHandler({
  config,
  maxConnections: 100,
  sessionTimeout: 3600000, // 1 hour
});

// Listen to connection events
connectionHandler.on('connect', (info) => {
  console.log('New connection:', info.id);
});

connectionHandler.on('disconnect', (id) => {
  console.log('Connection closed:', id);
});
```

**Features:**

- Connection tracking
- Session management
- Activity monitoring
- Automatic cleanup of inactive connections
- Connection statistics

## Usage Example

Here's how the protocol components work together:

```typescript
import { ProtocolManager } from './protocol/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAllTools, toolMetadata } from './tools/index.js';
import { ToolRegistry } from './tools/registry.js';
import { StampchainClient } from './api/stampchain-client.js';
import { loadConfiguration } from './config/index.js';

// Load configuration
const config = loadConfiguration();

// Create dependencies
const toolRegistry = new ToolRegistry(config.registry);
const apiClient = new StampchainClient(config.api);

// Register tools
const tools = createAllTools(apiClient);
for (const [category, metadata] of Object.entries(toolMetadata)) {
  for (const toolName of metadata.tools) {
    const tool = tools[toolName];
    if (tool) {
      toolRegistry.register(tool, {
        category: metadata.category,
        version: '1.0.0',
      });
    }
  }
}

// Create protocol manager
const protocolManager = new ProtocolManager({
  toolRegistry,
  apiClient,
  config,
});

// Create and connect transport
const transport = new StdioServerTransport();
await protocolManager.connect(transport);

// Server is now running and handling requests
```

## Middleware Development

Create custom middleware for specific needs:

```typescript
import type { Middleware } from './protocol/middleware.js';

// Authentication middleware
const authMiddleware: Middleware = async (request, next) => {
  // Check authentication token
  const token = request.params?.auth;

  if (!isValidToken(token)) {
    throw new McpError(ErrorCode.InvalidRequest, 'Authentication required');
  }

  // Continue to next middleware
  return next();
};

// Caching middleware
const cacheMiddleware: Middleware = async (request, next) => {
  // Check cache for GET-like operations
  if (request.method === 'tools/list') {
    const cached = cache.get('tools-list');
    if (cached) {
      return cached;
    }
  }

  // Execute request
  const result = await next();

  // Cache result
  if (request.method === 'tools/list') {
    cache.set('tools-list', result, 60000); // Cache for 1 minute
  }

  return result;
};
```

## Error Handling

The protocol module provides comprehensive error handling:

1. **Validation Errors** - Invalid request parameters
2. **Execution Errors** - Tool execution failures
3. **Rate Limit Errors** - Too many requests
4. **Internal Errors** - Unexpected server errors

All errors are converted to standard MCP error format:

```typescript
{
  code: ErrorCode,
  message: string,
  data?: any
}
```

## Performance Considerations

1. **Connection Pooling** - Reuse connections when possible
2. **Request Batching** - Not currently supported but planned
3. **Rate Limiting** - Prevents abuse and ensures fair usage
4. **Middleware Order** - Place validation early, metrics last
5. **Async Operations** - All handlers are async for non-blocking I/O

## Security

1. **Input Validation** - All requests are validated
2. **Rate Limiting** - Prevents DoS attacks
3. **Error Sanitization** - Stack traces only in development
4. **Connection Limits** - Maximum concurrent connections
5. **Session Timeouts** - Automatic cleanup of inactive sessions

## Monitoring and Debugging

Enable debug logging for detailed protocol information:

```bash
STAMPCHAIN_LOG_LEVEL=debug npm start
```

Monitor protocol statistics:

```typescript
const stats = protocolManager.getStats();
console.log('Protocol stats:', stats);

const connectionStats = connectionHandler.getStats();
console.log('Connection stats:', connectionStats);
```

## Future Enhancements

1. **WebSocket Transport** - Real-time bidirectional communication
2. **HTTP Transport** - RESTful API support
3. **Request Batching** - Multiple requests in single call
4. **Response Streaming** - Large response streaming
5. **Compression** - Gzip/Brotli compression support
6. **Authentication** - OAuth2/JWT support
7. **Metrics Export** - Prometheus/OpenTelemetry integration
