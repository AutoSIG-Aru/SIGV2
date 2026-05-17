import { useState, useEffect, useCallback } from 'react'
import StaffLayout from '../../layouts/StaffLayout'
import { supabase } from '../../services/supabase'

// ── Config visual de status ────────────────────────────────────────────────────
const STATUS_CFG = {
  novo:               { label: 'Novo',               cor: '#475569', bg: '#f1f5f9' },
  em_revisao_ia:      { label: 'Revisão IA',         cor: '#7c3aed', bg: '#f5f3ff' },
  triagem_sig:        { label: 'Triagem SIG',        cor: '#64748b', bg: '#f8fafc' },
  em_analise_coord:   { label: 'Análise SIG',        cor: '#1d4ed8', bg: '#eff6ff' },
  parecer_coord:      { label: 'Parecer Coord.',     cor: '#1d4ed8', bg: '#e0f2fe' },
  aprovado:           { label: 'Aprovado',            cor: '#15803d', bg: '#f0fdf4' },
  rejeitado:          { label: 'Rejeitado',           cor: '#b91c1c', bg: '#fef2f2' },
  revisao_solicitada: { label: 'Revisão Solicitada', cor: '#c2410c', bg: '#fff7ed' },
  cancelado:          { label: 'Cancelado',           cor: '#9ca3af', bg: '#f9fafb' },
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
  { status: 'aprovado',         label: 'Aprovado',        cor: '#15803d' },
  { status: 'rejeitado',        label: 'Rejeitado',       cor: '#b91c1c' },
]

