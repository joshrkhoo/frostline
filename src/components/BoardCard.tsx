import { useRef, useState } from 'react'
import { boardHref } from '../lib/router'
import { GENDER_LABEL, money, sized, storeCount } from '../lib/format'
import type { Board } from '../types'
import './BoardCard.css'

interface Props {
  board: Board
  storeNames: Record<string, string>
}

/**
 * Marketplace card. Hovering tilts the board toward the cursor and flips to
 * the second photo (usually the base); clicking opens the 3D viewer.
 */
export function BoardCard({ board, storeNames }: Props) {
  const ref = useRef<HTMLAnchorElement>(null)
  const [hover, setHover] = useState(false)
  const stores = storeCount(board.listings)
  const front = board.images[0]
  const back = board.images[1]

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`)
    el.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`)
    el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`)
  }
  const onLeave = () => {
    setHover(false)
    ref.current?.style.setProperty('--rx', '0deg')
    ref.current?.style.setProperty('--ry', '0deg')
  }

  const storeList = [...new Set(board.listings.map((l) => l.storeId))]

  return (
    <a
      ref={ref}
      href={boardHref(board.id)}
      className={`card glass ${hover ? 'is-hover' : ''}`}
      onPointerEnter={() => setHover(true)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div className="card-stage">
        <div className="card-glow" />
        <div className="card-plinth" />
        {front ? (
          <div className="card-flip">
            <img className="card-img front" src={sized(front, 520)} alt={`${board.brand} ${board.model}`} loading="lazy" />
            {back && <img className="card-img back" src={sized(back, 520)} alt="" loading="lazy" aria-hidden />}
          </div>
        ) : (
          <div className="card-noimg display">{board.brand}</div>
        )}
        {board.discount > 0 && <span className="badge-deal card-badge">−{board.discount}%</span>}
        <span className="card-spin chip">⟳ View in 3D</span>
      </div>

      <div className="card-body">
        <div className="card-meta">
          <span>{board.brand}</span>
          <span>
            {GENDER_LABEL[board.gender]}
            {board.year ? ` · ${board.year}` : ''}
          </span>
        </div>
        <h3 className="card-title">{board.model}</h3>

        <div className="card-foot">
          <div>
            <div className="card-from">{stores > 1 ? `Best of ${stores} stores` : storeNames[storeList[0]]}</div>
            <div className="card-price">
              <span className="price">{money(board.bestPrice)}</span>
              {board.rrp > board.bestPrice && <span className="was">{money(board.rrp)}</span>}
            </div>
          </div>
          <div className="card-stores" aria-label={`${stores} stores`}>
            {storeList.slice(0, 4).map((id) => (
              <span key={id} className="store-dot" title={storeNames[id]}>
                {storeNames[id]?.[0]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </a>
  )
}
