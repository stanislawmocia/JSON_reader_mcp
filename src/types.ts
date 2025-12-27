/**
 * Configuration for the JSON reader server
 */
export interface Config {
  maxJsonSizeMB: number;
  cacheTTLSeconds: number;
  cacheCheckPeriodSeconds: number;
}

/**
 * Cached JSON entry with metadata
 */
export interface CachedJSON {
  data: unknown;
  source: string;
  cachedAt: Date;
  sizeBytes: number;
}

/**
 * Structure information for a JSON node
 */
export interface StructureNode {
  path: string;
  type: string;
  children?: number;
  arrayLength?: number;
  objectKeys?: string[];
  value?: unknown;
  preview?: string;
}

/**
 * Result from exploring JSON structure
 */
export interface ExploreResult {
  path: string;
  structure: StructureNode[];
  depth: number;
  totalNodes: number;
}

/**
 * Schema summary for JSON
 */
export interface SchemaSummary {
  rootType: string;
  depth: number;
  totalKeys: number;
  structure: Record<string, TypeInfo>;
}

/**
 * Type information for a JSON path
 */
export interface TypeInfo {
  type: string;
  isArray: boolean;
  arrayLength?: number;
  objectKeys?: string[];
  nullable: boolean;
  examples?: unknown[];
}
