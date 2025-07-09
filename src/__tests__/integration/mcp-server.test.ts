/* eslint-disable @typescript-eslint/unbound-method */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
/**
 * Integration tests for the complete MCP server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { StampchainClient } from '../../api/stampchain-client.js';
import { ToolRegistry } from '../../tools/registry.js';
import { createAllTools, toolMetadata } from '../../tools/index.js';
import { loadConfiguration } from '../../config/index.js';
import { createMockStamp, createMockCollection, createMockToken } from '../utils/test-helpers.js';
import type { ToolContext, ToolResponse } from '../../interfaces/tool.js';
import type { Stamp, CollectionResponse, TokenResponse } from '../../api/types.js';

// Mock the transport and external dependencies
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../api/stampchain-client.js');

describe('MCP Server Integration', () => {
  let server: Server;
  let mockApiClient: StampchainClient;
  let toolRegistry: ToolRegistry;
  let config: ReturnType<typeof loadConfiguration>;

  type CallToolHandler = (request: CallToolRequest) => Promise<ToolResponse>;
  type ListToolsHandler = () => { tools: Array<{ name: string; description: string; inputSchema: unknown }> };

  let callToolHandler: CallToolHandler;
  let listToolsHandler: ListToolsHandler;

  beforeEach(() => {
    // Load test configuration
    config = loadConfiguration({
      cliArgs: { logLevel: 'error' } // Suppress logs during tests
    });

    // Initialize tool registry
    toolRegistry = new ToolRegistry(config.registry);

    // Create mock API client with proper typing
    const mockedClient = {
      getStamp: vi.fn<[number], Promise<Stamp>>(),
      searchStamps: vi.fn<[unknown], Promise<Stamp[]>>(),
      getRecentStamps: vi.fn<[number?], Promise<Stamp[]>>(),
      getCollection: vi.fn<[string], Promise<CollectionResponse>>(),
      searchCollections: vi.fn<[unknown], Promise<CollectionResponse[]>>(),
      getToken: vi.fn<[string], Promise<TokenResponse>>(),
      searchTokens: vi.fn<[unknown], Promise<TokenResponse[]>>(),
      getBlock: vi.fn(),
      getBalance: vi.fn(),
      customRequest: vi.fn(),
    };
    mockApiClient = mockedClient as unknown as StampchainClient;

    // Create and register all tools
    const tools = createAllTools(mockApiClient);
    for (const metadata of Object.values(toolMetadata)) {
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

    // Initialize MCP server
    server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register handlers (simplified version of main server logic)
    listToolsHandler = (): { tools: Array<{ name: string; description: string; inputSchema: unknown }> } => {
      const tools = toolRegistry.getMCPTools();
      return { tools };
    };
    server.setRequestHandler(ListToolsRequestSchema, listToolsHandler);

    callToolHandler = async (request: CallToolRequest): Promise<ToolResponse> => {
      const { name: toolName, arguments: args } = request.params;
      
      try {
        const tool = toolRegistry.get(toolName);
        
        const context: ToolContext = {
          logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
          apiClient: mockApiClient,
          config,
        };

        const result = await tool.execute(args || {}, context);
        return result;
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Unknown error',
            },
          ],
          isError: true,
        };
      }
    };
    server.setRequestHandler(CallToolRequestSchema, callToolHandler);
  });

  describe('Server Initialization', () => {
    it('should initialize with all expected tools', () => {
      const stats = toolRegistry.getStats();
      
      expect(stats.totalTools).toBe(10); // All 10 tools should be registered (7 original + 3 v2.3 tools)
              expect(stats.enabledTools).toBe(10);
      expect(stats.categories).toBe(3); // stamps, collections, tokens
    });

    it('should have correct tool categories', () => {
      const categories = toolRegistry.getCategories();
      
      expect(categories).toContain('Bitcoin Stamps');
      expect(categories).toContain('Stamp Collections');
      expect(categories).toContain('SRC-20 Tokens');
    });

    it('should register all expected tools', () => {
      const tools = toolRegistry.list();
      const toolNames = tools.map(t => t.name);
      
      // Stamp tools
      expect(toolNames).toContain('get_stamp');
      expect(toolNames).toContain('search_stamps');
      expect(toolNames).toContain('get_recent_stamps');
      
      // Collection tools
      expect(toolNames).toContain('get_collection');
      expect(toolNames).toContain('search_collections');
      
      // Token tools
      expect(toolNames).toContain('get_token_info');
      expect(toolNames).toContain('search_tokens');
    });
  });

  describe('List Tools Handler', () => {
    it('should return all available tools', () => {
      // Get tools from registry
      const mcpTools = toolRegistry.getMCPTools();
      
      expect(mcpTools).toHaveLength(10);
      expect(mcpTools.every(tool => 
        tool.name && tool.description && tool.inputSchema
      )).toBe(true);
    });

    it('should return tools with correct MCP format', () => {
      // Get tools from registry
      const mcpTools = toolRegistry.getMCPTools();
      
      const stampTool = mcpTools.find(t => t.name === 'get_stamp');
      expect(stampTool).toBeDefined();
      expect(stampTool!.description).toContain('Retrieve detailed information about a specific Bitcoin stamp');
      expect(stampTool!.inputSchema.type).toBe('object');
      expect(stampTool!.inputSchema.properties).toBeDefined();
    });
  });

  describe('Call Tool Handler', () => {
    describe('Stamp Tools', () => {
      it('should execute get_stamp tool successfully', async () => {
        const mockStamp = createMockStamp();
        const getStampMock = vi.mocked(mockApiClient.getStamp);
        getStampMock.mockResolvedValueOnce(mockStamp);

        const result = await callToolHandler({
          params: {
            name: 'get_stamp',
            arguments: { stamp_id: 12345 }
          }
        });

        expect(mockApiClient.getStamp).toHaveBeenCalledWith(12345);
        expect(result.content.length).toBeGreaterThanOrEqual(1);
        expect(result.content[0].text).toContain('Stamp #12345');
        expect(result.isError).toBeUndefined();
      });

      it('should execute search_stamps tool with filters', async () => {
        const mockStamps = [createMockStamp(), createMockStamp({ stamp: 12346 })];
        const searchStampsMock = vi.mocked(mockApiClient.searchStamps);
        searchStampsMock.mockResolvedValueOnce(mockStamps);

        // Use the handler from beforeEach
        const result = await callToolHandler({
          params: {
            name: 'search_stamps',
            arguments: { 
              creator: 'bc1qtest123456789012345678901234567890',
              limit: 10 
            }
          }
        });

        expect(mockApiClient.searchStamps).toHaveBeenCalledWith({
          creator: 'bc1qtest123456789012345678901234567890',
          sort_order: 'DESC',
          page: 1,
          page_size: 20
        });
        expect(result.content[0].text).toContain('Found 2 stamps');
      });

      it('should execute get_recent_stamps tool', async () => {
        const mockStamps = Array.from({ length: 5 }, (_, i) => 
          createMockStamp({ stamp: 12345 + i })
        );
        const searchStampsMock = vi.mocked(mockApiClient.searchStamps);
        searchStampsMock.mockResolvedValueOnce(mockStamps);

        // Use the handler from beforeEach
        const result = await callToolHandler({
          params: {
            name: 'get_recent_stamps',
            arguments: { limit: 5 }
          }
        });

        expect(mockApiClient.searchStamps).toHaveBeenCalledWith({
          sort_order: 'DESC',
          page: 1,
          page_size: 5,
          is_cursed: undefined
        });
        expect(result.content[0].text).toContain('5 Most Recent Stamps');
      });
    });

    describe('Collection Tools', () => {
      it('should execute get_collection tool successfully', async () => {
        const mockCollections = [createMockCollection()];
        const searchCollectionsMock = vi.mocked(mockApiClient.searchCollections);
        searchCollectionsMock.mockResolvedValueOnce(mockCollections);

        // Use the handler from beforeEach
        const result = await callToolHandler({
          params: {
            name: 'get_collection',
            arguments: { collection_id: 'test-collection' }
          }
        });

        expect(mockApiClient.searchCollections).toHaveBeenCalledWith({
          query: 'test-collection',
          page: 1,
          page_size: 1
        });
        expect(result.content[0].text).toContain('Collection: Test Collection');
      });

      it('should execute search_collections tool', async () => {
        const mockCollections = [createMockCollection()];
        const searchCollectionsMock = vi.mocked(mockApiClient.searchCollections);
        searchCollectionsMock.mockResolvedValueOnce(mockCollections);

        // Use the handler from beforeEach
        const result = await callToolHandler({
          params: {
            name: 'search_collections',
            arguments: { creator: 'bc1qtest123456789012345678901234567890' }
          }
        });

        expect(mockApiClient.searchCollections).toHaveBeenCalledWith({
          creator: 'bc1qtest123456789012345678901234567890',
          sort_by: 'created_at',
          sort_order: 'DESC',
          page: 1,
          page_size: 20
        });
        expect(result.content[0].text).toContain('Found 1 collection');
      });
    });

    describe('Token Tools', () => {
      it('should execute get_token_info tool successfully', async () => {
        const mockTokens = [createMockToken()];
        const searchTokensMock = vi.mocked(mockApiClient.searchTokens);
        searchTokensMock.mockResolvedValueOnce(mockTokens);

        // Use the handler from beforeEach
        const result = await callToolHandler({
          params: {
            name: 'get_token_info',
            arguments: { tick: 'TEST' }
          }
        });

        expect(mockApiClient.searchTokens).toHaveBeenCalledWith({
          query: 'TEST',
          page: 1,
          page_size: 1
        });
        expect(result.content[0].text).toContain('Token: TEST');
      });

      it('should execute search_tokens tool', async () => {
        const mockTokens = [createMockToken(), createMockToken({ tick: 'OTHER' })];
        const searchTokensMock = vi.mocked(mockApiClient.searchTokens);
        searchTokensMock.mockResolvedValueOnce(mockTokens);

        // Use the handler from beforeEach
        const result = await callToolHandler({
          params: {
            name: 'search_tokens',
            arguments: { min_holders: 100 }
          }
        });

        expect(mockApiClient.searchTokens).toHaveBeenCalledWith({
          sort_by: 'deploy_timestamp',
          sort_order: 'DESC',
          page: 1,
          page_size: 20
        });
        expect(result.content[0].text).toContain('Found 2 tokens');
      });
    });

    describe('Error Handling', () => {
      it('should handle tool not found errors', async () => {
        // Use the handler from beforeEach
        const result = await callToolHandler({
          params: {
            name: 'non_existent_tool',
            arguments: {}
          }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Tool not found: non_existent_tool');
      });

      it('should handle validation errors', async () => {
        // Use the handler from beforeEach
        const result = await callToolHandler({
          params: {
            name: 'get_stamp',
            arguments: { stamp_id: -1 } // Invalid negative ID
          }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Validation failed');
      });

      it('should handle API errors', async () => {
        const getStampMock = vi.mocked(mockApiClient.getStamp);
        getStampMock.mockRejectedValueOnce(new Error('API temporarily unavailable'));

        // Use the handler from beforeEach
        const result = await callToolHandler({
          params: {
            name: 'get_stamp',
            arguments: { stamp_id: 12345 }
          }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('API temporarily unavailable');
      });

      it('should handle missing required parameters', async () => {
        // Use the handler from beforeEach
        const result = await callToolHandler({
          params: {
            name: 'get_stamp',
            arguments: {} // Missing stamp_id
          }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Validation failed');
      });
    });
  });

  describe('End-to-End Workflows', () => {
    it('should support stamp discovery workflow', async () => {
      // Use the handler from beforeEach

      // Step 1: Get recent stamps
      const recentStamps = [
        createMockStamp({ stamp: 12345 }),
        createMockStamp({ stamp: 12346 }),
      ];
      const searchStampsMock = vi.mocked(mockApiClient.searchStamps);
      searchStampsMock.mockResolvedValueOnce(recentStamps);

      await callToolHandler({
        params: { name: 'get_recent_stamps', arguments: { limit: 2 } }
      });

      // Step 2: Search for more stamps in the collection
      const collectionStamps = [
        createMockStamp({ stamp: 12340 }),
        createMockStamp({ stamp: 12341 }),
      ];
      searchStampsMock.mockResolvedValueOnce(collectionStamps);

      await callToolHandler({
        params: { 
          name: 'search_stamps', 
          arguments: { collection_id: 'popular-collection', limit: 10 } 
        }
      });

      // Step 3: Get collection details
      const collectionInfo = [createMockCollection({ collection_id: 'popular-collection' })];
      const searchCollectionsMock = vi.mocked(mockApiClient.searchCollections);
      searchCollectionsMock.mockResolvedValueOnce(collectionInfo);

      await callToolHandler({
        params: { 
          name: 'get_collection', 
          arguments: { collection_id: 'popular-collection' } 
        }
      });

      // Verify all API calls were made correctly
      expect(mockApiClient.searchStamps).toHaveBeenCalledWith({
        sort_order: 'DESC',
        page: 1,
        page_size: 2,
        is_cursed: undefined
      });
      expect(mockApiClient.searchStamps).toHaveBeenCalledWith({
        collection_id: 'popular-collection',
        sort_order: 'DESC',
        page: 1,
        page_size: 20
      });
      expect(mockApiClient.searchCollections).toHaveBeenCalledWith({
        query: 'popular-collection',
        page: 1,
        page_size: 1
      });
    });

    it('should support token research workflow', async () => {
      // Use the handler from beforeEach

      // Step 1: Search for tokens with high holder count
      const popularTokens = [
        createMockToken({ tick: 'UNCOMMON' }),
        createMockToken({ tick: 'RARE' }),
      ];
      const searchTokensMock = vi.mocked(mockApiClient.searchTokens);
      searchTokensMock.mockResolvedValueOnce(popularTokens);

      await callToolHandler({
        params: { 
          name: 'search_tokens', 
          arguments: { min_holders: 1000, limit: 10 } 
        }
      });

      // Step 2: Get detailed info for specific token
      const tokenInfo = [createMockToken({ tick: 'UNCOMMON' })];
      searchTokensMock.mockResolvedValueOnce(tokenInfo);

      await callToolHandler({
        params: { 
          name: 'get_token_info', 
          arguments: { tick: 'UNCOMMON' } 
        }
      });

      // Verify API calls
      expect(mockApiClient.searchTokens).toHaveBeenCalledWith({
        sort_by: 'deploy_timestamp',
        sort_order: 'DESC',
        page: 1,
        page_size: 20
      });
      expect(mockApiClient.searchTokens).toHaveBeenCalledWith({
        query: 'UNCOMMON',
        page: 1,
        page_size: 1
      });
    });
  });
});