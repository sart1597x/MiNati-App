import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('Supabase service role credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file')
}

// Cliente service role para operaciones administrativas (bypass RLS)
let serviceRoleClient: ReturnType<typeof createClient> | null = null

export function getServiceRoleClient() {
  if (serviceRoleClient) return serviceRoleClient

  serviceRoleClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })

  return serviceRoleClient
}
