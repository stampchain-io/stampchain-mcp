/**
 * Validation utility functions
 * These utilities provide additional validation beyond Zod schemas
 */

import { z } from 'zod';
import { 
  BitcoinAddressSchema,
  TransactionHashSchema,
  CPIDSchema 
} from '../schemas/common.js';
import type { 
  BitcoinAddress, 
  TransactionHash, 
  CPID
} from '../schemas/common.js';

/**
 * Validate and parse a stamp ID
 * Accepts both number and string formats
 */
export function parseStampId(input: unknown): number {
  if (typeof input === 'number') {
    if (!Number.isInteger(input) || input < 0) {
      throw new Error('Stamp ID must be a non-negative integer');
    }
    return input;
  }

  if (typeof input === 'string') {
    const parsed = parseInt(input, 10);
    if (isNaN(parsed) || parsed < 0) {
      throw new Error('Invalid stamp ID format');
    }
    return parsed;
  }

  throw new Error('Stamp ID must be a number or string');
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page?: number, pageSize?: number): { page: number; pageSize: number } {
  const validPage = page && page > 0 ? page : 1;
  const validPageSize = pageSize && pageSize > 0 && pageSize <= 100 ? pageSize : 20;
  
  return { page: validPage, pageSize: validPageSize };
}

/**
 * Validate and normalize a Bitcoin address
 */
export function validateBitcoinAddress(address: string): BitcoinAddress {
  const trimmed = address.trim();
  return BitcoinAddressSchema.parse(trimmed);
}

/**
 * Validate and normalize a transaction hash
 */
export function validateTransactionHash(hash: string): TransactionHash {
  const normalized = hash.toLowerCase().trim();
  return TransactionHashSchema.parse(normalized);
}

/**
 * Validate and normalize a CPID
 */
export function validateCPID(cpid: string): CPID {
  const trimmed = cpid.trim();
  return CPIDSchema.parse(trimmed);
}

/**
 * Check if a string is a valid stamp identifier (either numeric ID or CPID)
 */
export function isStampIdentifier(value: string): { type: 'id' | 'cpid'; value: number | string } {
  // Check if it's a numeric ID
  const numericId = parseInt(value, 10);
  if (!isNaN(numericId) && numericId >= 0) {
    return { type: 'id', value: numericId };
  }

  // Check if it's a valid CPID
  try {
    const cpid = validateCPID(value);
    return { type: 'cpid', value: cpid };
  } catch {
    throw new Error('Invalid stamp identifier. Must be a numeric ID or valid CPID');
  }
}

/**
 * Validate date range parameters
 */
export function validateDateRange(
  startDate?: string,
  endDate?: string
): { startDate?: Date; endDate?: Date } {
  const result: { startDate?: Date; endDate?: Date } = {};

  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new Error('Invalid start date format');
    }
    result.startDate = start;
  }

  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      throw new Error('Invalid end date format');
    }
    result.endDate = end;
  }

  if (result.startDate && result.endDate && result.startDate > result.endDate) {
    throw new Error('Start date must be before end date');
  }

  return result;
}

/**
 * Validate and parse a boolean parameter that might come as a string
 */
export function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      return true;
    }
    if (lower === 'false' || lower === '0' || lower === 'no') {
      return false;
    }
  }
  
  throw new Error('Invalid boolean value');
}

/**
 * Validate supply amount based on divisibility
 */
export function validateSupply(supply: number, divisible: boolean): void {
  if (supply < 0) {
    throw new Error('Supply cannot be negative');
  }

  if (!divisible && !Number.isInteger(supply)) {
    throw new Error('Non-divisible assets must have integer supply');
  }

  const MAX_SUPPLY = 1000000000000000; // 1 quadrillion
  if (supply > MAX_SUPPLY) {
    throw new Error('Supply exceeds maximum allowed value');
  }
}

/**
 * Create a Zod schema that coerces string numbers to actual numbers
 */
export function coerceNumber() {
  return z.union([
    z.number(),
    z.string().regex(/^\d+$/).transform(val => parseInt(val, 10))
  ]);
}

/**
 * Create a Zod schema that coerces string booleans to actual booleans
 */
export function coerceBoolean() {
  return z.union([
    z.boolean(),
    z.literal('true').transform(() => true),
    z.literal('false').transform(() => false),
    z.literal('1').transform(() => true),
    z.literal('0').transform(() => false),
  ]);
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  // Remove any control characters
  // eslint-disable-next-line no-control-regex
  const sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Trim whitespace
  return sanitized.trim();
}

/**
 * Validate array limits
 */
export function validateArrayLimit<T>(array: T[], maxLength: number, itemName: string): void {
  if (array.length > maxLength) {
    throw new Error(`Too many ${itemName}. Maximum allowed: ${maxLength}`);
  }
}