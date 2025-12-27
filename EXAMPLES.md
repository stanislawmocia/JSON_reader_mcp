# Usage Examples

## Example 1: Exploring GitHub API Response

Large API responses can be explored efficiently without loading everything into context.

```typescript
// 1. Cache the API response
await cache_json({
  source: "https://api.github.com/repos/microsoft/vscode",
  type: "url"
});
// cache_id: "xyz789"

// 2. Get schema to understand structure
await get_schema_summary({
  cache_id: "xyz789",
  max_depth: 2
});
/* Returns:
{
  "$.id": { type: "number" },
  "$.name": { type: "string" },
  "$.owner": { type: "object", objectKeys: ["login", "id", "avatar_url", ...] },
  "$.owner.login": { type: "string" },
  ...
}
*/

// 3. Explore owner object
await explore_json({
  cache_id: "xyz789",
  path: "$.owner",
  depth: 1
});
/* Shows:
- $.owner.login (string): "microsoft"
- $.owner.id (number): 12345
- $.owner.type (string): "Organization"
...
*/

// 4. Get specific values
await get_value({
  cache_id: "xyz789",
  path: "$.name"
});
// Returns: "vscode"

await get_value({
  cache_id: "xyz789",
  path: "$.owner.login"
});
// Returns: "microsoft"
```

## Example 2: Analyzing E-commerce Product Catalog

Working with large product arrays efficiently.

```json
// products.json (1000+ products)
{
  "products": [
    {
      "id": "prod-1",
      "name": "Laptop",
      "price": 999.99,
      "specs": {
        "cpu": "Intel i7",
        "ram": "16GB",
        "storage": "512GB SSD"
      },
      "reviews": [...]
    },
    // ... 1000 more products
  ],
  "metadata": {
    "total": 1000,
    "categories": [...]
  }
}
```

### Efficient Exploration

```typescript
// 1. Cache large file
await cache_json({
  source: "./products.json",
  type: "file"
});
// cache_id: "prod123"

// 2. Quick overview (depth=1 for top level only)
await explore_json({
  cache_id: "prod123",
  path: "$",
  depth: 1
});
/* Returns:
- $.products (array): Array(1000)
- $.metadata (object): Object{total, categories, ...}
*/

// 3. Peek at array structure (first element only)
await explore_json({
  cache_id: "prod123",
  path: "$.products[0]",
  depth: 1
});
/* Shows structure of one product:
- $.products[0].id (string)
- $.products[0].name (string)
- $.products[0].price (number)
- $.products[0].specs (object)
- $.products[0].reviews (array)
*/

// 4. Get specific product details
await get_value({
  cache_id: "prod123",
  path: "$.products[0].specs.cpu"
});
// Returns: "Intel i7"

// 5. Get all product names (if using JSONPath wildcards)
await get_value({
  cache_id: "prod123",
  path: "$.products[*].name"
});
// Returns: ["Laptop", "Phone", "Tablet", ...]
```

## Example 3: Deeply Nested Configuration

Working with complex nested structures.

```json
// config.json
{
  "application": {
    "name": "MyApp",
    "version": "2.0.0",
    "services": {
      "api": {
        "endpoints": {
          "users": {
            "list": { "path": "/api/users", "method": "GET" },
            "create": { "path": "/api/users", "method": "POST" }
          },
          "posts": {
            "list": { "path": "/api/posts", "method": "GET" }
          }
        }
      },
      "database": {
        "connections": {
          "primary": {
            "host": "localhost",
            "port": 5432
          }
        }
      }
    }
  }
}
```

### Step-by-Step Navigation

