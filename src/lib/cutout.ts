import { sized } from './format'

/**
 * Removes the plain studio backdrop from a product photo so the board can sit
 * on the site's own dark stage.
 *
 * Store photos use white, light grey, or a grey box inside white padding, and
 * some PNGs are already transparent. We learn the backdrop colours from the
 * photo's border, then flood-fill inward through connected pixels that match
 * them closely. Matching exact backdrop colours (rather than "anything bright")
 * keeps near-white board graphics intact. If the fill reveals another flat
 * backdrop colour (the grey box), that colour is learned and the fill
 * continues. Finally thin leftover seams are cleaned up and the image is
 * trimmed to the board.
 */

const NEUTRAL = 24 // max channel spread for a backdrop colour (greys, not colours)
const BRIGHT = 150 // min luminance for a backdrop colour
const MATCH = 7 // max per-channel distance from a backdrop colour
const STEP = 10 // max summed change between neighbouring backdrop pixels

type RGB = [number, number, number]

const cache = new Map<string, Promise<string | null>>()

export function cutout(src: string, width = 900): Promise<string | null> {
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

/** Groups colours within MATCH of each other; returns those covering ≥ minShare. */
function dominant(colours: RGB[], minShare: number): RGB[] {
  const groups: { c: RGB; n: number }[] = []
  for (const c of colours) {
    const g = groups.find(
      (x) => Math.abs(x.c[0] - c[0]) <= MATCH && Math.abs(x.c[1] - c[1]) <= MATCH && Math.abs(x.c[2] - c[2]) <= MATCH,
    )
    if (g) g.n++
    else groups.push({ c, n: 1 })
  }
  return groups.filter((g) => g.n >= colours.length * minShare).map((g) => g.c)
}

async function build(url: string): Promise<string | null> {
  const img = await loadImage(url)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const n = w * h
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, w, h)
  const d = data.data

  const transparent = (p: number) => d[p * 4 + 3] < 16
  const flatBright = (p: number) => {
    const i = p * 4
    const max = Math.max(d[i], d[i + 1], d[i + 2])
    const min = Math.min(d[i], d[i + 1], d[i + 2])
    return max - min <= NEUTRAL && (d[i] + d[i + 1] + d[i + 2]) / 3 >= BRIGHT
  }
  const colour = (p: number): RGB => [d[p * 4], d[p * 4 + 1], d[p * 4 + 2]]

  const border: number[] = []
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x)
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1)

  const palette: RGB[] = dominant(
    border.filter((p) => !transparent(p) && flatBright(p)).map(colour),
    0.04,
  )

  const inPalette = (p: number) => {
    const i = p * 4
    for (const c of palette) {
      if (Math.abs(d[i] - c[0]) <= MATCH && Math.abs(d[i + 1] - c[1]) <= MATCH && Math.abs(d[i + 2] - c[2]) <= MATCH)
        return true
    }
    return false
  }
  const isBackdrop = (p: number) => transparent(p) || inPalette(p)

  const seen = new Uint8Array(n)
  const stack = new Int32Array(n)
  let top = 0
  for (const p of border) {
    if (!seen[p] && isBackdrop(p)) {
      seen[p] = 1
      stack[top++] = p
    }
  }

  const visit = (p: number, q: number) => {
    if (seen[q] || !isBackdrop(q)) return
    if (!transparent(p) && !transparent(q)) {
      const a = p * 4
      const b = q * 4
      if (Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2]) > STEP) return
    }
    seen[q] = 1
    stack[top++] = q
  }
  const fill = () => {
    while (top > 0) {
      const p = stack[--top]
      const x = p % w
      if (x > 0) visit(p, p - 1)
      if (x < w - 1) visit(p, p + 1)
      if (p >= w) visit(p, p - w)
      if (p < n - w) visit(p, p + w)
    }
  }
  fill()

  // A grey box inside white padding: if what's left is bounded by a flat
  // rectangle of one bright colour, that box is backdrop too. A board's own
  // outline (rounded tips, gaps between boards) never fills its bounding box
  // edges like that, so white boards aren't mistaken for a box.
  for (let round = 0; round < 2; round++) {
    let bx0 = w
    let by0 = h
    let bx1 = -1
    let by1 = -1
    for (let p = 0; p < n; p++) {
      if (seen[p]) continue
      const x = p % w
      const y = (p - x) / w
      if (x < bx0) bx0 = x
      if (x > bx1) bx1 = x
      if (y < by0) by0 = y
      if (y > by1) by1 = y
    }
    if (bx1 < 0) break
    // Sample just inside the box edge, past any anti-aliased seam.
    const inset = 3
    const ring: number[] = []
    for (let x = bx0 + inset; x <= bx1 - inset; x++) ring.push((by0 + inset) * w + x, (by1 - inset) * w + x)
    for (let y = by0 + inset; y <= by1 - inset; y++) ring.push(y * w + bx0 + inset, y * w + bx1 - inset)
    if (ring.length < 40) break
    const box = dominant(ring.filter(flatBright).map(colour), 0.6)
    if (!box.length) break
    palette.push(...box)
    // Everything between the old fill and the box edge (the seam) goes too.
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        if (x - bx0 > inset && bx1 - x > inset && y - by0 > inset && by1 - y > inset) continue
        const p = y * w + x
        if (!seen[p]) {
          seen[p] = 1
          stack[top++] = p
        }
      }
    }
    fill()
  }

  // Erase 1–2px seams left between backdrop regions.
  for (let pass = 0; pass < 2; pass++) {
    const clear: number[] = []
    for (let p = 0; p < n; p++) {
      if (seen[p]) continue
      const x = p % w
      const around =
        (x > 0 ? seen[p - 1] : 1) + (x < w - 1 ? seen[p + 1] : 1) + (p >= w ? seen[p - w] : 1) + (p < n - w ? seen[p + w] : 1)
      if (around >= 3) clear.push(p)
    }
    for (const p of clear) seen[p] = 1
  }

  // Within 2px of the backdrop, keep the photo's own anti-aliasing: opacity
  // follows how far the pixel's colour is from the backdrop, and the backdrop
  // tint blended into it is removed so edges don't glow white on dark.
  const nearBackdrop = (p: number, x: number, y: number) => {
    for (let k = 1; k <= 2; k++) {
      if ((x >= k && seen[p - k]) || (x < w - k && seen[p + k]) || (y >= k && seen[p - k * w]) || (y < h - k && seen[p + k * w]))
        return true
    }
    return false
  }
  const feather = (i: number) => {
    if (!palette.length) return
    let best = palette[0]
    let bestD = 999
    for (const c of palette) {
      const dd = Math.max(Math.abs(d[i] - c[0]), Math.abs(d[i + 1] - c[1]), Math.abs(d[i + 2] - c[2]))
      if (dd < bestD) {
        bestD = dd
        best = c
      }
    }
    const a = Math.min(1, Math.max(0, (bestD - MATCH) / 48))
    if (a >= 1) return
    if (a <= 0.02) {
      d[i + 3] = 0
      return
    }
    for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, Math.max(0, (d[i + k] - best[k] * (1 - a)) / a))
    d[i + 3] = Math.round(Math.min(d[i + 3], a * 255))
  }

  // Clear the backdrop, feather the edges, and find the subject's bounds.
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  let removed = 0
  for (let p = 0; p < n; p++) {
    const i = p * 4
    if (seen[p]) {
      d[i + 3] = 0
      removed++
      continue
    }
    const x = p % w
    const y = (p - x) / w
    if (nearBackdrop(p, x, y)) feather(i)
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  // Nothing (or almost nothing) removed means a real scene behind the board.
  if (x1 < 0 || removed < n * 0.05) return null
  // Too little left inside the bounds means a white board on a white backdrop
  // got eaten: better to show the original photo than fragments.
  let kept = 0
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) kept += seen[y * w + x] ? 0 : 1
  if (kept < (x1 - x0 + 1) * (y1 - y0 + 1) * 0.55) return null

  ctx.putImageData(data, 0, 0)
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d')!.drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/webp', 0.9))
  return blob ? URL.createObjectURL(blob) : null
}
