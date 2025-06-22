/**
 * Protocol Middleware
 * Provides middleware functionality for request/response processing
 */

import type { Request, Result } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { createLogger, type Logger } from '../utils/logger.js';
import type { ServerConfig } from '../config/index.js';

export type MiddlewareNext = () => Promise<Result>;
export type Middleware = (request: Request, next: MiddlewareNext) => Promise<Result>;

/**
 * Middleware manager for protocol handlers
 */
export class MiddlewareManager {
  private middlewares: Middleware[] = [];
  private logger: Logger;

  constructor(config: ServerConfig) {
    this.logger = createLogger('middleware', { level: config.logging.level });
  }

  /**
   * Add middleware to the stack
   */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
    this.logger.debug('Added middleware', { 
      total: this.middlewares.length 
    });
  }

  /**
   * Execute middleware stack
   */
  async execute(request: Request, handler: () => Promise<Result>): Promise<Result> {
    let index = 0;

    const next: MiddlewareNext = async () => {
      if (index >= this.middlewares.length) {
        return handler();
      }

      const middleware = this.middlewares[index++];
      return middleware(request, next);
    };

    return next();
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.middlewares = [];
    this.logger.debug('Cleared all middleware');
  }
}

/**
 * Logging middleware factory
 */
export function createLoggingMiddleware(logger: Logger): Middleware {
  return async (request: Request, next: MiddlewareNext): Promise<Result> => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    logger.debug('Request received', {
      id: requestId,
      method: request.method,
      params: request.params,
    });

    try {
      const result = await next();
      const duration = Date.now() - startTime;

      logger.info('Request completed', {
        id: requestId,
        method: request.method,
        duration,
        success: true,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Request failed', {
        id: requestId,
        method: request.method,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  };
}

/**
 * Rate limiting middleware factory
 */
export function createRateLimitMiddleware(
  maxRequests: number = 100,
  windowMs: number = 60000
): Middleware {
  const requests = new Map<string, number[]>();

  return async (request: Request, next: MiddlewareNext): Promise<Result> => {
    // Simple rate limiting based on method
    const key = request.method;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create request timestamps for this key
    let timestamps = requests.get(key) || [];
    
    // Remove old timestamps outside the window
    timestamps = timestamps.filter(t => t > windowStart);
    
    // Check if limit exceeded
    if (timestamps.length >= maxRequests) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs/1000} seconds.`
      );
    }

    // Add current timestamp
    timestamps.push(now);
    requests.set(key, timestamps);

    // Continue to next middleware
    return next();
  };
}

/**
 * Error handling middleware factory
 */
export function createErrorHandlingMiddleware(
  config: ServerConfig
): Middleware {
  const logger = createLogger('error-handler', { level: config.logging.level });

  return async (request: Request, next: MiddlewareNext): Promise<Result> => {
    try {
      return await next();
    } catch (error) {
      // Log the error
      logger.error('Unhandled error in request processing', {
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
        ...(config.development.enableStackTraces && error instanceof Error 
          ? { stack: error.stack } 
          : {}
        ),
      });

      // Convert to MCP error if not already
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    }
  };
}

/**
 * Validation middleware factory
 */
export function createValidationMiddleware(): Middleware {
  return async (request: Request, next: MiddlewareNext): Promise<Result> => {
    // Basic request validation
    if (!request.method || typeof request.method !== 'string') {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Invalid request: method is required'
      );
    }

    // Method-specific validation
    if (request.method === 'tools/call' && !request.params?.name) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Tool name is required for tools/call'
      );
    }

    return next();
  };
}

/**
 * Metrics middleware factory
 */
export function createMetricsMiddleware(): Middleware {
  const metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    requestsByMethod: new Map<string, number>(),
    averageResponseTime: 0,
    responseTimes: [] as number[],
  };

  return async (request: Request, next: MiddlewareNext): Promise<Result> => {
    const startTime = Date.now();
    metrics.totalRequests++;

    // Track requests by method
    const methodCount = metrics.requestsByMethod.get(request.method) || 0;
    metrics.requestsByMethod.set(request.method, methodCount + 1);

    try {
      const result = await next();
      const duration = Date.now() - startTime;

      metrics.successfulRequests++;
      metrics.responseTimes.push(duration);
      
      // Keep only last 100 response times
      if (metrics.responseTimes.length > 100) {
        metrics.responseTimes.shift();
      }

      // Calculate average
      metrics.averageResponseTime = 
        metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;

      return result;
    } catch (error) {
      metrics.failedRequests++;
      throw error;
    }
  };
}

/**
 * Create default middleware stack
 */
export function createDefaultMiddleware(config: ServerConfig): Middleware[] {
  const logger = createLogger('protocol', { level: config.logging.level });

  return [
    createValidationMiddleware(),
    createLoggingMiddleware(logger),
    createRateLimitMiddleware(
      config.performance.maxConcurrentRequests * 10, // Allow 10x concurrent as total
      60000 // 1 minute window
    ),
    createErrorHandlingMiddleware(config),
    createMetricsMiddleware(),
  ];
}