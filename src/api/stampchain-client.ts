import axios, { type AxiosInstance, type AxiosError, type AxiosRequestConfig } from 'axios';
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
} from './types.js';

export interface StampchainClientConfig {
  baseURL?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class StampchainClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor(config?: StampchainClientConfig) {
    const {
      baseURL = 'https://stampchain.io/api/v2',
      apiKey,
      timeout = 30000,
      retries = 3,
      retryDelay = 1000,
    } = config || {};

    this.logger = new Logger('StampchainClient');

    // Create axios instance with base configuration
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
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
   * Handle API errors and convert to MCPError
   */
  private handleApiError(error: AxiosError<APIErrorResponse>): MCPError {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || error.message;
      const endpoint = error.config?.url;

      this.logger.error('API error response', {
        status,
        message,
        url: endpoint,
      });

      switch (status) {
        case 400:
          return new StampchainAPIError(`Bad Request: ${message}`, status, endpoint, data);
        case 401:
          return new StampchainAPIError(`Unauthorized: ${message}`, status, endpoint, data);
        case 404:
          return new ResourceNotFoundError('resource', endpoint || 'unknown');
        case 429:
          return new RateLimitError();
        case 500:
        case 502:
        case 503:
        case 504:
          return new StampchainAPIError(`Server Error: ${message}`, status, endpoint, data);
        default:
          return new StampchainAPIError(`API Error: ${message}`, status, endpoint, data);
      }
    } else if (error.request) {
      const endpoint = error.config?.url;
      const timeout = error.config?.timeout;
      
      this.logger.error('No response received', {
        url: endpoint,
        timeout,
        code: error.code,
      });

      // Check if it's a timeout error
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return new TimeoutError(timeout || 30000, endpoint);
      }

      // Check for specific network errors
      if (error.code) {
        return new NetworkError('Network error occurred', error.code, {
          endpoint,
          timeout,
        });
      }

      return new NetworkError('No response from server', undefined, {
        endpoint,
        timeout,
      });
    } else {
      this.logger.error('Request setup error', { message: error.message });
      return new InternalError(`Request failed: ${error.message}`);
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
}
