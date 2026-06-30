import { enviarParaN8n, enviarParaAnaliseIA } from './n8nService'
import { salvarRequerimento } from './supabaseService'

/**
 * Orquestra o envio completo de um requerimento:
 *
 *   1. Supabase  (OBRIGATÓRIO) — persiste dados estruturados e faz upload dos arquivos.
 *                                Retorna o id gerado e os storage paths dos arquivos.
 *   2. n8n       (secundário)  — recebe o id + paths e dispara o workflow de IA
 *                                e notificações por e-mail. Não recebe os arquivos
 *                                em base64 — busca direto no Supabase Storage.
 *
 * O sucesso é determinado pela gravação no Supabase.
 * Falha do n8n é reportada como aviso — o requerimento já está salvo.
 */
export async function enviarRequerimento({ aluno, validacoes, documentos = [], tipo = 'validacao' }) {
  // ── Etapa 1: Supabase (obrigatório) ─────────────────────────────────────────
  const supabaseResult = await salvarRequerimento({ aluno, validacoes, documentos, tipo })

  if (!supabaseResult.ok) {
    return {
      success:      false,
      supabase:     supabaseResult,
      n8n:          { ok: false, skipped: true },
      mensagemErro: `Não foi possível salvar o requerimento: ${supabaseResult.error}`,
    }
  }

  // ── Etapa 2: n8n (secundário — notificação SIG + análise IA em paralelo) ─────
  const [n8nResult] = await Promise.all([
    // 2a. Notifica a SIG com dados do aluno + resumo do pedido
    enviarParaN8n({
      aluno,
      validacoes,
      requerimentoId: supabaseResult.requerimentoId,
      storagePaths:   supabaseResult.storagePaths,
      tipo,
    }).catch(err => ({ ok: false, error: err.message || String(err) })),

    // 2b. Dispara análise de IA — apenas dados técnicos, sem dados pessoais
    enviarParaAnaliseIA({
      requerimentoId: supabaseResult.requerimentoId,
      curso:          aluno.curso,
      tipo,
      validacoes,
    }).catch(err => {
      console.warn('[submissionService] Webhook de IA falhou:', err.message || String(err))
    }),
  ])

  if (!n8nResult.ok && !n8nResult.skipped) {
    console.warn('[submissionService] n8n falhou (IA e e-mails pendentes):', n8nResult.error)
  }

  const avisos = []
  if (supabaseResult.avisoAnexos) avisos.push(supabaseResult.avisoAnexos)
  if (!n8nResult.ok && !n8nResult.skipped) avisos.push('Processamento automático pendente (n8n indisponível).')

  return {
    success:        true,
    requerimentoId: supabaseResult.requerimentoId,
    supabase:       supabaseResult,
    n8n:            n8nResult,
    aviso:          avisos.length > 0 ? avisos.join(' ') : null,
  }
}
