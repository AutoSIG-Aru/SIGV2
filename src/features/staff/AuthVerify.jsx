import { useEffect, useState } from 'react'
import StaffLayout from '../../layouts/StaffLayout'
import { onAuthChange, getSession, updatePassword } from '../../services/authService'

/**
 * Rota: /auth — callback de todos os links enviados pelo Supabase.
 *
 * Casos tratados:
 *   type=invite   → usuário aceitou convite → exige definição de senha
 *   type=recovery → usuário clicou "Recuperar senha" → exige nova senha
 *   (outros)      → login normal → redireciona para /dashboard
 *
 * Erros (query ou hash) → mensagem + redirect para /login em 3 s.
 */
export default function AuthVerify({ navigate }) {
  // 'verificando' | 'definir_senha' | 'ok' | 'erro'
  const [status, setStatus]       = useState('verificando')
  const [mensagem, setMensagem]   = useState('')
  const [countdown, setCountdown] = useState(3)

  // Formulário de nova senha
  const [novaSenha, setNovaSenha]           = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [salvando, setSalvando]             = useState(false)
  const [erroSenha, setErroSenha]           = useState('')

  // Detecta o "type" do link no hash da URL
  const tipoLink = (() => {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    return h.get('type') // 'recovery' | 'invite' | null
  })()

  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search)
    const fromHash  = new URLSearchParams(window.location.hash.replace(/^#/, ''))

    const urlError =
      fromQuery.get('error_description') ||
      fromQuery.get('error')             ||
      fromHash.get('error_description')  ||
      fromHash.get('error')

    if (urlError) {
      const msg = decodeURIComponent(urlError).replace(/\+/g, ' ')
      setMensagem(traduzirErro(msg))
      setStatus('erro')
      return
    }

    const subscription = onAuthChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session) {
        if (tipoLink === 'recovery' || tipoLink === 'invite') {
          setStatus('definir_senha')
        } else {
          setStatus('ok')
          setTimeout(() => navigate('/dashboard'), 1400)
        }
      }
    })

    // Sessão já ativa (link clicado em aba onde já estava logado)
    getSession().then(session => {
      if (session && status === 'verificando') {
        if (tipoLink === 'recovery' || tipoLink === 'invite') {
          setStatus('definir_senha')
        } else {
          setStatus('ok')
          setTimeout(() => navigate('/dashboard'), 1400)
        }
      }
    })

    const timeout = setTimeout(() => {
      setStatus(s => {
        if (s === 'verificando') {
          setMensagem('O link pode ter expirado ou já foi usado.')
          return 'erro'
        }
        return s
      })
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  // Countdown e redirect automático no erro
  useEffect(() => {
    if (status !== 'erro') return
    if (countdown <= 0) { navigate('/login'); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [status, countdown])

  async function handleDefinirSenha(e) {
    e.preventDefault()
    setErroSenha('')

    if (novaSenha.length < 8) {
      setErroSenha('A senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (novaSenha !== confirmarSenha) {
      setErroSenha('As senhas não coincidem.')
      return
    }

    setSalvando(true)
    const { error } = await updatePassword(novaSenha)
    setSalvando(false)

    if (error) {
      setErroSenha('Não foi possível salvar a senha. Tente novamente.')
      return
    }

    setStatus('ok')
    setTimeout(() => navigate('/dashboard'), 1400)
  }

  return (
    <StaffLayout navigate={navigate}>
      <div className="page-container" style={{ maxWidth: 480 }}>
        <div className="form-card" style={{ textAlign: 'center', padding: '52px 32px' }}>

          {status === 'verificando' && (
            <>
              <div style={{ fontSize: 44, marginBottom: 16 }}>⏳</div>
              <h2 style={{ color: '#00499f', margin: 0 }}>Verificando link…</h2>
              <p style={{ color: '#888', marginTop: 10 }}>Aguarde um instante.</p>
            </>
          )}

          {status === 'definir_senha' && (
            <div style={{ textAlign: 'left' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
                <h2 style={{ color: '#00499f', margin: '0 0 8px' }}>
                  {tipoLink === 'invite' ? 'Defina sua senha de acesso' : 'Crie uma nova senha'}
                </h2>
                <p style={{ color: '#555', margin: 0, fontSize: 14 }}>
                  {tipoLink === 'invite'
                    ? 'Seu convite foi aceito. Escolha uma senha para acessar o sistema.'
                    : 'Escolha uma nova senha para sua conta.'}
                </p>
              </div>

              <form onSubmit={handleDefinirSenha}>
                <div style={{ marginBottom: 16 }}>
                  <label className="field-label">Nova senha</label>
                  <input
                    type="password"
                    className="field-input"
                    placeholder="Mínimo 8 caracteres"
                    value={novaSenha}
                    onChange={e => { setNovaSenha(e.target.value); setErroSenha('') }}
                    required autoFocus disabled={salvando}
                    minLength={8}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label className="field-label">Confirmar senha</label>
                  <input
                    type="password"
                    className="field-input"
                    placeholder="Repita a senha"
                    value={confirmarSenha}
                    onChange={e => { setConfirmarSenha(e.target.value); setErroSenha('') }}
                    required disabled={salvando}
                  />
                  {erroSenha && (
                    <p style={{ color: '#c0392b', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                      {erroSenha}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={salvando || !novaSenha || !confirmarSenha}
                  style={{ width: '100%' }}
                >
                  {salvando ? 'Salvando…' : 'Salvar senha e entrar →'}
                </button>
              </form>
            </div>
          )}

          {status === 'ok' && (
            <>
              <div style={{ fontSize: 44, marginBottom: 16 }}>✅</div>
              <h2 style={{ color: '#27ae60', margin: 0 }}>Tudo certo!</h2>
              <p style={{ color: '#555', marginTop: 10 }}>Redirecionando para o painel…</p>
            </>
          )}

          {status === 'erro' && (
            <>
              <div style={{ fontSize: 44, marginBottom: 16 }}>🔗</div>
              <h2 style={{ color: '#c0392b', margin: '0 0 12px' }}>Link inválido ou expirado</h2>
              <p style={{ color: '#555', lineHeight: 1.6, marginBottom: 24 }}>{mensagem}</p>
              <p style={{ color: '#aaa', fontSize: 13, marginBottom: 20 }}>
                Redirecionando em <strong>{countdown}s</strong>…
              </p>
              <button
                type="button"
                className="submit-btn"
                onClick={() => navigate('/login')}
              >
                Ir para o login
              </button>
            </>
          )}

        </div>
      </div>
    </StaffLayout>
  )
}

function traduzirErro(msg) {
  if (!msg) return 'Ocorreu um erro ao verificar o link.'
  const m = msg.toLowerCase()
  if (m.includes('expired') || m.includes('expirado'))
    return 'Este link expirou. Os links são válidos por 15 minutos.'
  if (m.includes('already used') || m.includes('já foi usado') || m.includes('invalid'))
    return 'Este link já foi usado ou é inválido.'
  if (m.includes('not found'))
    return 'E-mail não encontrado no sistema. Verifique com o administrador.'
  return msg
}
