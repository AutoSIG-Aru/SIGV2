// ── Roteador ─────────────────────────────────────────────────────────────────
import { useRouter } from './router/useRouter'
import { matchRoute } from './router/routes'

/**
 * App — entrypoint do roteador. Lê o path atual, encontra a rota
 * correspondente em router/routes.jsx e renderiza o componente associado,
 * repassando navigate, search e quaisquer params dinâmicos do path.
 *
 * Sem rota casada: nenhuma página é renderizada (return null).
 * Isso só deve acontecer se alguém digitar uma URL fora da tabela.
 * Uma página 404 dedicada pode ser adicionada como última entrada de routes
 * com path "/" — mas hoje "/" já está mapeada para o formulário de validação.
 */
export default function App() {
  const { path, search, navigate } = useRouter()
  const matched = matchRoute(path)

  if (!matched) return null

  const { route, params } = matched
  const Component = route.component
  return <Component navigate={navigate} search={search} {...params} />
}
