import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import StaffLayout from '../../layouts/StaffLayout'
import { supabase } from '../../services/supabase'
import { clearAuth } from '../../services/authService'

// ── Config visual por status ───────────────────────────────────────────────────
const STATUS_CFG = {
  novo:               { label: 'Novo',               cor: '#475569', bg: '#f1f5f9' },
  em_revisao_ia:      { label: 'Revisão IA',         cor: '#7c3aed', bg: '#f5f3ff' },
  triagem_sig:        { label: 'Triagem SIG',        cor: '#64748b', bg: '#f8fafc' },
  em_analise_coord:   { label: 'Em análise SIG',     cor: '#1d4ed8', bg: '#eff6ff' },
  parecer_coord:      { label: 'Parecer Coord.',     cor: '#1d4ed8', bg: '#eff6ff' },
  aprovado:           { label: 'Aprovado',            cor: '#15803d', bg: '#f0fdf4' },
  rejeitado:          { label: 'Rejeitado',           cor: '#b91c1c', bg: '#fef2f2' },
  revisao_solicitada: { label: 'Revisão Solicitada', cor: '#c2410c', bg: '#fff7ed' }, //futuramente ativar um botao de revisao que vai abrir um modal para adicionar um pacer do motivo da revisao
  cancelado:          { label: 'Cancelado',           cor: '#9ca3af', bg: '#f9fafb' }, // mesma situacao, mas nao sei se se aplica
}

