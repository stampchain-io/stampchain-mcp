/**
 * Vitest test setup file
 * This file runs before each test to set up the testing environment
 */

import { vi } from 'vitest';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.STAMPCHAIN_LOG_LEVEL = 'error'; // Suppress logs during tests

// Mock axios and axios-retry
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn(),
          eject: vi.fn(),
        },
        response: {
          use: vi.fn(),
          eject: vi.fn(),
        },
      },
      defaults: {
        headers: {
          common: {},
          get: {},
          post: {},
          put: {},
          delete: {},
        },
      },
    })),
  },
  AxiosError: class AxiosError extends Error {
    constructor(message: string, code?: string, config?: any, request?: any, response?: any) {
      super(message);
      this.code = code;
      this.config = config;
      this.request = request;
      this.response = response;
    }
  },
}));

vi.mock('axios-retry', () => ({
  default: vi.fn(),
  isNetworkOrIdempotentRequestError: vi.fn(() => false),
}));

// Create a mock for the MCP SDK
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: { parse: vi.fn() },
  ListToolsRequestSchema: { parse: vi.fn() },
}));

export {};
