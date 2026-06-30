// ── statusService.js — Mudança de status de requerimento ──────────────────────
//
// Orquestra dois passos na ordem correta:
//   1. DB (obrigatório) — atualiza o status via RPC no Supabase.
//   2. n8n (secundário) — dispara notificação de e-mail conforme o novo status.
//      Falha do n8n não reverte a atualização do banco.
//
// Usado por: Dashboard.jsx (drag & drop kanban) e RequerimentoDetalhe.jsx (menu).
// ─────────────────────────────────────────────────────────────────────────────

import { atualizarStatus } from './requerimentosService'
import { notificarMudancaStatus } from './n8nService'

/**
 * Altera o status de um requerimento e notifica o n8n.
 *
 * @param {Object} requerimento   - Objeto completo do requerimento (ou ao menos
 *                                  { id, protocolo, status, nome_aluno, email,
 *                                    matricula, curso, tipo_requerimento })
 * @param {string} novoStatus     - Novo status a aplicar
 * @param {Object} [extras]       - Dados adicionais opcionais para o n8n:
 *                                  { decisoes, observacoes } — usados quando novoStatus === 'concluido'
 *
 * @returns {Promise<void>}  Lança erro se a atualização no banco falhar.
 *                           Falha do n8n é apenas logada.
 */
export async function alterarStatus(requerimento, novoStatus, extras = {}) {
  // ── 1. Atualizar banco (obrigatório) ─────────────────────────────────────────
  await atualizarStatus(requerimento.id, novoStatus)

  // ── 2. Notificar n8n (secundário — não bloqueia nem reverte) ─────────────────
  notificarMudancaStatus({
    requerimentoId:   requerimento.id,
    protocolo:        requerimento.protocolo,
    numeroProcesso:   requerimento.numero_processo,
    statusAnterior:   requerimento.status,
    novoStatus,
    tipoRequerimento: requerimento.tipo_requerimento ?? 'validacao',
    aluno: {
      nome:      requerimento.nome_aluno,
      email:     requerimento.email,
      matricula: requerimento.matricula,
      curso:     requerimento.curso,
    },
    decisoes:    extras.decisoes,
    observacoes: extras.observacoes,
  }).catch(err =>
    console.warn('[statusService] n8n falhou ao notificar mudança de status:', err)
  )
}
