import { useEffect, useState } from 'react'

export type Route = { page: 'home' } | { page: 'board'; id: string }

function parse(hash: string): Route {
  const m = hash.match(/^#\/board\/(.+)$/)
  return m ? { page: 'board', id: decodeURIComponent(m[1]) } : { page: 'home' }
}

/** Tiny hash router so the app deploys as plain static files. */
export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const onHash = () => {
      setRoute(parse(location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

export const boardHref = (id: string) => `#/board/${encodeURIComponent(id)}`
