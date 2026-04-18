/**
 * Procedural world generator.
 *
 * Pure module — must not import game state. Consumers feed the output into
 * `worldMap.ts` via `regenerateWorld(seed)`.
 */

import type { BiomeKind } from "./types";

export type TerrainCode = 0 | 1 | 2 | 3 | 4;
export const TERRAIN_GRASS: TerrainCode = 0;
export const TERRAIN_ROAD: TerrainCode = 1;
export const TERRAIN_WATER: TerrainCode = 2;
export const TERRAIN_TOWN: TerrainCode = 3;
export const TERRAIN_FOREST: TerrainCode = 4;

export const BIOME_CODE: Record<BiomeKind, number> = {
  meadow: 0,
  forest: 1,
  desert: 2,
  swamp: 3,
  tundra: 4
};

export const BIOME_BY_CODE: BiomeKind[] = ["meadow", "forest", "desert", "swamp", "tundra"];

export type BuildingKind =
  | "inn"
  | "shop"
  | "train"
  | "guild"
  | "petShop"
  | "boss"
  /** Replaces the boss arena tile after the Void Titan is defeated — not generated initially. */
  | "voidPortal"
  | "library"
  | "forge"
  | "chapel"
  | "stables"
  | "market";

export interface GeneratedBuilding {
  kind: BuildingKind;
  x: number;
  y: number;
}

export interface GeneratedWorld {
  seed: number;
  width: number;
  height: number;
  /** row-major width*height tile codes */
  tiles: Uint8Array;
  /** row-major width*height biome codes (see BIOME_CODE) */
  biomes: Uint8Array;
  buildings: GeneratedBuilding[];
  spawnX: number;
  spawnY: number;
  bossTile: { x: number; y: number };
  /** Center tiles of every town. Used by the Town Map compass and navigation. */
  towns: { x: number; y: number }[];
}

/** Deterministic small PRNG — mulberry32. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

/**
 * Area multiplier vs the baseline ~52–80 × 36–54 tile worlds (1 = classic size).
 * Per-axis scale is `sqrt(WORLD_AREA_MULTIPLIER)`. Raise later if you add streaming / LOD.
 */
export const WORLD_AREA_MULTIPLIER = 1;

function worldAxisScale(): number {
  return Math.sqrt(WORLD_AREA_MULTIPLIER);
}

