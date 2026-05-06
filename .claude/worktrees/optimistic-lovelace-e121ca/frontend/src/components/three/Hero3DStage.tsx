"use client";
import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere, Stars } from "@react-three/drei";
import * as THREE from "three";

/* ── Animated orb that reacts to pointer ─────────────── */
function HeroOrb() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { pointer } = useThree();

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.15;
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, pointer.y * 0.3, 0.02);
    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, pointer.x * 0.5, 0.02);
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.8}>
      <Sphere ref={meshRef} args={[1.8, 128, 128]}>
        <MeshDistortMaterial
          color="#6366f1"
          emissive="#4f46e5"
          emissiveIntensity={0.6}
          roughness={0.2}
          metalness={0.8}
          distort={0.25}
          speed={1.5}
          transparent
          opacity={0.9}
        />
      </Sphere>
    </Float>
  );
}

/* ── Orbital ring ────────────────────────────────────── */
function OrbitalRing({ radius = 3, color = "#818cf8" }: { radius?: number; color?: string }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * 0.1;
  });

  const geometry = useMemo(() => new THREE.TorusGeometry(radius, 0.015, 16, 100), [radius]);

  return (
    <mesh ref={ref} geometry={geometry} rotation={[Math.PI / 3, 0, 0]}>
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </mesh>
  );
}

/* ── Floating particles ──────────────────────────────── */
function FloatingParticles({ count = 80 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      arr[i] = (Math.random() - 0.5) * 12;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#a78bfa" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

/* ── Main 3D stage ───────────────────────────────────── */
export function Hero3DStage() {
  return (
    <div className="absolute inset-0 -z-10" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <fog attach="fog" args={["#020617", 5, 15]} />
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={1} color="#818cf8" />
        <pointLight position={[-5, -3, 3]} intensity={0.5} color="#c084fc" />

        <HeroOrb />
        <OrbitalRing radius={2.8} color="#818cf8" />
        <OrbitalRing radius={3.4} color="#c084fc" />
        <FloatingParticles />
        <Stars radius={50} depth={40} count={1000} factor={2} saturation={0} fade speed={0.5} />
      </Canvas>
    </div>
  );
}
