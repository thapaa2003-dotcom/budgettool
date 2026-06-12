import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// REACT_APP_ prefix toegestaan zodat de gevraagde variabelen
// REACT_APP_SUPABASE_URL en REACT_APP_SUPABASE_ANON_KEY werken op Vercel.
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'REACT_APP_'],
})
