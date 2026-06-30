import { useState } from 'react'
import StaffLayout from '../../layouts/StaffLayout'
import { signInWithPassword, enviarRecuperacaoSenha } from '../../services/authService'

export default function LoginPage({ navigate }) {
  // 'form' | 'recuperar' | 'recuperar_enviado'
  const [etapa, setEtapa]       = useState('form')
  const [email, setEmail]       = useState('')
  const [senha, setSenha]       = useState('')
  const [emailRec, setEmailRec] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro]         = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const result = await signInWithPassword(email, senha)
    setEnviando(false)
    if (!result.ok) { setErro(result.error); return }
    navigate('/dashboard')
  }

  async function handleRecuperar(e) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const result = await enviarRecuperacaoSenha(emailRec)
    setEnviando(false)
    if (!result.ok) { setErro(result.error); return }
    setEtapa('recuperar_enviado')
  }

  /* ── Confirmação de e-mail enviado ── */
  if (etapa === 'recuperar_enviado') {
    return (
      <StaffLayout navigate={navigate}>
        <div className="page-container" style={{ maxWidth: 500 }}>
          <div className="form-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
            <h2 style={{ color: '#00499f', margin: '0 0 12px' }}>Verifique seu e-mail</h2>
            <p style={{ color: '#444', lineHeight: 1.7, margin: '0 0 8px' }}>
              Enviamos um link de recuperação para <strong>{emailRec}</strong>.
            </p>
            <p style={{ color: '#777', fontSize: 13, lineHeight: 1.6, margin: '0 0 28px' }}>
              O link é válido por <strong>15 minutos</strong>.<br />
              Verifique também a pasta de spam.
            </p>
            <button
              type="button"
              className="btn-back"
              onClick={() => { setEtapa('form'); setEmailRec(''); setErro('') }}
            >
              ← Voltar ao login
            </button>
          </div>
        </div>
      </StaffLayout>
    )
  }

  /* ── Formulário de recuperação de senha ── */
  if (etapa === 'recuperar') {
    return (
      <StaffLayout navigate={navigate}>
        <div className="page-container" style={{ maxWidth: 500 }}>
          <div className="form-card">
            <div className="section-header">
              <span className="step-num" style={{ fontSize: 18 }}>🔒</span>
              Recuperar senha
            </div>
            <p style={{ color: '#555', marginBottom: 24, lineHeight: 1.7 }}>
              Informe o e-mail cadastrado. Enviaremos um link para você definir uma nova senha.
            </p>
            <form onSubmit={handleRecuperar}>
              <div style={{ marginBottom: 20 }}>
                <label className="field-label">E-mail</label>
                <input
                  type="email"
                  className={`field-input${erro ? ' error' : ''}`}
                  placeholder="seu.email@ufsc.br"
                  value={emailRec}
                  onChange={e => { setEmailRec(e.target.value); setErro('') }}
                  required autoFocus disabled={enviando}
                />
                {erro && (
                  <p style={{ color: '#c0392b', fontSize: 13, marginTop: 6, marginBottom: 0 }}>{erro}</p>
                )}
              </div>
              <button
                type="submit"
                className="submit-btn"
                disabled={enviando || !emailRec}
                style={{ width: '100%', marginBottom: 12 }}
              >
                {enviando ? 'Enviando…' : 'Enviar link de recuperação →'}
              </button>
            </form>
            <button
              type="button"
              className="btn-back"
              style={{ width: '100%', textAlign: 'center' }}
              onClick={() => { setEtapa('form'); setErro('') }}
            >
              ← Voltar ao login
            </button>
          </div>
        </div>
      </StaffLayout>
    )
  }

  /* ── Formulário de login principal ── */
  return (
    <StaffLayout navigate={navigate}>
      <div className="page-container" style={{ maxWidth: 500 }}>
        <div className="form-card">
          <div className="section-header">
            <span className="step-num" style={{ fontSize: 18 }}>🔑</span>
            Acesso ao Painel SIG
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label className="field-label">E-mail</label>
              <input
                type="email"
                className={`field-input${erro ? ' error' : ''}`}
                placeholder="seu.email@ufsc.br"
                value={email}
                onChange={e => { setEmail(e.target.value); setErro('') }}
                required autoFocus disabled={enviando}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
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
                <p style={{ color: '#c0392b', fontSize: 13, marginTop: 6, marginBottom: 0 }}>{erro}</p>
              )}
            </div>

            {/* Link "Esqueci minha senha" */}
            <div style={{ textAlign: 'right', marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => { setEtapa('recuperar'); setEmailRec(email); setErro('') }}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: '#00499f', fontSize: 13, cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Esqueci minha senha
              </button>
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

          <p style={{ marginTop: 20, color: '#999', fontSize: 12, textAlign: 'center' }}>
            Acesso restrito. Apenas usuários cadastrados pelo administrador.
          </p>
        </div>
      </div>
    </StaffLayout>
  )
}