const ABAS = [
  { id: 'geral',       label: 'Informações Gerais' },
  { id: 'documentos',  label: 'Documentos'          },
  { id: 'tarefas',     label: 'Tarefas da Etapa'   },
  { id: 'historico',   label: 'Histórico'           },
  { id: 'comentarios', label: 'Comentários'         },
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
    <div className="form-card" style={{ marginBottom: 0, ...style }}>
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
    const { data, error } = await supabase.storage
      .from('anexos')
      .createSignedUrl(anexo.storage_path, 3600)
    setCarregando(false)
    if (error || !data?.signedUrl) { setErroUrl(true); return }
    setUrl(data.signedUrl)
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
    <div style={{
      display: 'flex', gap: 16,
      height: 'calc(100vh - 280px)', minHeight: 480,
    }}>
      {/* ── Lista de documentos (esquerda) ── */}
      <div style={{
        width: 280, flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 6,
        overflowY: 'auto', paddingRight: 4,
      }}>
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

      {/* ── Painel de preview (direita) ── */}
      <div style={{
        flex: 1, minWidth: 0,
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
  const [loading, setLoading]       = useState(true)
  const [req, setReq]               = useState(null)
  const [validacoes, setValidacoes] = useState([])
  const [anexos, setAnexos]         = useState([])
  const [eventos, setEventos]       = useState([])
  const [erro, setErro]             = useState(null)
  const [aba, setAba]               = useState('geral')

  // Alteração de fase
  const [menuFaseAberto, setMenuFaseAberto] = useState(false)
  const [salvandoFase, setSalvandoFase]     = useState(false)
  const [erroFase, setErroFase]             = useState(null)
  const carregarDados = useCallback(async () => {
    setLoading(true); setErro(null)

    const { data: reqData, error: reqErr } = await supabase
      .from('requerimentos').select('*').eq('id', id).single()
    if (reqErr || !reqData) {
      setErro('Requerimento não encontrado ou sem permissão de acesso.')
      setLoading(false); return
    }
    setReq(reqData)

    const { data: valsData } = await supabase
      .from('validacoes').select('*, disciplinas_cursadas(*)')
      .eq('requerimento_id', id).order('indice')
    setValidacoes(valsData || [])

    const { data: anexosData } = await supabase
      .from('anexos').select('*').eq('requerimento_id', id).order('enviado_em')
    setAnexos(anexosData || [])

    const { data: eventosData } = await supabase
      .from('eventos_auditoria')
      .select('*, autor:usuario_id(nome, perfil)')
      .eq('requerimento_id', id)
      .order('criado_em', { ascending: false })
    setEventos(eventosData || [])

    setLoading(false)
  }, [id])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/login'); return }
      carregarDados()
    })
  }, [id])

  async function alterarFase(novoStatus) {
    setMenuFaseAberto(false)
    setSalvandoFase(true)
    setErroFase(null)

    const { error } = await supabase.rpc('atualizar_status_requerimento', {
      p_id:     Number(id),
      p_status: novoStatus,
    })

    setSalvandoFase(false)

    if (error) {
      setErroFase(`Não foi possível alterar a fase: ${error.message}`)
      setTimeout(() => setErroFase(null), 6000)
      return
    }

    // Atualiza status localmente
    setReq(prev => ({ ...prev, status: novoStatus }))

    // Recarrega eventos para mostrar o novo registro de auditoria
    const { data } = await supabase
      .from('eventos_auditoria')
      .select('*, autor:usuario_id(nome, perfil)')
      .eq('requerimento_id', id)
      .order('criado_em', { ascending: false })
    if (data) setEventos(data)
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

  const statusCfg     = STATUS_CFG[req.status] || { label: req.status, cor: '#888', bg: '#f5f5f5' }
  const iaVeredicto   = req.sumario_ia?.veredicto
  const iaConfianca   = req.sumario_ia?.confianca
  const dataFormatada = new Date(req.criado_em).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const horasAberto = Math.round((Date.now() - new Date(req.criado_em)) / 3_600_000)

  return (
    <StaffLayout navigate={navigate}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 24px 40px' }}>

        {/* ── Cabeçalho ── */}
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <button className="btn-back" onClick={() => navigate('/dashboard')} style={{ margin: 0, flexShrink: 0 }}>
              ← Painel
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: '#00499f' }}>
                  {req.protocolo}
                </span>

                {/* Badge de status + botão de alteração */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Badge {...statusCfg} />

                  <button
                    onClick={() => setMenuFaseAberto(f => !f)}
                    disabled={salvandoFase}
                    title="Alterar fase do requerimento"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      border: '1px solid #e2e8f0', background: menuFaseAberto ? '#f1f5f9' : '#fff',
                      color: '#475569', cursor: salvandoFase ? 'default' : 'pointer',
                      transition: 'background 0.15s',
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
                      {/* Backdrop — fecha ao clicar fora sem usar document listeners */}
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                        onClick={() => setMenuFaseAberto(false)}
                      />
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
                      background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                      minWidth: 220, padding: '6px 0', overflow: 'hidden',
                    }}>
                      <div style={{ padding: '6px 14px 8px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Selecionar etapa
                      </div>
                      {FASES_DISPONIVEIS.map(fase => {
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
                  ? <span style={{ color: '#b91c1c', fontWeight: 600 }}>⚠ {horasAberto}h em aberto</span>
                  : `${horasAberto}h em aberto`}
              </div>
            </div>
          </div>
        </div>

        {/* ── Abas ── */}
        <div style={{ display: 'flex', marginBottom: 20, borderBottom: '2px solid #e2e8f0', overflowX: 'auto' }}>
          {ABAS.map(tab => {
            const badge = tab.id === 'documentos' ? anexos.length
                        : tab.id === 'historico'  ? eventos.length
                        : null
            return (
              <button
                key={tab.id}
                onClick={() => setAba(tab.id)}
                style={{
                  padding: '10px 20px', border: 'none', background: 'none',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  fontWeight: aba === tab.id ? 700 : 500, fontSize: 14,
                  color: aba === tab.id ? '#00499f' : '#64748b',
                  borderBottom: aba === tab.id ? '2px solid #00499f' : '2px solid transparent',
                  marginBottom: '-2px', transition: 'color 0.15s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {tab.label}
                {badge != null && badge > 0 && (
                  <span style={{
                    background: aba === tab.id ? '#00499f' : '#e2e8f0',
                    color: aba === tab.id ? '#fff' : '#64748b',
                    borderRadius: 20, padding: '0 7px',
                    fontSize: 11, fontWeight: 700, lineHeight: '18px',
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ══ Aba: Informações Gerais ══════════════════════════════════════════ */}
        {aba === 'geral' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 360px) 1fr',
            gap: 16, alignItems: 'start',
          }}>
            {/* Coluna esquerda: Dados + IA empilhados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Secao titulo="Dados do Aluno">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                  <Campo label="Nome completo" valor={req.nome_aluno} span />
                  <Campo label="Matrícula"     valor={req.matricula} />
                  <Campo label="CPF"           valor={req.cpf} />
                  <Campo label="Curso"         valor={req.curso} span />
                  <Campo label="E-mail"        valor={req.email} span />
                  <Campo label="Telefone"      valor={req.telefone} />
                </div>
              </Secao>

              <Secao titulo="Análise da IA">
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
        {aba === 'tarefas' && (
          <AbaPlaceholder
            icone="📋"
            titulo="Tarefas da Etapa"
            descricao="Aqui serão exibidas as ações que a SIG e a coordenação precisam realizar para avançar o requerimento. Em breve."
          />
        )}

        {/* ══ Aba: Histórico ══════════════════════════════════════════════════ */}
        {aba === 'historico' && <AbaHistorico eventos={eventos} />}

        {/* ══ Aba: Comentários ════════════════════════════════════════════════ */}
        {aba === 'comentarios' && (
          <AbaPlaceholder
            icone="💬"
            titulo="Comentários"
            descricao="Espaço para anotações internas entre SIG e coordenação sobre este requerimento. Em breve."
          />
        )}

      </div>

    </StaffLayout>
  )
}

// ── Helpers do histórico ───────────────────────────────────────────────────────
const PERFIL_CFG = {
  sig:   { label: 'SIG',         cor: '#1d4ed8', bg: '#eff6ff' },
  coord: { label: 'Coordenação', cor: '#0369a1', bg: '#e0f2fe' },
  admin: { label: 'Admin',       cor: '#7c3aed', bg: '#f5f3ff' },
  aluno: { label: 'Aluno',       cor: '#475569', bg: '#f1f5f9' },
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
    <div className="form-card">
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

// ── Card de validação expansível ───────────────────────────────────────────────
function ValidacaoCard({ v, idx }) {
  const [aberto, setAberto] = useState(true)
  const iaVeredicto = v.ia_veredicto
  const iaConfianca = v.ia_confianca

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
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

          {v.decisao && (
            <div style={{
              marginTop: 16, padding: '10px 14px', borderRadius: 8,
              background: v.decisao === 'aprovado' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${v.decisao === 'aprovado' ? '#bbf7d0' : '#fecaca'}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: v.decisao === 'aprovado' ? '#15803d' : '#b91c1c' }}>
                Decisão: {v.decisao.charAt(0).toUpperCase() + v.decisao.slice(1)}
              </div>
              {v.decisao_observacao && (
                <p style={{ fontSize: 13, color: '#475569', margin: '6px 0 0', lineHeight: 1.6 }}>
                  {v.decisao_observacao}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
