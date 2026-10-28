import { useEffect, useState } from 'react'
import type { Board, Kind } from '../types'

export type Route = { page: 'list'; kind: Kind } | { page: 'item'; kind: Kind; id: string }

function parse(hash: string): Route {
  const m = hash.match(/^#\/(board|binding)\/(.+)$/)
  if (m) return { page: 'item', kind: m[1] as Kind, id: decodeURIComponent(m[2]) }
  return { page: 'list', kind: hash.startsWith('#/bindings') ? 'binding' : 'board' }
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
export const itemHref = (b: Pick<Board, 'id' | 'kind'>) => `#/${b.kind === 'binding' ? 'binding' : 'board'}/${encodeURIComponent(b.id)}`
export const listHref = (kind: Kind) => (kind === 'binding' ? '#/bindings' : '#/')
