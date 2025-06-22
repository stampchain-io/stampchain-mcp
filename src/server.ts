/**
 * Main MCP Server Class
 * Integrates all components and manages server lifecycle
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ProtocolManager } from './protocol/index.js';
import { ToolRegistry } from './tools/registry.js';
import { StampchainClient } from './api/stampchain-client.js';
import { createLogger, type Logger } from './utils/logger.js';
import type { ServerConfig } from './config/index.js';
import { EventEmitter } from 'events';

export interface StampchainServerOptions {
  config: ServerConfig;
  toolRegistry?: ToolRegistry;
  apiClient?: StampchainClient;
  logger?: Logger;
}

export interface ServerStats {
  uptime: number;
  startTime: Date;
  isRunning: boolean;
  connections: {
    total: number;
    active: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
  };
  tools: {
    total: number;
    categories: string[];
    executions: number;
  };
}

export interface ServerEvents {
  'start': () => void;
  'stop': () => void;
  'error': (error: Error) => void;
  'connection': (id: string) => void;
  'disconnection': (id: string) => void;
  'request': (method: string) => void;
  'tool-execution': (toolName: string, success: boolean) => void;
}

/**
 * Main Stampchain MCP Server
 * Orchestrates all server components and manages lifecycle
 */
export class StampchainServer extends EventEmitter {
  private config: ServerConfig;
  private logger: Logger;
  private toolRegistry: ToolRegistry;
  private apiClient: StampchainClient;
  private protocolManager: ProtocolManager;
  private server?: Server;
  private transport?: StdioServerTransport;
  private isRunning = false;
  private startTime?: Date;
  private stats = {
    requests: {
      total: 0,
      successful: 0,
      failed: 0,
    },
    tools: {
      executions: 0,
    },
  };

  constructor(options: StampchainServerOptions) {
    super();
    
    this.config = options.config;
    this.logger = options.logger || createLogger('server', {
      level: options.config.logging.level
    });
    
    // Initialize or use provided components
    this.toolRegistry = options.toolRegistry || new ToolRegistry(this.config.registry);
    this.apiClient = options.apiClient || new StampchainClient(this.config.api);
    
    // Create protocol manager
    this.protocolManager = new ProtocolManager({
      toolRegistry: this.toolRegistry,
      apiClient: this.apiClient,
      config: this.config,
    });
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Stampchain MCP server', {
      name: this.config.name,
      version: this.config.version,
    });

    try {
      // Validate configuration
      this.validateConfiguration();
      
      // Initialize MCP SDK server
      this.server = new Server(
        {
          name: this.config.name,
          version: this.config.version,
        },
        {
          capabilities: {
            tools: {},
            resources: {
              subscribe: false,
              list: false,
            },
            prompts: {
              list: false,
            },
            completion: {
              complete: false,
            },
          },
        }
      );
      
      // Setup protocol handlers using the protocol manager
      await this.protocolManager.setupHandlers(this.server);
      
      this.logger.info('Server initialized successfully', {
        tools: this.toolRegistry.getStats().totalTools,
        categories: this.toolRegistry.getCategories(),
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize server', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Start the server with the given transport
   */
  async start(transport: StdioServerTransport): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    if (!this.server) {
      throw new Error('Server not initialized. Call initialize() first');
    }

    this.logger.info('Starting server...');
    
    try {
      this.transport = transport;
      
      // Connect protocol manager to transport
      await this.protocolManager.connect(transport);
      
      this.isRunning = true;
      this.startTime = new Date();
      
      this.logger.info('Server started successfully', {
        transport: 'stdio',
        pid: process.pid,
      });
      
      this.emit('start');
      
    } catch (error) {
      this.isRunning = false;
      this.logger.error('Failed to start server', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Server is not running');
      return;
    }

    this.logger.info('Stopping server...');
    
    try {
      // Shutdown protocol manager
      await this.protocolManager.shutdown();
      
      // Close MCP server
      if (this.server) {
        await this.server.close();
      }
      
      this.isRunning = false;
      
      this.logger.info('Server stopped successfully', {
        uptime: this.getUptime(),
        totalRequests: this.stats.requests.total,
      });
      
      this.emit('stop');
      
    } catch (error) {
      this.logger.error('Error during server shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Restart the server
   */
  async restart(): Promise<void> {
    this.logger.info('Restarting server...');
    
    if (this.isRunning && this.transport) {
      await this.stop();
    }
    
    if (this.transport) {
      await this.start(this.transport);
    } else {
      throw new Error('No transport available for restart');
    }
  }

  /**
   * Get server statistics
   */
  getStats(): ServerStats {
    const protocolStats = this.protocolManager.getStats();
    
    return {
      uptime: this.getUptime(),
      startTime: this.startTime || new Date(),
      isRunning: this.isRunning,
      connections: {
        total: protocolStats.totalConnections,
        active: protocolStats.activeConnections,
      },
      requests: {
        total: this.stats.requests.total,
        successful: this.stats.requests.successful,
        failed: this.stats.requests.failed,
      },
      tools: {
        total: this.toolRegistry.getStats().totalTools,
        categories: this.toolRegistry.getCategories(),
        executions: this.stats.tools.executions,
      },
    };
  }

  /**
   * Get server uptime in milliseconds
   */
  getUptime(): number {
    if (!this.startTime) {
      return 0;
    }
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Check if server is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get tool registry
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Get API client
   */
  getApiClient(): StampchainClient {
    return this.apiClient;
  }

  /**
   * Get server configuration
   */
  getConfig(): ServerConfig {
    return this.config;
  }

  /**
   * Validate server configuration
   */
  private validateConfiguration(): void {
    if (!this.config.name) {
      throw new Error('Server name is required');
    }
    
    if (!this.config.version) {
      throw new Error('Server version is required');
    }
    
    if (!this.config.api.baseUrl) {
      throw new Error('API base URL is required');
    }
    
    // Validate tool registry has tools
    const stats = this.toolRegistry.getStats();
    if (stats.totalTools === 0) {
      this.logger.warn('No tools registered in the tool registry');
    }
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers(): void {
    // Listen to protocol manager events
    this.protocolManager.on('connection', (connectionId) => {
      this.emit('connection', connectionId);
    });
    
    this.protocolManager.on('disconnection', (connectionId) => {
      this.emit('disconnection', connectionId);
    });
    
    this.protocolManager.on('request', (method) => {
      this.stats.requests.total++;
      this.emit('request', method);
    });
    
    this.protocolManager.on('request-success', () => {
      this.stats.requests.successful++;
    });
    
    this.protocolManager.on('request-error', () => {
      this.stats.requests.failed++;
    });
    
    this.protocolManager.on('tool-execution', (toolName, success) => {
      if (success) {
        this.stats.tools.executions++;
      }
      this.emit('tool-execution', toolName, success);
    });
  }

  /**
   * Type-safe event emitter methods
   */
  on<K extends keyof ServerEvents>(
    event: K,
    listener: ServerEvents[K]
  ): this {
    return super.on(event, listener);
  }

  emit<K extends keyof ServerEvents>(
    event: K,
    ...args: Parameters<ServerEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}