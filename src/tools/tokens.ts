/**
 * Token-related MCP tools implementation
 * These tools provide access to SRC-20 token information
 */

import type { z } from 'zod';
import type { Tool as MCPTool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse, ToolContext } from '../interfaces/tool.js';
import { textResponse, multiResponse, BaseTool } from '../interfaces/tool.js';
import { ToolExecutionError, ValidationError } from '../utils/errors.js';
import { StampchainClient } from '../api/stampchain-client.js';
import {
  GetTokenInfoParamsSchema,
  SearchTokensParamsSchema,
  type GetTokenInfoParams,
  type SearchTokensParams,
} from '../schemas/tokens.js';
import { formatToken, tokenToJSON, createTable } from '../utils/formatters.js';

/**
 * Tool for retrieving SRC-20 token information
 */
export class GetTokenInfoTool extends BaseTool<
  z.input<typeof GetTokenInfoParamsSchema>,
  GetTokenInfoParams
> {
  public readonly name = 'get_token_info';

  public readonly description =
    'Retrieve detailed information about a specific SRC-20 token by its ticker symbol';

  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      tick: {
        type: 'string',
        description: 'The ticker symbol of the SRC-20 token',
      },
      include_holders: {
        type: 'boolean',
        description: 'Whether to include holder statistics',
        default: false,
      },
      include_transfers: {
        type: 'boolean',
        description: 'Whether to include recent transfer data',
        default: false,
      },
    },
    required: ['tick'],
  };

  public readonly schema = GetTokenInfoParamsSchema;

  public readonly metadata = {
    version: '1.0.0',
    tags: ['tokens', 'src20', 'query'],
    requiresNetwork: true,
    apiDependencies: ['stampchain'],
  };

  private apiClient: StampchainClient;

  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient || new StampchainClient();
  }

  public async execute(params: GetTokenInfoParams, context?: ToolContext): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing get_token_info tool', { params });

      // Validate parameters
      const validatedParams = this.validateParams(params);

      // Search for the specific token
      const tokenResponse = await this.apiClient.searchTokens({
        query: validatedParams.tick,
        page: 1,
        page_size: 1,
      });

      if (!tokenResponse || !tokenResponse || tokenResponse.length === 0) {
        throw new ToolExecutionError(
          `Token with ticker ${validatedParams.tick} not found`,
          this.name,
          { tick: validatedParams.tick }
        );
      }

      const token = tokenResponse[0];

      // Verify exact match (case-insensitive)
      if (token.tick.toLowerCase() !== validatedParams.tick.toLowerCase()) {
        throw new ToolExecutionError(
          `Token with ticker ${validatedParams.tick} not found (found ${token.tick} instead)`,
          this.name,
          { requestedTick: validatedParams.tick, foundTick: token.tick }
        );
      }

      const contents = [];

      // Add formatted token info
      contents.push({ type: 'text' as const, text: formatToken(token) });

      // Add deployment information
      const stats = [
        '\nDeployment Information:',
        '---',
        `Block Index: ${token.block_index}`,
        `Block Time: ${new Date(token.block_time).toLocaleString()}`,
        `Transaction Hash: ${token.tx_hash}`,
      ];

      if (token.creator_name) {
        stats.push(`Creator: ${token.creator_name} (${token.creator})`);
      } else {
        stats.push(`Creator: ${token.creator}`);
      }

      contents.push({ type: 'text' as const, text: stats.join('\n') });

      // Note about additional data
      if (validatedParams.include_holders || validatedParams.include_transfers) {
        contents.push({
          type: 'text' as const,
          text: '\nNote: Detailed holder and transfer data requires additional API endpoints that may not be available in the current implementation.',
        });
      }

      // Add JSON representation
      contents.push(tokenToJSON(token));

      return multiResponse(...contents);
    } catch (error) {
      context?.logger?.error('Error executing get_token_info tool', { error });

      if (error instanceof ValidationError) {
        throw error;
      }

      if (error instanceof ToolExecutionError) {
        throw error;
      }

      throw new ToolExecutionError('Failed to retrieve token information', this.name, error);
    }
  }
}

/**
 * Tool for searching SRC-20 tokens
 */
export class SearchTokensTool extends BaseTool<
  z.input<typeof SearchTokensParamsSchema>,
  SearchTokensParams
