import { supabase } from './supabase'
import { getSession } from './authService'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/convidar-usuario`

// ── Listagem ────────────────────────────────────────────────────────────────────

/**
 * Lista todos os usuários staff (sig + coordenacao).
 * Requer perfil 'sig' (RLS policy "usuarios: sig lê todos").
 */
export async function listarUsuarios() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nome, perfil, curso, funcao, ativo, criado_em, ultimo_login')
    .in('perfil', ['sig', 'coordenacao'])
    .order('criado_em', { ascending: false })

  if (error) throw error
  return data ?? []
}

// ── Convite ─────────────────────────────────────────────────────────────────────

/**
 * Convida um novo usuário via Edge Function.
 * Envia email de convite; o usuário define a própria senha ao clicar no link.
 *
 * @param {{ email: string, nome: string, perfil: 'sig'|'coordenacao', curso?: string }} dados
 * @returns {{ ok: boolean, error?: string }}
 */
export async function convidarUsuario({ email, nome, perfil, curso, funcao }) {
  const session = await getSession()
  if (!session) return { ok: false, error: 'Sessão expirada.' }

  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, nome, perfil, curso: curso || null, funcao: funcao || null }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = typeof json.error === 'string' && json.error
      ? json.error
      : `Erro ao convidar usuário (status ${res.status}).`
    return { ok: false, error: msg }
  }
  return { ok: true }
}

// ── Ativar / desativar ──────────────────────────────────────────────────────────

export async function toggleUsuario(id, ativo) {
  const { error } = await supabase
    .from('usuarios')
    .update({ ativo })
    .eq('id', id)

  if (error) throw error
}

// ── Excluir ─────────────────────────────────────────────────────────────────────

/**
 * Exclui o usuário de public.usuarios e auth.users via RPC SECURITY DEFINER.
 * Requer perfil 'sig'.
 *
 * @param {string} id — UUID do usuário a excluir
 * @returns {{ ok: boolean, error?: string }}
 */
export async function excluirUsuario(id) {
  const { error } = await supabase.rpc('excluir_usuario_sig', { p_id: id })

  if (error) {
    const msg = error.message?.includes('própria conta')
      ? 'Você não pode excluir sua própria conta.'
      : error.message?.includes('restrito')
      ? 'Acesso restrito à SIG.'
      : 'Não foi possível excluir o usuário.'
    return { ok: false, error: msg }
  }
  return { ok: true }
}
