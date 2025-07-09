/**
 * Test utility functions and helpers
 */

import { vi, expect } from 'vitest';
import { StampchainClient } from '../../api/stampchain-client.js';
import { createLogger } from '../../utils/index.js';
import type {
  Stamp,
  StampListResponse,
  CollectionResponse,
  TokenResponse,
} from '../../api/types.js';
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
    // v2.3 methods
    getRecentSales: vi.fn(),
    getMarketData: vi.fn(),
    getStampMarketData: vi.fn(),
    getAvailableVersions: vi.fn(),
    testVersionCompatibility: vi.fn(),
    getApiVersion: vi.fn(),
    setApiVersion: vi.fn(),
    getFeatureAvailability: vi.fn(),
    initializeWithVersionNegotiation: vi.fn(),
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
 * Creates a mock stamp object with all required fields for testing
 */
export function createMockStamp(overrides: Partial<Stamp> = {}): Stamp {
  return {
    stamp: 12345,
    block_index: 800000,
    cpid: 'A123456789012345678901234567890123456789',
    creator: 'bc1qtest123456789012345678901234567890',
    creator_name: 'Mike in Space',
    divisible: 0,
    keyburn: null,
    locked: 1,
    stamp_url: 'https://stampchain.io/stamps/test.png',
    stamp_mimetype: 'image/png',
    supply: 1,
    block_time: '2024-01-01T00:00:00.000Z',
    tx_hash: 'eb3da8146e626b5783f4359fb1510729f4aad923dfac45b6f1f3a2063907147c',
    tx_index: 1,
    ident: 'STAMP' as const,
    stamp_hash: 'GNGxz7X4LYQoG61sLdvE',
    file_hash: 'b60ab2708daec7685f3d412a5e05191a',
    stamp_base64:
      'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
    // Legacy fields (required for v2.3 compatibility)
    floorPrice: null,
    floorPriceUSD: null,
    marketCapUSD: null,
    // v2.3 fields (optional)
    marketData: {
      cpid: 'A123456789012345678901234567890123456789',
      floorPriceBTC: null,
      recentSalePriceBTC: null,
      openDispensersCount: 0,
      closedDispensersCount: 0,
      totalDispensersCount: 0,
      holderCount: 1,
      uniqueHolderCount: 1,
      topHolderPercentage: 100,
      holderDistributionScore: 0,
      volume24hBTC: 0,
      volume7dBTC: 0,
      volume30dBTC: 0,
      totalVolumeBTC: 0,
      priceSource: 'counterparty',
      volumeSources: { counterparty: 1 },
      dataQualityScore: 5,
      confidenceLevel: 3,
      lastUpdated: '2025-01-08T12:00:00.000Z',
      lastPriceUpdate: null,
      updateFrequencyMinutes: 30,
      lastSaleTxHash: null,
      lastSaleBuyerAddress: null,
      lastSaleDispenserAddress: null,
      lastSaleBtcAmount: null,
      lastSaleDispenserTxHash: null,
      lastSaleBlockIndex: null,
      activityLevel: 'COLD' as const,
      lastActivityTime: null,
      floorPriceUSD: null,
      recentSalePriceUSD: null,
      volume24hUSD: null,
      volume7dUSD: null,
      volume30dUSD: null,
    },
    cacheStatus: 'fresh' as const,
    dispenserInfo: {
      openCount: 0,
      closedCount: 0,
      totalCount: 0,
    },
    ...overrides,
  };
}

/**
 * Creates a mock stamp list response for testing
 */
export function createMockStampListResponse(stamps: Stamp[] = []): StampListResponse {
  return {
    data: stamps.length > 0 ? stamps : [createMockStamp()],
    last_block: 800000,
    metadata: {
      btcPrice: 50000,
      cacheStatus: 'fresh' as const,
      source: 'coingecko',
    },
    page: 1,
    limit: 20,
    totalPages: 1,
    total: stamps.length > 0 ? stamps.length : 1,
  };
}

/**
 * Create mock recent sale data for testing (v2.3)
 */
export function createMockRecentSale(overrides: Partial<any> = {}): any {
  return {
    tx_hash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    block_index: 844755,
    stamp_id: 12345,
    price_btc: 0.001,
    price_usd: 50.0,
    timestamp: 1704067200,
    buyer_address: 'bc1qbuyer123456789012345678901234567890',
    dispenser_address: null,
    time_ago: '2h ago',
    btc_amount_satoshis: 100000,
    dispenser_tx_hash: null,
    btcPriceUSD: 50000,
    ...overrides,
  };
}

/**
 * Create mock recent sales response for testing (v2.3)
 */
export function createMockRecentSalesResponse(overrides: Partial<any> = {}): any {
  return {
    data: [createMockRecentSale()],
    metadata: {
      dayRange: 30,
      lastUpdated: 1704067200000,
      total: 1,
    },
    last_block: 844755,
    ...overrides,
  };
}

/**
 * Create mock stamp market data for testing (v2.3)
 */
export function createMockStampMarketData(overrides: Partial<any> = {}): any {
  return {
    floorPrice: 0.001,
    floorPriceUSD: 50.0,
    marketCapUSD: 1000000,
    activityLevel: 'HOT' as const,
    lastActivityTime: 1704067200,
    lastSaleTxHash: 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    lastSaleBuyerAddress: 'bc1qbuyer123456789012345678901234567890',
    lastSaleDispenserAddress: null,
    lastSaleBtcAmount: 0.001,
    lastSaleDispenserTxHash: null,
    lastSaleBlockIndex: 844755,
    volume24h: 0.5,
    volume7d: 2.1,
    volume30d: 10.5,
    ...overrides,
  };
}

/**
 * Create mock collection data for testing
 */
export function createMockCollection(
  overrides: Partial<CollectionResponse> = {}
): CollectionResponse {
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
  return new Promise((resolve) => setTimeout(resolve, ms));
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
