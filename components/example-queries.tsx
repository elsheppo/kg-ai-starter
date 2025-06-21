'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lightbulb, Rocket, Brain, Network } from 'lucide-react'

interface ExampleQueriesProps {
  mode: 'vector' | 'graph' | 'hybrid'
  onSelectQuery: (query: string) => void
}

const QUERIES = {
  vector: {
    icon: Brain,
    title: 'Vector RAG Examples',
    description: 'Semantic search through documents',
    queries: [
      {
        query: "Tell me about Laika, the space dog",
        purpose: "Searches for specific content in documents"
      },
      {
        query: "What are the latest developments in space technology?",
        purpose: "Finds relevant technology information"
      },
      {
        query: "Explain the history of Mars exploration",
        purpose: "Retrieves historical information"
      },
      {
        query: "How does the Artemis program work?",
        purpose: "Searches for program details"
      }
    ]
  },
  graph: {
    icon: Network,
    title: 'Graph RAG Examples',
    description: 'Navigate and build knowledge graphs',
    queries: [
      {
        query: "Show me all connections between NASA and SpaceX",
        purpose: "Traverses relationships in the graph"
      },
      {
        query: "Create a knowledge graph about Mars missions",
        purpose: "Builds new graph structures"
      },
      {
        query: "What organizations are involved in space exploration?",
        purpose: "Finds entities by type"
      },
      {
        query: "Add Blue Origin to the graph and connect it to commercial space",
        purpose: "Extends the knowledge graph"
      }
    ]
  },
  hybrid: {
    icon: Rocket,
    title: 'Hybrid RAG Examples',
    description: 'Combines vector search with graph navigation',
    queries: [
      {
        query: "Find all documents about Mars and show how the concepts connect",
        purpose: "Search + graph visualization"
      },
      {
        query: "Build a knowledge graph from the space exploration timeline",
        purpose: "Document analysis + graph creation"
      },
      {
        query: "What technologies connect NASA and SpaceX, and what documents mention them?",
        purpose: "Graph traversal + document search"
      },
      {
        query: "Create a comprehensive view of the Artemis program using all available information",
        purpose: "Full hybrid capabilities"
      }
    ]
  }
}

export function ExampleQueries({ mode, onSelectQuery }: ExampleQueriesProps) {
  const examples = QUERIES[mode]
  const Icon = examples.icon

  return (
    <Card className="mb-6 border-2 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{examples.title}</CardTitle>
        </div>
        <CardDescription>{examples.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
          <span>Try these example queries:</span>
        </div>
        {examples.queries.map((example, index) => (
          <div key={index} className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start text-left h-auto py-2 px-3"
              onClick={() => onSelectQuery(example.query)}
            >
              <div className="space-y-1">
                <div className="font-medium text-sm">{example.query}</div>
                <div className="text-xs text-muted-foreground">{example.purpose}</div>
              </div>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}