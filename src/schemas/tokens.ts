/**
 * Zod schemas for token-related data validation
 * These schemas provide runtime validation and type inference for SRC-20 tokens
 */

import { z } from 'zod';

/**
 * Schema for SRC-20 token (aligned with Stampchain API SRC20Token model)
 */
export const SRC20TokenSchema = z.object({
  address: z.string(),
  tick: z.string(),
  amt: z.number(),
  block_time: z.string().datetime(),
  deploy_tx: z.string(),
});

/**
 * Schema for SRC-101 token (aligned with Stampchain API SRC101Token model)
 */
export const SRC101TokenSchema = z.object({
  address: z.string(),
  deploy_hash: z.string(),
  tokenid: z.string(),
  expire_timestamp: z.number(),
  address_btc: z.string(),
  txt_data: z.string(),
});

/**
 * Schema for SRC-20 token data (aligned with Stampchain API Src20Detail)
 */
export const TokenSchema = z.object({
  tx_hash: z.string(),
  block_index: z.number().int().nonnegative(),
  p: z.string().describe('Protocol identifier'),
  op: z.string().describe('Operation type'),
  tick: z.string(),
  creator: z.string(),
  amt: z.number().nullable(),
  deci: z.number().int().nonnegative(),
  lim: z.string(),
  max: z.string(),
  destination: z.string(),
  block_time: z.string().datetime(),
  creator_name: z.string().nullable(),
  destination_name: z.string().nullable(),
  // Extension fields for enhanced functionality
  deployer: z.string().optional(),
  deploy_timestamp: z.string().optional(),
  last_mint_timestamp: z.string().optional(),
  holders: z.number().int().nonnegative().optional(),
  transfers_24h: z.number().int().nonnegative().optional(),
  total_minted: z.string().optional(),
  percent_minted: z.number().min(0).max(100).optional(),
});

/**
 * Schema for token list response from API
 */
export const TokenListResponseSchema = z.object({
  data: z.array(TokenSchema),
  last_block: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

/**
 * Schema for SRC-20 token ticker validation
 */
export const TokenTickerSchema = z.string()
  .min(1, 'Token ticker cannot be empty')
  .max(10, 'Token ticker cannot exceed 10 characters')
  .regex(/^[A-Z0-9]+$/i, 'Token ticker must contain only alphanumeric characters');

/**
 * Schema for token query parameters with enhanced validation
 */
export const TokenQueryParamsSchema = z.object({
  query: TokenTickerSchema.optional(),
  deployer: z.string().min(26, 'Deployer address too short').max(62, 'Deployer address too long').optional(),
  sort_by: z.enum(['deploy_timestamp', 'holders', 'percent_minted']).optional(),
  sort_order: z.enum(['ASC', 'DESC']).optional(),
  page: z.number().int().positive().max(10000, 'Page number too large').optional(),
  page_size: z.number().int().positive().min(1, 'Page size must be at least 1').max(100, 'Page size cannot exceed 100').optional(),
});

/**
 * Schema for MCP tool parameters when getting token info
 */
export const GetTokenInfoParamsSchema = z.object({
  tick: TokenTickerSchema.describe('The ticker symbol of the SRC-20 token'),
  include_holders: z.boolean().optional().default(false).describe('Whether to include holder statistics'),
  include_transfers: z.boolean().optional().default(false).describe('Whether to include recent transfer data'),
});

/**
 * Schema for searching tokens
 */
export const SearchTokensParamsSchema = z.object({
  query: z.string().optional().describe('Search query for token ticker'),
  deployer: z.string().optional().describe('Filter by deployer address'),
  min_holders: z.number().int().nonnegative().optional().describe('Minimum number of holders'),
  min_percent_minted: z.number().min(0).max(100).optional().describe('Minimum percent minted'),
  sort_by: z.enum(['deploy_timestamp', 'holders', 'percent_minted']).optional().default('deploy_timestamp').describe('Sort field'),
  sort_order: z.enum(['ASC', 'DESC']).optional().default('DESC').describe('Sort order'),
  page: z.number().int().positive().optional().default(1).describe('Page number'),
  page_size: z.number().int().positive().max(100).optional().default(20).describe('Items per page'),
});

/**
 * Schema for token holder information
 */
export const TokenHolderSchema = z.object({
  address: z.string(),
  balance: z.string(),
  percentage: z.number().min(0).max(100),
  last_activity: z.string().optional(),
});

/**
 * Schema for token transfer
 */
export const TokenTransferSchema = z.object({
  from: z.string(),
  to: z.string(),
  amount: z.string(),
  tx_hash: z.string(),
  block_index: z.number().int().nonnegative(),
  timestamp: z.string(),
});

/**
 * Schema for detailed token info response
 */
export const TokenDetailedInfoSchema = z.object({
  token: TokenSchema,
  holders: z.array(TokenHolderSchema).optional(),
  recent_transfers: z.array(TokenTransferSchema).optional(),
  statistics: z.object({
    total_supply: z.string(),
    circulating_supply: z.string(),
    holder_count: z.number().int().nonnegative(),
    transfer_count_24h: z.number().int().nonnegative(),
    market_cap_estimate: z.string().optional(),
  }).optional(),
});

/**
 * Type exports
 */
export type SRC20Token = z.infer<typeof SRC20TokenSchema>;
export type SRC101Token = z.infer<typeof SRC101TokenSchema>;
export type Token = z.infer<typeof TokenSchema>;
export type TokenListResponse = z.infer<typeof TokenListResponseSchema>;
export type TokenQueryParams = z.infer<typeof TokenQueryParamsSchema>;
export type GetTokenInfoParams = z.infer<typeof GetTokenInfoParamsSchema>;
export type SearchTokensParams = z.infer<typeof SearchTokensParamsSchema>;
export type TokenHolder = z.infer<typeof TokenHolderSchema>;
export type TokenTransfer = z.infer<typeof TokenTransferSchema>;
export type TokenDetailedInfo = z.infer<typeof TokenDetailedInfoSchema>;

/**
 * Type guards
 */
export function isSRC20Token(data: unknown): data is SRC20Token {
  return SRC20TokenSchema.safeParse(data).success;
}

export function isSRC101Token(data: unknown): data is SRC101Token {
  return SRC101TokenSchema.safeParse(data).success;
}

export function isToken(data: unknown): data is Token {
  return TokenSchema.safeParse(data).success;
}

export function isTokenListResponse(data: unknown): data is TokenListResponse {
  return TokenListResponseSchema.safeParse(data).success;
}

export function isTokenDetailedInfo(data: unknown): data is TokenDetailedInfo {
  return TokenDetailedInfoSchema.safeParse(data).success;
}