export function generateWorld(seed: number = randomSeed()): GeneratedWorld {
  const rng = mulberry32(seed);
  const ri = (lo: number, hi: number) => Math.floor(rng() * (hi - lo + 1)) + lo;

  const S = worldAxisScale();
  const width = ri(Math.round(52 * S), Math.round(80 * S));
  const height = ri(Math.round(36 * S), Math.round(54 * S));
  const tiles = new Uint8Array(width * height); // defaults to 0 = grass

  const idx = (x: number, y: number) => y * width + x;
  const inBounds = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height;
  const getT = (x: number, y: number): TerrainCode =>
    inBounds(x, y) ? (tiles[idx(x, y)] as TerrainCode) : TERRAIN_WATER;
  const setT = (x: number, y: number, t: TerrainCode) => {
    if (inBounds(x, y)) tiles[idx(x, y)] = t;
  };

  // ── 1. Lakes (random walk expansion) ────────────────────────────────────
  const lakeCount = ri(1, 3);
  for (let i = 0; i < lakeCount; i++) {
    const cx = ri(6, width - 7);
    const cy = ri(4, height - 5);
    const target = ri(25, 70);
    const queue: [number, number][] = [[cx, cy]];
    let placed = 0;
    let guard = 0;
    while (queue.length && placed < target && guard++ < Math.max(4000, Math.floor((width * height) / 20))) {
      const pop = queue.shift();
      if (!pop) break;
      const [x, y] = pop;
      if (!inBounds(x, y) || tiles[idx(x, y)] !== TERRAIN_GRASS) continue;
      if (rng() < 0.22) continue;
      setT(x, y, TERRAIN_WATER);
      placed++;
      if (rng() < 0.85) queue.push([x + 1, y]);
      if (rng() < 0.85) queue.push([x - 1, y]);
      if (rng() < 0.85) queue.push([x, y + 1]);
      if (rng() < 0.85) queue.push([x, y - 1]);
    }
  }

  // ── 2. Forest clusters ──────────────────────────────────────────────────
  const forestCount = ri(4, 9);
  for (let i = 0; i < forestCount; i++) {
    const cx = ri(2, width - 3);
    const cy = ri(2, height - 3);
    const target = ri(4, 14);
    const queue: [number, number][] = [[cx, cy]];
    let placed = 0;
    let guard = 0;
    while (queue.length && placed < target && guard++ < Math.max(400, Math.floor((width * height) / 80))) {
      const pop = queue.shift();
      if (!pop) break;
      const [x, y] = pop;
      if (!inBounds(x, y) || tiles[idx(x, y)] !== TERRAIN_GRASS) continue;
      if (rng() < 0.2) continue;
      setT(x, y, TERRAIN_FOREST);
      placed++;
      if (rng() < 0.7) queue.push([x + 1, y]);
      if (rng() < 0.7) queue.push([x - 1, y]);
      if (rng() < 0.7) queue.push([x, y + 1]);
      if (rng() < 0.7) queue.push([x, y - 1]);
    }
  }

  // ── 3. Towns ────────────────────────────────────────────────────────────
  const pickTownCenter = (xMin: number, xMax: number, yMin: number, yMax: number) => {
    for (let tries = 0; tries < 80; tries++) {
      const x = ri(xMin + 3, xMax - 3);
      const y = ri(yMin + 2, yMax - 2);
      let ok = true;
      let waterNearby = 0;
      for (let dy = -1; dy <= 1 && ok; dy++) {
        for (let dx = -3; dx <= 3 && ok; dx++) {
          if (getT(x + dx, y + dy) === TERRAIN_WATER) waterNearby++;
        }
      }
      if (waterNearby < 3) return { x, y };
    }
    return { x: Math.floor((xMin + xMax) / 2), y: Math.floor((yMin + yMax) / 2) };
  };

  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  const townA = pickTownCenter(2, midX - 5, 2, midY);
  const townB = pickTownCenter(midX + 5, width - 3, midY - 2, height - 3);

  const carveTown = (c: { x: number; y: number }) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        setT(c.x + dx, c.y + dy, TERRAIN_TOWN);
      }
    }
  };
  carveTown(townA);
  carveTown(townB);

  // ── 4. Buildings ────────────────────────────────────────────────────────
  // Guaranteed: core services (inn, shop, train, guild, pet) plus five extra town types.
  const buildings: GeneratedBuilding[] = [];
  const townABuildingKinds: BuildingKind[] = ["inn", "shop", "library", "forge", "market"];
  const townBBuildingKinds: BuildingKind[] = ["train", "guild", "petShop", "chapel", "stables"];
  if (rng() < 0.5) {
    townBBuildingKinds.push("inn");
  }
  if (rng() < 0.4) {
    townABuildingKinds.push("guild");
  }

  const placeBuildingsAround = (center: { x: number; y: number }, kinds: BuildingKind[]) => {
    // Row through the town center. Use distinct x offsets so buildings don't overlap.
    const offsets = [-2, 2, -3, 3, -1, 1, 0];
    let offIdx = 0;
    for (const kind of kinds) {
      const off = offsets[offIdx++ % offsets.length];
      const bx = center.x + off;
      const by = center.y + (rng() < 0.5 ? -1 : 1) * (rng() < 0.5 ? 0 : 1);
      const finalY = Math.max(0, Math.min(height - 1, by));
      buildings.push({ kind, x: bx, y: finalY });
      setT(bx, finalY, TERRAIN_TOWN);
    }
  };
  placeBuildingsAround(townA, townABuildingKinds);
  placeBuildingsAround(townB, townBBuildingKinds);

  // ── 5. Boss arena ───────────────────────────────────────────────────────
  const bossCandidates: { x: number; y: number }[] = [
    { x: width - 4, y: 3 },
    { x: 3, y: height - 4 },
    { x: width - 4, y: height - 4 },
    { x: 3, y: 3 }
  ];
  let boss = bossCandidates[0];
  let bestDist = 0;
  for (const c of bossCandidates) {
    const d = Math.min(
      Math.hypot(c.x - townA.x, c.y - townA.y),
      Math.hypot(c.x - townB.x, c.y - townB.y)
    );
    if (d > bestDist) {
      bestDist = d;
      boss = c;
    }
  }
  // Clear boss arena 3x3 of water/forest
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const t = getT(boss.x + dx, boss.y + dy);
      if (t === TERRAIN_WATER || t === TERRAIN_FOREST) {
        setT(boss.x + dx, boss.y + dy, TERRAIN_GRASS);
      }
    }
  }
  buildings.push({ kind: "boss", x: boss.x, y: boss.y });

  // ── 6. Roads connecting landmarks ───────────────────────────────────────
  /** Carves an L-shaped path (x then y), turning water into bridges and forest into road. */
  const carveRoad = (x1: number, y1: number, x2: number, y2: number) => {
    let x = x1;
    let y = y1;
    const step = () => {
      if (!inBounds(x, y)) return;
      const t = tiles[idx(x, y)] as TerrainCode;
      if (t !== TERRAIN_TOWN) {
        tiles[idx(x, y)] = TERRAIN_ROAD;
      }
    };
    while (x !== x2) {
      step();
      x += x < x2 ? 1 : -1;
    }
    while (y !== y2) {
      step();
      y += y < y2 ? 1 : -1;
    }
    step();
  };

  carveRoad(townA.x, townA.y, townB.x, townB.y);
  carveRoad(townB.x, townB.y, boss.x, boss.y);
  if (rng() < 0.6) {
    // A wandering detour for flavor
    carveRoad(townA.x, townA.y, midX, midY);
  }

  // ── 7. Biome regions (Voronoi with meadow anchored at town A) ───────────
  const biomes = generateBiomeMap(width, height, townA, townB, rng);

  // ── 8. Spawn on town A ──────────────────────────────────────────────────
  const spawnX = townA.x;
  const spawnY = townA.y;

  return {
    seed,
    width,
    height,
    tiles,
    biomes,
    buildings,
    spawnX,
    spawnY,
    bossTile: { x: boss.x, y: boss.y },
    towns: [
      { x: townA.x, y: townA.y },
      { x: townB.x, y: townB.y }
    ]
  };
}

