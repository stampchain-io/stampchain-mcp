/**
 * Common Zod schemas and utilities used across the application
 * These schemas provide shared validation and type definitions
 */

import { z } from 'zod';

/**
 * Schema for API error responses
 */
export const APIErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number().int(),
  timestamp: z.string(),
});

/**
 * Schema for pagination metadata
 */
export const PaginationSchema = z.object({
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative(),
});

/**
 * Schema for block information
 */
export const BlockInfoSchema = z.object({
  block_index: z.number().int().nonnegative(),
  block_hash: z.string(),
  block_time: z.string(),
});

/**
 * Schema for address validation
 */
export const BitcoinAddressSchema = z
  .string()
  .regex(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/, 'Invalid Bitcoin address format');

/**
 * Schema for transaction hash validation
 */
export const TransactionHashSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, 'Invalid transaction hash format');

/**
 * Schema for CPID validation
 */
export const CPIDSchema = z.string().regex(/^[A-Za-z0-9]+$/, 'Invalid CPID format');

/**
 * Schema for timestamp validation (ISO 8601)
 */
export const TimestampSchema = z.string().datetime();

/**
 * Schema for common query parameters
 */
export const CommonQueryParamsSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  page_size: z.number().int().positive().max(100).optional().default(20),
  sort_order: z.enum(['ASC', 'DESC']).optional().default('DESC'),
});

/**
 * Schema for API response wrapper
 */
export const APIResponseWrapperSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema,
    error: APIErrorResponseSchema.optional(),
    metadata: z.record(z.unknown()).optional(),
  });

/**
 * Utility function to create a paginated response schema
 */
export const createPaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: PaginationSchema,
  });

/**
 * Schema for balance information
 */
export const BalanceInfoSchema = z.object({
  address: BitcoinAddressSchema,
  stamp_count: z.number().int().nonnegative(),
  collection_count: z.number().int().nonnegative(),
  token_count: z.number().int().nonnegative(),
  total_value_estimate: z.string().optional(),
});

/**
 * Schema for price information
 */
export const PriceInfoSchema = z.object({
  btc: z.number().nonnegative(),
  usd: z.number().nonnegative(),
  change_24h: z.number().optional(),
  last_updated: TimestampSchema,
});

/**
 * Type exports
 */
export type APIErrorResponse = z.infer<typeof APIErrorResponseSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type BlockInfo = z.infer<typeof BlockInfoSchema>;
export type BitcoinAddress = z.infer<typeof BitcoinAddressSchema>;
export type TransactionHash = z.infer<typeof TransactionHashSchema>;
export type CPID = z.infer<typeof CPIDSchema>;
export type Timestamp = z.infer<typeof TimestampSchema>;
export type CommonQueryParams = z.infer<typeof CommonQueryParamsSchema>;
export type BalanceInfo = z.infer<typeof BalanceInfoSchema>;
export type PriceInfo = z.infer<typeof PriceInfoSchema>;

/**
 * Type guards
 */
export function isAPIErrorResponse(data: unknown): data is APIErrorResponse {
  return APIErrorResponseSchema.safeParse(data).success;
}

export function isBitcoinAddress(data: unknown): data is BitcoinAddress {
  return BitcoinAddressSchema.safeParse(data).success;
}

export function isTransactionHash(data: unknown): data is TransactionHash {
  return TransactionHashSchema.safeParse(data).success;
}

/**
 * Validation helpers
 */
export function validateBitcoinAddress(address: string): BitcoinAddress {
  return BitcoinAddressSchema.parse(address);
}

export function validateTransactionHash(hash: string): TransactionHash {
  return TransactionHashSchema.parse(hash);
}

export function validateCPID(cpid: string): CPID {
  return CPIDSchema.parse(cpid);
}