```typescript
// 1. Cache config
await cache_json({
  source: "./config.json",
  type: "file"
});
// cache_id: "cfg456"

// 2. Start at root (minimal tokens)
await explore_json({
  cache_id: "cfg456",
  path: "$",
  depth: 1
});
// Shows: $.application

// 3. Go one level deeper
await explore_json({
  cache_id: "cfg456",
  path: "$.application",
  depth: 1
});
// Shows: $.application.name, $.application.version, $.application.services

// 4. Focus on services
await explore_json({
  cache_id: "cfg456",
  path: "$.application.services",
  depth: 2
});
// Shows api and database with their immediate children

// 5. Get specific endpoint config
await get_value({
  cache_id: "cfg456",
  path: "$.application.services.api.endpoints.users.list"
});
// Returns: { "path": "/api/users", "method": "GET" }
```

## Example 4: Token-Optimized Pattern for Unknown JSON

When you receive a large JSON and don't know its structure.

```typescript
const cache_id = "unknown123";

// Step 1: Get schema at low depth first (minimizes tokens)
const schema = await get_schema_summary({
  cache_id,
  max_depth: 1
});
console.log("Root keys:", Object.keys(schema.structure));
// Outputs: ["$.data", "$.metadata", "$.errors"]

// Step 2: Explore interesting sections
const dataSchema = await get_schema_summary({
  cache_id,
  max_depth: 2,
});
// Now you see $.data.* paths

// Step 3: Drill into specific paths
await explore_json({
  cache_id,
  path: "$.data",
  depth: 1
});

// Step 4: Once you know what you want, get it directly
await get_value({
  cache_id,
  path: "$.data.results[0].id"
});
```

## Example 5: Working with Multiple Cached JSONs

Managing multiple JSON files in a session.

```typescript
// Cache multiple sources
const users_cache = await cache_json({
  source: "./users.json",
  type: "file"
});
// cache_id: "users001"

const products_cache = await cache_json({
  source: "./products.json",
  type: "file"
});
// cache_id: "prod002"

const api_cache = await cache_json({
  source: "https://api.example.com/data",
  type: "url"
});
// cache_id: "api003"

// Work with each independently
const user = await get_value({
  cache_id: "users001",
  path: "$.users[0].name"
});

const product = await get_value({
  cache_id: "prod002",
  path: "$.products[0].price"
});

const apiData = await get_value({
  cache_id: "api003",
  path: "$.response.data"
});
```

## Example 6: Handling Arrays Efficiently

Exploring large arrays without loading all elements.

```json
{
  "users": [
    { "id": 1, "name": "Alice", "posts": [...] },
    { "id": 2, "name": "Bob", "posts": [...] },
    // ... 10,000 more users
  ]
}
```

```typescript
// Bad: Don't do this with large arrays!
// await explore_json({ cache_id, path: "$.users", depth: 3 })
// This would return structure for ALL 10,000 users = token explosion

// Good: Sample array structure first
await explore_json({
  cache_id,
  path: "$.users[0]",
  depth: 2
});
// Shows structure of ONE user - representative sample

// Then get specific users by index
await get_value({
  cache_id,
  path: "$.users[42]",
  depth: 1
});

// Or use JSONPath to filter (if supported)
await get_value({
  cache_id,
  path: "$.users[?(@.id == 42)]"
});
```

## Example 7: Real-time API Data Caching

Cache API responses with automatic expiration.

```typescript
// Cache API response (expires after 1 hour by default)
const cache = await cache_json({
  source: "https://api.weather.com/current",
  type: "url"
});

// Explore and use
await explore_json({ cache_id: cache.cache_id, path: "$", depth: 2 });
const temp = await get_value({ cache_id: cache.cache_id, path: "$.temperature" });

// After 1 hour, cache expires automatically
// Need to re-cache for fresh data
```

## Best Practices Summary

1. **Always cache first**: `cache_json` before any exploration
2. **Start shallow**: Use `depth=1` initially
3. **Use schema for reconnaissance**: `get_schema_summary` helps plan exploration
4. **Drill down incrementally**: Increase depth only where needed
5. **Direct access when possible**: If you know the path, use `get_value` directly
6. **Sample arrays**: Explore `[0]` element instead of entire array
7. **Reuse cache_id**: Cache once, explore many times
