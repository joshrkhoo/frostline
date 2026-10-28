import { useEffect, useState } from 'react'
import type { Kind, MarketData } from '../types'

const FILES: Record<Kind, string> = { board: 'boards.json', binding: 'bindings.json' }
const cache: Partial<Record<Kind, Promise<MarketData>>> = {}

/** Each kind has its own file, so the snowboard pages never download the bindings. */
export function loadMarket(kind: Kind = 'board'): Promise<MarketData> {
  cache[kind] ??= fetch(`${import.meta.env.BASE_URL}data/${FILES[kind]}`).then((r) => {
    if (!r.ok) throw new Error(`Failed to load ${kind} data (${r.status})`)
    return r.json().then((d: MarketData) => ({
      ...d,
      // Files written before bindings existed lack these fields.
      boards: d.boards.map((b) => ({ ...b, kind, fits: b.fits ?? [] })),
    }))
  })
  return cache[kind]
}

export function useMarket(kind: Kind = 'board') {
  const [state, setState] = useState<{ kind: Kind; data: MarketData | null; error: string | null }>({ kind, data: null, error: null })
  useEffect(() => {
    let live = true
    loadMarket(kind).then(
      (data) => live && setState({ kind, data, error: null }),
      (e: Error) => live && setState({ kind, data: null, error: e.message }),
    )
    return () => {
      live = false
    }
  }, [kind])
  // Never hand back the other kind's data while switching.
  return state.kind === kind ? { data: state.data, error: state.error } : { data: null, error: null }
}
