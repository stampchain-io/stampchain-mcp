import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Tests for configuration management system
 */

import { loadConfiguration, ServerConfigSchema, mergeConfigs } from '../../config/index.js';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Configuration System', () => {
  const testConfigDir = join(tmpdir(), 'stampchain-mcp-test');
  const testConfigPath = join(testConfigDir, 'test-config.json');

  // Create test directory
  beforeEach(() => {
    try {
      mkdirSync(testConfigDir, { recursive: true });
    } catch {
      // Directory might already exist
    }
  });

  // Clean up test files
  afterEach(() => {
    try {
      rmSync(testConfigDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('ServerConfigSchema', () => {
    it('should validate default configuration', () => {
      const defaultConfig = {
        name: 'stampchain-mcp',
        version: '0.1.0',
        logging: {
          level: 'info',
          enableColors: true,
        },
        api: {
          baseUrl: 'https://stampchain.io/api',
          timeout: 30000,
          retries: 3,
          retryDelay: 1000,
        },
        registry: {
          maxTools: 1000,
          validateOnRegister: true,
          allowDuplicateNames: false,
        },
        development: {
          enableStackTraces: false,
        },
      };

      const result = ServerConfigSchema.safeParse(defaultConfig);
      expect(result.success).toBe(true);
    });

    it('should apply default values for missing fields', () => {
      const minimalConfig = {
        name: 'test-server',
        version: '1.0.0',
      };

      const result = ServerConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.logging.level).toBe('info');
        expect(result.data.api.timeout).toBe(30000);
        expect(result.data.registry.maxTools).toBe(1000);
      }
    });

    it('should reject invalid log levels', () => {
      const invalidConfig = {
        name: 'test-server',
        version: '1.0.0',
        logging: {
          level: 'invalid-level',
        },
      };

      const result = ServerConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should validate timeout ranges', () => {
      const invalidConfig = {
        name: 'test-server',
        version: '1.0.0',
        api: {
          timeout: -1000, // Invalid negative timeout
        },
      };

      const result = ServerConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should validate retry configuration', () => {
      const invalidConfig = {
        name: 'test-server',
        version: '1.0.0',
        api: {
          retries: -1, // Invalid negative retries
        },
      };

      const result = ServerConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should validate registry limits', () => {
      const invalidConfig = {
        name: 'test-server',
        version: '1.0.0',
        registry: {
          maxTools: 0, // Invalid zero limit
        },
      };

      const result = ServerConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('mergeConfigs', () => {
    it('should merge flat configuration objects', () => {
      const base = { a: 1, b: 2, c: 3 };
      const override = { b: 20, d: 4 };

      const result = mergeConfigs(base, override);

      expect(result).toEqual({
        a: 1,
        b: 20, // Overridden
        c: 3,
        d: 4, // Added
      });
    });

    it('should merge nested configuration objects', () => {
      const base = {
        logging: { level: 'info', enableColors: true },
        api: { timeout: 30000, retries: 3 },
      };

      const override = {
        logging: { level: 'debug' },
        api: { timeout: 10000 },
        registry: { maxTools: 500 },
      };

      const result = mergeConfigs(base, override);

      expect(result).toEqual({
        logging: { level: 'debug', enableColors: true },
        api: { timeout: 10000, retries: 3 },
        registry: { maxTools: 500 },
      });
    });

    it('should handle null and undefined values', () => {
      const base = { a: 1, b: 2 };
      const override = { b: null, c: undefined, d: 3 };

      const result = mergeConfigs(base, override);

      expect(result).toEqual({
        a: 1,
        b: null,
        c: undefined,
        d: 3,
      });
    });

    it('should not mutate original objects', () => {
      const base = { nested: { value: 1 } };
      const override = { nested: { value: 2 } };

      const originalBase = JSON.parse(JSON.stringify(base));
      const originalOverride = JSON.parse(JSON.stringify(override));

      mergeConfigs(base, override);

      expect(base).toEqual(originalBase);
      expect(override).toEqual(originalOverride);
    });
  });

  describe('loadConfiguration', () => {
    beforeEach(() => {
      // Clear environment variables
      delete process.env.STAMPCHAIN_LOG_LEVEL;
      delete process.env.STAMPCHAIN_API_URL;
      delete process.env.STAMPCHAIN_API_TIMEOUT;
      delete process.env.STAMPCHAIN_MAX_TOOLS;
    });

    it('should load default configuration', () => {
      const config = loadConfiguration();

      expect(config.name).toBe('stampchain-mcp');
      expect(config.version).toBe('0.1.0');
      expect(config.logging.level).toBe('info');
      expect(config.api.baseUrl).toBe('https://stampchain.io/api');
    });

    it('should override with environment variables', () => {
      process.env.STAMPCHAIN_LOG_LEVEL = 'debug';
      process.env.STAMPCHAIN_API_URL = 'https://custom.api.com';
      process.env.STAMPCHAIN_API_TIMEOUT = '15000';
      process.env.STAMPCHAIN_MAX_TOOLS = '500';

      const config = loadConfiguration();

      expect(config.logging.level).toBe('debug');
      expect(config.api.baseUrl).toBe('https://custom.api.com');
      expect(config.api.timeout).toBe(15000);
      expect(config.registry.maxTools).toBe(500);
    });

    it('should load configuration from file', () => {
      const fileConfig = {
        name: 'custom-server',
        logging: { level: 'warn' },
        api: { timeout: 20000 },
      };

      // Create test config file
      writeFileSync(testConfigPath, JSON.stringify(fileConfig, null, 2));

      const config = loadConfiguration({ configFile: testConfigPath });

      expect(config.name).toBe('custom-server');
      expect(config.logging.level).toBe('warn');
      expect(config.api.timeout).toBe(20000);
      // Default values should still be present
      expect(config.api.baseUrl).toBe('https://stampchain.io/api');
    });

    it('should override with CLI arguments', () => {
      const cliArgs = {
        logLevel: 'error',
        apiUrl: 'https://cli.api.com',
        debug: true,
      };

      const config = loadConfiguration({ cliArgs });

      expect(config.logging.level).toBe('error');
      expect(config.api.baseUrl).toBe('https://cli.api.com');
      expect(config.development.enableStackTraces).toBe(true);
    });

    it('should apply configuration precedence (CLI > ENV > File > Default)', () => {
      // Set up all sources
      process.env.STAMPCHAIN_LOG_LEVEL = 'warn';

      const fileConfig = {
        logging: { level: 'info' },
        api: { timeout: 25000 },
      };
      writeFileSync(testConfigPath, JSON.stringify(fileConfig, null, 2));

      const cliArgs = {
        logLevel: 'debug', // Should override everything
      };

      const config = loadConfiguration({
        configFile: testConfigPath,
        cliArgs,
      });

      expect(config.logging.level).toBe('debug'); // CLI wins
      expect(config.api.timeout).toBe(25000); // From file
    });

    it('should handle missing configuration file gracefully', () => {
      expect(() => {
        loadConfiguration({ configFile: '/non/existent/path.json' });
      }).not.toThrow();
    });

    it('should handle invalid JSON in configuration file', () => {
      writeFileSync(testConfigPath, 'invalid json content');

      expect(() => {
        loadConfiguration({ configFile: testConfigPath });
      }).toThrow('Failed to parse configuration file');
    });

    it('should validate final configuration', () => {
      const invalidConfig = {
        logging: { level: 'invalid-level' },
      };
      writeFileSync(testConfigPath, JSON.stringify(invalidConfig, null, 2));

      expect(() => {
        loadConfiguration({ configFile: testConfigPath });
      }).toThrow('Configuration validation failed');
    });

    it('should handle boolean environment variables', () => {
      process.env.STAMPCHAIN_ENABLE_COLORS = 'false';
      process.env.STAMPCHAIN_VALIDATE_ON_REGISTER = 'true';

      const config = loadConfiguration();

      expect(config.logging.enableColors).toBe(false);
      expect(config.registry.validateOnRegister).toBe(true);
    });

    it('should handle numeric environment variables', () => {
      process.env.STAMPCHAIN_API_TIMEOUT = '45000';
      process.env.STAMPCHAIN_API_RETRIES = '5';
      process.env.STAMPCHAIN_MAX_TOOLS = '2000';

      const config = loadConfiguration();

      expect(config.api.timeout).toBe(45000);
      expect(config.api.retries).toBe(5);
      expect(config.registry.maxTools).toBe(2000);
    });

    it('should ignore invalid environment variable values', () => {
      process.env.STAMPCHAIN_API_TIMEOUT = 'not-a-number';
      process.env.STAMPCHAIN_MAX_TOOLS = 'invalid';

      const config = loadConfiguration();

      // Should fall back to defaults
      expect(config.api.timeout).toBe(30000);
      expect(config.registry.maxTools).toBe(1000);
    });
  });
});
