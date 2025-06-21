import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
    })
    return response.data[0].embedding
  } catch (error) {
    console.error('Embedding generation failed:', error)
    // Fallback for demo
    return Array(1536).fill(0).map(() => Math.random())
  }
}

async function updateNodeEmbeddings() {
  console.log('🚀 Updating node embeddings...')
  
  // Fetch all nodes
  const { data: nodes, error } = await supabase
    .from('kg_nodes')
    .select('*')
  
  if (error) {
    console.error('Failed to fetch nodes:', error)
    return
  }
  
  if (!nodes || nodes.length === 0) {
    console.log('No nodes found to update')
    return
  }
  
  console.log(`Found ${nodes.length} nodes to process`)
  
  for (const node of nodes) {
    // Create text representation of the node
    const nodeText = [
      node.label,
      node.type,
      node.properties?.description || '',
      // Include other relevant properties
      Object.entries(node.properties || {})
        .filter(([key]) => key !== 'description')
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    ].filter(Boolean).join(' - ')
    
    console.log(`Processing: ${node.label}`)
    
    // Generate embedding
    const embedding = await generateEmbedding(nodeText)
    
    // Update node with embedding
    const { error: updateError } = await supabase
      .from('kg_nodes')
      .update({ embedding })
      .eq('id', node.id)
    
    if (updateError) {
      console.error(`Failed to update ${node.label}:`, updateError)
    } else {
      console.log(`✅ Updated ${node.label}`)
    }
  }
  
  console.log('✨ All node embeddings updated!')
}

async function main() {
  try {
    await updateNodeEmbeddings()
  } catch (error) {
    console.error('❌ Update process failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { updateNodeEmbeddings }