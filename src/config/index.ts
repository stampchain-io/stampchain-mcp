/**
 * Configuration management for Stampchain MCP Server
 * Handles environment variables, config files, and CLI arguments
 */

import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Server configuration schema
 */
export const ServerConfigSchema = z.object({
  // Server settings
  name: z.string().default('stampchain-mcp'),
  version: z.string().default('0.1.0'),

  // Logging configuration
  logging: z
    .object({
      level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
      enableTimestamps: z.boolean().default(true),
      enableColors: z.boolean().default(true),
    })
    .default({}),

  // API configuration
  api: z
    .object({
      baseUrl: z.string().url().default('https://stampchain.io/api'),
      timeout: z.number().positive().default(30000),
      retries: z.number().min(0).max(10).default(3),
      retryDelay: z.number().positive().default(1000),
    })
    .default({}),

  // Tool registry configuration
  registry: z
    .object({
      maxTools: z.number().positive().default(1000),
      validateOnRegister: z.boolean().default(true),
      allowDuplicateNames: z.boolean().default(false),
    })
    .default({}),

  // Performance settings
  performance: z
    .object({
      requestTimeout: z.number().positive().default(120000), // 2 minutes
      maxConcurrentRequests: z.number().positive().default(10),
    })
    .default({}),

  // Development settings
  development: z
    .object({
      enableDebugLogs: z.boolean().default(false),
      enableStackTraces: z.boolean().default(false),
    })
    .default({}),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

/**
 * Environment variable mappings
 */
const ENV_MAPPINGS = {
  STAMPCHAIN_LOG_LEVEL: 'logging.level',
  STAMPCHAIN_ENABLE_COLORS: 'logging.enableColors',
  STAMPCHAIN_API_URL: 'api.baseUrl',
  STAMPCHAIN_API_TIMEOUT: 'api.timeout',
  STAMPCHAIN_API_RETRIES: 'api.retries',
  STAMPCHAIN_MAX_TOOLS: 'registry.maxTools',
  STAMPCHAIN_VALIDATE_ON_REGISTER: 'registry.validateOnRegister',
  STAMPCHAIN_REQUEST_TIMEOUT: 'performance.requestTimeout',
  NODE_ENV: (value: string) => ({
    'development.enableDebugLogs': value === 'development',
    'development.enableStackTraces': value === 'development',
  }),
} as const;

/**
 * Load configuration from various sources
 */
export class ConfigLoader {
  private config: ServerConfig;

  constructor() {
    this.config = this.loadDefaultConfig();
  }

  /**
   * Load default configuration
   */
  private loadDefaultConfig(): ServerConfig {
    return ServerConfigSchema.parse({});
  }

  /**
   * Load configuration from file
   */
  public loadFromFile(filePath: string): this {
    if (!existsSync(filePath)) {
      return this;
    }

    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      let fileConfig: any;

      if (filePath.endsWith('.json')) {
        try {
          fileConfig = JSON.parse(fileContent);
        } catch (e) {
          throw new Error('Failed to parse configuration file');
        }
      } else {
        throw new Error('Only JSON configuration files are supported');
      }

      try {
        this.config = ServerConfigSchema.parse({
          ...this.config,
          ...fileConfig,
        });
      } catch (e) {
        throw new Error('Configuration validation failed');
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'Failed to parse configuration file' ||
          error.message === 'Configuration validation failed')
      ) {
        throw error;
      }
      throw new Error(
        `Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return this;
  }

  /**
   * Load configuration from environment variables
   */
  public loadFromEnv(): this {
    for (const [envVar, configPath] of Object.entries(ENV_MAPPINGS)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        try {
          const tempConfig: any = {};

          if (typeof configPath === 'function') {
            Object.assign(tempConfig, configPath(value));
          } else {
            this.setNestedValue(tempConfig, configPath, this.parseEnvValue(value));
          }

          // Try to merge and validate
          const mergedConfig = deepMerge(this.config, tempConfig);
          const testConfig = ServerConfigSchema.parse(mergedConfig);

          // If validation passes, update the config
          this.config = testConfig;
        } catch {
          // Skip invalid values - they'll fall back to defaults
        }
      }
    }

    return this;
  }

  /**
   * Override configuration with CLI arguments
   */
  public loadFromCLI(args: {
    logLevel?: string;
    apiUrl?: string;
    configFile?: string;
    debug?: boolean;
  }): this {
    const cliConfig: any = {};

    if (args.debug) {
      cliConfig.logging = { ...cliConfig.logging, level: 'debug' };
      cliConfig.development = {
        ...this.config.development,
        enableDebugLogs: true,
        enableStackTraces: true,
      };
    }

    if (args.logLevel) {
      cliConfig.logging = { ...cliConfig.logging, level: args.logLevel };
    }

    if (args.apiUrl) {
      cliConfig.api = { ...this.config.api, baseUrl: args.apiUrl };
    }

    if (Object.keys(cliConfig).length > 0) {
      this.config = ServerConfigSchema.parse({
        ...this.config,
        ...cliConfig,
      });
    }

    return this;
  }

  /**
   * Get the final configuration
   */
  public getConfig(): ServerConfig {
    return this.config;
  }

  /**
   * Validate the configuration
   */
  public validate(): { valid: boolean; errors?: string[] } {
    try {
      ServerConfigSchema.parse(this.config);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        };
      }
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      };
    }
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Parse environment variable value to appropriate type
   */
  private parseEnvValue(value: string): any {
    // Try to parse as number
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }

    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Return as string
    return value;
  }

  /**
   * Export configuration to JSON
   */
  public exportToJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Get configuration summary for logging
   */
  public getSummary(): Record<string, unknown> {
    return {
      name: this.config.name,
      version: this.config.version,
      logLevel: this.config.logging.level,
      apiUrl: this.config.api.baseUrl,
      maxTools: this.config.registry.maxTools,
      isDevelopment: this.config.development.enableDebugLogs,
    };
  }
}

/**
 * Create and load configuration from all sources
 */
export function loadConfiguration(
  options: {
    configFile?: string;
    cliArgs?: any;
  } = {}
): ServerConfig {
  const loader = new ConfigLoader();

  // Load from environment variables
  loader.loadFromEnv();

  // Load from config file if provided
  if (options.configFile) {
    loader.loadFromFile(resolve(options.configFile));
  } else {
    // Try to load from default locations
    const defaultPaths = [
      './stampchain-mcp.json',
      './config/stampchain-mcp.json',
      process.env.HOME ? `${process.env.HOME}/.stampchain-mcp.json` : null,
    ].filter(Boolean) as string[];

    for (const path of defaultPaths) {
      if (existsSync(path)) {
        loader.loadFromFile(path);
        break;
      }
    }
  }

  // Load from CLI arguments
  if (options.cliArgs) {
    loader.loadFromCLI(options.cliArgs);
  }

  // Validate configuration
  const validation = loader.validate();
  if (!validation.valid) {
    throw new Error(`Configuration validation failed:\n${validation.errors?.join('\n')}`);
  }

  return loader.getConfig();
}

/**
 * Default configuration instance
 */
export const defaultConfig = ServerConfigSchema.parse({});

/**
 * Merge multiple configuration objects
 * Later configurations override earlier ones
 */
export function mergeConfigs(...configs: any[]): any {
  const merged = configs.reduce((acc, config) => {
    return deepMerge(acc, config);
  }, {});

  // Only validate if it looks like a complete server config
  // (has required fields like name and version)
  const isServerConfig = merged.name && merged.version;
  if (isServerConfig) {
    return ServerConfigSchema.parse(merged);
  }

  return merged;
}

/**
 * Deep merge objects recursively
 */
function deepMerge(target: any, source: any): any {
  if (!source) return target;

  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}
