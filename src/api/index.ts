/**
 * Stampchain API Client exports
 */

export { StampchainClient } from './stampchain-client.js';
export * from './types.js';

// Create a singleton instance for convenience
import { StampchainClient } from './stampchain-client.js';

let defaultClient: StampchainClient | null = null;

/**
 * Get the default Stampchain API client instance
 * @param apiKey Optional API key for authentication
 * @param apiVersion Optional API version (defaults to 2.3)
 * @returns StampchainClient instance
 */
export function getDefaultClient(apiKey?: string, apiVersion?: string): StampchainClient {
  if (!defaultClient) {
    defaultClient = new StampchainClient({
      baseURL: process.env.STAMPCHAIN_API_URL || 'https://stampchain.io/api/v2',
      apiKey: apiKey || process.env.STAMPCHAIN_API_KEY,
      timeout: Number(process.env.STAMPCHAIN_API_TIMEOUT) || 30000,
      apiVersion: apiVersion || process.env.STAMPCHAIN_API_VERSION || '2.3',
    });
  }
  return defaultClient;
}

/**
 * Create a new Stampchain API client instance
 * @param config Client configuration
 * @returns StampchainClient instance
 */
export function createClient(config?: {
  baseURL?: string;
  apiKey?: string;
  timeout?: number;
  apiVersion?: string;
}): StampchainClient {
  return new StampchainClient({
    baseURL: config?.baseURL || process.env.STAMPCHAIN_API_URL || 'https://stampchain.io/api/v2',
    apiKey: config?.apiKey || process.env.STAMPCHAIN_API_KEY,
    timeout: config?.timeout || Number(process.env.STAMPCHAIN_API_TIMEOUT) || 30000,
    apiVersion: config?.apiVersion || process.env.STAMPCHAIN_API_VERSION || '2.3',
  });
}
