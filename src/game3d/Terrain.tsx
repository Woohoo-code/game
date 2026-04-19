import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BiomeKind } from "../game/types";
import { MAP_H, MAP_W, type TerrainKind, biomeAt, terrainAt } from "../game/worldMap";
import { useGameStore } from "../game/useGameStore";
import { biomeTerrainTint, getBiomeGroundTexture, getTerrainTexture } from "./textures";

/** Each terrain kind sits at a slightly different height so water dips and road rides slightly above grass. */
const HEIGHT_BY_TERRAIN: Record<TerrainKind, number> = {
  grass: 0,
  road: 0.012,
  water: -0.18,
  town: 0.025,
  forest: 0
};

const TERRAIN_RENDER_ORDER: TerrainKind[] = ["water", "grass", "forest", "road", "town"];
const BIOME_ORDER: BiomeKind[] = ["meadow", "forest", "desert", "swamp", "tundra"];

interface TerrainGroup {
  kind: TerrainKind;
  biome: BiomeKind;
  geometry: THREE.BufferGeometry;
}

type Accumulator = { positions: number[]; uvs: number[]; indices: number[]; vi: number };

function emptyAcc(): Accumulator {
  return { positions: [], uvs: [], indices: [], vi: 0 };
}

function buildTerrainGroups(): TerrainGroup[] {
  const tw = MAP_W;
  const th = MAP_H;
  const n = tw * th;

  // groups[kind][biome]
  const groups: Record<TerrainKind, Record<BiomeKind, Accumulator>> = {
    grass: { meadow: emptyAcc(), forest: emptyAcc(), desert: emptyAcc(), swamp: emptyAcc(), tundra: emptyAcc() },
    road: { meadow: emptyAcc(), forest: emptyAcc(), desert: emptyAcc(), swamp: emptyAcc(), tundra: emptyAcc() },
    water: { meadow: emptyAcc(), forest: emptyAcc(), desert: emptyAcc(), swamp: emptyAcc(), tundra: emptyAcc() },
    town: { meadow: emptyAcc(), forest: emptyAcc(), desert: emptyAcc(), swamp: emptyAcc(), tundra: emptyAcc() },
    forest: { meadow: emptyAcc(), forest: emptyAcc(), desert: emptyAcc(), swamp: emptyAcc(), tundra: emptyAcc() }
  };

  const tGrid = new Array<TerrainKind>(n);
  const bGrid = new Array<BiomeKind>(n);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const i = y * tw + x;
      tGrid[i] = terrainAt(x, y);
      bGrid[i] = biomeAt(x, y);
    }
  }

  const seen = new Uint8Array(n);
  const idx = (x: number, y: number) => y * tw + x;

  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const i = idx(x, y);
      if (seen[i]) continue;

      const kind = tGrid[i];
      const biome = bGrid[i];
      const g = groups[kind][biome];
      const elev = HEIGHT_BY_TERRAIN[kind];

      let w = 1;
      while (x + w < tw) {
        const ii = idx(x + w, y);
        if (seen[ii] || tGrid[ii] !== kind || bGrid[ii] !== biome) break;
        w++;
      }

      let rectH = 1;
      while (y + rectH < th) {
        let rowOk = true;
        for (let dx = 0; dx < w; dx++) {
          const ii = idx(x + dx, y + rectH);
          if (seen[ii] || tGrid[ii] !== kind || bGrid[ii] !== biome) {
            rowOk = false;
            break;
          }
        }
        if (!rowOk) break;
        rectH++;
      }

      for (let dy = 0; dy < rectH; dy++) {
        for (let dx = 0; dx < w; dx++) {
          seen[idx(x + dx, y + dy)] = 1;
        }
      }

      const v = g.vi;
      g.positions.push(x, elev, y, x + w, elev, y, x + w, elev, y + rectH, x, elev, y + rectH);
      g.uvs.push(x, y, x + w, y, x + w, y + rectH, x, y + rectH);
      g.indices.push(v, v + 2, v + 1, v, v + 3, v + 2);
      g.vi = v + 4;
    }
  }

  const result: TerrainGroup[] = [];
  for (const kind of TERRAIN_RENDER_ORDER) {
    for (const biome of BIOME_ORDER) {
      const g = groups[kind][biome];
      if (g.positions.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(g.positions, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(g.uvs, 2));
      geo.setIndex(g.indices);
      geo.computeVertexNormals();
      result.push({ kind, biome, geometry: geo });
    }
  }
  return result;
}

export function Terrain() {
  const snapshot = useGameStore();
  const worldVersion = snapshot.world.worldVersion;
  const realmTier = Math.max(1, Math.floor(snapshot.world.realmTier ?? 1));

  const terrainGroups = useMemo(buildTerrainGroups, [worldVersion]);
  const waterMats = useRef<THREE.MeshStandardMaterial[]>([]);

  useFrame((_, delta) => {
    for (const mat of waterMats.current) {
      if (!mat?.map) continue;
      mat.map.offset.x = (mat.map.offset.x + delta * 0.03) % 1;
      mat.map.offset.y = (mat.map.offset.y + delta * 0.018) % 1;
    }
  });

  // Reset refs each render — we rebuild them in the map below.
  waterMats.current = [];

  return (
    <>
      {terrainGroups.map(({ kind, biome, geometry }, i) => {
        // For "grass" kind we use a biome-specific texture (sand/snow/mud/meadow/forest-floor).
        // For other kinds we use the shared texture and tint it per biome.
        const tex = kind === "grass" ? getBiomeGroundTexture(biome, realmTier) : getTerrainTexture(kind);
        const tint = kind === "grass" ? "#ffffff" : biomeTerrainTint(biome, kind, realmTier);
        const key = `${kind}-${biome}-${i}`;
        if (kind === "water") {
          return (
            <mesh key={key} geometry={geometry} receiveShadow renderOrder={1}>
              <meshStandardMaterial
                ref={(m) => {
                  if (m) waterMats.current.push(m);
                }}
                map={tex}
                color={tint}
                roughness={0.35}
                metalness={0.15}
                transparent
                opacity={0.94}
                emissive={new THREE.Color("#0a1a2e")}
                emissiveIntensity={0.25}
              />
            </mesh>
          );
        }
        return (
          <mesh key={key} geometry={geometry} receiveShadow>
            <meshStandardMaterial map={tex} color={tint} roughness={0.78} metalness={0.02} envMapIntensity={0.35} />
          </mesh>
        );
      })}
    </>
  );
}