> {
  public readonly name = 'search_tokens';

  public readonly description = 'Search for SRC-20 tokens with various filtering criteria';

  public readonly inputSchema: MCPTool['inputSchema'] = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for token ticker',
      },
      deployer: {
        type: 'string',
        description: 'Filter by deployer address',
      },
      min_holders: {
        type: 'number',
        description: 'Minimum number of holders',
        minimum: 0,
      },
      min_percent_minted: {
        type: 'number',
        description: 'Minimum percent minted',
        minimum: 0,
        maximum: 100,
      },
      sort_by: {
        type: 'string',
        enum: ['deploy_timestamp', 'holders', 'percent_minted'],
        description: 'Sort field (Note: only deploy_timestamp is supported by the API)',
        default: 'deploy_timestamp',
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

  public readonly schema = SearchTokensParamsSchema;

  public readonly metadata = {
    version: '1.0.0',
    tags: ['tokens', 'src20', 'search', 'query'],
    requiresNetwork: true,
    apiDependencies: ['stampchain'],
  };

  private apiClient: StampchainClient;

  constructor(apiClient?: StampchainClient) {
    super();
    this.apiClient = apiClient || new StampchainClient();
  }

  public async execute(params: SearchTokensParams, context?: ToolContext): Promise<ToolResponse> {
    try {
      context?.logger?.info('Executing search_tokens tool', { params });

      // Validate parameters
      const validatedParams = this.validateParams(params);

      // Build query parameters
      const queryParams = {
        query: validatedParams.query,
        deployer: validatedParams.deployer,
        sort_by: validatedParams.sort_by,
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

      // Search tokens
      const searchResponse = await this.apiClient.searchTokens(queryParams);

      if (!searchResponse || searchResponse.length === 0) {
        return textResponse('No tokens found matching the search criteria');
      }

      // Note: searchTokens returns TokenResponse[] directly
      const tokens = searchResponse;

      // Note: Client-side filtering for unsupported API fields
      let filteredTokens = tokens;
      if (
        validatedParams.min_holders !== undefined ||
        validatedParams.min_percent_minted !== undefined
      ) {
        // These fields are not available in the current API response
        // Filtering will be skipped and a note will be added to the output
        filteredTokens = tokens;
      }

      // Create summary
      const lines = [`Found ${filteredTokens.length} tokens`];
      lines.push('---');

      // Create table view
      const tokenTable = createTable(filteredTokens, [
        { key: 'tick', label: 'Ticker' },
        { key: 'max', label: 'Max Supply' },
        { key: 'lim', label: 'Mint Limit' },
        { key: 'deci', label: 'Decimals' },
        {
          key: 'creator',
          label: 'Creator',
          format: (v: unknown) => (typeof v === 'string' ? v.substring(0, 8) + '...' : String(v)),
        },
      ]);

      lines.push(tokenTable);

      // Add detailed view for top tokens
      lines.push('\n\nDetailed View (Top 5):');
      lines.push('---');

      filteredTokens.slice(0, 5).forEach((token, index) => {
        lines.push(`\n${index + 1}. ${token.tick}`);
        lines.push(`   Protocol: ${token.p} | Operation: ${token.op}`);
        lines.push(`   Max Supply: ${token.max}`);
        if (token.lim) {
          lines.push(`   Mint Limit: ${token.lim}`);
        }
        if (token.deci !== undefined) {
          lines.push(`   Decimals: ${token.deci}`);
        }
        lines.push(`   Creator: ${token.creator}`);
        lines.push(`   Block Index: ${token.block_index}`);
        lines.push(`   Block Time: ${new Date(token.block_time).toLocaleString()}`);
        if (token.creator_name) {
          lines.push(`   Creator Name: ${token.creator_name}`);
        }
        if (token.destination_name) {
          lines.push(`   Destination: ${token.destination_name}`);
        }
      });

      // Include metadata
      const metadata = {
        results_count: filteredTokens.length,
        query_params: queryParams,
        note: 'Pagination and holder/minting statistics are not available in the current API response',
        additional_filters: {
          min_holders: validatedParams.min_holders,
          min_percent_minted: validatedParams.min_percent_minted,
        },
      };

      // Add note about unsupported filters
      if (
        validatedParams.min_holders !== undefined ||
        validatedParams.min_percent_minted !== undefined
      ) {
        lines.push(
          '\n⚠️  Note: Holder and minting percentage filters are not supported by the current API and have been ignored.'
        );
      }

      return multiResponse(
        { type: 'text', text: lines.join('\n') },
        { type: 'text', text: `\n\nSearch Metadata:\n${JSON.stringify(metadata, null, 2)}` }
      );
    } catch (error) {
      context?.logger?.error('Error executing search_tokens tool', { error });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ToolExecutionError('Failed to search tokens', this.name, error);
    }
  }
}

/**
 * Export all token tools
 */
export const tokenTools = {
  get_token_info: GetTokenInfoTool,
  search_tokens: SearchTokensTool,
};

/**
 * Factory function to create all token tool instances
 */
export function createTokenTools(apiClient?: StampchainClient) {
  return {
    get_token_info: new GetTokenInfoTool(apiClient),
    search_tokens: new SearchTokensTool(apiClient),
  };
}
