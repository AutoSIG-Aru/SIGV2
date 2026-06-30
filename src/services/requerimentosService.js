import { supabase } from './supabase'

// ── Leitura ────────────────────────────────────────────────────────────────────

/**
 * Lista todos os requerimentos (colunas usadas no dashboard).
 */
export async function listarRequerimentos() {
  const { data, error } = await supabase
    .from('requerimentos')
    .select('id, numero_processo, status, tipo_requerimento, nome_aluno, matricula, curso, email, criado_em, atualizado_em, sumario_ia')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Busca o perfil (perfil, nome, curso) de um usuário pelo seu id.
 */
export async function buscarPerfil(userId) {
  const { data } = await supabase
    .from('usuarios').select('perfil, nome, curso').eq('id', userId).maybeSingle()
  return data ?? null
}

/**
 * Busca um requerimento completo pelo id.
 * Lança erro se não encontrado ou sem permissão.
 */
export async function buscarRequerimento(id) {
  const { data, error } = await supabase
    .from('requerimentos').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

/**
 * Busca as validações (com disciplinas_cursadas) de um requerimento.
 */
export async function buscarValidacoes(requerimentoId) {
  const { data } = await supabase
    .from('validacoes')
    .select('*, disciplinas_cursadas(*)')
    .eq('requerimento_id', requerimentoId)
    .order('indice')
  return data || []
}

/**
 * Busca os anexos de um requerimento.
 */
export async function buscarAnexos(requerimentoId) {
  const { data } = await supabase
    .from('anexos').select('*').eq('requerimento_id', requerimentoId).order('enviado_em')
  return data || []
}

/**
 * Busca o histórico de eventos de auditoria de um requerimento.
 */
export async function buscarEventos(requerimentoId) {
  const { data } = await supabase
    .from('eventos_auditoria')
    .select('*, autor:usuario_id(nome, perfil)')
    .eq('requerimento_id', requerimentoId)
    .order('criado_em', { ascending: false })
  return data || []
}

// ── Escrita ────────────────────────────────────────────────────────────────────

/**
 * Atualiza o status de um requerimento via RPC.
 * Lança erro em caso de falha.
 */
export async function atualizarStatus(id, novoStatus) {
  const { error } = await supabase.rpc('atualizar_status_requerimento', {
    p_id: Number(id), p_status: novoStatus,
  })
  if (error) throw error
}

/**
 * Salva o número do processo SPA/SOLAR no requerimento.
 * Lança erro em caso de falha.
 */
export async function atualizarNumeroProcesso(id, numero) {
  const { error } = await supabase
    .from('requerimentos')
    .update({ numero_processo: numero })
    .eq('id', Number(id))
  if (error) throw error
}

/**
 * Salva as decisões da coordenação em lote (Promise.all).
 * decisoesCoord: { [validacao_id]: { decisao, mencao, nota, cargaHoraria } }
 * Lança erro se alguma atualização falhar.
 */
export async function salvarDecisoes(decisoesCoord) {
  const resultados = await Promise.all(
    Object.entries(decisoesCoord).map(([id, d]) =>
      supabase.from('validacoes').update({
        decisao: d.decisao,
        decisao_observacao: JSON.stringify({
          mencao:        d.mencao        || null,
          nota:          d.nota          ?? null,
          carga_horaria: d.cargaHoraria  || null,
        }),
      }).eq('id', Number(id))
    )
  )
  const erros = resultados.filter(r => r.error)
  if (erros.length > 0) throw new Error('Erro ao salvar algumas decisões.')
}

// ── Storage ────────────────────────────────────────────────────────────────────

/**
 * Gera uma URL assinada (1h) para visualização de um anexo.
 * Lança erro se não for possível gerar a URL.
 */
export async function gerarUrlAnexo(storagePath) {
  const { data, error } = await supabase.storage
    .from('anexos')
    .createSignedUrl(storagePath, 3600)
  if (error || !data?.signedUrl) throw error || new Error('Não foi possível gerar URL do anexo.')
  return data.signedUrl
}

/**
 * Baixa todos os anexos fazendo fetch como blob.
 * Necessário porque URLs do Supabase Storage são cross-origin:
 * o browser ignora o atributo `download` nesses casos e abre o arquivo.
 * Baixar via blob: URL contorna essa restrição.
 */
export async function baixarAnexos(anexos) {
  for (const anexo of anexos) {
    try {
      const { data } = await supabase.storage
        .from('anexos')
        .createSignedUrl(anexo.storage_path, 3600)
      if (!data?.signedUrl) continue

      const response = await fetch(data.signedUrl)
      if (!response.ok) continue

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = anexo.nome_original || 'documento'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Pequena pausa entre downloads para não sobrecarregar o browser
      await new Promise(r => setTimeout(r, 400))
      URL.revokeObjectURL(blobUrl)
    } catch (_) {}
  }
}
