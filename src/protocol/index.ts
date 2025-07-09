/**
 * Protocol module exports
 * Re-exports all protocol-related functionality
 */

export { ProtocolHandlers } from './handlers.js';
export type { ProtocolHandlerOptions } from './handlers.js';

export { ProtocolManager } from './manager.js';
export type { ProtocolManagerOptions } from './manager.js';

export {
  MiddlewareManager,
  createLoggingMiddleware,
  createRateLimitMiddleware,
  createErrorHandlingMiddleware,
  createValidationMiddleware,
  createMetricsMiddleware,
  createDefaultMiddleware,
} from './middleware.js';
export type { Middleware, MiddlewareNext } from './middleware.js';

export { ConnectionHandler } from './connection.js';
export type { ConnectionInfo, ConnectionEvents, ConnectionHandlerOptions } from './connection.js';
