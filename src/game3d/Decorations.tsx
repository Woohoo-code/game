import { Instance, Instances } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { BiomeKind } from "../game/types";
import { MAP_H, MAP_W, biomeAt, terrainAt } from "../game/worldMap";
import { useGameStore } from "../game/useGameStore";

interface Placement {
  x: number;
  z: number;
  scale: number;
  rot: number;
  variant: number;
}

function tileHash(x: number, y: number, salt = 0): { r1: number; r2: number; r3: number; r4: number } {
  let h = (x * 73856093) ^ (y * 19349663) ^ salt;
  h = (h ^ (h >>> 13)) * 0x5bd1e995;
  h = h >>> 0;
  const r1 = (h % 1000) / 1000;
  h = (h * 2654435761) >>> 0;
  const r2 = (h % 1000) / 1000;
  h = (h * 1597334677) >>> 0;
  const r3 = (h % 1000) / 1000;
  h = (h * 362437) >>> 0;
  const r4 = (h % 1000) / 1000;
  return { r1, r2, r3, r4 };
}

interface GatheredDecorations {
  grass: Placement[];
  flowers: Placement[];
  rocks: Placement[];
  lilyPads: Placement[];
  cacti: Placement[];
  iceCrystals: Placement[];
  mushrooms: Placement[];
  snowMounds: Placement[];
  reeds: Placement[];
}

function emptyDecorations(): GatheredDecorations {
  return {
    grass: [],
    flowers: [],
    rocks: [],
    lilyPads: [],
    cacti: [],
    iceCrystals: [],
    mushrooms: [],
    snowMounds: [],
    reeds: []
  };
}

/**
 * Biome-aware placement logic. On each walkable non-road tile we look up the
 * biome and scatter the props that fit it: cacti in the desert, ice crystals
 * in the tundra, mushrooms + reeds in the swamp, grass tufts + flowers in
 * meadows and forests.
 */
