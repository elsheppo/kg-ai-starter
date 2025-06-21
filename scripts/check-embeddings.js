require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkEmbeddings() {
  console.log('Checking node embeddings...\n')
  
  const { data: nodes, error } = await supabase
    .from('kg_nodes')
    .select('id, label, embedding')
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  nodes.forEach(node => {
    const hasEmbedding = node.embedding && node.embedding.length > 0
    console.log(`${node.label}: ${hasEmbedding ? '✅ Has embedding' : '❌ NO EMBEDDING'}`)
  })
  
  const noEmbedding = nodes.filter(n => !n.embedding || n.embedding.length === 0)
  console.log(`\n${noEmbedding.length} out of ${nodes.length} nodes missing embeddings`)
}

checkEmbeddings()