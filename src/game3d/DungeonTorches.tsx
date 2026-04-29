import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { TerrainKind } from "../game/worldMap";
import { MAP_H, MAP_W, biomeAt, terrainAt } from "../game/worldMap";
import { nightVisualBlend } from "../game/worldClock";
import { useGameStoreSelector } from "../game/useGameStore";

/** Matches {@link HEIGHT_BY_TERRAIN} in Terrain.tsx for torch bases. */
const HEIGHT_BY_TERRAIN: Record<TerrainKind, number> = {
  grass: 0,
  road: 0.012,
  water: -0.18,
  town: 0.025,
  forest: 0,
  hill: 0.12
};

const MAX_TORCHES = 30;
const MIN_SPACING = 2.35;

function tileHash(x: number, y: number, salt = 0): number {
  let h = (x * 73856093) ^ (y * 19349663) ^ salt;
  h = (h ^ (h >>> 13)) * 0x5bd1e995;
  return (h >>> 0) / 2 ** 32;
}

interface TorchPlacement {
  x: number;
  z: number;
  y: number;
  phase: number;
}

function gatherSwampTorchCandidates(): TorchPlacement[] {
  const raw: { x: number; z: number; y: number; pri: number }[] = [];

  for (let z = 0; z < MAP_H; z++) {
    for (let x = 0; x < MAP_W; x++) {
      if (biomeAt(x, z) !== "swamp") continue;
      const kind = terrainAt(x, z);
      if (kind === "water" || kind === "forest" || kind === "town") continue;
      if (kind !== "grass" && kind !== "road") continue;

      const h1 = tileHash(x, z, 90210);
      const h2 = tileHash(x, z, 44102);
      if (kind === "road") {
        if (h1 > 0.52) continue;
      } else if (h1 > 0.032) continue;

      raw.push({
        x: x + 0.5,
        z: z + 0.5,
        y: HEIGHT_BY_TERRAIN[kind],
        pri: h2
      });
    }
  }

  raw.sort((a, b) => a.pri - b.pri);

  const chosen: TorchPlacement[] = [];
  for (const c of raw) {
    if (chosen.length >= MAX_TORCHES) break;
    let ok = true;
    for (const p of chosen) {
      const dx = c.x - p.x;
      const dz = c.z - p.z;
      if (dx * dx + dz * dz < MIN_SPACING * MIN_SPACING) {
        ok = false;
        break;
      }
    }
    if (ok) {
      chosen.push({ x: c.x, z: c.z, y: c.y, phase: tileHash(Math.floor(c.x), Math.floor(c.z), 331) * Math.PI * 2 });
    }
  }
  return chosen;
}

/**
 * Stateless torch mesh — no per-torch useFrame.
 * The parent DungeonTorches batches all light updates in a single useFrame.
 */
function Torch({
  x,
  y,
  z,
  nightBlend,
  index,
  lightsRef,
}: TorchPlacement & {
  nightBlend: number;
  index: number;
  lightsRef: React.MutableRefObject<(THREE.PointLight | null)[]>;
}) {
  const lightRef = useRef<THREE.PointLight>(null);
  const baseIntensity = THREE.MathUtils.lerp(1.15, 1.75, nightBlend);
  const distance = THREE.MathUtils.lerp(6.2, 8.8, nightBlend);

  // Register this torch's point-light into the parent's flat array so the
  // single parent useFrame can update all intensities in one loop.
  useLayoutEffect(() => {
    lightsRef.current[index] = lightRef.current;
    return () => {
      lightsRef.current[index] = null;
    };
  }, [lightsRef, index]);

  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.055, 0.065, 0.82, 8]} />
        <meshStandardMaterial color="#3d2418" roughness={0.88} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.86, 0]} castShadow>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial
          color="#ff6a2a"
          emissive="#ff4400"
          emissiveIntensity={1.35 + nightBlend * 0.5}
          roughness={0.45}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        position={[0, 0.92, 0]}
        color="#ffb060"
        intensity={baseIntensity}
        distance={distance}
        decay={2}
      />
    </group>
  );
}

/**
 * Swamp regions read as dungeon-like wilds: scattered torches with warm point lights
 * so mud and paths fall into pockets of light between darker stretches.
 *
 * All per-torch animation is batched into a single useFrame here instead of
 * one useFrame per Torch component (saves up to 30 subscriber registrations).
 */
export function DungeonTorches() {
  const { worldVersion, worldTimeRaw } = useGameStoreSelector((s) => ({
    worldVersion: s.world.worldVersion,
    worldTimeRaw: s.world.worldTime ?? 0,
  }));
  const worldTime = Number.isFinite(worldTimeRaw) ? worldTimeRaw : 0;
  const nightBlend = useMemo(() => nightVisualBlend(worldTime), [worldTime]);
  const placements = useMemo(() => gatherSwampTorchCandidates(), [worldVersion]);

  // Flat array of point light refs; updated by each Torch via useLayoutEffect.
  const lightsRef = useRef<(THREE.PointLight | null)[]>([]);

  // Keep nightBlend accessible inside useFrame without capturing stale closure.
  const nightBlendRef = useRef(nightBlend);
  useEffect(() => {
    nightBlendRef.current = nightBlend;
  }, [nightBlend]);

  // Single batched frame loop for all torch flicker — replaces up to 30 individual hooks.
  useFrame(({ clock }) => {
    const count = placements.length;
    if (count === 0) return;
    const t = clock.elapsedTime;
    const base = THREE.MathUtils.lerp(1.15, 1.75, nightBlendRef.current);
    for (let i = 0; i < count; i++) {
      const L = lightsRef.current[i];
      if (!L) continue;
      L.intensity = base * (0.88 + 0.12 * Math.sin(t * 6.2 + placements[i].phase));
    }
  });

  if (placements.length === 0) return null;

  return (
    <group name="dungeonTorches">
      {placements.map((p, i) => (
        <Torch
          key={`torch-${worldVersion}-${i}-${p.x}-${p.z}`}
          {...p}
          nightBlend={nightBlend}
          index={i}
          lightsRef={lightsRef}
        />
      ))}
    </group>
  );
}
