/**
 * UfscHeader — cabeçalho institucional.
 *
 * Props opcionais:
 *   navigate(path) — função de roteamento do App.
 *                    Se omitida, usa window.location.href (reload completo).
 */
export default function UfscHeader({ navigate }) {
  function irParaPainel(e) {
    e.preventDefault()
    const path = window.location.pathname
    // Se já estiver no painel/login, não faz nada
    if (path === '/dashboard' || path === '/login' || path === '/auth') return
    if (navigate) navigate('/login')
    else window.location.href = '/login'
  }

  const isAreaInterna = ['/dashboard', '/login', '/auth'].includes(window.location.pathname)

  return (
    <header className="ufsc-header">
      <div className="ufsc-topbar">
        <span>Serviço Público Federal · Ministério da Educação · Sistema de Gestão Universitária</span>
        <span>Campus Araranguá · Coordenação Acadêmica Integrada</span>
      </div>
      <div className="ufsc-header-main">
        <div className="ufsc-logo-wrap">
          {/* Logo UFSC local */}
          <img
            src="/logo-ufsc.png"
            alt="Brasão UFSC"
          />
        </div>
        <div className="ufsc-id-block">
          <div className="ufsc-service-tag">Instituição Federal de Ensino Superior</div>
          <div className="ufsc-uni-name">Universidade Federal de Santa Catarina</div>
          <div className="ufsc-campus">Campus Araranguá</div>
        </div>
      </div>
      <div className="ufsc-gold-bar" />
    </header>
  )
}
