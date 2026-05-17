// Base do n8n — todos os webhooks derivam daqui.
// Em produção, troque pelo domínio real (ex: https://n8n.ufsc.br).
const N8N_BASE =
  import.meta.env.VITE_N8N_BASE_URL || 'http://localhost:5678'

// Webhook principal: recebe o requerimento completo
const N8N_WEBHOOK_URL =
  import.meta.env.VITE_N8N_WEBHOOK_URL || `${N8N_BASE}/webhook/sig-requerimento`

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Converte um File em string base64 pura (sem o prefixo data:mime;base64,).
 * Usado para incluir os documentos no payload JSON.
 */
function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Envio principal ────────────────────────────────────────────────────────────

/**
 * Envia o requerimento ao n8n como JSON estruturado.
 * Todos os arquivos são convertidos para base64 e incluídos no payload,
 * cada um com sua categoria (req_assinado, historico, programa, controle, certif).
 *
 * @param {Object} params
 * @param {Object} params.aluno       - Dados do aluno
 * @param {Array}  params.validacoes  - Array de validações
 * @param {string} params.protocolo   - Número do protocolo gerado no front
 * @param {Array}  params.documentos  - Array de { file: File, categoria: string }
 * @returns {Promise<{ ok: boolean, status?: number, error?: string, response?: any }>}
 */
export async function enviarParaN8n({ aluno, validacoes, protocolo, documentos = [] }) {
  // Converte todos os arquivos para base64 em paralelo
  const docsConvertidos = await Promise.all(
    documentos.map(async ({ file, categoria }) => ({
      categoria,                          // ex: 'req_assinado', 'historico', ...
      nome_original: file.name,
      mime_type:     file.type || 'application/octet-stream',
      tamanho_bytes: file.size,
      conteudo_base64: await fileParaBase64(file),
    }))
  )

  const payload = {
    protocolo,
    data_envio: new Date().toISOString(),

    aluno: {
      nome:      aluno.nome,
      matricula: aluno.matricula,
      cpf:       aluno.cpf || null,
      curso:     aluno.curso,
      email:     aluno.email,
      telefone:  aluno.telefone,
    },

    total_validacoes: validacoes.length,
    total_documentos: documentos.length,

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
        instituicao:   c.instituicao,
        carga_horaria: c.carga,
        creditos:      c.creditos,
        ementa:        c.ementa || null,
      })),
    })),

    // Documentos com conteúdo base64 — o n8n decodifica e salva no MinIO/filesystem
    documentos: docsConvertidos,
  }

  try {
    const controller = new AbortController()
    // 60 s: arquivos base64 podem ser grandes
    const timeoutId = setTimeout(() => controller.abort(), 60_000)

    const res = await fetch(N8N_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      return {
        ok:     false,
        status: res.status,
        error:  `n8n respondeu com HTTP ${res.status} ${res.statusText}`,
      }
    }

    let response = null
    const text = await res.text()
    if (text) {
      try { response = JSON.parse(text) } catch { response = text }
    }

    return { ok: true, status: res.status, response }
  } catch (err) {
    console.error('[n8n] Erro ao enviar:', err)
    let error = err.message || String(err)
    if (err.name === 'AbortError') {
      error = 'Tempo esgotado (60 s). O n8n não respondeu — verifique se o Docker está rodando.'
    } else if (error.includes('Failed to fetch')) {
      error =
        'Não foi possível conectar ao n8n. Verifique se o Docker está rodando e se ' +
        'o webhook permite CORS do navegador.'
    }
    return { ok: false, error }
  }
}

export { N8N_WEBHOOK_URL, N8N_BASE }
