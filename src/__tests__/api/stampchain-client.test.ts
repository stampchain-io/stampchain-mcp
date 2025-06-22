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
    });

    it('should create client with custom configuration', () => {
      const customClient = new StampchainClient({
        baseURL: 'https://custom.api.com',
        timeout: 10000,
        retries: 5,
        retryDelay: 500,
      });
      expect(customClient).toBeInstanceOf(StampchainClient);
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
});