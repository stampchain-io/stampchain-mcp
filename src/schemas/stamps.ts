/**
 * Zod schemas for stamp-related data validation
 * These schemas provide runtime validation and type inference for stamps
 */

import { z } from 'zod';
import { BitcoinAddressSchema } from './common.js';

/**
 * Schema for market data object in v2.3 API responses
 */
export const MarketDataSchema = z.object({
  cpid: z.string(),
  floorPriceBTC: z.number().nullable(),
  recentSalePriceBTC: z.number().nullable(),
  openDispensersCount: z.number(),
  closedDispensersCount: z.number(),
  totalDispensersCount: z.number(),
  holderCount: z.number(),
  uniqueHolderCount: z.number(),
  topHolderPercentage: z.number(),
  holderDistributionScore: z.number(),
  volume24hBTC: z.number(),
  volume7dBTC: z.number(),
  volume30dBTC: z.number(),
  totalVolumeBTC: z.number(),
  priceSource: z.string(),
  volumeSources: z.record(z.number()),
  dataQualityScore: z.number(),
  confidenceLevel: z.number(),
  lastUpdated: z.string().datetime(),
  lastPriceUpdate: z.string().datetime().nullable(),
  updateFrequencyMinutes: z.number(),
  lastSaleTxHash: z.string().nullable(),
  lastSaleBuyerAddress: z.string().nullable(),
  lastSaleDispenserAddress: z.string().nullable(),
  lastSaleBtcAmount: z.number().nullable(),
  lastSaleDispenserTxHash: z.string().nullable(),
  lastSaleBlockIndex: z.number().nullable(),
  activityLevel: z.enum(['HOT', 'WARM', 'COOL', 'DORMANT', 'COLD']),
  lastActivityTime: z.number().nullable(),
  floorPriceUSD: z.number().nullable(),
  recentSalePriceUSD: z.number().nullable(),
  volume24hUSD: z.number().nullable(),
  volume7dUSD: z.number().nullable(),
  volume30dUSD: z.number().nullable(),
});

/**
 * Schema for dispenser info in v2.3 API responses
 */
export const DispenserInfoSchema = z.object({
  openCount: z.number(),
  closedCount: z.number(),
  totalCount: z.number(),
});

/**
 * Schema for a single stamp (aligned with actual Stampchain API v2.3 response)
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
  block_time: z.string().datetime(),
  tx_hash: z.string(),
  tx_index: z.number().int().nonnegative(),
  ident: z.enum(['STAMP', 'SRC-20', 'SRC-721']),
  stamp_hash: z.string(),
  file_hash: z.string(),
  stamp_base64: z.string().optional(),
  // Legacy fields (present in v2.3 for compatibility)
  floorPrice: z.union([z.number(), z.string()]).nullable(),
  floorPriceUSD: z.number().nullable(),
  marketCapUSD: z.number().nullable(),
  // v2.3 fields
  marketData: MarketDataSchema.optional(),
  cacheStatus: z.enum(['fresh', 'stale', 'expired']).optional(),
  dispenserInfo: DispenserInfoSchema.optional(),
});

/**
 * Schema for stamp list response metadata in v2.3
 */
