/**
 * Type definitions for Stampchain API responses
 */

// Market data types for v2.3 (matches actual API response)
export interface StampMarketData {
  cpid: string;
  floorPriceBTC: number | null;
  recentSalePriceBTC: number | null;
  openDispensersCount: number;
  closedDispensersCount: number;
  totalDispensersCount: number;
  holderCount: number;
  uniqueHolderCount: number;
  topHolderPercentage: number;
  holderDistributionScore: number;
  volume24hBTC: number;
  volume7dBTC: number;
  volume30dBTC: number;
  totalVolumeBTC: number;
  priceSource: string;
  volumeSources: Record<string, number>;
  dataQualityScore: number;
  confidenceLevel: number;
  lastUpdated: string; // ISO datetime string
  lastPriceUpdate: string | null; // ISO datetime string
  updateFrequencyMinutes: number;
  lastSaleTxHash: string | null;
  lastSaleBuyerAddress: string | null;
  lastSaleDispenserAddress: string | null;
  lastSaleBtcAmount: number | null;
  lastSaleDispenserTxHash: string | null;
  lastSaleBlockIndex: number | null;
  activityLevel: 'HOT' | 'WARM' | 'COOL' | 'DORMANT' | 'COLD';
  lastActivityTime: number | null; // Unix timestamp
  floorPriceUSD: number | null;
  recentSalePriceUSD: number | null;
  volume24hUSD: number | null;
  volume7dUSD: number | null;
  volume30dUSD: number | null;
}

// Dispenser info types for v2.3 (matches actual API response)
export interface DispenserInfo {
  openCount: number;
  closedCount: number;
  totalCount: number;
}

// Cache status types for v2.3
export type CacheStatus = 'fresh' | 'stale' | 'expired';

// Stamp list metadata for v2.3
export interface StampListMetadata {
  btcPrice: number;
  cacheStatus: CacheStatus;
  source: string;
}

// Enhanced transaction details for recent sales
export interface EnhancedTransactionDetails {
  buyer_address: string;
  dispenser_address: string | null;
  time_ago: string; // e.g., '2h ago', '5d ago'
  btc_amount_satoshis: number;
  dispenser_tx_hash: string | null;
  btcPriceUSD: number | null;
}

// Recent sales response types
export interface RecentSale {
  tx_hash: string;
  block_index: number;
  stamp_id: number;
  price_btc: number;
  price_usd: number | null;
  timestamp: number;
  // Enhanced fields in v2.3
  buyer_address?: string;
  dispenser_address?: string | null;
  time_ago?: string;
  btc_amount_satoshis?: number;
  dispenser_tx_hash?: string | null;
  btcPriceUSD?: number | null;
}

export interface RecentSalesResponse {
  data: RecentSale[];
  metadata: {
    dayRange: number;
    lastUpdated: number;
    total: number;
  };
  last_block: number;
}

// Stamp related types (updated for v2.3 to match actual API)
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
  block_time: string; // ISO datetime string
  tx_hash: string;
  tx_index: number;
  ident: 'STAMP' | 'SRC-20' | 'SRC-721';
  stamp_hash: string;
  file_hash: string;
  stamp_base64?: string; // Optional in individual responses
  // Legacy fields (present in v2.3 for compatibility)
  floorPrice: number | string | null; // Can be "priceless" or a number
  floorPriceUSD: number | null;
  marketCapUSD: number | null;
  // v2.3: Market data object
  marketData?: StampMarketData;
  // v2.3: Additional fields
  cacheStatus?: CacheStatus;
  dispenserInfo?: DispenserInfo;
}

// Individual stamp response
export interface StampResponse {
  last_block: number;
  data: {
    stamp: Stamp;
  };
}

// List response (updated for v2.3)
export interface StampListResponse {
  data: Stamp[];
  last_block: number;
  metadata?: StampListMetadata;
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
  metadata?: StampListMetadata; // v2.3: Optional metadata
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
  metadata?: StampListMetadata; // v2.3: Optional metadata
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

// Query parameters (updated for v2.3)
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
  // v2.3: New date filtering parameters
  from_timestamp?: number;
  to_timestamp?: number;
  // v2.3: Market data filtering
  min_floor_price?: number;
  max_floor_price?: number;
  activity_level?: 'HOT' | 'WARM' | 'COOL' | 'DORMANT' | 'COLD';
  include_market_data?: boolean;
  include_dispenser_info?: boolean;
}

export interface CollectionQueryParams {
  query?: string;
  creator?: string;
  sort_by?: 'created_at' | 'stamp_count' | 'name';
  sort_order?: 'ASC' | 'DESC';
  page?: number;
  page_size?: number;
  // v2.3: Enhanced filtering
  from_timestamp?: number;
  to_timestamp?: number;
  min_stamp_count?: number;
  max_stamp_count?: number;
}

export interface TokenQueryParams {
  query?: string;
  deployer?: string;
  sort_by?: 'deploy_timestamp' | 'holders' | 'percent_minted';
  sort_order?: 'ASC' | 'DESC';
  page?: number;
  page_size?: number;
  // v2.3: Enhanced filtering
  from_timestamp?: number;
  to_timestamp?: number;
  min_holders?: number;
  max_holders?: number;
}

// v2.3: New query parameters for recent sales
export interface RecentSalesQueryParams {
  stamp_id?: number;
  dayRange?: number; // Default: 30
  fullDetails?: boolean; // Enable enhanced transaction information
  page?: number;
  page_size?: number;
  sort_order?: 'ASC' | 'DESC';
}

// v2.3: Market data query parameters
export interface MarketDataQueryParams {
  stamp_id?: number;
  activity_level?: 'HOT' | 'WARM' | 'COOL' | 'DORMANT' | 'COLD';
  min_floor_price?: number;
  max_floor_price?: number;
  include_volume_data?: boolean;
  page?: number;
  page_size?: number;
}
