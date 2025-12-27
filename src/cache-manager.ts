import NodeCache from 'node-cache';
import { readFileSync } from 'fs';
import { CachedJSON, Config } from './types.js';
import { createHash } from 'crypto';

/**
 * Manages caching of JSON data from files and URLs
 * LLM Usage: Use this to cache JSON before exploring. Returns cache_id for subsequent operations.
 */
export class CacheManager {
  private cache: NodeCache;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.cache = new NodeCache({
      stdTTL: config.cacheTTLSeconds,
      checkperiod: config.cacheCheckPeriodSeconds,
      useClones: false, // Better performance for large objects
    });
  }

  /**
   * Cache JSON from file path
   * @param filePath - Absolute or relative path to JSON file
   * @returns cache_id for accessing the cached data
   * @throws Error if file doesn't exist, is invalid JSON, or exceeds size limit
   */
  async cacheFromFile(filePath: string): Promise<string> {
    // Generate cache ID from file path
    const cacheId = this.generateCacheId(filePath);

    // Return existing cache if available
    if (this.cache.has(cacheId)) {
      return cacheId;
    }

    try {
      // Read file
      const content = readFileSync(filePath, 'utf-8');
      const sizeBytes = Buffer.byteLength(content, 'utf-8');

      // Check size limit
      const maxSizeBytes = this.config.maxJsonSizeMB * 1024 * 1024;
      if (sizeBytes > maxSizeBytes) {
        throw new Error(
          `File size ${(sizeBytes / 1024 / 1024).toFixed(2)}MB exceeds maximum size ${this.config.maxJsonSizeMB}MB`
        );
      }

      // Parse JSON
      const data = JSON.parse(content);

      // Cache the data
      const cached: CachedJSON = {
        data,
        source: filePath,
        cachedAt: new Date(),
        sizeBytes,
      };

      this.cache.set(cacheId, cached);
      return cacheId;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in file: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Cache JSON from URL
   * @param url - URL to fetch JSON from
   * @returns cache_id for accessing the cached data
   * @throws Error if URL is unreachable, returns invalid JSON, or exceeds size limit
   */
  async cacheFromURL(url: string): Promise<string> {
    const cacheId = this.generateCacheId(url);

    // Return existing cache if available
    if (this.cache.has(cacheId)) {
      return cacheId;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      return await this.cacheFromData(content, url);
    } catch (error) {
      throw new Error(`Failed to fetch from URL: ${url} - ${error}`);
    }
  }

  /**
   * Cache JSON from string data
   * @param jsonString - JSON string to cache
   * @param source - Source identifier (file path or URL)
   * @returns cache_id for accessing the cached data
   */
  async cacheFromData(jsonString: string, source: string): Promise<string> {
    const cacheId = this.generateCacheId(source);

    const sizeBytes = Buffer.byteLength(jsonString, 'utf-8');

    // Check size limit
    const maxSizeBytes = this.config.maxJsonSizeMB * 1024 * 1024;
    if (sizeBytes > maxSizeBytes) {
      throw new Error(
        `Data size ${(sizeBytes / 1024 / 1024).toFixed(2)}MB exceeds maximum size ${this.config.maxJsonSizeMB}MB`
      );
    }

    try {
      const data = JSON.parse(jsonString);

      const cached: CachedJSON = {
        data,
        source,
        cachedAt: new Date(),
        sizeBytes,
      };

      this.cache.set(cacheId, cached);
      return cacheId;
    } catch (error) {
      throw new Error(`Invalid JSON data from source: ${source}`);
    }
  }

  /**
   * Get cached JSON data
   * @param cacheId - Cache identifier returned from cache operations
   * @returns Cached JSON data or undefined if not found
   */
  get(cacheId: string): CachedJSON | undefined {
    return this.cache.get<CachedJSON>(cacheId);
  }

  /**
   * Check if cache ID exists
   * @param cacheId - Cache identifier to check
   * @returns true if cache exists, false otherwise
   */
  has(cacheId: string): boolean {
    return this.cache.has(cacheId);
  }

  /**
   * Delete cached data
   * @param cacheId - Cache identifier to delete
   */
  delete(cacheId: string): void {
    this.cache.del(cacheId);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.flushAll();
  }

  /**
   * Generate consistent cache ID from source
   */
  private generateCacheId(source: string): string {
    return createHash('sha256').update(source).digest('hex').substring(0, 16);
  }
}