// ── Colunas do Kanban ──────────────────────────────────────────────────────────
const KANBAN_COLUNAS = [
  {
    id: 'triagem',
    label: 'Triagem SIG',
    statusAlvo: 'triagem_sig',
    cor: '#64748b', bg: '#f8fafc', borda: '#cbd5e1',
    statusIncluidos: ['novo', 'em_revisao_ia', 'triagem_sig'],
  },
  {
    id: 'analise_sig',
    label: 'Em análise SIG',
    statusAlvo: 'em_analise_coord',
    cor: '#1d4ed8', bg: '#eff6ff', borda: '#93c5fd',
    statusIncluidos: ['em_analise_coord'],
  },
  {
    id: 'coordenacao',
    label: 'Coordenação',
    statusAlvo: 'parecer_coord',
    cor: '#1d4ed8', bg: '#eff6ff', borda: '#93c5fd',
    statusIncluidos: ['parecer_coord', 'revisao_solicitada'],
  },
  {
    id: 'aprovados',
    label: 'Aprovados',
    statusAlvo: 'aprovado',
    cor: '#15803d', bg: '#f0fdf4', borda: '#86efac',
    statusIncluidos: ['aprovado'],
  },
  {
    id: 'rejeitados',
    label: 'Rejeitados',
    statusAlvo: 'rejeitado',
    cor: '#b91c1c', bg: '#fef2f2', borda: '#fca5a5',
    statusIncluidos: ['rejeitado', 'cancelado'],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function filtrarPorData(r, inicio, fim) {
  const criado = new Date(r.criado_em)
  if (inicio) {
    const d = new Date(inicio); d.setHours(0, 0, 0, 0)
    if (criado < d) return false
  }
  if (fim) {
    const d = new Date(fim); d.setHours(23, 59, 59, 999)
    if (criado > d) return false
  }
  return true
}

function filtrarPorBusca(r, busca) {
  if (!busca.trim()) return true
  const q = busca.toLowerCase()
  return (
    r.protocolo?.toLowerCase().includes(q)  ||
    r.nome_aluno?.toLowerCase().includes(q) ||
    r.matricula?.toLowerCase().includes(q)
  )
}

function hoje() { return new Date().toISOString().split('T')[0] }
function diasAtras(n) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

/** Formata duração desde uma data: minutos → horas → dias */
function tempoRelativo(dataStr) {
  if (!dataStr) return null
  const mins = Math.round((Date.now() - new Date(dataStr)) / 60_000)
  if (mins < 60)  return `${mins}min`
  const hrs = Math.round(mins / 60)
  if (hrs < 48)   return `${hrs}h`
  return `${Math.round(hrs / 24)}d`
}

// ── Badge ──────────────────────────────────────────────────────────────────────
function Badge({ label, cor, bg }) {
  return (
    <span style={{
      background: bg, color: cor,
      borderRadius: 10, padding: '2px 9px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ── Card Kanban (compacto) ─────────────────────────────────────────────────────
function CardKanban({ r, onClick, draggable = false, onDragStart, onDragEnd }) {
  const cfg          = STATUS_CFG[r.status] || { label: r.status, cor: '#888', bg: '#f5f5f5' }
  const abertura     = tempoRelativo(r.criado_em)
  const atualizacao  = tempoRelativo(r.atualizado_em)
  const alertaAtraso = Math.round((Date.now() - new Date(r.criado_em)) / 3_600_000) > 72

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        border: '1px solid #e2e8f0', borderRadius: 8,
        padding: '10px 12px',
        background: '#fff',
        cursor: draggable ? 'grab' : 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow   = '0 2px 8px rgba(0,73,159,0.10)'
        e.currentTarget.style.borderColor = '#a8c4f0'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow   = 'none'
        e.currentTarget.style.borderColor = '#e2e8f0'
      }}
    >
      {/* Linha 1: protocolo + badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 10, color: '#00499f', flexShrink: 0 }}>
          {r.protocolo}
        </span>
        <Badge {...cfg} />
      </div>

      {/* Linha 2: matrícula + nome (compacto) */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', marginBottom: 6, lineHeight: 1.3 }}>
        {r.matricula && (
          <span style={{
            fontFamily: 'monospace', fontSize: 10, fontWeight: 500,
            color: '#94a3b8', marginRight: 5,
          }}>
            {r.matricula}
          </span>
        )}
        {r.nome_aluno}
      </div>

      {/* Linha 3: tempos com ícones */}
      <div style={{ display: 'flex', gap: 10, fontSize: 10, alignItems: 'center' }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 3,
          color: alertaAtraso ? '#b91c1c' : '#94a3b8',
          fontWeight: alertaAtraso ? 700 : 400,
        }}>
          {/* Ícone calendário */}
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <rect x="1" y="2.5" width="10" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <line x1="4" y1="1" x2="4" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <line x1="8" y1="1" x2="8" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <line x1="1" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1.1"/>
          </svg>
          {alertaAtraso ? '! ' : ''}{abertura}
        </span>
        {atualizacao && atualizacao !== abertura && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#94a3b8' }}>
            {/* Ícone relógio */}
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M6 3.5V6l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {atualizacao}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Card Lista (expandido) ─────────────────────────────────────────────────────
function CardLista({ r, onClick }) {
  const cfg          = STATUS_CFG[r.status] || { label: r.status, cor: '#888', bg: '#f5f5f5' }
  const iaVeredicto  = r.sumario_ia?.veredicto
  const iaConfianca  = r.sumario_ia?.confianca
  const abertura     = tempoRelativo(r.criado_em)
  const atualizacao  = tempoRelativo(r.atualizado_em)
  const alertaAtraso = Math.round((Date.now() - new Date(r.criado_em)) / 3_600_000) > 72
  const dataFormatada = new Date(r.criado_em).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid #e2e8f0', borderRadius: 9,
        padding: '13px 17px',
        background: '#fff', cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow   = '0 2px 10px rgba(0,73,159,0.12)'
        e.currentTarget.style.borderColor = '#a8c4f0'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow   = 'none'
        e.currentTarget.style.borderColor = '#e2e8f0'
      }}
    >
      {/* Linha 1: protocolo + badges | data */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: '#00499f' }}>
            {r.protocolo}
          </span>
          <Badge {...cfg} />
          {iaVeredicto && (
            <Badge
              label={`IA: ${iaVeredicto}${iaConfianca != null ? ` ${Math.round(iaConfianca * 100)}%` : ''}`}
              cor={iaVeredicto === 'aprovado' ? '#15803d' : iaVeredicto === 'rejeitado' ? '#b91c1c' : '#b45309'}
              bg={iaVeredicto === 'aprovado'  ? '#f0fdf4' : iaVeredicto === 'rejeitado'  ? '#fef2f2' : '#fffbeb'}
            />
          )}
        </div>
        {/* Data no canto superior direito */}
        <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1 }}>
          {dataFormatada}
        </span>
      </div>

      {/* Linha 2: matrícula + nome */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>
        {r.matricula && (
          <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 500, color: '#64748b', marginRight: 6 }}>
            {r.matricula} ·
          </span>
        )}
        {r.nome_aluno}
      </div>

      {/* Linha 3: curso (esq) + tempos (dir) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>{r.curso}</span>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, flexShrink: 0 }}>
          <span style={{ color: alertaAtraso ? '#b91c1c' : '#94a3b8', fontWeight: alertaAtraso ? 600 : 400 }}>
            {alertaAtraso ? '⚠ ' : ''}Abertura: {abertura}
          </span>
          {atualizacao && (
            <span style={{ color: '#94a3b8' }}>Atualizado: {atualizacao}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Visão Kanban com drag-and-drop ────────────────────────────────────────────
const KANBAN_COL_HEIGHT = 'calc(100vh - 310px)'

function KanbanView({ requerimentos, navigate, onMoverCard }) {
  const [dragSobre, setDragSobre] = useState(null)
  const dragIdRef = useRef(null)

  function handleDragStart(e, r) {
    dragIdRef.current = r.id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(r.id))
  }

  function handleDragOver(e, colId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragSobre !== colId) setDragSobre(colId)
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragSobre(null)
  }

  function handleDrop(e, col) {
    e.preventDefault()
    setDragSobre(null)
    const id = dragIdRef.current
    if (!id) return
    dragIdRef.current = null
    const card = requerimentos.find(r => r.id === id)
    if (card && col.statusIncluidos.includes(card.status)) return
    onMoverCard(id, col.statusAlvo)
  }

  function handleDragEnd() {
    setDragSobre(null)
    dragIdRef.current = null
  }

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      {KANBAN_COLUNAS.map(col => {
        const cards      = requerimentos.filter(r => col.statusIncluidos.includes(r.status))
        const isDragOver = dragSobre === col.id

        return (
          <div
            key={col.id}
            style={{ flex: '1 1 220px', minWidth: 200, maxWidth: 320, display: 'flex', flexDirection: 'column' }}
            onDragOver={e => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, col)}
          >
            {/* Cabeçalho */}
            <div style={{
              background: col.bg,
              border: `1px solid ${isDragOver ? col.cor : col.borda}`,
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0', padding: '9px 13px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0, transition: 'border-color 0.15s',
            }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: col.cor }}>{col.label}</span>
              <span style={{
                background: col.cor, color: '#fff',
                borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700,
              }}>{cards.length}</span>
            </div>

            {/* Corpo scrollável */}
            <div style={{
              border: `1px solid ${isDragOver ? col.cor : col.borda}`,
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              background: isDragOver ? col.bg : '#f8fafc',
              padding: 8,
              height: KANBAN_COL_HEIGHT, minHeight: 200,
              overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 6,
              transition: 'background 0.15s, border-color 0.15s',
              outline: isDragOver ? `2px dashed ${col.borda}` : 'none',
              outlineOffset: -2,
            }}>
              {cards.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '24px 8px',
                  color: isDragOver ? col.cor : '#cbd5e1',
                  fontSize: 12, fontWeight: isDragOver ? 600 : 400,
                  transition: 'color 0.15s',
                }}>
                  {isDragOver ? 'Soltar aqui' : 'Nenhum pedido'}
                </div>
              ) : cards.map(r => (
                <CardKanban
                  key={r.id}
                  r={r}
                  draggable
                  onDragStart={e => handleDragStart(e, r)}
                  onDragEnd={handleDragEnd}
                  onClick={() => navigate(`/requerimento/${r.id}`)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Visão Lista (com big numbers no topo) ─────────────────────────────────────
function ListView({ requerimentos, navigate, contadores }) {
  return (
    <div>
      {/* Big numbers */}
      <div style={{
        display: 'flex', flexWrap: 'wrap',
        marginBottom: 16, paddingBottom: 14,
        borderBottom: '1px solid #f1f5f9',
      }}>
        {contadores.map((s, i, arr) => (
          <div key={s.label} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 24px', flex: '1 1 auto',
            borderRight: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
          }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{s.valor}</span>
            <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Cards */}
      {requerimentos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 14 }}>
          Nenhum resultado para os filtros aplicados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requerimentos.map(r => (
            <CardLista key={r.id} r={r} onClick={() => navigate(`/requerimento/${r.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Estilos reutilizáveis ──────────────────────────────────────────────────────
const inputStyle = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
  fontSize: 12, color: '#374151', background: '#fff', outline: 'none',
}
const presetBtn = (ativo) => ({
  padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
  fontSize: 11, fontWeight: 600, cursor: 'pointer',
  background: ativo ? '#00499f' : '#fff',
  color:      ativo ? '#fff'    : '#64748b',
})

// ── Dashboard principal ────────────────────────────────────────────────────────
export default function Dashboard({ navigate }) {
  const [visao, setVisao]               = useState('kanban')
  const [user, setUser]                 = useState(null)
  const [perfilUsuario, setPerfilUsuario] = useState(null)
  const [loading, setLoading]           = useState(true)
  const [requerimentos, setRequerimentos] = useState([])
  const [carregando, setCarregando]     = useState(false)
  const [erroLoad, setErroLoad]         = useState(null)
  const [erroMover, setErroMover]       = useState(null)

  const [dataInicio, setDataInicio]     = useState('')
  const [dataFim, setDataFim]           = useState('')
  const [presetAtivo, setPresetAtivo]   = useState('todos')
  const [filtroCurso, setFiltroCurso]   = useState('todos')
  const [busca, setBusca]               = useState('')

  const carregarRequerimentos = useCallback(async () => {
    setCarregando(true); setErroLoad(null)
    const { data, error } = await supabase
      .from('requerimentos')
      .select('id, protocolo, status, nome_aluno, matricula, curso, email, criado_em, atualizado_em, sumario_ia')
      .order('criado_em', { ascending: false })
    if (error) { setErroLoad('Não foi possível carregar os requerimentos.'); console.error(error) }
    else setRequerimentos(data || [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate('/login'); return }
      setUser(session.user)
      const { data: u } = await supabase
        .from('usuarios').select('perfil, nome, curso').eq('id', session.user.id).maybeSingle()
      setPerfilUsuario(u)
      setLoading(false)
      carregarRequerimentos()
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) navigate('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  function aplicarPreset(p) {
    setPresetAtivo(p)
    if (p === 'todos') { setDataInicio(''); setDataFim('') }
    else if (p === 'hoje') { setDataInicio(hoje()); setDataFim(hoje()) }
    else if (p === '7d')   { setDataInicio(diasAtras(7));  setDataFim(hoje()) }
    else if (p === '30d')  { setDataInicio(diasAtras(30)); setDataFim(hoje()) }
  }

  function handleDataInicio(v) { setDataInicio(v); setPresetAtivo('custom') }
  function handleDataFim(v)    { setDataFim(v);    setPresetAtivo('custom') }

  async function moverCard(requerimentoId, novoStatus) {
    const statusOriginal = requerimentos.find(r => r.id === requerimentoId)?.status
    setRequerimentos(prev =>
      prev.map(r => r.id === requerimentoId ? { ...r, status: novoStatus } : r)
    )
    const { error } = await supabase.rpc('atualizar_status_requerimento', {
      p_id: requerimentoId, p_status: novoStatus,
    })
    if (error) {
      console.error('[Drag] Erro ao mover card:', error)
      setRequerimentos(prev =>
        prev.map(r => r.id === requerimentoId ? { ...r, status: statusOriginal ?? r.status } : r)
      )
      setErroMover(`Não foi possível salvar a mudança: ${error.message}`)
      setTimeout(() => setErroMover(null), 6000)
    }
  }

  const cursos = useMemo(() => {
    const s = new Set(requerimentos.map(r => r.curso).filter(Boolean))
    return [...s].sort()
  }, [requerimentos])

  const filtrados = useMemo(() => requerimentos
    .filter(r => filtrarPorData(r, dataInicio, dataFim))
    .filter(r => filtroCurso === 'todos' || r.curso === filtroCurso)
    .filter(r => filtrarPorBusca(r, busca)),
    [requerimentos, dataInicio, dataFim, filtroCurso, busca]
  )

  const conta = (statusArr) => filtrados.filter(r => statusArr.includes(r.status)).length

  const contadores = [
    { label: 'Total',       valor: filtrados.length },
    { label: 'Triagem',     valor: conta(['novo', 'em_revisao_ia', 'triagem_sig']) },
    { label: 'Análise SIG', valor: conta(['em_analise_coord']) },
    { label: 'Coordenação', valor: conta(['parecer_coord', 'revisao_solicitada']) },
    { label: 'Aprovados',   valor: conta(['aprovado']) },
    { label: 'Rejeitados',  valor: conta(['rejeitado', 'cancelado']) },
  ]

  if (loading) return (
    <StaffLayout navigate={navigate}>
      <div style={{ textAlign: 'center', paddingTop: 60 }}>
        <p style={{ color: '#94a3b8' }}>Carregando…</p>
      </div>
    </StaffLayout>
  )

  const nomeExibicao = perfilUsuario?.nome || user?.email?.split('@')[0] || 'Usuário'
  const isSIG = perfilUsuario?.perfil === 'sig'

  return (
    <StaffLayout navigate={navigate}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '16px 20px 24px' }}>

        {/* ── Barra 1: identidade + filtros + logout ── */}
        <div style={{
          background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
          padding: '10px 16px', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{nomeExibicao}</span>
            <span style={{
              background: '#e8f0fb', color: '#00499f',
              borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700,
            }}>
              {(perfilUsuario?.perfil || 'STAFF').toUpperCase()}
            </span>
            {perfilUsuario?.curso && (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{perfilUsuario.curso}</span>
            )}
          </div>

          <div style={{ width: 1, height: 28, background: '#e2e8f0', flexShrink: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>DE</span>
            <input type="date" value={dataInicio} onChange={e => handleDataInicio(e.target.value)} style={inputStyle} />
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>ATÉ</span>
            <input type="date" value={dataFim} onChange={e => handleDataFim(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: 5 }}>
            {[
              { v: 'todos', l: 'Tudo' },
              { v: 'hoje',  l: 'Hoje' },
              { v: '7d',    l: '7d'   },
              { v: '30d',   l: '30d'  },
            ].map(({ v, l }) => (
              <button key={v} onClick={() => aplicarPreset(v)} style={presetBtn(presetAtivo === v)}>{l}</button>
            ))}
          </div>

          {isSIG && cursos.length > 0 && (
            <>
              <div style={{ width: 1, height: 28, background: '#e2e8f0', flexShrink: 0 }} />
              <select
                value={filtroCurso}
                onChange={e => setFiltroCurso(e.target.value)}
                style={{ ...inputStyle, paddingRight: 28 }}
              >
                <option value="todos">Todos os cursos</option>
                {cursos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </>
          )}

          <button
            type="button"
            onClick={async () => { await clearAuth(); navigate('/login') }}
            style={{ ...presetBtn(false), marginLeft: 'auto' }}
          >
            Sair
          </button>
        </div>

        {/* ── Barra 2: busca ── */}
        <div style={{
          background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
          padding: '8px 16px', marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
            style={{ flexShrink: 0, color: '#94a3b8' }}>
            <circle cx="6.5" cy="6.5" r="5.25" stroke="currentColor" strokeWidth="1.4"/>
            <line x1="10.4" y1="10.4" x2="13.6" y2="13.6"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar por nome, matrícula ou nº do requerimento…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 13, color: '#374151', background: 'transparent',
            }}
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                color: '#94a3b8', fontSize: 14, padding: '0 4px', lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* ── Painel ── */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px' }}>

          {/* Cabeçalho: título + toggle + atualizar */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', flex: 1 }}>Requerimentos</span>

            <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
              {[{ v: 'kanban', l: 'Kanban' }, { v: 'lista', l: 'Lista' }].map(({ v, l }) => (
                <button key={v} onClick={() => setVisao(v)} style={{
                  padding: '5px 14px', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: visao === v ? '#00499f' : '#fff',
                  color:      visao === v ? '#fff'    : '#64748b',
                }}>{l}</button>
              ))}
            </div>

            <button onClick={carregarRequerimentos} disabled={carregando} style={{
              padding: '5px 14px', borderRadius: 6, border: '1px solid #e2e8f0',
              background: '#fff', fontSize: 12, fontWeight: 600, color: '#64748b',
              cursor: carregando ? 'default' : 'pointer',
            }}>
              {carregando ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>

          {erroLoad && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
              padding: '10px 14px', color: '#b91c1c', fontSize: 13, marginBottom: 12,
            }}>
              {erroLoad}
            </div>
          )}

          {erroMover && (
            <div style={{
              background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8,
              padding: '10px 14px', color: '#c2410c', fontSize: 13, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontWeight: 700 }}>⚠</span>
              {erroMover}
            </div>
          )}

          {filtrados.length === 0 && !carregando ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>
              {requerimentos.length === 0
                ? 'Nenhum requerimento recebido ainda.'
                : 'Nenhum resultado para os filtros aplicados.'}
            </div>
          ) : visao === 'kanban' ? (
            <KanbanView requerimentos={filtrados} navigate={navigate} onMoverCard={moverCard} />
          ) : (
            <ListView requerimentos={filtrados} navigate={navigate} contadores={contadores} />
          )}
        </div>

      </div>
    </StaffLayout>
  )
}
