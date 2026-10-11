import { useEffect, useRef, useState } from 'react'
import { cutout } from '../lib/cutout'
import { sized } from '../lib/format'
import './BoardImage.css'

interface Props {
  src: string
  alt: string
  width?: number
  className?: string
  /** Other photos to try for the hover view (base, another angle…). */
  altSrcs?: string[]
  /** Show the alternate photo (when one was found). */
  showAlt?: boolean
}

/**
 * Finds the first alternate photo that is a studio product shot. Lifestyle
 * photos (a rider on a mountain) have no plain backdrop to remove, so their
 * cut-out fails and they're skipped.
 */
async function firstProductShot(srcs: string[], width: number): Promise<string | null> {
  for (const s of srcs) {
    const url = await cutout(s, width)
    if (url) return url
  }
  return null
}

/**
 * A board photo with its studio backdrop removed, processed once it scrolls
 * into view. Falls back to the original photo on a light tile if the
 * backdrop can't be separated.
 */
export function BoardImage({ src, alt, width = 900, className = '', altSrcs = [], showAlt = false }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<{ url: string | null; done: boolean }>({ url: null, done: false })
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
    setState({ url: null, done: false })
    cutout(src, width).then((url) => live && setState({ url, done: true }))
    return () => {
      live = false
    }
  }, [visible, src, width])

  // Only look for the alternate photo once someone hovers.
  useEffect(() => {
    if (!showAlt || altUrl || !altKey) return
    let live = true
    firstProductShot(altKey.split('|'), width).then((url) => live && setAltUrl(url))
    return () => {
      live = false
    }
  }, [showAlt, altUrl, altKey, width])

  const flipped = showAlt && !!altUrl && !!state.url

  return (
    <div ref={ref} className={`board-img ${flipped ? 'flipped' : ''} ${className}`}>
      {state.done &&
        (state.url ? (
          <img className="board-img-cut front" src={state.url} alt={alt} />
        ) : (
          <img className="board-img-raw" src={sized(src, width)} alt={alt} />
        ))}
      {altUrl && state.url && <img className="board-img-cut back" src={altUrl} alt="" aria-hidden />}
      {!state.done && <div className="board-img-loading" aria-hidden />}
    </div>
  )
}
