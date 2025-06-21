import { streamText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { createServerSideClient } from '@/lib/supabase'
import OpenAI from 'openai'

// Tool schemas
const searchVectorSchema = z.object({
  query: z.string().describe('The search query'),
  threshold: z.number().optional().default(0.7),
  limit: z.number().optional().default(5),
})

const searchGraphSchema = z.object({
  nodeLabel: z.string().describe('Starting node label'),
  maxDepth: z.number().optional().default(2),
})

const createNodeSchema = z.object({
  label: z.string().describe('Node label'),
  type: z.string().optional().describe('Node type (concept, person, technology, etc)'),
  properties: z.record(z.any()).optional().default({}),
})

const createEdgeSchema = z.object({
  sourceLabel: z.string().describe('Source node label'),
  targetLabel: z.string().describe('Target node label'),
  relationship: z.string().describe('Relationship type'),
})

// Helper function for safe tool execution with error handling
function createSafeExecute<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  toolName: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      console.error(`Error in ${toolName}:`, error)
      return {
        error: true,
        message: `Failed to execute ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }
    }
  }) as T
}

export async function POST(req: Request) {
  try {
    const { messages, mode } = await req.json()
    
    // Validate inputs
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (!mode || !['vector', 'graph', 'hybrid'].includes(mode)) {
      return new Response(JSON.stringify({ error: 'Invalid mode. Must be vector, graph, or hybrid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const supabase = await createServerSideClient()

  // Define tools based on mode
  const tools = {
    // Vector RAG tools
    ...(mode === 'vector' || mode === 'hybrid' ? {
      searchDocuments: tool({
        description: 'Search for relevant document chunks using semantic similarity',
        parameters: searchVectorSchema,
        execute: createSafeExecute(async ({ query, threshold, limit }) => {
          // Generate embedding for query
          const embedding = await generateEmbedding(query)
          
          // Search document chunks
          const { data, error } = await supabase.rpc('search_chunks_semantic', {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: limit,
          })

          if (error) throw error
          return data || []
        }, 'searchDocuments'),
      }),
    } : {}),

    // Graph RAG tools
    ...(mode === 'graph' || mode === 'hybrid' ? {
      traverseGraph: tool({
        description: 'Traverse the knowledge graph starting from a node',
        parameters: searchGraphSchema,
        execute: async ({ nodeLabel, maxDepth }) => {
          // First find the node
          const { data: nodes } = await supabase
            .from('kg_nodes')
            .select('*')
            .eq('label', nodeLabel)
            .limit(1)

          if (!nodes || nodes.length === 0) {
            return { error: 'Node not found' }
          }

          // Get connected nodes
          const { data, error } = await supabase.rpc('get_connected_nodes', {
            node_id: nodes[0].id,
            max_depth: maxDepth,
          })

          if (error) throw error
          return { startNode: nodes[0], connectedNodes: data || [] }
        },
      }),

      createNode: tool({
        description: 'Create a new node in the knowledge graph',
        parameters: createNodeSchema,
        execute: async ({ label, type, properties }) => {
          const { data, error } = await supabase
            .from('kg_nodes')
            .insert({ label, type, properties })
            .select()
            .single()

          if (error) throw error
          return data
        },
      }),

      createEdge: tool({
        description: 'Create a relationship between two nodes',
        parameters: createEdgeSchema,
        execute: async ({ sourceLabel, targetLabel, relationship }) => {
          // Find both nodes
          const { data: sourceNodes } = await supabase
            .from('kg_nodes')
            .select('id')
            .eq('label', sourceLabel)
            .limit(1)

          const { data: targetNodes } = await supabase
            .from('kg_nodes')
            .select('id')
            .eq('label', targetLabel)
            .limit(1)

          if (!sourceNodes?.[0] || !targetNodes?.[0]) {
            return { error: 'One or both nodes not found' }
          }

          const { data, error } = await supabase
            .from('kg_edges')
            .insert({
              source_id: sourceNodes[0].id,
              target_id: targetNodes[0].id,
              relationship,
            })
            .select()
            .single()

          if (error) throw error
          return data
        },
      }),

      updateGraph: tool({
        description: 'Update the graph visualization with current nodes and edges',
        parameters: z.object({
          operation: z.enum(['add', 'refresh']).describe('Type of update operation'),
          nodeId: z.string().optional().describe('Node ID for focused updates'),
        }),
        execute: async ({ operation, nodeId }) => {
          // For refresh operation, get latest graph data
          if (operation === 'refresh') {
            const query = nodeId 
              ? supabase.rpc('get_node_connections', { node_id: nodeId })
              : supabase.from('kg_nodes').select(`
                  *,
                  source_edges:kg_edges!source_id(*),
                  target_edges:kg_edges!target_id(*)
                `).limit(50)
            
            const { data, error } = await query
            if (error) throw error
            
            // Transform data for visualization
            const nodes = data?.map((node: any) => ({
              id: node.id,
              label: node.label,
              type: node.type || 'entity',
              description: node.properties?.description,
            })) || []
            
            const edges: Array<{ id: string; source: string; target: string; label: string }> = []
            if (data) {
              data.forEach((node: any) => {
                node.source_edges?.forEach((edge: any) => {
                  edges.push({
                    id: edge.id,
                    source: edge.source_id,
                    target: edge.target_id,
                    label: edge.relationship,
                  })
                })
              })
            }
            
            return { nodes, edges, operation: 'refresh' }
          }
          
          // For add operation, just signal the frontend to fetch new data
          return { operation: 'add', message: 'Graph updated' }
        },
      }),
    } : {}),

    // Hybrid mode gets semantic search on nodes
    ...(mode === 'hybrid' ? {
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
    } : {}),
  }

  // Different system prompts based on mode
  const systemPrompts = {
    vector: `You are a helpful AI assistant using Vector RAG. You search through document chunks using semantic similarity to find relevant information. Use the searchDocuments tool to find relevant content based on the user's query.

IMPORTANT: When providing information from documents, ALWAYS cite your sources:
- Quote relevant passages from the chunks you found
- At the end of your response, include a "🔍 Sources:" section
- List each document chunk with its title and a brief excerpt
- This proves the information came from RAG, not your training data`,
    
    graph: `You are a helpful AI assistant using GraphRAG. You navigate through a knowledge graph to find information and can create new nodes and relationships. Use the traverseGraph tool to explore connections, createNode/createEdge to build the graph, and updateGraph to visualize the current state. Always call updateGraph with operation: 'refresh' after creating nodes or edges to show the updated graph.

IMPORTANT: When providing information from the knowledge graph, ALWAYS cite your sources:
- Mention which nodes you traversed and what relationships you followed
- At the end of your response, include a "🕸️ Graph Path:" section
- Show the path like: NASA → [operates] → ISS
- This proves the information came from the graph, not your training data`,
    
    hybrid: `You are a helpful AI assistant using Hybrid RAG. You combine semantic search with graph traversal for the best results. You can search documents, search nodes semantically, traverse the graph, and create new knowledge connections. Use updateGraph to visualize the knowledge graph after making changes.

IMPORTANT: When providing information, ALWAYS cite your sources clearly:
- For document searches: Quote passages and include "🔍 Document Sources:"
- For graph traversals: Show paths and include "🕸️ Graph Paths:"
- For semantic node searches: Show matches and include "🎯 Matched Nodes:" with similarity scores
- This transparency shows which RAG method provided each piece of information`,
  }

    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages,
      system: systemPrompts[mode as keyof typeof systemPrompts],
      tools,
      maxSteps: 5,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('Chat API error:', error)
    
    // Return a proper error response
    return new Response(
      JSON.stringify({
        error: 'An error occurred processing your request',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Initialize OpenAI client for embeddings
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Helper function to generate embeddings
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Truncate text to avoid token limits
    const truncatedText = text.slice(0, 8000)
    
    const response = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: truncatedText,
    })
    
    return response.data[0].embedding
  } catch (error) {
    console.error('Embedding generation failed:', error)
    // Fallback to mock embeddings for demo continuity
    console.warn('Using mock embeddings as fallback')
    return Array(1536).fill(0).map(() => Math.random())
  }
}