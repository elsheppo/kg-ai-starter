#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' })

// Check for required environment variables
const required = ['OPENAI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
const missing = required.filter(key => !process.env[key])

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:')
  missing.forEach(key => console.error(`   - ${key}`))
  console.error('\nPlease add these to your .env.local file')
  process.exit(1)
}

// Register TypeScript with proper config
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2017',
    moduleResolution: 'node',
    allowJs: true,
    esModuleInterop: true,
    skipLibCheck: true,
    strict: false
  }
})

// Run the update script
require('./update-node-embeddings.ts').updateNodeEmbeddings()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })