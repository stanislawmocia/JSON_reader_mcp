#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { CacheManager } from './cache-manager.js';
import { JSONExplorer } from './json-explorer.js';
import { loadConfig } from './config.js';
import { z } from 'zod';

// Load configuration
const config = loadConfig();

// Initialize managers
const cacheManager = new CacheManager(config);
const jsonExplorer = new JSONExplorer();

// Define tool schemas
const CacheJSONSchema = z.object({
  source: z.string().describe('File path or URL to JSON data'),
  type: z.enum(['file', 'url']).describe('Source type: file or url'),
});

const ExploreJSONSchema = z.object({
  cache_id: z.string().describe('Cache ID returned from cache_json tool'),
  path: z.string().default('$').describe('JSONPath to explore from (default: $ for root)'),
  depth: z.number().default(1).describe('Depth levels to explore (1-5 recommended for token optimization)'),
});

const GetValueSchema = z.object({
  cache_id: z.string().describe('Cache ID returned from cache_json tool'),
  path: z.string().describe('JSONPath to get value from (e.g., $.user.name or $.items[0])'),
  depth: z.number().default(0).describe('If result is object/array, depth to explore (0 = value only)'),
});

const GetSchemaSchema = z.object({
  cache_id: z.string().describe('Cache ID returned from cache_json tool'),
  max_depth: z.number().default(3).describe('Maximum depth to analyze schema (1-5 recommended)'),
});

