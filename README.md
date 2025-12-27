# MCP JSON Reader Server

LLM-optimized MCP server for exploring large JSON files with minimal token usage. Designed with an "LLM-first" approach - every tool and description guides AI models to work efficiently with huge JSON structures.

## Features

- **Incremental Exploration**: Navigate JSON like `tree` command in bash - explore structure level by level
- **Token Optimization**: Control depth to minimize token usage while exploring large files
- **Smart Caching**: Cache JSON from files or URLs with configurable TTL
- **JSONPath Support**: Use standard JSONPath expressions for precise navigation
- **Type Intelligence**: Get schema/type information before fetching data
- **Size Limits**: Configurable size limits (default 100MB) for safety

## Installation

```bash
npm install
npm run build
```

## Configuration

Create `.env` file (see `.env.example`):

```env
# Maximum JSON file size in MB (default: 100)
MAX_JSON_SIZE_MB=100

# Cache TTL in seconds (default: 3600 = 1 hour)
CACHE_TTL_SECONDS=3600

# Cache check period in seconds (default: 600)
CACHE_CHECK_PERIOD_SECONDS=600
```

## MCP Tools

### 1. `cache_json`

Cache JSON from file or URL. **Always use this first.**

```json
{
  "source": "/path/to/file.json",
  "type": "file"
}
```

Returns `cache_id` for use in other tools.

### 2. `explore_json`

Explore JSON structure incrementally with depth control.

```json
{
  "cache_id": "abc123",
  "path": "$.user",
  "depth": 1
}
```

**Recommended workflow for large JSON:**
1. Start: `explore_json(cache_id, "$", depth=1)` - See top-level keys
2. Drill: `explore_json(cache_id, "$.users", depth=1)` - Explore specific section
3. Go deeper: `explore_json(cache_id, "$.users[0]", depth=2)` - Multiple levels

**Depth guide:**
- `depth=1`: Immediate children only (minimal tokens)
- `depth=2`: Children and grandchildren
- `depth=3+`: Multiple levels (use sparingly)

### 3. `get_value`

Get exact value at JSONPath.

```json
{
  "cache_id": "abc123",
  "path": "$.user.profile.email",
  "depth": 0
}
```

**JSONPath examples:**
- `$.user.name` - Get user's name
- `$.items[0]` - Get first array item
- `$.users[*].email` - Get all user emails
- `$..price` - Get all price fields (recursive)

**Depth parameter:**
- `depth=0` (default): Return raw value only
- `depth=1+`: Include structure info for objects/arrays

### 4. `get_schema_summary`

Get type/schema information for entire JSON.

```json
{
  "cache_id": "abc123",
  "max_depth": 3
}
```

Perfect for initial reconnaissance of unknown JSON structures.

## Usage Example

### Exploring Large JSON File

```typescript
// 1. Cache the JSON
const cacheResult = await cache_json({
  source: "./data/large-api-response.json",
  type: "file"
});
// Returns: { cache_id: "abc123", ... }

// 2. Get schema overview
const schema = await get_schema_summary({
  cache_id: "abc123",
  max_depth: 2
});
// See all paths and types up to 2 levels deep

// 3. Explore top level
const topLevel = await explore_json({
  cache_id: "abc123",
  path: "$",
  depth: 1
});
// Shows: { users: Object, metadata: Object, ... }

// 4. Drill into users array
const users = await explore_json({
  cache_id: "abc123",
  path: "$.users",
  depth: 1
});
// Shows array structure without full data

// 5. Get specific user
const user = await get_value({
  cache_id: "abc123",
  path: "$.users[0].email",
  depth: 0
});
// Returns: "john@example.com"
```

## Token Optimization Patterns

### Pattern 1: Schema-First Approach

```typescript
// Start with low-depth schema
const schema = await get_schema_summary({ cache_id, max_depth: 1 });

// Identify interesting paths from schema
// Then explore those paths specifically
const details = await explore_json({
  cache_id,
  path: "$.identified.path",
  depth: 2
});
```

### Pattern 2: Incremental Drilling

```typescript
// Don't jump to deep exploration immediately
// Bad: explore_json({ path: "$", depth: 5 }) // Too many tokens!

// Good: Start shallow, go deeper only where needed
await explore_json({ path: "$", depth: 1 });
await explore_json({ path: "$.section", depth: 1 });
await explore_json({ path: "$.section.subsection", depth: 2 });
```

### Pattern 3: Direct Access When Possible

```typescript
// If you know the path, get value directly
// Don't explore if you already know what you want
const value = await get_value({
  cache_id,
  path: "$.known.path.to.value",
  depth: 0
});
```

## Development

### Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Structure

```
tests/
├── fixtures/          # Sample JSON files
│   ├── simple.json
│   ├── nested.json
│   └── large-array.json
├── unit/             # Unit tests
│   ├── cache-manager.test.ts
│   └── json-explorer.test.ts
└── integration/      # Integration tests
    └── full-workflow.test.ts
```

## Architecture

```
src/
├── index.ts           # MCP server with 4 tools
├── cache-manager.ts   # Handles JSON caching
├── json-explorer.ts   # JSON exploration logic
├── config.ts          # Environment configuration
└── types.ts          # TypeScript interfaces
```

### Key Components

- **CacheManager**: Manages JSON caching with TTL and size limits
- **JSONExplorer**: Provides depth-controlled exploration and JSONPath queries
- **MCP Server**: Exposes 4 tools with LLM-optimized descriptions

## LLM-First Design Principles

1. **Descriptive Tool Names**: Clear, action-oriented names
2. **Guided Workflows**: Tool descriptions explain when and how to use each tool
3. **Token Awareness**: Depth parameters give LLMs control over response size
4. **Progressive Disclosure**: Start broad, drill down incrementally
5. **Helpful Responses**: Include tips and next-step suggestions in responses

## License

MIT

## Contributing

PRs welcome! Please ensure:
- All tests pass (`npm test`)
- New features include tests
- Follow existing code style
