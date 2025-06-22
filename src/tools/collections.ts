/**
 * Collection-related MCP tools implementation
 * These tools provide access to Bitcoin stamp collection information
 */

import type { z } from 'zod';
import type { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse, ToolContext } from '../interfaces/tool.js';
import { textResponse, multiResponse, BaseTool } from '../interfaces/tool.js';
import { ToolExecutionError, ValidationError } from '../utils/errors.js';
import { StampchainClient } from '../api/stampchain-client.js';
import { 
  GetCollectionParamsSchema, 
  SearchCollectionsParamsSchema,
  type GetCollectionParams,
  type SearchCollectionsParams
} from '../schemas/collections.js';
import { 
  createTable
} from '../utils/formatters.js';
import type { CollectionResponse } from '../api/types.js';

/**
 * Tool for retrieving information about a specific stamp collection
 */
export class GetCollectionTool extends BaseTool<z.input<typeof GetCollectionParamsSchema>, GetCollectionParams> {
  public readonly name = 'get_collection';
  
  public readonly description = 'Retrieve detailed information about a specific stamp collection by its ID';
  
  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      collection_id: {
        type: 'string',
        description: 'The ID of the collection to retrieve',
      },
      include_stamps: {
        type: 'boolean',
        description: 'Whether to include stamps in the collection',
        default: false,
      },
      stamps_page: {
        type: 'number',
        description: 'Page number for stamps if included',
        minimum: 1,
        default: 1,
      },
      stamps_limit: {
        type: 'number',
        description: 'Number of stamps per page',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
    required: ['collection_id'],
  };
  
  public readonly schema = GetCollectionParamsSchema;
  
  public readonly metadata = {
    version: '1.0.0',
    tags: ['collections', 'query'],
    requiresNetwork: true,
    apiDependencies: ['stampchain'],
  };
  
  private apiClient: StampchainClient;
  
  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient || new StampchainClient();
  }
  
  public async execute(params: GetCollectionParams, context?: ToolContext): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing get_collection tool', { params });
      
      // Validate parameters
      const validatedParams = this.validateParams(params);
      
      // Since the API doesn't have a direct getCollection method,
      // we'll search for collections with the specific ID
      const collectionResponse = await this.apiClient.searchCollections({
        query: validatedParams.collection_id,
        page: 1,
        page_size: 1,
      });
      
      if (!collectionResponse || collectionResponse.length === 0) {
        throw new ToolExecutionError(
          `Collection with ID ${validatedParams.collection_id} not found`,
          this.name,
          { collectionId: validatedParams.collection_id }
        );
      }
      
      const collection = collectionResponse[0];
      const contents = [];
      
      // Add formatted collection info
      const collectionInfo = [
        `Collection: ${collection.collection_name}`,
        `ID: ${collection.collection_id}`,
        `Description: ${collection.collection_description}`,
        `Creators: ${collection.creators.join(', ')}`,
        `Stamps: ${collection.stamp_count}`,
        `Total Editions: ${collection.total_editions}`,
      ].join('\n');
      contents.push({ type: 'text' as const, text: collectionInfo });
      
      // If stamps are requested, fetch them
      if (validatedParams.include_stamps) {
        try {
          const stampsResponse = await this.apiClient.searchStamps({
            collection_id: validatedParams.collection_id,
            page: validatedParams.stamps_page,
            page_size: validatedParams.stamps_limit,
          });
          
          if (stampsResponse && stampsResponse.length > 0) {
            contents.push({ 
              type: 'text' as const, 
              text: `\n\nStamps in Collection (Page ${validatedParams.stamps_page}):\n` 
            });
            
            const stampTable = createTable(
              stampsResponse,
              [
                { key: 'stamp', label: 'ID' },
                { key: 'cpid', label: 'CPID' },
                { key: 'creator', label: 'Creator', format: (v: unknown) => typeof v === 'string' ? v.substring(0, 12) + '...' : String(v) },
                { key: 'supply', label: 'Supply' },
                { key: 'floorPrice', label: 'Floor Price', format: (v: unknown) => v ? `${String(v)} BTC` : 'N/A' },
              ]
            );
            
            contents.push({ type: 'text' as const, text: stampTable });
            contents.push({ 
              type: 'text' as const, 
              text: `\nTotal stamps in collection: ${stampsResponse.length}` 
            });
          }
        } catch (error) {
          context?.logger?.warn('Failed to fetch stamps for collection', { error });
          contents.push({ 
            type: 'text' as const, 
            text: '\n\nNote: Unable to fetch stamps for this collection' 
          });
        }
      }
      
      // Add JSON representation
      contents.push({ 
        type: 'text' as const, 
        text: JSON.stringify(collection, null, 2) 
      });
      
      return multiResponse(...contents);
      
    } catch (error) {
      context?.logger?.error('Error executing get_collection tool', { error });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      
      throw new ToolExecutionError(
        'Failed to retrieve collection information',
        this.name,
        error
      );
    }
  }
}

