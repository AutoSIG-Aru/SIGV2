// ── supabaseService.js — Escrita do requerimento no Supabase ──────────────────
//
// Fluxo:
//   1. RPC submeter_requerimento → grava requerimento + validações + disciplinas
//   2. Upload de cada arquivo para Storage (bucket 'anexos')
//   3. INSERT em public.anexos com os metadados de cada arquivo
//
// Tudo usa a anon key (formulário público, aluno não autenticado).
// ──────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

/**
 * Salva um requerimento completo no Supabase.
 *
 * @param {Object} params
 * @param {Object} params.aluno       - Dados do aluno
 * @param {Array}  params.validacoes  - Array de validações
 * @param {string} params.protocolo   - Protocolo gerado no front
 * @param {Array}  params.documentos  - Array de { file: File, categoria: string }
 *
 * @returns {Promise<{ ok: boolean, requerimentoId?: number, error?: string, avisoAnexos?: string }>}
 */
export async function salvarRequerimento({ aluno, validacoes, protocolo, documentos = [] }) {
  // ── 1. Dados estruturados via RPC (atômico) ──────────────────────────────────
  const payload = {
    protocolo,
    data_envio:  new Date().toISOString(),
    nome_aluno:  aluno.nome,
    matricula:   aluno.matricula,
    cpf:         aluno.cpf      || '',
    curso:       aluno.curso,
    email:       aluno.email,
    telefone:    aluno.telefone || '',
    validacoes:  validacoes.map((v, i) => ({
      indice:        i,
      tipo:          v.mesmaInstituicao ? 'interna' : 'externa',
      ufsc_codigo:   v.ufsc?.codigo      || '',
      ufsc_nome:     v.ufsc?.nome        || '',
      justificativa: v.justificativa     || '',
      cursadas: (v.cursadas ?? [])
        .filter(c => c.nome || c.codigo)
        .map(c => ({
          codigo:        c.codigo      || '',
          nome:          c.nome        || '',
          instituicao:   c.instituicao || '',
          carga_horaria: c.carga       || '',
          creditos:      c.creditos    || '',
          ementa:        c.ementa      || '',
        })),
    })),
  }

  const { data: requerimentoId, error: rpcError } = await supabase
    .rpc('submeter_requerimento', { payload })

  if (rpcError) {
    console.error('[Supabase] Erro no RPC:', rpcError)
    return { ok: false, error: rpcError.message }
  }

  // ── 2. Upload de arquivos para o Storage ─────────────────────────────────────
  if (documentos.length === 0) {
    return { ok: true, requerimentoId }
  }

  const falhas = []

  for (const { file, categoria } of documentos) {
    // Path: {requerimentoId}/{categoria}/{nome_original}
    // Garante unicidade adicionando timestamp se o nome repetir
    const nomeSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${requerimentoId}/${categoria}/${nomeSeguro}`

    // Upload para o bucket 'anexos'
    const { error: uploadError } = await supabase.storage
      .from('anexos')
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      console.error(`[Storage] Erro ao fazer upload de ${file.name}:`, uploadError)
      falhas.push(file.name)
      continue
    }

    // ── 3. Metadados na tabela public.anexos ──────────────────────────────────
    const { error: metaError } = await supabase
      .from('anexos')
      .insert({
        requerimento_id: requerimentoId,
        categoria,
        nome_original:   file.name,
        mime_type:       file.type || 'application/octet-stream',
        tamanho_bytes:   file.size,
        storage_path:    storagePath,
      })

    if (metaError) {
      console.error(`[Supabase] Erro ao salvar metadados de ${file.name}:`, metaError)
      falhas.push(file.name)
    }
  }

  const avisoAnexos = falhas.length > 0
    ? `${falhas.length} arquivo(s) não foram enviados: ${falhas.join(', ')}.`
    : null

  return { ok: true, requerimentoId, avisoAnexos }
}
