import UfscHeader from '../components/UfscHeader'
import UfscFooter from '../components/UfscFooter'

/**
 * PublicLayout — moldura das páginas voltadas ao aluno (formulários, home).
 *
 * Aplica header institucional + área de conteúdo (children) + rodapé público.
 * Não força um container interno: cada página define o próprio (.page-container,
 * larguras customizadas, etc).
 *
 * Props:
 *   navigate(path) — função do roteador, repassada ao header para navegação SPA.
 *   children       — conteúdo da página.
 */
export default function PublicLayout({ navigate, children }) {
  return (
    <>
      <UfscHeader navigate={navigate} />
      {children}
      <UfscFooter variant="publico" />
    </>
  )
}
