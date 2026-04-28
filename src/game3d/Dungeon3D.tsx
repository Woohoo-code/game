import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { currentDungeonFloor } from "../game/dungeon";
import { ENEMY_BY_ID } from "../game/enemyLookup";
import type { DungeonFloorState, EnemyState, GameSnapshot } from "../game/types";
import {
  DUNGEON_TILE_EXIT,
  DUNGEON_TILE_FLOOR,
  DUNGEON_TILE_PILLAR,
  DUNGEON_TILE_STAIRS_DOWN,
  DUNGEON_TILE_STAIRS_UP,
  DUNGEON_TILE_WALL
} from "../game/types";
import { useGameStoreSelector } from "../game/useGameStore";
import { MonsterModel } from "./MonsterModels";

/**
 * Render the active dungeon floor: stone tiles, walls, pillars, exit, stairs between
 * floors, wall lamps, chests, roamers.
 */
export function Dungeon3D() {
  const dungeon = useGameStoreSelector((s) => (s.world.inDungeon ? s.world.dungeon : null));
  if (!dungeon) return null;

  const floor = currentDungeonFloor(dungeon);
  if (!floor) return null;

  const throneHall = dungeon.kind === "throneHall";

  return (
    <group name="dungeon-scene">
      {throneHall ? <ThroneHallAmbient /> : <DungeonAmbient />}
      <DungeonFloor width={floor.width} height={floor.height} throneHall={throneHall} />
      <DungeonTiles floor={floor} throneHall={throneHall} />
      <DungeonWallLamps floor={floor} />
      <DungeonChests chests={floor.chests} />
      <DungeonRoamers
        roamers={floor.roamers}
        widthCap={floor.width}
        heightCap={floor.height}
      />
    </group>
  );
}

function DungeonAmbient() {
  return (
    <>
      <ambientLight intensity={0.14} color="#4a3828" />
      <hemisphereLight args={["#3a2820", "#0a0608", 0.2]} />
    </>
  );
}

function ThroneHallAmbient() {
  return (
    <>
      <ambientLight intensity={0.22} color="#c4a878" />
      <hemisphereLight args={["#e8dcc8", "#2a2218", 0.35]} />
      <directionalLight position={[-4, 10, 2]} intensity={0.45} color="#ffe8c8" castShadow />
    </>
  );
}

