import { modelMask, photoKind } from './cutout'
import { sized } from './format'

/**
 * Turns ordinary product photos into textures for the 3D board.
 *
 * Store photos come in a few shapes: one board per image (top, then base),
 * top + base side by side in one image, or side-profile shots. We find each
 * upright board in the photo by separating it from the plain background,
 * crop it, and record its outline row by row so the 3D mesh can follow the
 * board's real shape and the graphic lands exactly on it.
 */

export interface BoardFace {
  canvas: HTMLCanvasElement
  /** For each row (0 = nose), the board's [left, right] edge as 0..1 of the crop width. */
  edges: Float32Array
  rows: number
  /** Crop width / height. */
  aspect: number
}

export interface BoardArt {
  top: BoardFace
  base: BoardFace | null
  /** True when the art came from real photos rather than the generated fallback. */
  fromPhoto: boolean
}

interface Segment {
  x0: number
  x1: number
  y0: number
  y1: number
}

const LOAD_WIDTH = 1200
const MAX_CROP_HEIGHT = 1600

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`image failed: ${src}`))
    img.src = sized(src, LOAD_WIDTH)
  })
}

function backgroundColour(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const samples: [number, number, number][] = []
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4
    samples.push([d[i], d[i + 1], d[i + 2]])
  }
  for (let k = 0; k < 6; k++) {
    at(2 + k, 2)
    at(w - 3 - k, 2)
    at(2 + k, h - 3)
    at(w - 3 - k, h - 3)
  }
  const median = (c: 0 | 1 | 2) => samples.map((s) => s[c]).sort((a, b) => a - b)[samples.length >> 1]
  return [median(0), median(1), median(2)]
}

/** Foreground mask: anything noticeably different from the backdrop colour. */
function maskOf(d: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const [br, bg, bb] = backgroundColour(d, w, h)
  const mask = new Uint8Array(w * h)
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const dist = Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb)
    mask[p] = d[i + 3] > 20 && dist > 42 ? 1 : 0
  }
  return mask
}

/**
 * Finds upright board shapes in a model mask, left to right, as separate connected shapes so
 * boards photographed close together aren't merged. Each board's pixels are
 * marked in `mask` with its own label (2, 3, …).
 */
function findBoards(mask: Uint8Array, w: number, h: number): (Segment & { label: number })[] {
  const boards: (Segment & { label: number })[] = []
  const stack = new Int32Array(w * h)
  let label = 1
  for (let start = 0; start < w * h; start++) {
    if (mask[start] !== 1) continue
    label++
    let top = 0
    let n = 0
    let x0 = w
    let x1 = -1
    let y0 = h
    let y1 = -1
    mask[start] = label
    stack[top++] = start
    while (top > 0) {
      const p = stack[--top]
      n++
      const x = p % w
      const y = (p - x) / w
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      const visit = (q: number) => {
        if (mask[q] === 1) {
          mask[q] = label
          stack[top++] = q
        }
      }
      if (x > 0) visit(p - 1)
      if (x < w - 1) visit(p + 1)
      if (y > 0) visit(p - w)
      if (y < h - 1) visit(p + w)
    }
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    const ratio = bw / bh
    // Tall, narrow, and mostly solid: an upright board, not a logo or a pair.
    if (bh > h * 0.45 && ratio > 0.1 && ratio < 0.5 && n > bw * bh * 0.5) boards.push({ x0, x1, y0, y1, label })
  }
  return boards.sort((a, b) => a.x0 - b.x0)
}