/**
 * Seed a weighted Voronoi biome map with randomly-sized regions.
 *
 * Each anchor carries a `weight` that acts as a size multiplier: a tile picks
 * the anchor that minimizes `distance² / weight²`, so an anchor with weight 2
 * claims roughly 4× the area of a weight-1 anchor. Combining variable weights
 * with a variable anchor count (2–6 extras) plus the occasional "dominant"
 * anchor means some worlds are mostly-desert with tiny forest pockets, others
 * are a balanced patchwork of four biomes, and so on.
 *
 * Border shapes are distorted by a low-frequency wave + per-tile jitter so the
 * edges look organic rather than perfectly curved.
 *
 * Town anchors are always meadow so the opening area stays welcoming, but
 * their weight is modest — a strong neighbour can still push up to a town's
 * fence-line for dramatic biome contrast.
 */
function generateBiomeMap(
  width: number,
  height: number,
  townA: { x: number; y: number },
  townB: { x: number; y: number },
  rng: () => number
): Uint8Array {
  const out = new Uint8Array(width * height);

  type Anchor = { x: number; y: number; biome: BiomeKind; weight: number };

  // Meadow anchors on both towns. Weight varies per world so some starts are
  // a sprawling meadow kingdom and others are tiny green islands in a
  // dominant foreign biome.
  const anchors: Anchor[] = [
    { x: townA.x, y: townA.y, biome: "meadow", weight: 0.85 + rng() * 0.55 },
    { x: townB.x, y: townB.y, biome: "meadow", weight: 0.75 + rng() * 0.5 }
  ];

  const deck: BiomeKind[] = ["forest", "desert", "swamp", "tundra", "forest", "desert", "tundra", "swamp"];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // 2–6 additional anchors — so worlds range from "two big biomes split in
  // half" to "fragmented mosaic of six small pockets".
  const extraAnchors = 2 + Math.floor(rng() * 5);

  // 35% chance one anchor becomes "dominant" (much larger weight), letting a
  // single biome theme most of the world occasionally.
  const dominantIdx = rng() < 0.35 ? Math.floor(rng() * extraAnchors) : -1;

  for (let i = 0; i < extraAnchors; i++) {
    const biome = deck[i % deck.length];
    let ax = 0;
    let ay = 0;
    for (let t = 0; t < 40; t++) {
      ax = Math.floor(rng() * width);
      ay = Math.floor(rng() * height);
      const dA = Math.hypot(ax - townA.x, ay - townA.y);
      const dB = Math.hypot(ax - townB.x, ay - townB.y);
      if (dA > 8 && dB > 8) break;
    }

    // Weight distribution: mostly 0.55–1.65 (small-to-generous), rarely a
    // "dwarf" pocket (≈0.4) or a "dominant" sprawl (≈2.0–2.6).
    let weight: number;
    if (i === dominantIdx) {
      weight = 1.9 + rng() * 0.75;
    } else if (rng() < 0.25) {
      weight = 0.35 + rng() * 0.3;
    } else {
      weight = 0.6 + rng() * 1.1;
    }

    anchors.push({ x: ax, y: ay, biome, weight });
  }

  // Cheap low-frequency "wave" distortion — seed-phased so different worlds
  // get differently-shaped borders. Gives biome edges a flowing, organic feel
  // rather than the clean arcs raw Voronoi produces.
  const wavePhaseX = rng() * Math.PI * 2;
  const wavePhaseY = rng() * Math.PI * 2;
  const waveFreqA = 0.11 + rng() * 0.08;
  const waveFreqB = 0.08 + rng() * 0.07;
  const waveAmp = 1.8 + rng() * 1.6; // 1.8–3.4 tiles

  // Per-tile stable jitter for small-scale roughness.
  const jitter = (x: number, y: number) => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + anchors.length) * 43758.5453;
    return (n - Math.floor(n)) - 0.5; // -0.5..0.5
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Wave-distorted sample position — same value reused for every anchor
      // comparison so the border shape is coherent, not noisy.
      const waveX = Math.sin(x * waveFreqA + y * waveFreqB + wavePhaseX) * waveAmp;
      const waveY = Math.cos(y * waveFreqA + x * waveFreqB + wavePhaseY) * waveAmp;
      const px = x + waveX + jitter(x, y) * 0.8;
      const py = y + waveY + jitter(y + 1, x + 7) * 0.8;

      let bestScore = Infinity;
      let bestBiome: BiomeKind = "meadow";
      for (const a of anchors) {
        const dx = px - a.x;
        const dy = py - a.y;
        const d2 = dx * dx + dy * dy;
        // Weighted Voronoi: higher weight → smaller score → larger region.
        const score = d2 / (a.weight * a.weight);
        if (score < bestScore) {
          bestScore = score;
          bestBiome = a.biome;
        }
      }
      out[y * width + x] = BIOME_CODE[bestBiome];
    }
  }

  return out;
}
