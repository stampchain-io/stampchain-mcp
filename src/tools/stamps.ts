/**
 * Stamp-related MCP tools implementation
 * These tools provide access to Bitcoin stamp information
 */

import type { z } from 'zod';
import type { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse, ToolContext } from '../interfaces/tool.js';
import { textResponse, multiResponse, BaseTool } from '../interfaces/tool.js';
import { ToolExecutionError, ValidationError } from '../utils/errors.js';
import { StampchainClient } from '../api/stampchain-client.js';
import type { Stamp } from '../api/types.js';
import { 
  GetStampParamsSchema, 
  SearchStampsParamsSchema,
  GetRecentStampsParamsSchema,
  type GetStampParams,
  type SearchStampsParams,
  type GetRecentStampsParams
} from '../schemas/stamps.js';
import { 
  formatStamp, 
  formatStampList,
  stampToJSON 
} from '../utils/formatters.js';
import { parseStampId } from '../utils/validators.js';

/**
 * Tool for retrieving detailed information about a specific Bitcoin stamp
 */
export class GetStampTool extends BaseTool<z.input<typeof GetStampParamsSchema>, GetStampParams> {
  public readonly name = 'get_stamp';
  
  public readonly description = 'Retrieve detailed information about a specific Bitcoin stamp by its ID';
  
  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      stamp_id: {
        type: ['number', 'string'],
        description: 'The ID of the stamp to retrieve',
      },
      include_base64: {
        type: 'boolean',
        description: 'Whether to include base64 image data',
        default: false,
      },
    },
    required: ['stamp_id'],
  };
  
  public readonly schema = GetStampParamsSchema;
  
  public readonly metadata = {
    version: '1.0.0',
    tags: ['stamps', 'query'],
    requiresNetwork: true,
    apiDependencies: ['stampchain'],
  };
  
  private apiClient: StampchainClient;
  
  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient || new StampchainClient();
  }
  
  public async execute(params: GetStampParams, context?: ToolContext): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing get_stamp tool', { params });
      
      // Validate parameters
      const validatedParams = this.validateParams(params);
      const stampId = parseStampId(validatedParams.stamp_id);
      
      // Use API client from context if available, otherwise use instance client
      const client = context?.apiClient || this.apiClient;
      
      // Fetch stamp data
      const stamp: Stamp = await client.getStamp(stampId);
      
      if (!stamp) {
        throw new ToolExecutionError(
          `Stamp with ID ${stampId} not found`,
          this.name,
          { stampId }
        );
      }
      
      // Format the response
      const formattedStamp = formatStamp(stamp, { 
        includeBase64: validatedParams.include_base64 
      });
      
      // Return both formatted text and JSON data
      return multiResponse(
        { type: 'text', text: formattedStamp },
        stampToJSON(stamp)
      );
      
    } catch (error) {
      context?.logger?.error('Error executing get_stamp tool', { error });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      
      // Pass through the original error message for API errors
      if (error instanceof Error) {
        throw new ToolExecutionError(
          error.message,
          this.name,
          error
        );
      }
      
      throw new ToolExecutionError(
        'Failed to retrieve stamp information',
        this.name,
        error
      );
    }
  }
}

/**
 * Tool for searching stamps with various filtering criteria
 */
export class SearchStampsTool extends BaseTool<z.input<typeof SearchStampsParamsSchema>, SearchStampsParams> {
  public readonly name = 'search_stamps';
  
