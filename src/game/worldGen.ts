/**
 * Procedural world generator.
 *
 * Pure module — must not import game state. Consumers feed the output into
 * `worldMap.ts` via `regenerateWorld(seed)`.
 */

import type { BiomeKind } from "./types";

export type TerrainCode = 0 | 1 | 2 | 3 | 4 | 5;
export const TERRAIN_GRASS: TerrainCode = 0;
export const TERRAIN_ROAD: TerrainCode = 1;
export const TERRAIN_WATER: TerrainCode = 2;
export const TERRAIN_TOWN: TerrainCode = 3;
export const TERRAIN_FOREST: TerrainCode = 4;
/** Walkable rough terrain — slows movement (~55% speed) and gives +15% damage when attacking from it. */
export const TERRAIN_HILL: TerrainCode = 5;

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
  /**
   * Stable rift placed near the spawn of portal realms (realmTier ≥ 2) that sends
   * the player back to a freshly generated tier-1 world.
   */
  | "returnPortal"
  /** Ominous entrance with a carved "DUNGEON" sign — only generated in realm 2+. */
  | "dungeon"
  | "library"
  | "forge"
  | "chapel"
  | "stables"
  | "market"
  /** Royal audience (spawn castle, realm tier 1 only). */
  | "throne"
  /** Wilderness landmark — full HP, no gold (one per world). */
  | "restoreSpring";

export interface GeneratedBuilding {
  kind: BuildingKind;
  x: number;
  y: number;
  /** Which settlement this service belongs to (boss / void portal omit). */
  townId?: 0 | 1;
}

/** A named settlement carved into the map (two per world). */
export interface GeneratedTown {
  id: 0 | 1;
  x: number;
  y: number;
  name: string;
  epithet: string;
}

/** One stretch of castle curtain wall (map x → 3D X, map y → 3D Z). */
export interface CastleWallSegment {
  tx: number;
  ty: number;
  /** East–west wall runs along map X; north–south along map Y. */
  along: "ew" | "ns";
}

/** Crownkeep (realm 1 spawn castle): paved interior, south gate triggers, wall mesh. */
export interface CrownkeepLayout {
  /** Inclusive tile bounds of the full castle yard inside the curtain wall. */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Stand on any of these overworld tiles (south of the gate gap) to enter the throne hall interior. */
  gateTiles: { tx: number; ty: number }[];
}

