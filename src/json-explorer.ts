import { JSONPath } from 'jsonpath-plus';
import {
  StructureNode,
  ExploreResult,
  SchemaSummary,
  TypeInfo,
} from './types.js';

/**
 * Explores JSON structures with depth control for token optimization
 * LLM Usage: Use explore() to navigate large JSON incrementally. Start with low depth, then drill down.
 */
export class JSONExplorer {
  /**
   * Explore JSON structure from a given path with controlled depth
   * Returns structure information without full data - optimized for LLM token usage
   *
   * @param data - Full JSON data to explore
   * @param path - JSONPath to start exploration from (default: '$' for root)
   * @param depth - How many levels deep to explore (1 = immediate children only)
   * @returns Structure information at the specified path and depth
   *
   * Example:
   *   explore(data, '$', 1) - Shows top-level keys only
   *   explore(data, '$.user', 2) - Shows user object and its immediate children
   *   explore(data, '$.users[0]', 1) - Shows first user's immediate properties
   */
  explore(data: unknown, path: string = '$', depth: number = 1): ExploreResult {
    const structure: StructureNode[] = [];

    // Get the starting point in the data
    const startData = path === '$' ? data : this.getValueAtPath(data, path);

    if (startData === undefined) {
      return {
        path,
        structure: [],
        depth,
        totalNodes: 0,
      };
    }

    // Explore from this point
    this.exploreNode(startData, path, depth, 0, structure);

    return {
      path,
      structure,
      depth,
      totalNodes: structure.length,
    };
  }

  /**
   * Get exact value at a JSONPath with optional depth for nested objects
   *
   * @param data - Full JSON data
   * @param path - JSONPath to the value
   * @param depth - If result is object/array, how deep to explore it (0 = value only)
   * @returns Value and metadata at the path
   *
   * Example:
   *   getValue(data, '$.user.name') - Returns "John Doe"
   *   getValue(data, '$.users[0]', 1) - Returns first user with structure info
   */
  getValue(
    data: unknown,
    path: string,
    depth: number = 0
  ): {
    found: boolean;
    value?: unknown;
    type?: string;
    structure?: StructureNode[];
  } {
    const value = this.getValueAtPath(data, path);

    if (value === undefined) {
      return { found: false };
    }

    const typeInfo = this.getTypeInfo(value);
    const result: {
      found: boolean;
      value?: unknown;
      type?: string;
      structure?: StructureNode[];
    } = {
      found: true,
      value,
      type: typeInfo.type,
    };

    // If depth > 0 and value is complex, include structure
    if (depth > 0 && (typeInfo.type === 'object' || typeInfo.type === 'array')) {
      const structure: StructureNode[] = [];
      this.exploreNode(value, path, depth, 0, structure);
      result.structure = structure;
    }

    return result;
  }

  /**
   * Get comprehensive schema/type information for JSON data
   * Useful for understanding the shape of data before detailed exploration
   *
   * @param data - JSON data to analyze
   * @param maxDepth - Maximum depth to analyze (prevents token overflow on deep structures)
   * @returns Schema summary with type information for all paths
   *
   * Example:
   *   getSchemaSummary(data, 2) - Returns types for all paths up to 2 levels deep
   */
  getSchemaSummary(data: unknown, maxDepth: number = 3): SchemaSummary {
    const structure: Record<string, TypeInfo> = {};
    const rootType = this.getTypeInfo(data);

    this.buildSchema(data, '$', maxDepth, 0, structure);

    return {
      rootType: rootType.type,
      depth: maxDepth,
      totalKeys: Object.keys(structure).length,
      structure,
    };
  }

  /**
   * Get type information for a value
   */
  getTypeInfo(value: unknown): TypeInfo {
    if (value === null) {
      return { type: 'null', isArray: false, nullable: true };
    }

    if (value === undefined) {
      return { type: 'undefined', isArray: false, nullable: true };
    }

    if (Array.isArray(value)) {
      return {
        type: 'array',
        isArray: true,
        arrayLength: value.length,
        nullable: false,
      };
    }

    const type = typeof value;

    if (type === 'object') {
      return {
        type: 'object',
        isArray: false,
        objectKeys: Object.keys(value as object),
        nullable: false,
      };
    }

    return {
      type,
      isArray: false,
      nullable: false,
    };
  }

