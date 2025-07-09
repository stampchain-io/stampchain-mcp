import { vi, describe, it, expect, beforeEach } from 'vitest';
/**
 * Tests for StampchainClient API client
 */

import axios from 'axios';
import { StampchainClient } from '../../api/stampchain-client.js';
import { createMockAxiosResponse, createMockStamp, createMockCollection, createMockToken } from '../utils/test-helpers.js';

// Get the mocked axios instance
vi.mock('axios');
vi.mock('axios-retry');

describe('StampchainClient', () => {
  let client: StampchainClient;
  let mockAxiosInstance: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
    interceptors: {
      request: { use: ReturnType<typeof vi.fn> };
      response: { use: ReturnType<typeof vi.fn> };
    };
    defaults: {
      headers: Record<string, string>;
      baseURL: string;
      timeout: number;
    };
  };

  beforeEach(() => {
    // Get the mocked axios create return value
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      defaults: {
        headers: {},
        baseURL: 'https://test.stampchain.io/api',
        timeout: 5000,
      },
    };
    
    // Make axios.create return our mock instance
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as never);
    
    client = new StampchainClient({
      baseURL: 'https://test.stampchain.io/api',
      timeout: 5000,
      retries: 1,
      retryDelay: 100,
    });
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default configuration', () => {
      const defaultClient = new StampchainClient();
      expect(defaultClient).toBeInstanceOf(StampchainClient);
      expect(defaultClient.getApiVersion()).toBe('2.3');
    });

    it('should create client with custom configuration', () => {
      const customClient = new StampchainClient({
        baseURL: 'https://custom.api.com',
        timeout: 10000,
        retries: 5,
        retryDelay: 500,
        apiVersion: '2.2',
      });
      expect(customClient).toBeInstanceOf(StampchainClient);
      expect(customClient.getApiVersion()).toBe('2.2');
    });
  });

  describe('getStamp', () => {
    it('should fetch stamp data successfully', async () => {
      const mockStamp = createMockStamp();
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse({
        data: { stamp: mockStamp }
      }));

      const result = await client.getStamp(12345);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stamps/12345');
      expect(result).toEqual(mockStamp);
    });

    it('should handle API errors gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getStamp(12345)).rejects.toThrow('Network error');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stamps/12345');
    });

    it('should handle 404 errors for non-existent stamps', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 404, data: { error: 'Stamp not found' } }
      });

      await expect(client.getStamp(99999)).rejects.toMatchObject({
        response: { status: 404 }
      });
    });
  });

  describe('searchStamps', () => {
    it('should search stamps with default parameters', async () => {
      const mockStamps = [createMockStamp(), createMockStamp({ stamp: 12346 })];
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse({
        data: mockStamps
      }));

      const result = await client.searchStamps();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stamps', {
        params: {}
      });
      expect(result).toEqual(mockStamps);
    });

    it('should search stamps with custom filters', async () => {
      const mockStamps = [createMockStamp()];
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse({ data: mockStamps }));

      const params = {
        creator: 'bc1qtest123456789012345678901234567890',
        collection_id: 'test-collection',
        limit: 20,
        sort_order: 'ASC' as const,
      };

      const result = await client.searchStamps(params);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stamps', { params });
      expect(result).toEqual(mockStamps);
    });

    it('should handle empty search results', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse({ data: [] }));

      const result = await client.searchStamps({ creator: 'nonexistent' });

      expect(result).toEqual([]);
    });
  });

  describe('getRecentStamps', () => {
    it('should fetch recent stamps with default limit', async () => {
      const mockStamps = [createMockStamp(), createMockStamp({ stamp: 12346 })];
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse({ data: mockStamps }));

      const result = await client.getRecentStamps();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stamps', {
        params: { limit: 20 }
      });
      expect(result).toEqual(mockStamps);
    });

    it('should fetch recent stamps with custom limit', async () => {
      const mockStamps = Array.from({ length: 25 }, (_, i) => 
        createMockStamp({ stamp: 12345 + i })
      );
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse({ data: mockStamps }));

      const result = await client.getRecentStamps(25);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stamps', {
        params: { limit: 25 }
      });
      expect(result).toEqual(mockStamps);
    });
  });

  describe('getCollection', () => {
    it('should fetch collection data successfully', async () => {
      const mockCollection = createMockCollection();
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse(mockCollection));

      const result = await client.getCollection('test-collection');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/collections/test-collection');
      expect(result).toEqual(mockCollection);
    });

    it('should handle non-existent collections', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 404, data: { error: 'Collection not found' } }
      });

      await expect(client.getCollection('nonexistent')).rejects.toMatchObject({
        response: { status: 404 }
      });
    });
  });

  describe('searchCollections', () => {
    it('should search collections with default parameters', async () => {
      const mockCollections = [createMockCollection(), createMockCollection({ collection_id: 'test-2' })];
      const mockResponse = {
        data: mockCollections,
        last_block: 844755,
        page: 1,
        limit: 10,
        totalPages: 1,
        total: 2
      };
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await client.searchCollections();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/collections', {
        params: {}
      });
      expect(result).toEqual(mockCollections);
    });

    it('should search collections with custom filters', async () => {
      const mockCollections = [createMockCollection()];
      const mockResponse = {
        data: mockCollections,
        last_block: 844755,
        page: 1,
        limit: 5,
        totalPages: 1,
        total: 1
      };
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const params = {
        creator: 'bc1qtest123456789012345678901234567890',
        query: 'Test',
        page_size: 5,
      };

      const result = await client.searchCollections(params);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/collections', { params });
      expect(result).toEqual(mockCollections);
    });
  });

  describe('getToken', () => {
    it('should fetch token info successfully', async () => {
      const mockToken = createMockToken();
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse(mockToken));

      const result = await client.getToken('TEST');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/src20/TEST');
      expect(result).toEqual(mockToken);
    });

    it('should handle case-insensitive token tickers', async () => {
      const mockToken = createMockToken({ tick: 'TEST' });
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse(mockToken));

      const result = await client.getToken('test');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/src20/test');
      expect(result).toEqual(mockToken);
    });
  });

  describe('searchTokens', () => {
    it('should search tokens with default parameters', async () => {
      const mockTokens = [createMockToken(), createMockToken({ tick: 'OTHER' })];
      const mockResponse = {
        data: mockTokens,
        last_block: 844755,
        page: 1,
        limit: 10,
        totalPages: 1,
        total: 2
      };
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const result = await client.searchTokens();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/src20', {
        params: {}
      });
      expect(result).toEqual(mockTokens);
    });

    it('should search tokens with filters', async () => {
      const mockTokens = [createMockToken()];
      const mockResponse = {
        data: mockTokens,
        last_block: 844755,
        page: 1,
        limit: 20,
        totalPages: 1,
        total: 1
      };
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse(mockResponse));

      const params = {
        deployer: 'bc1qtest123456789012345678901234567890',
        page_size: 20,
      };

      const result = await client.searchTokens(params);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/src20', { params });
      expect(result).toEqual(mockTokens);
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts', async () => {
      const timeoutError = new Error('timeout of 5000ms exceeded');
      timeoutError.name = 'AxiosError';
      mockAxiosInstance.get.mockRejectedValueOnce(timeoutError);

      await expect(client.getStamp(12345)).rejects.toThrow('timeout of 5000ms exceeded');
    });

    it('should handle server errors', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { 
          status: 500, 
          statusText: 'Internal Server Error',
          data: { error: 'Database connection failed' }
        }
      });

      await expect(client.getStamp(12345)).rejects.toMatchObject({
        response: { status: 500 }
      });
    });

    it('should handle rate limiting', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { 
          status: 429, 
          statusText: 'Too Many Requests',
          data: { error: 'Rate limit exceeded' }
        }
      });

      await expect(client.getStamp(12345)).rejects.toMatchObject({
        response: { status: 429 }
      });
    });
  });

  describe('API version management', () => {
    it('should get current API version', () => {
      expect(client.getApiVersion()).toBe('2.3');
    });

    it('should set API version', () => {
      client.setApiVersion('2.2');
      expect(client.getApiVersion()).toBe('2.2');
    });

    it('should get available versions', async () => {
      const mockVersions = {
        current: '2.3',
        requestedVersion: '2.3',
        versions: [
          { version: '2.3', status: 'current', releaseDate: '2025-01-15' },
          { version: '2.2', status: 'supported', releaseDate: '2024-06-01' }
        ]
      };
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse(mockVersions));

      const result = await client.getAvailableVersions();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/versions');
      expect(result).toEqual(mockVersions);
    });

    it('should test version compatibility', async () => {
      // Mock axios.create for the temporary client in testVersionCompatibility
      const tempMockInstance = {
        get: vi.fn().mockResolvedValueOnce(createMockAxiosResponse({ status: 'OK' })),
      };
      vi.mocked(axios.create).mockReturnValueOnce(tempMockInstance as never);

      const result = await client.testVersionCompatibility('2.2');
      expect(result).toBe(true);
    });

    it('should handle version compatibility failure', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Version not supported'));

      const result = await client.testVersionCompatibility('2.1');
      expect(result).toBe(false);
    });

    it('should get feature availability', () => {
      const features = client.getFeatureAvailability();
      expect(features).toEqual({
        marketData: true,
        recentSales: true,
        enhancedFiltering: true,
        dispenserInfo: true,
        cacheStatus: true,
      });
    });

    it('should get feature availability for older version', () => {
      client.setApiVersion('2.2');
      const features = client.getFeatureAvailability();
      expect(features).toEqual({
        marketData: false,
        recentSales: false,
        enhancedFiltering: false,
        dispenserInfo: false,
        cacheStatus: false,
      });
    });
  });

  describe('recent sales (v2.3)', () => {
    it('should get recent sales data', async () => {
      const mockSalesData = {
        data: [
          {
            tx_hash: 'abcd1234',
            block_index: 844755,
            stamp_id: 12345,
            price_btc: 0.001,
            price_usd: 50.00,
            timestamp: 1704067200,
            buyer_address: 'bc1qtest123',
            time_ago: '2h ago'
          }
        ],
        metadata: {
          dayRange: 30,
          lastUpdated: 1704067200000,
          total: 1
        },
        last_block: 844755
      };
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse(mockSalesData));

      const result = await client.getRecentSales({ dayRange: 30, fullDetails: true });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stamps/recentSales', {
        params: { dayRange: 30, fullDetails: true }
      });
      expect(result).toEqual(mockSalesData);
    });

    it('should handle recent sales with fallback for older API versions', async () => {
      client.setApiVersion('2.2');
      const mockStamps = [createMockStamp()];
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse({ data: mockStamps }));

      const result = await client.getRecentSales({ dayRange: 7 });
      expect(result.data).toHaveLength(1);
      expect(result.metadata.dayRange).toBe(7);
    });
  });

  describe('market data (v2.3)', () => {
    it('should get market data', async () => {
      const mockMarketData = {
        data: [
          {
            floorPrice: 0.001,
            floorPriceUSD: 50.00,
            marketCapUSD: 1000000,
            activityLevel: 'HOT',
            lastActivityTime: 1704067200,
            volume24h: 0.5
          }
        ],
        last_block: 844755,
        page: 1,
        limit: 20,
        total: 1
      };
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse(mockMarketData));

      const result = await client.getMarketData({ activity_level: 'HOT' });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stamps/marketData', {
        params: { activity_level: 'HOT' }
      });
      expect(result).toEqual(mockMarketData);
    });

    it('should get stamp market data', async () => {
      const mockStampMarketData = {
        floorPrice: 0.001,
        floorPriceUSD: 50.00,
        marketCapUSD: 100000,
        activityLevel: 'WARM',
        lastActivityTime: 1704067200,
        volume24h: 0.1,
        lastSaleTxHash: 'abcd1234',
        lastSaleBuyerAddress: 'bc1qtest123'
      };
      mockAxiosInstance.get.mockResolvedValueOnce(createMockAxiosResponse({
        data: mockStampMarketData
      }));

      const result = await client.getStampMarketData(12345);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stamps/12345/marketData');
      expect(result).toEqual(mockStampMarketData);
    });
  });
});