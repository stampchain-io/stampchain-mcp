/**
 * MCP Response Formatter - Ensures responses comply with MCP protocol standards
 * Provides utilities for formatting tool responses and error handling
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse, ToolContent } from '../interfaces/tool.js';
import { textResponse, multiResponse } from '../interfaces/tool.js';
import type { StandardErrorContext } from './error-context.js';
import { MCPError, ValidationError, ToolExecutionError } from './errors.js';
import { createLogger } from './logger.js';

const logger = createLogger('MCPResponseFormatter');

/**
 * MCP-compliant error response configuration
 */
export interface MCPErrorResponseConfig {
  /** Include detailed error context in development */
  includeContext: boolean;
  /** Include stack traces in development */
  includeStackTrace: boolean;
  /** Maximum error message length */
  maxMessageLength: number;
  /** Whether to log errors automatically */
  autoLog: boolean;
}

/**
 * Default configuration for MCP error responses
 */
const DEFAULT_ERROR_CONFIG: MCPErrorResponseConfig = {
  includeContext: process.env.NODE_ENV === 'development',
  includeStackTrace: process.env.NODE_ENV === 'development',
  maxMessageLength: 1000,
  autoLog: true,
};

/**
 * MCP Response Formatter class
 */
export class MCPResponseFormatter {
  private config: MCPErrorResponseConfig;

  constructor(config?: Partial<MCPErrorResponseConfig>) {
    this.config = { ...DEFAULT_ERROR_CONFIG, ...config };
  }

  /**
   * Creates an MCP-compliant error response
   * This method ensures errors are properly formatted according to MCP protocol
   */
  public createErrorResponse(
    error: unknown,
    context: StandardErrorContext
  ): { mcpError: McpError; toolResponse: ToolResponse } {
    // Convert to our internal error format first
    const internalError = this.convertToInternalError(error, context);

    // Map to appropriate MCP error code
    const mcpErrorCode = this.mapToMCPErrorCode(internalError);

    // Create detailed error message
    const errorMessage = this.formatErrorMessage(internalError, context);

    // Create MCP error
    const mcpError = new McpError(mcpErrorCode, errorMessage);

    // Create tool response for cases where we return instead of throw
    const toolResponse = this.createToolErrorResponse(internalError, context);

    // Log if configured
    if (this.config.autoLog) {
      this.logError(internalError, context, mcpError);
    }

    return { mcpError, toolResponse };
  }

  /**
   * Maps internal error types to MCP protocol error codes
   */
  private mapToMCPErrorCode(error: MCPError): ErrorCode {
    switch (error.constructor.name) {
      case 'ValidationError':
        return ErrorCode.InvalidParams;

      case 'ResourceNotFoundError':
        return ErrorCode.InvalidParams; // Resource not found is typically a parameter issue

      case 'AuthenticationError':
        return ErrorCode.InvalidRequest; // Authentication issues are request-level problems

      case 'RateLimitError':
        return ErrorCode.InternalError; // Rate limiting is a server-side concern

      case 'NetworkError':
      case 'TimeoutError':
      case 'StampchainAPIError':
        return ErrorCode.InternalError; // External service issues are internal from MCP perspective

      case 'ToolExecutionError':
        return ErrorCode.InternalError; // Tool execution failures are internal errors

      case 'ProtocolError':
        return ErrorCode.InvalidRequest; // Protocol violations are request issues

      default:
        return ErrorCode.InternalError; // Default to internal error for unknown types
    }
  }

  /**
   * Formats error message according to MCP standards
   */
  private formatErrorMessage(error: MCPError, context: StandardErrorContext): string {
    let message = error.message;

    // Add context information if configured
    if (this.config.includeContext) {
      const contextInfo = [
        `Tool: ${context.toolName}`,
        `Operation: ${context.operation}`,
        `Severity: ${context.severity}`,
        `Retryable: ${context.retryable}`,
        `Timestamp: ${context.timestamp}`,
      ].join(' | ');

      message = `${message}\n\nContext: ${contextInfo}`;
    }

    // Add stack trace if configured and available
    if (this.config.includeStackTrace && error.stack) {
      message = `${message}\n\nStack Trace:\n${error.stack}`;
    }

    // Add error data if available
    if (error.data && typeof error.data === 'object') {
      try {
        const dataStr = JSON.stringify(error.data, null, 2);
        message = `${message}\n\nError Details:\n${dataStr}`;
      } catch {
        message = `${message}\n\nError Details: [Unable to serialize error data]`;
      }
    }

    // Truncate if too long
    if (message.length > this.config.maxMessageLength) {
      message = message.substring(0, this.config.maxMessageLength - 3) + '...';
    }

    return message;
  }

