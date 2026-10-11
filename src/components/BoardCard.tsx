import { boardHref } from '../lib/router'
import { GENDER_LABEL, money, storeCount } from '../lib/format'
import type { Board } from '../types'
import { BoardImage } from './BoardImage'
import './BoardCard.css'

interface Props {
  board: Board
  storeNames: Record<string, string>
}

/** Marketplace card: the cut-out board floats on an ice plinth; hover lifts it. */
export function BoardCard({ board, storeNames }: Props) {
  const stores = storeCount(board.listings)
  const storeList = [...new Set(board.listings.map((l) => l.storeId))]

  return (
    <a href={boardHref(board.id)} className="card glass">
      <div className="card-stage">
        <div className="card-glow" />
        <div className="card-plinth" />
        {board.images[0] ? (
          <BoardImage className="card-board" src={board.images[0]} alt={`${board.brand} ${board.model}`} />
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
