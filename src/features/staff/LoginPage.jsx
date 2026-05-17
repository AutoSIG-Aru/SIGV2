import { useState } from 'react'
import StaffLayout from '../../layouts/StaffLayout'
import { solicitarMagicLink } from '../../services/authService'
import { supabase } from '../../services/supabase'

export default function LoginPage({ navigate }) {
  // Se veio de um link expirado/usado, mostra aviso amigável
  const linkExpirou = new URLSearchParams(window.location.search).get('reenviar') === '1'

  const [modo, setModo]         = useState('magiclink') // 'magiclink' | 'senha'
  const [email, setEmail]       = useState('')
  const [senha, setSenha]       = useState('')
  const [etapa, setEtapa]       = useState('form')  // 'form' | 'enviado'
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro]         = useState('')

  async function handleSubmitMagicLink(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const result = await solicitarMagicLink(email.toLowerCase().trim())
    setEnviando(false)
    if (result.ok) {
      setEtapa('enviado')
    } else {
      setErro(result.error || 'Não foi possível enviar o link. Tente novamente.')
    }
  }

  async function handleSubmitSenha(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: senha,
    })
    setEnviando(false)
    if (error) {
      setErro('E-mail ou senha incorretos.')
      return
    }
    navigate('/dashboard')
  }

  function trocarModo(novoModo) {
    setModo(novoModo)
    setErro('')
    setSenha('')
    setEtapa('form')
  }

  return (
    <StaffLayout navigate={navigate}>
      <div className="page-container" style={{ maxWidth: 500 }}>
        {etapa === 'enviado' ? (
          /* ── Estado: link enviado ── */
          <div className="form-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
            <h2 style={{ color: '#00499f', margin: '0 0 12px' }}>
              Verifique seu e-mail
            </h2>
            <p style={{ color: '#444', lineHeight: 1.7, margin: '0 0 8px' }}>
              Enviamos um link de acesso para <strong>{email}</strong>.
            </p>
            <p style={{ color: '#777', fontSize: 13, lineHeight: 1.6, margin: '0 0 28px' }}>
              O link é válido por <strong>15 minutos</strong>.<br />
              Verifique também a pasta de spam.
            </p>
            <button
              type="button"
              className="btn-back"
              onClick={() => { setEtapa('form'); setEmail(''); setErro('') }}
            >
              ← Usar outro e-mail
            </button>
          </div>
        ) : (
          /* ── Estado: formulário de login ── */
          <div className="form-card">
            <div className="section-header">
              <span className="step-num" style={{ fontSize: 18 }}>🔑</span>
              Acesso ao Painel SIG
            </div>

            {/* Aviso de link expirado/usado */}
            {linkExpirou && (
              <div style={{
                background: '#fffbeb', border: '1px solid #fcd34d',
                borderRadius: 8, padding: '12px 16px', marginBottom: 20,
                fontSize: 13, color: '#92400e', lineHeight: 1.6,
              }}>
                ⚠️ Seu link de acesso expirou ou já foi usado. Solicite um novo abaixo.
              </div>
            )}

            {/* Alternador de modo */}
            <div style={{
              display: 'flex', gap: 0, marginBottom: 24,
              border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden',
            }}>
              {[
                { id: 'magiclink', label: 'Link por e-mail' },
                { id: 'senha',     label: 'Senha'           },
              ].map(op => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => trocarModo(op.id)}
                  style={{
                    flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: modo === op.id ? '#00499f' : '#f8fafc',
                    color:      modo === op.id ? '#fff'    : '#64748b',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {op.label}
                </button>
              ))}
            </div>

            {modo === 'magiclink' ? (
              <>
                <p style={{ color: '#555', marginBottom: 24, lineHeight: 1.7 }}>
                  Informe seu e-mail institucional UFSC. Enviaremos um link de
                  acesso diretamente — sem necessidade de senha.
                </p>
                <form onSubmit={handleSubmitMagicLink}>
                  <div style={{ marginBottom: 20 }}>
                    <label className="field-label">E-mail institucional</label>
                    <input
                      type="email"
                      className={`field-input${erro ? ' error' : ''}`}
                      placeholder="seu.nome@ufsc.br"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setErro('') }}
                      required autoFocus disabled={enviando}
                    />
                    {erro && (
                      <p style={{ color: '#c0392b', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                        {erro}
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={enviando || !email}
                    style={{ width: '100%' }}
                  >
                    {enviando ? 'Enviando link…' : 'Enviar link de acesso →'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <p style={{ color: '#555', marginBottom: 24, lineHeight: 1.7 }}>
                  Entre com seu e-mail e senha cadastrados.
                </p>
                <form onSubmit={handleSubmitSenha}>
                  <div style={{ marginBottom: 16 }}>
                    <label className="field-label">E-mail</label>
                    <input
                      type="email"
                      className={`field-input${erro ? ' error' : ''}`}
                      placeholder="seu.nome@ufsc.br"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setErro('') }}
                      required autoFocus disabled={enviando}
                    />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label className="field-label">Senha</label>
                    <input
                      type="password"
                      className={`field-input${erro ? ' error' : ''}`}
                      placeholder="••••••••"
                      value={senha}
                      onChange={e => { setSenha(e.target.value); setErro('') }}
                      required disabled={enviando}
                    />
                    {erro && (
                      <p style={{ color: '#c0392b', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                        {erro}
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={enviando || !email || !senha}
                    style={{ width: '100%' }}
                  >
                    {enviando ? 'Entrando…' : 'Entrar →'}
                  </button>
                </form>
              </>
            )}

            <p style={{ marginTop: 20, color: '#999', fontSize: 12, textAlign: 'center' }}>
              Acesso restrito. Apenas e-mails autorizados pelo administrador.
            </p>
          </div>
        )}
      </div>
    </StaffLayout>
  )
}