  /**
   * Creates a tool response for error cases
   */
  private createToolErrorResponse(error: MCPError, context: StandardErrorContext): ToolResponse {
    const errorSummary: Record<string, unknown> = {
      error: error.constructor.name,
      message: error.message,
      tool: context.toolName,
      operation: context.operation,
      severity: context.severity,
      retryable: context.retryable,
      timestamp: context.timestamp,
    };

    if (error.data) {
      errorSummary.details = error.data;
    }

    const content: ToolContent[] = [
      {
        type: 'text',
        text: `❌ Error: ${error.message}`,
      },
    ];

    // Add detailed error information if configured
    if (this.config.includeContext) {
      content.push({
        type: 'text',
        text: `\n📊 Error Details:\n${JSON.stringify(errorSummary, null, 2)}`,
      });
    }

    return {
      content,
      isError: true,
      _meta: {
        errorContext: context,
        errorType: error.constructor.name,
        mcpCompliant: true,
      },
    };
  }

  /**
   * Converts unknown error to internal MCPError
   */
  private convertToInternalError(error: unknown, context: StandardErrorContext): MCPError {
    if (error instanceof MCPError) {
      return error;
    }

    if (error instanceof Error) {
      return new ToolExecutionError(
        `${context.toolName} failed during ${context.operation}: ${error.message}`,
        context.toolName,
        error
      );
    }

    return new ToolExecutionError(
      `${context.toolName} failed during ${context.operation}: Unknown error`,
      context.toolName,
      error
    );
  }

  /**
   * Logs error with proper context
   */
  private logError(error: MCPError, context: StandardErrorContext, mcpError: McpError): void {
    const logData: Record<string, unknown> = {
      tool: context.toolName,
      operation: context.operation,
      severity: context.severity,
      retryable: context.retryable,
      errorType: error.constructor.name,
      mcpErrorCode: mcpError.code,
      message: error.message,
    };

    if (error.data) {
      logData.errorData = error.data;
    }

    if (this.config.includeStackTrace && error.stack) {
      logData.stack = error.stack;
    }

    logger.error(`MCP Error in ${context.toolName}`, logData);
  }

  /**
   * Updates configuration
   */
  public updateConfig(config: Partial<MCPErrorResponseConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration
   */
  public getConfig(): MCPErrorResponseConfig {
    return { ...this.config };
  }
}

/**
 * Default response formatter instance
 */
export const defaultResponseFormatter = new MCPResponseFormatter();

/**
 * Convenience function for creating MCP-compliant error responses
 */
export function createMCPErrorResponse(
  error: unknown,
  context: StandardErrorContext
): { mcpError: McpError; toolResponse: ToolResponse } {
  return defaultResponseFormatter.createErrorResponse(error, context);
}

/**
 * Convenience function for throwing MCP-compliant errors
 */
export function throwMCPCompliantError(error: unknown, context: StandardErrorContext): never {
  const { mcpError } = defaultResponseFormatter.createErrorResponse(error, context);
  throw mcpError;
}

/**
 * Creates a success response with proper MCP formatting
 */
export function createSuccessResponse(
  content: string | ToolContent[],
  meta?: Record<string, unknown>
): ToolResponse {
  if (typeof content === 'string') {
    const response: ToolResponse = {
      content: [{ type: 'text', text: content }],
      isError: false,
      _meta: {
        mcpCompliant: true,
      },
    };

    if (meta) {
      response._meta = { ...response._meta, ...meta };
    }

    return response;
  }

  const response: ToolResponse = {
    content,
    isError: false,
    _meta: {
      mcpCompliant: true,
    },
  };

  if (meta) {
    response._meta = { ...response._meta, ...meta };
  }

  return response;
}

/**
 * Validates that a tool response is MCP-compliant
 */
export function validateMCPResponse(response: ToolResponse): boolean {
  // Check required fields
  if (!response.content || !Array.isArray(response.content)) {
    return false;
  }

  // Check content items
  for (const item of response.content) {
    if (!item.type || typeof item.type !== 'string') {
      return false;
    }

    switch (item.type) {
      case 'text':
        if (typeof (item as any).text !== 'string') {
          return false;
        }
        break;
      case 'image':
        if (typeof (item as any).data !== 'string' || typeof (item as any).mimeType !== 'string') {
          return false;
        }
        break;
      case 'resource':
        if (typeof (item as any).resource !== 'object') {
          return false;
        }
        break;
      default:
        // Unknown content type
        return false;
    }
  }

  return true;
}
