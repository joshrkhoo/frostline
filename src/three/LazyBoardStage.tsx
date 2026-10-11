import { lazy, Suspense, type ComponentProps } from 'react'

const BoardStage = lazy(() => import('./BoardStage').then((m) => ({ default: m.BoardStage })))

/** Loads three.js on demand so the marketplace renders before the 3D bundle arrives. */
export function LazyBoardStage(props: ComponentProps<typeof BoardStage>) {
  return (
    <Suspense fallback={<div className={props.className} />}>
      <BoardStage {...props} />
    </Suspense>
  )
}
