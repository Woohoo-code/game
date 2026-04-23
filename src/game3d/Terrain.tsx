import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import type { BiomeKind } from "../game/types";
import {
  MAP_H,
  MAP_W,
  type TerrainKind,
  biomeAt,
  terrainAt,
} from "../game/worldMap";
import { useGameStore } from "../game/useGameStore";
import {
  biomeTerrainTint,
  getBiomeGroundTexture,
  getTerrainTexture,
} from "./textures";

/** Each terrain kind sits at a slightly different height so water dips and road rides slightly above grass. */
const HEIGHT_BY_TERRAIN: Record<TerrainKind, number> = {
  grass: 0,
  road: 0.012,
  water: -0.18,
  town: 0.025,
  forest: 0,
  hill: 0.12,
};

const TERRAIN_RENDER_ORDER: TerrainKind[] = [
  "water",
  "grass",
  "forest",
  "hill",
  "road",
  "town",
];
const BIOME_ORDER: BiomeKind[] = [
  "meadow",
  "forest",
  "desert",
  "swamp",
  "tundra",
];

interface TerrainGroup {
  kind: TerrainKind;
  biome: BiomeKind;
  geometry: THREE.BufferGeometry;
}

type Accumulator = {
  positions: number[];
  uvs: number[];
  indices: number[];
  vi: number;
};

function emptyAcc(): Accumulator {
  return { positions: [], uvs: [], indices: [], vi: 0 };
}

function buildTerrainGroups(): TerrainGroup[] {
  const tw = MAP_W;
  const th = MAP_H;
  const n = tw * th;

  // groups[kind][biome]
  const groups: Record<TerrainKind, Record<BiomeKind, Accumulator>> = {
    grass: {
      meadow: emptyAcc(),
      forest: emptyAcc(),
      desert: emptyAcc(),
      swamp: emptyAcc(),
      tundra: emptyAcc(),
    },
    road: {
      meadow: emptyAcc(),
      forest: emptyAcc(),
      desert: emptyAcc(),
      swamp: emptyAcc(),
      tundra: emptyAcc(),
    },
    water: {
      meadow: emptyAcc(),
      forest: emptyAcc(),
      desert: emptyAcc(),
      swamp: emptyAcc(),
      tundra: emptyAcc(),
    },
    town: {
      meadow: emptyAcc(),
      forest: emptyAcc(),
      desert: emptyAcc(),
      swamp: emptyAcc(),
      tundra: emptyAcc(),
    },
    forest: {
      meadow: emptyAcc(),
      forest: emptyAcc(),
      desert: emptyAcc(),
      swamp: emptyAcc(),
      tundra: emptyAcc(),
    },
    hill: {
      meadow: emptyAcc(),
      forest: emptyAcc(),
      desert: emptyAcc(),
      swamp: emptyAcc(),
      tundra: emptyAcc(),
    },
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
      g.positions.push(
        x,
        elev,
        y,
        x + w,
        elev,
        y,
        x + w,
        elev,
        y + rectH,
        x,
        elev,
        y + rectH,
      );
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
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(g.positions, 3),
      );
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(g.uvs, 2));
      geo.setIndex(g.indices);
      geo.computeVertexNormals();
      result.push({ kind, biome, geometry: geo });
    }
  }
  return result;
}

export function Terrain() {
  // We'll return our custom GLB model directly instead of building the procedural terrain geometry.
  // The model may need rotation/scaling depending on its original orientation.
  const { scene } = useGLTF("/map.glb");

  // Clone it so we don't mutate the cached loaded original, then traverse to enable shadows.
  const mapScene = useMemo(() => {
    const cloned = scene.clone();
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.receiveShadow = true;
        child.castShadow = true;
      }
    });
    // Optional: Center or scale the model here if needed.
    // e.g. cloned.position.set(MAP_W / 2, 0, MAP_H / 2);
    return cloned;
  }, [scene]);

  return (
    <group scale={[0.1, 0.1, 0.1]} position={[MAP_W / 2, -2, MAP_H / 2]}>
      <primitive object={mapScene} />
    </group>
  );
}

/**
 * Foliage palette per biome — trees on "forest" tiles pick a per-biome base
 * color so a forest patch in the tundra looks snow-dusted, a desert forest
 * looks like a palm oasis, etc.
 */
const FOLIAGE_BY_BIOME: Record<
  BiomeKind,
  { base: THREE.Color; top: THREE.Color; trunk: THREE.Color }
