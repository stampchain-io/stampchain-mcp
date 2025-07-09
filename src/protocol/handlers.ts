/**
 * MCP Protocol Handlers
 * Implements handlers for various MCP protocol requests
 */

import type {
  Result,
  CallToolRequest,
  ListToolsRequest,
  ListResourcesRequest,
  ReadResourceRequest,
  ListPromptsRequest,
  GetPromptRequest,
  CompleteRequest,
  SetLevelRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { ToolContext } from '../interfaces/tool.js';
import { createLogger, type Logger } from '../utils/logger.js';
import { ValidationError, ToolExecutionError } from '../utils/errors.js';
import type { ServerConfig } from '../config/index.js';
import type { StampchainClient } from '../api/stampchain-client.js';
import { MiddlewareManager, createDefaultMiddleware } from './middleware.js';

export interface ProtocolHandlerOptions {
  toolRegistry: ToolRegistry;
  apiClient: StampchainClient;
  config: ServerConfig;
  logger?: Logger;
  middleware?: MiddlewareManager;
}

/**
 * Protocol handler for MCP requests
 */
export class ProtocolHandlers {
  private toolRegistry: ToolRegistry;
  private apiClient: StampchainClient;
  private config: ServerConfig;
  private logger: Logger;
  private middleware: MiddlewareManager;

  constructor(options: ProtocolHandlerOptions) {
    this.toolRegistry = options.toolRegistry;
    this.apiClient = options.apiClient;
    this.config = options.config;
    this.logger =
      options.logger ||
      createLogger('protocol', {
        level: options.config.logging.level,
      });

    // Initialize middleware
    this.middleware = options.middleware || new MiddlewareManager(options.config);

    // Add default middleware if none provided
    if (!options.middleware) {
      const defaultMiddleware = createDefaultMiddleware(options.config);
      defaultMiddleware.forEach((mw) => this.middleware.use(mw));
    }
  }

  /**
   * Handle tool listing requests
   */
  handleListTools(_request: ListToolsRequest): Result {
    this.logger.debug('Handling list tools request');

    try {
      const tools = this.toolRegistry.getMCPTools();

      this.logger.info('Listed tools', {
        count: tools.length,
        categories: this.toolRegistry.getCategories(),
      });

      return { tools };
    } catch (error) {
      this.logger.error('Failed to list tools', { error });
      throw new McpError(ErrorCode.InternalError, 'Failed to list available tools');
    }
  }

  /**
   * Handle tool execution requests
   */
  async handleCallTool(request: CallToolRequest): Promise<Result> {
    const { name: toolName, arguments: args } = request.params;

    this.logger.debug('Handling tool call request', {
      tool: toolName,
      hasArgs: !!args,
    });

    try {
      // Get tool from registry (this will throw if tool doesn't exist or is disabled)
      const tool = this.toolRegistry.get(toolName);

      // Create execution context
      const context: ToolContext = {
        logger: createLogger(`tool:${toolName}`, {
          level: this.config.logging.level,
        }),
        apiClient: this.apiClient,
        config: this.config,
      };

      // Execute the tool
      const startTime = Date.now();
      const result = await tool.execute(args || {}, context);
      const duration = Date.now() - startTime;

      this.logger.info('Tool executed successfully', {
        tool: toolName,
        duration,
        contentItems: result.content.length,
      });

      return result as unknown as Result;
    } catch (error) {
      this.logger.error('Tool execution failed', {
        tool: toolName,
        error: error instanceof Error ? error.message : String(error),
        ...(this.config.development.enableStackTraces && error instanceof Error
          ? { stack: error.stack }
          : {}),
      });

      // Convert errors to appropriate MCP errors
      if (error instanceof McpError) {
        throw error;
      } else if (error instanceof ValidationError) {
        throw new McpError(ErrorCode.InvalidParams, `Validation Error: ${error.message}`);
      } else if (error instanceof ToolExecutionError) {
        throw new McpError(ErrorCode.InternalError, `Execution Error: ${error.message}`);
      } else if (error instanceof Error) {
        throw new McpError(ErrorCode.InternalError, error.message);
      } else {
        throw new McpError(ErrorCode.InternalError, 'An unknown error occurred');
      }
    }
  }

  /**
   * Handle resource listing requests (not implemented for this server)
   */
  handleListResources(_request: ListResourcesRequest): Result {
    this.logger.debug('Handling list resources request');

    // This server doesn't provide resources, only tools
    return { resources: [] };
  }

  /**
   * Handle resource reading requests (not implemented for this server)
   */
  handleReadResource(request: ReadResourceRequest): Result {
    this.logger.debug('Handling read resource request', {
      uri: request.params.uri,
    });

    throw new McpError(
      ErrorCode.MethodNotFound,
      'Resource reading is not supported by this server'
    );
  }

  /**
   * Handle prompt listing requests (not implemented for this server)
   */
  handleListPrompts(_request: ListPromptsRequest): Result {
    this.logger.debug('Handling list prompts request');

    // This server doesn't provide prompts, only tools
    return { prompts: [] };
  }

  /**
   * Handle prompt retrieval requests (not implemented for this server)
   */
  handleGetPrompt(request: GetPromptRequest): Result {
    this.logger.debug('Handling get prompt request', {
      name: request.params.name,
    });

    throw new McpError(
      ErrorCode.MethodNotFound,
      'Prompt retrieval is not supported by this server'
    );
  }

  /**
   * Handle completion requests (not implemented for this server)
   */
  handleComplete(_request: CompleteRequest): Result {
    this.logger.debug('Handling completion request');

    throw new McpError(ErrorCode.MethodNotFound, 'Completion is not supported by this server');
  }

  /**
   * Handle logging level changes
   */
  handleSetLevel(notification: SetLevelRequest): void {
    const { level } = notification.params;

    this.logger.info('Changing log level', {
      from: this.config.logging.level,
      to: level,
    });

    // Update logger level
    this.logger = createLogger('protocol', { level });

    // Note: In a full implementation, you'd update all loggers
    // This is a simplified version
  }

  /**
   * Get server capabilities
   */
  getCapabilities(): {
    tools: {
      listTools: boolean;
      callTool: boolean;
    };
    resources: {
      listResources: boolean;
      readResource: boolean;
    };
    prompts: {
      listPrompts: boolean;
      getPrompt: boolean;
    };
    completion: {
      complete: boolean;
    };
    logging: {
      setLevel: boolean;
    };
  } {
    return {
      tools: {
        listTools: true,
        callTool: true,
      },
      resources: {
        listResources: false,
        readResource: false,
      },
      prompts: {
        listPrompts: false,
        getPrompt: false,
      },
      completion: {
        complete: false,
      },
      logging: {
        setLevel: true,
      },
    };
  }

  /**
   * Get server information
   */
  getServerInfo(): {
    name: string;
    version: string;
    protocolVersion: string;
    capabilities: ReturnType<ProtocolHandlers['getCapabilities']>;
  } {
    return {
      name: this.config.name,
      version: this.config.version,
      protocolVersion: '1.0',
      capabilities: this.getCapabilities(),
    };
  }
}
