/**
 * Error handling utilities for the Stampchain MCP Server
 * Provides JSON-RPC 2.0 compliant error classes and utilities
 */

import { logger } from './logger.js';

/**
 * JSON-RPC 2.0 Error Codes
 * @see https://www.jsonrpc.org/specification#error_object
 */
export enum ErrorCode {
  // JSON-RPC 2.0 standard error codes
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,

  // Server error codes (reserved range: -32000 to -32099)
  TOOL_EXECUTION_ERROR = -32000,
  AUTHENTICATION_ERROR = -32001,
  RATE_LIMIT_ERROR = -32002,
  RESOURCE_NOT_FOUND = -32003,
  VALIDATION_ERROR = -32004,
  NETWORK_ERROR = -32005,
  TIMEOUT_ERROR = -32006,
  STAMPCHAIN_API_ERROR = -32007,
}

/**
 * Error code descriptions for better debugging
 */
const ERROR_DESCRIPTIONS: Record<ErrorCode, string> = {
  [ErrorCode.PARSE_ERROR]: 'Invalid JSON was received by the server',
  [ErrorCode.INVALID_REQUEST]: 'The JSON sent is not a valid Request object',
  [ErrorCode.METHOD_NOT_FOUND]: 'The method does not exist / is not available',
  [ErrorCode.INVALID_PARAMS]: 'Invalid method parameter(s)',
  [ErrorCode.INTERNAL_ERROR]: 'Internal JSON-RPC error',
  [ErrorCode.TOOL_EXECUTION_ERROR]: 'Error occurred during tool execution',
  [ErrorCode.AUTHENTICATION_ERROR]: 'Authentication failed',
  [ErrorCode.RATE_LIMIT_ERROR]: 'Rate limit exceeded',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Requested resource not found',
  [ErrorCode.VALIDATION_ERROR]: 'Validation error',
  [ErrorCode.NETWORK_ERROR]: 'Network communication failed',
  [ErrorCode.TIMEOUT_ERROR]: 'Request timeout exceeded',
  [ErrorCode.STAMPCHAIN_API_ERROR]: 'Stampchain API returned an error',
};

/**
 * JSON-RPC 2.0 compliant error structure
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Base MCP Error class that extends the standard Error
 * All MCP errors should extend this class
 *
 * @example
 * ```typescript
 * throw new MCPError('Something went wrong', ErrorCode.INTERNAL_ERROR, { details: 'Additional info' });
 * ```
 */
export class MCPError extends Error {
  public readonly code: ErrorCode;
  public readonly data?: unknown;
  public readonly timestamp: string;

  constructor(message: string, code: ErrorCode, data?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.data = data;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Log the error when created
    const logData = {
      code: this.code,
      name: this.name,
      timestamp: this.timestamp,
      ...(this.data ? { data: this.data } : {}),
      ...(process.env.NODE_ENV === 'development' && this.stack ? { stack: this.stack } : {}),
    };

    logger.error(`${this.name}: ${this.message}`, logData);
  }

  /**
   * Converts the error to a JSON-RPC 2.0 compliant error object
   * @returns JSON-RPC error object
   */
  public toJSON(): JsonRpcError {
    return {
      code: this.code,
      message: this.message,
      ...(this.data !== undefined ? { data: this.data } : {}),
    };
  }

  /**
   * Gets a human-readable description of the error code
   * @returns Error code description
   */
  public getCodeDescription(): string {
    return ERROR_DESCRIPTIONS[this.code] || 'Unknown error';
  }
}

/**
 * Error thrown when a requested tool is not found
 * Uses JSON-RPC error code -32601 (Method not found)
 *
 * @example
 * ```typescript
 * throw new ToolNotFoundError('tool_name');
 * ```
 */
