import { describe, it, expect } from '@jest/globals';
import { JSONExplorer } from '../../src/json-explorer.js';

describe('JSONExplorer', () => {
  const explorer = new JSONExplorer();

  describe('explore', () => {
    it('should explore simple object at depth 1', () => {
      const data = { name: 'test', value: 42, active: true };
      const result = explorer.explore(data, '$', 1);

      expect(result.path).toBe('$');
      expect(result.depth).toBe(1);
      expect(result.structure).toHaveLength(3);
      expect(result.structure[0].path).toBe('$.name');
      expect(result.structure[0].type).toBe('string');
    });

    it('should explore nested object with depth limit', () => {
      const data = {
        user: {
          profile: {
            name: 'John',
            age: 30,
          },
        },
      };

      const result = explorer.explore(data, '$', 1);
      expect(result.structure).toHaveLength(1);
      expect(result.structure[0].path).toBe('$.user');
      expect(result.structure[0].type).toBe('object');
      expect(result.structure[0].children).toBe(1);
    });

    it('should explore deeper with increased depth', () => {
      const data = {
        user: {
          profile: {
            name: 'John',
            age: 30,
          },
        },
      };

      const result = explorer.explore(data, '$', 2);
      expect(result.structure.length).toBeGreaterThan(1);

      const profileNode = result.structure.find(n => n.path === '$.user.profile');
      expect(profileNode).toBeDefined();
      expect(profileNode?.type).toBe('object');
    });

    it('should handle arrays with depth', () => {
      const data = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
      };

      const result = explorer.explore(data, '$', 1);
      const itemsNode = result.structure.find(n => n.path === '$.items');

      expect(itemsNode).toBeDefined();
      expect(itemsNode?.type).toBe('array');
      expect(itemsNode?.arrayLength).toBe(2);
    });

    it('should explore from specific path', () => {
      const data = {
        user: {
          profile: {
            name: 'John',
            settings: {
              theme: 'dark',
            },
          },
        },
      };

      const result = explorer.explore(data, '$.user.profile', 1);
      expect(result.path).toBe('$.user.profile');
      expect(result.structure.length).toBeGreaterThan(0);
    });

    it('should return empty structure for primitive values', () => {
      const result = explorer.explore(42, '$', 1);
      expect(result.structure).toHaveLength(0);
      expect(result.totalNodes).toBe(0);
    });
  });

  describe('getValue', () => {
    it('should get value by simple path', () => {
      const data = { name: 'test', value: 42 };
      const result = explorer.getValue(data, '$.name');

      expect(result.found).toBe(true);
      expect(result.value).toBe('test');
      expect(result.type).toBe('string');
    });

    it('should get nested value', () => {
      const data = {
        user: {
          profile: {
            name: 'John',
          },
        },
      };

      const result = explorer.getValue(data, '$.user.profile.name');
      expect(result.found).toBe(true);
      expect(result.value).toBe('John');
    });

    it('should get array element', () => {
      const data = {
        items: [10, 20, 30],
      };

      const result = explorer.getValue(data, '$.items[1]');
      expect(result.found).toBe(true);
      expect(result.value).toBe(20);
    });

    it('should return not found for invalid path', () => {
      const data = { name: 'test' };
      const result = explorer.getValue(data, '$.invalid.path');

      expect(result.found).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it('should handle depth parameter for objects', () => {
      const data = {
        user: {
          profile: {
            name: 'John',
            age: 30,
          },
        },
      };

      const result = explorer.getValue(data, '$.user.profile', 1);
      expect(result.found).toBe(true);
      expect(result.structure).toBeDefined();
      expect(result.structure?.length).toBeGreaterThan(0);
    });
  });

  describe('getSchemaSummary', () => {
    it('should generate schema for simple object', () => {
      const data = {
        name: 'test',
        value: 42,
        active: true,
        tags: ['a', 'b'],
      };

      const result = explorer.getSchemaSummary(data, 2);

      expect(result.rootType).toBe('object');
      expect(result.totalKeys).toBeGreaterThan(0);
      expect(result.structure['$.name']).toBeDefined();
      expect(result.structure['$.name'].type).toBe('string');
      expect(result.structure['$.tags'].isArray).toBe(true);
    });

    it('should handle nested structures', () => {
      const data = {
        user: {
          id: 1,
          profile: {
            name: 'John',
          },
        },
      };

      const result = explorer.getSchemaSummary(data, 3);

      expect(result.structure['$.user']).toBeDefined();
      expect(result.structure['$.user.profile']).toBeDefined();
      expect(result.structure['$.user.profile.name']).toBeDefined();
    });

    it('should limit depth in schema', () => {
      const data = {
        a: {
          b: {
            c: {
              d: 'deep',
            },
          },
        },
      };

      const result1 = explorer.getSchemaSummary(data, 1);
      const result2 = explorer.getSchemaSummary(data, 3);

      expect(result2.totalKeys).toBeGreaterThan(result1.totalKeys);
    });

    it('should include array information', () => {
      const data = {
        items: [
          { id: 1, name: 'a' },
          { id: 2, name: 'b' },
        ],
      };

      const result = explorer.getSchemaSummary(data, 2);

      expect(result.structure['$.items'].isArray).toBe(true);
      expect(result.structure['$.items'].arrayLength).toBe(2);
    });
  });

  describe('getTypeInfo', () => {
    it('should get type info for string', () => {
      const info = explorer.getTypeInfo('test');
      expect(info.type).toBe('string');
      expect(info.isArray).toBe(false);
      expect(info.nullable).toBe(false);
    });

    it('should get type info for array', () => {
      const info = explorer.getTypeInfo([1, 2, 3]);
      expect(info.type).toBe('array');
      expect(info.isArray).toBe(true);
      expect(info.arrayLength).toBe(3);
    });

    it('should get type info for object', () => {
      const info = explorer.getTypeInfo({ a: 1, b: 2 });
      expect(info.type).toBe('object');
      expect(info.objectKeys).toEqual(['a', 'b']);
    });

    it('should detect null', () => {
      const info = explorer.getTypeInfo(null);
      expect(info.type).toBe('null');
      expect(info.nullable).toBe(true);
    });
  });
});
