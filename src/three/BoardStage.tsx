import { ContactShadows, Environment, Lightformer, Sparkles } from '@react-three/drei'
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

/** Glowing ice pedestal the board floats above (Frozeverse-style item stand). */
function Pedestal() {
  return (
    <group position={[0, -1.02, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.46, 0.5, 96]} />
        <meshBasicMaterial color="#8ae3ff" transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <circleGeometry args={[0.8, 96]} />
        <meshBasicMaterial color="#3ba4ff" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.52, 0.6, 0.1, 64]} />
        <meshStandardMaterial color="#0e1a30" metalness={0.6} roughness={0.35} />
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
        <ambientLight intensity={0.35} />
        <directionalLight position={[2, 3, 4]} intensity={1.6} />
        <pointLight position={[-2.5, 0.5, 1.5]} intensity={6} color="#8ae3ff" distance={8} />
        <pointLight position={[2.5, -0.5, -1.5]} intensity={5} color="#ffb547" distance={8} />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={2.5} position={[0, 2, 3]} scale={[4, 1, 1]} />
          <Lightformer form="rect" intensity={1.5} color="#8ae3ff" position={[-3, 0, 1]} scale={[1, 4, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#ffb547" position={[3, 0, -1]} scale={[1, 4, 1]} />
          <Lightformer form="circle" intensity={0.8} position={[0, -3, 0]} scale={3} />
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
        <ContactShadows position={[0, -1.0, 0]} opacity={0.5} scale={3} blur={2.8} far={1.5} color="#3ba4ff" />
        <Sparkles count={70} scale={[3.5, 2.6, 2]} size={2.2} speed={0.25} opacity={0.6} color="#cfefff" />
      </Canvas>
    </div>
  )
}