export function GroundDecorations() {
  const snapshot = useGameStore();
  const worldVersion = snapshot.world.worldVersion;

  const dec = useMemo(() => {
    const out = emptyDecorations();
    const tiles = MAP_W * MAP_H;
    const decorStride =
      tiles > 120_000 ? 3 : tiles > 45_000 ? 2 : 1;

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const kind = terrainAt(x, y);
        const biome = biomeAt(x, y);
        const h = tileHash(x, y);

        if (kind === "grass") {
          if (decorStride > 1 && (x % decorStride !== 0 || y % decorStride !== 0)) {
            continue;
          }
          scatterForBiome(out, biome, x, y, h);
        } else if (kind === "water") {
          // Lily pads only in biomes where open water exists (skip tundra — it's iced over)
          if (biome !== "tundra" && h.r1 < 0.12) {
            const sub = tileHash(x, y, 4242);
            out.lilyPads.push({
              x: x + 0.25 + sub.r1 * 0.5,
              z: y + 0.25 + sub.r2 * 0.5,
              scale: 0.75 + sub.r3 * 0.5,
              rot: sub.r4 * Math.PI * 2,
              variant: biome === "swamp" ? 1 : 0
            });
          }
          // Tundra water: sprinkle a few ice chunks
          if (biome === "tundra" && h.r2 < 0.18) {
            const sub = tileHash(x, y, 6161);
            out.iceCrystals.push({
              x: x + 0.3 + sub.r1 * 0.4,
              z: y + 0.3 + sub.r2 * 0.4,
              scale: 0.5 + sub.r3 * 0.4,
              rot: sub.r4 * Math.PI * 2,
              variant: 1
            });
          }
        } else if (kind === "road") {
          if (h.r1 < 0.05) {
            const sub = tileHash(x, y, 9999);
            out.rocks.push({
              x: x + 0.25 + sub.r1 * 0.5,
              z: y + 0.25 + sub.r2 * 0.5,
              scale: 0.35 + sub.r3 * 0.3,
              rot: sub.r4 * Math.PI * 2,
              variant: 1
            });
          }
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldVersion]);

  return (
    <>
      <GrassTufts items={dec.grass} />
      <Flowers items={dec.flowers} />
      <Rocks items={dec.rocks} />
      <LilyPads items={dec.lilyPads} />
      <Cacti items={dec.cacti} />
      <IceCrystals items={dec.iceCrystals} />
      <Mushrooms items={dec.mushrooms} />
      <SnowMounds items={dec.snowMounds} />
      <Reeds items={dec.reeds} />
    </>
  );
}

function scatterForBiome(
  out: GatheredDecorations,
  biome: BiomeKind,
  x: number,
  y: number,
  h: { r1: number; r2: number; r3: number; r4: number }
): void {
  switch (biome) {
    case "meadow": {
      const tuftCount = h.r1 < 0.35 ? 2 : 1;
      for (let i = 0; i < tuftCount; i++) {
        const sub = tileHash(x, y, 11 + i * 7);
        out.grass.push({
          x: x + 0.2 + sub.r1 * 0.6,
          z: y + 0.2 + sub.r2 * 0.6,
          scale: 0.55 + sub.r3 * 0.4,
          rot: sub.r4 * Math.PI * 2,
          variant: (sub.r1 * 3) | 0
        });
      }
      if (h.r2 < 0.1) {
        const sub = tileHash(x, y, 777);
        out.flowers.push({
          x: x + 0.25 + sub.r1 * 0.5,
          z: y + 0.25 + sub.r2 * 0.5,
          scale: 0.7 + sub.r3 * 0.4,
          rot: sub.r4 * Math.PI * 2,
          variant: (sub.r2 * 4) | 0
        });
      }
      if (h.r3 < 0.03) {
        const sub = tileHash(x, y, 1234);
        out.rocks.push({
          x: x + 0.3 + sub.r1 * 0.4,
          z: y + 0.3 + sub.r2 * 0.4,
          scale: 0.55 + sub.r3 * 0.6,
          rot: sub.r4 * Math.PI * 2,
          variant: 0
        });
      }
      break;
    }

    case "forest": {
      // Thicker grass, occasional mushrooms, denser rocks
      if (h.r1 < 0.45) {
        const sub = tileHash(x, y, 22);
        out.grass.push({
          x: x + 0.2 + sub.r1 * 0.6,
          z: y + 0.2 + sub.r2 * 0.6,
          scale: 0.6 + sub.r3 * 0.5,
          rot: sub.r4 * Math.PI * 2,
          variant: 2
        });
      }
      if (h.r2 < 0.12) {
        const sub = tileHash(x, y, 333);
        out.mushrooms.push({
          x: x + 0.3 + sub.r1 * 0.4,
          z: y + 0.3 + sub.r2 * 0.4,
          scale: 0.55 + sub.r3 * 0.5,
          rot: sub.r4 * Math.PI * 2,
          variant: 0
        });
      }
      if (h.r3 < 0.06) {
        const sub = tileHash(x, y, 1234);
        out.rocks.push({
          x: x + 0.3 + sub.r1 * 0.4,
          z: y + 0.3 + sub.r2 * 0.4,
          scale: 0.5 + sub.r3 * 0.6,
          rot: sub.r4 * Math.PI * 2,
          variant: 0
        });
      }
      break;
    }

    case "desert": {
      // Cacti, lots of rocks, no grass
      if (h.r1 < 0.08) {
        const sub = tileHash(x, y, 5101);
        out.cacti.push({
          x: x + 0.3 + sub.r1 * 0.4,
          z: y + 0.3 + sub.r2 * 0.4,
          scale: 0.7 + sub.r3 * 0.6,
          rot: sub.r4 * Math.PI * 2,
          variant: (sub.r1 * 3) | 0
        });
      }
      if (h.r3 < 0.12) {
        const sub = tileHash(x, y, 5102);
        out.rocks.push({
          x: x + 0.3 + sub.r1 * 0.4,
          z: y + 0.3 + sub.r2 * 0.4,
          scale: 0.5 + sub.r3 * 0.6,
          rot: sub.r4 * Math.PI * 2,
          variant: 2
        });
      }
      break;
    }

    case "swamp": {
      // Reeds, mushrooms, occasional rocks; very little grass
      if (h.r1 < 0.22) {
        const sub = tileHash(x, y, 7101);
        out.reeds.push({
          x: x + 0.2 + sub.r1 * 0.6,
          z: y + 0.2 + sub.r2 * 0.6,
          scale: 0.7 + sub.r3 * 0.6,
          rot: sub.r4 * Math.PI * 2,
          variant: 0
        });
      }
      if (h.r2 < 0.18) {
        const sub = tileHash(x, y, 7102);
        out.mushrooms.push({
          x: x + 0.3 + sub.r1 * 0.4,
          z: y + 0.3 + sub.r2 * 0.4,
          scale: 0.55 + sub.r3 * 0.4,
          rot: sub.r4 * Math.PI * 2,
          variant: 1
        });
      }
      break;
    }

    case "tundra": {
      // Snow mounds + ice crystals, very rarely a rock
      if (h.r1 < 0.25) {
        const sub = tileHash(x, y, 9101);
        out.snowMounds.push({
          x: x + 0.3 + sub.r1 * 0.4,
          z: y + 0.3 + sub.r2 * 0.4,
          scale: 0.7 + sub.r3 * 0.6,
          rot: sub.r4 * Math.PI * 2,
          variant: 0
        });
      }
      if (h.r2 < 0.08) {
        const sub = tileHash(x, y, 9102);
        out.iceCrystals.push({
          x: x + 0.3 + sub.r1 * 0.4,
          z: y + 0.3 + sub.r2 * 0.4,
          scale: 0.6 + sub.r3 * 0.5,
          rot: sub.r4 * Math.PI * 2,
          variant: 0
        });
      }
      break;
    }
  }
}

// ── Render components (each one wraps its items in `<Instances>` for batching) ─

function GrassTufts({ items }: { items: Placement[] }) {
  if (items.length === 0) return null;
  return (
    <Instances limit={Math.max(items.length, 1)} castShadow={false}>
      <coneGeometry args={[0.06, 0.25, 4]} />
      <meshStandardMaterial color="#8bb361" roughness={0.85} />
      {items.map((p, i) => (
        <Instance
          key={i}
          position={[p.x, 0.13, p.z]}
          rotation={[0, p.rot, 0]}
          scale={[p.scale, p.scale + p.variant * 0.15, p.scale]}
        />
      ))}
    </Instances>
  );
}

const FLOWER_PALETTE = ["#f4a9c7", "#f2d76a", "#c88df0", "#ff9466"];

function Flowers({ items }: { items: Placement[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <Instances limit={Math.max(items.length, 1)}>
        <cylinderGeometry args={[0.015, 0.015, 0.22, 5]} />
        <meshStandardMaterial color="#3e6a37" />
        {items.map((p, i) => (
          <Instance key={i} position={[p.x, 0.11, p.z]} />
        ))}
      </Instances>
      {items.map((p, i) => (
        <mesh key={i} position={[p.x, 0.25, p.z]} castShadow>
          <sphereGeometry args={[0.06 * p.scale, 8, 6]} />
          <meshStandardMaterial
            color={FLOWER_PALETTE[p.variant % FLOWER_PALETTE.length]}
            emissive={FLOWER_PALETTE[p.variant % FLOWER_PALETTE.length]}
            emissiveIntensity={0.15}
            roughness={0.7}
          />
        </mesh>
      ))}
    </>
  );
}

function Rocks({ items }: { items: Placement[] }) {
  if (items.length === 0) return null;
  return (
    <Instances limit={Math.max(items.length, 1)} castShadow>
      <dodecahedronGeometry args={[0.12, 0]} />
      <meshStandardMaterial color="#7c7f8a" roughness={0.9} />
      {items.map((p, i) => (
        <Instance
          key={i}
          position={[p.x, 0.07 * p.scale, p.z]}
          rotation={[p.variant * 0.4, p.rot, p.variant * 0.2]}
          scale={[p.scale, p.scale * 0.7, p.scale * 0.9]}
        />
      ))}
    </Instances>
  );
}

function LilyPads({ items }: { items: Placement[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <Instances limit={Math.max(items.length, 1)}>
        <cylinderGeometry args={[0.3, 0.28, 0.02, 10]} />
        <meshStandardMaterial color="#3b7a49" roughness={0.7} />
        {items.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, -0.15, p.z]}
            rotation={[0, p.rot, 0]}
            scale={[p.scale, 1, p.scale]}
          />
        ))}
      </Instances>
      {items
        .filter((_, i) => i % 4 === 0)
        .map((p, i) => (
          <mesh key={i} position={[p.x, -0.12, p.z]} rotation={[0, p.rot, 0]} castShadow>
            <sphereGeometry args={[0.08 * p.scale, 8, 6]} />
            <meshStandardMaterial color="#f6e6ef" emissive="#e6b7cf" emissiveIntensity={0.2} roughness={0.6} />
          </mesh>
        ))}
    </>
  );
}

