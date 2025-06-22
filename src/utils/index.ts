/**
 * Utility modules for the Stampchain MCP Server
 */

// Export all logger functionality
export { logger, createLogger, Logger, LogLevel } from './logger.js';
export type { LoggerConfig, LogMetadata } from './logger.js';

// Export all error handling functionality
export {
  // Error classes
  MCPError,
  ToolNotFoundError,
  InvalidParametersError,
  ToolExecutionError,
  ProtocolError,
  InternalError,
  AuthenticationError,
  RateLimitError,
  ResourceNotFoundError,
  ValidationError,

  // Error codes
  ErrorCode,

  // Factory functions
  toolNotFound,
  invalidParameters,
  toolExecutionError,
  protocolError,
  internalError,
  authenticationError,
  rateLimitError,
  resourceNotFound,
  validationError,

  // Utility functions
  isMCPError,
  wrapError,
  createErrorResponse,
} from './errors.js';

export type { JsonRpcError } from './errors.js';

// Export formatter utilities
export * from './formatters.js';

// Export validator utilities
export * from './validators.js';

// Export transformer utilities
export * from './transformers.js';
