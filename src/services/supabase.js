// ── Cliente Supabase (singleton) ───────────────────────────────────────────────
// Usado pelo authService para magic link e gestão de sessão.
// Variáveis definidas no .env:
//   VITE_SUPABASE_URL      → URL do projeto (ex: https://xxx.supabase.co)
//   VITE_SUPABASE_ANON_KEY → chave pública (publishable key)

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[Supabase] Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ' +
    'não definidas no .env. Auth não vai funcionar.'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken:   true,   // renova o JWT automaticamente
    persistSession:     true,   // salva sessão em localStorage
    detectSessionInUrl: true,   // processa o hash do magic link automaticamente
  },
})

// Força verificação de sessão ao voltar o foco para a aba.
// Browsers limitam timers em abas inativas, o que pode atrasar o auto-refresh
// do token Supabase e causar SIGNED_OUT inesperado após ~1 hora.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    supabase.auth.getSession()
  }
})
