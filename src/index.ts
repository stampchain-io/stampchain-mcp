import { Command } from 'commander';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLogger } from './utils/index.js';
import { createAllTools, toolMetadata } from './tools/index.js';
import { StampchainClient } from './api/stampchain-client.js';
import { ToolRegistry } from './tools/registry.js';
import { StampchainServer } from './server.js';
import { loadConfiguration, type ServerConfig } from './config/index.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Package information
const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

let logger = createLogger('main');
let config: ServerConfig;
let server: StampchainServer;

/**
 * Initialize the server with configuration
 */
async function initializeServer(config: ServerConfig): Promise<void> {
  logger = createLogger('main', { level: config.logging.level });
  logger.info('Initializing Stampchain MCP server...', {
    version: config.version,
    config: {
      logLevel: config.logging.level,
      apiUrl: config.api.baseUrl,
      maxTools: config.registry.maxTools,
    },
  });

  // Initialize tool registry with configuration
  const toolRegistry = new ToolRegistry({
    validateOnRegister: config.registry.validateOnRegister,
    allowDuplicateNames: config.registry.allowDuplicateNames,
    maxTools: config.registry.maxTools,
  });

  // Initialize API client with configuration
  const apiClient = new StampchainClient({
    baseURL: config.api.baseUrl,
    timeout: config.api.timeout,
    retries: config.api.retries,
    retryDelay: config.api.retryDelay,
  });

  // Create and register all tools
  const tools = createAllTools(apiClient);

  // Register tools with categories
  for (const [category, metadata] of Object.entries(toolMetadata)) {
    for (const toolName of metadata.tools) {
      const tool = tools[toolName];
      if (tool) {
        toolRegistry.register(tool, {
          category: metadata.category,
          version: '1.0.0',
        });
      }
    }
  }

  logger.info('Tools registered', toolRegistry.getStats());

  // Create the main server instance
  server = new StampchainServer({
    config,
    toolRegistry,
    apiClient,
    logger,
  });

  // Initialize the server
  await server.initialize();

  // Setup server event handlers
  server.on('error', (error) => {
    logger.error('Server error', { error: error.message });
  });

  server.on('connection', (id) => {
    logger.info('New client connection', { connectionId: id });
  });

  server.on('disconnection', (id) => {
    logger.info('Client disconnected', { connectionId: id });
  });

  server.on('tool-execution', (toolName, success) => {
    logger.debug('Tool executed', { tool: toolName, success });
  });
}

/**
 * Start the MCP server
 */
async function startServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.start(transport);

  const stats = server.getStats();
  logger.info('Stampchain MCP server running', {
    uptime: stats.uptime,
    tools: stats.tools,
    connections: stats.connections,
  });
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(): Promise<void> {
  logger.info('Shutting down server...');
  
  try {
    if (server && server.getIsRunning()) {
      await server.stop();
    }
    logger.info('Server shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: String(error) });
    process.exit(1);
  }
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers(): void {
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: String(reason) });
    process.exit(1);
  });
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    setupSignalHandlers();
    
    await initializeServer(config);
    await startServer();
  } catch (error) {
    logger.error('Failed to start server', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

/**
 * CLI Program setup
 */
const program = new Command();

program
  .name('stampchain-mcp')
  .description('Stampchain MCP Server - Bitcoin Stamps and SRC-20 token tools for Claude Desktop')
  .version(packageJson.version);

program
  .option('-c, --config <file>', 'Configuration file path')
  .option('-l, --log-level <level>', 'Log level (debug, info, warn, error)', 'info')
  .option('--api-url <url>', 'Stampchain API base URL')
  .option('-d, --debug', 'Enable debug mode')
  .option('--export-config', 'Export current configuration and exit')
  .action(async (options) => {
    try {
      // Load configuration from all sources
      config = loadConfiguration({
        configFile: options.config,
        cliArgs: options,
      });

      // Handle export config option
      if (options.exportConfig) {
        console.log(JSON.stringify(config, null, 2));
        process.exit(0);
      }

      // Start the server
      await main();
    } catch (error) {
      console.error('Configuration error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Add version command
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(`Stampchain MCP Server v${packageJson.version}`);
    console.log(`Node.js ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
  });

// Add tools command
program
  .command('tools')
  .description('List available tools')
  .option('-c, --config <file>', 'Configuration file path')
  .action(async (options) => {
    try {
      config = loadConfiguration({ configFile: options.config });
      const toolRegistry = new ToolRegistry(config.registry);
      
      const apiClient = new StampchainClient(config.api);
      const tools = createAllTools(apiClient);
      
      // Register tools
      for (const [category, metadata] of Object.entries(toolMetadata)) {
        for (const toolName of metadata.tools) {
          const tool = tools[toolName];
          if (tool) {
            toolRegistry.register(tool, { category: metadata.category });
          }
        }
      }
      
      console.log('\nAvailable Tools:');
      console.log('================');
      
      for (const category of toolRegistry.getCategories()) {
        console.log(`\n${category}:`);
        const categoryTools = toolRegistry.getByCategory(category);
        for (const toolName of categoryTools) {
          const tool = toolRegistry.get(toolName);
          console.log(`  ${tool.name} - ${tool.description}`);
        }
      }
      
      console.log(`\nTotal: ${toolRegistry.getStats().totalTools} tools`);
    } catch (error) {
      console.error('Error listing tools:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Parse CLI arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

// Export for programmatic usage
export { StampchainServer } from './server.js';
export type { StampchainServerOptions, ServerStats, ServerEvents } from './server.js';
