/**
 * Protocol Manager
 * Manages MCP protocol communication and request routing
 */

import { EventEmitter } from 'events';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CompleteRequestSchema,
  SetLevelRequestSchema,
  type RequestSchema,
  type NotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ProtocolHandlers } from './handlers.js';
import { ConnectionHandler } from './connection.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { StampchainClient } from '../api/stampchain-client.js';
import type { ServerConfig } from '../config/index.js';
import { createLogger, type Logger } from '../utils/logger.js';

export interface ProtocolManagerOptions {
  toolRegistry: ToolRegistry;
  apiClient: StampchainClient;
  config: ServerConfig;
  logger?: Logger;
}

/**
 * Manages the MCP protocol server and request handling
 */
export class ProtocolManager extends EventEmitter {
  private server: Server;
  private handlers: ProtocolHandlers;
  private connectionHandler: ConnectionHandler;
  private logger: Logger;
  private isConnected: boolean = false;
  private currentConnectionId?: string;

  constructor(options: ProtocolManagerOptions) {
    super();

    this.logger =
      options.logger ||
      createLogger('protocol-manager', {
        level: options.config.logging.level,
      });

    // Initialize connection handler
    this.connectionHandler = new ConnectionHandler({
      config: options.config,
      logger: this.logger,
    });

    // Initialize protocol handlers
    this.handlers = new ProtocolHandlers({
      toolRegistry: options.toolRegistry,
      apiClient: options.apiClient,
      config: options.config,
      logger: this.logger,
    });

    // Create MCP server
    const serverInfo = this.handlers.getServerInfo();
    this.server = new Server(
      {
        name: serverInfo.name,
        version: serverInfo.version,
      },
      {
        capabilities: serverInfo.capabilities,
      }
    );

    // Register all request handlers
    this.registerHandlers();

    // Setup connection handler events
    this.setupConnectionEvents();
  }

  /**
   * Setup handlers for the MCP server
   */
  async setupHandlers(server: Server): Promise<void> {
    this.server = server;
    this.registerHandlers();
  }

  /**
   * Register all protocol handlers
   */
  private registerHandlers(): void {
    this.logger.debug('Registering protocol handlers');

    // Wrap handlers to emit events
    const wrapHandler = (method: string, handler: Function) => {
      return async (...args: any[]) => {
        this.emit('request', method);
        try {
          const result = await handler(...args);
          this.emit('request-success', method);

          // Emit tool execution event for tool calls
          if (method === 'tools/call' && args[0]?.params?.name) {
            this.emit('tool-execution', args[0].params.name, true);
          }

          return result;
        } catch (error) {
          this.emit('request-error', method, error);

          // Emit tool execution event for failed tool calls
          if (method === 'tools/call' && args[0]?.params?.name) {
            this.emit('tool-execution', args[0].params.name, false);
          }

          throw error;
        }
      };
    };

    // Register request handlers
    const requestHandlers = [
      {
        schema: ListToolsRequestSchema,
        method: 'tools/list',
        handler: this.handlers.handleListTools.bind(this.handlers),
      },
      {
        schema: CallToolRequestSchema,
        method: 'tools/call',
        handler: this.handlers.handleCallTool.bind(this.handlers),
      },
      {
        schema: ListResourcesRequestSchema,
        method: 'resources/list',
        handler: this.handlers.handleListResources.bind(this.handlers),
      },
      {
        schema: ReadResourceRequestSchema,
        method: 'resources/read',
        handler: this.handlers.handleReadResource.bind(this.handlers),
      },
      {
        schema: ListPromptsRequestSchema,
        method: 'prompts/list',
        handler: this.handlers.handleListPrompts.bind(this.handlers),
      },
      {
        schema: GetPromptRequestSchema,
        method: 'prompts/get',
        handler: this.handlers.handleGetPrompt.bind(this.handlers),
      },
      {
        schema: CompleteRequestSchema,
        method: 'completion/complete',
        handler: this.handlers.handleComplete.bind(this.handlers),
      },
    ];

    for (const { schema, method, handler } of requestHandlers) {
      this.server.setRequestHandler(schema as any, wrapHandler(method, handler));
    }

    // Register notification handlers
    this.server.setNotificationHandler(
      SetLevelRequestSchema as any,
      wrapHandler('notifications/setLevel', this.handlers.handleSetLevel.bind(this.handlers))
    );

    this.logger.info('Protocol handlers registered', {
      requestHandlers: requestHandlers.length,
      notificationHandlers: 1,
    });
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionEvents(): void {
    this.connectionHandler.on('connect', (info) => {
      this.emit('connection', info.id);
    });

    this.connectionHandler.on('disconnect', (id) => {
      this.emit('disconnection', id);
    });

    this.connectionHandler.on('activity', (id) => {
      // Activity tracking
    });
  }

  /**
   * Connect the server to a transport
   */
  async connect(transport: StdioServerTransport): Promise<void> {
    if (this.isConnected) {
      throw new Error('Server is already connected');
    }

    this.logger.info('Connecting to transport');

    try {
      // Register connection
      this.currentConnectionId = await this.connectionHandler.registerConnection(transport);

      await this.server.connect(transport);
      this.isConnected = true;

      this.logger.info('Successfully connected to transport', {
        connectionId: this.currentConnectionId,
      });
    } catch (error) {
      this.logger.error('Failed to connect to transport', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Disconnect the server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    this.logger.info('Disconnecting from transport');

    try {
      // Unregister connection
      if (this.currentConnectionId) {
        this.connectionHandler.unregisterConnection(this.currentConnectionId);
      }

      await this.server.close();
      this.isConnected = false;

      this.logger.info('Successfully disconnected from transport');
    } catch (error) {
      this.logger.error('Error during disconnect', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Shutdown the protocol manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down protocol manager');

    // Disconnect if connected
    if (this.isConnected) {
      await this.disconnect();
    }

    // Shutdown connection handler
    await this.connectionHandler.shutdown();

    // Remove all listeners
    this.removeAllListeners();

    this.logger.info('Protocol manager shutdown complete');
  }

  /**
   * Get connection status
   */
  isServerConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get server instance (for advanced usage)
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Get protocol handlers (for testing)
   */
  getHandlers(): ProtocolHandlers {
    return this.handlers;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ServerConfig>): void {
    this.logger.info('Updating protocol configuration', {
      updates: Object.keys(config),
    });

    // Update handlers with new config
    // In a full implementation, this would recreate handlers with new config
    this.logger.warn('Configuration update not fully implemented');
  }

  /**
   * Get protocol statistics
   */
  getStats() {
    const connectionStats = this.connectionHandler.getStats();

    return {
      connected: this.isConnected,
      serverInfo: this.handlers.getServerInfo(),
      capabilities: this.handlers.getCapabilities(),
      totalConnections: connectionStats.totalConnections,
      activeConnections: connectionStats.activeConnections,
      totalRequests: connectionStats.totalRequests,
    };
  }
}