function Cacti({ items }: { items: Placement[] }) {
  if (items.length === 0) return null;
  const green = "#3e7a48";
  return (
    <>
      {/* Tall body */}
      <Instances limit={Math.max(items.length, 1)} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.7, 8]} />
        <meshStandardMaterial color={green} roughness={0.85} />
        {items.map((p, i) => (
          <Instance key={i} position={[p.x, 0.35 * p.scale, p.z]} rotation={[0, p.rot, 0]} scale={[p.scale, p.scale, p.scale]} />
        ))}
      </Instances>
      {/* Side arm (only some variants) */}
      <Instances limit={Math.max(items.length, 1)} castShadow>
        <capsuleGeometry args={[0.05, 0.25, 4, 8]} />
        <meshStandardMaterial color={green} roughness={0.85} />
        {items.map((p, i) => {
          const visible = p.variant >= 1;
          const s = visible ? p.scale : 0.001;
          return (
            <Instance
              key={i}
              position={[p.x + 0.13 * p.scale, 0.45 * p.scale, p.z]}
              rotation={[0, p.rot, Math.PI / 2 - 0.3]}
              scale={[s, s, s]}
            />
          );
        })}
      </Instances>
      {/* Small blossoms on top */}
      {items.map((p, i) =>
        p.variant === 2 ? (
          <mesh key={i} position={[p.x, 0.74 * p.scale, p.z]}>
            <sphereGeometry args={[0.06 * p.scale, 8, 6]} />
            <meshStandardMaterial color="#ffb080" emissive="#ff7844" emissiveIntensity={0.2} />
          </mesh>
        ) : null
      )}
    </>
  );
}

