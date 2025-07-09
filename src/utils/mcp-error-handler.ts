/**
 * MCP Error Handler - Standardized error handling patterns for MCP tools
 * Provides consistent error handling, logging, and response formatting
 */

import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse, ToolContext } from '../interfaces/tool.js';
import { textResponse } from '../interfaces/tool.js';
import {
  MCPError,
  ValidationError,
  ToolExecutionError,
  ResourceNotFoundError,
  NetworkError,
  TimeoutError,
  StampchainAPIError,
  wrapError,
} from './errors.js';
import {
  createMCPErrorContext,
  ErrorContextPatterns,
  logErrorContext,
  formatErrorWithContext,
  type StandardErrorContext,
} from './error-context.js';
import { createLogger } from './logger.js';

const logger = createLogger('MCPErrorHandler');

/**
 * Configuration for error handling behavior
 */
export interface ErrorHandlingConfig {
  /** Whether to include stack traces in development */
  includeStackTrace: boolean;
  /** Whether to log all errors automatically */
  autoLog: boolean;
  /** Maximum retry attempts for retryable errors */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  baseRetryDelay: number;
}

/**
 * Default error handling configuration
 */
const DEFAULT_CONFIG: ErrorHandlingConfig = {
  includeStackTrace: process.env.NODE_ENV === 'development',
  autoLog: true,
  maxRetries: 3,
  baseRetryDelay: 1000,
};

/**
 * Result of error handling operation
 */
export interface ErrorHandlingResult {
  /** Whether the error was handled successfully */
  handled: boolean;
  /** The error context that was created */
  context: StandardErrorContext;
  /** Whether the operation should be retried */
  shouldRetry: boolean;
  /** Delay before retry (if applicable) */
  retryDelay?: number;
  /** The tool response to return */
  response: ToolResponse;
}

/**
 * MCP Error Handler class providing standardized error handling
 */
export class MCPErrorHandler {
  private config: ErrorHandlingConfig;