/**
 * Foliage palette per biome — trees on "forest" tiles pick a per-biome base
 * color so a forest patch in the tundra looks snow-dusted, a desert forest
 * looks like a palm oasis, etc.
 */
const FOLIAGE_BY_BIOME: Record<BiomeKind, { base: THREE.Color; top: THREE.Color; trunk: THREE.Color }> = {
  meadow: {
    base: new THREE.Color("#3f7a3a"),
    top: new THREE.Color("#58a04f"),
    trunk: new THREE.Color("#4a2f1a")
  },
  forest: {
    base: new THREE.Color("#2f5f32"),
    top: new THREE.Color("#4c7f43"),
    trunk: new THREE.Color("#3a2410")
  },
  desert: {
    base: new THREE.Color("#7a955a"),
    top: new THREE.Color("#b8c27a"),
    trunk: new THREE.Color("#7a5a2d")
  },
  swamp: {
    base: new THREE.Color("#3b4f2a"),
    top: new THREE.Color("#5a6f30"),
    trunk: new THREE.Color("#2e2012")
  },
  tundra: {
    base: new THREE.Color("#7fa2a8"),
    top: new THREE.Color("#e6efef"),
    trunk: new THREE.Color("#3a3020")
  }
};

const FOLIAGE_BY_BIOME_REALM2: Record<BiomeKind, { base: THREE.Color; top: THREE.Color; trunk: THREE.Color }> = {
  meadow: { base: new THREE.Color("#5d4d44"), top: new THREE.Color("#89766a"), trunk: new THREE.Color("#3a2a22") },
  forest: { base: new THREE.Color("#b8d6f5"), top: new THREE.Color("#ecf7ff"), trunk: new THREE.Color("#6a7284") },
  desert: { base: new THREE.Color("#d6843b"), top: new THREE.Color("#ffbd73"), trunk: new THREE.Color("#6f3f1f") },
  swamp: { base: new THREE.Color("#56749a"), top: new THREE.Color("#8bb3de"), trunk: new THREE.Color("#2a4058") },
  tundra: { base: new THREE.Color("#5f8d73"), top: new THREE.Color("#9ec6ad"), trunk: new THREE.Color("#304936") }
};

/** Decorative tree clusters rendered on forest tiles with slight variation + biome palette. */
export function Forests() {
  const snapshot = useGameStore();
  const worldVersion = snapshot.world.worldVersion;
  const realmTier = Math.max(1, Math.floor(snapshot.world.realmTier ?? 1));

  const trees = useMemo(() => {
    const list: { x: number; y: number; scale: number; rot: number; tint: number; biome: BiomeKind }[] = [];
    const tiles = MAP_W * MAP_H;
    const forestStride =
      tiles > 120_000 ? 4 : tiles > 55_000 ? 3 : tiles > 18_000 ? 2 : 1;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (terrainAt(x, y) !== "forest") continue;
        if (forestStride > 1 && (x % forestStride !== 0 || y % forestStride !== 0)) continue;
        const hash = (x * 73856093) ^ (y * 19349663);
        const rnd = ((hash >>> 0) % 1000) / 1000;
        const rnd2 = (((hash * 2654435761) >>> 0) % 1000) / 1000;
        const rnd3 = (((hash ^ 0xdeadbeef) >>> 0) % 1000) / 1000;
        list.push({
          x: x + 0.25 + rnd * 0.5,
          y: y + 0.25 + rnd2 * 0.5,
          scale: (0.85 + rnd * 0.45) * Math.min(1.35, 0.75 + forestStride * 0.12),
          rot: rnd2 * Math.PI * 2,
          tint: rnd3,
          biome: biomeAt(x, y)
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldVersion]);

  return (
    <>
      {trees.map((t, i) => {
        const palette = (realmTier >= 2 ? FOLIAGE_BY_BIOME_REALM2 : FOLIAGE_BY_BIOME)[t.biome];
        const foliageColor = palette.base.clone().multiplyScalar(0.9 + t.tint * 0.2);
        const foliageTop = palette.top.clone().multiplyScalar(0.92 + t.tint * 0.16);
        return (
          <group key={i} position={[t.x, 0, t.y]} rotation={[0, t.rot, 0]} scale={t.scale}>
            <mesh position={[0, 0.32, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.11, 0.66, 7]} />
              <meshStandardMaterial color={palette.trunk} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.92, 0]} castShadow>
              <coneGeometry args={[0.44, 0.95, 8]} />
              <meshStandardMaterial color={foliageColor} roughness={0.85} />
            </mesh>
            <mesh position={[0, 1.45, 0]} castShadow>
              <coneGeometry args={[0.32, 0.7, 8]} />
              <meshStandardMaterial color={foliageTop} roughness={0.85} />
            </mesh>
            <mesh position={[0, 1.85, 0]} castShadow>
              <coneGeometry args={[0.22, 0.5, 8]} />
              <meshStandardMaterial color={foliageTop} roughness={0.85} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