export class ToolNotFoundError extends MCPError {
  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`, ErrorCode.METHOD_NOT_FOUND, { toolName });
  }
}

/**
 * Error thrown when invalid parameters are provided
 * Uses JSON-RPC error code -32602 (Invalid params)
 *
 * @example
 * ```typescript
 * throw new InvalidParametersError('Invalid format', ['param1', 'param2']);
 * ```
 */
export class InvalidParametersError extends MCPError {
  constructor(message: string, invalidParams?: string[]) {
    super(message, ErrorCode.INVALID_PARAMS, invalidParams ? { invalidParams } : undefined);
  }
}

/**
 * Error thrown during tool execution
 * Uses custom error code -32000
 *
 * @example
 * ```typescript
 * throw new ToolExecutionError('Database connection failed', 'db_query', originalError);
 * ```
 */
export class ToolExecutionError extends MCPError {
  constructor(message: string, toolName: string, originalError?: unknown) {
    const errorData: Record<string, unknown> = { toolName };

    if (originalError instanceof Error) {
      errorData.originalError = {
        name: originalError.name,
        message: originalError.message,
        ...(process.env.NODE_ENV === 'development' ? { stack: originalError.stack } : {}),
      };
    } else if (originalError !== undefined) {
      errorData.originalError = originalError;
    }

    super(message, ErrorCode.TOOL_EXECUTION_ERROR, errorData);
  }
}

/**
 * Error thrown for protocol violations
 * Uses JSON-RPC error code -32600 (Invalid Request)
 *
 * @example
 * ```typescript
 * throw new ProtocolError('Missing required field: id');
 * ```
 */
export class ProtocolError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.INVALID_REQUEST, details);
  }
}

/**
 * Error thrown for internal server errors
 * Uses JSON-RPC error code -32603 (Internal error)
 *
 * @example
 * ```typescript
 * throw new InternalError('Database connection failed');
 * ```
 */
export class InternalError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.INTERNAL_ERROR, details);
  }
}

/**
 * Error thrown when authentication fails
 * Uses custom error code -32001
 *
 * @example
 * ```typescript
 * throw new AuthenticationError('Invalid API key');
 * ```
 */
export class AuthenticationError extends MCPError {
  constructor(message: string = 'Authentication failed') {
    super(message, ErrorCode.AUTHENTICATION_ERROR);
  }
}

/**
 * Error thrown when rate limit is exceeded
 * Uses custom error code -32002
 *
 * @example
 * ```typescript
 * throw new RateLimitError(60, 100);
 * ```
 */
export class RateLimitError extends MCPError {
  constructor(retryAfterSeconds?: number, limit?: number) {
    const data: Record<string, unknown> = {};
    if (retryAfterSeconds !== undefined) {
      data.retryAfter = retryAfterSeconds;
    }
    if (limit !== undefined) {
      data.limit = limit;
    }

    super('Rate limit exceeded', ErrorCode.RATE_LIMIT_ERROR, data);
  }
}

/**
 * Error thrown when a resource is not found
 * Uses custom error code -32003
 *
 * @example
 * ```typescript
 * throw new ResourceNotFoundError('stamp', '1234');
 * ```
 */
export class ResourceNotFoundError extends MCPError {
  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} not found: ${resourceId}`, ErrorCode.RESOURCE_NOT_FOUND, {
      resourceType,
      resourceId,
    });
  }
}

/**
 * Error thrown for validation failures
 * Uses custom error code -32004
 *
 * @example
 * ```typescript
 * throw new ValidationError('Invalid input', { field: 'email', reason: 'Invalid format' });
 * ```
 */
export class ValidationError extends MCPError {
  constructor(message: string, validationErrors?: Record<string, unknown>) {
    super(message, ErrorCode.VALIDATION_ERROR, validationErrors);
  }
}

/**
 * Factory function to create a ToolNotFoundError
 * @param toolName - Name of the tool that was not found
 * @returns ToolNotFoundError instance
 */
export function toolNotFound(toolName: string): ToolNotFoundError {
  return new ToolNotFoundError(toolName);
}

/**
 * Factory function to create an InvalidParametersError
 * @param message - Error message
 * @param invalidParams - Optional array of invalid parameter names
 * @returns InvalidParametersError instance
 */
export function invalidParameters(
  message: string,
  invalidParams?: string[]
): InvalidParametersError {
  return new InvalidParametersError(message, invalidParams);
}

/**
 * Factory function to create a ToolExecutionError
 * @param message - Error message
 * @param toolName - Name of the tool that failed
 * @param originalError - Optional original error that caused the failure
 * @returns ToolExecutionError instance
 */
export function toolExecutionError(
  message: string,
  toolName: string,
  originalError?: unknown
): ToolExecutionError {
  return new ToolExecutionError(message, toolName, originalError);
}

/**
 * Factory function to create a ProtocolError
 * @param message - Error message
 * @param details - Optional additional details
 * @returns ProtocolError instance
 */
export function protocolError(message: string, details?: unknown): ProtocolError {
  return new ProtocolError(message, details);
}

/**
 * Factory function to create an InternalError
 * @param message - Error message
 * @param details - Optional additional details
 * @returns InternalError instance
 */
export function internalError(message: string, details?: unknown): InternalError {
  return new InternalError(message, details);
}

/**
 * Factory function to create an AuthenticationError
 * @param message - Optional error message
 * @returns AuthenticationError instance
 */
export function authenticationError(message?: string): AuthenticationError {
  return new AuthenticationError(message);
}

/**
 * Factory function to create a RateLimitError
 * @param retryAfterSeconds - Optional seconds to wait before retry
 * @param limit - Optional rate limit that was exceeded
 * @returns RateLimitError instance
 */
export function rateLimitError(retryAfterSeconds?: number, limit?: number): RateLimitError {
  return new RateLimitError(retryAfterSeconds, limit);
}

/**
 * Factory function to create a ResourceNotFoundError
 * @param resourceType - Type of resource (e.g., 'stamp', 'holder')
 * @param resourceId - ID of the resource that was not found
 * @returns ResourceNotFoundError instance
 */
