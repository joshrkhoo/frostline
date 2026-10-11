import * as THREE from 'three'
import type { BoardFace } from '../lib/boardArt'

export const BOARD_LENGTH = 1.6
const THICKNESS = 0.014
const ROWS = 180
const COLS = 18
const ROCKER_LIFT = 0.07
const ROCKER_START = 0.8 // fraction of half-length where the tips start lifting

/** Linearly samples a face's [left, right] edges at t (0 = nose, 1 = tail). */
function edgesAt(face: BoardFace, t: number): [number, number] {
  const f = Math.min(face.rows - 1, Math.max(0, t * (face.rows - 1)))
  const i = Math.floor(f)
  const j = Math.min(face.rows - 1, i + 1)
  const k = f - i
  const l = face.edges[i * 2] * (1 - k) + face.edges[j * 2] * k
  const r = face.edges[i * 2 + 1] * (1 - k) + face.edges[j * 2 + 1] * k
  return [l, r]
}

/**
 * Builds a snowboard mesh whose outline follows the top-sheet photo.
 * Groups: 0 = top sheet, 1 = base, 2 = sidewalls/edges.
 * The board stands upright: length along +Y (nose up), top sheet facing +Z.
 */
export function buildBoardGeometry(top: BoardFace, base: BoardFace | null): THREE.BufferGeometry {
  const L = BOARD_LENGTH
  const widthWorld = L * top.aspect // crop width in world units

  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const groups: [number, number][] = []

  const rocker = (t: number) => {
    const s = Math.abs(t * 2 - 1)
    if (s <= ROCKER_START) return 0
    const u = (s - ROCKER_START) / (1 - ROCKER_START)
    return ROCKER_LIFT * u * u
  }

  // Per row: y, z offset, and left/right x in world units.
  const rows = Array.from({ length: ROWS + 1 }, (_, i) => {
    const t = i / ROWS // 0 = nose
    const [l, r] = edgesAt(top, t)
    return {
      t,
      y: (0.5 - t) * L,
      z: rocker(t),
      xl: (l - 0.5) * widthWorld,
      xr: (r - 0.5) * widthWorld,
    }
  })

  const addSurface = (side: 'top' | 'base') => {
    const start = indices.length
    const offset = positions.length / 3
    const zSide = side === 'top' ? THICKNESS / 2 : -THICKNESS / 2
    const face = side === 'top' ? top : base ?? top
    for (const row of rows) {
      const [fl, fr] = edgesAt(face, row.t)
      for (let j = 0; j <= COLS; j++) {
        const s = j / COLS
        positions.push(row.xl + (row.xr - row.xl) * s, row.y, row.z + zSide)
        // The base is seen from behind, so its photo is mirrored left↔right.
        const u = side === 'top' ? fl + (fr - fl) * s : fr + (fl - fr) * s
        uvs.push(u, 1 - row.t)
      }
    }
    const stride = COLS + 1
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        // Rows run nose→tail (y decreasing), so flip winding to face ±Z.
        const a = offset + i * stride + j
        const b = a + 1
        const c = a + stride
        const d = c + 1
        if (side === 'top') indices.push(a, c, d, a, d, b)
        else indices.push(a, d, c, a, b, d)
      }
    }
    groups.push([start, indices.length - start])
  }

  addSurface('top')
  addSurface('base')

  // Sidewall: walk the outline (right edge nose→tail, then left edge tail→nose).
  const start = indices.length
  const offset = positions.length / 3
  const loop = [
    ...rows.map((r) => ({ x: r.xr, y: r.y, z: r.z })),
    ...[...rows].reverse().map((r) => ({ x: r.xl, y: r.y, z: r.z })),
  ]
  for (const p of loop) {
    positions.push(p.x, p.y, p.z + THICKNESS / 2, p.x, p.y, p.z - THICKNESS / 2)
    uvs.push(0, 0, 0, 1)
  }
  for (let k = 0; k < loop.length; k++) {
    const n = (k + 1) % loop.length
    const t0 = offset + k * 2
    const b0 = t0 + 1
    const t1 = offset + n * 2
    const b1 = t1 + 1
    indices.push(b0, t1, b1, b0, t0, t1)
  }
  groups.push([start, indices.length - start])

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  groups.forEach(([s, count], i) => geo.addGroup(s, count, i))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}
