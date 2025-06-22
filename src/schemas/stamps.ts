/**
 * Zod schemas for stamp-related data validation
 * These schemas provide runtime validation and type inference for stamps
 */

import { z } from 'zod';
import { BitcoinAddressSchema } from './common.js';

/**
 * Schema for a single stamp (aligned with Stampchain API StampRow model)
 */
export const StampSchema = z.object({
  stamp: z.number().int().nonnegative().nullable(),
  block_index: z.number().int().nonnegative(),
  cpid: z.string(),
  creator: z.string(),
  creator_name: z.string().nullable(),
  divisible: z.number().int().min(0).max(1),
  keyburn: z.number().nullable(),
  locked: z.number().int().min(0).max(1),
  stamp_url: z.string(),
  stamp_mimetype: z.string(),
  supply: z.number().nonnegative().nullable(),
  tx_hash: z.string(),
  tx_index: z.number().int().nonnegative(),
  ident: z.enum(['STAMP', 'SRC-20', 'SRC-721']),
  stamp_hash: z.string(),
  file_hash: z.string(),
  stamp_base64: z.string(),
  floorPrice: z.number().nullable(),
  floorPriceUSD: z.number().nullable(),
  marketCapUSD: z.number().nullable(),
});

/**
 * Schema for individual stamp response from API
 */
export const StampResponseSchema = z.object({
  last_block: z.number().int().nonnegative(),
  data: z.object({
    stamp: StampSchema,
  }),
});

/**
 * Schema for stamp list response from API
 */
export const StampListResponseSchema = z.object({
  data: z.array(StampSchema),
  last_block: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

// BitcoinAddressSchema is imported from common.js

/**
 * Schema for transaction hashes
 */
export const TxHashSchema = z.string()
  .length(64, 'Transaction hash must be 64 characters')
  .regex(/^[a-f0-9]{64}$/i, 'Invalid transaction hash format');

/**
 * Schema for stamp query parameters with enhanced validation
 */
export const StampQueryParamsSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty').max(100, 'Search query too long').optional(),
  creator: BitcoinAddressSchema.optional(),
  collection_id: z.string().min(1, 'Collection ID cannot be empty').max(50, 'Collection ID too long').optional(),
  cpid: z.string().length(40, 'CPID must be 40 characters').regex(/^[A-Z0-9]{40}$/, 'Invalid CPID format').optional(),
  is_btc_stamp: z.boolean().optional(),
  is_cursed: z.boolean().optional(),
  sort_order: z.enum(['ASC', 'DESC']).optional(),
  page: z.number().int().positive().max(10000, 'Page number too large').optional(),
  page_size: z.number().int().positive().min(1, 'Page size must be at least 1').max(100, 'Page size cannot exceed 100').optional(),
  limit: z.number().int().positive().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').optional(),
});

/**
 * Schema for MCP tool parameters when getting a single stamp
 */
export const GetStampParamsSchema = z.object({
  stamp_id: z.union([
    z.number().int().nonnegative(),
    z.string().regex(/^\d+$/).transform(val => parseInt(val, 10))
  ]).describe('The ID of the stamp to retrieve'),
  include_base64: z.boolean().optional().default(false).describe('Whether to include base64 image data'),
});

/**
 * Schema for MCP tool parameters when searching stamps
 */
export const SearchStampsParamsSchema = z.object({
  query: z.string().optional().describe('Search query string'),
  creator: z.string().optional().describe('Filter by creator address'),
  collection_id: z.string().optional().describe('Filter by collection ID'),
  cpid: z.string().optional().describe('Filter by CPID'),
  is_btc_stamp: z.boolean().optional().describe('Filter for BTC stamps only'),
  is_cursed: z.boolean().optional().describe('Filter for cursed stamps only'),
  sort_order: z.enum(['ASC', 'DESC']).optional().default('DESC').describe('Sort order by stamp ID'),
  page: z.number().int().positive().optional().default(1).describe('Page number'),
  page_size: z.number().int().positive().max(100).optional().default(20).describe('Items per page'),
});

/**
 * Schema for getting recent stamps
 */
export const GetRecentStampsParamsSchema = z.object({
  limit: z.number().int().positive().max(100).optional().default(10).describe('Number of recent stamps to retrieve'),
  include_cursed: z.boolean().optional().default(true).describe('Whether to include cursed stamps'),
});

/**
 * Type exports
 */
export type Stamp = z.infer<typeof StampSchema>;
export type StampResponse = z.infer<typeof StampResponseSchema>;
export type StampListResponse = z.infer<typeof StampListResponseSchema>;
export type StampQueryParams = z.infer<typeof StampQueryParamsSchema>;
export type GetStampParams = z.infer<typeof GetStampParamsSchema>;
export type SearchStampsParams = z.infer<typeof SearchStampsParamsSchema>;
export type GetRecentStampsParams = z.infer<typeof GetRecentStampsParamsSchema>;

/**
 * Type guards
 */
export function isStamp(data: unknown): data is Stamp {
  return StampSchema.safeParse(data).success;
}

export function isStampResponse(data: unknown): data is StampResponse {
  return StampResponseSchema.safeParse(data).success;
}

export function isStampListResponse(data: unknown): data is StampListResponse {
  return StampListResponseSchema.safeParse(data).success;
}