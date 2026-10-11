import { sized } from './format'

/**
 * Removes the plain studio backdrop from a product photo so the board can sit
 * on the site's own dark stage. Store photos use white, light grey or
 * grey-on-white boxes. We flood-fill inward from the image border through
 * near-neutral, bright pixels, so white graphics inside a board survive as
 * long as the board has an edge, and then trim to what's left.
 */

const BRIGHT = 165 // min luminance treated as backdrop
const NEUTRAL = 22 // max channel spread treated as backdrop (greys, not colours)
const STEP = 14 // max change between neighbouring backdrop pixels

const cache = new Map<string, Promise<string | null>>()

export function cutout(src: string, width = 480): Promise<string | null> {
  const key = `${src}@${width}`
  if (!cache.has(key)) cache.set(key, build(sized(src, width)).catch(() => null))
  return cache.get(key)!
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

async function build(url: string): Promise<string | null> {
  const img = await loadImage(url)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, w, h)
  const d = data.data

  const isBackdrop = (i: number) => {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    return max - min <= NEUTRAL && (r + g + b) / 3 >= BRIGHT
  }

  // Flood fill from every border pixel that looks like backdrop.
  const n = w * h
  const seen = new Uint8Array(n)
  const stack = new Int32Array(n)
  let top = 0
  const seed = (p: number) => {
    if (!seen[p] && isBackdrop(p * 4)) {
      seen[p] = 1
      stack[top++] = p
    }
  }
  for (let x = 0; x < w; x++) {
    seed(x)
    seed((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    seed(y * w)
    seed(y * w + w - 1)
  }
  const maxStep = STEP * 3
  const visit = (p: number, q: number) => {
    if (seen[q]) return
    const a = p * 4
    const b = q * 4
    if (!isBackdrop(b)) return
    if (Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2]) > maxStep) return
    seen[q] = 1
    stack[top++] = q
  }
  while (top > 0) {
    const p = stack[--top]
    const x = p % w
    if (x > 0) visit(p, p - 1)
    if (x < w - 1) visit(p, p + 1)
    if (p >= w) visit(p, p - w)
    if (p < n - w) visit(p, p + w)
  }

  // Clear the backdrop, soften the 1px fringe, and find the subject's bounds.
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let p = 0; p < n; p++) {
    const i = p * 4
    if (seen[p]) {
      d[i + 3] = 0
      continue
    }
    const x = p % w
    const y = (p - x) / w
    const edge =
      (x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || (y > 0 && seen[p - w]) || (y < h - 1 && seen[p + w])
    if (edge) d[i + 3] = 150
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  if (x1 < 0) return null
  // Nothing removed (photo with a real scene behind it): don't pretend.
  if (x0 === 0 && y0 === 0 && x1 === w - 1 && y1 === h - 1) return null

  ctx.putImageData(data, 0, 0)
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d')!.drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/webp', 0.9))
  return blob ? URL.createObjectURL(blob) : null
}
