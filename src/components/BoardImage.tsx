import { useEffect, useRef, useState } from 'react'
import { bestCutout, cutout, isFullShot } from '../lib/cutout'
import { sized } from '../lib/format'
import './BoardImage.css'

interface Props {
  src: string
  alt: string
  width?: number
  className?: string
  /** Other photos of the board: a fallback if the main one is a close-up, and the hover view. */
  altSrcs?: string[]
  /** Show the alternate photo (when one was found). */
  showAlt?: boolean
}

/**
 * Finds the first alternate photo that is a studio shot of the whole board.
 * Lifestyle photos (a rider on a mountain) and close-ups are skipped.
 */
async function firstProductShot(srcs: string[], width: number): Promise<string | null> {
  for (const s of srcs) {
    if (!(await isFullShot(s))) continue
    const url = await cutout(s, width)
    if (url) return url
  }
  return null
}

/**
 * A board photo with its studio backdrop removed, processed once it scrolls
 * into view. If the main photo is a close-up, the first full-board photo
 * among the alternates is shown instead. Falls back to the original photo if
 * the backdrop can't be separated.
 */
export function BoardImage({ src, alt, width = 1200, className = '', altSrcs = [], showAlt = false }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<{ src: string; url: string | null; done: boolean }>({ src, url: null, done: false })
  const [altUrl, setAltUrl] = useState<string | null>(null)
  const altKey = altSrcs.join('|')

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
    setState({ src, url: null, done: false })
    const srcs = [src, ...(altKey ? altKey.split('|') : [])]
    bestCutout(srcs, width).then((r) => live && setState({ ...r, done: true }))
    return () => {
      live = false
    }
  }, [visible, src, altKey, width])

  // Only look for the alternate photo once someone hovers.
  useEffect(() => {
    if (!showAlt || altUrl || !altKey || !state.done) return
    let live = true
    const rest = altKey.split('|').filter((s) => s !== state.src)
    firstProductShot(rest, width).then((url) => live && setAltUrl(url))
    return () => {
      live = false
    }
  }, [showAlt, altUrl, altKey, width, state.done, state.src])

  const flipped = showAlt && !!altUrl && !!state.url

  return (
    <div ref={ref} className={`board-img ${flipped ? 'flipped' : ''} ${className}`}>
      {state.done &&
        (state.url ? (
          <img className="board-img-cut front" src={state.url} alt={alt} />
        ) : (
          <img className="board-img-raw" src={sized(state.src, width)} alt={alt} />
        ))}
      {altUrl && state.url && <img className="board-img-cut back" src={altUrl} alt="" aria-hidden />}
      {!state.done && <div className="board-img-loading" aria-hidden />}
    </div>
  )
}