/** Finds upright boards by their columns, for the noisier colour-based mask. */
function findBoardsByColumns(mask: Uint8Array, w: number, h: number): (Segment & { label: number })[] {
  const cols = new Uint32Array(w)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cols[x] += mask[y * w + x]

  const minCol = Math.max(3, h * 0.04)
  const maxGap = Math.max(2, Math.round(w * 0.012))
  const runs: [number, number][] = []
  let start = -1
  let gap = 0
  for (let x = 0; x <= w; x++) {
    const on = x < w && cols[x] >= minCol
    if (on) {
      if (start < 0) start = x
      gap = 0
    } else if (start >= 0) {
      gap++
      if (gap > maxGap || x === w) {
        runs.push([start, x - gap])
        start = -1
        gap = 0
      }
    }
  }

  const boards: (Segment & { label: number })[] = []
  for (const [x0, x1] of runs) {
    let y0 = -1
    let y1 = -1
    for (let y = 0; y < h; y++) {
      let n = 0
      for (let x = x0; x <= x1; x++) n += mask[y * w + x]
      if (n > 1) {
        if (y0 < 0) y0 = y
        y1 = y
      }
    }
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    const ratio = bw / bh
    if (y0 >= 0 && bh > h * 0.45 && ratio > 0.1 && ratio < 0.5) boards.push({ x0, x1, y0, y1, label: 1 })
  }
  return boards
}


function smooth(edges: Float32Array, rows: number, radius = 3): Float32Array {
  const out = new Float32Array(edges.length)
  for (let r = 0; r < rows; r++) {
    let l = 0
    let rr = 0
    let n = 0
    for (let k = -radius; k <= radius; k++) {
      const q = Math.min(rows - 1, Math.max(0, r + k))
      l += edges[q * 2]
      rr += edges[q * 2 + 1]
      n++
    }
    out[r * 2] = l / n
    out[r * 2 + 1] = rr / n
  }
  return out
}

/** Crops one board out of the photo and records its outline. */
function cropFace(img: HTMLImageElement, src: ImageData, mask: Uint8Array, seg: Segment & { label: number }): BoardFace {
  const w = src.width
  const cw = seg.x1 - seg.x0 + 1
  const ch = seg.y1 - seg.y0 + 1
  const scale = Math.min(1, MAX_CROP_HEIGHT / ch)
  const outW = Math.max(8, Math.round(cw * scale))
  const outH = Math.max(8, Math.round(ch * scale))

  const edges = new Float32Array(ch * 2)
  for (let r = 0; r < ch; r++) {
    const y = seg.y0 + r
    let l = -1
    let rr = -1
    for (let x = seg.x0; x <= seg.x1; x++) {
      if (mask[y * w + x] === seg.label) {
        if (l < 0) l = x
        rr = x
      }
    }
    edges[r * 2] = l < 0 ? 0.5 : (l - seg.x0) / cw
    edges[r * 2 + 1] = rr < 0 ? 0.5 : (rr + 1 - seg.x0) / cw
  }

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!
  const sx = img.naturalWidth / w
  ctx.drawImage(img, seg.x0 * sx, seg.y0 * sx, cw * sx, ch * sx, 0, 0, outW, outH)

  // Bleed edge colours outward so texture filtering never pulls in backdrop.
  const px = ctx.getImageData(0, 0, outW, outH)
  const d = px.data
  for (let y = 0; y < outH; y++) {
    const r = Math.min(ch - 1, Math.floor((y / outH) * ch))
    const l = Math.floor(edges[r * 2] * outW) + 1
    const rr = Math.ceil(edges[r * 2 + 1] * outW) - 2
    if (rr <= l) continue
    for (let x = 0; x < outW; x++) {
      if (x >= l && x <= rr) continue
      const from = (y * outW + (x < l ? l : rr)) * 4
      const to = (y * outW + x) * 4
      d[to] = d[from]
      d[to + 1] = d[from + 1]
      d[to + 2] = d[from + 2]
      d[to + 3] = 255
    }
  }
  // With a model mask, gaps inside the outline (a swallowtail's notch) are
  // cut out rather than showing the backdrop.
  if (seg.label > 1) {
    for (let y = 0; y < outH; y++) {
      const sy = seg.y0 + Math.min(ch - 1, Math.floor((y / outH) * ch))
      for (let x = 0; x < outW; x++) {
        const sx2 = seg.x0 + Math.min(cw - 1, Math.floor((x / outW) * cw))
        const r = sy - seg.y0
        const inSpan = sx2 >= seg.x0 + edges[r * 2] * cw && sx2 < seg.x0 + edges[r * 2 + 1] * cw
        if (inSpan && mask[sy * w + sx2] !== seg.label) d[(y * outW + x) * 4 + 3] = 0
      }
    }
  }
  ctx.putImageData(px, 0, 0)

  return { canvas, edges: smooth(edges, ch), rows: ch, aspect: cw / ch }
}

