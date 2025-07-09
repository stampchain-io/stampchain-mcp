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
import type { Stamp, RecentSalesResponse, StampMarketData } from '../api/types.js';
import {
  GetStampParamsSchema,
  SearchStampsParamsSchema,
  GetRecentStampsParamsSchema,
  GetRecentSalesParamsSchema,
  GetMarketDataParamsSchema,
  GetStampMarketDataParamsSchema,
  type GetStampParams,
  type SearchStampsParams,
  type GetRecentStampsParams,
  type GetRecentSalesParams,
  type GetMarketDataParams,
  type GetStampMarketDataParams,
} from '../schemas/stamps.js';
import { formatStamp, formatStampList, stampToJSON } from '../utils/formatters.js';
import { parseStampId } from '../utils/validators.js';

/**
 * Tool for retrieving detailed information about a specific Bitcoin stamp
 */
export class GetStampTool extends BaseTool<z.input<typeof GetStampParamsSchema>, GetStampParams> {
  public readonly name = 'get_stamp';

  public readonly description =
    'Retrieve detailed information about a specific Bitcoin stamp by its ID';

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
        throw new ToolExecutionError(`Stamp with ID ${stampId} not found`, this.name, { stampId });
      }

      // Format the response
      const formattedStamp = formatStamp(stamp, {
        includeBase64: validatedParams.include_base64,
      });

      // Return both formatted text and JSON data
      return multiResponse({ type: 'text', text: formattedStamp }, stampToJSON(stamp));
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
        throw new ToolExecutionError(error.message, this.name, error);
      }

      throw new ToolExecutionError('Failed to retrieve stamp information', this.name, error);
    }
  }
}

/**
 * Tool for searching stamps with various filtering criteria
 */
export class SearchStampsTool extends BaseTool<
  z.input<typeof SearchStampsParamsSchema>,
  SearchStampsParams
> {
  public readonly name = 'search_stamps';

  public readonly description =
    'Search for Bitcoin stamps with various filtering criteria including creator, collection, and stamp type';

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
      Object.keys(queryParams).forEach((key) => {
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
        throw new ToolExecutionError(error.message, this.name, error);
      }

      throw new ToolExecutionError('Failed to search stamps', this.name, error);
    }
  }
}

/**
 * Tool for retrieving recently created stamps
 */
export class GetRecentStampsTool extends BaseTool<
  z.input<typeof GetRecentStampsParamsSchema>,
  GetRecentStampsParams
> {
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
        default: 20,
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

  public async execute(
    params: GetRecentStampsParams,
    context?: ToolContext
  ): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing get_recent_stamps tool', { params });

      // Validate parameters
      const validatedParams = this.validateParams(params);

      // Get recent stamps by searching with sort order DESC
      const queryParams = {
        sort_order: 'DESC' as const,
        page: 1,
        page_size: validatedParams.limit,
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
        throw new ToolExecutionError(error.message, this.name, error);
      }

      throw new ToolExecutionError('Failed to retrieve recent stamps', this.name, error);
    }
  }
}

/**
 * Tool for retrieving recent sales data (v2.3 feature)
 */
export class GetRecentSalesTool extends BaseTool<
  z.input<typeof GetRecentSalesParamsSchema>,
  GetRecentSalesParams
