require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkRelationships() {
  console.log('Checking ISS relationships...\n')
  
  // Get ISS node
  const { data: issNode } = await supabase
    .from('kg_nodes')
    .select('*')
    .eq('label', 'International Space Station')
    .single()
  
  if (!issNode) {
    console.error('ISS node not found!')
    return
  }
  
  console.log('ISS Node ID:', issNode.id)
  
  // Get edges to/from ISS
  const { data: edges } = await supabase
    .from('kg_edges')
    .select(`
      *,
      source:kg_nodes!kg_edges_source_id_fkey(label),
      target:kg_nodes!kg_edges_target_id_fkey(label)
    `)
    .or(`source_id.eq.${issNode.id},target_id.eq.${issNode.id}`)
  
  console.log('\nRelationships:')
  edges.forEach(edge => {
    console.log(`${edge.source.label} --[${edge.relationship}]--> ${edge.target.label}`)
  })
}

checkRelationships()