/**
 * Tool for searching collections
 */
export class SearchCollectionsTool extends BaseTool<z.input<typeof SearchCollectionsParamsSchema>, SearchCollectionsParams> {
  public readonly name = 'search_collections';
  
  public readonly description = 'Search for stamp collections with various filtering criteria';
  
  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for collection name or description',
      },
      creator: {
        type: 'string',
        description: 'Filter by creator address',
      },
      sort_by: {
        type: 'string',
        enum: ['created_at', 'stamp_count', 'name'],
        description: 'Sort field',
        default: 'created_at',
      },
      sort_order: {
        type: 'string',
        enum: ['ASC', 'DESC'],
        description: 'Sort order',
        default: 'DESC',
      },
      page: {
        type: 'number',
        description: 'Page number',
        minimum: 1,
        default: 1,
      },
      page_size: {
        type: 'number',
        description: 'Items per page',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
    required: [],
  };
  
  public readonly schema = SearchCollectionsParamsSchema;
  
  public readonly metadata = {
    version: '1.0.0',
    tags: ['collections', 'search', 'query'],
    requiresNetwork: true,
    apiDependencies: ['stampchain'],
  };
  
  private apiClient: StampchainClient;
  
  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient || new StampchainClient();
  }
  
  public async execute(params: SearchCollectionsParams, context?: ToolContext): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing search_collections tool', { params });
      
      // Validate parameters
      const validatedParams = this.validateParams(params);
      
      // Build query parameters
      const queryParams = {
        query: validatedParams.query,
        creator: validatedParams.creator,
        sort_by: validatedParams.sort_by,
        sort_order: validatedParams.sort_order,
        page: validatedParams.page,
        page_size: validatedParams.page_size,
      };
      
      // Remove undefined values
      Object.keys(queryParams).forEach(key => {
        if (queryParams[key as keyof typeof queryParams] === undefined) {
          delete queryParams[key as keyof typeof queryParams];
        }
      });
      
      // Search collections
      const searchResponse = await this.apiClient.searchCollections(queryParams);
      
      if (!searchResponse || searchResponse.length === 0) {
        return textResponse('No collections found matching the search criteria');
      }
      
      // Note: searchCollections returns CollectionResponse[] directly
      const collections = searchResponse;
      
      // Create summary
      const lines = [`Found ${collections.length} collections`];
      lines.push('---');
      
      // Create table view
      const collectionTable = createTable(
        collections,
        [
          { key: 'collection_name', label: 'Name' },
          { key: 'collection_id', label: 'ID', format: (v: unknown) => typeof v === 'string' ? v.substring(0, 8) + '...' : String(v) },
          { key: 'creators', label: 'Creators', format: (v: unknown) => Array.isArray(v) ? v.join(', ').substring(0, 20) + (v.join(', ').length > 20 ? '...' : '') : String(v) },
          { key: 'stamp_count', label: 'Stamps' },
          { key: 'total_editions', label: 'Editions' },
        ]
      );
      
      lines.push(collectionTable);
      
      // Add detailed view for each collection
      lines.push('\n\nDetailed View:');
      lines.push('---');
      
      collections.forEach((collection, index) => {
        lines.push(`\n${index + 1}. ${collection.collection_name}`);
        lines.push(`   ID: ${collection.collection_id}`);
        lines.push(`   Creators: ${collection.creators.join(', ')}`);
        lines.push(`   Stamps: ${collection.stamp_count}`);
        lines.push(`   Total Editions: ${collection.total_editions}`);
        if (collection.collection_description) {
          lines.push(`   Description: ${collection.collection_description.substring(0, 100)}${collection.collection_description.length > 100 ? '...' : ''}`);
        }
      });
      
      // Include metadata
      const metadata = {
        results_count: collections.length,
        query_params: queryParams,
      };
      
      return multiResponse(
        { type: 'text', text: lines.join('\n') },
        { type: 'text', text: `\n\nSearch Metadata:\n${JSON.stringify(metadata, null, 2)}` }
      );
      
    } catch (error) {
      context?.logger?.error('Error executing search_collections tool', { error });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ToolExecutionError(
        'Failed to search collections',
        this.name,
        error
      );
    }
  }
}

/**
 * Export all collection tools
 */
export const collectionTools = {
  get_collection: GetCollectionTool,
  search_collections: SearchCollectionsTool,
};

/**
 * Factory function to create all collection tool instances
 */
export function createCollectionTools(apiClient?: StampchainClient) {
  return {
    get_collection: new GetCollectionTool(apiClient),
    search_collections: new SearchCollectionsTool(apiClient),
  };
}