function IceCrystals({ items }: { items: Placement[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <Instances limit={Math.max(items.length, 1)} castShadow>
        <coneGeometry args={[0.1, 0.35, 6]} />
        <meshStandardMaterial
          color="#cde8ff"
          emissive="#8cc8ff"
          emissiveIntensity={0.25}
          transparent
          opacity={0.85}
          roughness={0.25}
          metalness={0.1}
        />
        {items.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, 0.18 * p.scale, p.z]}
            rotation={[0.05, p.rot, 0]}
            scale={[p.scale, p.scale * 1.2, p.scale]}
          />
        ))}
      </Instances>
      {/* Smaller secondary shards */}
      <Instances limit={Math.max(items.length, 1)}>
        <coneGeometry args={[0.05, 0.2, 5]} />
        <meshStandardMaterial color="#e4f2ff" emissive="#a6d4f5" emissiveIntensity={0.18} />
        {items.map((p, i) => (
          <Instance
            key={i}
            position={[p.x + 0.12 * p.scale, 0.12 * p.scale, p.z + 0.04]}
            rotation={[0, p.rot + 1.1, 0.3]}
            scale={[p.scale * 0.7, p.scale * 0.9, p.scale * 0.7]}
          />
        ))}
      </Instances>
    </>
  );
}

function Mushrooms({ items }: { items: Placement[] }) {
  if (items.length === 0) return null;
  const capColor = (variant: number) => (variant === 1 ? "#c0704f" : "#c24c3c");
  return (
    <>
      {/* Stems */}
      <Instances limit={Math.max(items.length, 1)} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.14, 6]} />
        <meshStandardMaterial color="#f0e5c6" roughness={0.9} />
        {items.map((p, i) => (
          <Instance key={i} position={[p.x, 0.07 * p.scale, p.z]} scale={[p.scale, p.scale, p.scale]} />
        ))}
      </Instances>
      {/* Caps */}
      {items.map((p, i) => (
        <mesh key={i} position={[p.x, 0.16 * p.scale, p.z]} castShadow>
          <sphereGeometry args={[0.08 * p.scale, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={capColor(p.variant)} roughness={0.7} />
        </mesh>
      ))}
    </>
  );
}

