import { useState, useEffect } from 'react'

/**
 * useRouter — roteador SPA mínimo, sem dependências externas.
 *
 * Mantém o path atual e a query string sincronizados com a URL do navegador,
 * reagindo ao botão "voltar" (popstate). A função `navigate` empurra um novo
 * estado e atualiza o componente que consome o hook.
 *
 * Retorno:
 *   {
 *     path:     string — pathname atual (ex: "/dashboard")
 *     search:   string — query string atual (ex: "?token=abc")
 *     navigate: (to)   — empurra `to` para a URL e re-renderiza
 *   }
 */
export function useRouter() {
  const [path, setPath]     = useState(window.location.pathname)
  const [search, setSearch] = useState(window.location.search)

  useEffect(() => {
    function onPop() {
      setPath(window.location.pathname)
      setSearch(window.location.search)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function navigate(to) {
    window.history.pushState({}, '', to)
    const [newPath, qs = ''] = to.split('?')
    setPath(newPath)
    setSearch(qs ? `?${qs}` : '')
  }

  return { path, search, navigate }
}