export interface GeneratedWorld {
  seed: number;
  realmTier: number;
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
  /** Named towns (centers + flavor). Used by compass, revival warp, and HUD. */
  towns: GeneratedTown[];
  /**
   * Realm tier 1 only: stone curtain wall around Crownkeep (spawn castle), one segment per tile edge.
   * Not buildings — pure perimeter mesh in 3D.
   */
  crownkeepCastleWalls: CastleWallSegment[] | null;
  /** Realm tier 1 only: castle courtyard footprint + gate interaction tiles. */
  crownkeep: CrownkeepLayout | null;
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

/** Themed names for the two settlements on each map (picked deterministically from the world seed). */
const TOWN_PROFILES: readonly { name: string; epithet: string }[] = [
  { name: "Ashenford", epithet: "Mills & guild barges on the Greywater" },
  { name: "Highmere", epithet: "Stepped streets under signal beacons" },
  { name: "Copperwell", epithet: "Ore ledgers & brass market bells" },
  { name: "Thornbury", epithet: "Walled hedgerows & tincture-makers" },
  { name: "Saltreef", epithet: "Smoke sheds and cedar drying racks" },
  { name: "Moonhollow", epithet: "Quiet wells and night-watch lanterns" },
  { name: "Ironbarrow", epithet: "Foundries ring the old circuit road" },
  { name: "Emberwick", epithet: "Coal-docks and chantry choirs" },
  { name: "Greystone", epithet: "Granaries carved into hillside shelves" },
  { name: "Oakhaul", epithet: "Timber yards & wagons rolling at dawn" },
  { name: "Mistfen", epithet: "Boardwalks over peat & reed lamps" },
  { name: "Northreach", epithet: "Signal towers watch the wilds track" },
  { name: "Dawnrest", epithet: "Guest-halls for rangers riding in" },
  { name: "Silvermere", epithet: "Glass arcades over a mirrored canal" },
  { name: "Coldharbor", epithet: "Ice-break wharves & fur-guild ink" },
  { name: "Ashglen", epithet: "Charcoal orchards & pilgrims' shrines" }
];

function pickTwoTownProfiles(rng: () => number): { a: { name: string; epithet: string }; b: { name: string; epithet: string } } {
  const n = TOWN_PROFILES.length;
  const iA = Math.floor(rng() * n);
  let iB = Math.floor(rng() * n);
  let guard = 0;
  while (iB === iA && guard++ < 12) {
    iB = Math.floor(rng() * n);
  }
  if (iB === iA) {
    iB = (iA + 1 + Math.floor(rng() * Math.max(1, n - 1))) % n;
  }
  return { a: TOWN_PROFILES[iA]!, b: TOWN_PROFILES[iB]! };
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

/**
 * Area multiplier vs the baseline ~52–80 × 36–54 tile worlds (1 = classic size).
 * Per-axis scale is `sqrt(WORLD_AREA_MULTIPLIER)`. Raise later if you add streaming / LOD.
 */
export const WORLD_AREA_MULTIPLIER = 1;

/** Crownkeep outer yard footprint for realm 1 spawn (12x12 tiles). */
const CASTLE_WALL_SIZE = 12;
/** Royal hall footprint (3x3 tiles = 9 blocks). */
const ROYAL_HALL_SIZE = 3;
/** Keep the full 12x12 castle inset from world edges. */
const CASTLE_EDGE_BUFFER = 2;
const CASTLE_LEFT_RADIUS = Math.floor((CASTLE_WALL_SIZE - 1) / 2);
const CASTLE_RIGHT_RADIUS = CASTLE_WALL_SIZE - CASTLE_LEFT_RADIUS - 1;
const CASTLE_TOP_RADIUS = CASTLE_LEFT_RADIUS;
const CASTLE_BOTTOM_RADIUS = CASTLE_RIGHT_RADIUS;

function worldAxisScale(): number {
  return Math.sqrt(WORLD_AREA_MULTIPLIER);
}

/** 12x12 Crownkeep bounds around a center tile (asymmetric radii for even size). */
function spawnCastleBounds(center: { x: number; y: number }): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: center.x - CASTLE_LEFT_RADIUS,
    maxX: center.x + CASTLE_RIGHT_RADIUS,
    minY: center.y - CASTLE_TOP_RADIUS,
    maxY: center.y + CASTLE_BOTTOM_RADIUS
  };
}