> {
  public readonly name = 'get_recent_sales';

  public readonly description =
    'Retrieve recent stamp sales with enhanced transaction details (v2.3 feature)';

  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      stamp_id: {
        type: 'number',
        description: 'Filter by specific stamp ID',
      },
      dayRange: {
        type: 'number',
        description: 'Number of days to look back for sales',
        minimum: 1,
        maximum: 365,
        default: 30,
      },
      fullDetails: {
        type: 'boolean',
        description: 'Enable enhanced transaction information',
        default: false,
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
      sort_order: {
        type: 'string',
        enum: ['ASC', 'DESC'],
        description: 'Sort order by timestamp',
        default: 'DESC',
      },
    },
    required: [],
  };

  public readonly schema = GetRecentSalesParamsSchema;

  public readonly metadata = {
    version: '1.0.0',
    tags: ['stamps', 'sales', 'market', 'v2.3'],
    requiresNetwork: true,
    apiDependencies: ['stampchain'],
  };

  private apiClient: StampchainClient;

  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient || new StampchainClient();
  }

  public async execute(params: GetRecentSalesParams, context?: ToolContext): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing get_recent_sales tool', { params });

      // Validate parameters
      const validatedParams = this.validateParams(params);

      // Use API client from context if available, otherwise use instance client
      const client = context?.apiClient || this.apiClient;

      // Check if v2.3 features are available
      const features = client.getFeatureAvailability();
      if (!features.recentSales) {
        return textResponse(
          'Recent sales data is not available in the current API version. Please upgrade to v2.3 or later.'
        );
      }

      // Get recent sales data
      const salesData: RecentSalesResponse = await client.getRecentSales(validatedParams);

      if (!salesData.data || salesData.data.length === 0) {
        return textResponse('No recent sales found for the specified criteria');
      }

      // Format the response
      const lines = [
        `Recent Sales (${salesData.data.length} results, ${validatedParams.dayRange} days):`,
      ];
      lines.push('---');

      salesData.data.forEach((sale, index) => {
        lines.push(`${index + 1}. Stamp #${sale.stamp_id}`);
        lines.push(`   Transaction: ${sale.tx_hash}`);
        lines.push(`   Block: ${sale.block_index}`);
        lines.push(`   Price: ${sale.price_btc} BTC`);
        if (sale.price_usd) {
          lines.push(`   Price USD: $${sale.price_usd.toFixed(2)}`);
        }
        if (sale.buyer_address) {
          lines.push(`   Buyer: ${sale.buyer_address}`);
        }
        if (sale.time_ago) {
          lines.push(`   Time: ${sale.time_ago}`);
        }
        if (sale.dispenser_address) {
          lines.push(`   Dispenser: ${sale.dispenser_address}`);
        }
        lines.push('');
      });

      // Add metadata
      lines.push('Metadata:');
      lines.push(`- Day Range: ${salesData.metadata.dayRange} days`);
      lines.push(`- Last Updated: ${new Date(salesData.metadata.lastUpdated).toISOString()}`);
      lines.push(`- Total Results: ${salesData.metadata.total}`);
      lines.push(`- Last Block: ${salesData.last_block}`);

      return textResponse(lines.join('\n'));
    } catch (error) {
      context?.logger?.error('Error executing get_recent_sales tool', { error });

      if (error instanceof ValidationError) {
        throw error;
      }

      if (error instanceof ToolExecutionError) {
        throw error;
      }

      // Pass through the original error message for API errors
      if (error instanceof Error) {
        throw new ToolExecutionError(error.message, this.name, error);
      }

      throw new ToolExecutionError('Failed to retrieve recent sales data', this.name, error);
    }
  }
}

/**
 * Tool for retrieving market data for stamps (v2.3 feature)
 */
export class GetMarketDataTool extends BaseTool<
  z.input<typeof GetMarketDataParamsSchema>,
  GetMarketDataParams