  public readonly description = 'Search for Bitcoin stamps with various filtering criteria including creator, collection, and stamp type';
  
  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string',
      },
      creator: {
        type: 'string',
        description: 'Filter by creator address',
      },
      collection_id: {
        type: 'string',
        description: 'Filter by collection ID',
      },
      cpid: {
        type: 'string',
        description: 'Filter by CPID',
      },
      is_btc_stamp: {
        type: 'boolean',
        description: 'Filter for BTC stamps only',
      },
      is_cursed: {
        type: 'boolean',
        description: 'Filter for cursed stamps only',
      },
      sort_order: {
        type: 'string',
        enum: ['ASC', 'DESC'],
        description: 'Sort order by stamp ID',
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
  
  public readonly schema = SearchStampsParamsSchema;
  
  public readonly metadata = {
    version: '1.0.0',
    tags: ['stamps', 'search', 'query'],
    requiresNetwork: true,
    apiDependencies: ['stampchain'],
  };
  
  private apiClient: StampchainClient;
  
  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient || new StampchainClient();
  }
  
  public async execute(params: SearchStampsParams, context?: ToolContext): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing search_stamps tool', { params });
      
      // Validate parameters
      const validatedParams = this.validateParams(params);
      
      // Build query parameters
      const queryParams = {
        query: validatedParams.query,
        creator: validatedParams.creator,
        collection_id: validatedParams.collection_id,
        cpid: validatedParams.cpid,
        is_btc_stamp: validatedParams.is_btc_stamp,
        is_cursed: validatedParams.is_cursed,
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
      
      // Use API client from context if available, otherwise use instance client
      const client = context?.apiClient || this.apiClient;
      
      // Search stamps
      const stamps: Stamp[] = await client.searchStamps(queryParams);
      
      if (!stamps || stamps.length === 0) {
        return textResponse('No stamps found matching the search criteria');
      }
      
      // Since the API returns an array, we need to handle pagination info differently
      const total = stamps.length;
      const page = validatedParams.page || 1;
      const limit = validatedParams.page_size || 20;
      
      // Format the response
      const formattedList = formatStampList(stamps, total, page, limit);
      
      // Include metadata about the search
      const metadata = {
        total_results: total,
        current_page: page,
        page_size: limit,
        total_pages: Math.ceil(total / limit),
        query_params: queryParams,
      };
      
      return multiResponse(
        { type: 'text', text: formattedList },
        { type: 'text', text: `\nSearch Metadata:\n${JSON.stringify(metadata, null, 2)}` }
      );
      
    } catch (error) {
      context?.logger?.error('Error executing search_stamps tool', { error });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      
      // Pass through the original error message for API errors
      if (error instanceof Error) {
        throw new ToolExecutionError(
          error.message,
          this.name,
          error
        );
      }
      
      throw new ToolExecutionError(
        'Failed to search stamps',
        this.name,
        error
      );
    }
  }
}

/**
 * Tool for retrieving recently created stamps
 */
export class GetRecentStampsTool extends BaseTool<z.input<typeof GetRecentStampsParamsSchema>, GetRecentStampsParams> {
  public readonly name = 'get_recent_stamps';
  
  public readonly description = 'Retrieve the most recently created Bitcoin stamps';
  
  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Number of recent stamps to retrieve',
        minimum: 1,
        maximum: 100,
        default: 10,
      },
      include_cursed: {
        type: 'boolean',
        description: 'Whether to include cursed stamps',
        default: true,
      },
    },
    required: [],
  };
  
  public readonly schema = GetRecentStampsParamsSchema;
  
  public readonly metadata = {
    version: '1.0.0',
    tags: ['stamps', 'recent'],
    requiresNetwork: true,
    apiDependencies: ['stampchain'],
  };
  
  private apiClient: StampchainClient;
  
  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient || new StampchainClient();
  }
  
  public async execute(params: GetRecentStampsParams, context?: ToolContext): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing get_recent_stamps tool', { params });
      
      // Validate parameters
      const validatedParams = this.validateParams(params);
      
      // Get recent stamps by searching with sort order DESC
      const queryParams = {
        sort_order: 'DESC' as const,
        page: 1,
        page_size: validatedParams.limit,
        is_cursed: validatedParams.include_cursed ? undefined : false,
      };
      
      // Use API client from context if available, otherwise use instance client
      const client = context?.apiClient || this.apiClient;
      
      const stamps: Stamp[] = await client.searchStamps(queryParams);
      
      if (!stamps || stamps.length === 0) {
        return textResponse('No recent stamps found');
      }
      
      // Create a summary of recent stamps
      const lines = [`${stamps.length} Most Recent Stamps:`];
      lines.push('---');
      
      stamps.forEach((stamp, index) => {
        lines.push(`${index + 1}. Stamp #${stamp.stamp}`);
        lines.push(`   Block: ${stamp.block_index}`);
        lines.push(`   Creator: ${stamp.creator}`);
        lines.push(`   Type: ${stamp.ident}`);
        lines.push(`   CPID: ${stamp.cpid}`);
        if (stamp.floorPrice) {
          lines.push(`   Floor Price: ${stamp.floorPrice} BTC`);
        }
        lines.push('');
      });
      
      return textResponse(lines.join('\n'));
      
    } catch (error) {
      context?.logger?.error('Error executing get_recent_stamps tool', { error });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      if (error instanceof ToolExecutionError) {
        throw error;
      }
      
      // Pass through the original error message for API errors
      if (error instanceof Error) {
        throw new ToolExecutionError(
          error.message,
          this.name,
          error
        );
      }
      
      throw new ToolExecutionError(
        'Failed to retrieve recent stamps',
        this.name,
        error
      );
    }
  }
}

/**
 * Export all stamp tools
 */
export const stampTools = {
  get_stamp: GetStampTool,
  search_stamps: SearchStampsTool,
  get_recent_stamps: GetRecentStampsTool,
};

/**
 * Factory function to create all stamp tool instances
 */
export function createStampTools(apiClient?: StampchainClient) {
  return {
    get_stamp: new GetStampTool(apiClient),
    search_stamps: new SearchStampsTool(apiClient),
    get_recent_stamps: new GetRecentStampsTool(apiClient),
  };
}