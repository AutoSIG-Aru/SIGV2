import { useState, useEffect, useCallback } from 'react'
import StaffLayout from '../../layouts/StaffLayout'
import { onAuthChange, getSession } from '../../services/authService'
import { gerarFormularioCoordPDF } from '../../services/pdfCoordenacao'
import { buscarCargaHorariasDisciplinas } from '../../services/curriculoService'
import {
  buscarRequerimento,
  buscarValidacoes,
  buscarAnexos,
  buscarEventos,
  buscarPerfil,
  atualizarNumeroProcesso,
  salvarDecisoes as persistirDecisoes,
  gerarUrlAnexo,
  baixarAnexos,
} from '../../services/requerimentosService'
import { alterarStatus } from '../../services/statusService'

// ── Config visual de status ────────────────────────────────────────────────────
const STATUS_CFG = {
  novo:             { label: 'Novo',           cor: '#475569', bg: '#f1f5f9' },
  em_revisao_ia:   { label: 'Revisão IA',     cor: '#7c3aed', bg: '#f5f3ff' },
  triagem_sig:     { label: 'Triagem SIG',    cor: '#64748b', bg: '#f8fafc' },
  em_analise_coord:{ label: 'Análise SIG',    cor: '#1d4ed8', bg: '#eff6ff' },
  parecer_coord:      { label: 'Parecer Coord.',    cor: '#1d4ed8', bg: '#e0f2fe' },
  revisao_solicitada: { label: 'Revisão Solicitada', cor: '#b45309', bg: '#fffbeb' },
  concluido:          { label: 'Concluído',          cor: '#15803d', bg: '#f0fdf4' },
}

const CATEGORIA_CFG = {
  req_assinado:        { label: 'Requerimento Assinado',  cor: '#1d4ed8', bg: '#eff6ff' },
  historico:           { label: 'Histórico Escolar',      cor: '#15803d', bg: '#f0fdf4' },
  programa:            { label: 'Programa da Disciplina', cor: '#7c3aed', bg: '#f5f3ff' },
  controle:            { label: 'Controle Curricular',    cor: '#b45309', bg: '#fffbeb' },
  certif:              { label: 'Certificado',             cor: '#0369a1', bg: '#e0f2fe' },
  gerado_pelo_sistema: { label: 'Gerado pelo Sistema',    cor: '#475569', bg: '#f1f5f9' },
}

// Fases do kanban — espelha exatamente as 5 colunas visíveis no painel
const FASES_DISPONIVEIS = [
  { status: 'triagem_sig',      label: 'Triagem SIG',    cor: '#64748b' },
  { status: 'em_analise_coord', label: 'Em análise SIG', cor: '#1d4ed8' },
  { status: 'parecer_coord',    label: 'Coordenação',    cor: '#1d4ed8' },
  { status: 'concluido',        label: 'Concluído',       cor: '#15803d' },
]

const ABAS = [
  { id: 'geral',      label: 'Informações Gerais' },
  { id: 'documentos', label: 'Documentos'          },
  { id: 'tarefas',    label: 'Tarefas da Etapa'   },
  { id: 'historico',  label: 'Histórico'           },
]

