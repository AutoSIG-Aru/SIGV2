// ── authService.js — Autenticação com Supabase Auth ───────────────────────────
//
// Login: apenas por e-mail + senha (signInWithPassword).
// Recuperação: usuário esqueceu a senha → resetPasswordForEmail envia e-mail
//              com link → /auth#type=recovery → AuthVerify exibe form de nova senha.
// Convite: admin convida via Edge Function → link chega por e-mail
//          → /auth#type=invite → AuthVerify exige definição de senha.
//
// Supabase cuida de: envio de e-mail, token, expiração, JWT, refresh automático.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// ── Recuperação de senha ───────────────────────────────────────────────────────

/**
 * Envia e-mail de recuperação de senha para o endereço informado.
 * Retorna { ok: true } ou { ok: false, error: string }.
 */
export async function enviarRecuperacaoSenha(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.toLowerCase().trim(),
    { redirectTo: `${window.location.origin}/auth` },
  )
  if (error) return { ok: false, error: 'Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.' }
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

// ── Login com senha ────────────────────────────────────────────────────────────

/**
 * Autentica com e-mail e senha.
 * Retorna { ok: true } ou { ok: false, error: string }.
 */
export async function signInWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  })
  if (error) return { ok: false, error: 'E-mail ou senha incorretos.' }
  return { ok: true }
}

// ── Listener de estado de auth ─────────────────────────────────────────────────

/**
 * Registra um callback para mudanças de estado de autenticação.
 * Retorna a subscription (chamar subscription.unsubscribe() no cleanup).
 */
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  return subscription
}

// ── Atualização de senha ───────────────────────────────────────────────────────

/**
 * Atualiza a senha do usuário autenticado (usado em convite e recuperação).
 * Retorna { error } — error é null se bem-sucedido.
 */
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  return { error }
}

// ── Logout ─────────────────────────────────────────────────────────────────────

export async function clearAuth() {
  await supabase.auth.signOut()
}
