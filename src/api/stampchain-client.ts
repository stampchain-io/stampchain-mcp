import axios, { AxiosInstance, AxiosError, type AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import { Logger } from '../utils/logger.js';
import {
  type MCPError,
  InvalidParametersError,
  InternalError,
  ResourceNotFoundError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  StampchainAPIError,
} from '../utils/errors.js';
import type {
  Stamp,
  StampResponse,
  StampListResponse,
  CollectionResponse,
  CollectionListResponse,
  TokenResponse,
  TokenListResponse,
  BlockResponse,
  BalanceResponse,
  APIErrorResponse,
  StampQueryParams,
  CollectionQueryParams,
  TokenQueryParams,
  RecentSale,
  RecentSalesResponse,
  RecentSalesQueryParams,
  MarketDataQueryParams,
  StampMarketData,
} from './types.js';

export interface StampchainClientConfig {
  baseURL?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  apiVersion?: string;
}

export class StampchainClient {
  private client: AxiosInstance;
  private logger: Logger;
  private apiVersion: string;

  constructor(config?: StampchainClientConfig) {
    const {
      baseURL = 'https://stampchain.io/api/v2',
      apiKey,
      timeout = 30000,
      retries = 3,
      retryDelay = 1000,
      apiVersion = '2.3',
    } = config || {};

    this.logger = new Logger('StampchainClient');
    this.apiVersion = apiVersion;

    // Create axios instance with base configuration
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': apiVersion,
        ...(apiKey && { 'X-API-Key': apiKey }),
      },
    });

    // Configure retry logic with exponential backoff
    axiosRetry(this.client, {
      retries,
      retryDelay: (retryCount) => {
        const delay = retryDelay * Math.pow(2, retryCount - 1);
        this.logger.info(`Retrying request (attempt ${retryCount})...`, { delay });
        return delay;
      },
      retryCondition: (error) => {
        // Retry on network errors or 5xx status codes
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status !== undefined && error.response.status >= 500)
        );
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug('Making API request', {
          method: config.method,
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error: unknown) => {
        this.logger.error('Request error', { error: String(error) });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('API response received', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error: AxiosError<APIErrorResponse>) => {
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  /**
   * Handle API error responses with version-specific logic
   */
  private handleApiError(error: AxiosError<APIErrorResponse>): MCPError {
    const { response } = error;
    const endpoint = response?.config?.url || 'unknown';

    if (!response) {
      // Network error
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return new TimeoutError(30000, endpoint);
      }
      return new NetworkError(`Network error for ${endpoint}`, error.code);
    }

    const { status, data } = response;
    const errorMessage = data?.error || data?.message || error.message || 'Unknown error';

    // Version-specific error handling
    if (status === 400 && errorMessage.includes('version')) {
      this.logger.warn(`API version ${this.apiVersion} may not be supported`, {
        error: errorMessage,
      });
      // Could trigger automatic version fallback here
    }

    switch (status) {
      case 400:
        return new InvalidParametersError(errorMessage);
      case 404:
        return new ResourceNotFoundError('resource', endpoint);
      case 429:
        return new RateLimitError();
      case 500:
      case 502:
      case 503:
      case 504:
        return new InternalError(errorMessage, data);
      default:
        return new StampchainAPIError(errorMessage, status, endpoint, data);
    }
  }

  /**
   * Perform automatic version fallback if current version fails
   */
  private async attemptVersionFallback(originalError: AxiosError): Promise<void> {
    const fallbackVersions = ['2.2', '2.1'];

    for (const version of fallbackVersions) {
      if (version === this.apiVersion) continue;

      try {
        const isCompatible = await this.testVersionCompatibility(version);
        if (isCompatible) {
          this.logger.warn(
            `Falling back to API version ${version} due to error with ${this.apiVersion}`
          );
          this.setApiVersion(version);
          return;
        }
      } catch (fallbackError) {
        this.logger.debug(`Version ${version} fallback failed`, { error: fallbackError });
      }
    }

    throw originalError;
  }

  /**
   * Initialize client with automatic version negotiation
   */
  public async initializeWithVersionNegotiation(): Promise<void> {
    try {
      // First, try to get available versions
      const versionInfo = await this.getAvailableVersions();

      // Check if our current version is supported
      const currentVersionInfo = versionInfo.versions.find((v) => v.version === this.apiVersion);

      if (!currentVersionInfo) {
        this.logger.warn(`API version ${this.apiVersion} not found in available versions`);
        // Fall back to the current version from server
        this.setApiVersion(versionInfo.current);
        return;
      }

      // Check if current version is deprecated or end-of-life
      if (
        currentVersionInfo.status === 'deprecated' ||
        currentVersionInfo.status === 'end-of-life'
      ) {
        this.logger.warn(
          `API version ${this.apiVersion} is ${currentVersionInfo.status}, consider upgrading`
        );

        // If deprecated, optionally upgrade to current version
        if (currentVersionInfo.status === 'end-of-life') {
          this.logger.info(`Upgrading to current API version ${versionInfo.current}`);
          this.setApiVersion(versionInfo.current);
        }
      }

      // Test compatibility with current version
      const isCompatible = await this.testVersionCompatibility(this.apiVersion);
      if (!isCompatible) {
        this.logger.warn(`API version ${this.apiVersion} compatibility test failed`);
        await this.attemptVersionFallback(
          new Error('Version compatibility test failed') as AxiosError
        );
      }

      this.logger.info(`Successfully initialized with API version ${this.apiVersion}`);
    } catch (error) {
      this.logger.error('Version negotiation failed', { error });
      // Continue with original version if negotiation fails
    }
  }

  /**
   * Get version-specific feature availability
   */
  public getFeatureAvailability(): {
    marketData: boolean;
    recentSales: boolean;
    enhancedFiltering: boolean;
    dispenserInfo: boolean;
    cacheStatus: boolean;
  } {
    const majorVersion = parseFloat(this.apiVersion);

    return {
      marketData: majorVersion >= 2.3,
      recentSales: majorVersion >= 2.3,
      enhancedFiltering: majorVersion >= 2.3,
      dispenserInfo: majorVersion >= 2.3,
      cacheStatus: majorVersion >= 2.3,
    };
  }

  /**
   * Execute a request with automatic version fallback on failure
   */
  private async executeWithFallback<T>(
    requestFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 400) {
        // Try version fallback
        try {
          await this.attemptVersionFallback(error);
          // Retry with new version
          return await requestFn();
        } catch (fallbackError) {
          // If fallback function is provided, try it
          if (fallbackFn) {
            this.logger.info('Attempting fallback implementation');
            return await fallbackFn();
          }
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  /**
   * Get a specific stamp by ID
   */
  async getStamp(stampId: number): Promise<Stamp> {
    const response = await this.client.get<StampResponse>(`/stamps/${stampId}`);
    return response.data.data.stamp;
  }

  /**
   * Search stamps with query parameters
   */
  async searchStamps(params: StampQueryParams = {}): Promise<Stamp[]> {
    const response = await this.client.get<StampListResponse>('/stamps', { params });
    return response.data.data;
  }

  /**
   * Get recent stamps
   */
  async getRecentStamps(limit: number = 20): Promise<Stamp[]> {
    const params: StampQueryParams = {
      limit,
    };
    const response = await this.client.get<StampListResponse>('/stamps', { params });
    return response.data.data;
  }

  /**
   * Get recent sales data (v2.3 feature)
   */
  async getRecentSales(params: RecentSalesQueryParams = {}): Promise<RecentSalesResponse> {
    const features = this.getFeatureAvailability();

    if (!features.recentSales) {
      // Fallback for older API versions - use regular stamps endpoint
      this.logger.info('Recent sales not available in this API version, using fallback');
      const stamps = await this.searchStamps({
        limit: params.page_size || 20,
        sort_order: params.sort_order || 'DESC',
      });

      // Transform to match RecentSalesResponse format
      return {
        data: stamps.map((stamp) => ({
          tx_hash: stamp.tx_hash,
          block_index: stamp.block_index,
          stamp_id: stamp.stamp || 0,
          price_btc: typeof stamp.floorPrice === 'number' ? stamp.floorPrice : 0,
          price_usd: stamp.floorPriceUSD || null,
          timestamp: stamp.block_index, // Use block_index as timestamp approximation
        })),
        metadata: {
          dayRange: params.dayRange || 30,
          lastUpdated: Date.now(),
          total: stamps.length,
        },
        last_block: stamps[0]?.block_index || 0,
      };
    }

    return this.executeWithFallback(
      () =>
        this.client.get<RecentSalesResponse>('/stamps/recentSales', { params }).then((r) => r.data),
      async () => {
        // Fallback implementation for when v2.3 endpoint fails
        const stamps = await this.searchStamps({
          limit: params.page_size || 20,
          sort_order: params.sort_order || 'DESC',
        });

        return {
          data: stamps.map((stamp) => ({
            tx_hash: stamp.tx_hash,
            block_index: stamp.block_index,
            stamp_id: stamp.stamp || 0,
            price_btc: typeof stamp.floorPrice === 'number' ? stamp.floorPrice : 0,
            price_usd: stamp.floorPriceUSD || null,
            timestamp: stamp.block_index,
          })),
          metadata: {
            dayRange: params.dayRange || 30,
            lastUpdated: Date.now(),
            total: stamps.length,
          },
          last_block: stamps[0]?.block_index || 0,
        };
      }
    );
  }

  /**
   * Get market data for stamps (v2.3 feature)
   */
  async getMarketData(params: MarketDataQueryParams = {}): Promise<{
    data: StampMarketData[];
    last_block: number;
    page: number;
    limit: number;
    total: number;
  }> {
    const response = await this.client.get('/stamps/marketData', { params });
    return response.data;
  }

  /**
   * Get market data for a specific stamp (v2.3 feature)
   */
  async getStampMarketData(stampId: number): Promise<StampMarketData> {
    const response = await this.client.get<{ data: StampMarketData }>(
      `/stamps/${stampId}/marketData`
    );
    return response.data.data;
  }

  /**
   * Get a specific collection by ID
   */
  async getCollection(collectionId: string): Promise<CollectionResponse> {
    const response = await this.client.get<CollectionResponse>(`/collections/${collectionId}`);
    return response.data;
  }

  /**
   * Search collections with query parameters
   */
  async searchCollections(params: CollectionQueryParams = {}): Promise<CollectionResponse[]> {
    const response = await this.client.get<CollectionListResponse>('/collections', { params });
    return response.data.data;
  }

  /**
   * Get a specific SRC-20 token by ticker
   */
  async getToken(tick: string): Promise<TokenResponse> {
    const response = await this.client.get<TokenResponse>(`/src20/${tick}`);
    return response.data;
  }

  /**
   * Search SRC-20 tokens with query parameters
   */
  async searchTokens(params: TokenQueryParams = {}): Promise<TokenResponse[]> {
    const response = await this.client.get<TokenListResponse>('/src20', { params });
    return response.data.data;
  }

  /**
   * Get stamps from a specific block
   */
  async getBlock(blockIndex: number): Promise<BlockResponse> {
    const response = await this.client.get<BlockResponse>(`/block/${blockIndex}`);
    return response.data;
  }

  /**
   * Get stamps owned by a specific address
   */
  async getBalance(address: string): Promise<BalanceResponse> {
    const response = await this.client.get<BalanceResponse>(`/balance/${address}`);
    return response.data;
  }

  /**
   * Make a custom request to the API
   */
  async customRequest<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }

  /**
   * Get the current API version being used by the client
   */
  getApiVersion(): string {
    return this.apiVersion;
  }

  /**
   * Set the API version for future requests
   */
  setApiVersion(version: string): void {
    this.apiVersion = version;
    if (this.client.defaults.headers) {
      this.client.defaults.headers['X-API-Version'] = version;
    }
    this.logger.info(`API version updated to ${version}`);
  }

  /**
   * Get available API versions from the server
   */
  async getAvailableVersions(): Promise<{
    current: string;
    requestedVersion: string;
    versions: Array<{
      version: string;
      status: string;
      releaseDate: string;
      endOfLife?: string;
    }>;
  }> {
    const response = await this.client.get('/versions');
    return response.data;
  }

  /**
   * Test API version compatibility
   */
  async testVersionCompatibility(version: string): Promise<boolean> {
    try {
      const tempClient = axios.create({
        baseURL: this.client.defaults.baseURL,
        timeout: this.client.defaults.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Version': version,
        },
      });

      await tempClient.get('/health');
      return true;
    } catch (error) {
      this.logger.warn(`Version ${version} compatibility test failed`, { error });
      return false;
    }
  }

  /**
   * Handle API error responses with version-specific logic
   */
}
