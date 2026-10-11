import type { Board, Gender } from '../types'
import { storeCount } from './format'

export type SortKey = 'deal' | 'price-asc' | 'price-desc' | 'stores' | 'name'

export interface Filters {
  query: string
  brands: string[]
  genders: Gender[]
  profiles: string[]
  terrain: string[]
  stores: string[]
  minPrice: number | null
  maxPrice: number | null
  minDiscount: number
  size: number | null
  splitboards: boolean
  sort: SortKey
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  brands: [],
  genders: [],
  profiles: [],
  terrain: [],
  stores: [],
  minPrice: null,
  maxPrice: null,
  minDiscount: 0,
  size: null,
  splitboards: true,
  sort: 'deal',
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, '')

/** Every search token must appear somewhere in the board's searchable text. */
function matchesQuery(b: Board, query: string): boolean {
  const tokens = norm(query).split(/\s+/).filter(Boolean)
  if (!tokens.length) return true
  const hay = norm(
    [b.brand, b.model, b.year, b.gender, b.category, b.specs.profile, b.specs.shape, ...b.specs.terrain].join(' '),
  )
  const compact = hay.replace(/\s+/g, '')
  return tokens.every((t) => hay.includes(t) || compact.includes(t))
}

export function applyFilters(boards: Board[], f: Filters): Board[] {
  const out = boards.filter((b) => {
    if (!f.splitboards && b.category === 'splitboard') return false
    if (f.brands.length && !f.brands.includes(b.brand)) return false
    if (f.genders.length && !f.genders.includes(b.gender)) return false
    if (f.profiles.length && !(b.specs.profile && f.profiles.includes(b.specs.profile))) return false
    if (f.terrain.length && !b.specs.terrain.some((t) => f.terrain.includes(t))) return false
    if (f.stores.length && !b.listings.some((l) => f.stores.includes(l.storeId))) return false
    if (f.minPrice !== null && b.bestPrice < f.minPrice) return false
    if (f.maxPrice !== null && b.bestPrice > f.maxPrice) return false
    if (b.discount < f.minDiscount) return false
    if (f.size !== null && !b.sizes.some((s) => Math.abs(s - f.size!) <= 1)) return false
    return matchesQuery(b, f.query)
  })

  const sorters: Record<SortKey, (a: Board, b: Board) => number> = {
    deal: (a, b) => b.discount - a.discount || a.bestPrice - b.bestPrice,
    'price-asc': (a, b) => a.bestPrice - b.bestPrice,
    'price-desc': (a, b) => b.bestPrice - a.bestPrice,
    stores: (a, b) => storeCount(b.listings) - storeCount(a.listings) || b.discount - a.discount,
    name: (a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`),
  }
  return out.sort(sorters[f.sort])
}

/** Option lists (with counts) for the sidebar, derived from the data. */
export function facetCounts(boards: Board[]) {
  const count = (values: (string | undefined)[]) => {
    const m = new Map<string, number>()
    for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  return {
    brands: count(boards.map((b) => b.brand)),
    profiles: count(boards.map((b) => b.specs.profile)),
    terrain: count(boards.flatMap((b) => b.specs.terrain)),
    genders: count(boards.map((b) => b.gender)) as [Gender, number][],
  }
}

export function activeFilterCount(f: Filters): number {
  return (
    f.brands.length +
    f.genders.length +
    f.profiles.length +
    f.terrain.length +
    f.stores.length +
    (f.minPrice !== null ? 1 : 0) +
    (f.maxPrice !== null ? 1 : 0) +
    (f.minDiscount > 0 ? 1 : 0) +
    (f.size !== null ? 1 : 0)
  )
}