// Define tools with LLM-optimized descriptions
const tools: Tool[] = [
  {
    name: 'cache_json',
    description: `Cache JSON data from file or URL for exploration. ALWAYS use this FIRST before any other operation.

Returns cache_id needed for all subsequent operations. Cached data expires after ${Math.floor(config.cacheTTLSeconds / 60)} minutes.

Use cases:
- Load large JSON files without reading entire content
- Cache remote JSON from APIs for repeated exploration
- Prepare JSON for incremental, token-efficient exploration

Best practices:
1. Call this once per JSON source
2. Save the returned cache_id
3. Use cache_id in all explore/get operations
4. Re-cache if cache expires or data changes`,
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'File path (absolute or relative) or URL to JSON data',
        },
        type: {
          type: 'string',
          enum: ['file', 'url'],
          description: 'Source type: "file" for local files, "url" for HTTP/HTTPS URLs',
        },
      },
      required: ['source', 'type'],
    },
  },
  {
    name: 'explore_json',
    description: `Explore JSON structure incrementally with controlled depth - OPTIMIZED for minimal token usage.

Like 'tree' command in bash but for JSON. Returns structure information WITHOUT full data.

Key benefits:
- Navigate large JSON files step-by-step
- See structure before fetching data
- Control token usage via depth parameter

Recommended workflow for large JSON:
1. Start: explore_json(cache_id, "$", depth=1) - See top-level keys
2. Then: explore_json(cache_id, "$.user", depth=1) - Drill into specific section
3. Continue: explore_json(cache_id, "$.user.posts", depth=2) - Go deeper as needed

Depth guide:
- depth=1: Immediate children only (minimal tokens)
- depth=2: Children and grandchildren (moderate)
- depth=3+: Multiple levels (use sparingly)

Returns: Array of StructureNode with path, type, preview, and metadata`,
    inputSchema: {
      type: 'object',
      properties: {
        cache_id: {
          type: 'string',
          description: 'Cache ID from cache_json tool',
        },
        path: {
          type: 'string',
          description: 'JSONPath to start exploration (default: "$" for root). Examples: "$", "$.user", "$.items[0]"',
          default: '$',
        },
        depth: {
          type: 'number',
          description: 'Levels to explore (1-5). Lower = fewer tokens. Start with 1, increase only if needed.',
          default: 1,
          minimum: 1,
          maximum: 10,
        },
      },
      required: ['cache_id'],
    },
  },
  {
    name: 'get_value',
    description: `Get exact value at specific JSONPath. Use when you know the path and need the actual data.

When to use:
- After exploring structure, get specific values
- Retrieve known paths directly
- Extract data for processing

JSONPath examples:
- $.user.name - Get user's name
- $.items[0] - Get first item
- $.users[*].email - Get all user emails (returns array)
- $..price - Get all price fields (recursive)

Depth parameter:
- depth=0 (default): Return raw value only
- depth=1+: If value is object/array, include structure info

Returns: { found: boolean, value: any, type: string, structure?: StructureNode[] }`,
    inputSchema: {
      type: 'object',
      properties: {
        cache_id: {
          type: 'string',
          description: 'Cache ID from cache_json tool',
        },
        path: {
          type: 'string',
          description: 'JSONPath to value. Examples: "$.user.name", "$.items[0].price", "$..id"',
        },
        depth: {
          type: 'number',
          description: 'For object/array results: depth to explore structure (0 = value only)',
          default: 0,
          minimum: 0,
          maximum: 5,
        },
      },
      required: ['cache_id', 'path'],
    },
  },
  {
    name: 'get_schema_summary',
    description: `Get type/schema information for entire JSON or subsection. Understand data shape before exploring.

Perfect for:
- Initial reconnaissance of unknown JSON
- Understanding complex nested structures
- Planning which paths to explore in detail
- API response structure analysis

Returns comprehensive type map showing:
- All paths up to max_depth
- Type for each path (string, number, object, array, etc.)
- Array lengths
- Object keys
- Nullable fields

Use this BEFORE detailed exploration to:
1. See overall structure
2. Identify interesting paths
3. Plan your exploration strategy

Depth guide:
- max_depth=1: Top-level overview
- max_depth=2: Good balance for most JSONs
- max_depth=3: Detailed analysis
- max_depth=4+: Very deep structures (more tokens)`,
    inputSchema: {
      type: 'object',
      properties: {
        cache_id: {
          type: 'string',
          description: 'Cache ID from cache_json tool',
        },
        max_depth: {
          type: 'number',
          description: 'Maximum depth to analyze (1-5). Lower = fewer tokens, faster response.',
          default: 3,
          minimum: 1,
          maximum: 10,
        },
      },
      required: ['cache_id'],
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'mcp-json-reader-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'cache_json': {
        const { source, type } = CacheJSONSchema.parse(args);

        let cacheId: string;
        if (type === 'file') {
          cacheId = await cacheManager.cacheFromFile(source);
        } else {
          cacheId = await cacheManager.cacheFromURL(source);
        }

        const cached = cacheManager.get(cacheId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  cache_id: cacheId,
                  source,
                  size_bytes: cached?.sizeBytes,
                  cached_at: cached?.cachedAt,
                  expires_in_seconds: config.cacheTTLSeconds,
                  message: `JSON cached successfully. Use cache_id="${cacheId}" for exploration.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'explore_json': {
        const { cache_id, path, depth } = ExploreJSONSchema.parse(args);

        const cached = cacheManager.get(cache_id);
        if (!cached) {
          throw new Error(
            `Cache ID "${cache_id}" not found or expired. Use cache_json tool first.`
          );
        }

        const result = jsonExplorer.explore(cached.data, path, depth);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  path: result.path,
                  depth: result.depth,
                  total_nodes: result.totalNodes,
                  structure: result.structure,
                  tip: result.totalNodes === 0
                    ? 'Path not found or is a primitive value. Try different path or check with get_value.'
                    : result.totalNodes > 20
                    ? 'Large result. Consider exploring specific sub-paths with depth=1 for better token efficiency.'
                    : 'Use get_value tool to retrieve actual data at specific paths.',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_value': {
        const { cache_id, path, depth } = GetValueSchema.parse(args);

        const cached = cacheManager.get(cache_id);
        if (!cached) {
          throw new Error(
            `Cache ID "${cache_id}" not found or expired. Use cache_json tool first.`
          );
        }

        const result = jsonExplorer.getValue(cached.data, path, depth);

        if (!result.found) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    found: false,
                    path,
                    message: `No value found at path "${path}". Use explore_json to see available paths.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  found: true,
                  path,
                  type: result.type,
                  value: result.value,
                  structure: result.structure,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_schema_summary': {
        const { cache_id, max_depth } = GetSchemaSchema.parse(args);

        const cached = cacheManager.get(cache_id);
        if (!cached) {
          throw new Error(
            `Cache ID "${cache_id}" not found or expired. Use cache_json tool first.`
          );
        }

        const result = jsonExplorer.getSchemaSummary(cached.data, max_depth);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  root_type: result.rootType,
                  max_depth: result.depth,
                  total_keys: result.totalKeys,
                  schema: result.structure,
                  tip: 'Use explore_json or get_value to retrieve actual data at specific paths.',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: errorMessage,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP JSON Reader Server running on stdio');
  console.error(`Max JSON size: ${config.maxJsonSizeMB}MB`);
  console.error(`Cache TTL: ${Math.floor(config.cacheTTLSeconds / 60)} minutes`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
