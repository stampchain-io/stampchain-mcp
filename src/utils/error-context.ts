/**
 * Standardized error context patterns for MCP tools
 * Provides consistent error context structure across all tools
 */

import { createLogger } from './logger.js';
import type { ToolContext } from '../interfaces/tool.js';

const logger = createLogger('ErrorContext');

/**
 * Standard error context interface
 */
export interface StandardErrorContext {
  /** Tool name that generated the error */
  toolName: string;
  /** Request ID for tracing (if available) */
  requestId?: string;
  /** Operation being performed when error occurred */
  operation: string;
  /** Input parameters that caused the error (sanitized) */
  parameters?: Record<string, unknown>;
  /** Additional context data */
  contextData?: Record<string, unknown>;
  /** Error timestamp */
  timestamp: string;
  /** Error severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Whether this error should be retried */
  retryable: boolean;
}

/**
 * Error context builder for creating standardized error contexts
 */
export class ErrorContextBuilder {
  private context: Partial<StandardErrorContext> = {};

  constructor(toolName: string, operation: string) {
    this.context = {
      toolName,
      operation,
      timestamp: new Date().toISOString(),
      severity: 'medium',
      retryable: false,
    };
  }

  /**
   * Sets the request ID for tracing
   */
  public withRequestId(requestId: string): this {
    this.context.requestId = requestId;
    return this;
  }

  /**
   * Sets the input parameters (will be sanitized)
   */
  public withParameters(parameters: Record<string, unknown>): this {
    this.context.parameters = this.sanitizeParameters(parameters);
    return this;
  }

  /**
   * Sets additional context data
   */
  public withContextData(data: Record<string, unknown>): this {
    this.context.contextData = data;
    return this;
  }

  /**
   * Sets the error severity
   */
  public withSeverity(severity: StandardErrorContext['severity']): this {
    this.context.severity = severity;
    return this;
  }

  /**
   * Marks the error as retryable
   */
  public asRetryable(retryable: boolean = true): this {
    this.context.retryable = retryable;
    return this;
  }

  /**
   * Builds the final error context
   */
  public build(): StandardErrorContext {
    return this.context as StandardErrorContext;
  }

  /**
   * Sanitizes parameters to remove sensitive data
   */
  private sanitizeParameters(params: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential', 'api_key'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      const keyLower = key.toLowerCase();
      if (sensitiveKeys.some((sensitive) => keyLower.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = '[OBJECT]'; // Avoid deep serialization in error context
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * Creates a standardized error context
 */
export function createErrorContext(toolName: string, operation: string): ErrorContextBuilder {
  return new ErrorContextBuilder(toolName, operation);
}

/**
 * Enhanced error context that includes MCP tool context
 */
export interface MCPErrorContext extends StandardErrorContext {
  /** MCP tool context if available */
  mcpContext?: {
    hasLogger: boolean;
    logLevel?: string;
    requestMetadata?: Record<string, unknown>;
  };
}

/**
 * Creates error context with MCP tool context information
 */
export function createMCPErrorContext(
  toolName: string,
  operation: string,
  toolContext?: ToolContext
): ErrorContextBuilder & { withMCPContext: () => ErrorContextBuilder } {
  const builder = new ErrorContextBuilder(toolName, operation);

  // Add MCP context if available
  if (toolContext) {
    const mcpContext: MCPErrorContext['mcpContext'] = {
      hasLogger: !!toolContext.logger,
      logLevel: toolContext.logger ? 'available' : 'unavailable',
    };

    builder.withContextData({ mcpContext });
  }

  return Object.assign(builder, {
    withMCPContext: () => builder,
  });
}

/**
 * Standard error context patterns for common scenarios
 */
export const ErrorContextPatterns = {
  /**
   * Pattern for validation errors
   */
  validation: (toolName: string, invalidParams: string[]) =>
    createErrorContext(toolName, 'parameter_validation')
      .withSeverity('low')
      .withContextData({ invalidParams })
      .asRetryable(false),

  /**
   * Pattern for API call errors
   */
  apiCall: (toolName: string, endpoint: string, statusCode?: number) =>
    createErrorContext(toolName, 'api_call')
      .withSeverity(statusCode && statusCode >= 500 ? 'high' : 'medium')
      .withContextData({ endpoint, statusCode })
      .asRetryable(statusCode ? statusCode >= 500 || statusCode === 429 : true),

  /**
   * Pattern for network errors
   */
  network: (toolName: string, operation: string) =>
    createErrorContext(toolName, operation).withSeverity('high').asRetryable(true),

  /**
   * Pattern for internal processing errors
   */
  internal: (toolName: string, operation: string) =>
    createErrorContext(toolName, operation).withSeverity('critical').asRetryable(false),

  /**
   * Pattern for resource not found errors
   */
  notFound: (toolName: string, resourceType: string, resourceId: string) =>
    createErrorContext(toolName, 'resource_lookup')
      .withSeverity('low')
      .withContextData({ resourceType, resourceId })
      .asRetryable(false),

  /**
   * Pattern for timeout errors
   */
  timeout: (toolName: string, operation: string, timeoutMs: number) =>
    createErrorContext(toolName, operation)
      .withSeverity('medium')
      .withContextData({ timeoutMs })
      .asRetryable(true),
};

/**
 * Logs error context in a standardized format
 */
export function logErrorContext(context: StandardErrorContext, error: Error): void {
  logger.error(`${context.toolName} error in ${context.operation}`, {
    errorContext: context,
    errorMessage: error.message,
    errorName: error.constructor.name,
    ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
  });
}

/**
 * Creates a standardized error message with context
 */
export function formatErrorWithContext(error: Error, context: StandardErrorContext): string {
  const baseMessage = `${context.toolName} failed during ${context.operation}: ${error.message}`;

  if (context.retryable) {
    return `${baseMessage} (retryable)`;
  }

  return baseMessage;
}