  constructor(config?: Partial<ErrorHandlingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Handles errors with standardized context and response formatting
   */
  public handleError(
    error: unknown,
    toolName: string,
    operation: string,
    params?: Record<string, unknown>,
    toolContext?: ToolContext
  ): ErrorHandlingResult {
    // Create appropriate error context based on error type
    const context = this.createErrorContext(error, toolName, operation, params, toolContext);

    // Log the error if auto-logging is enabled
    if (this.config.autoLog && error instanceof Error) {
      logErrorContext(context, error);
    }

    // Convert to MCP error if needed
    const mcpError = this.convertToMCPError(error, context);

    // Create standardized response
    const response = this.createErrorResponse(mcpError, context);

    return {
      handled: true,
      context,
      shouldRetry: context.retryable,
      retryDelay: context.retryable ? this.calculateRetryDelay(1) : undefined,
      response,
    };
  }

  /**
   * Handles validation errors specifically
   */
  public handleValidationError(
    error: z.ZodError,
    toolName: string,
    params: Record<string, unknown>,
    toolContext?: ToolContext
  ): ErrorHandlingResult {
    const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    const context = ErrorContextPatterns.validation(toolName, issues)
      .withParameters(params)
      .build();

    const validationError = new ValidationError('Invalid parameters provided', { issues });

    if (this.config.autoLog) {
      logErrorContext(context, validationError);
    }

    return {
      handled: true,
      context,
      shouldRetry: false,
      response: this.createErrorResponse(validationError, context),
    };
  }

  /**
   * Handles API call errors with retry logic
   */
  public handleAPIError(
    error: unknown,
    toolName: string,
    endpoint: string,
    statusCode?: number,
    toolContext?: ToolContext
  ): ErrorHandlingResult {
    const context = ErrorContextPatterns.apiCall(toolName, endpoint, statusCode).build();

    let mcpError: MCPError;
    if (error instanceof Error) {
      mcpError = new StampchainAPIError(error.message, statusCode, endpoint);
    } else {
      mcpError = new StampchainAPIError('API call failed', statusCode, endpoint);
    }

    if (this.config.autoLog) {
      logErrorContext(context, mcpError);
    }

    return {
      handled: true,
      context,
      shouldRetry: context.retryable,
      retryDelay: context.retryable ? this.calculateRetryDelay(1) : undefined,
      response: this.createErrorResponse(mcpError, context),
    };
  }

  /**
   * Handles network errors with retry logic
   */
  public handleNetworkError(
    error: unknown,
    toolName: string,
    operation: string,
    toolContext?: ToolContext
  ): ErrorHandlingResult {
    const context = ErrorContextPatterns.network(toolName, operation).build();

    let networkError: NetworkError;
    if (error instanceof Error) {
      networkError = new NetworkError(error.message, 'NETWORK_ERROR');
    } else {
      networkError = new NetworkError('Network operation failed', 'UNKNOWN');
    }

    if (this.config.autoLog) {
      logErrorContext(context, networkError);
    }

    return {
      handled: true,
      context,
      shouldRetry: true,
      retryDelay: this.calculateRetryDelay(1),
      response: this.createErrorResponse(networkError, context),
    };
  }

  /**
   * Handles timeout errors
   */
  public handleTimeoutError(
    timeoutMs: number,
    toolName: string,
    operation: string,
    toolContext?: ToolContext
  ): ErrorHandlingResult {
    const context = ErrorContextPatterns.timeout(toolName, operation, timeoutMs).build();
    const timeoutError = new TimeoutError(timeoutMs, operation);

    if (this.config.autoLog) {
      logErrorContext(context, timeoutError);
    }

    return {
      handled: true,
      context,
      shouldRetry: true,
      retryDelay: this.calculateRetryDelay(1),
      response: this.createErrorResponse(timeoutError, context),
    };
  }

  /**
   * Handles resource not found errors
   */
  public handleNotFoundError(
    resourceType: string,
    resourceId: string,
    toolName: string,
    toolContext?: ToolContext
  ): ErrorHandlingResult {
    const context = ErrorContextPatterns.notFound(toolName, resourceType, resourceId).build();
    const notFoundError = new ResourceNotFoundError(resourceType, resourceId);

    if (this.config.autoLog) {
      logErrorContext(context, notFoundError);
    }

    return {
      handled: true,
      context,
      shouldRetry: false,
      response: this.createErrorResponse(notFoundError, context),
    };
  }

  /**
   * Creates error context based on error type
   */
  private createErrorContext(
    error: unknown,
    toolName: string,
    operation: string,
    params?: Record<string, unknown>,
    toolContext?: ToolContext
  ): StandardErrorContext {
    let builder = createMCPErrorContext(toolName, operation, toolContext);

    if (params) {
      builder = builder.withParameters(params);
    }

    // Determine severity and retryability based on error type
    if (error instanceof ValidationError) {
      builder = builder.withSeverity('low').asRetryable(false);
    } else if (error instanceof ResourceNotFoundError) {
      builder = builder.withSeverity('low').asRetryable(false);
    } else if (error instanceof NetworkError || error instanceof TimeoutError) {
      builder = builder.withSeverity('medium').asRetryable(true);
    } else if (error instanceof StampchainAPIError) {
      const statusCode =
        error.data && typeof error.data === 'object' && 'statusCode' in error.data
          ? (error.data.statusCode as number)
          : undefined;
      const isServerError = statusCode && statusCode >= 500;
      const isRateLimit = statusCode === 429;

      builder = builder
        .withSeverity(isServerError ? 'high' : 'medium')
        .asRetryable(isServerError || isRateLimit);
    } else {
      builder = builder.withSeverity('high').asRetryable(false);
    }

    return builder.build();
  }

  /**
   * Converts unknown error to MCP error
   */
  private convertToMCPError(error: unknown, context: StandardErrorContext): MCPError {
    if (error instanceof MCPError) {
      return error;
    }

    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      return new ValidationError('Invalid parameters provided', { issues });
    }

    if (error instanceof Error) {
      return new ToolExecutionError(
        formatErrorWithContext(error, context),
        context.toolName,
        error
      );
    }

    return wrapError(error, `Unknown error in ${context.toolName} during ${context.operation}`);
  }

  /**
   * Creates standardized error response
   */
  private createErrorResponse(error: MCPError, context: StandardErrorContext): ToolResponse {
    const message =
      this.config.includeStackTrace && error.stack
        ? `${error.message}\n\nStack trace:\n${error.stack}`
        : error.message;

    const errorInfo: Record<string, unknown> = {
      error: error.constructor.name,
      code: error.code,
      toolName: context.toolName,
      operation: context.operation,
      severity: context.severity,
      retryable: context.retryable,
      timestamp: context.timestamp,
    };

    if (error.data) {
      errorInfo.details = error.data;
    }

    return textResponse(
      `Error: ${message}\n\nError Information:\n${JSON.stringify(errorInfo, null, 2)}`
    );
  }

