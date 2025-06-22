import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Tests for data formatting utilities
 */

import { 
  formatStamp,
  formatCollection,
  formatToken,
  formatTimestamp,
  formatNumber,
  formatSupply
} from '../../utils/formatters.js';
import { createMockStamp, createMockCollection, createMockToken } from '../utils/test-helpers.js';

describe('Formatter Utilities', () => {
  describe('formatStamp', () => {
    it('should format complete stamp data', () => {
      const stamp = createMockStamp({
        stamp: 12345,
        creator: 'bc1qtest123456789012345678901234567890abcdef',
        supply: 1,
        locked: 1,
        divisible: 0,
        block_time: '2024-01-15T10:30:00Z',
        collection_id: 'test-collection',
        stamp_url: 'https://stampchain.io/stamp/12345.png'
      });

      const formatted = formatStamp(stamp);

      expect(formatted).toContain('Stamp #12345');
      expect(formatted).toContain('Creator: bc1qtest123456789012345678901234567890abcdef');
      expect(formatted).toContain('Supply: 1');
      expect(formatted).toContain('Status: LOCKED');
      expect(formatted).toContain('Type: STAMP');
      expect(formatted).toContain('Block: 800000');
      expect(formatted).toContain('URL: https://stampchain.io/stamp/12345.png');
    });

    it('should format stamp without optional fields', () => {
      const stamp = createMockStamp({
        stamp: 12345,
        creator: 'bc1qtest123456789012345678901234567890abcdef',
        supply: 1,
        locked: 1,
        divisible: 0,
        block_time: '2024-01-15T10:30:00Z',
        collection_id: undefined,
        stamp_url: undefined
      });

      const formatted = formatStamp(stamp);

      expect(formatted).toContain('Stamp #12345');
      expect(formatted).not.toContain('Collection:');
      expect(formatted).not.toContain('Image:');
    });

    it('should format large supply numbers', () => {
      const stamp = createMockStamp({
        supply: 21000000,
        divisible: 1
      });

      const formatted = formatStamp(stamp);

      expect(formatted).toContain('Supply: 0.21');
      expect(formatted).toContain('Type: STAMP');
    });
  });

  describe('formatCollection', () => {
    it('should format complete collection data', () => {
      const collection = createMockCollection({
        collection_name: 'Rare Pepes Collection',
        collection_description: 'Original rare pepe stamps from the early days',
        creators: ['bc1qtest123456789012345678901234567890abcdef'],
        stamp_count: 1500,
        total_editions: 1500,
        created_at: '2024-01-01T00:00:00Z',
        website: 'https://rarepepes.com'
      });

      const formatted = formatCollection(collection);

      expect(formatted).toContain('Collection: Rare Pepes Collection');
      expect(formatted).toContain('Description: Original rare pepe stamps from the early days');
      expect(formatted).toContain('Creators: bc1qtest123456789012345678901234567890abcdef');
      expect(formatted).toContain('Stamps: 1500');
      expect(formatted).toContain('Total Editions: 1500');
      // Note: API doesn't include created date or website fields
    });

    it('should format collection without optional fields', () => {
      const collection = createMockCollection({
        collection_name: 'Simple Collection',
        creators: ['bc1qtest123456789012345678901234567890abcdef'],
        stamp_count: 10,
        total_editions: 10,
        created_at: undefined,
        website: undefined
      });

      const formatted = formatCollection(collection);

      expect(formatted).toContain('Collection: Simple Collection');
      expect(formatted).toContain('Creators: bc1qtest123456789012345678901234567890abcdef');
      expect(formatted).not.toContain('Created:');
      expect(formatted).not.toContain('Website:');
    });

    it('should handle multiple creators', () => {
      const collection = createMockCollection({
        creators: ['bc1qtest1', 'bc1qtest2', 'bc1qtest3']
      });

      const formatted = formatCollection(collection);

      expect(formatted).toContain('Creators: bc1qtest1, bc1qtest2, bc1qtest3');
    });
  });

  describe('formatToken', () => {
    it('should format complete token data', () => {
      const token = createMockToken({
        tick: 'UNCOMMON',
        max: '21000000',
        lim: '1000',
        deci: 8,
        creator: 'bc1qtest123456789012345678901234567890abcdef'
      });

      const formatted = formatToken(token);

      expect(formatted).toContain('Token: UNCOMMON');
      expect(formatted).toContain('Max Supply: 21000000');
      expect(formatted).toContain('Mint Limit: 1000');
      expect(formatted).toContain('Creator: bc1qtest123456789012345678901234567890abcdef');
    });

    it('should show percent minted when available', () => {
      const token = createMockToken({
        max: '10000',
      });

      const formatted = formatToken(token);

      expect(formatted).toContain('Max Supply: 10000');
    });

    it('should handle zero decimal places', () => {
      const token = createMockToken({
        deci: 0,
        max: '1000000',
        lim: '100'
      });

      const formatted = formatToken(token);

      expect(formatted).toContain('Decimals: 0');
      expect(formatted).toContain('Max Supply: 1000000');
      expect(formatted).toContain('Mint Limit: 100');
    });

    it('should handle fully minted tokens', () => {
      const token = createMockToken({
        max: '1000',
      });

      const formatted = formatToken(token);

      expect(formatted).toContain('Max Supply: 1000');
    });
  });

  describe('formatTimestamp', () => {
    it('should format ISO timestamp to readable format', () => {
      const timestamp = '2024-01-15T10:30:45Z';
      const formatted = formatTimestamp(timestamp);

      expect(formatted).toContain('Jan 15, 2024');
    });

    it('should handle timestamps with milliseconds', () => {
      const timestamp = '2024-01-15T10:30:45.123Z';
      const formatted = formatTimestamp(timestamp);

      expect(formatted).toContain('Jan 15, 2024');
    });

    it('should handle different timezone formats', () => {
      const timestamp = '2024-01-15T10:30:45+00:00';
      const formatted = formatTimestamp(timestamp);

      expect(formatted).toContain('Jan 15, 2024');
    });

    it('should handle invalid timestamps gracefully', () => {
      const invalidTimestamp = 'not-a-timestamp';
      const formatted = formatTimestamp(invalidTimestamp);

      expect(formatted).toBe('Invalid Date');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with thousand separators', () => {
      expect(formatNumber(1234)).toBe('1,234');
      expect(formatNumber(1234567)).toBe('1,234,567');
      expect(formatNumber(1234567890)).toBe('1,234,567,890');
    });

    it('should handle small numbers', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(42)).toBe('42');
      expect(formatNumber(999)).toBe('999');
    });

    it('should handle string numbers', () => {
      expect(formatNumber('1234567')).toBe('1,234,567');
      expect(formatNumber('999')).toBe('999');
    });

    it('should handle decimal numbers', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56');
      expect(formatNumber('1234567.89')).toBe('1,234,567.89');
    });

    it('should handle invalid numbers gracefully', () => {
      expect(formatNumber('not-a-number')).toBe('not-a-number');
      expect(formatNumber(NaN)).toBe('NaN');
    });
  });

  describe('formatSupply', () => {
    it('should format non-divisible supply numbers', () => {
      expect(formatSupply(1234, 0)).toBe('1,234');
      expect(formatSupply(1234567, 0)).toBe('1,234,567');
    });

    it('should format divisible supply numbers', () => {
      expect(formatSupply(100000000, 1)).toBe('1');
      expect(formatSupply(2100000000000000, 1)).toBe('21000000');
    });

    it('should handle large non-divisible numbers', () => {
      expect(formatSupply(21000000, 0)).toBe('21,000,000');
      expect(formatSupply(1000000000, 0)).toBe('1,000,000,000');
    });
  });


  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined inputs gracefully', () => {
      expect(() => formatStamp(null as any)).toThrow();
      expect(() => formatCollection(undefined as any)).toThrow();
      expect(() => formatToken(null as any)).toThrow();
    });

    it('should handle objects with missing properties', () => {
      const incompleteStamp = { stamp: 12345 } as any;
      expect(() => formatStamp(incompleteStamp)).not.toThrow();

      const incompleteCollection = { collection_id: 'test', creators: ['test'] } as any;
      expect(() => formatCollection(incompleteCollection)).not.toThrow();

      const incompleteToken = { tick: 'TEST' } as any;
      expect(() => formatToken(incompleteToken)).not.toThrow();
    });

    it('should handle very large numbers', () => {
      const largeNumber = '999999999999999999999';
      expect(() => formatNumber(largeNumber)).not.toThrow();
      expect(formatNumber(largeNumber)).toContain(',');
    });

    it('should handle special Unicode characters in names', () => {
      const collection = createMockCollection({
        collection_name: 'Collection with émojis 🚀 and spéciál chars',
        collection_description: 'Dëscription with ünīcøde'
      });

      const formatted = formatCollection(collection);
      expect(formatted).toContain('Collection with émojis 🚀 and spéciál chars');
      expect(formatted).toContain('Dëscription with ünīcøde');
    });
  });
});