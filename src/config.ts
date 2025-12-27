import { Config } from './types.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Load configuration from environment variables with defaults
 */
export function loadConfig(): Config {
  return {
    maxJsonSizeMB: parseInt(process.env.MAX_JSON_SIZE_MB || '100', 10),
    cacheTTLSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10),
    cacheCheckPeriodSeconds: parseInt(process.env.CACHE_CHECK_PERIOD_SECONDS || '600', 10),
  };
}
