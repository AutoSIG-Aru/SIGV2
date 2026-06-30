import { useState, useEffect, useMemo, useRef } from 'react'
import StaffLayout from '../../layouts/StaffLayout'
import { onAuthChange, getSession } from '../../services/authService'
import { buscarPerfil } from '../../services/requerimentosService'
import {
  listarCurriculos,
  buscarCurriculo,
  salvarCurriculo,
} from '../../services/curriculoService'
import { gerarCurriculoPDF } from '../../services/pdfCurriculo'

// Webhook n8n para registro de histórico (não-bloqueante)
const WEBHOOK_HISTORICO = import.meta.env.VITE_N8N_WEBHOOK_HISTORICO || ''

// Tipos de disciplina
const TIPOS = ['Obrigatória', 'Optativa', 'Eletiva', 'Específica']
const TIPO_RAW = { Obrigatória: 'Ob', Optativa: 'Op', Eletiva: 'Es', Específica: 'Ex' }
const NUM_FASES = 10

// ── Utilitários ───────────────────────────────────────────────────────────────
function novaDisciplina(fase) {
  return {
    _id: crypto.randomUUID(),
    codigo: '', nome: '', tipo: 'Obrigatória', tipo_raw: 'Ob',
    carga_horaria_ha: '', aulas_semanais: '',
    fase: fase ?? null,
    ementa: '', equivalentes: [], pre_requisitos: [], pre_ch: null,
    _haAutoCalc: false,
  }
}

