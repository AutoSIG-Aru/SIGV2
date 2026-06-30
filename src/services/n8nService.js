// ── n8nService.js — Comunicação com o n8n ─────────────────────────────────────
//
// Dois webhooks:
//   VITE_N8N_WEBHOOK_URL    → disparo na submissão de um novo requerimento
//   VITE_N8N_WEBHOOK_STATUS → disparo quando o status de um requerimento muda
//
// Ambos enviam apenas referências e metadados — nunca arquivos em base64.
// ─────────────────────────────────────────────────────────────────────────────

const N8N_BASE = import.meta.env.VITE_N8N_BASE_URL || 'http://localhost:5678'

const N8N_WEBHOOK_URL =
  import.meta.env.VITE_N8N_WEBHOOK_URL || `${N8N_BASE}/webhook/sig-requerimento`

const N8N_WEBHOOK_STATUS =
  import.meta.env.VITE_N8N_WEBHOOK_STATUS || `${N8N_BASE}/webhook/sig-status`

const N8N_WEBHOOK_AI =
  import.meta.env.VITE_N8N_WEBHOOK_AI || `${N8N_BASE}/webhook/sig-analise-ia`

// ── Helper interno ─────────────────────────────────────────────────────────────

async function postWebhook(url, payload, timeoutMs = 30_000) {
  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return { ok: false, status: res.status, error: `n8n respondeu com HTTP ${res.status}` }
    }

    let response = null
    const text = await res.text()
    if (text) {
      try { response = JSON.parse(text) } catch { response = text }
    }

    return { ok: true, status: res.status, response }
  } catch (err) {
    clearTimeout(timeoutId)
    console.error('[n8n] Erro ao enviar para', url, err)
    let error = err.message || String(err)
    if (err.name === 'AbortError')       error = 'Tempo esgotado. O n8n não respondeu.'
    if (error.includes('Failed to fetch')) error = 'Não foi possível conectar ao n8n.'
    return { ok: false, error }
  }
}

// ── Submissão de novo requerimento ────────────────────────────────────────────

/**
 * Notifica o n8n após a gravação de um novo requerimento no Supabase.
 *
 * Envia apenas referências (id + storage paths) — os arquivos já estão no
 * Supabase Storage e o n8n os acessa diretamente via service_role key.
 *
 * @param {Object}  params
 * @param {Object}  params.aluno           - Dados do aluno
 * @param {Array}   params.validacoes      - Array de validações
 * @param {number}  params.requerimentoId  - ID gerado pelo Supabase
 * @param {Array}   params.storagePaths    - [{ categoria, storage_path, nome_original }]
 * @param {string}  params.tipo            - 'validacao' | 'equivalencia'
 */
export async function enviarParaN8n({
  aluno,
  validacoes,
  requerimentoId,
  storagePaths = [],
  tipo = 'validacao',
}) {
  const payload = {
    requerimento_id:   requerimentoId,
    tipo_requerimento: tipo,
    data_envio:        new Date().toISOString(),

    aluno: {
      nome:      aluno.nome,
      matricula: aluno.matricula,
      cpf:       aluno.cpf || null,
      curso:     aluno.curso,
      email:     aluno.email,
      telefone:  aluno.telefone,
    },

    total_validacoes: validacoes.length,
    total_documentos: storagePaths.length,

    validacoes: validacoes.map((v, i) => ({
      indice: i + 1,
      tipo:   v.mesmaInstituicao ? 'interna' : 'externa',
      disciplina_ufsc: {
        codigo: v.ufsc.codigo,
        nome:   v.ufsc.nome,
      },
      justificativa: v.justificativa || null,
      disciplinas_cursadas: v.cursadas.map(c => ({
        codigo:        c.codigo,
        nome:          c.nome,
        instituicao:   c.instituicao || null,
        carga_horaria: c.carga       || null,
        creditos:      c.creditos    || null,
        ementa:        c.ementa      || null,
      })),
    })),

    // Referências dos arquivos no Supabase Storage.
    // n8n acessa cada arquivo via:
    //   supabase.storage.from('anexos').download(storage_path)
    documentos: storagePaths,
  }

  return postWebhook(N8N_WEBHOOK_URL, payload)
}

