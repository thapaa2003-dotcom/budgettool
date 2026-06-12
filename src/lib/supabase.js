import { createClient } from '@supabase/supabase-js'

const url =
  import.meta.env.REACT_APP_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const key =
  import.meta.env.REACT_APP_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('Supabase omgevingsvariabelen ontbreken. Zie .env.example')
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true },
})
