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
      <svg className="hero-mountains" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden>
        <path d="M0 320 L0 210 L160 120 L260 180 L420 60 L560 170 L700 90 L840 190 L980 70 L1120 160 L1260 100 L1440 190 L1440 320Z" fill="url(#mtn-a)" />
        <path d="M0 320 L0 250 L200 180 L340 240 L520 150 L680 230 L860 160 L1040 240 L1220 170 L1440 240 L1440 320Z" fill="url(#mtn-b)" />
        <defs>
          <linearGradient id="mtn-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a2c4f" stopOpacity="0.7" />
            <stop offset="1" stopColor="#060a13" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mtn-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f1d38" />
            <stop offset="1" stopColor="#060a13" />
          </linearGradient>
        </defs>
      </svg>

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