export function resourceNotFound(resourceType: string, resourceId: string): ResourceNotFoundError {
  return new ResourceNotFoundError(resourceType, resourceId);
}

/**
 * Error thrown for network-related failures
 * Uses custom error code -32005
 *
 * @example
 * ```typescript
 * throw new NetworkError('Connection refused', 'ECONNREFUSED');
 * ```
 */
export class NetworkError extends MCPError {
  constructor(message: string, networkCode?: string, details?: unknown) {
    const errorData: Record<string, unknown> = {};
    if (networkCode) {
      errorData.networkCode = networkCode;
    }
    if (details) {
      errorData.details = details;
    }

    super(message, ErrorCode.NETWORK_ERROR, errorData);
  }
}

/**
 * Error thrown for timeout failures
 * Uses custom error code -32006
 *
 * @example
 * ```typescript
 * throw new TimeoutError(30000, '/api/stamps');
 * ```
 */
export class TimeoutError extends MCPError {
  constructor(timeoutMs: number, endpoint?: string) {
    const errorData: Record<string, unknown> = {
      timeoutMs,
    };
    if (endpoint) {
      errorData.endpoint = endpoint;
    }

    super(`Request timeout after ${timeoutMs}ms`, ErrorCode.TIMEOUT_ERROR, errorData);
  }
}

/**
 * Error thrown for Stampchain API-specific errors
 * Uses custom error code -32007
 *
 * @example
 * ```typescript
 * throw new StampchainAPIError('Invalid stamp ID', 400, '/stamps/abc');
 * ```
 */
export class StampchainAPIError extends MCPError {
  constructor(message: string, statusCode?: number, endpoint?: string, responseData?: unknown) {
    const errorData: Record<string, unknown> = {};
    if (statusCode !== undefined) {
      errorData.statusCode = statusCode;
    }
    if (endpoint) {
      errorData.endpoint = endpoint;
    }
    if (responseData) {
      errorData.responseData = responseData;
    }

    super(message, ErrorCode.STAMPCHAIN_API_ERROR, errorData);
  }
}

/**
 * Factory function to create a ValidationError
 * @param message - Error message
 * @param validationErrors - Optional validation error details
 * @returns ValidationError instance
 */
export function validationError(
  message: string,
  validationErrors?: Record<string, unknown>
): ValidationError {
  return new ValidationError(message, validationErrors);
}

/**
 * Factory function to create a NetworkError
 * @param message - Error message
 * @param networkCode - Optional network error code
 * @param details - Optional additional details
 * @returns NetworkError instance
 */
export function networkError(
  message: string,
  networkCode?: string,
  details?: unknown
): NetworkError {
  return new NetworkError(message, networkCode, details);
}

/**
 * Factory function to create a TimeoutError
 * @param timeoutMs - Timeout duration in milliseconds
 * @param endpoint - Optional endpoint that timed out
 * @returns TimeoutError instance
 */
export function timeoutError(timeoutMs: number, endpoint?: string): TimeoutError {
  return new TimeoutError(timeoutMs, endpoint);
}

/**
 * Factory function to create a StampchainAPIError
 * @param message - Error message
 * @param statusCode - Optional HTTP status code
 * @param endpoint - Optional API endpoint
 * @param responseData - Optional response data
 * @returns StampchainAPIError instance
 */
export function stampchainAPIError(
  message: string,
  statusCode?: number,
  endpoint?: string,
  responseData?: unknown
): StampchainAPIError {
  return new StampchainAPIError(message, statusCode, endpoint, responseData);
}

/**
 * Type guard to check if an error is an MCPError
 * @param error - Error to check
 * @returns True if the error is an MCPError
 */
export function isMCPError(error: unknown): error is MCPError {
  return error instanceof MCPError;
}

/**
 * Wraps an unknown error into an appropriate MCPError
 * @param error - Unknown error to wrap
 * @param defaultMessage - Default message if error cannot be parsed
 * @returns MCPError instance
 */
export function wrapError(
  error: unknown,
  defaultMessage: string = 'An unknown error occurred'
): MCPError {
  if (isMCPError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message, {
      originalError: error.name,
      ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
    });
  }

  return new InternalError(defaultMessage, { originalError: error });
}

/**
 * Creates a JSON-RPC 2.0 compliant error response
 * @param id - Request ID (null for notifications)
 * @param error - Error to convert to response
 * @returns JSON-RPC error response object
 */
export function createErrorResponse(
  id: string | number | null,
  error: unknown
): {
  jsonrpc: '2.0';
  id: string | number | null;
  error: JsonRpcError;
} {
  const mcpError = isMCPError(error) ? error : wrapError(error);

  return {
    jsonrpc: '2.0',
    id,
    error: mcpError.toJSON(),
  };
}