function exportarCSV(curso, disciplinas) {
  const header = 'Fase,Código,Nome,Tipo,H/A,Aulas/sem,Equivalentes,Pré-requisitos,Ementa'
  const rows = [...disciplinas]
    .sort((a, b) => (a.fase ?? 999) - (b.fase ?? 999) || (a.nome ?? '').localeCompare(b.nome ?? ''))
    .map(d => [
      d.fase ?? 'Optativa',
      d.codigo,
      `"${(d.nome || '').replace(/"/g, '""')}"`,
      d.tipo,
      d.carga_horaria_ha ?? '',
      d.aulas_semanais ?? '',
      (d.equivalentes || []).join('; '),
      (d.pre_requisitos || []).join('; '),
      `"${(d.ementa || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    ].join(','))
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `curriculo-${curso.codigo}-${curso.curriculo_codigo}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Importar CSV ─────────────────────────────────────────────────────────────
function splitCSVRow(row) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parsearCSV(text) {
  const clean = text.replace(/^﻿/, '') // remove BOM
  const lines = clean.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const discs = []
  for (const line of lines.slice(1)) {
    const cols = splitCSVRow(line)
    if (cols.length < 3) continue
    const [faseStr, codigo, nome, tipo, ha, aulas, equivs, prereqs, ementa] = cols
    const faseNum = parseInt(faseStr)
    const fase = isNaN(faseNum) ? null : faseNum
    const tipoNorm = TIPOS.includes(tipo?.trim()) ? tipo.trim() : 'Obrigatória'
    discs.push({
      _id: crypto.randomUUID(),
      fase,
      codigo: (codigo || '').trim().toUpperCase(),
      nome: (nome || '').trim(),
      tipo: tipoNorm,
      tipo_raw: TIPO_RAW[tipoNorm] ?? 'Ob',
      carga_horaria_ha: ha?.trim() ? (parseInt(ha) || '') : '',
      aulas_semanais: aulas?.trim() ? (parseInt(aulas) || '') : '',
      equivalentes: equivs?.trim() ? equivs.split(';').map(x => x.trim()).filter(Boolean) : [],
      pre_requisitos: prereqs?.trim() ? prereqs.split(';').map(x => x.trim()).filter(Boolean) : [],
      ementa: (ementa || '').trim(),
      pre_ch: null,
      _haAutoCalc: false,
    })
  }
  return discs
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = {
  input: {
    width: '100%', padding: '8px 10px',
    border: '1.5px solid #e2e8f0', borderRadius: 6,
    fontSize: 13, color: '#1e293b', background: '#fff',
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color .15s', boxSizing: 'border-box',
  },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: '#475569', marginBottom: 4,
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  card: {
    background: '#fff', borderRadius: 10,
    border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: 800, color: '#00499f',
    marginBottom: 16, paddingBottom: 10,
    borderBottom: '2px solid #eff6ff',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  btnPrimary: {
    padding: '10px 22px', borderRadius: 8, border: 'none',
    background: '#00499f', color: '#fff', fontWeight: 700, fontSize: 13,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    transition: 'background .15s', whiteSpace: 'nowrap',
  },
  btnOutline: (color) => ({
    padding: '10px 16px', borderRadius: 8,
    border: `1.5px solid ${color}`, background: '#fff', color,
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
    transition: 'background .15s', whiteSpace: 'nowrap',
  }),
  btnDanger: {
    padding: '4px 9px', borderRadius: 5, border: 'none',
    background: '#fee2e2', color: '#b91c1c', cursor: 'pointer',
    fontSize: 12, fontWeight: 700, lineHeight: 1, flexShrink: 0,
  },
  btnGhost: {
    width: '100%', padding: '9px', border: '1.5px dashed #cbd5e1',
    background: 'transparent', color: '#64748b', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, borderRadius: 6,
    textAlign: 'center', transition: 'border-color .15s, color .15s',
  },
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ color = '#fff', size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15"
      style={{ animation: 'spin .7s linear infinite', flexShrink: 0 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="7.5" cy="7.5" r="5.5" stroke={color + '40'} strokeWidth="2" fill="none" />
      <path d="M7.5 2 a5.5 5.5 0 0 1 5.5 5.5"
        stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// ── Linha de disciplina editável ──────────────────────────────────────────────
function DisciplinaRow({ disc, onChange, onRemove }) {
  const [expanded, setExpanded] = useState(false)

  function upd(field, value) {
    const next = { ...disc, [field]: value }
    if (field === 'aulas_semanais' && value && !next.carga_horaria_ha) {
      next.carga_horaria_ha = String(parseInt(value) * 18 || '')
      next._haAutoCalc = true
    }
    if (field === 'carga_horaria_ha') next._haAutoCalc = false
    if (field === 'tipo') next.tipo_raw = TIPO_RAW[value] ?? 'Op'
    onChange(next)
  }

  const cell = {
    padding: '7px 8px',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
  }

  return (
    <>
      <tr style={{ background: expanded ? '#f8fafc' : 'transparent' }}>

        {/* Código */}
        <td style={cell}>
          <input
            value={disc.codigo}
            onChange={e => upd('codigo', e.target.value.toUpperCase())}
            placeholder="DEC0001"
            style={{ ...s.input, width: 88, fontFamily: 'monospace', fontSize: 12 }}
          />
        </td>

        {/* Nome */}
        <td style={{ ...cell, minWidth: 200 }}>
          <input
            value={disc.nome}
            onChange={e => upd('nome', e.target.value)}
            placeholder="Nome da disciplina"
            style={{ ...s.input }}
          />
        </td>

        {/* Tipo */}
        <td style={cell}>
          <select
            value={disc.tipo}
            onChange={e => upd('tipo', e.target.value)}
            style={{ ...s.input, width: 104, cursor: 'pointer' }}
          >
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </td>

        {/* H/A */}
        <td style={cell}>
          <input
            type="number" min="0"
            value={disc.carga_horaria_ha ?? ''}
            onChange={e => upd('carga_horaria_ha', e.target.value)}
            placeholder="108"
            style={{ ...s.input, width: 60, textAlign: 'center' }}
          />
        </td>

        {/* Aulas/sem */}
        <td style={cell}>
          <input
            type="number" min="0"
            value={disc.aulas_semanais ?? ''}
            onChange={e => upd('aulas_semanais', e.target.value)}
            placeholder="6"
            style={{ ...s.input, width: 52, textAlign: 'center' }}
          />
        </td>

        {/* Ações */}
        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setExpanded(x => !x)}
              title={expanded ? 'Fechar' : 'Editar ementa e equivalências'}
              style={{
                padding: '5px 9px', borderRadius: 5, cursor: 'pointer',
                border: '1px solid #e2e8f0',
                background: expanded ? '#eff6ff' : '#f8fafc',
                color: expanded ? '#00499f' : '#64748b',
                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              {expanded ? '▲ Menos' : '▼ Mais'}
            </button>
            <button type="button" onClick={onRemove} style={s.btnDanger} title="Remover">✕</button>
          </div>
        </td>
      </tr>

      {/* Expansão: ementa, equivalentes, pré-req */}
      {expanded && (
        <tr style={{ background: '#f8fafc' }}>
          <td colSpan={6} style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 14 }}>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Ementa</label>
                <textarea
                  value={disc.ementa || ''}
                  onChange={e => upd('ementa', e.target.value)}
                  placeholder="Conteúdo programático da disciplina…"
                  rows={3}
                  style={{
                    ...s.input, resize: 'vertical', minHeight: 70,
                    lineHeight: 1.55, fontFamily: 'inherit',
                  }}
                />
              </div>

              <div>
                <label style={s.label}>Equivalentes</label>
                <input
                  value={(disc.equivalentes || []).join(', ')}
                  onChange={e => upd('equivalentes',
                    e.target.value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean))}
                  placeholder="DEC7143, DEC7531"
                  style={s.input}
                />
                <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                  Separar por vírgula
                </p>
              </div>

              <div>
                <label style={s.label}>Pré-requisitos</label>
                <input
                  value={(disc.pre_requisitos || []).join(', ')}
                  onChange={e => upd('pre_requisitos',
                    e.target.value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean))}
                  placeholder="DEC0001"
                  style={s.input}
                />
                <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
                  Separar por vírgula
                </p>
              </div>

              <div>
                <label style={s.label}>Pré-req CH (h)</label>
                <input
                  type="number"
                  value={disc.pre_ch ?? ''}
                  onChange={e => upd('pre_ch', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="1080"
                  style={s.input}
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Seção de fase (tabela colapsável) ─────────────────────────────────────────
function FaseSection({ fase, label, disciplinas, onChangeDisc, onAddDisc, onRemoveDisc }) {
  const [collapsed, setCollapsed] = useState(fase !== 1 && fase !== 'optativas')

  const thBase = {
    padding: '8px 10px', background: '#f1f5f9',
    fontSize: 11, fontWeight: 700, color: '#475569',
    textAlign: 'left', letterSpacing: '0.03em',
    borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
  }

  const total = disciplinas.length
  const haTotal = disciplinas.reduce((acc, d) => acc + (parseInt(d.carga_horaria_ha) || 0), 0)

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
      {/* Header da fase */}
      <button
        type="button"
        onClick={() => setCollapsed(x => !x)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '12px 20px',
          background: collapsed ? '#fff' : '#eff6ff',
          border: 'none', cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid #dbeafe',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#00499f' }}>{label}</span>
          <span style={{
            background: '#00499f', color: '#fff',
            borderRadius: 20, padding: '1px 10px', fontSize: 11, fontWeight: 700,
          }}>
            {total} disciplina{total !== 1 ? 's' : ''}
          </span>
          {haTotal > 0 && (
            <span style={{ color: '#64748b', fontSize: 11 }}>
              {haTotal} H/A total
            </span>
          )}
        </div>
        <span style={{ color: '#94a3b8', fontSize: 16, fontWeight: 300 }}>
          {collapsed ? '＋' : '−'}
        </span>
      </button>

      {!collapsed && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ ...thBase, width: 96 }}>Código</th>
                  <th style={thBase}>Nome</th>
                  <th style={{ ...thBase, width: 110 }}>Tipo</th>
                  <th style={{ ...thBase, width: 68, textAlign: 'center' }}>H/A</th>
                  <th style={{ ...thBase, width: 76, textAlign: 'center' }}>Aulas/sem</th>
                  <th style={{ ...thBase, width: 115 }}></th>
                </tr>
              </thead>
              <tbody>
                {total === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                      Nenhuma disciplina. Clique em "Adicionar" abaixo.
                    </td>
                  </tr>
                ) : (
                  disciplinas.map(disc => (
                    <DisciplinaRow
                      key={disc._id}
                      disc={disc}
                      onChange={updated => onChangeDisc(disc._id, updated)}
                      onRemove={() => onRemoveDisc(disc._id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 14px', background: '#fafbfd' }}>
            <button type="button" onClick={() => onAddDisc(fase)} style={s.btnGhost}>
              + Adicionar disciplina
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.tipo === 'sucesso'
  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 9999,
      padding: '12px 20px', borderRadius: 10,
      background: ok ? '#f0fdf4' : '#fef2f2',
      border: `1.5px solid ${ok ? '#86efac' : '#fca5a5'}`,
      color: ok ? '#15803d' : '#b91c1c',
      fontWeight: 600, fontSize: 13, maxWidth: 380,
      boxShadow: '0 4px 20px rgba(0,0,0,.13)',
      display: 'flex', alignItems: 'flex-start', gap: 8,
      lineHeight: 1.4,
    }}>
      <span style={{ flexShrink: 0, fontSize: 15 }}>{ok ? '✓' : '✕'}</span>
      {toast.msg}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AtualizarCurriculo({ navigate }) {
  // Auth
  const [user, setUser]   = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  // Dados
  const [curriculos, setCurriculos]   = useState([])
  const [selectedId, setSelectedId]   = useState(null)
  const [curso, setCurso]             = useState(null)
  const [disciplinas, setDisciplinas] = useState([])
  const [loadingData, setLoadingData] = useState(false)

  // UI
  const [saving, setSaving]     = useState(false)
  const [dirty, setDirty]       = useState(false)
  const [toast, setToast]       = useState(null)
  const [parecer, setParecer]   = useState('')
  const [parecerErro, setParecerErro] = useState(false)

  const nomeResp = perfil?.nome || user?.email?.split('@')[0] || 'Usuário'
  const importInputRef = useRef(null)

  function handleImportarCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const novas = parsearCSV(ev.target.result)
        if (!novas.length) {
          showToast('erro', 'Nenhuma disciplina encontrada. Verifique se o arquivo está no formato correto.')
          return
        }
        setDisciplinas(novas)
        setDirty(true)
        showToast('sucesso', `${novas.length} disciplinas importadas. Revise e salve quando estiver pronto.`)
      } catch (err) {
        showToast('erro', 'Erro ao ler o arquivo: ' + err.message)
      }
    }
    reader.onerror = () => showToast('erro', 'Erro ao ler o arquivo.')
    reader.readAsText(file, 'UTF-8')
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  // Usa onAuthChange (não getSession direto) para evitar redirect falso
  // durante o auto-refresh do token Supabase, que pode retornar null transitoriamente.
  useEffect(() => {
    const sub = onAuthChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { navigate('/login'); return }
      if (event === 'INITIAL_SESSION') {
        const s = session ?? await getSession()
        if (!s) { navigate('/login'); return }
        setUser(s.user)
        const perfil = await buscarPerfil(s.user.id)
        setPerfil(perfil)
        setLoadingAuth(false)
      }
    })
    return () => sub.unsubscribe()
  }, [])

  // ── Lista currículos ────────────────────────────────────────────────────────
  useEffect(() => {
    if (loadingAuth) return
    listarCurriculos()
      .then(data => {
        setCurriculos(data)
        if (data.length === 1) setSelectedId(data[0].id)
      })
      .catch(err => showToast('erro', 'Erro ao carregar currículos: ' + err.message))
  }, [loadingAuth])

  // ── Carrega currículo selecionado ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return
    setLoadingData(true)
    setCurso(null)
    setDisciplinas([])
    buscarCurriculo(selectedId)
      .then(({ curso, disciplinas: discs }) => {
        setCurso(curso)
        setDisciplinas(discs)
        setDirty(false)
        setParecer('')
      })
      .catch(err => showToast('erro', 'Erro ao carregar currículo: ' + err.message))
      .finally(() => setLoadingData(false))
  }, [selectedId])

  function showToast(tipo, msg) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 5000)
  }

  // ── Disciplinas agrupadas por fase ──────────────────────────────────────────
  const disciplinasPorFase = useMemo(() => {
    const map = {}
    for (let f = 1; f <= NUM_FASES; f++) map[f] = []
    map.optativas = []
    disciplinas.forEach(d => {
      const key = d.fase ? d.fase : 'optativas'
      if (!map[key]) map[key] = []
      map[key].push(d)
    })
    return map
  }, [disciplinas])

  // ── Handlers de edição ──────────────────────────────────────────────────────
  function updateCurso(field, value) {
    setCurso(prev => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  function updateDisc(discId, updated) {
    setDisciplinas(prev => prev.map(d => d._id === discId ? updated : d))
    setDirty(true)
  }

  function addDisc(fase) {
    const nova = novaDisciplina(fase === 'optativas' ? null : fase)
    setDisciplinas(prev => [...prev, nova])
    setDirty(true)
  }

  function removeDisc(discId) {
    setDisciplinas(prev => prev.filter(d => d._id !== discId))
    setDirty(true)
  }

  // ── Salvar ──────────────────────────────────────────────────────────────────
  async function handleSalvar() {
    if (!parecer.trim()) {
      setParecerErro(true)
      document.getElementById('campo-parecer')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setParecerErro(false)
    setSaving(true)
    try {
      const resultado = await salvarCurriculo({
        curriculoId: selectedId,
        dadosCurso: curso,
        disciplinas,
        responsavel: nomeResp,
      })

      // Notifica n8n para histórico — não-bloqueante
      fetch(WEBHOOK_HISTORICO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculo: curso,
          disciplinas,
          responsavel: nomeResp,
          parecer: parecer.trim(),
        }),
      }).catch(() => {})

      setDirty(false)
      setParecer('')
      showToast('sucesso', `Currículo salvo! ${resultado.totalDisciplinas} disciplinas atualizadas.`)
    } catch (err) {
      showToast('erro', 'Erro ao salvar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Export PDF ──────────────────────────────────────────────────────────────
  async function handleExportPDF() {
    if (!curso) return
    try {
      await gerarCurriculoPDF(curso, disciplinas)
    } catch (err) {
      showToast('erro', 'Erro ao gerar PDF: ' + err.message)
    }
  }

  // ── Export CSV (abre no Excel) ───────────────────────────────────────────────
  function handleExportCSV() {
    if (!curso || !disciplinas.length) return
    exportarCSV(curso, disciplinas)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loadingAuth) {
    return (
      <StaffLayout navigate={navigate}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <Spinner color="#00499f" size={24} />
        </div>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout navigate={navigate}>
      <Toast toast={toast} />

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 20px 100px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#00499f', fontSize: 13, fontWeight: 600, padding: 0,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7l4-4" stroke="#00499f" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dashboard
          </button>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <span style={{ color: '#64748b', fontSize: 13 }}>Editor de Currículo</span>
          {dirty && (
            <span style={{
              background: '#fef9c3', color: '#92400e', borderRadius: 4,
              padding: '2px 9px', fontSize: 11, fontWeight: 700,
            }}>
              ● Não salvo
            </span>
          )}
        </div>

        {/* Cabeçalho + seletor */}
        <div style={s.card}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>
            Editor de Currículo
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18 }}>
            Edite diretamente os dados do currículo. Ao salvar, o Supabase é atualizado e
            o n8n registra a versão anterior no histórico.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={s.label}>Currículo</label>
              <select
                value={selectedId ?? ''}
                onChange={e => { setSelectedId(Number(e.target.value) || null); setDirty(false) }}
                style={{ ...s.input, cursor: 'pointer', height: 40 }}
              >
                <option value="">Selecione um currículo…</option>
                {curriculos.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.curriculo_codigo ? ` — ${c.curriculo_codigo}` : ''}
                    {c.campus ? ` [${c.campus}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', background: '#f8fafc',
              border: '1px solid #e2e8f0', borderRadius: 8,
              fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', height: 40,
              boxSizing: 'border-box',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="4.5" r="2.5" stroke="#94a3b8" strokeWidth="1.3" />
                <path d="M1.5 12.5c0-2.5 2.5-4.5 5.5-4.5s5.5 2 5.5 4.5"
                  stroke="#94a3b8" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <strong style={{ color: '#1e293b' }}>{nomeResp}</strong>
            </div>
          </div>
        </div>

        {/* Estado de carregamento */}
        {loadingData && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spinner color="#00499f" size={28} />
            <p style={{ color: '#94a3b8', marginTop: 12, fontSize: 13 }}>
              Carregando currículo…
            </p>
          </div>
        )}

        {/* ── Editor ── */}
        {curso && !loadingData && (
          <>
            {/* === SEÇÃO 1: Dados Gerais === */}
            <div style={s.card}>
              <div style={s.sectionTitle}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="#00499f" strokeWidth="1.5" />
                  <path d="M5 6h6M5 9h6M5 12h4" stroke="#00499f" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Dados Gerais do Curso
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label style={s.label}>Código do Curso</label>
                  <input value={curso.codigo || ''} onChange={e => updateCurso('codigo', e.target.value)}
                    style={{ ...s.input, fontFamily: 'monospace', fontWeight: 700 }} />
                </div>
                <div>
                  <label style={s.label}>Código do Currículo</label>
                  <input value={curso.curriculo_codigo || ''} onChange={e => updateCurso('curriculo_codigo', e.target.value)}
                    style={{ ...s.input, fontFamily: 'monospace' }} />
                </div>
                <div>
                  <label style={s.label}>Campus</label>
                  <input value={curso.campus || ''} onChange={e => updateCurso('campus', e.target.value)}
                    placeholder="Araranguá" style={s.input} />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Nome do Curso</label>
                  <input value={curso.nome || ''} onChange={e => updateCurso('nome', e.target.value)}
                    placeholder="Engenharia de Computação" style={s.input} />
                </div>

                <div>
                  <label style={s.label}>Habilitação</label>
                  <input value={curso.habilitacao || ''} onChange={e => updateCurso('habilitacao', e.target.value)}
                    placeholder="Engenharia de Computação" style={s.input} />
                </div>
                <div>
                  <label style={s.label}>Titulação</label>
                  <input value={curso.titulacao || ''} onChange={e => updateCurso('titulacao', e.target.value)}
                    placeholder="Engenheiro de Computação" style={s.input} />
                </div>
                <div>
                  <label style={s.label}>Diplomado em</label>
                  <input value={curso.diplomado_em || ''} onChange={e => updateCurso('diplomado_em', e.target.value)}
                    placeholder="Engenharia de Computação" style={s.input} />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Objetivo do Curso</label>
                  <textarea
                    value={curso.objetivo || ''}
                    onChange={e => updateCurso('objetivo', e.target.value)}
                    rows={4}
                    placeholder="Formar profissionais capazes de…"
                    style={{ ...s.input, resize: 'vertical', lineHeight: 1.55, minHeight: 90 }}
                  />
                </div>
              </div>
            </div>

            {/* === SEÇÃO 2: Cargas e Coordenação === */}
            <div style={s.card}>
              <div style={s.sectionTitle}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="#00499f" strokeWidth="1.5" />
                  <path d="M8 4v4l3 2" stroke="#00499f" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Cargas Horárias e Coordenação
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div>
                  <label style={s.label}>UFSC (H/A)</label>
                  <input type="number" value={curso.carga_horaria_ufsc_ha || ''}
                    onChange={e => updateCurso('carga_horaria_ufsc_ha', parseInt(e.target.value) || null)}
                    placeholder="3888" style={s.input} />
                </div>
                <div>
                  <label style={s.label}>CNE (H)</label>
                  <input type="number" value={curso.carga_horaria_cne_h || ''}
                    onChange={e => updateCurso('carga_horaria_cne_h', parseInt(e.target.value) || null)}
                    placeholder="3600" style={s.input} />
                </div>
                <div>
                  <label style={s.label}>Estágio (H/A)</label>
                  <input type="number" value={curso.carga_horaria_estagio_ha || ''}
                    onChange={e => updateCurso('carga_horaria_estagio_ha', parseInt(e.target.value) || null)}
                    style={s.input} />
                </div>
                <div>
                  <label style={s.label}>Aulas/sem Mín.</label>
                  <input type="number" value={curso.aulas_semanais_min || ''}
                    onChange={e => updateCurso('aulas_semanais_min', parseInt(e.target.value) || null)}
                    style={s.input} />
                </div>
                <div>
                  <label style={s.label}>Aulas/sem Máx.</label>
                  <input type="number" value={curso.aulas_semanais_max || ''}
                    onChange={e => updateCurso('aulas_semanais_max', parseInt(e.target.value) || null)}
                    style={s.input} />
                </div>
                <div>
                  <label style={s.label}>Período Mín. (sem.)</label>
                  <input type="number" value={curso.periodo_min_semestres || ''}
                    onChange={e => updateCurso('periodo_min_semestres', parseInt(e.target.value) || null)}
                    style={s.input} />
                </div>
                <div>
                  <label style={s.label}>Período Máx. (sem.)</label>
                  <input type="number" value={curso.periodo_max_semestres || ''}
                    onChange={e => updateCurso('periodo_max_semestres', parseInt(e.target.value) || null)}
                    style={s.input} />
                </div>
                <div>
                  <label style={s.label}>Telefone</label>
                  <input value={curso.telefone || ''} onChange={e => updateCurso('telefone', e.target.value)}
                    style={s.input} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Coordenador(a)</label>
                  <input value={curso.coordenador || ''} onChange={e => updateCurso('coordenador', e.target.value)}
                    placeholder="Profº. Drº. Nome do Coordenador" style={s.input} />
                </div>
              </div>
            </div>

            {/* === SEÇÃO 3: Grade Curricular === */}
            <div style={{
              ...s.card, padding: '14px 20px', marginBottom: 0,
              borderBottom: 'none', borderRadius: '10px 10px 0 0',
            }}>
              <div style={{ ...s.sectionTitle, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="#00499f" strokeWidth="1.4" />
                  <rect x="8.5" y="2" width="5.5" height="5.5" rx="1" stroke="#00499f" strokeWidth="1.4" />
                  <rect x="2" y="8.5" width="5.5" height="5.5" rx="1" stroke="#00499f" strokeWidth="1.4" />
                  <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="#00499f" strokeWidth="1.4" />
                </svg>
                Grade Curricular
                <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: '#64748b' }}>
                  {disciplinas.length} disciplinas •{' '}
                  {disciplinas.reduce((a, d) => a + (parseInt(d.carga_horaria_ha) || 0), 0)} H/A total
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              {Array.from({ length: NUM_FASES }, (_, i) => i + 1).map(fase => (
                <FaseSection
                  key={fase}
                  fase={fase}
                  label={`${fase}ª Fase`}
                  disciplinas={disciplinasPorFase[fase] || []}
                  onChangeDisc={updateDisc}
                  onAddDisc={addDisc}
                  onRemoveDisc={removeDisc}
                />
              ))}
              <FaseSection
                fase="optativas"
                label="Disciplinas Optativas"
                disciplinas={disciplinasPorFase.optativas || []}
                onChangeDisc={updateDisc}
                onAddDisc={() => addDisc(null)}
                onRemoveDisc={removeDisc}
              />
            </div>

            {/* === Parecer de alteração === */}
            <div style={s.card}>
              <label id="campo-parecer" style={{ ...s.label, fontSize: 12, textTransform: 'none', letterSpacing: 0, marginBottom: 6 }}>
                Parecer de alteração <span style={{ color: '#b91c1c' }}>*</span>
                <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 4 }}>
                  — descreva o que foi modificado nesta versão
                </span>
              </label>
              <textarea
                value={parecer}
                onChange={e => { setParecer(e.target.value); setParecerErro(false) }}
                placeholder="Ex.: Atualização da ementa de Banco de Dados I, inclusão de ECA7012 na 8ª fase…"
                rows={3}
                style={{
                  ...s.input, resize: 'vertical', lineHeight: 1.55, minHeight: 80,
                  borderColor: parecerErro ? '#fca5a5' : '#e2e8f0',
                  boxShadow: parecerErro ? '0 0 0 3px rgba(185,28,28,.10)' : 'none',
                }}
              />
              {parecerErro && (
                <p style={{ fontSize: 11, color: '#b91c1c', marginTop: 4 }}>
                  O parecer de alteração é obrigatório antes de salvar.
                </p>
              )}
            </div>
          </>
        )}

        {/* Mensagem quando nenhum currículo selecionado */}
        {!selectedId && !loadingData && (
          <div style={{
            textAlign: 'center', padding: '48px 20px', color: '#94a3b8',
          }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: .4 }}>
              <rect x="8" y="6" width="32" height="36" rx="4" stroke="#94a3b8" strokeWidth="2" />
              <path d="M16 18h16M16 24h16M16 30h10" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p style={{ marginTop: 12, fontSize: 14 }}>
              {curriculos.length === 0
                ? 'Nenhum currículo cadastrado. Execute o SQL de setup no Supabase.'
                : 'Selecione um currículo acima para começar a editar.'}
            </p>
          </div>
        )}
      </div>

      {/* ── Barra de ações fixa ── */}
      {curso && !loadingData && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(255,255,255,.96)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid #e2e8f0',
          padding: '12px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          zIndex: 200, boxShadow: '0 -4px 20px rgba(0,0,0,.07)',
          gap: 12,
        }}>
          {/* Exports / Import */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button" onClick={handleExportPDF}
              style={s.btnOutline('#b91c1c')}
              title="Gerar PDF no formato SeTIC/UFSC"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              Exportar PDF
            </button>
            <button
              type="button" onClick={handleExportCSV}
              style={s.btnOutline('#15803d')}
              title="Baixar disciplinas como CSV (abre no Excel)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M4 3.5h6M4 6.5h6M4 9.5h6M4 12h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              Exportar Excel
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleImportarCSV}
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              style={s.btnOutline('#0369a1')}
              title="Importar CSV (mesmo formato do Excel exportado) — substitui a grade atual"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 9.5V2M4 5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Importar Excel
            </button>
          </div>

          {/* Salvar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '10px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
                background: '#fff', color: '#64748b', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={saving}
              style={{
                ...s.btnPrimary,
                minWidth: 150, justifyContent: 'center',
                background: saving ? '#93c5fd' : dirty ? '#00499f' : '#94a3b8',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? (
                <><Spinner /> Salvando…</>
              ) : dirty ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7.5L5.5 11L12 3.5" stroke="white" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Salvar alterações
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7.5L5.5 11L12 3.5" stroke="white" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Salvo
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </StaffLayout>
  )
}
