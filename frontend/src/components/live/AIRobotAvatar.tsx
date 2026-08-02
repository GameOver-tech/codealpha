import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Float } from '@react-three/drei'
import * as THREE from 'three'

/**
 * 3D AI interviewer robot — built with React Three Fiber.
 *
 * A friendly floating robot head with:
 *  - idle float bob + subtle rotation (always on)
 *  - periodic blinking eyes (always on)
 *  - a glowing mouth ring that pulses while `isSpeaking` is true, giving a
 *    believable "the AI is talking" lip-sync effect driven by TTS playback.
 *
 * Purely presentational — no state, no props beyond `isSpeaking`.
 */

const ACCENT = '#3B82F6'

/** Eyes that blink on a random interval (useFrame-driven, no manual RAF). */
function Eyes() {
  const left = useRef<THREE.Mesh>(null)
  const right = useRef<THREE.Mesh>(null)
  const blinkTimer = useRef(2 + Math.random() * 2)

  useFrame((_, delta) => {
    blinkTimer.current -= delta
    let scaleY = 1
    if (blinkTimer.current <= 0) {
      const phase = Math.abs(blinkTimer.current)
      // 0 → close over 0.09s, hold briefly, reopen over 0.09s.
      scaleY = phase < 0.09 ? 1 - phase / 0.09 : phase < 0.14 ? 0 : (phase - 0.14) / 0.09
      scaleY = Math.max(0.08, Math.min(1, scaleY))
      if (blinkTimer.current <= -0.23) blinkTimer.current = 2.5 + Math.random() * 3
    }
    if (left.current) left.current.scale.set(1, scaleY, 1)
    if (right.current) right.current.scale.set(1, scaleY, 1)
  })

  return (
    <group>
      <mesh ref={left} position={[-0.28, 0.32, 0.78]}>
        <sphereGeometry args={[0.09, 24, 24]} />
        <meshStandardMaterial color="#0f172a" emissive={ACCENT} emissiveIntensity={0.35} roughness={0.3} />
      </mesh>
      <mesh ref={right} position={[0.28, 0.32, 0.78]}>
        <sphereGeometry args={[0.09, 24, 24]} />
        <meshStandardMaterial color="#0f172a" emissive={ACCENT} emissiveIntensity={0.35} roughness={0.3} />
      </mesh>
    </group>
  )
}

/** Glowing mouth ring that pulses while the robot is speaking. */
function Mouth({ isSpeaking }: { isSpeaking: boolean }) {
  const ring = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  const phase = useRef(0)

  useFrame((_, delta) => {
    if (!ring.current || !glow.current) return
    phase.current += delta * 10
    const target = isSpeaking ? 1 : 0.15
    // Smoothly ease toward the target, then pulse on top while speaking.
    const ease = 1 - Math.pow(0.001, delta)
    const base = THREE.MathUtils.lerp(ring.current.scale.x, target, ease)
    const pulse = isSpeaking ? 1 + Math.sin(phase.current) * 0.35 : 0
    const scale = Math.max(0.15, base * (1 + pulse * 0.25))
    ring.current.scale.set(scale, 0.35 + (isSpeaking ? Math.abs(Math.sin(phase.current)) * 0.6 : 0), scale)
    glow.current.scale.set(scale * 1.25, 0.5, scale * 1.25)
    const mat = glow.current.material as THREE.MeshBasicMaterial
    mat.opacity = isSpeaking ? 0.35 + Math.abs(Math.sin(phase.current)) * 0.3 : 0.12
  })

  return (
    <group position={[0, -0.12, 0.78]}>
      <mesh ref={ring}>
        <torusGeometry args={[0.12, 0.045, 16, 32]} />
        <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1.6} roughness={0.2} />
      </mesh>
      <mesh ref={glow} position={[0, 0, -0.02]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.2} />
      </mesh>
    </group>
  )
}

/** Robot head group — floats and gently rotates. */
function RobotHead({ isSpeaking }: { isSpeaking: boolean }) {
  const group = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.getElapsedTime()
    group.current.rotation.y = Math.sin(t * 0.5) * 0.15
    group.current.rotation.z = Math.sin(t * 0.35) * 0.04
  })

  return (
    <Float speed={1.6} rotationIntensity={0.12} floatIntensity={0.6}>
      <group ref={group}>
        {/* Head */}
        <mesh>
          <sphereGeometry args={[0.95, 48, 48]} />
          <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.35} />
        </mesh>
        {/* Face plate */}
        <mesh position={[0, 0.05, 0.78]}>
          <sphereGeometry args={[0.72, 32, 32]} />
          <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.5} />
        </mesh>
        {/* Antenna */}
        <mesh position={[0, 1.12, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.3, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.32, 0]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={2} />
        </mesh>
        {/* Ears */}
        <mesh position={[-0.95, 0.05, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.18, 20]} />
          <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.6} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.95, 0.05, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.18, 20]} />
          <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.6} metalness={0.7} roughness={0.3} />
        </mesh>
        <Eyes />
        <Mouth isSpeaking={isSpeaking} />
      </group>
    </Float>
  )
}

/** Loading fallback shown while the WebGL scene initializes. */
function RobotFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/30 via-slate-800 to-slate-900 shadow-2xl">
        <div className="h-16 w-16 rounded-2xl border-2 border-blue-400/60 bg-slate-900 shadow-[0_0_40px_rgba(59,130,246,0.5)]" />
        <span className="absolute bottom-3 h-2 w-8 rounded-full bg-blue-400/80" />
      </div>
    </div>
  )
}

export function AIRobotAvatar({ isSpeaking = false, className = '' }: { isSpeaking?: boolean; className?: string }) {
  return (
    <div className={`relative ${className}`} aria-hidden>
      <Suspense fallback={<RobotFallback />}>
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0.2, 4], fov: 45 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 4, 5]} intensity={1.2} />
          <pointLight position={[0, 1.5, 2.5]} intensity={0.8} color={ACCENT} />
          <RobotHead isSpeaking={isSpeaking} />
          <ContactShadows position={[0, -1.6, 0]} opacity={0.35} scale={6} blur={2.4} far={3} color="#000" />
        </Canvas>
      </Suspense>
    </div>
  )
}
