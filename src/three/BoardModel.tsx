import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { loadBoardArt, type BoardArt } from '../lib/boardArt'
import { buildBoardGeometry } from './boardGeometry'

export type BoardView = 'top' | 'base' | 'side' | 'free'

const VIEW_ROTATION: Record<Exclude<BoardView, 'free'>, number> = {
  top: 0,
  base: Math.PI,
  side: Math.PI / 2,
}

interface Props {
  images: string[]
  brand: string
  model: string
  view: BoardView
  onViewChange?: (v: BoardView) => void
  autoSpin?: boolean
  onReady?: (art: BoardArt) => void
  /** Camber profile ("Camber", "Hybrid Rocker"…) shaped into the mesh. */
  profile?: string
}

function toTexture(canvas: HTMLCanvasElement, maxAniso: number) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = maxAniso
  tex.needsUpdate = true
  return tex
}

/**
 * The interactive board: drag to spin (with inertia), or snap to a preset
 * view. It bobs gently while idle, like an item on a display pedestal.
 */
export function BoardModel({ images, brand, model, view, onViewChange, autoSpin = false, onReady, profile }: Props) {
  const [art, setArt] = useState<BoardArt | null>(null)
  const group = useRef<THREE.Group>(null)
  const gl = useThree((s) => s.gl)
  const maxAniso = gl.capabilities.getMaxAnisotropy()

  useEffect(() => {
    let live = true
    setArt(null)
    loadBoardArt(images, { brand, model }).then((a) => {
      if (!live) return
      setArt(a)
      onReady?.(a)
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.join('|'), brand, model])

  const { geometry, materials } = useMemo(() => {
    if (!art) return { geometry: null, materials: null }
    const topTex = toTexture(art.top.canvas, maxAniso)
    const baseTex = art.base ? toTexture(art.base.canvas, maxAniso) : null
    const top = new THREE.MeshPhysicalMaterial({ map: topTex, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.18, alphaTest: 0.5 })
    const base = baseTex
      ? new THREE.MeshPhysicalMaterial({ map: baseTex, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.1, alphaTest: 0.5 })
      : new THREE.MeshPhysicalMaterial({ color: '#141b2b', roughness: 0.25, clearcoat: 0.8, sheen: 0.4, sheenColor: '#8ae3ff' })
    const side = new THREE.MeshStandardMaterial({ color: '#c9d4e3', metalness: 0.85, roughness: 0.28 })
    return { geometry: buildBoardGeometry(art.top, art.base, profile), materials: [top, base, side] }
  }, [art, maxAniso, profile])

  useEffect(
    () => () => {
      geometry?.dispose()
      materials?.forEach((m) => {
        m.map?.dispose()
        m.dispose()
      })
    },
    [geometry, materials],
  )

  // ---- drag-to-spin interaction ----
  const drag = useRef({ active: false, lastX: 0, lastY: 0, velY: 0, velX: 0 })
  const rot = useRef({ y: 0, x: 0, targetY: 0 as number | null })
  const dom = gl.domElement

  useEffect(() => {
    if (view === 'free') return
    const target = VIEW_ROTATION[view]
    // Turn the shortest way round to the requested face.
    const cur = rot.current.y
    const twoPi = Math.PI * 2
    rot.current.targetY = cur + ((((target - cur) % twoPi) + twoPi + Math.PI) % twoPi) - Math.PI
    drag.current.velY = 0
  }, [view])

  useEffect(() => {
    const down = (e: PointerEvent) => {
      drag.current = { ...drag.current, active: true, lastX: e.clientX, lastY: e.clientY, velX: 0, velY: 0 }
      rot.current.targetY = null
      dom.setPointerCapture(e.pointerId)
      dom.style.cursor = 'grabbing'
      onViewChange?.('free')
    }
    const move = (e: PointerEvent) => {
      if (!drag.current.active) return
      const dx = e.clientX - drag.current.lastX
      const dy = e.clientY - drag.current.lastY
      drag.current.lastX = e.clientX
      drag.current.lastY = e.clientY
      drag.current.velY = dx * 0.012
      drag.current.velX = dy * 0.006
      rot.current.y += dx * 0.012
      rot.current.x = THREE.MathUtils.clamp(rot.current.x + dy * 0.006, -0.9, 0.9)
    }
    const up = (e: PointerEvent) => {
      drag.current.active = false
      dom.style.cursor = 'grab'
      if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId)
    }
    dom.style.cursor = 'grab'
    dom.style.touchAction = 'pan-y'
    dom.addEventListener('pointerdown', down)
    dom.addEventListener('pointermove', move)
    dom.addEventListener('pointerup', up)
    dom.addEventListener('pointercancel', up)
    return () => {
      dom.removeEventListener('pointerdown', down)
      dom.removeEventListener('pointermove', move)
      dom.removeEventListener('pointerup', up)
      dom.removeEventListener('pointercancel', up)
    }
  }, [dom, onViewChange])

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const d = drag.current
    const r = rot.current
    if (!d.active) {
      if (r.targetY !== null) {
        r.y = THREE.MathUtils.damp(r.y, r.targetY, 6, delta)
        r.x = THREE.MathUtils.damp(r.x, 0, 6, delta)
      } else {
        // Inertia, then settle into a slow showcase spin.
        r.y += d.velY
        d.velY *= Math.pow(0.04, delta)
        r.x = THREE.MathUtils.damp(r.x, 0, 2, delta)
        if (autoSpin && Math.abs(d.velY) < 0.002) r.y += delta * 0.45
      }
    }
    g.rotation.set(r.x, r.y, 0)
    g.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.025
  })

  if (!geometry || !materials) return <LoadingBoard />
  return (
    <group ref={group}>
      <mesh geometry={geometry} material={materials} castShadow />
    </group>
  )
}

/** Pulsing ghost board shown while the photos are processed. */
function LoadingBoard() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.sin(s.clock.elapsedTime * 3) * 0.08
  })
  return (
    <mesh ref={ref}>
      <capsuleGeometry args={[0.14, 1.3, 8, 24]} />
      <meshBasicMaterial color="#8ae3ff" transparent opacity={0.2} wireframe />
    </mesh>
  )
}
