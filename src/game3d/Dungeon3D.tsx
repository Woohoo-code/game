import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ENEMIES } from "../game/data";
import type { EnemyState } from "../game/types";
import {
  DUNGEON_TILE_EXIT,
  DUNGEON_TILE_FLOOR,
  DUNGEON_TILE_PILLAR,
  DUNGEON_TILE_WALL
} from "../game/types";
import { useGameStore } from "../game/useGameStore";
import { MonsterModel } from "./MonsterModels";

/**
 * Render a procedurally-generated dungeon room: stone floor tiles, wall blocks,
 * decorative pillars, the exit staircase, treasure chests, and visible undead
 * roamers. Only drawn while `world.inDungeon` is true; the overworld components
 * skip rendering at that time so this scene stands alone.
 */
export function Dungeon3D() {
  const snapshot = useGameStore();
  const dungeon = snapshot.world.dungeon;
  if (!snapshot.world.inDungeon || !dungeon) return null;

  return (
    <group name="dungeon-scene">
      <DungeonAmbient />
      <DungeonFloor width={dungeon.width} height={dungeon.height} />
      <DungeonTiles dungeon={dungeon} />
      <DungeonChests chests={dungeon.chests} />
      <DungeonRoamers
        roamers={dungeon.roamers}
        widthCap={dungeon.width}
        heightCap={dungeon.height}
      />
    </group>
  );
}

/** Dim torch-lit ambient lighting — keeps the dungeon feeling dark without being unplayable. */
function DungeonAmbient() {
  return (
    <>
      <ambientLight intensity={0.18} color="#5a4430" />
      <hemisphereLight args={["#443028", "#0a0608", 0.22]} />
    </>
  );
}

function DungeonFloor({ width, height }: { width: number; height: number }) {
  return (
    <mesh position={[width / 2, -0.02, height / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color="#2a2228" roughness={0.96} />
    </mesh>
  );
}

function DungeonTiles({ dungeon }: { dungeon: NonNullable<ReturnType<typeof useGameStore>["world"]["dungeon"]> }) {
  const walls: { x: number; y: number }[] = [];
  const pillars: { x: number; y: number }[] = [];
  const floors: { x: number; y: number }[] = [];
  let exitTile: { x: number; y: number } | null = null;

  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      const t = dungeon.tiles[y * dungeon.width + x] ?? DUNGEON_TILE_WALL;
      if (t === DUNGEON_TILE_WALL) {
        walls.push({ x, y });
      } else if (t === DUNGEON_TILE_PILLAR) {
        pillars.push({ x, y });
        floors.push({ x, y });
      } else if (t === DUNGEON_TILE_FLOOR) {
        floors.push({ x, y });
      } else if (t === DUNGEON_TILE_EXIT) {
        floors.push({ x, y });
        exitTile = { x, y };
      }
    }
  }

  return (
    <group>
      {floors.map((f) => (
        <mesh
          key={`f-${f.x}-${f.y}`}
          position={[f.x + 0.5, 0, f.y + 0.5]}
          receiveShadow
        >
          <boxGeometry args={[0.98, 0.06, 0.98]} />
          <meshStandardMaterial color="#3a2f34" roughness={0.9} />
        </mesh>
      ))}
      {walls.map((w) => (
        <mesh
          key={`w-${w.x}-${w.y}`}
          position={[w.x + 0.5, 0.6, w.y + 0.5]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[1, 1.4, 1]} />
          <meshStandardMaterial color="#1e181c" roughness={0.96} />
        </mesh>
      ))}
      {pillars.map((p) => (
        <DungeonPillar key={`p-${p.x}-${p.y}`} x={p.x} y={p.y} />
      ))}
      {exitTile && <DungeonExit x={exitTile.x} y={exitTile.y} />}
    </group>
  );
}

function DungeonPillar({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x + 0.5, 0, y + 0.5]}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.42, 0.48, 0.1, 12]} />
        <meshStandardMaterial color="#1a1418" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.32, 1.4, 14]} />
        <meshStandardMaterial color="#2a1f24" roughness={0.92} />
      </mesh>
      <mesh position={[0, 1.48, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.36, 0.16, 14]} />
        <meshStandardMaterial color="#1f1a1f" roughness={0.9} />
      </mesh>
    </group>
  );
}

