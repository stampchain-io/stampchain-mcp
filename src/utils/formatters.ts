/**
 * Utility functions for formatting data and responses
 * These utilities help transform API responses into user-friendly formats
 */

import type { Stamp } from '../api/types.js';
import type { Collection, Token } from '../schemas/index.js';
import type { ToolContent } from '../interfaces/tool.js';

/**
 * Format a stamp for display
 */
export function formatStamp(stamp: Stamp, options?: { includeBase64?: boolean }): string {
  const lines = [
    `Stamp #${stamp.stamp}`,
    `Creator: ${stamp.creator}${stamp.creator_name ? ` (${stamp.creator_name})` : ''}`,
    `CPID: ${stamp.cpid}`,
    `Block: ${stamp.block_index}`,
    `Supply: ${formatSupply(stamp.supply ?? 0, stamp.divisible)}`,
    `Type: ${stamp.ident}`,
    `MIME Type: ${stamp.stamp_mimetype}`,
  ];

  if (stamp.locked === 1) {
    lines.push('Status: LOCKED');
  }

  if (stamp.keyburn) {
    lines.push(`Keyburn: ${stamp.keyburn}`);
  }

  if (stamp.floorPrice) {
    lines.push(`Floor Price: ${formatPrice(stamp.floorPrice)} BTC`);
    if (stamp.floorPriceUSD) {
      lines.push(`Floor Price (USD): $${formatUSD(stamp.floorPriceUSD)}`);
    }
  }

  lines.push(`URL: ${stamp.stamp_url}`);
  lines.push(`TX: ${stamp.tx_hash}`);

  if (options?.includeBase64 && stamp.stamp_base64) {
    lines.push('---');
    lines.push('Base64 Data:');
    lines.push(stamp.stamp_base64.substring(0, 100) + '...');
  }

  return lines.join('\n');
}

/**
 * Format a collection for display
 */
export function formatCollection(collection: Collection): string {
  const lines = [
    `Collection: ${collection.collection_name}`,
    `ID: ${collection.collection_id}`,
    `Description: ${collection.collection_description}`,
    `Creators: ${collection.creators.join(', ')}`,
    `Stamps: ${collection.stamp_count}`,
    `Total Editions: ${collection.total_editions}`,
  ];

  // Note: Additional metadata like social links would be fetched separately

  return lines.join('\n');
}

/**
 * Format a token for display
 */
export function formatToken(token: Token): string {
  const lines = [
    `Token: ${token.tick}`,
    `Protocol: ${token.p}`,
    `Operation: ${token.op}`,
    `Max Supply: ${token.max}`,
    `Creator: ${token.creator}`,
    `Block Time: ${formatTimestamp(token.block_time)}`,
  ];

  if (token.lim) {
    lines.push(`Mint Limit: ${token.lim}`);
  }

  if (token.deci !== undefined) {
    lines.push(`Decimals: ${token.deci}`);
  }

  if (token.holders !== undefined) {
    lines.push(`Holders: ${token.holders.toLocaleString()}`);
  }

  if (token.total_minted) {
    lines.push(`Total Minted: ${token.total_minted}`);
  }

  if (token.percent_minted !== undefined) {
    lines.push(`Percent Minted: ${token.percent_minted.toFixed(2)}%`);
  }

  if (token.transfers_24h !== undefined) {
    lines.push(`24h Transfers: ${token.transfers_24h.toLocaleString()}`);
  }

  return lines.join('\n');
}

/**
 * Format a list of stamps for display
 */
export function formatStampList(stamps: Stamp[], total: number, page: number, pageSize: number): string {
  const lines = [`Found ${total} stamps (showing page ${page})`];
  lines.push('---');

  stamps.forEach((stamp, index) => {
    lines.push(`${index + 1}. Stamp #${stamp.stamp}`);
    lines.push(`   Creator: ${stamp.creator}`);
    lines.push(`   CPID: ${stamp.cpid}`);
    lines.push(`   Supply: ${formatSupply(stamp.supply ?? 0, stamp.divisible)}`);
    if (stamp.floorPrice) {
      lines.push(`   Floor Price: ${formatPrice(stamp.floorPrice)} BTC`);
    }
    lines.push('');
  });

  const totalPages = Math.ceil(total / pageSize);
  if (totalPages > 1) {
    lines.push(`Page ${page} of ${totalPages}`);
  }

  return lines.join('\n');
}

/**
 * Format supply with divisibility
 */
export function formatSupply(supply: number, divisible: number): string {
  if (divisible === 1) {
    return (supply / 100000000).toFixed(8).replace(/\.?0+$/, '');
  }
  return supply.toLocaleString();
}

/**
 * Format price (BTC or string)
 */
export function formatPrice(price: number | string): string {
  if (typeof price === 'string') {
    return price;
  }
  return price.toFixed(8).replace(/\.?0+$/, '');
}

/**
 * Format USD price
 */
export function formatUSD(price: number): string {
  return price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format timestamp to human-readable date
 */
export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return timestamp;
  }
}

/**
 * Format error message for display
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  if (typeof error === 'string') {
    return `Error: ${error}`;
  }
  return 'An unknown error occurred';
}

/**
 * Create a summary of stamps for compact display
 */
export function summarizeStamps(stamps: Stamp[]): string {
  if (stamps.length === 0) {
    return 'No stamps found';
  }

  const totalSupply = stamps.reduce((sum, stamp) => sum + (stamp.supply || 0), 0);
  const creators = new Set(stamps.map(s => s.creator)).size;
  // Note: Collections are tracked separately from stamps in the API
  const stampsWithSupply = stamps.filter(s => s.supply !== null).length;

  return [
    `Total Stamps: ${stamps.length}`,
    `Unique Creators: ${creators}`,
    `Stamps with Supply: ${stampsWithSupply}`,
    `Combined Supply: ${totalSupply.toLocaleString()}`,
  ].join('\n');
}

/**
 * Convert stamp data to JSON content for tool response
 */
export function stampToJSON(stamp: Stamp): ToolContent {
  return {
    type: 'text',
    text: JSON.stringify(stamp, null, 2),
  };
}

/**
 * Convert collection data to JSON content for tool response
 */
export function collectionToJSON(collection: Collection): ToolContent {
  return {
    type: 'text',
    text: JSON.stringify(collection, null, 2),
  };
}

/**
 * Convert token data to JSON content for tool response
 */
export function tokenToJSON(token: Token): ToolContent {
  return {
    type: 'text',
    text: JSON.stringify(token, null, 2),
  };
}

/**
 * Format number with thousand separators
 */
export function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) {
    return String(value);
  }
  return num.toLocaleString();
}


/**
 * Create a table-like display for multiple items
 */
export function createTable<T>(
  items: T[],
  columns: Array<{ key: keyof T; label: string; format?: (value: unknown) => string }>
): string {
  if (items.length === 0) {
    return 'No items to display';
  }

  // Calculate column widths
  const widths = columns.map(col => {
    const values = items.map(item => {
      const value = item[col.key];
      const formatted = col.format ? col.format(value) : String(value || '');
      return formatted.length;
    });
    return Math.max(col.label.length, ...values);
  });

  // Create header
  const header = columns
    .map((col, i) => col.label.padEnd(widths[i]))
    .join(' | ');
  const separator = widths.map(w => '-'.repeat(w)).join('-+-');

  // Create rows
  const rows = items.map(item => {
    return columns
      .map((col, i) => {
        const value = item[col.key];
        const formatted = col.format ? col.format(value) : String(value || '');
        return formatted.padEnd(widths[i]);
      })
      .join(' | ');
  });

  return [header, separator, ...rows].join('\n');
}