export function generateWorld(
  seed: number = randomSeed(),
  opts?: {
    /** 1 = original Aetheria, 2+ = portal realms with alternate biome/building themes. */
    realmTier?: number;
  }
): GeneratedWorld {
  const realmTier = Math.max(1, Math.floor(opts?.realmTier ?? 1));
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

  // ── 2b. Hills (walkable but slower; grown from seed points on grass) ────
  const hillCount = ri(3, 7);
  for (let i = 0; i < hillCount; i++) {
    const cx = ri(2, width - 3);
    const cy = ri(2, height - 3);
    const target = ri(3, 8);
    const queue: [number, number][] = [[cx, cy]];
    let placed = 0;
    let guard = 0;
    while (queue.length && placed < target && guard++ < 120) {
      const pop = queue.shift();
      if (!pop) break;
      const [x, y] = pop;
      if (!inBounds(x, y) || tiles[idx(x, y)] !== TERRAIN_GRASS) continue;
      if (rng() < 0.25) continue;
      setT(x, y, TERRAIN_HILL);
      placed++;
      if (rng() < 0.6) queue.push([x + 1, y]);
      if (rng() < 0.6) queue.push([x - 1, y]);
      if (rng() < 0.6) queue.push([x, y + 1]);
      if (rng() < 0.6) queue.push([x, y - 1]);
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
  const pickCastleCenter = (xMin: number, xMax: number, yMin: number, yMax: number) => {
    const minCx = xMin + CASTLE_LEFT_RADIUS;
    const maxCx = xMax - CASTLE_RIGHT_RADIUS;
    const minCy = yMin + CASTLE_TOP_RADIUS;
    const maxCy = yMax - CASTLE_BOTTOM_RADIUS;
    for (let tries = 0; tries < 120; tries++) {
      const x = ri(minCx, maxCx);
      const y = ri(minCy, maxCy);
      const b = spawnCastleBounds({ x, y });
      let waterNearby = 0;
      for (let yy = b.minY - 1; yy <= b.maxY + 1; yy++) {
        for (let xx = b.minX - 1; xx <= b.maxX + 1; xx++) {
          if (getT(xx, yy) === TERRAIN_WATER) waterNearby++;
        }
      }
      if (waterNearby <= 12) return { x, y };
    }
    const fallbackX = Math.max(minCx, Math.min(maxCx, Math.floor((xMin + xMax) / 2)));
    const fallbackY = Math.max(minCy, Math.min(maxCy, Math.floor((yMin + yMax) / 2)));
    return { x: fallbackX, y: fallbackY };
  };

  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  const townA =
    realmTier === 1
      ? pickCastleCenter(CASTLE_EDGE_BUFFER, midX - CASTLE_EDGE_BUFFER - 1, CASTLE_EDGE_BUFFER, midY)
      : pickTownCenter(2, midX - 5, 2, midY);
  const townB = pickTownCenter(midX + 5, width - 3, midY - 2, height - 3);
  const profiles = pickTwoTownProfiles(rng);

  /**
   * Carve a wider plaza (rough rectangle with softened corners) for each
   * settlement. halfW / halfH must fully contain the building-offset ring
   * below (which reaches Chebyshev distance 4), otherwise outer-ring slots
   * would land on grass/forest/water tiles and produce isolated huts that
   * visually read as "outside of town". That bug shipped with the old
   * halfH = 2–3, which couldn't hold the dy=±4 offsets.
   */
  const carveTownPlaza = (c: { x: number; y: number }) => {
    const halfW = 4 + (rng() < 0.55 ? 1 : 0);
    const halfH = 4 + (rng() < 0.45 ? 1 : 0);
    for (let dy = -halfH; dy <= halfH; dy++) {
      for (let dx = -halfW; dx <= halfW; dx++) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (!inBounds(nx, ny)) continue;
        const cornerX = Math.abs(dx) === halfW;
        const cornerY = Math.abs(dy) === halfH;
        if (cornerX && cornerY && rng() < 0.28) continue;
        setT(nx, ny, TERRAIN_TOWN);
      }
    }
    return { halfW, halfH };
  };
  let crownPlaza = carveTownPlaza(townA);
  carveTownPlaza(townB);
  let crownkeepBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
  if (realmTier === 1) {
    const b = spawnCastleBounds(townA);
    for (let y = b.minY; y <= b.maxY; y++) {
      for (let x = b.minX; x <= b.maxX; x++) {
        if (!inBounds(x, y)) continue;
        setT(x, y, TERRAIN_TOWN);
      }
    }
    crownkeepBounds = b;
    // Keep downstream wall/gate logic deterministic around a fixed 12x12 castle.
    crownPlaza = { halfW: CASTLE_LEFT_RADIUS, halfH: CASTLE_TOP_RADIUS };
  }

  // ── 4. Buildings ────────────────────────────────────────────────────────
  // Every village includes inn + shop + guild; extras vary by realm.
  const buildings: GeneratedBuilding[] = [];
  const villageCore: BuildingKind[] = ["inn", "shop", "guild"];
  let townABuildingKinds: BuildingKind[];
  let townBBuildingKinds: BuildingKind[];
  if (realmTier >= 2) {
    townABuildingKinds = [...villageCore, "library", "forge", "market", "chapel", "stables"];
    townBBuildingKinds = [...villageCore, "library", "forge", "market", "chapel", "stables", "train", "petShop"];
  } else {
    // First settlement is the crown's castle — royal audience is inside the keep (see throne hall interior).
    townABuildingKinds = [...villageCore, "library", "forge", "market"];
    townBBuildingKinds = [...villageCore, "train", "petShop", "chapel", "stables"];
  }

  const shuffleBuildingOffsets = (center: { x: number; y: number }): { dx: number; dy: number }[] => {
    // Two concentric rings around the town plaza; every offset is at least
    // Chebyshev distance 2 from the plaza center and from every other ring slot,
    // so buildings never touch — there's always at least one grass tile between
    // them once the min-distance check below picks them.
    const offsets: { dx: number; dy: number }[] = [
      // Inner ring (distance 2)
      { dx: -2, dy: -2 }, { dx: 0, dy: -2 }, { dx: 2, dy: -2 },
      { dx: -2, dy: 0 },                     { dx: 2, dy: 0 },
      { dx: -2, dy: 2 },  { dx: 0, dy: 2 },  { dx: 2, dy: 2 },
      // Outer ring (distance 3–4) for larger towns
      { dx: -4, dy: -2 }, { dx: -4, dy: 0 }, { dx: -4, dy: 2 },
      { dx: 4, dy: -2 },  { dx: 4, dy: 0 },  { dx: 4, dy: 2 },
      { dx: -2, dy: -4 }, { dx: 0, dy: -4 }, { dx: 2, dy: -4 },
      { dx: -2, dy: 4 },  { dx: 0, dy: 4 },  { dx: 2, dy: 4 },
      { dx: -4, dy: -4 }, { dx: 4, dy: -4 }, { dx: -4, dy: 4 }, { dx: 4, dy: 4 }
    ];
    for (let i = offsets.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [offsets[i], offsets[j]] = [offsets[j]!, offsets[i]!];
    }
    return offsets.filter((off) => {
      const bx = center.x + off.dx;
      const by = center.y + off.dy;
      if (bx < 0 || bx >= width || by < 0 || by >= height) return false;
      // Only accept offsets that actually landed inside the plaza the
      // caller just carved. Belt-and-suspenders safety net for edge cases
      // where the plaza gets clipped (near map borders, or inside the
      // Crownkeep curtain wall footprint) so buildings never spawn on
      // grass/water/forest tiles surrounded by wilderness.
      return getT(bx, by) === TERRAIN_TOWN;
    });
  };

  // Crownkeep royal hall (realm 1 only) — claim the top-centre plaza tile
  // *before* the other town buildings fill the ring so nothing else gets
  // dropped on top of it.
  let throneTile: { x: number; y: number } | null = null;
  if (realmTier === 1 && crownkeepBounds) {
    const rx = townA.x;
    const ry = crownkeepBounds.minY + Math.floor(ROYAL_HALL_SIZE / 2);
    if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = rx + dx;
          const ny = ry + dy;
          if (!inBounds(nx, ny)) continue;
          setT(nx, ny, TERRAIN_TOWN);
        }
      }
      throneTile = { x: rx, y: ry };
      buildings.push({ kind: "throne", x: rx, y: ry, townId: 0 });
    }
  }

  const placeBuildingsAround = (center: { x: number; y: number }, kinds: BuildingKind[], townId: 0 | 1) => {
    const offsets = shuffleBuildingOffsets(center);
    // Enforce Chebyshev distance ≥ 2 between any two placed buildings so they
    // never sit on neighbouring tiles (at least one gap tile between them).
    const MIN_CHEBYSHEV = 2;
    const placed: { x: number; y: number }[] = [];
    // Treat the royal hall as already placed for spacing purposes so the
    // shops around Crownkeep respect its top-centre footprint.
    if (townId === 0 && throneTile) placed.push(throneTile);
    const farEnough = (bx: number, by: number): boolean =>
      placed.every((p) => Math.max(Math.abs(p.x - bx), Math.abs(p.y - by)) >= MIN_CHEBYSHEV);
    for (const kind of kinds) {
      let didPlace = false;
      // Two passes: first honour the spacing rule; if the ring has no valid
      // slot left (small-map edge case) fall back to any in-bounds offset so
      // we still place every requested service.
      for (const requireSpacing of [true, false]) {
        if (didPlace) break;
        for (const off of offsets) {
          const bx = Math.max(0, Math.min(width - 1, center.x + off.dx));
          const by = Math.max(0, Math.min(height - 1, center.y + off.dy));
          if (placed.some((p) => p.x === bx && p.y === by)) continue;
          if (requireSpacing && !farEnough(bx, by)) continue;
          buildings.push({ kind, x: bx, y: by, townId });
          setT(bx, by, TERRAIN_TOWN);
          placed.push({ x: bx, y: by });
          didPlace = true;
          break;
        }
      }
    }
  };
  placeBuildingsAround(townA, townABuildingKinds, 0);
  placeBuildingsAround(townB, townBBuildingKinds, 1);

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

  // ── 5b. Return portal (portal realms only) ──────────────────────────────
  // A stable rift placed next to the spawn town so the player can always find
  // their way back to a tier-1 world. Offset a few tiles so it isn't buried
  // under one of the town buildings, and clear water/forest on that tile.
  if (realmTier >= 2) {
    const isBuildingOccupied = (x: number, y: number) =>
      buildings.some((b) => b.x === x && b.y === y);
    const portalOffsets: Array<{ dx: number; dy: number }> = [
      { dx: 0, dy: -3 },
      { dx: 0, dy: 3 },
      { dx: -4, dy: 0 },
      { dx: 4, dy: 0 },
      { dx: -4, dy: -3 },
      { dx: 4, dy: -3 },
      { dx: -4, dy: 3 },
      { dx: 4, dy: 3 },
      { dx: 0, dy: -4 },
      { dx: 0, dy: 4 }
    ];
    let portalPos: { x: number; y: number } | null = null;
    for (const { dx, dy } of portalOffsets) {
      const px = townA.x + dx;
      const py = townA.y + dy;
      if (px < 1 || py < 1 || px >= width - 1 || py >= height - 1) continue;
      if (isBuildingOccupied(px, py)) continue;
      const t = getT(px, py);
      // Avoid carving straight through town tiles or roads.
      if (t === TERRAIN_TOWN || t === TERRAIN_ROAD) continue;
      portalPos = { x: px, y: py };
      break;
    }
    if (portalPos) {
      // Clear the portal tile (and a one-tile ring) of water/forest so the
      // player can actually walk onto it.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = portalPos.x + dx;
          const py = portalPos.y + dy;
          if (!inBounds(px, py)) continue;
          const t = getT(px, py);
          if (t === TERRAIN_WATER || t === TERRAIN_FOREST) {
            setT(px, py, TERRAIN_GRASS);
          }
        }
      }
      buildings.push({ kind: "returnPortal", x: portalPos.x, y: portalPos.y });
    }

    // ── 5c. Dungeon entrance ──────────────────────────────────────────────
    // Place a dungeon building on a remote grass tile (away from both towns,
    // boss, and the return portal) so finding it feels exploratory.
    const dungeonPos = (() => {
      const occupied = new Set<string>();
      for (const b of buildings) occupied.add(`${b.x},${b.y}`);
      const candidates: { x: number; y: number; score: number }[] = [];
      for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
          if (occupied.has(`${x},${y}`)) continue;
          const t = getT(x, y);
          if (t !== TERRAIN_GRASS && t !== TERRAIN_ROAD) continue;
          const dA = Math.hypot(x - townA.x, y - townA.y);
          const dB = Math.hypot(x - townB.x, y - townB.y);
          const dBoss = Math.hypot(x - boss.x, y - boss.y);
          // Prefer tiles that are far from everything but not adjacent to map edge.
          const score =
            Math.min(dA, dB) * 1.1 + dBoss * 0.4 + Math.min(x, y, width - x, height - y) * 0.2;
          if (dA < 8 || dB < 8 || dBoss < 6) continue;
          candidates.push({ x, y, score });
        }
      }
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => b.score - a.score);
      // Pick from the top 10% for a bit of variation per world.
      const topCount = Math.max(1, Math.floor(candidates.length * 0.1));
      const pick = candidates[Math.floor(rng() * topCount)]!;
      return { x: pick.x, y: pick.y };
    })();
    if (dungeonPos) {
      setT(dungeonPos.x, dungeonPos.y, TERRAIN_GRASS);
      // Ensure the adjacent tile north is walkable (sign faces south by convention).
      if (inBounds(dungeonPos.x, dungeonPos.y - 1)) {
        const t = getT(dungeonPos.x, dungeonPos.y - 1);
        if (t === TERRAIN_WATER || t === TERRAIN_FOREST) {
          setT(dungeonPos.x, dungeonPos.y - 1, TERRAIN_GRASS);
        }
      }
      buildings.push({ kind: "dungeon", x: dungeonPos.x, y: dungeonPos.y });
    }
  }

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

  // Roads enter Crownkeep through the south gate (the "front" of the castle)
  // — on realm 1 we anchor every road-exit at the tile just south of the gate
  // gap instead of routing from townA's center, which used to punch a
  // non-existent path straight through the east curtain wall.
  const crownFootprint =
    realmTier === 1 && crownkeepBounds
      ? {
          wx0: crownkeepBounds.minX,
          wx1: crownkeepBounds.maxX,
          wy0: crownkeepBounds.minY,
          wy1: crownkeepBounds.maxY,
          gapC: Math.floor((crownkeepBounds.minX + crownkeepBounds.maxX) / 2)
        }
      : null;
  const townAExit = crownFootprint
    ? { x: crownFootprint.gapC, y: Math.min(height - 1, crownFootprint.wy1 + 2) }
    : { x: townA.x, y: townA.y };

  carveRoad(townAExit.x, townAExit.y, townB.x, townB.y);
  carveRoad(townB.x, townB.y, boss.x, boss.y);
  if (rng() < 0.6) {
    // A wandering detour for flavor
    carveRoad(townAExit.x, townAExit.y, midX, midY);
  }

  // ── 6b. Crownkeep courtyard (realm 1): no lakes or wild grass inside the walls —
  //      paved as town so roamers & random encounters never appear there.
  let crownkeep: CrownkeepLayout | null = null;
  if (realmTier === 1 && crownFootprint) {
    const fp = crownFootprint;
    for (let y = fp.wy0; y <= fp.wy1; y++) {
      for (let x = fp.wx0; x <= fp.wx1; x++) {
        if (inBounds(x, y)) setT(x, y, TERRAIN_TOWN);
      }
    }
    const gateTiles: { tx: number; ty: number }[] = [];
    const southRow = fp.wy1 + 1;
    for (let gx = fp.gapC - 1; gx <= fp.gapC + 1; gx++) {
      if (inBounds(gx, southRow)) {
        setT(gx, southRow, TERRAIN_TOWN);
        gateTiles.push({ tx: gx, ty: southRow });
      }
    }
    // Extend the gate approach a couple of tiles further south as a stub of
    // road so the courtyard visibly meets the overworld path network.
    for (let dy = 2; dy <= 3; dy++) {
      const gy = fp.wy1 + dy;
      if (!inBounds(fp.gapC, gy)) break;
      const t = tiles[idx(fp.gapC, gy)] as TerrainCode;
      if (t !== TERRAIN_TOWN) setT(fp.gapC, gy, TERRAIN_ROAD);
    }
    crownkeep = {
      minX: fp.wx0,
      maxX: fp.wx1,
      minY: fp.wy0,
      maxY: fp.wy1,
      gateTiles
    };
  }

  // ── 7. Biome regions (Voronoi with meadow anchored at town A) ───────────
  const biomes = generateBiomeMap(width, height, townA, townB, rng, realmTier);

  // Keep the castle interior visually consistent (meadow stone / banners), not swamp etc.
  if (crownkeep) {
    const meadow = BIOME_CODE.meadow;
    for (let y = crownkeep.minY; y <= crownkeep.maxY; y++) {
      for (let x = crownkeep.minX; x <= crownkeep.maxX; x++) {
        if (inBounds(x, y)) biomes[idx(x, y)] = meadow;
      }
    }
    for (const g of crownkeep.gateTiles) {
      if (inBounds(g.tx, g.ty)) biomes[idx(g.tx, g.ty)] = meadow;
    }
  }

  // ── 7b. Restore spring (wilderness — walkable grass/road, away from towns) ─
  const tileOccupied = new Set(buildings.map((b) => `${b.x},${b.y}`));
  const minDistFromTown = 6;
  const springTileOk = (x: number, y: number): boolean => {
    if (!inBounds(x, y)) return false;
    const t = getT(x, y);
    if (t !== TERRAIN_GRASS && t !== TERRAIN_ROAD) return false;
    if (tileOccupied.has(`${x},${y}`)) return false;
    if (Math.hypot(x - townA.x, y - townA.y) < minDistFromTown) return false;
    if (Math.hypot(x - townB.x, y - townB.y) < minDistFromTown) return false;
    if (Math.abs(x - boss.x) <= 1 && Math.abs(y - boss.y) <= 1) return false;
    return true;
  };
  const springScore = (x: number, y: number): number => {
    let s = rng() * 0.02;
    const biome = BIOME_BY_CODE[biomes[idx(x, y)] ?? 0] ?? "meadow";
    if (biome === "swamp" || biome === "forest" || biome === "meadow") s += 2;
    let waterAdj = 0;
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0]
    ] as const) {
      if (getT(x + dx, y + dy) === TERRAIN_WATER) waterAdj++;
    }
    s += waterAdj * 3;
    if (getT(x, y) === TERRAIN_ROAD) s += 0.4;
    return s;
  };
  let bestSpring: { x: number; y: number; score: number } | null = null;
  for (let attempt = 0; attempt < 600; attempt++) {
    const x = ri(2, width - 3);
    const y = ri(2, height - 3);
    if (!springTileOk(x, y)) continue;
    const sc = springScore(x, y);
    if (!bestSpring || sc > bestSpring.score) bestSpring = { x, y, score: sc };
  }
  if (!bestSpring) {
    outer: for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        if (springTileOk(x, y)) {
          bestSpring = { x, y, score: springScore(x, y) };
          break outer;
        }
      }
    }
  }
  if (bestSpring) {
    buildings.push({ kind: "restoreSpring", x: bestSpring.x, y: bestSpring.y });
  }

  // ── 8. Spawn on town A ──────────────────────────────────────────────────
  const spawnX = townA.x;
  const spawnY = townA.y;

  const townMetaA: GeneratedTown = {
    id: 0,
    x: townA.x,
    y: townA.y,
    name: realmTier === 1 ? "Crownkeep" : profiles.a.name,
    epithet:
      realmTier === 1
        ? "The King's castle — petition the throne after hunts in the wilds."
        : profiles.a.epithet
  };
  const townMetaB: GeneratedTown = {
    id: 1,
    x: townB.x,
    y: townB.y,
    name: profiles.b.name,
    epithet: profiles.b.epithet
  };

  /** Big stone curtain around Crownkeep (realm 1): many segments, not a single building mesh. */
  let crownkeepCastleWalls: CastleWallSegment[] | null = null;
  if (realmTier === 1 && crownkeep) {
    const { minX: wx0, maxX: wx1, minY: wy0, maxY: wy1 } = crownkeep;
    const segs: CastleWallSegment[] = [];
    const gapC = Math.floor((wx0 + wx1) / 2);
    const southGateSkip = new Set<number>([gapC - 1, gapC, gapC + 1]);

    for (let x = wx0; x <= wx1; x++) {
      segs.push({ tx: x, ty: wy0, along: "ew" });
      if (!southGateSkip.has(x)) {
        segs.push({ tx: x, ty: wy1, along: "ew" });
      }
    }
    for (let y = wy0 + 1; y <= wy1 - 1; y++) {
      segs.push({ tx: wx0, ty: y, along: "ns" });
      segs.push({ tx: wx1, ty: y, along: "ns" });
    }
    crownkeepCastleWalls = segs;
  }

  return {
    seed,
    realmTier,
    width,
    height,
    tiles,
    biomes,
    buildings,
    spawnX,
    spawnY,
    bossTile: { x: boss.x, y: boss.y },
    towns: [townMetaA, townMetaB],
    crownkeepCastleWalls,
    crownkeep
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
  rng: () => number,
  realmTier: number
): Uint8Array {
  const out = new Uint8Array(width * height);

  type Anchor = { x: number; y: number; biome: BiomeKind; weight: number };

  // Meadow anchors on both towns. Weight varies per world so some starts are
  // a sprawling meadow kingdom and others are tiny green islands in a
  // dominant foreign biome.
  const anchors: Anchor[] =
    realmTier >= 2
      ? [
          // No "safe meadow bubble" in portal realms — seed with harsher domains.
          { x: townA.x, y: townA.y, biome: "desert", weight: 1.05 + rng() * 0.7 },
          { x: townB.x, y: townB.y, biome: "swamp", weight: 0.95 + rng() * 0.65 }
        ]
      : [
          { x: townA.x, y: townA.y, biome: "meadow", weight: 0.85 + rng() * 0.55 },
          { x: townB.x, y: townB.y, biome: "meadow", weight: 0.75 + rng() * 0.5 }
        ];

  const deck: BiomeKind[] =
    realmTier >= 2
      ? ["desert", "swamp", "tundra", "forest", "desert", "swamp", "tundra", "forest", "desert", "swamp"]
      : ["forest", "desert", "swamp", "tundra", "forest", "desert", "tundra", "swamp"];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // 2–6 additional anchors — so worlds range from "two big biomes split in
  // half" to "fragmented mosaic of six small pockets".
  const extraAnchors = realmTier >= 2 ? 4 + Math.floor(rng() * 4) : 2 + Math.floor(rng() * 5);

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