export const StampListMetadataSchema = z.object({
  btcPrice: z.number(),
  cacheStatus: z.enum(['fresh', 'stale', 'expired']),
  source: z.string(),
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
 * Schema for stamp list response from API (v2.3)
 */
export const StampListResponseSchema = z.object({
  data: z.array(StampSchema),
  last_block: z.number().int().nonnegative(),
  metadata: StampListMetadataSchema.optional(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

// BitcoinAddressSchema is imported from common.js

/**
 * Schema for transaction hashes
 */
export const TxHashSchema = z
  .string()
  .length(64, 'Transaction hash must be 64 characters')
  .regex(/^[a-f0-9]{64}$/i, 'Invalid transaction hash format');

/**
 * Schema for stamp query parameters with enhanced validation
 */
export const StampQueryParamsSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query cannot be empty')
    .max(100, 'Search query too long')
    .optional(),
  creator: BitcoinAddressSchema.optional(),
  collection_id: z
    .string()
    .min(1, 'Collection ID cannot be empty')
    .max(50, 'Collection ID too long')
    .optional(),
  cpid: z
    .string()
    .length(40, 'CPID must be 40 characters')
    .regex(/^[A-Z0-9]{40}$/, 'Invalid CPID format')
    .optional(),
  is_btc_stamp: z.boolean().optional(),
  is_cursed: z.boolean().optional(),
  sort_order: z.enum(['ASC', 'DESC']).optional(),
  page: z.number().int().positive().max(10000, 'Page number too large').optional(),
  page_size: z
    .number()
    .int()
    .positive()
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size cannot exceed 100')
    .optional(),
  limit: z
    .number()
    .int()
    .positive()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional(),
});

/**
 * Schema for MCP tool parameters when getting a single stamp
 */
export const GetStampParamsSchema = z.object({
  stamp_id: z
    .union([z.number(), z.string()])
    .refine(
      (val) => {
        const num = typeof val === 'string' ? parseInt(val, 10) : val;
        return !isNaN(num) && num > 0;
      },
      {
        message: 'stamp_id must be a positive number',
      }
    )
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return num;
    }),
  include_base64: z.boolean().optional().default(false),
});

export type GetStampParams = z.infer<typeof GetStampParamsSchema>;

/**
 * Schema for MCP tool parameters when searching stamps
 */
export const SearchStampsParamsSchema = z.object({
  query: z.string().optional(),
  creator: z.string().optional(),
  collection_id: z.string().optional(),
  cpid: z.string().optional(),
  is_btc_stamp: z.boolean().optional(),
  is_cursed: z.boolean().optional(),
  sort_order: z.enum(['ASC', 'DESC']).optional().default('DESC'),
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(1).max(100).optional().default(20),
  limit: z.number().int().min(1).max(1000).optional(),
  // v2.3: New filtering parameters
  from_timestamp: z.number().int().positive().optional(),
  to_timestamp: z.number().int().positive().optional(),
  min_floor_price: z.number().positive().optional(),
  max_floor_price: z.number().positive().optional(),
  activity_level: z.enum(['HOT', 'WARM', 'COOL', 'DORMANT', 'COLD']).optional(),
  include_market_data: z.boolean().optional().default(false),
  include_dispenser_info: z.boolean().optional().default(false),
});

export type SearchStampsParams = z.infer<typeof SearchStampsParamsSchema>;

/**
 * Schema for getting recent stamps
 */
export const GetRecentStampsParamsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export type GetRecentStampsParams = z.infer<typeof GetRecentStampsParamsSchema>;

// v2.3: Recent sales parameters
export const GetRecentSalesParamsSchema = z.object({
  stamp_id: z.number().int().positive().optional(),
  dayRange: z.number().int().min(1).max(365).optional().default(30),
  fullDetails: z.boolean().optional().default(false),
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(1).max(100).optional().default(20),
  sort_order: z.enum(['ASC', 'DESC']).optional().default('DESC'),
});

export type GetRecentSalesParams = z.infer<typeof GetRecentSalesParamsSchema>;

// v2.3: Market data parameters
export const GetMarketDataParamsSchema = z.object({
  stamp_id: z.number().int().positive().optional(),
  activity_level: z.enum(['HOT', 'WARM', 'COOL', 'DORMANT', 'COLD']).optional(),
  min_floor_price: z.number().positive().optional(),
  max_floor_price: z.number().positive().optional(),
  include_volume_data: z.boolean().optional().default(true),
  page: z.number().int().min(1).optional().default(1),
  page_size: z.number().int().min(1).max(100).optional().default(20),
});

export type GetMarketDataParams = z.infer<typeof GetMarketDataParamsSchema>;

// v2.3: Get stamp market data parameters
export const GetStampMarketDataParamsSchema = z.object({
  stamp_id: z
    .union([z.number(), z.string()])
    .refine(
      (val) => {
        const num = typeof val === 'string' ? parseInt(val, 10) : val;
        return !isNaN(num) && num > 0;
      },
      {
        message: 'stamp_id must be a positive number',
      }
    )
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return num;
    }),
});

export type GetStampMarketDataParams = z.infer<typeof GetStampMarketDataParamsSchema>;

/**
 * Type exports
 */
export type Stamp = z.infer<typeof StampSchema>;
export type StampResponse = z.infer<typeof StampResponseSchema>;
export type StampListResponse = z.infer<typeof StampListResponseSchema>;
export type StampQueryParams = z.infer<typeof StampQueryParamsSchema>;

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
