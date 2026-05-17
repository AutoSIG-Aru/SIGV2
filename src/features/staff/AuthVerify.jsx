import { useEffect, useState } from 'react'
import StaffLayout from '../../layouts/StaffLayout'
import { supabase } from '../../services/supabase'

/**
 * Página de callback do magic link do Supabase.
 * Rota: /auth
 *
 * Supabase redireciona para cá após o clique no link.
 * Erros podem vir como:
 *   - query params:  /auth?error=...&error_description=...
 *   - hash params:   /auth#error=...&error_description=...  (links expirados/usados)
 *
 * Quando há erro, o usuário é redirecionado automaticamente para /login
 * em 3 segundos para solicitar um novo link.
 */
export default function AuthVerify({ navigate }) {
  const [status, setStatus]     = useState('verificando') // 'verificando' | 'ok' | 'erro'
  const [mensagem, setMensagem] = useState('')
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    // Checa erro tanto em query params (?...) quanto em hash params (#...)
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

    // Escuta mudanças de auth — SDK processa o hash e dispara SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setStatus('ok')
        setTimeout(() => navigate('/dashboard'), 1400)
      }
    })

    // Checa sessão já ativa (ex: usuário clicou o link numa aba onde já estava logado)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus('ok')
        setTimeout(() => navigate('/dashboard'), 1400)
      }
    })

    // Timeout de segurança — link silenciosamente inválido ou bloqueado por extensão
    const timeout = setTimeout(() => {
      setStatus(s => {
        if (s === 'verificando') {
          setMensagem('O link pode ter expirado ou já foi usado. Enviando você de volta para solicitar um novo…')
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

  // Contagem regressiva e redirect automático quando há erro
  useEffect(() => {
    if (status !== 'erro') return

    if (countdown <= 0) {
      navigate('/login?reenviar=1')
      return
    }

    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [status, countdown])

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

          {status === 'ok' && (
            <>
              <div style={{ fontSize: 44, marginBottom: 16 }}>✅</div>
              <h2 style={{ color: '#27ae60', margin: 0 }}>Acesso confirmado!</h2>
              <p style={{ color: '#555', marginTop: 10 }}>
                Redirecionando para o painel…
              </p>
            </>
          )}

          {status === 'erro' && (
            <>
              <div style={{ fontSize: 44, marginBottom: 16 }}>🔗</div>
              <h2 style={{ color: '#c0392b', margin: '0 0 12px' }}>Link inválido ou expirado</h2>
              <p style={{ color: '#555', lineHeight: 1.6, marginBottom: 24 }}>
                {mensagem}
              </p>
              <p style={{ color: '#aaa', fontSize: 13, marginBottom: 20 }}>
                Redirecionando em <strong>{countdown}s</strong>…
              </p>
              <button
                type="button"
                className="submit-btn"
                onClick={() => navigate('/login?reenviar=1')}
              >
                Solicitar novo link agora
              </button>
            </>
          )}

        </div>
      </div>

    </StaffLayout>
  )
}

// Traduz mensagens de erro do Supabase para português
function traduzirErro(msg) {
  if (!msg) return 'Ocorreu um erro ao verificar o link.'
  const m = msg.toLowerCase()
  if (m.includes('expired') || m.includes('expirado'))
    return 'Este link de acesso expirou. Os links são válidos por 15 minutos.'
  if (m.includes('already used') || m.includes('já foi usado') || m.includes('invalid'))
    return 'Este link já foi usado ou é inválido. Cada link só pode ser utilizado uma vez.'
  if (m.includes('not found'))
    return 'E-mail não encontrado no sistema. Verifique com o administrador.'
  return msg
}
