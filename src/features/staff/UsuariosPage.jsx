import { useState, useEffect } from 'react'
import StaffLayout from '../../layouts/StaffLayout'
import { onAuthChange, getSession } from '../../services/authService'
import { listarUsuarios, convidarUsuario, toggleUsuario, excluirUsuario } from '../../services/usuariosService'
import { listarCursos } from '../../services/curriculoService'

const PERFIL_CFG = {
  sig:         { label: 'SIG',         cor: '#00499f', bg: '#dbeafe' },
  coordenacao: { label: 'Coordenação', cor: '#1d4ed8', bg: '#eff6ff' },
}

function Badge({ perfil }) {
  const cfg = PERFIL_CFG[perfil] || { label: perfil, cor: '#888', bg: '#f5f5f5' }
  return (
    <span style={{
      background: cfg.bg, color: cfg.cor,
      borderRadius: 20, padding: '4px 12px',
      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function formatarData(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ── Modal de confirmação de exclusão ──────────────────────────────────────────
function ModalExcluir({ usuario, onConfirmar, onCancelar, excluindo, erro }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,23,42,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 36px',
        maxWidth: 460, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 20 }}>⚠️</div>
        <h3 style={{ color: '#1e293b', margin: '0 0 12px', textAlign: 'center', fontSize: 20 }}>
          Excluir usuário?
        </h3>
        <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.6, textAlign: 'center', margin: '0 0 8px' }}>
          O usuário <strong>{usuario.nome || usuario.email}</strong> será removido
          permanentemente do sistema.
        </p>
        <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', margin: '0 0 28px' }}>
          Esta ação não pode ser desfeita.
        </p>

        {erro && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
            padding: '12px 16px', color: '#b91c1c', fontSize: 14, marginBottom: 20,
          }}>
            {erro}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onCancelar}
            disabled={excluindo}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10,
              border: '1.5px solid #e2e8f0', background: '#fff',
              color: '#475569', fontSize: 15, fontWeight: 600,
              cursor: excluindo ? 'default' : 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={excluindo}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10,
              border: 'none', background: excluindo ? '#fca5a5' : '#dc2626',
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: excluindo ? 'default' : 'pointer',
            }}
          >
            {excluindo ? 'Excluindo…' : 'Sim, excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Estilos inline reutilizáveis ──────────────────────────────────────────────
const btnAcao = (cor, bg, border) => ({
  padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  border: `1.5px solid ${border}`, background: bg, color: cor,
  cursor: 'pointer', whiteSpace: 'nowrap',
})

export default function UsuariosPage({ navigate }) {
  const [usuarios, setUsuarios]     = useState([])
  const [cursos, setCursos]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [erro, setErro]             = useState(null)

  // Formulário de convite
  const [mostrarForm, setMostrarForm] = useState(false)
  const [email, setEmail]             = useState('')
  const [nome, setNome]               = useState('')
  const [perfil, setPerfil]           = useState('coordenacao')
  const [curso, setCurso]             = useState('')
  const [funcao, setFuncao]           = useState('')
  const [enviando, setEnviando]       = useState(false)
  const [erroForm, setErroForm]       = useState('')
  const [sucesso, setSucesso]         = useState('')

  // Modal de exclusão
  const [usuarioParaExcluir, setUsuarioParaExcluir] = useState(null)
  const [excluindo, setExcluindo]                   = useState(false)
  const [erroExcluir, setErroExcluir]               = useState('')

  useEffect(() => {
    // Usa onAuthChange (não getSession direto) para evitar redirect falso
    // durante o auto-refresh do token Supabase, que pode retornar null transitoriamente.
    const sub = onAuthChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { navigate('/login'); return }
      if (event === 'INITIAL_SESSION') {
        const s = session ?? await getSession()
        if (!s) { navigate('/login'); return }
        carregarUsuarios()
        listarCursos().then(setCursos).catch(() => {})
      }
    })
    return () => sub.unsubscribe()
  }, [])

  async function carregarUsuarios() {
    setLoading(true); setErro(null)
    try { setUsuarios(await listarUsuarios()) }
    catch { setErro('Não foi possível carregar os usuários.') }
    setLoading(false)
  }

  async function handleConvidar(e) {
    e.preventDefault()
    setErroForm(''); setSucesso(''); setEnviando(true)
    const result = await convidarUsuario({
      email, nome, perfil,
      curso:  perfil === 'coordenacao' ? curso  : undefined,
      funcao: perfil === 'sig'         ? funcao : undefined,
    })
    setEnviando(false)
    if (!result.ok) { setErroForm(result.error); return }
    setSucesso(`Convite enviado para ${email}.`)
    setEmail(''); setNome(''); setCurso(''); setFuncao(''); setPerfil('coordenacao')
    setMostrarForm(false)
    carregarUsuarios()
  }

  async function handleToggle(u) {
    try {
      await toggleUsuario(u.id, !u.ativo)
      setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, ativo: !x.ativo } : x))
    } catch { alert('Erro ao alterar status do usuário.') }
  }

  async function handleExcluirConfirmar() {
    if (!usuarioParaExcluir) return
    setErroExcluir(''); setExcluindo(true)
    try {
      const result = await excluirUsuario(usuarioParaExcluir.id)
      if (!result.ok) {
        setErroExcluir(result.error || 'Erro ao excluir usuário.')
        return
      }
      setUsuarios(prev => prev.filter(u => u.id !== usuarioParaExcluir.id))
      setSucesso(`Usuário ${usuarioParaExcluir.nome || usuarioParaExcluir.email} excluído.`)
      setUsuarioParaExcluir(null)
    } catch (err) {
      setErroExcluir('Erro de conexão ao tentar excluir. Tente novamente.')
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <StaffLayout navigate={navigate}>
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '32px 24px 56px' }}>

        {usuarioParaExcluir && (
          <ModalExcluir
            usuario={usuarioParaExcluir}
            onConfirmar={handleExcluirConfirmar}
            onCancelar={() => { setUsuarioParaExcluir(null); setErroExcluir('') }}
            excluindo={excluindo}
            erro={erroExcluir}
          />
        )}

        {/* ── Cabeçalho ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button className="btn-back" onClick={() => navigate('/dashboard')} style={{ margin: 0, flexShrink: 0 }}>
            ← Painel
          </button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e293b', flex: 1 }}>
            Usuários do sistema
          </h1>
          <button
            onClick={() => { setMostrarForm(f => !f); setErroForm(''); setSucesso('') }}
            style={{
              padding: '10px 22px', borderRadius: 10,
              background: '#00499f', color: '#fff',
              border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {mostrarForm ? '✕ Cancelar' : '+ Convidar usuário'}
          </button>
        </div>

        {/* ── Feedback global ── */}
        {sucesso && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10,
            padding: '14px 20px', color: '#15803d', fontSize: 14, marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ✓ {sucesso}
          </div>
        )}

        {/* ── Formulário de convite ── */}
        {mostrarForm && (
          <div className="form-card" style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginBottom: 20 }}>
              Convidar novo usuário
            </div>
            <form onSubmit={handleConvidar}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="field-label">E-mail</label>
                  <input
                    type="email" className="field-input"
                    placeholder="nome@exemplo.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    required disabled={enviando}
                  />
                </div>
                <div>
                  <label className="field-label">Nome completo</label>
                  <input
                    type="text" className="field-input"
                    placeholder="Nome da pessoa"
                    value={nome} onChange={e => setNome(e.target.value)}
                    required disabled={enviando}
                  />
                </div>
                <div>
                  <label className="field-label">Perfil</label>
                  <select
                    className="field-input" value={perfil}
                    onChange={e => { setPerfil(e.target.value); setCurso(''); setFuncao('') }}
                    disabled={enviando}
                  >
                    <option value="coordenacao">Coordenação</option>
                    <option value="sig">SIG</option>
                  </select>
                </div>
                {perfil === 'coordenacao' && (
                  <div>
                    <label className="field-label">Curso</label>
                    <select
                      className="field-input" value={curso}
                      onChange={e => setCurso(e.target.value)}
                      required disabled={enviando}
                    >
                      <option value="">Selecione o curso…</option>
                      {cursos.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                {perfil === 'sig' && (
                  <div>
                    <label className="field-label">Função</label>
                    <input
                      type="text" className="field-input"
                      placeholder="Ex: Técnico Administrativo"
                      value={funcao} onChange={e => setFuncao(e.target.value)}
                      disabled={enviando}
                    />
                  </div>
                )}
              </div>

              {erroForm && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
                  padding: '12px 16px', color: '#b91c1c', fontSize: 14, marginBottom: 16,
                }}>
                  {erroForm}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button" onClick={() => setMostrarForm(false)}
                  style={{
                    padding: '10px 22px', borderRadius: 8, border: '1.5px solid #e2e8f0',
                    background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={enviando}
                  style={{
                    padding: '10px 24px', borderRadius: 8, border: 'none',
                    background: enviando ? '#94a3b8' : '#00499f',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: enviando ? 'default' : 'pointer',
                  }}
                >
                  {enviando ? 'Enviando convite…' : 'Enviar convite →'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tabela ── */}
        <div className="form-card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 15 }}>
              Carregando…
            </div>
          ) : erro ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#b91c1c', fontSize: 15 }}>{erro}</div>
          ) : usuarios.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 15 }}>
              Nenhum usuário cadastrado.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {[
                      { label: 'Nome',          w: '18%' },
                      { label: 'E-mail',         w: '22%' },
                      { label: 'Perfil',         w: '12%' },
                      { label: 'Curso / Função', w: '20%' },
                      { label: 'Cadastrado em',  w: '12%' },
                      { label: 'Último acesso',  w: '12%' },
                      { label: '',               w: '14%' },
                    ].map(({ label, w }) => (
                      <th key={label} style={{
                        padding: '14px 20px', textAlign: 'left', width: w,
                        fontSize: 12, fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u, i) => (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: i < usuarios.length - 1 ? '1px solid #f1f5f9' : 'none',
                        opacity: u.ativo ? 1 : 0.45,
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '16px 20px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                        {u.nome || '—'}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: 14, color: '#475569' }}>
                        {u.email}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <Badge perfil={u.perfil} />
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: 14, color: '#64748b' }}>
                        {u.perfil === 'sig' ? (u.funcao || '—') : (u.curso || '—')}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: 13, color: '#94a3b8' }}>
                        {formatarData(u.criado_em)}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: 13, color: '#94a3b8' }}>
                        {formatarData(u.ultimo_login)}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            onClick={() => handleToggle(u)}
                            style={u.ativo
                              ? btnAcao('#b45309', '#fef3c7', '#fcd34d')
                              : btnAcao('#15803d', '#f0fdf4', '#86efac')
                            }
                          >
                            {u.ativo ? 'Desativar' : 'Reativar'}
                          </button>
                          <button
                            onClick={() => { setUsuarioParaExcluir(u); setErroExcluir('') }}
                            style={btnAcao('#b91c1c', '#fef2f2', '#fca5a5')}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </StaffLayout>
  )
}
