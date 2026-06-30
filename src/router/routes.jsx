import LoginPage from '../features/staff/LoginPage'
import AuthVerify from '../features/staff/AuthVerify'
import Dashboard from '../features/staff/Dashboard'
import RequerimentoDetalhe from '../features/staff/RequerimentoDetalhe'
import AtualizarCurriculo from '../features/staff/AtualizarCurriculo'
import UsuariosPage from '../features/staff/UsuariosPage'
import TipoSelector from '../features/validacao/TipoSelector'
import ValidacaoForm from '../features/validacao/ValidacaoForm'

/**
 * Tabela declarativa de rotas.
 *
 * Cada rota é { path, component }:
 *   - path  — string com segmentos literais (ex: "/dashboard") ou dinâmicos
 *             prefixados com ":" (ex: "/requerimento/:id"). Os segmentos
 *             dinâmicos viram props no componente.
 *   - component — recebe props: { navigate, search, ...params }
 *
 * A ordem importa: a primeira rota que casar ganha. "/" fica no fim porque
 * é a página padrão do aluno; uma futura HomePage institucional pode tomar
 * esse lugar e o formulário ganhar uma rota própria (ex: /validacao).
 *
 * Para adicionar uma rota nova (ex: home institucional, form de equivalência):
 *   1. Importe o componente acima.
 *   2. Insira uma entrada nesse array.
 *   3. Pronto — sem mexer no App.jsx.
 */
export const routes = [
  { path: '/login',               component: LoginPage           },
  { path: '/auth',                component: AuthVerify          },
  { path: '/dashboard',           component: Dashboard           },
  { path: '/curriculo/atualizar', component: AtualizarCurriculo  },
  { path: '/usuarios',            component: UsuariosPage        },
  { path: '/requerimento/:id',    component: RequerimentoDetalhe },
  { path: '/solicitar/:tipo',     component: ValidacaoForm       },
  { path: '/',                    component: TipoSelector        },
]

/**
 * matchRoute — tenta casar o `currentPath` contra a tabela.
 *
 * @returns { route, params } se houver match, ou null caso contrário.
 */
export function matchRoute(currentPath, routeList = routes) {
  for (const route of routeList) {
    const params = matchPath(route.path, currentPath)
    if (params !== null) return { route, params }
  }
  return null
}

// ── Helper interno ───────────────────────────────────────────────────────────
// Compara segmento a segmento. Segmento iniciado por ":" vira parâmetro.
function matchPath(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts    = path.split('/').filter(Boolean)
  if (patternParts.length !== pathParts.length) return null

  const params = {}
  for (let i = 0; i < patternParts.length; i++) {
    const seg = patternParts[i]
    if (seg.startsWith(':')) {
      params[seg.slice(1)] = decodeURIComponent(pathParts[i])
    } else if (seg !== pathParts[i]) {
      return null
    }
  }
  return params
}
