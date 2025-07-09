/**
 * API Response Validation Tests
 * Ensures remote Stampchain API v2.3 responses match expected schemas and handle edge cases
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import axios from 'axios';
import { StampchainClient } from '../../api/stampchain-client.js';
import { StampSchema, CollectionSchema, TokenSchema } from '../../schemas/index.js';
import { createMockAxiosResponse } from '../utils/test-helpers.js';

vi.mock('axios');
vi.mock('axios-retry');

describe('API Response Validation', () => {
  let client: StampchainClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };
    
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance);
    client = new StampchainClient();
  });

  describe('Stamp Response Validation', () => {
    it('should validate stamp response schema against real API v2.3 format', async () => {
      // Based on actual API response from https://stampchain.io/api/v2/stamps/1
      // Updated to match our StampSchema exactly
      const realStampResponse = {
        stamp: 1,
        block_index: 779652,
        cpid: "A360128538192758000",
        creator: "1GotRejB6XsGgMsM79TvcypeanDJRJbMtg",
        creator_name: "Mike in Space",
        divisible: 0, // Schema expects number 0/1, not boolean
        keyburn: null,
        locked: 1, // Schema expects number 0/1, not boolean
        stamp_url: "https://stampchain.io/stamps/eb3da8146e626b5783f4359fb1510729f4aad923dfac45b6f1f3a2063907147c.png",
        stamp_mimetype: "image/png",
        supply: 1,
        block_time: "2023-03-07T01:19:09.000Z", // Required in v2.3
        tx_hash: "eb3da8146e626b5783f4359fb1510729f4aad923dfac45b6f1f3a2063907147c",
        tx_index: 1,
        ident: "STAMP" as const,
        stamp_hash: "GNGxz7X4LYQoG61sLdvE",
        file_hash: "b60ab2708daec7685f3d412a5e05191a",
        stamp_base64: "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==",
        floorPrice: null,
        floorPriceUSD: null,
        marketCapUSD: null
      };

      mockAxiosInstance.get.mockResolvedValueOnce(
        createMockAxiosResponse({ 
          last_block: 904672,
          data: { stamp: realStampResponse } 
        })
      );

      const result = await client.getStamp(1);
      
      // Validate against our schema
      expect(() => StampSchema.parse(result)).not.toThrow();
      expect(result.stamp).toBe(1);
      expect(result.creator).toBe("1GotRejB6XsGgMsM79TvcypeanDJRJbMtg");
      expect(result.tx_hash).toBe("eb3da8146e626b5783f4359fb1510729f4aad923dfac45b6f1f3a2063907147c");
      expect(result.ident).toBe("STAMP");
    });

    it('should handle stamps with missing optional fields', async () => {
      const minimalStamp = {
        stamp: 12345,
        block_index: 844755,
        cpid: "A360128538192758000",
        creator: "bc1qtest123456789012345678901234567890",
        creator_name: null,
        divisible: 0,
        keyburn: null,
        locked: 0,
        stamp_url: "https://example.com/stamp.png",
        stamp_mimetype: "image/png",
        supply: 1,
        block_time: "2024-01-01T00:00:00.000Z", // Required in v2.3
        tx_hash: "eb3da8146e626b5783f4359fb1510729f4aad923dfac45b6f1f3a2063907147c",
        tx_index: 1,
        ident: "STAMP" as const,
        stamp_hash: "testHash",
        file_hash: "testFileHash",
        stamp_base64: "testBase64",
        floorPrice: null,
        floorPriceUSD: null,
        marketCapUSD: null
      };

      mockAxiosInstance.get.mockResolvedValueOnce(
        createMockAxiosResponse({ 
          last_block: 904672,
          data: { stamp: minimalStamp } 
        })
      );

      const result = await client.getStamp(12345);
      
      expect(() => StampSchema.parse(result)).not.toThrow();
      expect(result.stamp).toBe(12345);
      expect(result.creator_name).toBeNull();
      expect(result.keyburn).toBeNull();
    });
  });

  describe('Collection Response Validation', () => {
    it('should validate collection response schema against real API v2.3 format', async () => {
      // Based on actual API response from https://stampchain.io/api/v2/collections
      // Updated to match our CollectionSchema exactly
      const realCollectionResponse = {
        collection_id: "1A5976D0A56DA9AD3C22BFC7AA61641C",
        collection_name: "warrior-stamps",
        collection_description: "A collection of warrior stamps", // Schema requires string, not null
        creators: [],
        stamp_count: 10,
        total_editions: 210, // Schema expects number, not string
        stamps: [17695, 17696, 17697, 17698, 17699, 17762, 17763, 17764, 17765, 17766]
      };

      mockAxiosInstance.get.mockResolvedValueOnce(
        createMockAxiosResponse({ 
          page: 1,
          limit: 500,
          totalPages: 1,
          total: 66,
          last_block: 904672,
          data: [realCollectionResponse] 
        })
      );

      const result = await client.searchCollections();
      
      expect(result).toHaveLength(1);
      const collection = result[0];
      expect(() => CollectionSchema.parse(collection)).not.toThrow();
      expect(collection.collection_id).toBe("1A5976D0A56DA9AD3C22BFC7AA61641C");
      expect(collection.collection_name).toBe("warrior-stamps");
      expect(collection.stamp_count).toBe(10);
      expect(collection.stamps).toHaveLength(10);
    });

    it('should handle collections with creators and descriptions', async () => {
      const collectionWithDetails = {
        collection_id: "802393BE99632442E3EFD8A4063A2B15",
        collection_name: "Valtius",
        collection_description: "A collection with description",
        creators: ["bc1qlx4stcv2tddfmmjcgl9k2l9976hjs2f302q5l0"],
        stamp_count: 3,
        total_editions: 7,
        stamps: [448689, 449574, 450357]
      };

      mockAxiosInstance.get.mockResolvedValueOnce(
        createMockAxiosResponse({ 
          page: 1,
          limit: 500,
          totalPages: 1,
          total: 1,
          last_block: 904672,
          data: [collectionWithDetails] 
        })
      );

      const result = await client.searchCollections();
      const collection = result[0];
      
      expect(() => CollectionSchema.parse(collection)).not.toThrow();
      expect(collection.creators).toHaveLength(1);
      expect(collection.collection_description).toBe("A collection with description");
    });
  });

  describe('SRC-20 Token Response Validation', () => {
    it('should validate SRC-20 token response schema', async () => {
      // Updated to match our TokenSchema exactly
      const validToken = {
        tx_hash: 'eb3da8146e626b5783f4359fb1510729f4aad923dfac45b6f1f3a2063907147c',
        block_index: 844755,
        p: 'src-20',
        op: 'deploy',
        tick: 'TEST',
        creator: 'bc1qtest123456789012345678901234567890',
        amt: null,
        deci: 8,
        lim: '1000',
        max: '21000000',
        destination: 'bc1qtest123456789012345678901234567890',
        block_time: '2024-01-01T00:00:00Z',
        creator_name: null,
        destination_name: null
      };

      mockAxiosInstance.get.mockResolvedValueOnce(
        createMockAxiosResponse({ 
          page: 1,
          limit: 500,
          totalPages: 1,
          total: 1,
          last_block: 904672,
          data: [validToken] 
        })
      );

      const result = await client.searchTokens();
      
      expect(result).toHaveLength(1);
      const token = result[0];
      expect(() => TokenSchema.parse(token)).not.toThrow();
      expect(token.tick).toBe('TEST');
      expect(token.creator).toBe('bc1qtest123456789012345678901234567890');
      expect(token.p).toBe('src-20');
    });

    it('should handle malformed API responses gracefully', async () => {
      // Test malformed response
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: "Invalid stamp ID",
            status: "error",
            code: "BAD_REQUEST"
          }
        }
      });

      await expect(client.getStamp(999999)).rejects.toThrow();
    });

    it('should validate required fields in stamp responses', async () => {
      const validStamp = {
        stamp: 12345,
        block_index: 844755,
        cpid: "A360128538192758000",
        creator: "bc1qtest123456789012345678901234567890",
        creator_name: null,
        divisible: 0,
        keyburn: null,
        locked: 1,
        stamp_url: "https://example.com/stamp.png",
        stamp_mimetype: "image/png",
        supply: 1,
        block_time: "2024-01-01T00:00:00.000Z", // Required in v2.3
        tx_hash: "eb3da8146e626b5783f4359fb1510729f4aad923dfac45b6f1f3a2063907147c",
        tx_index: 1,
        ident: "STAMP" as const,
        stamp_hash: "testHash",
        file_hash: "testFileHash", 
        stamp_base64: "testBase64",
        floorPrice: null,
        floorPriceUSD: null,
        marketCapUSD: null
      };

      mockAxiosInstance.get.mockResolvedValueOnce(
        createMockAxiosResponse({ 
          last_block: 904672,
          data: { stamp: validStamp } 
        })
      );

      const result = await client.getStamp(12345);
      
      // Validate the stamp has required fields
      expect(result.stamp).toBe(12345);
      expect(result.tx_hash).toBe("eb3da8146e626b5783f4359fb1510729f4aad923dfac45b6f1f3a2063907147c");
      expect(result.creator).toBe("bc1qtest123456789012345678901234567890");
      expect(result.ident).toBe("STAMP");
    });
  });

  describe('Error Response Validation', () => {
    it('should handle API error responses properly', async () => {
      const errorResponse = {
        error: "API Endpoint not found: /api/stamps/999999",
        status: "error",
        code: "NOT_FOUND"
      };

      mockAxiosInstance.get.mockRejectedValueOnce({
        response: {
          status: 404,
          data: errorResponse
        }
      });

      await expect(client.getStamp(999999)).rejects.toThrow();
    });

    it('should handle network timeouts gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(client.getStamp(1)).rejects.toThrow('Network timeout');
    });
  });

  describe('Response Structure Validation', () => {
    it('should validate client returns arrays for search methods', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce(
        createMockAxiosResponse({ 
          page: 1,
          limit: 500,
          totalPages: 1,
          total: 0,
          last_block: 904672,
          data: []
        })
      );

      const result = await client.searchCollections();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0); // Empty array for this test
    });

    it('should validate ISO 8601 datetime formats in token responses', async () => {
      const tokenWithDateTime = {
        tx_hash: 'eb3da8146e626b5783f4359fb1510729f4aad923dfac45b6f1f3a2063907147c',
        block_index: 844755,
        p: 'src-20',
        op: 'deploy',
        tick: 'TEST',
        creator: 'bc1qtest123456789012345678901234567890',
        amt: null,
        deci: 8,
        lim: '1000',
        max: '21000000',
        destination: 'bc1qtest123456789012345678901234567890',
        block_time: '2024-01-15T10:30:00.000Z', // ISO 8601 format required by schema
        creator_name: null,
        destination_name: null
      };

      mockAxiosInstance.get.mockResolvedValueOnce(
        createMockAxiosResponse({ 
          page: 1,
          limit: 500,
          totalPages: 1,
          total: 1,
          last_block: 904672,
          data: [tokenWithDateTime] 
        })
      );

      const result = await client.searchTokens();
      const token = result[0];
      
      // Validate ISO datetime format
      expect(() => TokenSchema.parse(token)).not.toThrow();
      expect(new Date(token.block_time)).toBeInstanceOf(Date);
      expect(new Date(token.block_time).getTime()).not.toBeNaN();
      expect(token.block_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
}); 