> = {
  meadow: {
    base: new THREE.Color("#3f7a3a"),
    top: new THREE.Color("#58a04f"),
    trunk: new THREE.Color("#4a2f1a"),
  },
  forest: {
    base: new THREE.Color("#2f5f32"),
    top: new THREE.Color("#4c7f43"),
    trunk: new THREE.Color("#3a2410"),
  },
  desert: {
    base: new THREE.Color("#7a955a"),
    top: new THREE.Color("#b8c27a"),
    trunk: new THREE.Color("#7a5a2d"),
  },
  swamp: {
    base: new THREE.Color("#3b4f2a"),
    top: new THREE.Color("#5a6f30"),
    trunk: new THREE.Color("#2e2012"),
  },
  tundra: {
    base: new THREE.Color("#7fa2a8"),
    top: new THREE.Color("#e6efef"),
    trunk: new THREE.Color("#3a3020"),
  },
};

const FOLIAGE_BY_BIOME_REALM2: Record<
  BiomeKind,
  { base: THREE.Color; top: THREE.Color; trunk: THREE.Color }
> = {
  meadow: {
    base: new THREE.Color("#5d4d44"),
    top: new THREE.Color("#89766a"),
    trunk: new THREE.Color("#3a2a22"),
  },
  forest: {
    base: new THREE.Color("#b8d6f5"),
    top: new THREE.Color("#ecf7ff"),
    trunk: new THREE.Color("#6a7284"),
  },
  desert: {
    base: new THREE.Color("#d6843b"),
    top: new THREE.Color("#ffbd73"),
    trunk: new THREE.Color("#6f3f1f"),
  },
  swamp: {
    base: new THREE.Color("#56749a"),
    top: new THREE.Color("#8bb3de"),
    trunk: new THREE.Color("#2a4058"),
  },
  tundra: {
    base: new THREE.Color("#5f8d73"),
    top: new THREE.Color("#9ec6ad"),
    trunk: new THREE.Color("#304936"),
  },
};