  /**
   * Converts internal MCPError to MCP protocol McpError
   * This ensures proper MCP protocol compliance
   */
  public convertToMcpError(error: MCPError, context: StandardErrorContext): McpError {
    // Map our internal error codes to MCP protocol error codes
    let mcpErrorCode: ErrorCode;

    switch (error.constructor.name) {
      case 'ValidationError':
        mcpErrorCode = ErrorCode.InvalidParams;
        break;
      case 'ResourceNotFoundError':
        mcpErrorCode = ErrorCode.InvalidParams; // Resource not found is typically a param issue
        break;
      case 'AuthenticationError':
        mcpErrorCode = ErrorCode.InvalidRequest; // Auth issues are request issues
        break;
      case 'RateLimitError':
        mcpErrorCode = ErrorCode.InternalError; // Rate limiting is server-side
        break;
      case 'NetworkError':
      case 'TimeoutError':
      case 'StampchainAPIError':
        mcpErrorCode = ErrorCode.InternalError; // External service issues
        break;
      case 'ToolExecutionError':
        mcpErrorCode = ErrorCode.InternalError;
        break;
      default:
        mcpErrorCode = ErrorCode.InternalError;
    }

    // Create detailed error message with context
    const detailedMessage =
      this.config.includeStackTrace && error.stack
        ? `${error.message}\n\nContext: ${context.toolName}/${context.operation}\nSeverity: ${context.severity}\nRetryable: ${context.retryable}\n\nStack trace:\n${error.stack}`
        : `${error.message}\n\nContext: ${context.toolName}/${context.operation}\nSeverity: ${context.severity}\nRetryable: ${context.retryable}`;

    return new McpError(mcpErrorCode, detailedMessage);
  }

  /**
   * Calculates retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    return this.config.baseRetryDelay * Math.pow(2, attempt - 1);
  }

  /**
   * Updates configuration
   */
  public updateConfig(config: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration
   */
  public getConfig(): ErrorHandlingConfig {
    return { ...this.config };
  }
}

/**
 * Default error handler instance
 */
export const defaultErrorHandler = new MCPErrorHandler();

/**
 * Convenience function for handling errors in MCP tools
 */
export function handleMCPError(
  error: unknown,
  toolName: string,
  operation: string,
  params?: Record<string, unknown>,
  toolContext?: ToolContext
): ErrorHandlingResult {
  return defaultErrorHandler.handleError(error, toolName, operation, params, toolContext);
}

/**
 * Convenience function for handling validation errors
 */
export function handleValidationError(
  error: z.ZodError,
  toolName: string,
  params: Record<string, unknown>,
  toolContext?: ToolContext
): ErrorHandlingResult {
  return defaultErrorHandler.handleValidationError(error, toolName, params, toolContext);
}

/**
 * Convenience function for handling API errors
 */
export function handleAPIError(
  error: unknown,
  toolName: string,
  endpoint: string,
  statusCode?: number,
  toolContext?: ToolContext
): ErrorHandlingResult {
  return defaultErrorHandler.handleAPIError(error, toolName, endpoint, statusCode, toolContext);
}

/**
 * Throws an MCP-compliant error for tool execution failures
 * This should be used in tool execute methods to ensure proper MCP protocol compliance
 */
export function throwMCPError(
  error: unknown,
  toolName: string,
  operation: string,
  params?: Record<string, unknown>,
  toolContext?: ToolContext
): never {
  const result = defaultErrorHandler.handleError(error, toolName, operation, params, toolContext);
  const mcpError = defaultErrorHandler.convertToMcpError(
    result.context.toolName === toolName
      ? error instanceof MCPError
        ? error
        : new ToolExecutionError('Tool execution failed', toolName, error)
      : new ToolExecutionError('Tool execution failed', toolName, error),
    result.context
  );
  throw mcpError;
}

/**
 * Throws an MCP-compliant validation error
 */
export function throwMCPValidationError(
  zodError: z.ZodError,
  toolName: string,
  params: Record<string, unknown>,
  toolContext?: ToolContext
): never {
  const result = defaultErrorHandler.handleValidationError(zodError, toolName, params, toolContext);
  const validationError = new ValidationError('Invalid parameters provided', {
    issues: zodError.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  });
  const mcpError = defaultErrorHandler.convertToMcpError(validationError, result.context);
  throw mcpError;
}

/**
 * Decorator for automatic error handling in MCP tool methods
 */
export function withErrorHandling(toolName: string, operation: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const params = args[0] || {};
        const toolContext = args[1] || undefined;

        // For decorators, we still return the response rather than throwing
        // This maintains compatibility with existing tool patterns
        const result = handleMCPError(error, toolName, operation, params, toolContext);
        return result.response;
      }
    };

    return descriptor;
  };
}
