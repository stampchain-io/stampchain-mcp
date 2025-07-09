/**
 * Connection Handler
 * Manages client connections and session state
 */

import { EventEmitter } from 'events';
import type { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLogger, type Logger } from '../utils/logger.js';
import type { ServerConfig } from '../config/index.js';

export interface ConnectionInfo {
  id: string;
  connectedAt: Date;
  lastActivity: Date;
  requestCount: number;
  transport: 'stdio' | 'websocket' | 'http';
}

export interface ConnectionEvents {
  connect: (info: ConnectionInfo) => void;
  disconnect: (id: string) => void;
  error: (id: string, error: Error) => void;
  activity: (id: string) => void;
}

export interface ConnectionHandlerOptions {
  config: ServerConfig;
  logger?: Logger;
  maxConnections?: number;
  sessionTimeout?: number;
}

/**
 * Manages client connections and sessions
 */
export class ConnectionHandler extends EventEmitter {
  private connections: Map<string, ConnectionInfo> = new Map();
  private logger: Logger;
  private config: ServerConfig;
  private maxConnections: number;
  private sessionTimeout: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: ConnectionHandlerOptions) {
    super();

    this.config = options.config;
    this.logger =
      options.logger ||
      createLogger('connection', {
        level: options.config.logging.level,
      });
    this.maxConnections = options.maxConnections || 100;
    this.sessionTimeout = options.sessionTimeout || 3600000; // 1 hour default

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Register a new connection
   */
  async registerConnection(transport: StdioServerTransport): Promise<string> {
    // Check connection limit
    if (this.connections.size >= this.maxConnections) {
      throw new Error(`Maximum connections (${this.maxConnections}) reached`);
    }

    // Generate unique connection ID
    const id = this.generateConnectionId();

    // Create connection info
    const info: ConnectionInfo = {
      id,
      connectedAt: new Date(),
      lastActivity: new Date(),
      requestCount: 0,
      transport: 'stdio', // For now, we only support stdio
    };

    // Store connection
    this.connections.set(id, info);

    this.logger.info('New connection registered', {
      id,
      totalConnections: this.connections.size,
    });

    // Emit connect event
    this.emit('connect', info);

    return id;
  }

  /**
   * Unregister a connection
   */
  unregisterConnection(id: string): void {
    const connection = this.connections.get(id);

    if (!connection) {
      this.logger.warn('Attempted to unregister unknown connection', { id });
      return;
    }

    this.connections.delete(id);

    this.logger.info('Connection unregistered', {
      id,
      duration: Date.now() - connection.connectedAt.getTime(),
      requests: connection.requestCount,
      totalConnections: this.connections.size,
    });

    // Emit disconnect event
    this.emit('disconnect', id);
  }

  /**
   * Update connection activity
   */
  updateActivity(id: string): void {
    const connection = this.connections.get(id);

    if (!connection) {
      this.logger.warn('Activity update for unknown connection', { id });
      return;
    }

    connection.lastActivity = new Date();
    connection.requestCount++;

    // Emit activity event
    this.emit('activity', id);
  }

  /**
   * Get connection info
   */
  getConnection(id: string): ConnectionInfo | undefined {
    return this.connections.get(id);
  }

  /**
   * Get all connections
   */
  getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const connections = this.getAllConnections();
    const now = Date.now();

    return {
      totalConnections: connections.length,
      activeConnections: connections.filter(
        (c) => now - c.lastActivity.getTime() < 60000 // Active in last minute
      ).length,
      totalRequests: connections.reduce((sum, c) => sum + c.requestCount, 0),
      averageRequestsPerConnection:
        connections.length > 0
          ? connections.reduce((sum, c) => sum + c.requestCount, 0) / connections.length
          : 0,
      oldestConnection: connections.reduce(
        (oldest, c) => (!oldest || c.connectedAt < oldest.connectedAt ? c : oldest),
        null as ConnectionInfo | null
      ),
    };
  }

  /**
   * Clean up inactive connections
   */
  private cleanupInactiveConnections(): void {
    const now = Date.now();
    const timeout = this.sessionTimeout;

    for (const [id, connection] of this.connections) {
      const inactiveTime = now - connection.lastActivity.getTime();

      if (inactiveTime > timeout) {
        this.logger.info('Cleaning up inactive connection', {
          id,
          inactiveTime,
          timeout,
        });

        this.unregisterConnection(id);
      }
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveConnections();
    }, 300000);
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Shutdown connection handler
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down connection handler');

    // Stop cleanup interval
    this.stopCleanupInterval();

    // Disconnect all connections
    const connectionIds = Array.from(this.connections.keys());
    for (const id of connectionIds) {
      this.unregisterConnection(id);
    }

    // Remove all listeners
    this.removeAllListeners();

    this.logger.info('Connection handler shutdown complete');
  }

  /**
   * Type-safe event emitter methods
   */
  on<K extends keyof ConnectionEvents>(event: K, listener: ConnectionEvents[K]): this {
    return super.on(event, listener);
  }

  emit<K extends keyof ConnectionEvents>(
    event: K,
    ...args: Parameters<ConnectionEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