  /**
   * Recursively explore a node and build structure information
   */
  private exploreNode(
    value: unknown,
    currentPath: string,
    maxDepth: number,
    currentDepth: number,
    structure: StructureNode[]
  ): void {
    if (currentDepth >= maxDepth) {
      return;
    }

    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      // For arrays, show information about the array itself
      value.forEach((item, index) => {
        const itemPath = `${currentPath}[${index}]`;
        const typeInfo = this.getTypeInfo(item);

        const node: StructureNode = {
          path: itemPath,
          type: typeInfo.type,
          preview: this.getPreview(item),
        };

        if (typeInfo.isArray) {
          node.arrayLength = typeInfo.arrayLength;
        }

        if (typeInfo.type === 'object' && typeInfo.objectKeys) {
          node.objectKeys = typeInfo.objectKeys;
          node.children = typeInfo.objectKeys.length;
        }

        structure.push(node);

        // Recurse if not at max depth
        if (currentDepth + 1 < maxDepth) {
          this.exploreNode(item, itemPath, maxDepth, currentDepth + 1, structure);
        }
      });
    } else if (typeof value === 'object') {
      // For objects, show each key
      const obj = value as Record<string, unknown>;

      Object.keys(obj).forEach((key) => {
        const keyPath = currentPath === '$' ? `$.${key}` : `${currentPath}.${key}`;
        const val = obj[key];
        const typeInfo = this.getTypeInfo(val);

        const node: StructureNode = {
          path: keyPath,
          type: typeInfo.type,
          preview: this.getPreview(val),
        };

        if (typeInfo.isArray) {
          node.arrayLength = typeInfo.arrayLength;
        }

        if (typeInfo.type === 'object' && typeInfo.objectKeys) {
          node.objectKeys = typeInfo.objectKeys;
          node.children = typeInfo.objectKeys.length;
        }

        structure.push(node);

        // Recurse if not at max depth
        if (currentDepth + 1 < maxDepth) {
          this.exploreNode(val, keyPath, maxDepth, currentDepth + 1, structure);
        }
      });
    }
  }

  /**
   * Build schema information recursively
   */
  private buildSchema(
    value: unknown,
    currentPath: string,
    maxDepth: number,
    currentDepth: number,
    schema: Record<string, TypeInfo>
  ): void {
    const typeInfo = this.getTypeInfo(value);
    schema[currentPath] = typeInfo;

    // Stop recursion if we've reached max depth
    if (currentDepth >= maxDepth) {
      return;
    }

    if (Array.isArray(value) && value.length > 0) {
      // Analyze first element as representative of array items
      const firstItem = value[0];
      const itemPath = `${currentPath}[0]`;
      this.buildSchema(firstItem, itemPath, maxDepth, currentDepth + 1, schema);
    } else if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      Object.keys(obj).forEach((key) => {
        const keyPath = currentPath === '$' ? `$.${key}` : `${currentPath}.${key}`;
        this.buildSchema(obj[key], keyPath, maxDepth, currentDepth + 1, schema);
      });
    }
  }

  /**
   * Get value at JSONPath
   */
  private getValueAtPath(data: unknown, path: string): unknown {
    if (path === '$') {
      return data;
    }

    try {
      const results = JSONPath({ path, json: data as any, wrap: false });
      return results;
    } catch {
      return undefined;
    }
  }

  /**
   * Generate a preview string for a value (truncated for large objects)
   */
  private getPreview(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    const type = typeof value;

    if (type === 'string') {
      const str = value as string;
      return str.length > 50 ? `"${str.substring(0, 47)}..."` : `"${str}"`;
    }

    if (type === 'number' || type === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }

    if (type === 'object') {
      const keys = Object.keys(value as object);
      return `Object{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
    }

    return String(value);
  }
}