function DungeonFloor({ width, height, throneHall }: { width: number; height: number; throneHall?: boolean }) {
  return (
    <mesh position={[width / 2, -0.02, height / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color={throneHall ? "#3a3028" : "#2a2228"} roughness={throneHall ? 0.88 : 0.96} />
    </mesh>
  );
}

function DungeonTiles({ floor, throneHall }: { floor: DungeonFloorState; throneHall?: boolean }) {
  const audience = floor.throneHallAudience;

  const { floorGeo, wallGeo, pillars, exitTile, audienceTile } = useMemo(() => {
    const wallPositions: { x: number; y: number }[] = [];
    const pillarPositions: { x: number; y: number }[] = [];
    const regularFloorPositions: { x: number; y: number }[] = [];
    let audienceTile: { x: number; y: number } | null = null;
    let exitTile: { x: number; y: number } | null = null;

    for (let y = 0; y < floor.height; y++) {
      for (let x = 0; x < floor.width; x++) {
        const t = floor.tiles[y * floor.width + x] ?? DUNGEON_TILE_WALL;
        if (t === DUNGEON_TILE_WALL) {
          wallPositions.push({ x, y });
        } else if (t === DUNGEON_TILE_PILLAR) {
          pillarPositions.push({ x, y });
          regularFloorPositions.push({ x, y });
        } else if (t === DUNGEON_TILE_FLOOR) {
          if (throneHall && audience && x === audience.tx && y === audience.ty) {
            audienceTile = { x, y };
          } else {
            regularFloorPositions.push({ x, y });
          }
        } else if (t === DUNGEON_TILE_EXIT) {
          regularFloorPositions.push({ x, y });
          exitTile = { x, y };
        } else if (t === DUNGEON_TILE_STAIRS_DOWN || t === DUNGEON_TILE_STAIRS_UP) {
          regularFloorPositions.push({ x, y });
        }
      }
    }

    // Merge all regular floor tiles into one geometry
    const floorTemplate = new THREE.BoxGeometry(0.98, 0.06, 0.98);
    const floorGeos = regularFloorPositions.map(({ x, y }) => {
      const g = floorTemplate.clone();
      g.translate(x + 0.5, 0, y + 0.5);
      return g;
    });
    const floorGeo = floorGeos.length > 0 ? mergeBufferGeometries(floorGeos) : null;
    floorGeos.forEach((g) => g.dispose());
    floorTemplate.dispose();

    // Merge all wall tiles into one geometry
    const wallTemplate = new THREE.BoxGeometry(1, 1.4, 1);
    const wallGeos = wallPositions.map(({ x, y }) => {
      const g = wallTemplate.clone();
      g.translate(x + 0.5, 0.6, y + 0.5);
      return g;
    });
    const wallGeo = wallGeos.length > 0 ? mergeBufferGeometries(wallGeos) : null;
    wallGeos.forEach((g) => g.dispose());
    wallTemplate.dispose();

    return { floorGeo, wallGeo, pillars: pillarPositions, exitTile, audienceTile };
  }, [floor, throneHall, audience]);

  // Dispose merged geometries when they change or the component unmounts
  useEffect(() => {
    return () => {
      floorGeo?.dispose();
      wallGeo?.dispose();
    };
  }, [floorGeo, wallGeo]);

  const floorColor = throneHall ? "#5a2020" : "#3a2f34";
  const floorRoughness = throneHall ? 0.82 : 0.9;

  return (
    <group>
      {floorGeo && (
        <mesh geometry={floorGeo} receiveShadow>
          <meshStandardMaterial color={floorColor} roughness={floorRoughness} />
        </mesh>
      )}
      {audienceTile && (
        <mesh position={[audienceTile.x + 0.5, 0, audienceTile.y + 0.5]} receiveShadow>
          <boxGeometry args={[0.98, 0.06, 0.98]} />
          <meshStandardMaterial color="#6a4a2a" roughness={0.82} />
        </mesh>
      )}
      {wallGeo && (
        <mesh geometry={wallGeo} castShadow receiveShadow>
          <meshStandardMaterial color="#1e181c" roughness={0.96} />
        </mesh>
      )}
      {pillars.map((p) => (
        <DungeonPillar key={`p-${p.x}-${p.y}`} x={p.x} y={p.y} />
      ))}
      {exitTile && <DungeonExit x={exitTile.x} y={exitTile.y} />}
      {throneHall && floor.throneHallAudience && (
        <ThroneDais x={floor.throneHallAudience.tx} y={floor.throneHallAudience.ty} />
      )}
      <DungeonStairs floor={floor} />
    </group>
  );
}

function ThroneDais({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x + 0.5, 0, y + 0.5]}>
      <pointLight position={[0, 1.8, 0.6]} intensity={1.1} distance={5} color="#ffe8c0" />
      <pointLight position={[-0.7, 1.1, 0.5]} intensity={0.5} distance={3.5} color="#6a8cff" />
      <pointLight position={[0.7, 1.1, 0.5]} intensity={0.5} distance={3.5} color="#ff9a4a" />
      <mesh position={[0, 0.02, 0.4]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.4, 1.1]} />
        <meshStandardMaterial color="#4a0a0a" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.35, 0.4, 1.35]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.82} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.72, -0.15]} castShadow>
        <boxGeometry args={[0.7, 0.7, 0.55]} />
        <meshStandardMaterial color="#1a1c28" roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.25, -0.48]} castShadow>
        <boxGeometry args={[0.85, 0.5, 0.12]} />
        <meshStandardMaterial color="#5a1a1a" roughness={0.7} emissive="#300808" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 1.2, -0.15]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.5, 8]} />
        <meshStandardMaterial color="#8a7a20" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.5, -0.15]}>
        <boxGeometry args={[0.5, 0.28, 0.35]} />
        <meshStandardMaterial color="#a01818" emissive="#501010" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, 1.2, 0.25]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#ffe8c0" emissive="#c08030" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.32, 0.95, -0.35]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.7, 6]} />
        <meshStandardMaterial color="#4a3a1a" roughness={0.75} />
      </mesh>
      <mesh position={[0.32, 0.95, -0.35]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.7, 6]} />
        <meshStandardMaterial color="#4a3a1a" roughness={0.75} />
      </mesh>
      <Html center position={[0, 1.9, -0.1]} distanceFactor={10} zIndexRange={[20, 0]} pointerEvents="none">
        <div
          className="building-label-3d"
          style={{ borderColor: "#e8c040", fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em" }}
        >
          THE KING
        </div>
      </Html>
    </group>
  );
}

