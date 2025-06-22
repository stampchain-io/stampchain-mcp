/**
 * Type definitions for Stampchain API responses
 */

// Stamp related types (aligned exactly with Stampchain API StampRow schema)
export interface Stamp {
  stamp: number | null;
  block_index: number;
  cpid: string;
  creator: string;
  creator_name: string | null;
  divisible: number;
  keyburn: number | null;
  locked: number;
  stamp_url: string;
  stamp_mimetype: string;
  supply: number | null;
  tx_hash: string;
  tx_index: number;
  ident: 'STAMP' | 'SRC-20' | 'SRC-721';
  stamp_hash: string;
  file_hash: string;
  stamp_base64: string;
  floorPrice: number | null;
  floorPriceUSD: number | null;
  marketCapUSD: number | null;
}

// Individual stamp response
export interface StampResponse {
  last_block: number;
  data: {
    stamp: Stamp;
  };
}

// List response
export interface StampListResponse {
  data: Stamp[];
  last_block: number;
  page: number;
  limit: number;
  totalPages: number;
  total: number;
}

// Collection related types (aligned exactly with Stampchain API Collection schema)
export interface CollectionResponse {
  collection_id: string;
  collection_name: string;
  collection_description: string;
  creators: string[];
  stamp_count: number;
  total_editions: number;
  stamps: number[];
}

export interface CollectionListResponse {
  data: CollectionResponse[];
  last_block: number;
  page: number;
  limit: number;
  totalPages: number;
  total: number;
}

// Token related types (aligned with Stampchain API Src20Detail)
export interface TokenResponse {
  tx_hash: string;
  block_index: number;
  p: string; // protocol
  op: string; // operation
  tick: string;
  creator: string;
  amt: number | null;
  deci: number;
  lim: string;
  max: string;
  destination: string;
  block_time: string; // date-time string
  creator_name: string | null;
  destination_name: string | null;
  // Note: Additional fields like deployer, holders, etc. would need separate API calls
}

export interface TokenListResponse {
  data: TokenResponse[];
  last_block: number;
  page: number;
  limit: number;
  totalPages: number;
  total: number;
}

// Block related types
export interface BlockResponse {
  block_index: number;
  block_hash: string;
  block_time: string;
  stamps: StampResponse[];
  stamp_count: number;
}

// Balance related types
export interface BalanceResponse {
  address: string;
  stamps: StampResponse[];
  stamp_count: number;
  collections: string[];
}

// API Error response
export interface APIErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

// Query parameters
export interface StampQueryParams {
  query?: string;
  creator?: string;
  collection_id?: string;
  cpid?: string;
  is_btc_stamp?: boolean;
  is_cursed?: boolean;
  sort_order?: 'ASC' | 'DESC';
  page?: number;
  page_size?: number;
  limit?: number;
}

export interface CollectionQueryParams {
  query?: string;
  creator?: string;
  sort_by?: 'created_at' | 'stamp_count' | 'name';
  sort_order?: 'ASC' | 'DESC';
  page?: number;
  page_size?: number;
}

export interface TokenQueryParams {
  query?: string;
  deployer?: string;
  sort_by?: 'deploy_timestamp' | 'holders' | 'percent_minted';
  sort_order?: 'ASC' | 'DESC';
  page?: number;
  page_size?: number;
}
