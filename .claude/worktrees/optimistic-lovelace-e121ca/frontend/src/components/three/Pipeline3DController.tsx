"use client";
import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere, MeshDistortMaterial, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { PipelineStatus } from "@/types/api";

/* ── Status-reactive orb colors ──────────────────────── */
const STATUS_COLORS: Record<PipelineStatus, { main: string; emissive: string; intensity: number; distort: number }> = {
  queued: { main: "#475569", emissive: "#334155", intensity: 0.2, distort: 0.1 },
  running_agent1: { main: "#6366f1", emissive: "#4f46e5", intensity: 0.5, distort: 0.2 },
  running_agent2: { main: "#8b5cf6", emissive: "#7c3aed", intensity: 0.7, distort: 0.3 },
  running_agent3: { main: "#c084fc", emissive: "#a855f7", intensity: 0.8, distort: 0.25 },
  completed: { main: "#34d399", emissive: "#10b981", intensity: 0.6, distort: 0.15 },
  failed: { main: "#f87171", emissive: "#ef4444", intensity: 0.5, distort: 0.35 },
};

function PipelineOrb({ status }: { status: PipelineStatus }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const colors = STATUS_COLORS[status];

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * (status.startsWith("running") ? 0.4 : 0.1);
    const pulse = status.startsWith("running") ? Math.sin(state.clock.elapsedTime * 2) * 0.05 : 0;
    meshRef.current.scale.setScalar(1 + pulse);
  });

  return (
    <Float speed={status.startsWith("running") ? 2.5 : 1} rotationIntensity={0.2} floatIntensity={0.5}>
      <Sphere ref={meshRef} args={[1.2, 96, 96]}>
        <MeshDistortMaterial
          color={colors.main}
          emissive={colors.emissive}
          emissiveIntensity={colors.intensity}
          roughness={0.3}
          metalness={0.7}
          distort={colors.distort}
          speed={status.startsWith("running") ? 3 : 1}
          transparent
          opacity={0.9}
        />
      </Sphere>
    </Float>
  );
}

/* ── Stage indicator dots ────────────────────────────── */
function StageDots({ status }: { status: PipelineStatus }) {
  const stages: PipelineStatus[] = ["running_agent1", "running_agent2", "running_agent3"];
  const stageIndex = stages.indexOf(status);

  return (
    <group position={[0, -2.2, 0]}>
      {stages.map((s, i) => {
        const isActive = i <= stageIndex && status !== "queued";
        const isCurrent = s === status;
        return (
          <mesh key={s} position={[(i - 1) * 1.2, 0, 0]}>
            <sphereGeometry args={[isCurrent ? 0.12 : 0.08, 16, 16]} />
            <meshBasicMaterial
              color={isActive ? "#818cf8" : "#334155"}
              transparent
              opacity={isActive ? 1 : 0.4}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function Pipeline3DController({ status }: { status: PipelineStatus }) {
  return (
    <div className="h-64 w-full" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <fog attach="fog" args={["#020617", 4, 12]} />
        <ambientLight intensity={0.2} />
        <pointLight position={[3, 3, 5]} intensity={0.8} color={STATUS_COLORS[status].main} />
        <pointLight position={[-3, -2, 3]} intensity={0.4} color="#c084fc" />

        <PipelineOrb status={status} />
        <StageDots status={status} />
        <Stars radius={30} depth={30} count={500} factor={1.5} fade speed={0.3} />
      </Canvas>
    </div>
  );
}
