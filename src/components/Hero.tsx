import { useMemo, useState } from 'react'
import { boardHref } from '../lib/router'
import { money, sizeLabel, storeCount, timeAgo } from '../lib/format'
import { LazyBoardStage as BoardStage } from '../three/LazyBoardStage'
import type { MarketData } from '../types'
import { BoardImage } from './BoardImage'
import './Hero.css'

const FEATURED = 5

export function Hero({ data }: { data: MarketData }) {
  // Headline deals: real markdowns on boards that several stores carry.
  const featured = useMemo(
    () =>
      data.boards
        .filter((b) => b.inStock && b.images.length && storeCount(b.listings) >= 2 && b.discount >= 15)
        .sort((a, b) => b.discount - a.discount)
        .slice(0, FEATURED),
    [data.boards],
  )
  const [i, setI] = useState(0)
  const board = featured[i] ?? data.boards[0]
  // Listings are sorted cheapest in-stock first, so [0] is the deal shown.
  const deal = board.listings[0]
  const dealSizes = deal ? deal.sizes.filter((s) => s.available).map(sizeLabel) : []
  const dealStore = data.stores.find((s) => s.id === deal?.storeId)?.name
  const onSale = data.boards.filter((b) => b.discount > 0).length
  const best = Math.max(...data.boards.map((b) => b.discount))

  return (
    <section className="hero">
      <div className="hero-backdrop" aria-hidden>
        <img
          className="hero-photo"
          src="/hero/powder-2400.webp"
          srcSet="/hero/powder-1200.webp 1200w, /hero/powder-2400.webp 2400w"
          sizes="100vw"
          alt=""
          fetchPriority="high"
        />
        <div className="hero-grade" />
        <div className="hero-grid" />
      </div>

      <div className="container hero-inner">
        <div className="hero-copy">
          <div className="eyebrow">Snowboard deals · Australia</div>
          <h1 className="display hero-title">
            Find the board.
            <br />
            <span className="ice-text">Then find the deal.</span>
          </h1>
          <p className="hero-sub">
            Frostline tracks every snowboard across {data.stores.length} Australian shops. Pick a board, spin it in
            3D, and see who's selling it for the least.
          </p>
          <div className="hero-ctas">
            <button
              className="btn btn-primary"
              onClick={() => document.getElementById('market')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Browse {data.boards.length} boards
            </button>
            <a href={boardHref(board.id)} className="btn">
              Today's top deal →
            </a>
          </div>

          <dl className="hero-stats">
            <div>
              <dt>Boards tracked</dt>
              <dd className="display">{data.boards.length}</dd>
            </div>
            <div>
              <dt>On sale now</dt>
              <dd className="display">{onSale}</dd>
            </div>
            <div>
              <dt>Biggest drop</dt>
              <dd className="display gold-text">−{best}%</dd>
            </div>
            <div>
              <dt>Prices updated</dt>
              <dd className="display">{timeAgo(data.updatedAt)}</dd>
            </div>
          </dl>
        </div>
        <div className="hero-credit">Carving powder · Ebbetts Pass, CA</div>

        <div className="hero-showcase">
          <div className="hero-aura" />
          <BoardStage
            key={board.id}
            className="hero-stage"
            images={board.images}
            brand={board.brand}
            model={board.model}
            autoSpin
            cameraZ={3.5}
            profile={board.specs.profile}
          />
          <div className="hero-drag chip">⟲ Drag to spin</div>

          <a href={boardHref(board.id)} className="hero-item glass">
            <div>
              <div className="hero-item-brand">{board.brand}</div>
              <div className="hero-item-name display">{board.model}</div>
              <div className="hero-item-stores">
                at {dealStore} · best of {storeCount(board.listings)} stores
              </div>
              {dealSizes.length > 0 && (
                <div className="hero-item-sizes" aria-label="Sizes available at this price">
                  {dealSizes.slice(0, 7).map((s) => (
                    <span key={s} className="size">
                      {s}
                    </span>
                  ))}
                  {dealSizes.length > 7 && <span className="size">+{dealSizes.length - 7}</span>}
                </div>
              )}
            </div>
            <div className="hero-item-price">
              {board.discount > 0 && <span className="badge-deal">−{board.discount}%</span>}
              <span className="price">{money(board.bestPrice)}</span>
              {board.rrp > board.bestPrice && <span className="was">{money(board.rrp)}</span>}
            </div>
          </a>

          {featured.length > 1 && (
            <div className="hero-picker" role="tablist" aria-label="Featured deals">
              {featured.map((b, n) => (
                <button
                  key={b.id}
                  role="tab"
                  aria-selected={n === i}
                  className={`hero-thumb ${n === i ? 'on' : ''}`}
                  onClick={() => setI(n)}
                  title={`${b.brand} ${b.model}`}
                >
                  <BoardImage src={b.images[0]} altSrcs={b.images.slice(1, 5)} alt="" width={400} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
