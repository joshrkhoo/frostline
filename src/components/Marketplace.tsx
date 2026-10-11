import { useEffect, useMemo, useState } from 'react'
import { applyFilters, facetCounts, activeFilterCount, type Filters, type SortKey } from '../lib/filters'
import type { MarketData } from '../types'
import { BoardCard } from './BoardCard'
import { FilterPanel } from './FilterPanel'
import './Marketplace.css'

interface Props {
  data: MarketData
  filters: Filters
  onFilters: (f: Filters) => void
}

const PAGE = 24

const SORTS: [SortKey, string][] = [
  ['deal', 'Biggest discount'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['stores', 'Most stores'],
  ['name', 'Name A–Z'],
]

export function Marketplace({ data, filters, onFilters }: Props) {
  const [limit, setLimit] = useState(PAGE)
  const [panelOpen, setPanelOpen] = useState(false)
  const results = useMemo(() => applyFilters(data.boards, filters), [data.boards, filters])
  const facets = useMemo(() => facetCounts(data.boards), [data.boards])
  const storeNames = useMemo(() => Object.fromEntries(data.stores.map((s) => [s.id, s.name])), [data.stores])

  useEffect(() => setLimit(PAGE), [filters])

  const active = activeFilterCount(filters)

  return (
    <section id="market" className="market container">
      <div className="market-head">
        <div>
          <div className="eyebrow">Marketplace</div>
          <h2 className="display market-title">
            {filters.query ? (
              <>
                Results for <span className="ice-text">“{filters.query}”</span>
              </>
            ) : (
              'All snowboards'
            )}
          </h2>
          <p className="market-count">
            {results.length} board{results.length === 1 ? '' : 's'} · {results.filter((b) => b.discount > 0).length} on sale
          </p>
        </div>
        <div className="market-tools">
          <button className="btn market-filter-btn" onClick={() => setPanelOpen((v) => !v)}>
            Filters{active ? ` · ${active}` : ''}
          </button>
          <label className="sort glass">
            <span>Sort</span>
            <select value={filters.sort} onChange={(e) => onFilters({ ...filters, sort: e.target.value as SortKey })}>
              {SORTS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="market-body">
        <div className={`market-side ${panelOpen ? 'open' : ''}`}>
          <FilterPanel filters={filters} onChange={onFilters} facets={facets} stores={data.stores} />
        </div>

        <div>
          {results.length === 0 ? (
            <div className="market-empty glass">
              <div className="display">No boards match</div>
              <p>Try a different search or loosen the filters.</p>
            </div>
          ) : (
            <div className="grid">
              {results.slice(0, limit).map((b) => (
                <BoardCard key={b.id} board={b} storeNames={storeNames} />
              ))}
            </div>
          )}
          {results.length > limit && (
            <div className="market-more">
              <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>
                Load more boards <span className="market-more-n">{results.length - limit} left</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
