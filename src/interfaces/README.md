# Tool Interface Documentation

This directory contains the interface definitions for MCP tools in the Stampchain MCP Server.

## Overview

The tool interface provides a contract that all MCP tools must implement. It ensures consistency across tools and enables proper type checking, validation, and error handling.

## Key Interfaces

### ITool<TInput, TOutput>

The main interface that all tools must implement:

```typescript
interface ITool<TInput = unknown, TOutput = TInput> {
  name: string; // Unique tool identifier
  description: string; // Human-readable description
  inputSchema: MCPTool['inputSchema']; // JSON Schema for MCP protocol
  schema: z.ZodSchema<TOutput, z.ZodTypeDef, TInput>; // Zod schema for validation
  metadata?: ToolMetadata; // Optional tool metadata
  execute(params: TOutput, context?: ToolContext): Promise<ToolResponse>;
}
```

### ToolResponse

Standard response format matching MCP protocol:

```typescript
interface ToolResponse {
  content: ToolContent[]; // Array of content items
  isError?: boolean; // Error indicator
  _meta?: Record<string, unknown>; // Optional metadata
}
```

### ToolContent Types

- `TextContent`: Plain text responses
- `ImageContent`: Base64-encoded images
- `ResourceContent`: References to external resources

## Usage Examples

### Basic Tool Implementation

```typescript
import { z } from 'zod';
import { ITool, textResponse } from '../interfaces/tool.js';

const MyToolSchema = z.object({
  input: z.string().min(1),
});

type MyToolInput = z.input<typeof MyToolSchema>;
type MyToolOutput = z.output<typeof MyToolSchema>;

export class MyTool implements ITool<MyToolInput, MyToolOutput> {
  name = 'my_tool';
  description = 'A simple tool example';

  inputSchema = {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input text' },
    },
    required: ['input'],
  };

  schema = MyToolSchema;

  execute(params: MyToolOutput): Promise<ToolResponse> {
    return Promise.resolve(textResponse(`Processed: ${params.input}`));
  }
}
```

### Using BaseTool

For simpler implementations, extend the `BaseTool` abstract class:

```typescript
export class SimpleTool extends BaseTool<MyToolInput, MyToolOutput> {
  name = 'simple_tool';
  description = 'A tool using BaseTool';
  inputSchema = {
    /* ... */
  };
  schema = MyToolSchema;

  execute(params: MyToolOutput): Promise<ToolResponse> {
    const validated = this.validateParams(params);
    return Promise.resolve(textResponse(validated.input));
  }
}
```

## Helper Functions

- `textResponse(text, isError?)` - Create a text response
- `imageResponse(data, mimeType)` - Create an image response
- `resourceResponse(uri, options?)` - Create a resource response
- `multiResponse(...contents)` - Create a multi-content response

## Type Guards

- `isTool(obj)` - Check if an object implements ITool
- `isToolResponse(response)` - Validate tool response format

## Best Practices

1. **Always use Zod schemas** for runtime validation
2. **Handle errors properly** using MCPError classes
3. **Log important operations** using the provided context logger
4. **Document your tools** with clear descriptions
5. **Use type parameters** to ensure type safety between input and output
6. **Return promises** even for synchronous operations

## See Also

- [Example Tool Implementation](../tools/example-tool.ts)
- [Error Handling](../utils/errors.ts)
- [MCP Protocol Documentation](https://modelcontextprotocol.io)
