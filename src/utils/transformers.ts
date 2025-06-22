/**
 * Data transformation utilities
 * These utilities help transform between different data formats
 */

import type { Stamp, Collection, Token } from '../schemas/index.js';
import type { StampResponse, CollectionResponse, TokenResponse } from '../api/types.js';

/**
 * Transform API stamp response to internal stamp type
 * (In this case they're the same, but this provides a layer of abstraction)
 */
export function transformStampResponse(response: StampResponse): Stamp {
  return response.data.stamp;
}

/**
 * Transform API collection response to internal collection type
 */
export function transformCollectionResponse(response: CollectionResponse): Collection {
  return response;
}

/**
 * Transform API token response to internal token type
 */
export function transformTokenResponse(response: TokenResponse): Token {
  return response;
}

/**
 * Group stamps by creator
 */
export function groupStampsByCreator(stamps: Stamp[]): Map<string, Stamp[]> {
  const grouped = new Map<string, Stamp[]>();
  
  for (const stamp of stamps) {
    const creator = stamp.creator;
    if (!grouped.has(creator)) {
      grouped.set(creator, []);
    }
    grouped.get(creator)!.push(stamp);
  }
  
  return grouped;
}

/**
 * Group stamps by collection
 */
export function groupStampsByCollection(stamps: Stamp[]): Map<string | null, Stamp[]> {
  const grouped = new Map<string | null, Stamp[]>();
  
  for (const stamp of stamps) {
    // Note: Individual stamps don't have collection_id in the API schema
    // Collections reference stamps by ID, not the other way around
    const collectionId = null;
    if (!grouped.has(collectionId)) {
      grouped.set(collectionId, []);
    }
    grouped.get(collectionId)!.push(stamp);
  }
  
  return grouped;
}

/**
 * Calculate statistics for a set of stamps
 */
export function calculateStampStats(stamps: Stamp[]) {
  if (stamps.length === 0) {
    return {
      count: 0,
      totalSupply: 0,
      averageSupply: 0,
      uniqueCreators: 0,
      uniqueCollections: 0,
      cursedCount: 0,
      btcStampCount: 0,
      lockedCount: 0,
      totalFloorValueBTC: 0,
      totalFloorValueUSD: 0,
    };
  }

  const creators = new Set<string>();
  const collections = new Set<string>();
  let totalSupply = 0;
  let cursedCount = 0;
  let btcStampCount = 0;
  let lockedCount = 0;
  let totalFloorValueBTC = 0;
  let totalFloorValueUSD = 0;

  for (const stamp of stamps) {
    creators.add(stamp.creator);
    // Note: Individual stamps don't have collection_id in API schema
    // Collection grouping would need to be done via separate collection API calls
    
    totalSupply += stamp.supply ?? 0;
    
    if (stamp.stamp ?? 0 < 0) {
      cursedCount++;
    } else {
      btcStampCount++;
    }
    
    if (stamp.locked === 1) {
      lockedCount++;
    }
    
    if (typeof stamp.floorPrice === 'number') {
      totalFloorValueBTC += stamp.floorPrice * (stamp.supply ?? 0);
    }
    
    if (stamp.floorPriceUSD) {
      totalFloorValueUSD += stamp.floorPriceUSD * (stamp.supply ?? 0);
    }
  }

  return {
    count: stamps.length,
    totalSupply,
    averageSupply: totalSupply / stamps.length,
    uniqueCreators: creators.size,
    uniqueCollections: collections.size,
    cursedCount,
    btcStampCount,
    lockedCount,
    totalFloorValueBTC,
    totalFloorValueUSD,
  };
}

/**
 * Sort stamps by various criteria
 */
export function sortStamps(
  stamps: Stamp[],
  sortBy: 'id' | 'created' | 'supply' | 'price' = 'id',
  order: 'ASC' | 'DESC' = 'DESC'
): Stamp[] {
  const sorted = [...stamps];
  
  sorted.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'id':
        comparison = (a.stamp ?? 0) - (b.stamp ?? 0);
        break;
      case 'created':
        comparison = a.block_index - b.block_index;
        break;
      case 'supply':
        comparison = (a.supply ?? 0) - (b.supply ?? 0);
        break;
      case 'price': {
        const priceA = typeof a.floorPrice === 'number' ? a.floorPrice : 0;
        const priceB = typeof b.floorPrice === 'number' ? b.floorPrice : 0;
        comparison = priceA - priceB;
        break;
      }
    }
    
    return order === 'ASC' ? comparison : -comparison;
  });
  
  return sorted;
}

/**
 * Filter stamps by various criteria
 */
export interface StampFilters {
  minId?: number;
  maxId?: number;
  creator?: string;
  collectionId?: string;
  isCursed?: boolean;
  isLocked?: boolean;
  hasFloorPrice?: boolean;
  minSupply?: number;
  maxSupply?: number;
  mimeTypes?: string[];
}

export function filterStamps(stamps: Stamp[], filters: StampFilters): Stamp[] {
  return stamps.filter(stamp => {
    if (filters.minId !== undefined && (stamp.stamp ?? 0) < filters.minId) {return false;}
    if (filters.maxId !== undefined && (stamp.stamp ?? 0) > filters.maxId) {return false;}
    if (filters.creator && stamp.creator !== filters.creator) {return false;}
    // Note: collection_id filtering not supported at stamp level
    // Would need separate collection API call to filter by collection
    if (filters.collectionId) {
      // Skip collection filtering for now as stamps don't have collection_id
      return false;
    }
    if (filters.isCursed !== undefined) {
      const isCursed = stamp.stamp ?? 0 < 0;
      if (filters.isCursed !== isCursed) {return false;}
    }
    if (filters.isLocked !== undefined && (stamp.locked === 1) !== filters.isLocked) {return false;}
    if (filters.hasFloorPrice !== undefined) {
      const hasPrice = stamp.floorPrice !== null && stamp.floorPrice !== 0;
      if (filters.hasFloorPrice !== hasPrice) {return false;}
    }
    if (filters.minSupply !== undefined && (stamp.supply ?? 0) < filters.minSupply) {return false;}
    if (filters.maxSupply !== undefined && (stamp.supply ?? 0) > filters.maxSupply) {return false;}
    if (filters.mimeTypes && !filters.mimeTypes.includes(stamp.stamp_mimetype)) {return false;}
    
    return true;
  });
}

/**
 * Convert stamp to a shareable URL format
 */
export function stampToShareableURL(stamp: Stamp, baseURL = 'https://stampchain.io'): string {
  return `${baseURL}/stamp/${stamp.stamp ?? 0}`;
}

/**
 * Extract unique values from stamps for filtering options
 */
export function extractFilterOptions(stamps: Stamp[]) {
  const creators = new Set<string>();
  const collections = new Set<string>();
  const mimeTypes = new Set<string>();
  
  for (const stamp of stamps) {
    creators.add(stamp.creator);
    // Note: Individual stamps don't have collection_id in API schema
    // Collection grouping would need to be done via separate collection API calls
    mimeTypes.add(stamp.stamp_mimetype);
  }
  
  return {
    creators: Array.from(creators).sort(),
    collections: Array.from(collections).sort(),
    mimeTypes: Array.from(mimeTypes).sort(),
  };
}

/**
 * Paginate an array of items
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): { items: T[]; totalPages: number; currentPage: number; totalItems: number } {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  return {
    items: items.slice(startIndex, endIndex),
    totalPages,
    currentPage,
    totalItems,
  };
}