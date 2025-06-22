/**
 * Zod schemas for collection-related data validation
 * These schemas provide runtime validation and type inference for collections
 */

import { z } from 'zod';

/**
 * Schema for social links
 */
export const SocialLinksSchema = z.object({
  twitter: z.string().url().optional(),
  discord: z.string().url().optional(),
}).optional();

/**
 * Schema for a single collection (aligned with Stampchain API Collection model)
 */
export const CollectionSchema = z.object({
  collection_id: z.string(),
  collection_name: z.string(),
  collection_description: z.string(),
  creators: z.array(z.string()),
  stamp_count: z.number().int().nonnegative(),
  total_editions: z.number().nonnegative(),
  stamps: z.array(z.number().int().nonnegative()),
});

/**
 * Schema for collection list response from API
 */
export const CollectionListResponseSchema = z.object({
  data: z.array(CollectionSchema),
  last_block: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

/**
 * Schema for collection query parameters
 */
export const CollectionQueryParamsSchema = z.object({
  query: z.string().optional(),
  creator: z.string().optional(),
  sort_by: z.enum(['created_at', 'stamp_count', 'name']).optional(),
  sort_order: z.enum(['ASC', 'DESC']).optional(),
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().max(100).optional(),
});

/**
 * Schema for MCP tool parameters when getting a collection
 */
export const GetCollectionParamsSchema = z.object({
  collection_id: z.string().describe('The ID of the collection to retrieve'),
  include_stamps: z.boolean().optional().default(false).describe('Whether to include stamps in the collection'),
  stamps_page: z.number().int().positive().optional().default(1).describe('Page number for stamps if included'),
  stamps_limit: z.number().int().positive().max(100).optional().default(20).describe('Number of stamps per page'),
});

/**
 * Schema for searching collections
 */
export const SearchCollectionsParamsSchema = z.object({
  query: z.string().optional().describe('Search query for collection name or description'),
  creator: z.string().optional().describe('Filter by creator address'),
  sort_by: z.enum(['created_at', 'stamp_count', 'name']).optional().default('created_at').describe('Sort field'),
  sort_order: z.enum(['ASC', 'DESC']).optional().default('DESC').describe('Sort order'),
  page: z.number().int().positive().optional().default(1).describe('Page number'),
  page_size: z.number().int().positive().max(100).optional().default(20).describe('Items per page'),
});

/**
 * Type exports
 */
export type SocialLinks = z.infer<typeof SocialLinksSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type CollectionListResponse = z.infer<typeof CollectionListResponseSchema>;
export type CollectionQueryParams = z.infer<typeof CollectionQueryParamsSchema>;
export type GetCollectionParams = z.infer<typeof GetCollectionParamsSchema>;
export type SearchCollectionsParams = z.infer<typeof SearchCollectionsParamsSchema>;

/**
 * Type guards
 */
export function isCollection(data: unknown): data is Collection {
  return CollectionSchema.safeParse(data).success;
}

export function isCollectionListResponse(data: unknown): data is CollectionListResponse {
  return CollectionListResponseSchema.safeParse(data).success;
}