function DungeonStairs({ floor }: { floor: DungeonFloorState }) {
  const down: { x: number; y: number }[] = [];
  const up: { x: number; y: number }[] = [];
  for (let y = 0; y < floor.height; y++) {
    for (let x = 0; x < floor.width; x++) {
      const t = floor.tiles[y * floor.width + x];
      if (t === DUNGEON_TILE_STAIRS_DOWN) down.push({ x, y });
      if (t === DUNGEON_TILE_STAIRS_UP) up.push({ x, y });
    }
  }
  return (
    <group>
      {down.map((p) => (
        <group key={`sd-${p.x}-${p.y}`} position={[p.x + 0.5, 0, p.y + 0.5]}>
          <mesh position={[0, 0.08, 0]} receiveShadow>
            <boxGeometry args={[0.88, 0.14, 0.88]} />
            <meshStandardMaterial color="#3a3038" roughness={0.9} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.05 + i * 0.06, 0.12 - i * 0.04]} receiveShadow>
              <boxGeometry args={[0.75, 0.05, 0.55]} />
              <meshStandardMaterial color="#4a4248" roughness={0.88} />
            </mesh>
          ))}
          <mesh position={[0, 0.32, -0.18]}>
            <boxGeometry args={[0.5, 0.04, 0.12]} />
            <meshStandardMaterial color="#6a5868" emissive="#2a1a28" emissiveIntensity={0.25} />
          </mesh>
          <Html center position={[0, 0.55, 0]} distanceFactor={10} zIndexRange={[20, 0]} pointerEvents="none">
            <div className="building-label-3d" style={{ borderColor: "#6a5080", fontSize: "8px" }}>
              ↓ DEEPER
            </div>
          </Html>
        </group>
      ))}
      {up.map((p) => (
        <group key={`su-${p.x}-${p.y}`} position={[p.x + 0.5, 0, p.y + 0.5]}>
          <mesh position={[0, 0.08, 0]} receiveShadow>
            <boxGeometry args={[0.88, 0.14, 0.88]} />
            <meshStandardMaterial color="#3a3530" roughness={0.9} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.2 - i * 0.06, -0.08 + i * 0.04]} receiveShadow>
              <boxGeometry args={[0.75, 0.05, 0.55]} />
              <meshStandardMaterial color="#4a4438" roughness={0.88} />
            </mesh>
          ))}
          <Html center position={[0, 0.48, 0]} distanceFactor={10} zIndexRange={[20, 0]} pointerEvents="none">
            <div className="building-label-3d" style={{ borderColor: "#708060", fontSize: "8px" }}>
              ↑ SHALLOWER
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

/** Wall-mounted oil lamps along interior walls (not a building — props on the wall line). */
function DungeonWallLamps({ floor }: { floor: DungeonFloorState }) {
  const placements = useMemo(() => gatherDungeonLampPlacements(floor), [floor]);
  return (
    <group name="dungeon-wall-lamps">
      {placements.map((p, i) => (
        <DungeonWallLamp key={`lamp-${i}-${p.x}-${p.z}`} {...p} />
      ))}
    </group>
  );
}