// ── Badge ──────────────────────────────────────────────────────────────────────
function Badge({ label, cor, bg }) {
  return (
    <span style={{
      background: bg, color: cor,
      borderRadius: 12, padding: '3px 11px',
      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ── Seção com título ───────────────────────────────────────────────────────────
function Secao({ titulo, children, style = {} }) {
  return (
    <div className="form-card" style={{ marginBottom: 0, position: 'relative', zIndex: 0, ...style }}>
      <div style={{
        fontWeight: 700, fontSize: 14, color: '#1e293b',
        paddingBottom: 12, marginBottom: 16,
        borderBottom: '1px solid #f1f5f9',
      }}>
        {titulo}
      </div>
      {children}
    </div>
  )
}

// ── Campo info ─────────────────────────────────────────────────────────────────
function Campo({ label, valor, span = false }) {
  if (!valor) return null
  return (
    <div style={{ gridColumn: span ? '1 / -1' : undefined }}>
      <div style={{
        fontSize: 11, color: '#94a3b8', marginBottom: 3,
        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: '#1e293b' }}>{valor}</div>
    </div>
  )
}

// ── Placeholder de aba futura ──────────────────────────────────────────────────
function AbaPlaceholder({ icone, titulo, descricao }) {
  return (
    <div className="form-card" style={{ textAlign: 'center', padding: '56px 32px' }}>
      <div style={{ fontSize: 36, marginBottom: 14 }}>{icone}</div>
      <div style={{ fontWeight: 600, fontSize: 15, color: '#64748b', marginBottom: 8 }}>{titulo}</div>
      <p style={{ fontSize: 13, maxWidth: 380, margin: '0 auto', lineHeight: 1.7, color: '#94a3b8' }}>
        {descricao}
      </p>
    </div>
  )
}

// ── Ícone de documento SVG ─────────────────────────────────────────────────────
function IconDoc({ size = 32, color = '#cbd5e1' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="14 2 14 8 20 8"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Aba Documentos: split-pane ─────────────────────────────────────────────────
function AbaDocumentos({ anexos }) {
  const [selecionado, setSelecionado] = useState(null)
  const [url, setUrl]                 = useState(null)
  const [carregando, setCarregando]   = useState(false)
  const [erroUrl, setErroUrl]         = useState(false)

  // Auto-seleciona o primeiro documento ao montar
  useEffect(() => {
    if (anexos.length > 0 && !selecionado) {
      selecionarDoc(anexos[0])
    }
  }, [anexos])

  async function selecionarDoc(anexo) {
    if (selecionado?.id === anexo.id) return
    setSelecionado(anexo)
    setUrl(null)
    setErroUrl(false)
    setCarregando(true)
    try {
      const signedUrl = await gerarUrlAnexo(anexo.storage_path)
      setUrl(signedUrl)
    } catch {
      setErroUrl(true)
    }
    setCarregando(false)
  }

  if (anexos.length === 0) {
    return (
      <div className="form-card" style={{ textAlign: 'center', padding: '56px 32px' }}>
        <IconDoc size={40} />
        <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 16 }}>Nenhum documento registrado.</p>
      </div>
    )
  }

  const isPdf   = selecionado?.mime_type?.includes('pdf')
  const isImage = selecionado?.mime_type?.startsWith('image/')
  const catCfgSel = selecionado ? (CATEGORIA_CFG[selecionado.categoria] || { label: selecionado.categoria, cor: '#888', bg: '#f5f5f5' }) : null

  return (
    <div className="detalhe-docs-split">
      {/* ── Lista de documentos (esquerda / topo em mobile) ── */}
      <div className="detalhe-docs-lista">
        {anexos.map(a => {
          const catCfg   = CATEGORIA_CFG[a.categoria] || { label: a.categoria, cor: '#888', bg: '#f5f5f5' }
          const tamanho  = a.tamanho_bytes ? `${(a.tamanho_bytes / 1024).toFixed(0)} KB` : null
          const ativo    = selecionado?.id === a.id

          return (
            <button
              key={a.id}
              onClick={() => selecionarDoc(a)}
              style={{
                textAlign: 'left', cursor: 'pointer',
                border: `1.5px solid ${ativo ? '#00499f' : '#e2e8f0'}`,
                borderRadius: 10, padding: '12px 14px',
                background: ativo ? '#eff6ff' : '#fff',
                transition: 'border-color 0.15s, background 0.15s',
                flexShrink: 0,
              }}
            >
              <Badge label={catCfg.label} cor={catCfg.cor} bg={catCfg.bg} />
              <div style={{
                fontSize: 12, fontWeight: 600, color: ativo ? '#1e40af' : '#1e293b',
                marginTop: 8, wordBreak: 'break-all', lineHeight: 1.4,
              }}>
                {a.nome_original}
              </div>
              {tamanho && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{tamanho}</div>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Painel de preview (direita / baixo em mobile) ── */}
      <div style={{
        flex: 1, minWidth: 0, minHeight: 360,
        border: '1px solid #e2e8f0', borderRadius: 12,
        background: '#f8fafc',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Cabeçalho do preview */}
        {selecionado && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px', borderBottom: '1px solid #e2e8f0',
            background: '#fff', flexShrink: 0, gap: 12,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: '#1e293b',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {selecionado.nome_original}
              </div>
              {catCfgSel && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {catCfgSel.label}
                </div>
              )}
            </div>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 6,
                  fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  background: '#f1f5f9', color: '#475569',
                  border: '1px solid #e2e8f0',
                }}
              >
                ↗ Abrir nova aba
              </a>
            )}
          </div>
        )}

        {/* Conteúdo do preview */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {!selecionado ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: '#94a3b8', gap: 12,
            }}>
              <IconDoc size={40} />
              <span style={{ fontSize: 13 }}>Selecione um documento para visualizar</span>
            </div>
          ) : carregando ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#94a3b8', fontSize: 13,
            }}>
              Carregando pré-visualização…
            </div>
          ) : erroUrl ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: '#94a3b8', gap: 8,
            }}>
              <span style={{ fontSize: 32 }}>⚠</span>
              <span style={{ fontSize: 13 }}>Não foi possível gerar o link do arquivo.</span>
            </div>
          ) : isPdf ? (
            <iframe
              key={url}
              src={url}
              title={selecionado.nome_original}
              style={{ flex: 1, width: '100%', border: 'none', display: 'block', minHeight: 0 }}
            />
          ) : isImage ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <img
                src={url}
                alt={selecionado.nome_original}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
              />
            </div>
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: '#64748b', gap: 16,
            }}>
              <IconDoc size={40} color="#94a3b8" />
              <p style={{ fontSize: 13, margin: 0 }}>
                Este tipo de arquivo não pode ser visualizado diretamente.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: '#00499f', color: '#fff', textDecoration: 'none',
                }}
              >
                Abrir arquivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function RequerimentoDetalhe({ id, navigate }) {
  const [loading, setLoading]           = useState(true)
  const [req, setReq]                   = useState(null)
  const [validacoes, setValidacoes]     = useState([])
  const [anexos, setAnexos]             = useState([])
  const [eventos, setEventos]           = useState([])
  const [erro, setErro]                 = useState(null)
  const [aba, setAba]                   = useState('geral')
  const [perfilUsuario, setPerfilUsuario] = useState(null)

  // Alteração de fase
  const [menuFaseAberto, setMenuFaseAberto] = useState(false)
  const [salvandoFase, setSalvandoFase]     = useState(false)
  const [erroFase, setErroFase]             = useState(null)

  // Tarefas SIG
  const [tarefaSpaIniciada,   setTarefaSpaIniciada]   = useState(false)
  const [tarefaSpaConfirmada, setTarefaSpaConfirmada] = useState(false)
  const [numeroProcesso,      setNumeroProcesso]      = useState('')
  const [editandoProcesso,    setEditandoProcesso]    = useState(false)
  const [salvandoProcesso,    setSalvandoProcesso]    = useState(false)
  const [erroProcesso,        setErroProcesso]        = useState(null)

  // Tarefas Coordenação
  // { [validacao_id]: { decisao, mencao, nota, cargaHoraria } }
  const [decisoesCoord,        setDecisoesCoord]        = useState({})
  const [decisoesSalvas,       setDecisoesSalvas]       = useState(false)
  const [salvandoDecisoes,     setSalvandoDecisoes]     = useState(false)
  const [erroDecisoes,         setErroDecisoes]         = useState(null)
  const [gerandoPDF,           setGerandoPDF]           = useState(false)
  const [tarefaPDFBaixado,     setTarefaPDFBaixado]     = useState(false)
  const [tarefaSPACoordConf,   setTarefaSPACoordConf]   = useState(false)
  const [observacoesCoord,     setObservacoesCoord]     = useState('')
  const carregarDados = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      const reqData = await buscarRequerimento(id)
      setReq(reqData)
      const [valsData, anexosData, eventosData] = await Promise.all([
        buscarValidacoes(id),
        buscarAnexos(id),
        buscarEventos(id),
      ])
      setValidacoes(valsData)
      setAnexos(anexosData)
      setEventos(eventosData)
    } catch {
      setErro('Requerimento não encontrado ou sem permissão de acesso.')
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    let active = true

    // getSession() aguarda qualquer refresh em andamento e retorna a sessão real.
    // Mais confiável que depender de INITIAL_SESSION, que pode chegar com session=null
    // durante o ciclo de mount/unmount do React StrictMode.
    async function init() {
      const s = await getSession()
      if (!active) return
      if (!s) { navigate('/login'); return }
      const perfil = await buscarPerfil(s.user.id)
      if (!active) return
      setPerfilUsuario(perfil)
      carregarDados()
    }

    // onAuthChange fica apenas como sentinela de SIGNED_OUT
    const sub = onAuthChange((event) => {
      if (event === 'SIGNED_OUT') navigate('/login')
    })

    init()

    return () => {
      active = false
      sub.unsubscribe()
    }
  }, [id])

  // Pré-preenche numero_processo ao carregar o req
  useEffect(() => {
    if (req?.numero_processo) setNumeroProcesso(req.numero_processo)
  }, [req?.id])

  // Inicializa decisoesCoord (com CH do currículo) e texto de observações
  useEffect(() => {
    if (validacoes.length === 0 || !req) return

    async function inicializar() {
      // Monta init base com o que já está salvo no banco
      const init = {}
      for (const v of validacoes) {
        let ex = {}
        try { ex = JSON.parse(v.decisao_observacao || '{}') } catch {}
        init[v.id] = {
          decisao:      v.decisao || null,
          mencao:       ex.mencao        || '',
          nota:         ex.nota          ?? null,
          cargaHoraria: ex.carga_horaria || '',
        }
      }

      // Para disciplinas sem CH salva, busca no currículo do curso
      const semCH = validacoes.filter(v => !init[v.id].cargaHoraria && v.ufsc_codigo)
      if (semCH.length > 0) {
        const codigos = semCH.map(v => v.ufsc_codigo)
        const mapaChCurriculo = await buscarCargaHorariasDisciplinas(req.curso, codigos)
        for (const v of semCH) {
          const ch = mapaChCurriculo[v.ufsc_codigo?.toUpperCase()]
          if (ch != null) init[v.id].cargaHoraria = String(ch)
        }
      }

      setDecisoesCoord(init)
      setDecisoesSalvas(validacoes.every(v => Boolean(v.decisao)))

      const textoAuto = gerarTextoObservacoes(validacoes, null)
      if (textoAuto) setObservacoesCoord(textoAuto)
    }

    inicializar()
  }, [validacoes.length, req?.id])

  async function alterarFase(novoStatus, extras = {}) {
    setMenuFaseAberto(false)
    setSalvandoFase(true)
    setErroFase(null)

    try {
      await alterarStatus(req, novoStatus, extras)
      setReq(prev => ({ ...prev, status: novoStatus }))
      const eventos = await buscarEventos(id)
      setEventos(eventos)
    } catch (error) {
      setErroFase(`Não foi possível alterar a fase: ${error.message}`)
      setTimeout(() => setErroFase(null), 6000)
    }

    setSalvandoFase(false)
  }

  // ── Funções de tarefas SIG ──────────────────────────────────────────────────
  async function baixarDocumentosEAbrirSPA() {
    await baixarAnexos(anexos)
    window.open(
      'https://sistemas.ufsc.br/login?service=https%3A%2F%2Fsolar.egestao.ufsc.br%2Fsolar%2F',
      '_blank'
    )
    setTarefaSpaIniciada(true)
  }

  async function confirmarTarefaSpa() {
    setTarefaSpaConfirmada(true)
    if (req.numero_processo && ['triagem_sig', 'em_analise_coord'].includes(req.status)) {
      await alterarFase('parecer_coord')
    }
  }

  async function salvarNumeroProcesso() {
    if (!numeroProcesso.trim()) return
    setSalvandoProcesso(true)
    setErroProcesso(null)
    try {
      await atualizarNumeroProcesso(id, numeroProcesso.trim())
      setReq(prev => ({ ...prev, numero_processo: numeroProcesso.trim() }))
      setEditandoProcesso(false)
    } catch {
      setSalvandoProcesso(false)
      setErroProcesso('Não foi possível salvar o número do processo.')
      setTimeout(() => setErroProcesso(null), 5000)
      return
    }
    setSalvandoProcesso(false)
    if (tarefaSpaConfirmada && ['triagem_sig', 'em_analise_coord'].includes(req.status)) {
      await alterarFase('parecer_coord')
    }
  }

  // ── Funções de tarefas Coordenação ──────────────────────────────────────────
  function atualizarDecisaoCoord(validacaoId, campo, valor) {
    setDecisoesCoord(prev => ({
      ...prev,
      [validacaoId]: { ...(prev[validacaoId] || {}), [campo]: valor },
    }))
    setDecisoesSalvas(false)
  }

  async function salvarDecisoes() {
    setSalvandoDecisoes(true)
    setErroDecisoes(null)
    try {
      await persistirDecisoes(decisoesCoord)
    } catch {
      setSalvandoDecisoes(false)
      setErroDecisoes('Erro ao salvar algumas decisões. Tente novamente.')
      return false
    }
    setSalvandoDecisoes(false)
    // Atualiza validacoes localmente
    setValidacoes(prev => prev.map(v => {
      const d = decisoesCoord[v.id]
      if (!d) return v
      return {
        ...v,
        decisao: d.decisao,
        decisao_observacao: JSON.stringify({
          mencao:        d.mencao        || null,
          nota:          d.nota          ?? null,
          carga_horaria: d.cargaHoraria  || null,
        }),
      }
    }))
    setDecisoesSalvas(true)

    // Regenera texto com todas as decisões (DEF e INDEF) com equivalências
    const textoAtualizado = gerarTextoObservacoes(validacoes, decisoesCoord)
    setObservacoesCoord(textoAtualizado)

    return true
  }

  async function gerarEBaixarFormularioCoord() {
    setGerandoPDF(true)
    const ok = await salvarDecisoes()
    if (!ok) { setGerandoPDF(false); return }
    const valsComDecisao = validacoes.map(v => {
      const d = decisoesCoord[v.id] || {}
      return {
        ...v,
        decisao: d.decisao || v.decisao,
        decisao_observacao: JSON.stringify({
          mencao:        d.mencao        || null,
          nota:          d.nota          ?? null,
          carga_horaria: d.cargaHoraria  || null,
        }),
      }
    })
    await gerarFormularioCoordPDF(req, valsComDecisao, observacoesCoord)
    window.open('https://assina.ufsc.br/', '_blank')
    window.open(
      'https://sistemas.ufsc.br/login?service=https%3A%2F%2Fsolar.egestao.ufsc.br%2Fsolar%2F',
      '_blank'
    )
    setTarefaPDFBaixado(true)
    setGerandoPDF(false)
  }

  async function confirmarEnvioSPACoord() {
    setTarefaSPACoordConf(true)
    if (req.status === 'parecer_coord') {
      // Monta lista de decisões para notificar o aluno via n8n
      const decisoesParaN8n = validacoes.map(v => {
        const d = decisoesCoord[v.id] || {}
        return {
          ufsc_codigo: v.ufsc_codigo,
          ufsc_nome:   v.ufsc_nome,
          decisao:     d.decisao || v.decisao || null,
          mencao:      d.mencao  || null,
          nota:        d.nota    ?? null,
        }
      })
      await alterarFase('concluido', {
        decisoes:    decisoesParaN8n,
        observacoes: observacoesCoord || null,
      })
    }
  }


  if (loading) return (
    <StaffLayout navigate={navigate}>
      <div className="page-container" style={{ textAlign: 'center', paddingTop: 60 }}>
        <p style={{ color: '#94a3b8' }}>Carregando requerimento…</p>
      </div>
    </StaffLayout>
  )

  if (erro) return (
    <StaffLayout navigate={navigate}>
      <div className="page-container" style={{ maxWidth: 520 }}>
        <div className="form-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#64748b' }}>{erro}</p>
          <button className="btn-back" onClick={() => navigate('/dashboard')} style={{ marginTop: 16 }}>
            ← Voltar ao painel
          </button>
        </div>
      </div>
    </StaffLayout>
  )

  const isCoord = perfilUsuario?.perfil === 'coordenacao'
  const statusCfg     = STATUS_CFG[req.status] || { label: req.status, cor: '#888', bg: '#f5f5f5' }
  const iaVeredicto   = req.sumario_ia?.veredicto
  const iaConfianca   = req.sumario_ia?.confianca
  const dataFormatada = new Date(req.criado_em).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const horasAberto = Math.round((Date.now() - new Date(req.criado_em)) / 3_600_000)
  function formatarTempoAberto(horas) {
    if (horas < 48)  return `${horas}h em aberto`
    const dias = Math.round(horas / 24)
    if (dias < 30)   return `${dias}d em aberto`
    return `${Math.round(dias / 30)}m em aberto`
  }

  return (
    <StaffLayout navigate={navigate}>
      <div className="detalhe-container">

        {/* ── Cabeçalho ── */}
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <button className="btn-back" onClick={() => navigate('/dashboard')} style={{ margin: 0, flexShrink: 0 }}>
              ← Painel
            </button>

            {/* Bloco central — protocolo + nome + data */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#00499f' }}>
                  {req.protocolo}
                </span>
                <Badge {...statusCfg} />
                {iaVeredicto && (
                  <Badge
                    label={`IA: ${iaVeredicto}${iaConfianca != null ? ` · ${Math.round(iaConfianca * 100)}%` : ''}`}
                    cor={iaVeredicto === 'aprovado' ? '#15803d' : iaVeredicto === 'rejeitado' ? '#b91c1c' : '#b45309'}
                    bg={iaVeredicto === 'aprovado'  ? '#f0fdf4' : iaVeredicto === 'rejeitado'  ? '#fef2f2' : '#fffbeb'}
                  />
                )}
              </div>

              {/* Banner de erro na alteração de fase */}
              {erroFase && (
                <div style={{
                  marginTop: 8, padding: '8px 12px', borderRadius: 8,
                  background: '#fff7ed', border: '1px solid #fed7aa',
                  color: '#c2410c', fontSize: 12, fontWeight: 500,
                }}>
                  ⚠ {erroFase}
                </div>
              )}
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                {req.matricula && (
                  <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: '#64748b', marginRight: 8 }}>
                    {req.matricula} ·
                  </span>
                )}
                {req.nome_aluno}
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {dataFormatada} · {horasAberto > 72
                  ? <span style={{ color: '#b91c1c', fontWeight: 600 }}>⚠ {formatarTempoAberto(horasAberto)}</span>
                  : formatarTempoAberto(horasAberto)}
              </div>
            </div>

            {/* Botão "Alterar fase" — lateral direita do cabeçalho */}
            {(!isCoord || req.status === 'parecer_coord') && (
              <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'center' }}>
                <button
                  onClick={() => setMenuFaseAberto(f => !f)}
                  disabled={salvandoFase}
                  title="Alterar fase do requerimento"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    border: '1px solid #e2e8f0',
                    background: menuFaseAberto ? '#f1f5f9' : '#fff',
                    color: '#475569', cursor: salvandoFase ? 'default' : 'pointer',
                    transition: 'background 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  {salvandoFase ? 'Salvando…' : 'Alterar fase'}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginTop: 1 }}>
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Dropdown de fases */}
                {menuFaseAberto && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                      onClick={() => setMenuFaseAberto(false)}
                    />
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
                      background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                      minWidth: 220, padding: '6px 0', overflow: 'hidden',
                    }}>
                      <div style={{ padding: '6px 14px 8px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Selecionar etapa
                      </div>
                      {(isCoord ? FASES_DISPONIVEIS.filter(f => f.status === 'concluido') : FASES_DISPONIVEIS).map(fase => {
                        const isAtual = req.status === fase.status
                        return (
                          <button
                            key={fase.status}
                            onClick={() => !isAtual && alterarFase(fase.status)}
                            style={{
                              width: '100%', textAlign: 'left', border: 'none',
                              padding: '9px 14px', fontSize: 13,
                              background: isAtual ? '#f8fafc' : 'transparent',
                              cursor: isAtual ? 'default' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: 10,
                              color: isAtual ? '#94a3b8' : '#1e293b',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => { if (!isAtual) e.currentTarget.style.background = '#f8fafc' }}
                            onMouseLeave={e => { if (!isAtual) e.currentTarget.style.background = 'transparent' }}
                          >
                            <span style={{
                              width: 9, height: 9, borderRadius: '50%',
                              background: isAtual ? '#cbd5e1' : fase.cor,
                              flexShrink: 0,
                            }} />
                            <span style={{ fontWeight: isAtual ? 700 : 500 }}>{fase.label}</span>
                            {isAtual && (
                              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
                                atual
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Abas ── */}
        <nav className="detalhe-abas">
          {ABAS.map(tab => {
            const isActive = aba === tab.id
            const badge = tab.id === 'documentos' ? anexos.length
                        : tab.id === 'historico'  ? eventos.length
                        : null
            return (
              <button
                key={tab.id}
                onClick={() => setAba(tab.id)}
                style={{
                  padding: '12px 20px',
                  border: 'none',
                  boxShadow: isActive ? 'inset 0 -2px 0 #00499f' : 'none',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 14,
                  color: isActive ? '#00499f' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'color 0.15s',
                  outline: 'none',
                }}
              >
                {tab.label}
                {badge != null && badge > 0 && (
                  <span style={{
                    backgroundColor: isActive ? '#00499f' : '#e2e8f0',
                    color: isActive ? '#ffffff' : '#64748b',
                    borderRadius: 20, padding: '0 7px',
                    fontSize: 11, fontWeight: 700, lineHeight: '18px',
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* ══ Aba: Informações Gerais ══════════════════════════════════════════ */}
        {aba === 'geral' && (
          <div className="detalhe-geral-grid">
            {/* Coluna esquerda: Dados + IA empilhados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Secao titulo="Dados do Aluno">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                  <Campo label="Nome completo" valor={req.nome_aluno} span />
                  <Campo label="Matrícula"     valor={req.matricula} />
                  <Campo label="CPF"           valor={req.cpf} />
                  <Campo label="Curso"         valor={req.curso} span />
                  <Campo label="E-mail"        valor={req.email} span />
                  <Campo label="Telefone"      valor={req.telefone} />
                </div>
              </Secao>

              <Secao titulo="Processo SIG" style={{ padding: '18px 22px' }}>
                {req.numero_processo ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Número do processo
                    </div>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#1e293b',
                      backgroundColor: '#f0fdf4', border: '1px solid #86efac',
                      borderRadius: 6, padding: '6px 12px', display: 'inline-block',
                    }}>
                      {req.numero_processo}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Número ainda não inserido.</p>
                )}
              </Secao>

              <Secao titulo="Análise da IA" style={{ padding: '18px 22px' }}>
                {req.sumario_ia ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Badge
                        label={`Veredicto: ${req.sumario_ia.veredicto || '—'}`}
                        cor={iaVeredicto === 'aprovado' ? '#15803d' : iaVeredicto === 'rejeitado' ? '#b91c1c' : '#b45309'}
                        bg={iaVeredicto === 'aprovado'  ? '#f0fdf4' : iaVeredicto === 'rejeitado'  ? '#fef2f2' : '#fffbeb'}
                      />
                      {iaConfianca != null && (
                        <Badge label={`Confiança: ${Math.round(iaConfianca * 100)}%`} cor="#475569" bg="#f1f5f9" />
                      )}
                    </div>
                    {req.sumario_ia.observacoes && (
                      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0 }}>
                        {req.sumario_ia.observacoes}
                      </p>
                    )}
                    {req.sumario_ia_modelo && (
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        Modelo: {req.sumario_ia_modelo}
                        {req.sumario_ia_em && ` · ${new Date(req.sumario_ia_em).toLocaleString('pt-BR')}`}
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Análise ainda não processada.</p>
                )}
              </Secao>
            </div>

            {/* Coluna direita: Validações */}
            <Secao titulo={`Validações Solicitadas (${validacoes.length})`}>
              {validacoes.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>Nenhuma validação encontrada.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {validacoes.map((v, idx) => (
                    <ValidacaoCard key={v.id} v={v} idx={idx} />
                  ))}
                </div>
              )}
            </Secao>
          </div>
        )}

        {/* ══ Aba: Documentos — split-pane ════════════════════════════════════ */}
        {aba === 'documentos' && <AbaDocumentos anexos={anexos} />}

        {/* ══ Aba: Tarefas ════════════════════════════════════════════════════ */}
        {aba === 'tarefas' && req.status === 'parecer_coord' ? (
          <AbaTarefasCoord
            req={req}
            validacoes={validacoes}
            decisoesCoord={decisoesCoord}
            onDecisaoChange={atualizarDecisaoCoord}
            decisoesSalvas={decisoesSalvas}
            salvandoDecisoes={salvandoDecisoes}
            erroDecisoes={erroDecisoes}
            onSalvarDecisoes={salvarDecisoes}
            observacoesCoord={observacoesCoord}
            onObservacoesChange={setObservacoesCoord}
            gerandoPDF={gerandoPDF}
            tarefaPDFBaixado={tarefaPDFBaixado}
            onGerarPDF={gerarEBaixarFormularioCoord}
            tarefaSPACoordConf={tarefaSPACoordConf}
            onConfirmarSPACoord={confirmarEnvioSPACoord}
            somenteLeitura={!isCoord}
          />
        ) : aba === 'tarefas' ? (
          <AbaTarefasSIG
            req={req}
            anexos={anexos}
            tarefaSpaIniciada={tarefaSpaIniciada}
            tarefaSpaConfirmada={tarefaSpaConfirmada}
            onBaixarEAbrirSPA={baixarDocumentosEAbrirSPA}
            onConfirmarSpa={confirmarTarefaSpa}
            numeroProcesso={numeroProcesso}
            onNumeroProcessoChange={setNumeroProcesso}
            onSalvarProcesso={salvarNumeroProcesso}
            salvandoProcesso={salvandoProcesso}
            erroProcesso={erroProcesso}
            editandoProcesso={editandoProcesso}
            onEditarProcesso={() => setEditandoProcesso(true)}
            onCancelarEdicao={() => { setEditandoProcesso(false); setNumeroProcesso(req.numero_processo || '') }}
          />
        ) : null}

        {/* ══ Aba: Histórico ══════════════════════════════════════════════════ */}
        {aba === 'historico' && <AbaHistorico eventos={eventos} />}


      </div>

    </StaffLayout>
  )
}

// ── Helpers do histórico ───────────────────────────────────────────────────────
const PERFIL_CFG = {
  sig:          { label: 'SIG',         cor: '#1d4ed8', bg: '#eff6ff' },
  coordenacao:  { label: 'Coordenação', cor: '#0369a1', bg: '#e0f2fe' },
  admin:        { label: 'Admin',       cor: '#7c3aed', bg: '#f5f3ff' },
  aluno:        { label: 'Aluno',       cor: '#475569', bg: '#f1f5f9' },
}

function parseStatusChange(descricao) {
  if (!descricao) return null
  const m = descricao.match(/Status alterado de (\w+) para (\w+)/)
  return m ? { de: m[1], para: m[2] } : null
}

function tempoRelativo(dataStr) {
  const mins = Math.round((Date.now() - new Date(dataStr)) / 60_000)
  if (mins < 1)   return 'agora mesmo'
  if (mins < 60)  return `${mins} min atrás`
  const hrs = Math.round(mins / 60)
  if (hrs < 24)   return `${hrs}h atrás`
  const dias = Math.round(hrs / 24)
  if (dias === 1) return 'ontem'
  if (dias < 30)  return `${dias} dias atrás`
  return `${Math.round(dias / 30)} meses atrás`
}

function StatusChip({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, cor: '#888', bg: '#f5f5f5' }
  return (
    <span style={{
      background: cfg.bg, color: cfg.cor,
      borderRadius: 10, padding: '3px 10px',
      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

// ── Aba Histórico ──────────────────────────────────────────────────────────────
function AbaHistorico({ eventos }) {
  if (eventos.length === 0) {
    return (
      <div className="form-card" style={{ textAlign: 'center', padding: '56px 32px' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ color: '#cbd5e1', marginBottom: 14 }}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
          <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Nenhum evento registrado ainda.</p>
      </div>
    )
  }

  return (
    <div className="form-card" style={{}}>
      <div style={{
        fontWeight: 700, fontSize: 14, color: '#1e293b',
        paddingBottom: 12, marginBottom: 24, borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Histórico de Eventos</span>
        <span style={{
          fontSize: 12, fontWeight: 600, color: '#94a3b8',
          background: '#f1f5f9', borderRadius: 20, padding: '2px 10px',
        }}>
          {eventos.length} {eventos.length === 1 ? 'evento' : 'eventos'}
        </span>
      </div>

      <div>
        {eventos.map((ev, i) => {
          const statusChange  = parseStatusChange(ev.descricao || ev.tipo_evento)
          const nomeAutor     = ev.autor?.nome || 'Sistema'
          const perfilAutor   = ev.autor?.perfil
          const perfilCfg     = perfilAutor ? (PERFIL_CFG[perfilAutor] || { label: perfilAutor, cor: '#475569', bg: '#f1f5f9' }) : null
          const dataFormatada = new Date(ev.criado_em).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })
          const relativo = tempoRelativo(ev.criado_em)
          const isLast   = i === eventos.length - 1

          return (
            <div key={ev.id} style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 28 }}>

              {/* Coluna da timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
                {/* Ícone do evento */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: statusChange ? '#eff6ff' : '#f8fafc',
                  border: `2px solid ${statusChange ? '#93c5fd' : '#e2e8f0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {statusChange ? (
                    /* ícone seta direita */
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#3b82f6' }}>
                      <path d="M2 5h7.5M6.5 2.5L10 5l-3.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 9h7.5M6.5 6.5L10 9l-3.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    /* ícone info */
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: '#94a3b8' }}>
                      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
                      <line x1="6.5" y1="6" x2="6.5" y2="9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      <circle cx="6.5" cy="4" r="0.7" fill="currentColor"/>
                    </svg>
                  )}
                </div>
                {/* Linha conectora */}
                {!isLast && (
                  <div style={{ width: 2, flex: 1, background: '#e2e8f0', marginTop: 6, borderRadius: 2 }} />
                )}
              </div>

              {/* Conteúdo do evento */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>

                {statusChange ? (
                  /* Mudança de status: renderiza com badges */
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                      Mudança de etapa
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <StatusChip status={statusChange.de} />
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#94a3b8', flexShrink: 0 }}>
                        <path d="M2 7h10M8 4l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <StatusChip status={statusChange.para} />
                    </div>
                  </div>
                ) : (
                  /* Evento genérico */
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 4, lineHeight: 1.4 }}>
                    {ev.descricao || ev.tipo_evento}
                  </div>
                )}

                {/* Rodapé: autor + timestamp */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  marginTop: 10,
                }}>
                  {/* Avatar + nome */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: perfilCfg ? perfilCfg.cor : '#94a3b8',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>
                      {nomeAutor.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{nomeAutor}</span>
                    {perfilCfg && (
                      <span style={{
                        background: perfilCfg.bg, color: perfilCfg.cor,
                        borderRadius: 20, padding: '1px 8px',
                        fontSize: 10, fontWeight: 700,
                      }}>
                        {perfilCfg.label}
                      </span>
                    )}
                  </div>

                  {/* Separador */}
                  <span style={{ color: '#e2e8f0', fontSize: 14 }}>·</span>

                  {/* Timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: '#94a3b8', flexShrink: 0 }}>
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M6 3.5V6l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{dataFormatada}</span>
                    <span style={{ fontSize: 11, color: '#cbd5e1' }}>({relativo})</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Helper: gera texto de observações com equivalências explícitas ─────────────
function gerarTextoObservacoes(validacoes, decisoesMap) {
  const linhas = []

  for (const v of validacoes) {
    const d      = decisoesMap?.[v.id] || {}
    const decisao = d.decisao || v.decisao
    if (!decisao) continue

    // Lado UFSC
    const ufscParts = [v.ufsc_codigo, v.ufsc_nome].filter(Boolean)
    const ufsc = ufscParts.join(' ') || 'Disciplina UFSC'

    // Disciplinas cursadas (equivalência)
    const cursadas = v.disciplinas_cursadas || []
    const equivParts = cursadas.map(c => {
      const cod  = c.codigo ? `${c.codigo} ` : ''
      const nome = c.nome   || ''
      const inst = c.instituicao ? ` / ${c.instituicao}` : ''
      const ch   = c.carga_horaria ? ` (${c.carga_horaria}h)` : ''
      return `${cod}${nome}${inst}${ch}`.trim()
    })
    const equivStr = equivParts.length ? ` / ${equivParts.join('; ')}` : ''

    if (decisao === 'aprovado') {
      const nota   = d.nota   ?? null
      const mencao = d.mencao || ''
      const extras = [
        nota !== null ? `Nota: ${nota.toFixed(1)}` : null,
        mencao        ? `Menção: ${mencao}`         : null,
      ].filter(Boolean).join(' | ')
      linhas.push(`${ufsc}${equivStr} — DEFERIDO${extras ? '. ' + extras + '.' : '.'}`)
    } else {
      linhas.push(`${ufsc}${equivStr} — INDEFERIDO.`)
    }
  }

  return linhas.join('\n')
}

// ── Aba Tarefas Coordenação ────────────────────────────────────────────────────
const NOTAS_COORD = [6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0]

function AbaTarefasCoord({
  req, validacoes,
  decisoesCoord, onDecisaoChange,
  decisoesSalvas, salvandoDecisoes, erroDecisoes, onSalvarDecisoes,
  observacoesCoord, onObservacoesChange,
  gerandoPDF, tarefaPDFBaixado, onGerarPDF,
  tarefaSPACoordConf, onConfirmarSPACoord,
  somenteLeitura = false,
}) {
  const todasComDecisao = validacoes.length > 0 && validacoes.every(v => decisoesCoord[v.id]?.decisao)
  const tarefaFormConcluida = todasComDecisao && decisoesSalvas
  const concluidas = (tarefaFormConcluida ? 1 : 0) + (tarefaSPACoordConf ? 1 : 0)

  const inputBase = {
    padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0',
    fontSize: 12, color: '#1e293b', background: '#fff', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>

      {somenteLeitura && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#fffbeb', border: '1px solid #fcd34d',
          borderRadius: 8, padding: '10px 16px',
          fontSize: 13, color: '#92400e',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <rect x="5" y="1" width="6" height="1.5" rx="0.75" fill="currentColor"/>
            <path d="M3 7h10v7a1 1 0 01-1 1H4a1 1 0 01-1-1V7z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
            <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
          </svg>
          <span>Estas tarefas são de responsabilidade da coordenação. Você está visualizando em modo somente leitura.</span>
        </div>
      )}

      <div style={{ pointerEvents: somenteLeitura ? 'none' : 'auto', opacity: somenteLeitura ? 0.7 : 1 }}>

      {/* Cabeçalho com progresso */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Tarefas da Coordenação</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            {concluidas} de 2 concluídas{tarefaSPACoordConf && ' · Avançando para Concluído…'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 90, height: 6, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${concluidas * 50}%`, height: '100%',
              background: concluidas === 2 ? '#15803d' : '#00499f',
              borderRadius: 6, transition: 'width 0.4s',
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: concluidas === 2 ? '#15803d' : '#64748b' }}>
            {concluidas}/2
          </span>
        </div>
      </div>

      {/* ── Tarefa 1: Preencher formulário ── */}
      <div style={{
        border: `1.5px solid ${tarefaFormConcluida ? '#86efac' : '#e2e8f0'}`,
        borderRadius: 10, background: tarefaFormConcluida ? '#f0fdf4' : '#fff',
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: tarefaFormConcluida ? '#15803d' : '#00499f',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700,
          }}>
            {tarefaFormConcluida ? '✓' : '1'}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>
              Preencher formulário de validação
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 14 }}>
              Para cada disciplina, defina a decisão (DEF/INDEF), a menção e a nota atribuída.
              Esses dados serão usados para gerar o formulário oficial UFSC.
            </div>

            {/* Tabela de disciplinas */}
            <div className="detalhe-coord-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Cabeçalho da tabela */}
              <div className="detalhe-coord-header" style={{
                padding: '6px 10px',
                background: '#f8fafc', borderRadius: 7,
                border: '1px solid #e2e8f0',
                fontSize: 11, fontWeight: 700, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <span>Disciplina UFSC</span>
                <span style={{ textAlign: 'center' }}>Decisão</span>
                <span style={{ textAlign: 'center' }}>C.H. (horas)</span>
                <span style={{ textAlign: 'center' }}>Menção</span>
                <span style={{ textAlign: 'center' }}>Nota atribuída</span>
              </div>

              {/* Linhas por validação */}
              {validacoes.map(v => {
                const d = decisoesCoord[v.id] || { decisao: null, mencao: '', nota: null, cargaHoraria: '' }
                const isDef   = d.decisao === 'aprovado'
                const isIndef = d.decisao === 'rejeitado'

                return (
                  <div key={v.id} className="detalhe-coord-row" style={{
                    padding: '10px',
                    background: '#fff', borderRadius: 8,
                    border: `1px solid ${isDef ? '#bbf7d0' : isIndef ? '#fecaca' : '#e2e8f0'}`,
                  }}>
                    {/* Disciplina */}
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#00499f' }}>
                        {v.ufsc_codigo}
                      </div>
                      <div style={{ fontSize: 12, color: '#1e293b', marginTop: 2, lineHeight: 1.3 }}>
                        {v.ufsc_nome}
                      </div>
                    </div>

                    {/* DEF / INDEF */}
                    <div>
                      <div className="coord-mobile-label">Decisão</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => onDecisaoChange(v.id, 'decisao', isDef ? null : 'aprovado')}
                          style={{
                            flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
                            fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: isDef ? '#15803d' : '#f1f5f9',
                            color: isDef ? '#fff' : '#64748b',
                            transition: 'background 0.15s',
                          }}
                        >DEF</button>
                        <button
                          onClick={() => onDecisaoChange(v.id, 'decisao', isIndef ? null : 'rejeitado')}
                          style={{
                            flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
                            fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: isIndef ? '#b91c1c' : '#f1f5f9',
                            color: isIndef ? '#fff' : '#64748b',
                            transition: 'background 0.15s',
                          }}
                        >INDEF</button>
                      </div>
                    </div>

                    {/* Carga horária */}
                    <div>
                      <div className="coord-mobile-label">C.H. (horas)</div>
                      <input
                        type="text"
                        value={d.cargaHoraria}
                        onChange={e => onDecisaoChange(v.id, 'cargaHoraria', e.target.value)}
                        placeholder="Ex: 72h"
                        style={{ ...inputBase, width: '100%', textAlign: 'center' }}
                      />
                    </div>

                    {/* Menção */}
                    <div>
                      <div className="coord-mobile-label">Menção</div>
                      <input
                        type="text"
                        value={d.mencao}
                        onChange={e => onDecisaoChange(v.id, 'mencao', e.target.value.toUpperCase())}
                        placeholder="A, B…"
                        disabled={isIndef}
                        style={{
                          ...inputBase, width: '100%', textAlign: 'center',
                          opacity: isIndef ? 0.4 : 1,
                        }}
                      />
                    </div>

                    {/* Nota (chips 6.0–10.0) */}
                    <div style={{
                      opacity: isIndef ? 0.4 : 1,
                      pointerEvents: isIndef ? 'none' : 'auto',
                    }}>
                      <div className="coord-mobile-label">Nota atribuída</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {NOTAS_COORD.map(n => {
                        const ativo = d.nota === n
                        return (
                          <button
                            key={n}
                            onClick={() => onDecisaoChange(v.id, 'nota', ativo ? null : n)}
                            style={{
                              padding: '3px 7px', borderRadius: 5, border: 'none',
                              fontSize: 10, fontWeight: 700, cursor: 'pointer',
                              background: ativo ? '#00499f' : '#f1f5f9',
                              color: ativo ? '#fff' : '#64748b',
                              transition: 'background 0.1s',
                            }}
                          >{n.toFixed(1)}</button>
                        )
                      })}
                      </div>{/* fim flex notas */}
                    </div>{/* fim wrapper nota */}
                  </div>
                )
              })}
            </div>

            {/* Botão salvar */}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={onSalvarDecisoes}
                disabled={!todasComDecisao || salvandoDecisoes}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: (!todasComDecisao || salvandoDecisoes) ? '#e2e8f0' : '#00499f',
                  color: (!todasComDecisao || salvandoDecisoes) ? '#94a3b8' : '#fff',
                  fontSize: 13, fontWeight: 600,
                  cursor: (!todasComDecisao || salvandoDecisoes) ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {salvandoDecisoes ? 'Salvando…' : 'Salvar decisões'}
              </button>
              {tarefaFormConcluida && (
                <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                  ✓ Decisões salvas
                </span>
              )}
              {!todasComDecisao && (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  Preencha a decisão de todas as disciplinas para salvar.
                </span>
              )}
            </div>
            {erroDecisoes && (
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>{erroDecisoes}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Observações e justificativas (página 2 do formulário) ── */}
      <div style={{
        border: '1.5px solid #e2e8f0', borderRadius: 10,
        background: '#fff', padding: '16px 20px',
      }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 3 }}>
            Observações e Justificativas
          </div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            Corresponde à <strong>página 2</strong> do formulário oficial —
            "Espaço reservado para validação parcial de disciplinas, bem como, justificativa das validações indeferidas."
            As disciplinas indeferidas são inseridas automaticamente; você pode complementar livremente.
          </div>
        </div>
        <textarea
          value={observacoesCoord}
          onChange={e => onObservacoesChange(e.target.value)}
          placeholder="As justificativas das disciplinas indeferidas aparecerão aqui automaticamente após salvar as decisões. Adicione observações complementares conforme necessário."
          rows={8}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 12px', borderRadius: 8,
            border: '1px solid #e2e8f0',
            fontSize: 13, color: '#1e293b', lineHeight: 1.7,
            background: '#f8fafc', outline: 'none', resize: 'vertical',
            fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.background = '#fff' }}
          onBlur={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc' }}
        />
        {observacoesCoord && (
          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {observacoesCoord.split('\n').filter(Boolean).length} linha(s) · {observacoesCoord.length} caracteres
            </span>
            <button
              onClick={() => onObservacoesChange('')}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 11, color: '#94a3b8', padding: '2px 6px',
              }}
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      {/* ── Tarefa 2: Gerar PDF + SPA ── */}
      <div style={{
        border: `1.5px solid ${tarefaSPACoordConf ? '#86efac' : tarefaFormConcluida ? '#e2e8f0' : '#f1f5f9'}`,
        borderRadius: 10,
        background: tarefaSPACoordConf ? '#f0fdf4' : '#fff',
        padding: '16px 20px',
        opacity: tarefaFormConcluida ? 1 : 0.55,
        transition: 'opacity 0.3s',
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: tarefaSPACoordConf ? '#15803d' : tarefaFormConcluida ? '#475569' : '#cbd5e1',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700,
          }}>
            {tarefaSPACoordConf ? '✓' : '2'}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>
              Gerar formulário, baixar e enviar ao SPA
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 12 }}>
              Gera o formulário oficial "Validação de Disciplinas" da UFSC preenchido com as decisões
              acima, abre o SOLAR/SPA para anexar o documento ao processo.
            </div>

            {tarefaSPACoordConf ? (
              <div style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                ✓ Formulário enviado ao SPA
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={onGerarPDF}
                  disabled={gerandoPDF || !tarefaFormConcluida}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '9px 18px', borderRadius: 8, border: 'none',
                    background: gerandoPDF || !tarefaFormConcluida ? '#94a3b8' : '#00499f',
                    color: '#fff', fontSize: 13, fontWeight: 600,
                    cursor: (gerandoPDF || !tarefaFormConcluida) ? 'default' : 'pointer',
                    alignSelf: 'flex-start', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!gerandoPDF && tarefaFormConcluida) e.currentTarget.style.background = '#1d4ed8' }}
                  onMouseLeave={e => { if (!gerandoPDF && tarefaFormConcluida) e.currentTarget.style.background = '#00499f' }}
                >
                  {gerandoPDF ? '⏳ Gerando PDF…' : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1v8M4 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Gerar formulário PDF e abrir SPA
                    </>
                  )}
                </button>

                {tarefaPDFBaixado && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={tarefaSPACoordConf}
                      onChange={e => e.target.checked && onConfirmarSPACoord()}
                      style={{ width: 16, height: 16, accentColor: '#15803d', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: '#475569' }}>
                      Confirmo que o formulário foi enviado ao SPA
                    </span>
                  </label>
                )}

                {!tarefaPDFBaixado && tarefaFormConcluida && (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Clique no botão acima para gerar o PDF e abrir o SPA.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Banner de conclusão */}
      {tarefaSPACoordConf && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac',
          borderRadius: 10, padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, color: '#15803d', fontWeight: 600,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Todas as tarefas concluídas — avançando para Concluído…
        </div>
      )}

      </div>{/* fim do wrapper somenteLeitura */}
    </div>
  )
}

// ── Aba Tarefas SIG ────────────────────────────────────────────────────────────
function AbaTarefasSIG({
  req,
  anexos,
  tarefaSpaIniciada,
  tarefaSpaConfirmada,
  onBaixarEAbrirSPA,
  onConfirmarSpa,
  numeroProcesso,
  onNumeroProcessoChange,
  onSalvarProcesso,
  salvandoProcesso,
  erroProcesso,
  editandoProcesso,
  onEditarProcesso,
  onCancelarEdicao,
}) {
  const [baixando, setBaixando] = useState(false)

  const isFaseSIG        = ['triagem_sig', 'em_analise_coord'].includes(req.status)
  const tarefaProcessoSalvo = Boolean(req.numero_processo)
  const concluidas       = (tarefaSpaConfirmada ? 1 : 0) + (tarefaProcessoSalvo ? 1 : 0)
  const todasConcluidas  = tarefaSpaConfirmada && tarefaProcessoSalvo

  if (!isFaseSIG) {
    return (
      <div className="form-card" style={{ textAlign: 'center', padding: '56px 32px' }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>✅</div>
        <div style={{ fontWeight: 600, fontSize: 15, color: '#64748b', marginBottom: 8 }}>
          Sem tarefas pendentes nesta fase
        </div>
        <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>
          As tarefas SIG são ativadas nas fases de Triagem SIG e Análise SIG.
        </p>
      </div>
    )
  }

  async function handleBaixar() {
    setBaixando(true)
    await onBaixarEAbrirSPA()
    setBaixando(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 700 }}>

      {/* Cabeçalho com progresso */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Tarefas da Fase SIG</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            {concluidas} de 2 concluídas
            {todasConcluidas && ' · Avançando para Coordenação…'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 90, height: 6, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${concluidas * 50}%`, height: '100%',
              background: todasConcluidas ? '#15803d' : '#00499f',
              borderRadius: 6, transition: 'width 0.4s',
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: todasConcluidas ? '#15803d' : '#64748b' }}>
            {concluidas}/2
          </span>
        </div>
      </div>

      {/* ── Tarefa 1: Adicionar arquivos no SPA ── */}
      <div style={{
        border: `1.5px solid ${tarefaSpaConfirmada ? '#86efac' : '#e2e8f0'}`,
        borderRadius: 10, background: tarefaSpaConfirmada ? '#f0fdf4' : '#fff',
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Número/check */}
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: tarefaSpaConfirmada ? '#15803d' : '#00499f',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700,
          }}>
            {tarefaSpaConfirmada ? '✓' : '1'}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>
              Adicionar arquivos no SPA
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 12 }}>
              Baixe todos os documentos do requerimento e adicione-os ao processo no SOLAR/SPA da UFSC.
              {anexos.length > 0 && (
                <span style={{ marginLeft: 6, fontWeight: 600, color: '#475569' }}>
                  ({anexos.length} {anexos.length === 1 ? 'documento' : 'documentos'})
                </span>
              )}
            </div>

            {tarefaSpaConfirmada ? (
              <div style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                ✓ Arquivos confirmados no SPA
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={handleBaixar}
                  disabled={baixando}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: baixando ? '#94a3b8' : '#00499f',
                    color: '#fff', fontSize: 13, fontWeight: 600,
                    cursor: baixando ? 'default' : 'pointer',
                    alignSelf: 'flex-start', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!baixando) e.currentTarget.style.background = '#1d4ed8' }}
                  onMouseLeave={e => { if (!baixando) e.currentTarget.style.background = '#00499f' }}
                >
                  {baixando ? '⏳ Preparando downloads…' : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1v8M4 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Baixar documentos e abrir SPA
                    </>
                  )}
                </button>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={tarefaSpaConfirmada}
                    onChange={e => e.target.checked && onConfirmarSpa()}
                    style={{ width: 16, height: 16, accentColor: '#15803d', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: '#475569' }}>
                    Confirmo que os arquivos foram adicionados ao SPA
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tarefa 2: Número do processo ── */}
      <div style={{
        border: `1.5px solid ${tarefaProcessoSalvo ? '#86efac' : '#e2e8f0'}`,
        borderRadius: 10, background: tarefaProcessoSalvo ? '#f0fdf4' : '#fff',
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: tarefaProcessoSalvo ? '#15803d' : '#475569',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700,
          }}>
            {tarefaProcessoSalvo ? '✓' : '2'}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>
              Adicionar número do processo
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 12 }}>
              Informe o número do processo gerado no SPA após a abertura do protocolo.
            </div>

            {tarefaProcessoSalvo && !editandoProcesso ? (
              <div>
                <div style={{ fontSize: 13, color: '#15803d', fontWeight: 600, marginBottom: 8 }}>
                  ✓ Processo registrado
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#1e293b',
                    background: '#f0fdf4', border: '1px solid #86efac',
                    borderRadius: 6, padding: '6px 12px', display: 'inline-block',
                  }}>
                    {req.numero_processo}
                  </div>
                  <button
                    onClick={onEditarProcesso}
                    style={{
                      border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff',
                      padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    ✏ Editar
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={numeroProcesso}
                    onChange={e => onNumeroProcessoChange(e.target.value)}
                    placeholder="Ex: 23080.012345/2024-67"
                    style={{
                      padding: '8px 12px', borderRadius: 7,
                      border: `1px solid ${erroProcesso ? '#fca5a5' : '#e2e8f0'}`,
                      fontSize: 13, color: '#1e293b', background: '#fff',
                      outline: 'none', minWidth: 260, fontFamily: 'monospace',
                    }}
                    onKeyDown={e => e.key === 'Enter' && numeroProcesso.trim() && onSalvarProcesso()}
                    autoFocus={editandoProcesso}
                  />
                  <button
                    onClick={onSalvarProcesso}
                    disabled={salvandoProcesso || !numeroProcesso.trim()}
                    style={{
                      padding: '8px 16px', borderRadius: 7, border: 'none',
                      background: (!numeroProcesso.trim() || salvandoProcesso) ? '#e2e8f0' : '#00499f',
                      color: (!numeroProcesso.trim() || salvandoProcesso) ? '#94a3b8' : '#fff',
                      fontSize: 13, fontWeight: 600,
                      cursor: (!numeroProcesso.trim() || salvandoProcesso) ? 'default' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {salvandoProcesso ? 'Salvando…' : 'Salvar'}
                  </button>
                  {editandoProcesso && (
                    <button
                      onClick={onCancelarEdicao}
                      style={{
                        padding: '8px 14px', borderRadius: 7, border: '1px solid #e2e8f0',
                        background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
                {erroProcesso && (
                  <div style={{ fontSize: 12, color: '#b91c1c' }}>{erroProcesso}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Banner de avanço automático */}
      {todasConcluidas && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac',
          borderRadius: 10, padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, color: '#15803d', fontWeight: 600,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Todas as tarefas concluídas — avançando para Coordenação…
        </div>
      )}

    </div>
  )
}



// ── Card de validação expansível ───────────────────────────────────────────────
function ValidacaoCard({ v, idx }) {
  const [aberto, setAberto] = useState(true)
  const iaVeredicto = v.ia_veredicto
  const iaConfianca = v.ia_confianca

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', backgroundColor: '#ffffff' }}>
      <button
        onClick={() => setAberto(a => !a)}
        style={{
          width: '100%', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', background: '#f8fafc',
          border: 'none', cursor: 'pointer',
          borderBottom: aberto ? '1px solid #e2e8f0' : 'none',
        }}
      >
        <span style={{
          width: 26, height: 26, borderRadius: '50%',
          background: '#00499f', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {idx + 1}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>
            {v.ufsc_codigo && <span style={{ fontFamily: 'monospace', color: '#00499f' }}>{v.ufsc_codigo} · </span>}
            {v.ufsc_nome || 'Disciplina UFSC'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {v.tipo === 'interna' ? 'Validação interna — mesma instituição' : 'Validação externa'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {iaVeredicto && (
            <Badge
              label={`IA: ${iaVeredicto}${iaConfianca != null ? ` ${Math.round(iaConfianca * 100)}%` : ''}`}
              cor={iaVeredicto === 'aprovado' ? '#15803d' : iaVeredicto === 'rejeitado' ? '#b91c1c' : '#b45309'}
              bg={iaVeredicto === 'aprovado'  ? '#f0fdf4' : iaVeredicto === 'rejeitado'  ? '#fef2f2' : '#fffbeb'}
            />
          )}
          {v.decisao && (
            <Badge
              label={v.decisao.charAt(0).toUpperCase() + v.decisao.slice(1)}
              cor={v.decisao === 'aprovado' ? '#15803d' : v.decisao === 'rejeitado' ? '#b91c1c' : '#b45309'}
              bg={v.decisao === 'aprovado'  ? '#f0fdf4' : v.decisao === 'rejeitado'  ? '#fef2f2' : '#fffbeb'}
            />
          )}
          <span style={{ color: '#94a3b8', fontSize: 16 }}>{aberto ? '▲' : '▼'}</span>
        </div>
      </button>

      {aberto && (
        <div style={{ padding: '16px 18px', background: '#fff' }}>
          {v.disciplinas_cursadas?.length > 0 && (
            <div style={{ marginBottom: v.justificativa ? 16 : 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10,
              }}>
                Disciplinas cursadas para aproveitamento
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {v.disciplinas_cursadas.map(d => (
                  <div key={d.id} style={{
                    background: '#f8fafc', borderRadius: 8,
                    padding: '12px 14px', border: '1px solid #f1f5f9',
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: '8px 20px', marginBottom: d.ementa ? 10 : 0,
                    }}>
                      {d.codigo && <Campo label="Código" valor={d.codigo} />}
                      <Campo label="Disciplina"    valor={d.nome} />
                      <Campo label="Instituição"   valor={d.instituicao} />
                      <Campo label="Carga horária" valor={d.carga_horaria ? `${d.carga_horaria}h` : null} />
                      <Campo label="Créditos"      valor={d.creditos} />
                    </div>
                    {d.ementa && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{
                          fontSize: 11, fontWeight: 600, color: '#94a3b8',
                          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
                        }}>
                          Ementa
                        </div>
                        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0 }}>{d.ementa}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {v.justificativa && (
            <div style={{ marginTop: v.disciplinas_cursadas?.length ? 16 : 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
              }}>
                Justificativa
              </div>
              <p style={{
                fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0,
                background: '#fffbeb', padding: '10px 14px',
                borderRadius: 8, borderLeft: '3px solid #fcd34d',
              }}>
                {v.justificativa}
              </p>
            </div>
          )}

          {v.decisao && (() => {
            const isDef = v.decisao === 'aprovado'
            let obs = {}
            try { obs = JSON.parse(v.decisao_observacao || '{}') } catch {}
            const itens = [
              obs.carga_horaria ? `C.H.: ${obs.carga_horaria}h` : null,
              obs.mencao         ? `Menção: ${obs.mencao}`       : null,
              obs.nota != null   ? `Nota: ${obs.nota}`           : null,
            ].filter(Boolean)
            return (
              <div style={{
                marginTop: 16, padding: '10px 14px', borderRadius: 8,
                background: isDef ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${isDef ? '#bbf7d0' : '#fecaca'}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isDef ? '#15803d' : '#b91c1c', marginBottom: itens.length ? 8 : 0 }}>
                  {isDef ? '✓ Deferido' : '✗ Indeferido'}
                </div>
                {itens.length > 0 && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {itens.map(item => (
                      <span key={item} style={{
                        fontSize: 12, color: '#475569', background: '#fff',
                        borderRadius: 6, padding: '3px 10px',
                        border: '1px solid #e2e8f0', fontWeight: 600,
                      }}>
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