> {
  public readonly name = 'get_market_data';

  public readonly description =
    'Retrieve market data for stamps with trading activity indicators (v2.3 feature)';

  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      stamp_id: {
        type: 'number',
        description: 'Filter by specific stamp ID',
      },
      activity_level: {
        type: 'string',
        enum: ['HOT', 'WARM', 'COOL', 'DORMANT', 'COLD'],
        description: 'Filter by trading activity level',
      },
      min_floor_price: {
        type: 'number',
        description: 'Minimum floor price in BTC',
        minimum: 0,
      },
      max_floor_price: {
        type: 'number',
        description: 'Maximum floor price in BTC',
        minimum: 0,
      },
      include_volume_data: {
        type: 'boolean',
        description: 'Include volume data in response',
        default: true,
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

  public readonly schema = GetMarketDataParamsSchema;

  public readonly metadata = {
    version: '1.0.0',
    tags: ['stamps', 'market', 'trading', 'v2.3'],
    requiresNetwork: true,
    apiDependencies: ['stampchain'],
  };

  private apiClient: StampchainClient;

  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient || new StampchainClient();
  }

  public async execute(params: GetMarketDataParams, context?: ToolContext): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing get_market_data tool', { params });

      // Validate parameters
      const validatedParams = this.validateParams(params);

      // Use API client from context if available, otherwise use instance client
      const client = context?.apiClient || this.apiClient;

      // Check if v2.3 features are available
      const features = client.getFeatureAvailability();
      if (!features.marketData) {
        return textResponse(
          'Market data is not available in the current API version. Please upgrade to v2.3 or later.'
        );
      }

      // Get market data
      const marketData = await client.getMarketData(validatedParams);

      if (!marketData.data || marketData.data.length === 0) {
        return textResponse('No market data found for the specified criteria');
      }

      // Format the response
      const lines = [`Market Data (${marketData.data.length} results):`];
      lines.push('---');

      marketData.data.forEach((data: StampMarketData, index: number) => {
        lines.push(`${index + 1}. Market Data Entry`);
        lines.push(`   Floor Price: ${data.floorPriceBTC || 'N/A'} BTC`);
        if (data.floorPriceUSD) {
          lines.push(`   Floor Price USD: $${data.floorPriceUSD.toFixed(2)}`);
        }
        // Note: marketCapUSD not available in v2.3 marketData object
        lines.push(`   Activity Level: ${data.activityLevel}`);
        if (data.lastActivityTime) {
          lines.push(`   Last Activity: ${new Date(data.lastActivityTime * 1000).toISOString()}`);
        }
        if (data.volume24hBTC) {
          lines.push(`   24h Volume: ${data.volume24hBTC} BTC`);
        }
        if (data.lastSaleTxHash) {
          lines.push(`   Last Sale TX: ${data.lastSaleTxHash}`);
        }
        if (data.lastSaleBuyerAddress) {
          lines.push(`   Last Buyer: ${data.lastSaleBuyerAddress}`);
        }
        lines.push('');
      });

      // Add metadata
      lines.push('Metadata:');
      lines.push(`- Total Results: ${marketData.total}`);
      lines.push(`- Page: ${marketData.page}`);
      lines.push(`- Page Size: ${marketData.limit}`);
      lines.push(`- Last Block: ${marketData.last_block}`);

      return textResponse(lines.join('\n'));
    } catch (error) {
      context?.logger?.error('Error executing get_market_data tool', { error });

      if (error instanceof ValidationError) {
        throw error;
      }

      if (error instanceof ToolExecutionError) {
        throw error;
      }

      // Pass through the original error message for API errors
      if (error instanceof Error) {
        throw new ToolExecutionError(error.message, this.name, error);
      }

      throw new ToolExecutionError('Failed to retrieve market data', this.name, error);
    }
  }
}

/**
 * Tool for retrieving market data for a specific stamp (v2.3 feature)
 */
export class GetStampMarketDataTool extends BaseTool<
  z.input<typeof GetStampMarketDataParamsSchema>,
  GetStampMarketDataParams