function gatherDungeonLampPlacements(floor: DungeonFloorState): {
  x: number;
  z: number;
  rotY: number;
  phase: number;
}[] {
  const W = floor.width;
  const H = floor.height;
  const tiles = floor.tiles;
  const at = (x: number, y: number) => tiles[y * W + x] ?? DUNGEON_TILE_WALL;

  const raw: { x: number; z: number; rotY: number; pri: number }[] = [];

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const t = at(x, y);
      if (
        t !== DUNGEON_TILE_FLOOR &&
        t !== DUNGEON_TILE_EXIT &&
        t !== DUNGEON_TILE_STAIRS_DOWN &&
        t !== DUNGEON_TILE_STAIRS_UP
      ) {
        continue;
      }

      const n = at(x, y - 1);
      const s = at(x, y + 1);
      const eT = at(x + 1, y);
      const wT = at(x - 1, y);
      const wallN = n === DUNGEON_TILE_WALL || n === DUNGEON_TILE_PILLAR;
      const wallS = s === DUNGEON_TILE_WALL || s === DUNGEON_TILE_PILLAR;
      const wallE = eT === DUNGEON_TILE_WALL || eT === DUNGEON_TILE_PILLAR;
      const wallWest = wT === DUNGEON_TILE_WALL || wT === DUNGEON_TILE_PILLAR;

      const h = ((x * 9283711) ^ (y * 689287499)) >>> 0;
      const pick = (h % 1000) / 1000;

      if (wallN && pick < 0.42) {
        raw.push({ x: x + 0.5, z: y + 0.18, rotY: 0, pri: pick });
      } else if (wallS && pick < 0.42) {
        raw.push({ x: x + 0.5, z: y + 0.82, rotY: Math.PI, pri: pick });
      } else if (wallE && pick < 0.38) {
        raw.push({ x: x + 0.82, z: y + 0.5, rotY: -Math.PI / 2, pri: pick });
      } else if (wallWest && pick < 0.38) {
        raw.push({ x: x + 0.18, z: y + 0.5, rotY: Math.PI / 2, pri: pick });
      }
    }
  }

  raw.sort((a, b) => a.pri - b.pri);
  const chosen: { x: number; z: number; rotY: number; phase: number }[] = [];
  const minD = 1.85;
  for (const c of raw) {
    if (chosen.length >= 36) break;
    let ok = true;
    for (const p of chosen) {
      const dx = c.x - p.x;
      const dz = c.z - p.z;
      if (dx * dx + dz * dz < minD * minD) {
        ok = false;
        break;
      }
    }
    if (ok) {
      chosen.push({ x: c.x, z: c.z, rotY: c.rotY, phase: c.pri * Math.PI * 2 });
    }
  }
  return chosen;
}

function DungeonWallLamp({
  x,
  z,
  rotY,
  phase
}: {
  x: number;
  z: number;
  rotY: number;
  phase: number;
}) {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const L = lightRef.current;
    if (!L) return;
    const flicker = 0.82 + 0.18 * Math.sin(clock.elapsedTime * 5.5 + phase);
    L.intensity = 0.95 * flicker;
  });

  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.72, 8]} />
        <meshStandardMaterial color="#2a1810" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.08, 0.06]} castShadow>
        <boxGeometry args={[0.14, 0.06, 0.08]} />
        <meshStandardMaterial color="#3a2820" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.82, 0.02]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial
          color="#ffc080"
          emissive="#ff8020"
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        position={[0, 0.78, 0.1]}
        color="#ffaa66"
        intensity={0.95}
        distance={5.5}
        decay={2}
      />
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
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[0.92, 0.1, 0.92]} />
        <meshStandardMaterial color="#5a4028" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.7, 0.04, 0.7]} />
        <meshStandardMaterial color="#b08850" emissive="#6a4a1a" emissiveIntensity={0.35} />
      </mesh>
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
  chests: NonNullable<GameSnapshot["world"]["dungeon"]>["floors"][number]["chests"];
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
      {!opened && <pointLight position={[0, 0.55, 0]} intensity={0.45} distance={1.4} color="#ffd478" />}
    </group>
  );
}

function DungeonRoamers({
  roamers,
  widthCap,
  heightCap
}: {
  roamers: NonNullable<GameSnapshot["world"]["dungeon"]>["floors"][number]["roamers"];
  widthCap: number;
  heightCap: number;
}) {
  const rows = useMemo(
    () =>
      roamers
        .filter((r) => r.tx >= 0 && r.ty >= 0 && r.tx < widthCap && r.ty < heightCap)
        .map((r) => {
          const def = ENEMY_BY_ID.get(r.enemyId);
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
