import { useMemo } from 'react'
import { money, storeCount, timeAgo } from '../lib/format'
import { itemHref } from '../lib/router'
import type { MarketData } from '../types'
import { BoardImage } from './BoardImage'
import './BindingsHero.css'

/** The bindings page header: a headline, live stats and today's three best binding deals. */
export function BindingsHero({ data }: { data: MarketData }) {
  const top = useMemo(
    () =>
      data.boards
        .filter((b) => b.inStock && b.images.length && b.discount > 0)
        // Deals more than one shop carries first, as on the boards page.
        .sort((a, b) => Number(storeCount(b.listings) > 1) - Number(storeCount(a.listings) > 1) || b.discount - a.discount)
        .slice(0, 3),
    [data.boards],
  )
  const onSale = data.boards.filter((b) => b.discount > 0).length
  const best = Math.max(0, ...data.boards.map((b) => b.discount))
  const stepOn = data.boards.filter((b) => b.specs.entry === 'Step On').length

  return (
    <section className="bhero">
      <div className="bhero-glow" aria-hidden />
      <div className="container bhero-inner">
        <div className="bhero-copy">
          <div className="eyebrow">Binding deals · Australia</div>
          <h1 className="display bhero-title">
            Strap in.
            <br />
            <span className="ice-text">Pay less.</span>
          </h1>
          <p className="bhero-sub">
            Every snowboard binding across {data.stores.length} Australian shops, from strap-ins to Step On, with the
            cheapest shop for your size.
          </p>
          <dl className="bhero-stats">
            <div>
              <dt>Bindings tracked</dt>
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
              <dt>Step On models</dt>
              <dd className="display">{stepOn}</dd>
            </div>
          </dl>
          <p className="bhero-updated">Prices updated {timeAgo(data.updatedAt)}</p>
        </div>

        <div className="bhero-deals">
          {top.map((b, n) => (
            <a key={b.id} href={itemHref(b)} className={`bhero-deal glass ${n === 0 ? 'lead' : ''}`}>
              <div className="bhero-deal-img">
                <BoardImage src={b.images[0]} altSrcs={b.images.slice(1, 4)} alt={`${b.brand} ${b.model}`} width={700} />
              </div>
              <span className="badge-deal bhero-badge">−{b.discount}%</span>
              <div className="bhero-deal-body">
                <div className="bhero-deal-brand">{b.brand}</div>
                <div className="bhero-deal-model">{b.model}</div>
                <div className="bhero-deal-price">
                  <span className="price">{money(b.bestPrice)}</span>
                  <span className="was">{money(b.rrp)}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
