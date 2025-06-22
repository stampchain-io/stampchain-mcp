/**
 * Test utility functions and helpers
 */

import { vi, expect } from 'vitest';
import { StampchainClient } from '../../api/stampchain-client.js';
import { createLogger } from '../../utils/index.js';
import type { Stamp, CollectionResponse, TokenResponse } from '../../api/types.js';
import type { ServerConfig } from '../../config/index.js';

/**
 * Create a mock logger for testing
 */
export function createMockLogger() {
  return createLogger('test', { level: 'error' });
}

/**
 * Create a mock API client for testing
 */
export function createMockApiClient() {
  return {
    getStamp: vi.fn(),
    searchStamps: vi.fn(),
    getRecentStamps: vi.fn(),
    getCollection: vi.fn(),
    searchCollections: vi.fn(),
    getToken: vi.fn(),
    searchTokens: vi.fn(),
    getBlock: vi.fn(),
    getBalance: vi.fn(),
    customRequest: vi.fn(),
  };
}

/**
 * Create a test configuration
 */
export function createTestConfig(): ServerConfig {
  return {
    name: 'stampchain-mcp-test',
    version: '0.1.0-test',
    logging: {
      level: 'error',
      enableTimestamps: false,
      enableColors: false,
    },
    api: {
      baseUrl: 'https://test.stampchain.io/api',
      timeout: 5000,
      retries: 1,
      retryDelay: 100,
    },
    registry: {
      maxTools: 100,
      validateOnRegister: true,
      allowDuplicateNames: false,
    },
    performance: {
      requestTimeout: 30000,
      maxConcurrentRequests: 5,
    },
    development: {
      enableDebugLogs: false,
      enableStackTraces: false,
    },
  };
}

/**
 * Create mock stamp data for testing
 */
export function createMockStamp(overrides: Partial<Stamp> = {}): Stamp {
  return {
    stamp: 12345,
    block_index: 800000,
    cpid: 'A123456789012345678901234567890123456789',
    creator: 'bc1qtest123456789012345678901234567890',
    creator_name: null,
    divisible: 0,
    keyburn: null,
    locked: 1,
    stamp_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA',
    stamp_mimetype: 'image/png',
    stamp_url: 'https://stampchain.io/stamp/12345.png',
    supply: 1,
    tx_hash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    tx_index: 123456,
    ident: 'STAMP' as const,
    stamp_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    file_hash: 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    floorPrice: 1000,
    floorPriceUSD: null,
    marketCapUSD: null,
    ...overrides,
  };
}

/**
 * Create mock collection data for testing
 */
export function createMockCollection(overrides: Partial<CollectionResponse> = {}): CollectionResponse {
  return {
    collection_id: 'test-collection',
    collection_name: 'Test Collection',
    collection_description: 'A test collection for unit tests',
    creators: ['bc1qtest123456789012345678901234567890'],
    stamp_count: 100,
    total_editions: 100,
    stamps: [1, 2, 3, 4, 5],
    ...overrides,
  };
}

/**
 * Create mock SRC-20 token data for testing
 */
export function createMockToken(overrides: Partial<TokenResponse> = {}): TokenResponse {
  return {
    tx_hash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    block_index: 800000,
    p: 'src-20',
    op: 'deploy',
    tick: 'TEST',
    creator: 'bc1qtest123456789012345678901234567890',
    amt: 1000,
    deci: 8,
    lim: '1000',
    max: '21000000',
    destination: 'bc1qtest123456789012345678901234567890',
    block_time: '2024-01-01T00:00:00Z',
    creator_name: null,
    destination_name: null,
    ...overrides,
  };
}

/**
 * Create mock MCP tool execution context
 */
export function createMockToolContext() {
  return {
    logger: createMockLogger(),
    apiClient: createMockApiClient(),
    config: createTestConfig(),
  };
}

/**
 * Mock axios response for testing
 */
export function createMockAxiosResponse<T>(data: T, status = 200) {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {},
  };
}

/**
 * Create a promise that resolves after a delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Assert that a function throws with a specific message
 */
export async function expectToThrow(
  fn: () => Promise<unknown> | unknown,
  expectedMessage?: string | RegExp
): Promise<Error> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (error instanceof Error) {
      if (expectedMessage) {
        if (typeof expectedMessage === 'string') {
          expect(error.message).toContain(expectedMessage);
        } else {
          expect(error.message).toMatch(expectedMessage);
        }
      }
      return error;
    }
    throw error;
  }
}