function SnowMounds({ items }: { items: Placement[] }) {
  if (items.length === 0) return null;
  return (
    <Instances limit={Math.max(items.length, 1)} castShadow>
      <sphereGeometry args={[0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#f6f8fb" roughness={0.75} />
      {items.map((p, i) => (
        <Instance
          key={i}
          position={[p.x, 0.01, p.z]}
          rotation={[0, p.rot, 0]}
          scale={[p.scale, p.scale * 0.55, p.scale]}
        />
      ))}
    </Instances>
  );
}

function Reeds({ items }: { items: Placement[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <Instances limit={Math.max(items.length, 1)} castShadow={false}>
        <cylinderGeometry args={[0.015, 0.02, 0.45, 5]} />
        <meshStandardMaterial color="#5a7a42" roughness={0.9} />
        {items.map((p, i) => (
          <Instance
            key={i}
            position={[p.x, 0.22 * p.scale, p.z]}
            rotation={[0.08, p.rot, (p.variant - 0.5) * 0.2]}
            scale={[p.scale, p.scale, p.scale]}
          />
        ))}
      </Instances>
      {/* Fuzzy seed tops */}
      <Instances limit={Math.max(items.length, 1)}>
        <sphereGeometry args={[0.03, 6, 5]} />
        <meshStandardMaterial color="#a89458" roughness={0.9} />
        {items.map((p, i) => (
          <Instance key={i} position={[p.x, 0.46 * p.scale, p.z]} scale={[p.scale, p.scale * 1.4, p.scale]} />
        ))}
      </Instances>
    </>
  );
}

/** Decorative fence rail around town plaza tiles. */
export function TownFencing() {
  const snapshot = useGameStore();
  const worldVersion = snapshot.world.worldVersion;

  const posts = useMemo(() => {
    const list: { x: number; z: number; rot: number }[] = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (terrainAt(x, y) !== "town") continue;
        const edges: [number, number, number, number, number][] = [
          [x - 1, y, x, y + 0.5, Math.PI / 2],
          [x + 1, y, x + 1, y + 0.5, Math.PI / 2],
          [x, y - 1, x + 0.5, y, 0],
          [x, y + 1, x + 0.5, y + 1, 0]
        ];
        for (const [nx, ny, ox, oz, rot] of edges) {
          const nk = terrainAt(nx, ny);
          if (nk === "town" || nk === "road") continue;
          list.push({ x: ox, z: oz, rot });
        }
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldVersion]);

  if (posts.length === 0) return null;
  return (
    <Instances limit={Math.max(posts.length, 1)} castShadow>
      <boxGeometry args={[0.06, 0.35, 0.06]} />
      <meshStandardMaterial color="#5a3a1c" roughness={0.95} />
      {posts.map((p, i) => (
        <Instance key={i} position={[p.x, 0.2, p.z]} rotation={[0, p.rot, 0]} />
      ))}
    </Instances>
  );
}

/** Ambient floating particles above water/forest for atmosphere — biome-tinted. */
export function AmbientSparkles() {
  const snapshot = useGameStore();
  const worldVersion = snapshot.world.worldVersion;

  const sparkles = useMemo(() => {
    const list: { x: number; y: number; z: number; color: string }[] = [];
    const tiles = MAP_W * MAP_H;
    const sparkleStride = tiles > 80_000 ? 2 : 1;
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (sparkleStride > 1 && (tx % sparkleStride !== 0 || ty % sparkleStride !== 0)) continue;
        const kind = terrainAt(tx, ty);
        const biome = biomeAt(tx, ty);
        if (kind !== "water" && kind !== "forest") continue;
        const h = tileHash(tx, ty, 5555);
        if (h.r1 < 0.08) {
          let color = "#9bd5ff";
          if (kind === "forest") color = "#b6ffa1";
          if (biome === "swamp") color = "#c6f87a";
          if (biome === "tundra") color = "#dff3ff";
          if (biome === "desert") color = "#ffe58a";
          list.push({
            x: tx + 0.2 + h.r1 * 0.6,
            y: 0.7 + h.r2 * 0.6,
            z: ty + 0.2 + h.r3 * 0.6,
            color
          });
          if (list.length >= 3500) return list;
        }
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldVersion]);

  const pointsGeo = useMemo(() => {
    const positions = new Float32Array(sparkles.length * 3);
    const colors = new Float32Array(sparkles.length * 3);
    const color = new THREE.Color();
    sparkles.forEach((s, i) => {
      positions[i * 3] = s.x;
      positions[i * 3 + 1] = s.y;
      positions[i * 3 + 2] = s.z;
      color.set(s.color);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [sparkles]);

  return (
    <points geometry={pointsGeo}>
      <pointsMaterial vertexColors size={0.07} transparent opacity={0.75} sizeAttenuation />
    </points>
  );
}