// ── Mudança de status ──────────────────────────────────────────────────────────

/**
 * Notifica o n8n quando o status de um requerimento muda.
 * Chamado por statusService após a atualização no banco.
 *
 * O workflow n8n decide qual e-mail enviar com base no novo status:
 *   parecer_coord → aviso para coordenação
 *   concluido     → e-mail de resultado para o aluno (inclui decisoes se fornecido)
 *
 * @param {Object}  params
 * @param {number}  params.requerimentoId   - ID do requerimento
 * @param {string}  params.protocolo        - Protocolo do requerimento
 * @param {string}  params.numeroProcesso   - Número do processo SPA (inserido pela SIG)
 * @param {string}  params.statusAnterior   - Status antes da mudança
 * @param {string}  params.novoStatus       - Novo status
 * @param {string}  params.tipoRequerimento - 'validacao' | 'equivalencia'
 * @param {Object}  params.aluno            - { nome, email, matricula, curso }
 * @param {Array}   [params.decisoes]       - Decisões do coordenador (quando novoStatus === 'concluido')
 *                                            [{ ufsc_codigo, ufsc_nome, decisao, mencao, nota }]
 * @param {string}  [params.observacoes]    - Texto de observações do coordenador
 */
export async function notificarMudancaStatus({
  requerimentoId,
  protocolo,
  numeroProcesso,
  statusAnterior,
  novoStatus,
  tipoRequerimento = 'validacao',
  aluno = {},
  decisoes,
  observacoes,
}) {
  const payload = {
    requerimento_id:   requerimentoId,
    protocolo:         protocolo      || null,
    numero_processo:   numeroProcesso || null,
    tipo_requerimento: tipoRequerimento,
    status_anterior:   statusAnterior,
    novo_status:       novoStatus,
    timestamp:         new Date().toISOString(),

    aluno: {
      nome:      aluno.nome      || null,
      email:     aluno.email     || null,
      matricula: aluno.matricula || null,
      curso:     aluno.curso     || null,
    },
  }

  // Inclui decisões do coordenador somente quando o status é 'concluido'
  if (novoStatus === 'concluido' && decisoes) {
    payload.decisoes    = decisoes
    payload.observacoes = observacoes || null
  }

  return postWebhook(N8N_WEBHOOK_STATUS, payload, 15_000)
}

// ── Análise de IA ─────────────────────────────────────────────────────────────

/**
 * Dispara o workflow de análise de IA no n8n.
 *
 * Envia APENAS dados técnicos das validações — sem dados pessoais do aluno
 * (nome, matrícula, CPF, e-mail, telefone) e sem referências a documentos.
 * O n8n buscará as ementas UFSC diretamente no Supabase (curriculo_disciplinas).
 *
 * @param {Object} params
 * @param {number} params.requerimentoId   - ID do requerimento
 * @param {string} params.curso            - Nome do curso (para buscar currículo)
 * @param {string} params.tipo             - 'validacao' | 'equivalencia'
 * @param {Array}  params.validacoes       - Validações do formulário
 */
export async function enviarParaAnaliseIA({
  requerimentoId,
  curso,
  tipo = 'validacao',
  validacoes = [],
}) {
  const payload = {
    requerimento_id:   requerimentoId,
    curso,
    tipo_requerimento: tipo,
    validacoes: validacoes.map((v, i) => ({
      indice:          i + 1,
      tipo:            v.mesmaInstituicao ? 'interna' : 'externa',
      disciplina_ufsc: {
        codigo: v.ufsc.codigo,
        nome:   v.ufsc.nome,
      },
      justificativa: v.justificativa || null,
      disciplinas_cursadas: v.cursadas.map(c => ({
        codigo:        c.codigo        || null,
        nome:          c.nome          || null,
        carga_horaria: c.carga         || null,
        creditos:      c.creditos      || null,
        ementa:        c.ementa        || null,
      })),
    })),
  }

  return postWebhook(N8N_WEBHOOK_AI, payload, 30_000)
}

export { N8N_WEBHOOK_URL, N8N_WEBHOOK_STATUS, N8N_WEBHOOK_AI, N8N_BASE }
