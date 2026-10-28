import { Component, lazy, Suspense, type ComponentProps, type ReactNode } from 'react'
import { BoardImage } from '../components/BoardImage'
import './LazyBoardStage.css'

const BoardStage = lazy(() => import('./BoardStage').then((m) => ({ default: m.BoardStage })))

type Props = ComponentProps<typeof BoardStage>

/** Whether this browser can create a WebGL context at all (off in some setups, or after a GPU crash). */
const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
})()

/** The board as a flat cut-out photo, for when 3D isn't available. */
function FlatBoard({ images, brand, model, className }: Props) {
  return (
    <div className={`${className ?? ''} stage-flat`}>
      {images[0] && <BoardImage className="stage-flat-img" src={images[0]} altSrcs={images.slice(1, 5)} alt={`${brand} ${model}`} />}
    </div>
  )
}

/** A failed 3D view (lost GPU, bundle that wouldn't load) must not take the page down with it. */
class StageBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.warn('3D view unavailable, showing the photo instead:', err)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Loads three.js on demand so the marketplace renders before the 3D bundle arrives. */
export function LazyBoardStage(props: Props) {
  if (!hasWebGL) return <FlatBoard {...props} />
  return (
    <StageBoundary fallback={<FlatBoard {...props} />}>
      <Suspense fallback={<div className={props.className} />}>
        <BoardStage {...props} />
      </Suspense>
    </StageBoundary>
  )
}
