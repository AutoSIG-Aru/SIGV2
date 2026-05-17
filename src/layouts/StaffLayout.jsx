import UfscHeader from '../components/UfscHeader'
import UfscFooter from '../components/UfscFooter'

/**
 * StaffLayout — moldura das páginas do painel interno (login, auth, dashboard,
 * detalhe de requerimento).
 *
 * Aplica header institucional + área de conteúdo (children) + rodapé staff.
 * Não força um container interno: cada página define o próprio.
 *
 * Props:
 *   navigate(path) — função do roteador, repassada ao header para navegação SPA.
 *   children       — conteúdo da página.
 */
export default function StaffLayout({ navigate, children }) {
  return (
    <>
      <UfscHeader navigate={navigate} />
      {children}
      <UfscFooter variant="staff" />
    </>
  )
}
