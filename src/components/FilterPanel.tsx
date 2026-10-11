import { useState } from 'react'
import { DEFAULT_FILTERS, activeFilterCount, type Filters } from '../lib/filters'
import { GENDER_LABEL } from '../lib/format'
import type { Gender, Store } from '../types'
import './FilterPanel.css'

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  facets: {
    brands: [string, number][]
    profiles: [string, number][]
    terrain: [string, number][]
    genders: [Gender, number][]
  }
  stores: Store[]
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

const DISCOUNTS = [0, 10, 20, 30, 40]
const SIZES = [140, 145, 148, 150, 152, 154, 156, 158, 160, 162]

function Section({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="fp-section" open={open}>
      <summary>{title}</summary>
      <div className="fp-body">{children}</div>
    </details>
  )
}

export function FilterPanel({ filters: f, onChange, facets, stores }: Props) {
  const [showAllBrands, setShowAllBrands] = useState(false)
  const set = (patch: Partial<Filters>) => onChange({ ...f, ...patch })
  const brands = showAllBrands ? facets.brands : facets.brands.slice(0, 10)
  const active = activeFilterCount(f)

  return (
    <aside className="fp glass">
      <div className="fp-head">
        <span className="display">Filters</span>
        {active > 0 && (
          <button className="fp-reset" onClick={() => onChange({ ...DEFAULT_FILTERS, query: f.query, sort: f.sort })}>
            Clear {active}
          </button>
        )}
      </div>

      <div className="fp-toggles">
        <label className="switch">
          <input type="checkbox" checked={f.inStockOnly} onChange={(e) => set({ inStockOnly: e.target.checked })} />
          <span />
          In stock only
        </label>
        <label className="switch">
          <input type="checkbox" checked={f.splitboards} onChange={(e) => set({ splitboards: e.target.checked })} />
          <span />
          Include splitboards
        </label>
      </div>

      <Section title="Deal size">
        <div className="pill-row">
          {DISCOUNTS.map((d) => (
            <button key={d} className={`pill ${f.minDiscount === d ? 'on' : ''}`} onClick={() => set({ minDiscount: d })}>
              {d === 0 ? 'Any' : `${d}%+`}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Price (AUD)">
        <div className="price-row">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            value={f.minPrice ?? ''}
            onChange={(e) => set({ minPrice: e.target.value ? Number(e.target.value) : null })}
          />
          <span>–</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Max"
            value={f.maxPrice ?? ''}
            onChange={(e) => set({ maxPrice: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </Section>

      <Section title="Rider">
        <div className="pill-row">
          {facets.genders.map(([g, n]) => (
            <button key={g} className={`pill ${f.genders.includes(g) ? 'on' : ''}`} onClick={() => set({ genders: toggle(f.genders, g) })}>
              {GENDER_LABEL[g]} <small>{n}</small>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Size (cm)">
        <div className="pill-row">
          {SIZES.map((s) => (
            <button key={s} className={`pill ${f.size === s ? 'on' : ''}`} onClick={() => set({ size: f.size === s ? null : s })}>
              {s}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Terrain">
        <div className="pill-row">
          {facets.terrain.map(([t, n]) => (
            <button key={t} className={`pill ${f.terrain.includes(t) ? 'on' : ''}`} onClick={() => set({ terrain: toggle(f.terrain, t) })}>
              {t} <small>{n}</small>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Profile">
        <div className="pill-row">
          {facets.profiles.map(([p, n]) => (
            <button key={p} className={`pill ${f.profiles.includes(p) ? 'on' : ''}`} onClick={() => set({ profiles: toggle(f.profiles, p) })}>
              {p} <small>{n}</small>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Brand">
        <div className="check-list">
          {brands.map(([b, n]) => (
            <label key={b} className="check">
              <input type="checkbox" checked={f.brands.includes(b)} onChange={() => set({ brands: toggle(f.brands, b) })} />
              <span className="box" />
              <span className="check-label">{b}</span>
              <small>{n}</small>
            </label>
          ))}
        </div>
        {facets.brands.length > 10 && (
          <button className="fp-more" onClick={() => setShowAllBrands((v) => !v)}>
            {showAllBrands ? 'Show fewer' : `Show all ${facets.brands.length} brands`}
          </button>
        )}
      </Section>

      <Section title="Store" open={false}>
        <div className="check-list">
          {stores.map((s) => (
            <label key={s.id} className="check">
              <input type="checkbox" checked={f.stores.includes(s.id)} onChange={() => set({ stores: toggle(f.stores, s.id) })} />
              <span className="box" />
              <span className="check-label">{s.name}</span>
              <small>{s.boards}</small>
            </label>
          ))}
        </div>
      </Section>
    </aside>
  )
}
