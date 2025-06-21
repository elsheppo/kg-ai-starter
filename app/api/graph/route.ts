import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // Fetch all nodes
    const { data: nodes, error: nodesError } = await supabase
      .from('kg_nodes')
      .select('*')
    
    if (nodesError) throw nodesError
    
    // Fetch all edges
    const { data: edges, error: edgesError } = await supabase
      .from('kg_edges')
      .select('*')
    
    if (edgesError) throw edgesError
    
    return NextResponse.json({ nodes: nodes || [], edges: edges || [] })
  } catch (error) {
    console.error('Failed to fetch graph data:', error)
    return NextResponse.json({ nodes: [], edges: [] }, { status: 500 })
  }
}