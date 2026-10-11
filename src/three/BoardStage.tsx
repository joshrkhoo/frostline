import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { BoardModel, type BoardView } from './BoardModel'

interface Props {
  images: string[]
  brand: string
  model: string
  view?: BoardView
  onViewChange?: (v: BoardView) => void
  autoSpin?: boolean
  className?: string
  /** Show the glowing pedestal under the board. */
  pedestal?: boolean
  /** Camera distance; larger shows more space around the board. */
  cameraZ?: number
  /** Camber profile to shape the board with. */
  profile?: string
}

/** Slim frosted pedestal the board floats above (Frozeverse-style item stand). */
function Pedestal() {
  return (
    <group position={[0, -1.02, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.47, 0.485, 128]} />
        <meshBasicMaterial color="#8ae3ff" transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <circleGeometry args={[0.47, 128]} />
        <meshBasicMaterial color="#0b1424" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, -0.035, 0]}>
        <cylinderGeometry args={[0.485, 0.5, 0.06, 96]} />
        <meshStandardMaterial color="#111c2e" metalness={0} roughness={0.9} />
      </mesh>
    </group>
  )
}

export function BoardStage({
  images,
  brand,
  model,
  view = 'free',
  onViewChange,
  autoSpin = true,
  className,
  pedestal = true,
  cameraZ = 3.3,
  profile,
}: Props) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.05, cameraZ], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[2, 3, 4]} intensity={1.5} />
        <pointLight position={[-2.5, 0.5, 1.5]} intensity={3} color="#8ae3ff" distance={8} />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={2.2} position={[0, 2, 3]} scale={[4, 1, 1]} />
          <Lightformer form="rect" intensity={1} color="#cfefff" position={[-3, 0, 1]} scale={[1, 4, 1]} />
          <Lightformer form="rect" intensity={0.8} color="#cfefff" position={[3, 0, -1]} scale={[1, 4, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <BoardModel
            images={images}
            brand={brand}
            model={model}
            view={view}
            onViewChange={onViewChange}
            autoSpin={autoSpin}
            profile={profile}
          />
        </Suspense>
        {pedestal && <Pedestal />}
        <ContactShadows position={[0, -0.99, 0]} opacity={0.35} scale={1.6} blur={2.5} far={1.2} color="#3ba4ff" />
      </Canvas>
    </div>
  )
}
