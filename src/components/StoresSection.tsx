import type { MarketData } from '../types'
import { timeAgo } from '../lib/format'
import './StoresSection.css'

interface Props {
  data: MarketData
  onPickStore: (id: string) => void
}

export function StoresSection({ data, onPickStore }: Props) {
  return (
    <section className="stores container" id="stores">
      <div className="eyebrow">Where the prices come from</div>
      <h2 className="display stores-title">Tracked stores</h2>
      <p className="stores-sub">
        Prices are pulled straight from each shop's public catalogue. Last refresh {timeAgo(data.updatedAt)}.
      </p>
      <div className="stores-grid">
        {data.stores.map((s) => (
          <button key={s.id} className="store glass" onClick={() => onPickStore(s.id)} disabled={!s.ok}>
            <span className="store-dot big">{s.name[0]}</span>
            <span className="store-text">
              <span className="store-name">{s.name}</span>
              <span className="store-loc">
                {s.location} · {s.domain}
              </span>
            </span>
            <span className="store-count">
              <strong className="display">{s.boards}</strong>
              <small>boards</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span className="display">FROSTLINE</span>
        <span>
          Prices and stock come from each retailer and can change at any time. Always check the store before buying.
        </span>
      </div>
    </footer>
  )
}
