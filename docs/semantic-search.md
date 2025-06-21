# Semantic Search Implementation

## Overview

The Knowledge Graph AI Starter Kit includes semantic search capabilities for both nodes and document chunks. This document explains how the semantic search is implemented and how to ensure it's working properly.

## Implementation Details

### 1. Database Schema

The semantic search functionality relies on PostgreSQL's `pgvector` extension, which is automatically available in Supabase:

```sql
-- Nodes table with embedding column
CREATE TABLE kg_nodes (
    id UUID PRIMARY KEY,
    label VARCHAR(255),
    type VARCHAR(100),
    properties JSONB,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
    ...
);

-- Vector similarity search index
CREATE INDEX idx_nodes_embedding ON kg_nodes USING ivfflat (embedding vector_cosine_ops);
```

### 2. Search Function

The `search_nodes_semantic` function in the database performs cosine similarity search:

```sql
CREATE OR REPLACE FUNCTION search_nodes_semantic(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE(...) AS $$
SELECT
    id, label, type, properties,
    1 - (embedding <=> query_embedding) as similarity
FROM kg_nodes
WHERE embedding IS NOT NULL
AND 1 - (embedding <=> query_embedding) > match_threshold
ORDER BY embedding <=> query_embedding
LIMIT match_count;
$$ LANGUAGE SQL;
```

### 3. API Integration

In `app/api/chat/route.ts`, the `searchNodesSemanticaly` tool (note the typo in the original) is available in hybrid mode:

```typescript
searchNodesSemanticaly: tool({
  description: 'Search for nodes using semantic similarity',
  parameters: searchVectorSchema,
  execute: async ({ query, threshold, limit }) => {
    const embedding = await generateEmbedding(query)
    
    const { data, error } = await supabase.rpc('search_nodes_semantic', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    })

    if (error) throw error
    return data || []
  },
}),
```

## Setting Up Node Embeddings

### During Initial Seed

The seed script now automatically creates embeddings for all nodes:

```bash
npm run seed
```

This will:
1. Clear existing data
2. Create nodes with embeddings
3. Create relationships
4. Process documents

### Updating Existing Nodes

If you have nodes without embeddings or want to update them:

```bash
npm run update-embeddings
```

This script:
1. Fetches all nodes from the database
2. Generates embeddings based on node properties
3. Updates each node with its embedding

## Testing Semantic Search

### 1. Verify Embeddings Exist

Check if nodes have embeddings in Supabase:

```sql
-- In Supabase SQL Editor
SELECT label, embedding IS NOT NULL as has_embedding 
FROM kg_nodes;
```

### 2. Test in Hybrid Mode

In the application:
1. Switch to "Hybrid" mode
2. Try queries like:
   - "Find nodes related to space exploration"
   - "Search for technology concepts"
   - "What nodes are similar to Mars?"

### 3. Direct Database Test

```sql
-- Test with a sample embedding (all 0.5 values)
SELECT * FROM search_nodes_semantic(
  ARRAY_FILL(0.5::float, ARRAY[1536])::vector,
  0.0, -- Low threshold to see all results
  10
);
```

## Troubleshooting

### "Mock embeddings" Warning

If you see this warning, it means the OpenAI API call failed. Check:
- Your OpenAI API key is valid
- You have API credits
- Network connectivity

### No Results from Semantic Search

1. **Check embeddings exist**: Run the SQL query above
2. **Run update script**: `npm run update-embeddings`
3. **Lower threshold**: Try with `threshold: 0.5` or lower
4. **Check logs**: Look for errors in the console

### Performance Issues

- The `ivfflat` index improves search performance
- For large datasets, consider adjusting the index parameters
- Monitor query performance in Supabase dashboard

## Extending Semantic Search

### Custom Embedding Generation

Modify the embedding text in `scripts/update-node-embeddings.ts`:

```typescript
const nodeText = [
  node.label,
  node.type,
  node.properties?.description || '',
  // Add more fields here
  node.properties?.category,
  node.properties?.tags?.join(' '),
].filter(Boolean).join(' - ')
```

### Different Embedding Models

To use a different embedding model, update the model name:

```typescript
const response = await openai.embeddings.create({
  model: 'text-embedding-3-large', // 3072 dimensions
  input: text,
})
```

Remember to update the vector dimensions in the database schema accordingly.

## Best Practices

1. **Always include descriptive properties** when creating nodes
2. **Update embeddings** after significant property changes
3. **Use appropriate thresholds** - start with 0.7 and adjust
4. **Monitor costs** - embedding generation uses API credits
5. **Batch updates** when processing many nodes

## Example Queries

Here are some example queries that work well with semantic search:

- "Find all space-related organizations"
- "Search for Mars exploration concepts"
- "What technologies are similar to Starship?"
- "Show nodes about space history"
- "Find entities related to moon missions"