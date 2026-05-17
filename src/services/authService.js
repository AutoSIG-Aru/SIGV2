// ── authService.js — Magic Link com Supabase Auth ─────────────────────────────
//
// Fluxo:
//   1. Usuário informa e-mail autorizado em /login
//   2. Front verifica whitelist e chama solicitarMagicLink(email)
//   3. Supabase envia e-mail com link → <origin>/auth#access_token=...
//   4. Usuário clica → AuthVerify.jsx detecta a sessão via SDK
//   5. Redireciona para /dashboard com sessão ativa
//
// Supabase cuida de: envio de e-mail, token, expiração, JWT, refresh automático.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// ── Whitelist ──────────────────────────────────────────────────────────────────
// Validada aqui (front) E pelo Supabase (shouldCreateUser: false).
// Para adicionar alguém: cadastrar no painel Supabase + colocar aqui.

export const EMAILS_PERMITIDOS = [
  'monique.r.moraes@grad.ufsc.br',
  'central.autosig@gmail.com',
]

// ── Magic link ─────────────────────────────────────────────────────────────────

/**
 * Envia um magic link para o e-mail informado.
 * Retorna { ok: true } ou { ok: false, error: string }.
 *
 * Pré-requisito no Supabase Dashboard:
 *   Authentication → URL Configuration → Redirect URLs
 *   Adicionar: http://localhost:5173/auth  (e o domínio de produção futuramente)
 */
export async function solicitarMagicLink(email) {
  const normalizado = email.toLowerCase().trim()

  // Validação da whitelist antes de chamar o Supabase
  if (!EMAILS_PERMITIDOS.includes(normalizado)) {
    return { ok: false, error: 'E-mail não autorizado pelo administrador.' }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizado,
    options: {
      emailRedirectTo:  `${window.location.origin}/auth`,
      shouldCreateUser: false, // só funciona para usuários já cadastrados no Supabase
    },
  })

  if (error) {
    // Mensagem amigável para o erro mais comum (usuário não cadastrado)
    const msg = error.message?.toLowerCase().includes('not found') || error.status === 422
      ? 'E-mail não cadastrado no sistema. Peça ao administrador para criar sua conta.'
      : error.message || 'Erro ao enviar o link. Tente novamente.'
    return { ok: false, error: msg }
  }

  return { ok: true }
}

// ── Sessão / usuário ───────────────────────────────────────────────────────────

/**
 * Retorna a sessão atual (inclui access_token, user, expires_at).
 * null se não há sessão válida.
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) return null
  return session
}

/**
 * Retorna o objeto User do Supabase, ou null se não autenticado.
 * Campos úteis: id, email, user_metadata.nome, etc.
 */
export async function getUser() {
  const session = await getSession()
  return session?.user ?? null
}

// ── Logout ─────────────────────────────────────────────────────────────────────

export async function clearAuth() {
  await supabase.auth.signOut()
}