> {
  public readonly name = 'get_stamp_market_data';

  public readonly description = 'Retrieve detailed market data for a specific stamp (v2.3 feature)';

  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      stamp_id: {
        type: ['number', 'string'],
        description: 'The ID of the stamp to get market data for',
      },
    },
    required: ['stamp_id'],
  };

  public readonly schema = GetStampMarketDataParamsSchema;

  public readonly metadata = {
    version: '1.0.0',
    tags: ['stamps', 'market', 'trading', 'v2.3'],
    requiresNetwork: true,
    apiDependencies: ['stampchain'],
  };

  private apiClient: StampchainClient;

  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient || new StampchainClient();
  }

  public async execute(
    params: GetStampMarketDataParams,
    context?: ToolContext
  ): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing get_stamp_market_data tool', { params });

      // Validate parameters
      const validatedParams = this.validateParams(params);

      // Use API client from context if available, otherwise use instance client
      const client = context?.apiClient || this.apiClient;

      // Check if v2.3 features are available
      const features = client.getFeatureAvailability();
      if (!features.marketData) {
        return textResponse(
          'Market data is not available in the current API version. Please upgrade to v2.3 or later.'
        );
      }

      // Get stamp market data
      const marketData: StampMarketData = await client.getStampMarketData(validatedParams.stamp_id);

      if (!marketData) {
        return textResponse(`No market data found for stamp ${validatedParams.stamp_id}`);
      }

      // Format the response
      const lines = [`Market Data for Stamp #${validatedParams.stamp_id}:`];
      lines.push('---');

      lines.push(`Floor Price: ${marketData.floorPriceBTC || 'N/A'} BTC`);
      if (marketData.floorPriceUSD) {
        lines.push(`Floor Price USD: $${marketData.floorPriceUSD.toFixed(2)}`);
      }
      // Note: marketCapUSD not available in v2.3 marketData object

      lines.push(`Activity Level: ${marketData.activityLevel}`);
      if (marketData.lastActivityTime) {
        lines.push(`Last Activity: ${new Date(marketData.lastActivityTime * 1000).toISOString()}`);
      }

      if (marketData.volume24hBTC) {
        lines.push(`24h Volume: ${marketData.volume24hBTC} BTC`);
      }
      if (marketData.volume7dBTC) {
        lines.push(`7d Volume: ${marketData.volume7dBTC} BTC`);
      }
      if (marketData.volume30dBTC) {
        lines.push(`30d Volume: ${marketData.volume30dBTC} BTC`);
      }

      if (marketData.lastSaleTxHash) {
        lines.push('');
        lines.push('Last Sale Details:');
        lines.push(`- Transaction: ${marketData.lastSaleTxHash}`);
        if (marketData.lastSaleBuyerAddress) {
          lines.push(`- Buyer: ${marketData.lastSaleBuyerAddress}`);
        }
        if (marketData.lastSaleDispenserAddress) {
          lines.push(`- Dispenser: ${marketData.lastSaleDispenserAddress}`);
        }
        if (marketData.lastSaleBtcAmount) {
          lines.push(`- Amount: ${marketData.lastSaleBtcAmount} BTC`);
        }
        if (marketData.lastSaleBlockIndex) {
          lines.push(`- Block: ${marketData.lastSaleBlockIndex}`);
        }
      }

      return textResponse(lines.join('\n'));
    } catch (error) {
      context?.logger?.error('Error executing get_stamp_market_data tool', { error });

      if (error instanceof ValidationError) {
        throw error;
      }

      if (error instanceof ToolExecutionError) {
        throw error;
      }

      // Pass through the original error message for API errors
      if (error instanceof Error) {
        throw new ToolExecutionError(error.message, this.name, error);
      }

      throw new ToolExecutionError('Failed to retrieve stamp market data', this.name, error);
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
  get_recent_sales: GetRecentSalesTool,
  get_market_data: GetMarketDataTool,
  get_stamp_market_data: GetStampMarketDataTool,
};

/**
 * Factory function to create all stamp tool instances
 */
export function createStampTools(apiClient?: StampchainClient) {
  return {
    get_stamp: new GetStampTool(apiClient),
    search_stamps: new SearchStampsTool(apiClient),
    get_recent_stamps: new GetRecentStampsTool(apiClient),
    get_recent_sales: new GetRecentSalesTool(apiClient),
    get_market_data: new GetMarketDataTool(apiClient),
    get_stamp_market_data: new GetStampMarketDataTool(apiClient),
  };
}