function DungeonExit({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x + 0.5, 0, y + 0.5]}>
      {/* Staircase / exit mat. */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[0.92, 0.1, 0.92]} />
        <meshStandardMaterial color="#5a4028" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.7, 0.04, 0.7]} />
        <meshStandardMaterial color="#b08850" emissive="#6a4a1a" emissiveIntensity={0.35} />
      </mesh>
      {/* Torch flame marker so the player can spot the exit from afar. */}
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color="#ffb266" emissive="#ff6a28" emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={[0, 1.05, 0]} intensity={1.25} distance={6} color="#ff9a5a" />
      <Html center position={[0, 1.55, 0]} distanceFactor={10} zIndexRange={[20, 0]} pointerEvents="none">
        <div className="building-label-3d" style={{ borderColor: "#b08850" }}>
          EXIT
        </div>
      </Html>
    </group>
  );
}

function DungeonChests({
  chests
}: {
  chests: NonNullable<ReturnType<typeof useGameStore>["world"]["dungeon"]>["chests"];
}) {
  return (
    <group>
      {chests.map((c) => (
        <DungeonChestModel key={c.id} x={c.tx} y={c.ty} opened={c.opened} />
      ))}
    </group>
  );
}

function DungeonChestModel({ x, y, opened }: { x: number; y: number; opened: boolean }) {
  const lidRef = useRef<THREE.Group>(null);
  // Gently animate open chests so they read as obviously looted.
  useFrame((_, dt) => {
    const g = lidRef.current;
    if (!g) return;
    const target = opened ? -Math.PI / 2.2 : 0;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, target, Math.min(1, dt * 6));
  });
  return (
    <group position={[x + 0.5, 0, y + 0.5]}>
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.62, 0.32, 0.44]} />
        <meshStandardMaterial color={opened ? "#3a2618" : "#6a4028"} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[0.5, 0.02, 0.34]} />
        <meshStandardMaterial color={opened ? "#1e1410" : "#2a1810"} emissive={opened ? "#4a3820" : "#000000"} emissiveIntensity={opened ? 0.4 : 0} />
      </mesh>
      <group ref={lidRef} position={[0, 0.34, -0.22]}>
        <mesh position={[0, 0.08, 0.22]} castShadow>
          <boxGeometry args={[0.62, 0.16, 0.44]} />
          <meshStandardMaterial color={opened ? "#3a2618" : "#8a5838"} roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.08, 0.44]} castShadow>
          <boxGeometry args={[0.12, 0.12, 0.06]} />
          <meshStandardMaterial color="#d8b048" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
      {!opened && (
        <pointLight position={[0, 0.55, 0]} intensity={0.45} distance={1.4} color="#ffd478" />
      )}
    </group>
  );
}

function DungeonRoamers({
  roamers,
  widthCap,
  heightCap
}: {
  roamers: NonNullable<ReturnType<typeof useGameStore>["world"]["dungeon"]>["roamers"];
  widthCap: number;
  heightCap: number;
}) {
  const rows = useMemo(
    () =>
      roamers
        .filter((r) => r.tx >= 0 && r.ty >= 0 && r.tx < widthCap && r.ty < heightCap)
        .map((r) => {
          const def = ENEMIES.find((e) => e.id === r.enemyId);
          const enemy: EnemyState | null = def ? { ...def, hp: def.maxHp } : null;
          return { r, enemy };
        })
        .filter((row): row is { r: typeof row.r; enemy: EnemyState } => row.enemy !== null),
    [roamers, widthCap, heightCap]
  );
  return (
    <group>
      {rows.map(({ r, enemy }) => (
        <group key={r.id} position={[r.tx + 0.5, 0, r.ty + 0.5]} scale={0.5}>
          <MonsterModel enemy={enemy} />
        </group>
      ))}
    </group>
  );
}
