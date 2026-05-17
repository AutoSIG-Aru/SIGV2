import emailjs from '@emailjs/browser'
import { enviarParaN8n } from './n8nService'
import { salvarRequerimento } from './supabaseService'

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

const emailjsConfigurado = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY)

// ── Email de confirmação (EmailJS) ─────────────────────────────────────────────
async function enviarPorEmail({ aluno, validacoes, protocolo }) {
  if (!emailjsConfigurado) {
    return { ok: false, skipped: true, error: 'EmailJS não configurado.' }
  }

  try {
    const disciplinasTexto = validacoes
      .map((v, i) => {
        const tipo = v.mesmaInstituicao ? 'Interna' : 'Externa'
        const cursadasTexto = v.cursadas
          .map(c => `  - ${c.codigo} | ${c.nome} | ${c.instituicao} | ${c.carga}h | ${c.creditos} créditos`)
          .join('\n')
        return `[${i + 1}] Validação ${tipo}\n  UFSC: ${v.ufsc.codigo} – ${v.ufsc.nome}\n${cursadasTexto}\n  Justificativa: ${v.justificativa || '—'}`
      })
      .join('\n\n')

    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        protocolo,
        aluno_nome:        aluno.nome,
        aluno_matricula:   aluno.matricula,
        aluno_cpf:         aluno.cpf || '(não informado)',
        aluno_curso:       aluno.curso,
        aluno_email:       aluno.email,
        aluno_telefone:    aluno.telefone,
        disciplinas:       disciplinasTexto,
        total_disciplinas: validacoes.length,
        data_envio:        new Date().toLocaleString('pt-BR'),
        reply_to:          aluno.email,
      },
      PUBLIC_KEY
    )
    return { ok: true }
  } catch (err) {
    console.error('[EmailJS] Erro ao enviar:', err)
    return { ok: false, error: err?.text || err?.message || String(err) }
  }
}

// ── Orquestrador principal ─────────────────────────────────────────────────────
/**
 * Fluxo de envio do requerimento:
 *
 *   1. Supabase  (OBRIGATÓRIO) — persiste os dados estruturados
 *   2. n8n       (secundário)  — dispara o processamento de IA
 *   3. EmailJS   (secundário)  — envia confirmação por e-mail
 *
 * O sucesso é determinado pela gravação no Supabase.
 * Falhas de n8n e email são reportadas como avisos, não como erros fatais.
 */
export async function enviarRequerimento({ aluno, validacoes, protocolo, documentos = [] }) {
  // ── Etapa 1: Supabase (obrigatório) ─────────────────────────────────────────
  const supabaseResult = await salvarRequerimento({ aluno, validacoes, protocolo, documentos })

  if (!supabaseResult.ok) {
    return {
      success:      false,
      supabase:     supabaseResult,
      n8n:          { ok: false, skipped: true },
      email:        { ok: false, skipped: true },
      mensagemErro: `Não foi possível salvar o requerimento: ${supabaseResult.error}`,
    }
  }

  // ── Etapas 2 e 3: n8n + email em paralelo (não bloqueantes) ─────────────────
  const [n8nResult, emailResult] = await Promise.all([
    enviarParaN8n({ aluno, validacoes, protocolo, documentos }).catch(err => ({
      ok: false, error: err.message || String(err),
    })),
    enviarPorEmail({ aluno, validacoes, protocolo }).catch(err => ({
      ok: false, error: err.message || String(err),
    })),
  ])

  // Avisos para exibir no console (não impedem o sucesso)
  if (!n8nResult.ok && !n8nResult.skipped) {
    console.warn('[enviarRequerimento] n8n falhou (IA não processada):', n8nResult.error)
  }
  if (!emailResult.ok && !emailResult.skipped) {
    console.warn('[enviarRequerimento] EmailJS falhou:', emailResult.error)
  }

  // Monta aviso opcional para exibir na UI (sucesso parcial)
  const avisos = []
  if (supabaseResult.avisoAnexos)
    avisos.push(supabaseResult.avisoAnexos)
  if (!n8nResult.ok && !n8nResult.skipped)
    avisos.push(`Processamento IA pendente (n8n indisponível).`)
  if (!emailResult.ok && !emailResult.skipped)
    avisos.push(`E-mail de confirmação não enviado.`)

  return {
    success:  true,   // dados salvos com sucesso no Supabase
    supabase: supabaseResult,
    n8n:      n8nResult,
    email:    emailResult,
    aviso:    avisos.length > 0 ? avisos.join(' ') : null,
  }
}

/**
 * Gera um número de protocolo único.
 *
 * Formato: UFSC-ARA-{ano}{semestre}-{rand5}
 *   - ano:      ano corrente (4 dígitos)
 *   - semestre: 1 (jan-jun) ou 2 (jul-dez)
 *   - rand5:    5 dígitos aleatórios para evitar colisão dentro do mesmo semestre
 */
export function gerarProtocolo() {
  const now      = new Date()
  const ano      = now.getFullYear()
  const semestre = now.getMonth() < 6 ? '1' : '2'
  const rand     = Math.floor(Math.random() * 90000) + 10000
  return `UFSC-ARA-${ano}${semestre}-${rand}`
}