/** Decorative tree clusters rendered on forest tiles with slight variation + biome palette. */
export function Forests() {
  const snapshot = useGameStore();
  const worldVersion = snapshot.world.worldVersion;
  const realmTier = Math.max(1, Math.floor(snapshot.world.realmTier ?? 1));

  const trees = useMemo(() => {
    const list: {
      x: number;
      y: number;
      scale: number;
      rot: number;
      tint: number;
      biome: BiomeKind;
    }[] = [];
    const tiles = MAP_W * MAP_H;
    const forestStride =
      tiles > 120_000 ? 5 : tiles > 55_000 ? 4 : tiles > 18_000 ? 3 : 2; // Increase stride to reduce tree count
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (terrainAt(x, y) !== "forest") continue;
        if (
          forestStride > 1 &&
          (x % forestStride !== 0 || y % forestStride !== 0)
        )
          continue;
        const hash = (x * 73856093) ^ (y * 19349663);
        const rnd = ((hash >>> 0) % 1000) / 1000;
        const rnd2 = (((hash * 2654435761) >>> 0) % 1000) / 1000;
        const rnd3 = (((hash ^ 0xdeadbeef) >>> 0) % 1000) / 1000;
        list.push({
          x: x + 0.25 + rnd * 0.5,
          y: y + 0.25 + rnd2 * 0.5,
          scale:
            (0.85 + rnd * 0.45) * Math.min(1.35, 0.75 + forestStride * 0.12),
          rot: rnd2 * Math.PI * 2,
          tint: rnd3,
          biome: biomeAt(x, y),
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldVersion]);

  // Use InstancedMesh for trees to drastically reduce draw calls
  const treeGeometries = useMemo(() => {
    return {
      trunk: new THREE.CylinderGeometry(0.08, 0.11, 0.66, 7),
      cone1: new THREE.ConeGeometry(0.44, 0.95, 8),
      cone2: new THREE.ConeGeometry(0.32, 0.7, 8),
      cone3: new THREE.ConeGeometry(0.22, 0.5, 8),
    };
  }, []);

  const instances = useMemo(() => {
    const biomeMap = new Map<BiomeKind, typeof trees>();
    for (const tree of trees) {
      if (!biomeMap.has(tree.biome)) biomeMap.set(tree.biome, []);
      biomeMap.get(tree.biome)!.push(tree);
    }
    return biomeMap;
  }, [trees]);

  return (
    <>
      {Array.from(instances.entries()).map(([biome, biomeTrees]) => {
        const palette = (
          realmTier >= 2 ? FOLIAGE_BY_BIOME_REALM2 : FOLIAGE_BY_BIOME
        )[biome];

        // Setup InstancedMesh data for this biome
        return (
          <group key={biome}>
            {/* Trunk */}
            <instancedMesh
              args={[
                treeGeometries.trunk,
                new THREE.MeshStandardMaterial({
                  color: palette.trunk,
                  roughness: 0.9,
                }),
                biomeTrees.length,
              ]}
              castShadow
            >
              {biomeTrees.map((t, i) => {
                const matrix = new THREE.Matrix4();
                matrix.makeRotationY(t.rot);
                matrix.scale(new THREE.Vector3(t.scale, t.scale, t.scale));
                matrix.setPosition(t.x, 0.32 * t.scale, t.y);
                return (
                  <primitive
                    key={`trunk-${i}`}
                    object={new THREE.Object3D()}
                    position={[0, 0, 0]}
                    ref={(obj: any) => {
                      if (obj) {
                        obj.parent?.parent?.children[0]?.setMatrixAt?.(
                          i,
                          matrix,
                        );
                        if (i === biomeTrees.length - 1) {
                          const m = obj.parent?.parent?.children[0];
                          if (m && m.instanceMatrix)
                            m.instanceMatrix.needsUpdate = true;
                        }
                      }
                    }}
                  />
                );
              })}
            </instancedMesh>
            {/* Cone 1 */}
            <instancedMesh
              args={[
                treeGeometries.cone1,
                new THREE.MeshStandardMaterial({
                  color: palette.base.clone().multiplyScalar(0.9),
                  roughness: 0.85,
                }),
                biomeTrees.length,
              ]}
              castShadow
            >
              {biomeTrees.map((t, i) => {
                const matrix = new THREE.Matrix4();
                matrix.makeRotationY(t.rot);
                matrix.scale(new THREE.Vector3(t.scale, t.scale, t.scale));
                matrix.setPosition(t.x, 0.92 * t.scale, t.y);
                // Can't do instanced colors easily in R3F declarative without a hook, just use base color
                return (
                  <primitive
                    key={`cone1-${i}`}
                    object={new THREE.Object3D()}
                    position={[0, 0, 0]}
                    ref={(obj: any) => {
                      if (obj)
                        obj.parent?.parent?.children[1]?.setMatrixAt?.(
                          i,
                          matrix,
                        );
                    }}
                  />
                );
              })}
            </instancedMesh>
            {/* Cone 2 */}
            <instancedMesh
              args={[
                treeGeometries.cone2,
                new THREE.MeshStandardMaterial({
                  color: palette.top.clone().multiplyScalar(0.92),
                  roughness: 0.85,
                }),
                biomeTrees.length,
              ]}
              castShadow
            >
              {biomeTrees.map((t, i) => {
                const matrix = new THREE.Matrix4();
                matrix.makeRotationY(t.rot);
                matrix.scale(new THREE.Vector3(t.scale, t.scale, t.scale));
                matrix.setPosition(t.x, 1.45 * t.scale, t.y);
                return (
                  <primitive
                    key={`cone2-${i}`}
                    object={new THREE.Object3D()}
                    position={[0, 0, 0]}
                    ref={(obj: any) => {
                      if (obj)
                        obj.parent?.parent?.children[2]?.setMatrixAt?.(
                          i,
                          matrix,
                        );
                    }}
                  />
                );
              })}
            </instancedMesh>
            {/* Cone 3 */}
            <instancedMesh
              args={[
                treeGeometries.cone3,
                new THREE.MeshStandardMaterial({
                  color: palette.top.clone().multiplyScalar(0.92),
                  roughness: 0.85,
                }),
                biomeTrees.length,
              ]}
              castShadow
            >
              {biomeTrees.map((t, i) => {
                const matrix = new THREE.Matrix4();
                matrix.makeRotationY(t.rot);
                matrix.scale(new THREE.Vector3(t.scale, t.scale, t.scale));
                matrix.setPosition(t.x, 1.85 * t.scale, t.y);
                return (
                  <primitive
                    key={`cone3-${i}`}
                    object={new THREE.Object3D()}
                    position={[0, 0, 0]}
                    ref={(obj: any) => {
                      if (obj) {
                        obj.parent?.parent?.children[3]?.setMatrixAt?.(
                          i,
                          matrix,
                        );
                        // Trigger update on last item
                        if (i === biomeTrees.length - 1) {
                          const meshes = obj.parent?.parent?.children as any[];
                          if (meshes) {
                            meshes.forEach((m) => {
                              if (m?.instanceMatrix)
                                m.instanceMatrix.needsUpdate = true;
                            });
                          }
                        }
                      }
                    }}
                  />
                );
              })}
            </instancedMesh>
          </group>
        );
      })}
    </>
  );
}
