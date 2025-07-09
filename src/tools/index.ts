/**
 * Central export point for all MCP tools
 * This file aggregates and exports all tool implementations
 */

import { StampchainClient } from '../api/stampchain-client.js';
import { createStampTools, stampTools } from './stamps.js';
import { createCollectionTools, collectionTools } from './collections.js';
import { createTokenTools, tokenTools } from './tokens.js';
import { createStampAnalysisTools, stampAnalysisTools } from './stamp-analysis.js';
import type { ITool } from '../interfaces/tool.js';

// Re-export individual tool classes
export * from './stamps.js';
export * from './collections.js';
export * from './tokens.js';
export * from './stamp-analysis.js';

// Export tool type collections
export { stampTools, collectionTools, tokenTools, stampAnalysisTools };

// Export registry
export * from './registry.js';

/**
 * Create all tool instances with a shared API client
 */
export function createAllTools(apiClient?: StampchainClient): Record<string, ITool> {
  const client = apiClient || new StampchainClient();

  const stamps = createStampTools(client);
  const collections = createCollectionTools(client);
  const tokens = createTokenTools(client);
  const analysis = createStampAnalysisTools(client);

  return {
    ...stamps,
    ...collections,
    ...tokens,
    ...analysis,
  };
}

/**
 * Get a list of all available tool names
 */
export function getAvailableToolNames(): string[] {
  return [
    // Stamp tools
    'get_stamp',
    'search_stamps',
    'get_recent_stamps',
    'get_recent_sales',
    'get_market_data',
    'get_stamp_market_data',

    // Collection tools
    'get_collection',
    'search_collections',

    // Token tools
    'get_token_info',
    'search_tokens',

    // Analysis tools
    'analyze_stamp_code',
    'get_stamp_dependencies',
    'analyze_stamp_patterns',
  ];
}

/**
 * Tool metadata for discovery
 */
export const toolMetadata = {
  stamps: {
    category: 'Bitcoin Stamps',
    description: 'Tools for querying and searching Bitcoin stamps',
    tools: [
      'get_stamp',
      'search_stamps',
      'get_recent_stamps',
      'get_recent_sales',
      'get_market_data',
      'get_stamp_market_data',
    ],
  },
  collections: {
    category: 'Stamp Collections',
    description: 'Tools for exploring stamp collections',
    tools: ['get_collection', 'search_collections'],
  },
  tokens: {
    category: 'SRC-20 Tokens',
    description: 'Tools for SRC-20 token information',
    tools: ['get_token_info', 'search_tokens'],
  },
  analysis: {
    category: 'Recursive Stamp Analysis',
    description: 'Tools for analyzing recursive stamp code structure and dependencies',
    tools: ['analyze_stamp_code', 'get_stamp_dependencies', 'analyze_stamp_patterns'],
  },
};
