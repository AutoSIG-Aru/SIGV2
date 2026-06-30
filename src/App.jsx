// ── Roteador ─────────────────────────────────────────────────────────────────
import { useRouter } from './router/useRouter'
import { matchRoute } from './router/routes'
import NotFound from './features/NotFound'

/**
 * App — entrypoint do roteador. Lê o path atual, encontra a rota
 * correspondente em router/routes.jsx e renderiza o componente associado,
 * repassando navigate, search e quaisquer params dinâmicos do path.
 *
 * Sem rota casada: exibe a página 404 (NotFound).
 */
export default function App() {
  const { path, search, navigate } = useRouter()
  const matched = matchRoute(path)

  if (!matched) return <NotFound navigate={navigate} />

  const { route, params } = matched
  const Component = route.component
  return <Component navigate={navigate} search={search} {...params} />
}
