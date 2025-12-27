import { describe, it, expect, beforeEach } from '@jest/globals';
import { CacheManager } from '../../src/cache-manager.js';
import { JSONExplorer } from '../../src/json-explorer.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Full Workflow Integration Tests', () => {
  let cacheManager: CacheManager;
  let jsonExplorer: JSONExplorer;

  beforeEach(() => {
    cacheManager = new CacheManager({
      maxJsonSizeMB: 100,
      cacheTTLSeconds: 3600,
      cacheCheckPeriodSeconds: 600,
    });
    jsonExplorer = new JSONExplorer();
  });

  describe('Simple JSON exploration workflow', () => {
    it('should cache, explore, and retrieve values from simple JSON', async () => {
      // Step 1: Cache JSON
      const filePath = join(__dirname, '../fixtures/simple.json');
      const cacheId = await cacheManager.cacheFromFile(filePath);

      expect(cacheId).toBeDefined();
      expect(cacheManager.has(cacheId)).toBe(true);

      // Step 2: Get cached data
      const cached = cacheManager.get(cacheId);
      expect(cached).toBeDefined();
      expect(cached?.data).toBeDefined();

      // Step 3: Explore structure
      const exploreResult = jsonExplorer.explore(cached!.data, '$', 1);
      expect(exploreResult.structure.length).toBeGreaterThan(0);
      expect(exploreResult.path).toBe('$');

      // Step 4: Get specific value
      const valueResult = jsonExplorer.getValue(cached!.data, '$.name');
      expect(valueResult.found).toBe(true);
      expect(valueResult.value).toBe('Simple Test');

      // Step 5: Get schema summary
      const schema = jsonExplorer.getSchemaSummary(cached!.data, 2);
      expect(schema.rootType).toBe('object');
      expect(schema.totalKeys).toBeGreaterThan(0);
    });
  });

  describe('Nested JSON exploration workflow', () => {
    it('should handle incremental exploration of nested data', async () => {
      // Cache nested JSON
      const filePath = join(__dirname, '../fixtures/nested.json');
      const cacheId = await cacheManager.cacheFromFile(filePath);
      const cached = cacheManager.get(cacheId);

      // Explore root at depth 1 (should show top-level keys only)
      const rootExplore = jsonExplorer.explore(cached!.data, '$', 1);
      expect(rootExplore.structure).toHaveLength(2); // user and stats
      expect(rootExplore.structure.find(n => n.path === '$.user')).toBeDefined();
      expect(rootExplore.structure.find(n => n.path === '$.stats')).toBeDefined();

      // Drill into user object
      const userExplore = jsonExplorer.explore(cached!.data, '$.user', 1);
      expect(userExplore.path).toBe('$.user');
      const profileNode = userExplore.structure.find(n => n.path === '$.user.profile');
      expect(profileNode).toBeDefined();
      expect(profileNode?.type).toBe('object');

      // Go deeper into profile with depth 2
      const profileExplore = jsonExplorer.explore(cached!.data, '$.user.profile', 2);
      expect(profileExplore.structure.find(n => n.path === '$.user.profile.name')).toBeDefined();
      expect(profileExplore.structure.find(n => n.path === '$.user.profile.preferences')).toBeDefined();

      // Get specific nested value
      const emailResult = jsonExplorer.getValue(cached!.data, '$.user.profile.email');
      expect(emailResult.found).toBe(true);
      expect(emailResult.value).toBe('john@example.com');

      // Get deep nested value
      const themeResult = jsonExplorer.getValue(
        cached!.data,
        '$.user.profile.preferences.theme'
      );
      expect(themeResult.found).toBe(true);
      expect(themeResult.value).toBe('dark');
    });

    it('should handle array exploration', async () => {
      const filePath = join(__dirname, '../fixtures/nested.json');
      const cacheId = await cacheManager.cacheFromFile(filePath);
      const cached = cacheManager.get(cacheId);

      // Explore posts array
      const postsExplore = jsonExplorer.explore(cached!.data, '$.user.posts', 1);
      const postsArray = postsExplore.structure.find(n => n.path === '$.user.posts[0]');
      expect(postsArray).toBeDefined();

      // Get array element
      const firstPost = jsonExplorer.getValue(cached!.data, '$.user.posts[0].title');
      expect(firstPost.found).toBe(true);
      expect(firstPost.value).toBe('First Post');

      // Get nested value in array element
      const views = jsonExplorer.getValue(cached!.data, '$.user.posts[0].metadata.views');
      expect(views.found).toBe(true);
      expect(views.value).toBe(100);
    });
  });

  describe('Large array workflow', () => {
    it('should efficiently explore large arrays', async () => {
      const filePath = join(__dirname, '../fixtures/large-array.json');
      const cacheId = await cacheManager.cacheFromFile(filePath);
      const cached = cacheManager.get(cacheId);

      // Get schema overview
      const schema = jsonExplorer.getSchemaSummary(cached!.data, 3);
      expect(schema.structure['$.products']).toBeDefined();
      expect(schema.structure['$.products'].isArray).toBe(true);
      expect(schema.structure['$.products'].arrayLength).toBe(3);

      // Explore products array with depth limit
      const productsExplore = jsonExplorer.explore(cached!.data, '$.products', 1);
      expect(productsExplore.structure.length).toBe(3); // 3 products

      // Explore single product
      const productExplore = jsonExplorer.explore(cached!.data, '$.products[0]', 2);
      expect(productExplore.structure.find(n => n.path === '$.products[0].name')).toBeDefined();
      expect(productExplore.structure.find(n => n.path === '$.products[0].specs')).toBeDefined();

      // Get specific product value
      const productName = jsonExplorer.getValue(cached!.data, '$.products[1].name');
      expect(productName.found).toBe(true);
      expect(productName.value).toBe('Product 2');
    });
  });

  describe('Schema-driven exploration', () => {
    it('should use schema to guide exploration', async () => {
      const filePath = join(__dirname, '../fixtures/nested.json');
      const cacheId = await cacheManager.cacheFromFile(filePath);
      const cached = cacheManager.get(cacheId);

      // First, get schema to understand structure
      const schema = jsonExplorer.getSchemaSummary(cached!.data, 2);

      // Verify we can see user structure in schema
      expect(schema.structure['$.user']).toBeDefined();
      expect(schema.structure['$.user.profile']).toBeDefined();

      // Use schema info to navigate
      const userSchema = schema.structure['$.user'];
      expect(userSchema.type).toBe('object');
      expect(userSchema.objectKeys).toContain('id');
      expect(userSchema.objectKeys).toContain('profile');
      expect(userSchema.objectKeys).toContain('posts');

      // Now fetch specific values based on schema
      const userId = jsonExplorer.getValue(cached!.data, '$.user.id');
      expect(userId.found).toBe(true);
      expect(userId.type).toBe('number');

      const posts = jsonExplorer.getValue(cached!.data, '$.user.posts', 0);
      expect(posts.found).toBe(true);
      expect(Array.isArray(posts.value)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid paths gracefully', async () => {
      const filePath = join(__dirname, '../fixtures/simple.json');
      const cacheId = await cacheManager.cacheFromFile(filePath);
      const cached = cacheManager.get(cacheId);

      const result = jsonExplorer.getValue(cached!.data, '$.nonexistent.path');
      expect(result.found).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it('should handle exploration of non-existent paths', async () => {
      const filePath = join(__dirname, '../fixtures/simple.json');
      const cacheId = await cacheManager.cacheFromFile(filePath);
      const cached = cacheManager.get(cacheId);

      const result = jsonExplorer.explore(cached!.data, '$.invalid.path', 1);
      expect(result.totalNodes).toBe(0);
      expect(result.structure).toHaveLength(0);
    });
  });

  describe('Token optimization scenarios', () => {
    it('should demonstrate token-efficient exploration pattern', async () => {
      const filePath = join(__dirname, '../fixtures/nested.json');
      const cacheId = await cacheManager.cacheFromFile(filePath);
      const cached = cacheManager.get(cacheId);

      // Pattern 1: Start with schema at low depth
      const quickSchema = jsonExplorer.getSchemaSummary(cached!.data, 1);
      expect(quickSchema.totalKeys).toBeLessThan(10); // Minimal keys at depth 1

      // Pattern 2: Explore specific branch at depth 1
      const branchExplore = jsonExplorer.explore(cached!.data, '$.user', 1);
      expect(branchExplore.structure.length).toBeLessThan(10);

      // Pattern 3: Get exact values when path is known
      const exactValue = jsonExplorer.getValue(cached!.data, '$.user.id', 0);
      expect(exactValue.found).toBe(true);
      expect(exactValue.structure).toBeUndefined(); // No structure at depth 0

      // Pattern 4: Use depth parameter to control exploration
      const shallowExplore = jsonExplorer.explore(cached!.data, '$', 1);
      const deepExplore = jsonExplorer.explore(cached!.data, '$', 3);
      expect(deepExplore.totalNodes).toBeGreaterThan(shallowExplore.totalNodes);
    });
  });

  describe('Cache lifecycle', () => {
    it('should handle multiple cached JSONs', async () => {
      const file1 = join(__dirname, '../fixtures/simple.json');
      const file2 = join(__dirname, '../fixtures/nested.json');

      const cacheId1 = await cacheManager.cacheFromFile(file1);
      const cacheId2 = await cacheManager.cacheFromFile(file2);

      expect(cacheId1).not.toBe(cacheId2);
      expect(cacheManager.has(cacheId1)).toBe(true);
      expect(cacheManager.has(cacheId2)).toBe(true);

      // Can work with both independently
      const cached1 = cacheManager.get(cacheId1);
      const cached2 = cacheManager.get(cacheId2);

      const result1 = jsonExplorer.getValue(cached1!.data, '$.name');
      const result2 = jsonExplorer.getValue(cached2!.data, '$.user.id');

      expect(result1.found).toBe(true);
      expect(result2.found).toBe(true);
    });
  });
});
