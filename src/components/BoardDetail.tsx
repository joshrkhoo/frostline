import { useMemo, useState } from 'react'
import { GENDER_LABEL, money, sized, storeCount } from '../lib/format'
import { LazyBoardStage as BoardStage } from '../three/LazyBoardStage'
import type { BoardView } from '../three/BoardModel'
import type { Board, MarketData, Size } from '../types'
import { BoardCard } from './BoardCard'
import './BoardDetail.css'

/** One label per size across stores: "156cm Wide", "156WIDE", "156W" → "156W". */
const sizeLabel = (s: Size) => (s.cm ? `${s.cm}${s.wide ? 'W' : ''}` : s.label.toUpperCase())

const VIEWS: [BoardView, string][] = [
  ['top', 'Top'],
  ['base', 'Base'],
  ['side', 'Side'],
  ['free', 'Spin'],
]

export function BoardDetail({ board, data }: { board: Board; data: MarketData }) {
  const [view, setView] = useState<BoardView>('free')
  const [size, setSize] = useState<string | null>(null)
  const stores = useMemo(() => Object.fromEntries(data.stores.map((s) => [s.id, s])), [data.stores])
  const storeNames = useMemo(() => Object.fromEntries(data.stores.map((s) => [s.id, s.name])), [data.stores])

  const sizeOptions = useMemo(() => {
    const all = new Map<string, number>()
    for (const l of board.listings) for (const s of l.sizes) if (s.available) all.set(sizeLabel(s), s.cm ?? 0)
    return [...all.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([label]) => label)
  }, [board])

  const offers = useMemo(() => {
    const list = size
      ? board.listings.filter((l) => l.sizes.some((s) => s.available && sizeLabel(s) === size))
      : board.listings
    return [...list].sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price)
  }, [board, size])

  const best = offers.find((o) => o.inStock) ?? offers[0]
  const related = useMemo(
    () =>
      data.boards
        .filter((b) => b.id !== board.id && b.inStock && (b.brand === board.brand || b.specs.terrain.some((t) => board.specs.terrain.includes(t))))
        .sort((a, b) => Number(b.brand === board.brand) - Number(a.brand === board.brand) || b.discount - a.discount)
        .slice(0, 4),
    [data.boards, board],
  )

  const specs: [string, string | undefined][] = [
    ['Profile', board.specs.profile],
    ['Shape', board.specs.shape],
    ['Flex', board.specs.flex],
    ['Level', board.specs.level],
    ['Terrain', board.specs.terrain.join(', ') || undefined],
    ['Season', board.year?.toString()],
  ]

  return (
    <div className="detail container">
      <nav className="crumbs">
        <a href="#/">← Marketplace</a>
        <span>/</span>
        <span>{board.brand}</span>
      </nav>

      <div className="detail-grid">
        <div className="viewer glass">
          <div className="viewer-glow" />
          <BoardStage
            key={board.id}
            className="viewer-stage"
            images={board.images}
            brand={board.brand}
            model={board.model}
            view={view}
            onViewChange={setView}
            autoSpin={view === 'free'}
            cameraZ={3.6}
          />
          <div className="viewer-controls" role="radiogroup" aria-label="Board view">
            {VIEWS.map(([v, label]) => (
              <button key={v} role="radio" aria-checked={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
                {label}
              </button>
            ))}
          </div>
          <p className="viewer-hint">Drag to spin · tap a view to snap</p>
          {board.images.length > 0 && (
            <div className="viewer-photos">
              {board.images.slice(0, 6).map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer" className="viewer-photo">
                  <img src={sized(src, 160)} alt="" loading="lazy" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="info">
          <div className="eyebrow">{board.brand}</div>
          <h1 className="display info-title">{board.model}</h1>
          <div className="info-chips">
            <span className="chip">{GENDER_LABEL[board.gender]}</span>
            {board.category === 'splitboard' && <span className="chip">Splitboard</span>}
            {board.year && <span className="chip">{board.year}</span>}
            <span className="chip">
              {storeCount(board.listings)} store{storeCount(board.listings) > 1 ? 's' : ''}
            </span>
          </div>

          {best && (
            <div className="buy glass">
              <div className="buy-top">
                <div>
                  <div className="buy-label">Best price{size ? ` in ${size}` : ''}</div>
                  <div className="buy-price">
                    <span className="price">{money(best.price)}</span>
                    {best.compareAt && <span className="was">{money(best.compareAt)}</span>}
                    {best.discount > 0 && <span className="badge-deal">−{best.discount}%</span>}
                  </div>
                  <div className="buy-store">
                    at <strong>{stores[best.storeId]?.name}</strong>
                    {best.compareAt && <> · save {money(best.compareAt - best.price)}</>}
                  </div>
                </div>
                <a className="btn btn-gold" href={best.url} target="_blank" rel="noreferrer">
                  Go to deal ↗
                </a>
              </div>
            </div>
          )}

          {sizeOptions.length > 0 && (
            <div className="sizes">
              <div className="sizes-label">Sizes in stock</div>
              <div className="pill-row">
                <button className={`pill ${size === null ? 'on' : ''}`} onClick={() => setSize(null)}>
                  All
                </button>
                {sizeOptions.map((s) => (
                  <button key={s} className={`pill ${size === s ? 'on' : ''}`} onClick={() => setSize(size === s ? null : s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="offers">
            <div className="offers-head">
              <h2 className="display">Compare {offers.length} offer{offers.length === 1 ? '' : 's'}</h2>
            </div>
            {offers.map((o, n) => {
              const st = stores[o.storeId]
              const inSizes = o.sizes.filter((s) => s.available)
              return (
                <a
                  key={`${o.storeId}-${o.productId}`}
                  href={o.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`offer glass ${n === 0 && o.inStock ? 'best' : ''} ${o.inStock ? '' : 'oos'}`}
                >
                  <div className="offer-store">
                    <span className="store-dot big">{st?.name[0]}</span>
                    <div>
                      <div className="offer-name">{st?.name}</div>
                      <div className="offer-sub">
                        {st?.location}
                        {o.year ? ` · ${o.year} model` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="offer-sizes">
                    {o.inStock ? (
                      inSizes.slice(0, 8).map((s) => (
                        <span key={s.label} className={`size ${size && sizeLabel(s) === size ? 'hit' : ''}`}>
                          {sizeLabel(s)}
                        </span>
                      ))
                    ) : (
                      <span className="offer-oos">Sold out</span>
                    )}
                    {inSizes.length > 8 && <span className="size">+{inSizes.length - 8}</span>}
                  </div>
                  <div className="offer-price">
                    {o.discount > 0 && <span className="offer-off">−{o.discount}%</span>}
                    <span className="price">{money(o.price)}</span>
                    {o.compareAt && <span className="was">{money(o.compareAt)}</span>}
                  </div>
                  <span className="offer-go" aria-hidden>
                    ↗
                  </span>
                </a>
              )
            })}
          </div>

          <dl className="specs glass">
            {specs
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>

          {board.description && (
            <div className="about">
              <h3 className="display">About this board</h3>
              <p>{board.description.length > 520 ? `${board.description.slice(0, 520)}…` : board.description}</p>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="related">
          <div className="eyebrow">Keep browsing</div>
          <h2 className="display">More deals like this</h2>
          <div className="grid related-grid">
            {related.map((b) => (
              <BoardCard key={b.id} board={b} storeNames={storeNames} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
