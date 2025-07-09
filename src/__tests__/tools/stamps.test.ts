import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Tests for stamp-related MCP tools
 */

import {
  GetStampTool,
  SearchStampsTool,
  GetRecentStampsTool,
  GetRecentSalesTool,
  GetMarketDataTool,
  GetStampMarketDataTool,
} from '../../tools/stamps.js';
import {
  createMockToolContext,
  createMockStamp,
  createMockRecentSalesResponse,
  createMockStampMarketData,
  expectToThrow,
} from '../utils/test-helpers.js';

describe('Stamps Tools', () => {
  let mockContext: ReturnType<typeof createMockToolContext>;

  beforeEach(() => {
    mockContext = createMockToolContext();
  });

  describe('GetStampTool', () => {
    let tool: GetStampTool;

    beforeEach(() => {
      tool = new GetStampTool();
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('get_stamp');
      expect(tool.description).toContain(
        'Retrieve detailed information about a specific Bitcoin stamp'
      );
      expect(tool.inputSchema).toBeDefined();
    });

    it('should execute successfully with valid stamp ID', async () => {
      const mockStamp = createMockStamp({ stamp: 12345 });
      mockContext.apiClient.getStamp.mockResolvedValueOnce(mockStamp);

      const result = await tool.execute({ stamp_id: 12345, include_base64: false }, mockContext);

      expect(mockContext.apiClient.getStamp).toHaveBeenCalledWith(12345);
      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('text');
      expect((result.content[0] as any).text).toContain('Stamp #12345');
      expect((result.content[0] as any).text).toContain(mockStamp.creator);
      expect(result.content[1].type).toBe('text');
      expect((result.content[1] as any).text).toContain('"stamp": 12345');
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('Stamp not found');
      mockContext.apiClient.getStamp.mockRejectedValueOnce(apiError);

      await expectToThrow(() => tool.execute({ stamp_id: 99999 }, mockContext), 'Stamp not found');

      expect(mockContext.apiClient.getStamp).toHaveBeenCalledWith(99999);
    });

    it('should validate input parameters', async () => {
      await expectToThrow(
        () => tool.execute({ stamp_id: -1, include_base64: false }, mockContext),
        'stamp_id must be a positive number'
      );

      await expectToThrow(
        () => tool.execute({ stamp_id: 'invalid' as any, include_base64: false }, mockContext),
        'stamp_id must be a positive number'
      );
    });

    it('should handle missing parameters', async () => {
      await expectToThrow(() => tool.execute({} as any, mockContext), 'Validation failed');
    });
  });

  describe('SearchStampsTool', () => {
    let tool: SearchStampsTool;

    beforeEach(() => {
      tool = new SearchStampsTool();
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('search_stamps');
      expect(tool.description).toContain('Search for Bitcoin stamps');
      expect(tool.inputSchema).toBeDefined();
    });

    it('should execute with default parameters', async () => {
      const mockStamps = [createMockStamp(), createMockStamp({ stamp: 12346 })];
      mockContext.apiClient.searchStamps.mockResolvedValueOnce(mockStamps);

      const result = await tool.execute({}, mockContext);

      expect(mockContext.apiClient.searchStamps).toHaveBeenCalledWith({
        page: 1,
        page_size: 20,
        sort_order: 'DESC',
      });
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Found 2 stamps');
      expect(result.content[0].text).toContain('Stamp #12345');
      expect(result.content[0].text).toContain('Stamp #12346');
      expect(result.content[1].text).toContain('Search Metadata');
    });

    it('should execute with custom search parameters', async () => {
      const mockStamps = [createMockStamp()];
      mockContext.apiClient.searchStamps.mockResolvedValueOnce(mockStamps);

      const searchParams = {
        creator: 'bc1qtest123456789012345678901234567890',
        collection_id: 'test-collection',
        page_size: 5,
      };

      const result = await tool.execute(searchParams, mockContext);

      expect(mockContext.apiClient.searchStamps).toHaveBeenCalledWith({
        creator: 'bc1qtest123456789012345678901234567890',
        collection_id: 'test-collection',
        page_size: 5,
        page: 1,
        sort_order: 'DESC',
      });
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Found 1 stamp');
    });

    it('should handle empty search results', async () => {
      mockContext.apiClient.searchStamps.mockResolvedValueOnce([]);

      const result = await tool.execute({}, mockContext);

      expect(result.content[0].text).toContain('No stamps found');
    });

    it('should validate search parameters', async () => {
      await expectToThrow(() => tool.execute({ page_size: 0 }, mockContext), 'Validation failed');

      await expectToThrow(
        () => tool.execute({ page_size: 1001 }, mockContext),
        'Validation failed'
      );

      await expectToThrow(
        () => tool.execute({ sort_order: 'invalid' as any }, mockContext),
        'Validation failed'
      );
    });

    it('should handle API errors', async () => {
      const apiError = new Error('API temporarily unavailable');
      mockContext.apiClient.searchStamps.mockRejectedValueOnce(apiError);

      await expectToThrow(() => tool.execute({}, mockContext), 'API temporarily unavailable');
    });
  });

  describe('GetRecentStampsTool', () => {
    let tool: GetRecentStampsTool;

    beforeEach(() => {
      tool = new GetRecentStampsTool();
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('get_recent_stamps');
      expect(tool.description).toContain('Retrieve the most recently created Bitcoin stamps');
      expect(tool.inputSchema).toBeDefined();
    });

    it('should execute with default limit', async () => {
      const mockStamps = Array.from({ length: 10 }, (_, i) =>
        createMockStamp({ stamp: 12345 + i })
      );
      mockContext.apiClient.searchStamps.mockResolvedValueOnce(mockStamps);

      const result = await tool.execute({}, mockContext);

      expect(mockContext.apiClient.searchStamps).toHaveBeenCalledWith({
        sort_order: 'DESC',
        page: 1,
        page_size: 20, // Updated to match the new default
      });
      expect(result.content[0].text).toContain('10 Most Recent Stamps');
      expect(result.content[0].text).toContain('Stamp #12345');
    });

    it('should execute with custom limit', async () => {
      const mockStamps = Array.from({ length: 25 }, (_, i) =>
        createMockStamp({ stamp: 12345 + i })
      );
      mockContext.apiClient.searchStamps.mockResolvedValueOnce(mockStamps);

      const result = await tool.execute({ limit: 25 }, mockContext);

      expect(mockContext.apiClient.searchStamps).toHaveBeenCalledWith({
        sort_order: 'DESC',
        page: 1,
        page_size: 25,
        is_cursed: undefined,
      });
      expect(result.content[0].text).toContain('25 Most Recent Stamps');
    });

    it('should handle empty results', async () => {
      mockContext.apiClient.searchStamps.mockResolvedValueOnce([]);

      const result = await tool.execute({}, mockContext);

      expect(result.content[0].text).toContain('No recent stamps found');
    });

    it('should validate limit parameter', async () => {
      await expectToThrow(() => tool.execute({ limit: 0 }, mockContext), 'Validation failed');

      await expectToThrow(() => tool.execute({ limit: 1001 }, mockContext), 'Validation failed');

      await expectToThrow(() => tool.execute({ limit: -5 }, mockContext), 'Validation failed');
    });

    it('should handle API errors', async () => {
      const apiError = new Error('Database connection failed');
      mockContext.apiClient.searchStamps.mockRejectedValueOnce(apiError);

      await expectToThrow(() => tool.execute({}, mockContext), 'Database connection failed');
    });

    it('should handle stamp without block_time field', async () => {
      const recentStamp = createMockStamp();
      mockContext.apiClient.searchStamps.mockResolvedValueOnce([recentStamp]);

      const result = await tool.execute({}, mockContext);

      expect(result.content[0].text).toContain('1 Most Recent Stamp');
      expect(result.content[0].text).toContain('Stamp #12345');
    });
  });

  describe('Tool Integration', () => {
    it('should work together for stamp discovery workflow', async () => {
      // First, get recent stamps
      const recentTool = new GetRecentStampsTool();
      const mockRecentStamps = [
        createMockStamp({ stamp: 12345, collection_id: 'popular-collection' }),
        createMockStamp({ stamp: 12346, collection_id: 'popular-collection' }),
      ];
      mockContext.apiClient.searchStamps.mockResolvedValueOnce(mockRecentStamps);

      await recentTool.execute({ limit: 2 }, mockContext);

      // Then search for stamps in the same collection
      const searchTool = new SearchStampsTool();
      const mockCollectionStamps = [
        createMockStamp({ stamp: 12340, collection_id: 'popular-collection' }),
        createMockStamp({ stamp: 12341, collection_id: 'popular-collection' }),
      ];
      mockContext.apiClient.searchStamps.mockResolvedValueOnce(mockCollectionStamps);

      await searchTool.execute(
        {
          collection_id: 'popular-collection',
          page_size: 10,
        },
        mockContext
      );

      // Finally, get details for a specific stamp
      const getTool = new GetStampTool();
      const mockStampDetail = createMockStamp({ stamp: 12340 });
      mockContext.apiClient.getStamp.mockResolvedValueOnce(mockStampDetail);

      await getTool.execute({ stamp_id: 12340 }, mockContext);

      // Verify all API calls were made correctly
      expect(mockContext.apiClient.searchStamps).toHaveBeenCalledWith({
        sort_order: 'DESC',
        page: 1,
        page_size: 2,
        is_cursed: undefined,
      });
      expect(mockContext.apiClient.searchStamps).toHaveBeenCalledWith({
        collection_id: 'popular-collection',
        page_size: 10,
        page: 1,
        sort_order: 'DESC',
      });
      expect(mockContext.apiClient.getStamp).toHaveBeenCalledWith(12340);
    });
  });
});