async function facesFrom(src: string): Promise<BoardFace[]> {
  // Lifestyle shots, close-ups and sideways boards can't give a clean face.
  const kind = await photoKind(src)
  if (kind === 'scene' || kind === 'partial') return []
  const img = await loadImage(src)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, w, h) // throws if the CDN doesn't allow CORS
  // Prefer the segmentation model's mask; fall back to colour distance.
  const model = await modelMask(src, w, h)
  const mask = model ?? maskOf(data.data, w, h)
  return (model ? findBoards(mask, w, h) : findBoardsByColumns(mask, w, h))
    .slice(0, 2)
    .map((seg) => cropFace(img, data, mask, seg))
}

const artCache = new Map<string, Promise<BoardArt>>()

/** Builds top/base art from a board's photos, falling back to generated art. */
export function loadBoardArt(images: string[], label: { brand: string; model: string }): Promise<BoardArt> {
  const key = images.slice(0, 4).join('|') || `${label.brand}:${label.model}`
  if (!artCache.has(key)) artCache.set(key, buildArt(images, label))
  return artCache.get(key)!
}

async function buildArt(images: string[], label: { brand: string; model: string }): Promise<BoardArt> {
  const found: BoardFace[] = []
  for (const src of images.slice(0, 4)) {
    try {
      found.push(...(await facesFrom(src)))
    } catch {
      // Unreadable image (CORS, 404): skip it.
    }
    if (found.length >= 2) break
  }
  if (!found.length) return { top: fallbackFace(label, 'top'), base: fallbackFace(label, 'base'), fromPhoto: false }
  return { top: found[0], base: found[1] ?? null, fromPhoto: true }
}

/** Procedural board outline: superellipse nose/tail with a gentle sidecut. */
export function fallbackHalfWidth(t: number): number {
  // t: 0 at nose → 1 at tail. Returns half width relative to max half width.
  const s = Math.abs(t * 2 - 1) // 0 at waist → 1 at tips
  const contact = 0.82
  if (s <= contact) return 1 - 0.07 * (1 - (s / contact) ** 2)
  const u = (s - contact) / (1 - contact)
  return Math.pow(Math.max(0, 1 - u ** 2.6), 1 / 2.6)
}

function fallbackFace(label: { brand: string; model: string }, side: 'top' | 'base'): BoardFace {
  const W = 256
  const H = 1600
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, H)
  if (side === 'top') {
    g.addColorStop(0, '#0b1a33')
    g.addColorStop(0.5, '#1f6fd1')
    g.addColorStop(1, '#8ae3ff')
  } else {
    g.addColorStop(0, '#111827')
    g.addColorStop(1, '#2a3550')
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = side === 'top' ? 'rgba(255,255,255,0.92)' : '#ffb547'
  ctx.font = '800 120px Unbounded, sans-serif'
  ctx.fillText(label.brand.toUpperCase(), 0, side === 'top' ? -10 : 0)
  if (side === 'top') {
    ctx.font = '600 56px Manrope, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText(label.model, 0, 90)
  }
  ctx.restore()

  const rows = 400
  const edges = new Float32Array(rows * 2)
  for (let r = 0; r < rows; r++) {
    const hw = fallbackHalfWidth(r / (rows - 1)) * 0.5
    edges[r * 2] = 0.5 - hw
    edges[r * 2 + 1] = 0.5 + hw
  }
  return { canvas, edges, rows, aspect: 0.19 }
}
