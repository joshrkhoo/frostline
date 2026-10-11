import { useEffect, useState } from 'react'
import type { MarketData } from '../types'

let cache: Promise<MarketData> | null = null

export function loadMarket(): Promise<MarketData> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/boards.json`).then((r) => {
    if (!r.ok) throw new Error(`Failed to load board data (${r.status})`)
    return r.json() as Promise<MarketData>
  })
  return cache
}

export function useMarket() {
  const [data, setData] = useState<MarketData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadMarket().then(setData, (e: Error) => setError(e.message))
  }, [])
  return { data, error }
}
