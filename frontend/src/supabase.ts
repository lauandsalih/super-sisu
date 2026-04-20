import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    // 30 days in seconds
    persistSessionDuration: 30 * 24 * 60 * 60,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})