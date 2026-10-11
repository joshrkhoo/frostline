import { useEffect, useRef, useState } from 'react'
import { cutout } from '../lib/cutout'
import { sized } from '../lib/format'
import './BoardImage.css'

interface Props {
  src: string
  alt: string
  width?: number
  className?: string
}

/**
 * A board photo with its studio backdrop removed, processed once it scrolls
 * into view. Falls back to the original photo on a light tile if the
 * backdrop can't be separated.
 */
export function BoardImage({ src, alt, width = 480, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<{ url: string | null; done: boolean }>({ url: null, done: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let live = true
    setState({ url: null, done: false })
    cutout(src, width).then((url) => live && setState({ url, done: true }))
    return () => {
      live = false
    }
  }, [visible, src, width])

  return (
    <div ref={ref} className={`board-img ${className}`}>
      {state.done &&
        (state.url ? (
          <img className="board-img-cut" src={state.url} alt={alt} />
        ) : (
          <img className="board-img-raw" src={sized(src, width)} alt={alt} />
        ))}
      {!state.done && <div className="board-img-loading" aria-hidden />}
    </div>
  )
}
