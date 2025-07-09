/**
 * Tool interface definitions for the Stampchain MCP Server
 * Defines the contract that all MCP tools must implement
 */

import { z } from 'zod';
import type { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';
import type { Stamp, StampQueryParams } from '../api/types.js';
import type { Logger } from '../utils/logger.js';

/**
 * Tool response content types matching MCP protocol
 */
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string; // base64 encoded image data
  mimeType: string;
}

export interface ResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
  };
}

/**
 * Union type for all possible content types
 */
export type ToolContent = TextContent | ImageContent | ResourceContent;

/**
 * Standard response format for all tools
 * Matches the MCP protocol CallToolResult type
 */
export interface ToolResponse {
  content: ToolContent[];
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

/**
 * Tool execution context providing access to server resources
 */
export interface ToolContext {
  /** Logger instance for the tool */
  logger?: Logger;
  /** API client for making external requests */
  apiClient?: {
    getStamp: (stampId: number) => Promise<Stamp>;
    searchStamps: (params?: StampQueryParams) => Promise<Stamp[]>;
    getRecentStamps?: (limit?: number) => Promise<Stamp[]>;
    [key: string]: any;
  };
  /** Additional context data */
  [key: string]: unknown;
}

/**
 * Optional metadata for tools
 */
export interface ToolMetadata {
  /** Tool version */
  version?: string;
  /** Tool author */
  author?: string;
  /** Tags for categorizing tools */
  tags?: string[];
  /** Whether the tool makes external API calls */
  requiresNetwork?: boolean;
  /** API endpoints the tool depends on */
  apiDependencies?: string[];
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Main tool interface that all tools must implement
 * @template TInput - The input type (before validation)
 * @template TOutput - The output type (after validation with defaults)
 */
export interface ITool<TInput = unknown, TOutput = TInput> {
  /** Unique name for the tool */
  name: string;

  /** Human-readable description of what the tool does */
  description: string;

  /** JSON Schema for input validation (compatible with MCP) */
  inputSchema: MCPTool['inputSchema'];

  /** Zod schema for runtime validation */
  schema: z.ZodSchema<TOutput, z.ZodTypeDef, TInput>;

  /** Optional metadata about the tool */
  metadata?: ToolMetadata;

  /**
   * Executes the tool with validated parameters
   * @param params - Validated parameters matching the schema output type
   * @param context - Execution context with logger and other resources
   * @returns Tool response following MCP protocol format
   * @throws {MCPError} for any execution errors
   */
  execute(params: TOutput, context?: ToolContext): Promise<ToolResponse>;
}

/**
 * Type guard to check if an object implements the ITool interface
 * @param obj - Object to check
 * @returns True if the object is a valid ITool implementation
 */
export function isTool(obj: unknown): obj is ITool {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const tool = obj as Record<string, unknown>;

  return (
    typeof tool.name === 'string' &&
    typeof tool.description === 'string' &&
    typeof tool.inputSchema === 'object' &&
    tool.inputSchema !== null &&
    typeof tool.execute === 'function' &&
    tool.schema instanceof z.ZodSchema
  );
}

/**
 * Type guard to check if a response is a valid ToolResponse
 * @param response - Response to check
 * @returns True if the response is valid
 */
export function isToolResponse(response: unknown): response is ToolResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const res = response as Record<string, unknown>;

  if (!Array.isArray(res.content)) {
    return false;
  }

  return res.content.every((item: unknown) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const content = item as Record<string, unknown>;
    const type = content.type;

    switch (type) {
      case 'text':
        return typeof content.text === 'string';
      case 'image':
        return typeof content.data === 'string' && typeof content.mimeType === 'string';
      case 'resource':
        return (
          typeof content.resource === 'object' &&
          content.resource !== null &&
          typeof (content.resource as Record<string, unknown>).uri === 'string'
        );
      default:
        return false;
    }
  });
}

/**
 * Helper function to create a text response
 * @param text - Text content
 * @param isError - Whether this is an error response
 * @returns ToolResponse with text content
 */
export function textResponse(text: string, isError = false): ToolResponse {
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

/**
 * Helper function to create an image response
 * @param data - Base64 encoded image data
 * @param mimeType - MIME type of the image
 * @returns ToolResponse with image content
 */
export function imageResponse(data: string, mimeType: string): ToolResponse {
  return {
    content: [{ type: 'image', data, mimeType }],
  };
}

/**
 * Helper function to create a resource response
 * @param uri - Resource URI
 * @param options - Optional resource properties
 * @returns ToolResponse with resource content
 */
export function resourceResponse(
  uri: string,
  options?: { mimeType?: string; text?: string }
): ToolResponse {
  return {
    content: [
      {
        type: 'resource',
        resource: {
          uri,
          ...options,
        },
      },
    ],
  };
}

/**
 * Helper function to create a multi-content response
 * @param contents - Array of content items
 * @returns ToolResponse with multiple content items
 */
export function multiResponse(...contents: ToolContent[]): ToolResponse {
  return {
    content: contents,
  };
}

/**
 * Base class for tools that provides common functionality
 * @template TInput - The input type (before validation)
 * @template TOutput - The output type (after validation with defaults)
 */
export abstract class BaseTool<TInput = unknown, TOutput = TInput>
  implements ITool<TInput, TOutput>
{
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly inputSchema: MCPTool['inputSchema'];
  public abstract readonly schema: z.ZodSchema<TOutput, z.ZodTypeDef, TInput>;
  public readonly metadata?: ToolMetadata;

  /**
   * Validates parameters using the Zod schema
   * @param params - Raw parameters to validate
   * @returns Validated parameters
   * @throws {ValidationError} if validation fails
   */
  protected validateParams(params: TInput): TOutput {
    const result = this.schema.safeParse(params);
    if (!result.success) {
      throw new Error(`Validation failed: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * Abstract execute method that must be implemented by subclasses
   */
  public abstract execute(params: TOutput, context?: ToolContext): Promise<ToolResponse>;
}
