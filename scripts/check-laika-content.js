require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkLaikaContent() {
  console.log('Searching for Laika in documents...\n')
  
  // Check documents
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
  
  console.log('Documents:')
  docs.forEach(doc => {
    console.log(`- ${doc.title}`)
    if (doc.content.toLowerCase().includes('laika')) {
      console.log('  ✅ Contains "Laika"')
    }
  })
  
  // Check chunks
  const { data: chunks } = await supabase
    .from('document_chunks')
    .select('*')
    .ilike('content', '%laika%')
  
  console.log('\nChunks containing Laika:')
  chunks.forEach(chunk => {
    console.log(`- Chunk ${chunk.id}: "${chunk.content.substring(0, 100)}..."`)
  })
  
  // Check nodes
  const { data: node } = await supabase
    .from('kg_nodes')
    .select('*')
    .eq('label', 'Laika')
    .single()
  
  console.log('\nLaika node:')
  console.log(node)
}

checkLaikaContent()