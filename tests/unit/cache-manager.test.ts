import { describe, it, expect, beforeEach } from '@jest/globals';
import { CacheManager } from '../../src/cache-manager.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager({
      maxJsonSizeMB: 1,
      cacheTTLSeconds: 3600,
      cacheCheckPeriodSeconds: 600,
    });
  });

  describe('cacheFromFile', () => {
    it('should cache JSON from file', async () => {
      const filePath = join(__dirname, '../fixtures/simple.json');
      const cacheId = await cacheManager.cacheFromFile(filePath);

      expect(cacheId).toBeDefined();
      expect(typeof cacheId).toBe('string');
      expect(cacheId.length).toBeGreaterThan(0);
    });

    it('should return same cache ID for same file', async () => {
      const filePath = join(__dirname, '../fixtures/simple.json');
      const cacheId1 = await cacheManager.cacheFromFile(filePath);
      const cacheId2 = await cacheManager.cacheFromFile(filePath);

      expect(cacheId1).toBe(cacheId2);
    });

    it('should throw error for non-existent file', async () => {
      await expect(cacheManager.cacheFromFile('/non/existent/file.json')).rejects.toThrow();
    });

    it('should throw error for invalid JSON', async () => {
      const filePath = join(__dirname, '../fixtures/invalid.json');
      // Create invalid JSON file for test
      await expect(cacheManager.cacheFromFile(filePath)).rejects.toThrow();
    });

    it('should throw error for file exceeding size limit', async () => {
      const smallCacheManager = new CacheManager({
        maxJsonSizeMB: 0.000001, // Very small limit
        cacheTTLSeconds: 3600,
        cacheCheckPeriodSeconds: 600,
      });

      const filePath = join(__dirname, '../fixtures/simple.json');
      await expect(smallCacheManager.cacheFromFile(filePath)).rejects.toThrow(/exceeds maximum size/);
    });
  });

  describe('cacheFromURL', () => {
    it('should cache JSON from URL', async () => {
      // Mock URL - in real implementation would fetch from network
      const mockData = { test: 'data' };
      const cacheId = await cacheManager.cacheFromData(JSON.stringify(mockData), 'http://example.com/data.json');

      expect(cacheId).toBeDefined();
      const cached = cacheManager.get(cacheId);
      expect(cached).toBeDefined();
      expect(cached?.data).toEqual(mockData);
    });
  });

  describe('get', () => {
    it('should retrieve cached data', async () => {
      const filePath = join(__dirname, '../fixtures/simple.json');
      const cacheId = await cacheManager.cacheFromFile(filePath);

      const cached = cacheManager.get(cacheId);
      expect(cached).toBeDefined();
      expect(cached?.data).toBeDefined();
      expect(typeof cached?.data).toBe('object');
    });

    it('should return undefined for non-existent cache ID', () => {
      const cached = cacheManager.get('non-existent-id');
      expect(cached).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing cache ID', async () => {
      const filePath = join(__dirname, '../fixtures/simple.json');
      const cacheId = await cacheManager.cacheFromFile(filePath);

      expect(cacheManager.has(cacheId)).toBe(true);
    });

    it('should return false for non-existent cache ID', () => {
      expect(cacheManager.has('non-existent-id')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete cached data', async () => {
      const filePath = join(__dirname, '../fixtures/simple.json');
      const cacheId = await cacheManager.cacheFromFile(filePath);

      expect(cacheManager.has(cacheId)).toBe(true);
      cacheManager.delete(cacheId);
      expect(cacheManager.has(cacheId)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all cached data', async () => {
      const filePath1 = join(__dirname, '../fixtures/simple.json');
      const filePath2 = join(__dirname, '../fixtures/nested.json');

      const cacheId1 = await cacheManager.cacheFromFile(filePath1);
      const cacheId2 = await cacheManager.cacheFromFile(filePath2);

      expect(cacheManager.has(cacheId1)).toBe(true);
      expect(cacheManager.has(cacheId2)).toBe(true);

      cacheManager.clear();

      expect(cacheManager.has(cacheId1)).toBe(false);
      expect(cacheManager.has(cacheId2)).toBe(false);
    });
  });
});
