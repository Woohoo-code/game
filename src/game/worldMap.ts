import {
  ENEMIES,
  enemyAppearsInRealm,
  RESOURCES,
  resourcesForRealm,
  type ResourceDefinition
} from "./data";
import { isDungeonTileBlocked } from "./dungeon";
import { gameStore } from "./state";
import type { BiomeKind, ResourceNode, RoamingMonster } from "./types";
import { nightEncounterRateMultiplier } from "./worldClock";
import {
  BIOME_BY_CODE,
  TERRAIN_FOREST,
  TERRAIN_GRASS,
  TERRAIN_ROAD,
  TERRAIN_TOWN,
  TERRAIN_WATER,
  type BuildingKind,
  type GeneratedWorld,
  generateWorld
} from "./worldGen";

export { type BuildingKind };

/** World tile size in pixels (shared by Phaser 2D + 3D unit scale). */
export const TILE = 32;

/**
 * Per-biome danger tuning. `grass` is the per-step chance of a random encounter
 * on an open (non-road) wilderness tile within that biome; `road` is the safer
 * rate on roads through the same biome.
 *
 * Spread is intentionally wide (meadow → tundra) so regions feel meaningfully
 * different. Every value is below {@link MAX_ENCOUNTER_STEP_CHANCE} so a single
 * step is never a guaranteed fight (never 100% encounter chance).
 */
export const BIOME_ENCOUNTER_RATES: Record<BiomeKind, { grass: number; road: number }> = {
  meadow: { grass: 0.048, road: 0.008 }, // safest — starter lands
  forest: { grass: 0.092, road: 0.015 },
  desert: { grass: 0.138, road: 0.023 },
  swamp: { grass: 0.195, road: 0.032 },
  tundra: { grass: 0.265, road: 0.041 } // harshest wilds, still under the hard cap
};

/** Absolute ceiling on per-step encounter probability (well below 1.0 = never certain). */
export const MAX_ENCOUNTER_STEP_CHANCE = 0.28;

export function clampEncounterStepChance(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.min(MAX_ENCOUNTER_STEP_CHANCE, rate);
}

/** Forests block movement, so they never roll an encounter. */
export const FOREST_ENCOUNTER_RATE = 0;

/**
 * Multiplier for the HUD danger meter (per-step rate → 0–100 style percentage).
 * {@link DANGER_DISPLAY_CAP} ensures the bar never shows 100% even if data drifts.
 */
export const DANGER_DISPLAY_SCALE = 400;
/** Display never reaches 100% — worst biomes still read as high risk, not certainty. */
export const DANGER_DISPLAY_CAP = 98;

/** Map stored encounter rate to a 0–{@link DANGER_DISPLAY_CAP} danger percentage for the HUD. */
export function encounterDangerDisplayPercent(rawRate: number): number {
  const r = clampEncounterStepChance(rawRate);
  const pct = Math.round(r * DANGER_DISPLAY_SCALE);
  return Math.min(DANGER_DISPLAY_CAP, Math.max(0, pct));
}

export interface TilePoint {
  x: number;
  y: number;
}

export interface BuildingPlacement {
  kind: BuildingKind;
  label: string;
  color: number;
  pos: TilePoint;
}

const BUILDING_LABELS: Record<BuildingKind, string> = {
  inn: "INN",
  shop: "SHOP",
  train: "TRAIN",
  guild: "GUILD",
  petShop: "PET SHOP",
  boss: "BOSS",
  voidPortal: "RIFT",
  returnPortal: "RETURN RIFT",
  dungeon: "DUNGEON",
  library: "LIBRARY",
  forge: "FORGE",
  chapel: "CHAPEL",
  stables: "STABLES",
  market: "MARKET"
};

const BUILDING_COLORS: Record<BuildingKind, number> = {
  inn: 0x7b2f2f,
  shop: 0x2e4f72,
  train: 0x6b4f8f,
  guild: 0x486d42,
  petShop: 0x2a6b5c,
  boss: 0x3d1054,
  voidPortal: 0x2a6aa8,
  returnPortal: 0x48a878,
  dungeon: 0x1c1418,
  library: 0x4a6088,
  forge: 0x6a3830,
  chapel: 0x9a8848,
  stables: 0x7a5020,
  market: 0xa87830
};

// ── Mutable live bindings exposed as ES module exports ─────────────────────
// ES module imports are live references, so consumers automatically see new
// values whenever `regenerateWorld` reassigns these.

export let MAP_W: number = 60;
export let MAP_H: number = 40;
export let BUILDINGS: BuildingPlacement[] = [];
export let worldSeed: number = 0;
/** Active realm index (1 = original world, 2+ = portal worlds). */
export let worldRealmTier: number = 1;
/** Bumped every time the active world changes — use as a React dep / key. */
export let worldVersion: number = 0;

let activeWorld: GeneratedWorld | null = null;

function rebuildBuildingsFromActiveWorld(): void {
  const world = activeWorld;
  if (!world) return;
  BUILDINGS = world.buildings.map((b) => ({
    kind: b.kind,
    label: BUILDING_LABELS[b.kind],
    color: BUILDING_COLORS[b.kind],
    pos: { x: b.x, y: b.y }
  }));
}

/**
 * Replace the boss arena landmark with a realm portal (same tile).
 * Bumps {@link worldVersion} so the 3D canvas remounts with only the new world mesh.
 */
export function swapBossTileForVoidPortal(): void {
  const world = activeWorld;
  if (!world) return;
  const i = world.buildings.findIndex((b) => b.kind === "boss");
  if (i === -1) return;
  world.buildings[i] = { kind: "voidPortal", x: world.buildings[i].x, y: world.buildings[i].y };
  rebuildBuildingsFromActiveWorld();
  worldVersion += 1;
}

/** Initialise / replace the active world and update all live bindings. */
export function regenerateWorld(seed?: number, realmTier?: number): GeneratedWorld {
  const world = generateWorld(seed, { realmTier });
  activeWorld = world;
  MAP_W = world.width;
  MAP_H = world.height;
  worldSeed = world.seed;
  worldRealmTier = Math.max(1, Math.floor(world.realmTier ?? 1));
  worldVersion += 1;
  rebuildBuildingsFromActiveWorld();
  return world;
}

export function getActiveWorld(): GeneratedWorld {
  if (!activeWorld) {
    regenerateWorld();
  }
  return activeWorld!;
}

export function getSpawnPixel(): { x: number; y: number } {
  const w = getActiveWorld();
  return { x: w.spawnX * TILE + TILE / 2, y: w.spawnY * TILE + TILE / 2 };
}

// Lazy initialisation — ensures MAP_W/MAP_H are valid as soon as any consumer imports.
regenerateWorld();

// ── Tile queries driven by the active world ────────────────────────────────

function terrainCodeAt(x: number, y: number): number {
  const world = activeWorld;
  if (!world) return TERRAIN_WATER;
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return TERRAIN_WATER;
  return world.tiles[y * world.width + x];
}

export function isTownTile(x: number, y: number): boolean {
  return terrainCodeAt(x, y) === TERRAIN_TOWN;
}

export function isRoadTile(x: number, y: number): boolean {
  return terrainCodeAt(x, y) === TERRAIN_ROAD;
}

export function isWaterTile(x: number, y: number): boolean {
  return terrainCodeAt(x, y) === TERRAIN_WATER;
}

export function isForestTile(x: number, y: number): boolean {
  return terrainCodeAt(x, y) === TERRAIN_FOREST;
}

export type TerrainKind = "town" | "road" | "water" | "grass" | "forest";

export function terrainAt(x: number, y: number): TerrainKind {
  const t = terrainCodeAt(x, y);
  switch (t) {
    case TERRAIN_TOWN:
      return "town";
    case TERRAIN_ROAD:
      return "road";
    case TERRAIN_WATER:
      return "water";
    case TERRAIN_FOREST:
      return "forest";
    case TERRAIN_GRASS:
    default:
      return "grass";
  }
}

/**
 * Find the nearest town's center tile to the given tile coordinates.
 * Used by the in-game Town Map compass to point the player home.
 * Returns null only if the active world has no towns (shouldn't happen).
 */
export function nearestTown(tx: number, ty: number): { x: number; y: number; distance: number } | null {
  const world = activeWorld;
  if (!world || world.towns.length === 0) return null;
  let best = world.towns[0];
  let bestDist = Math.hypot(best.x - tx, best.y - ty);
  for (let i = 1; i < world.towns.length; i++) {
    const t = world.towns[i];
    const d = Math.hypot(t.x - tx, t.y - ty);
    if (d < bestDist) {
      best = t;
      bestDist = d;
    }
  }
  return { x: best.x, y: best.y, distance: bestDist };
}

/** Biome at the given tile (returns "meadow" for out-of-bounds). */
export function biomeAt(x: number, y: number): BiomeKind {
  const world = activeWorld;
  if (!world) return "meadow";
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return "meadow";
  const code = world.biomes[y * world.width + x];
  return BIOME_BY_CODE[code] ?? "meadow";
}

const REALM_BIOME_LABELS: Record<number, Partial<Record<BiomeKind, string>>> = {
  2: {
    meadow: "Ashfields",
    forest: "Crystal Groves",
    desert: "Ember Dunes",
    swamp: "Void Marsh",
    tundra: "Storm Peaks"
  }
};

/** Display label for a biome, themed by realm tier. */
export function biomeDisplayName(biome: BiomeKind, realmTier: number = worldRealmTier): string {
  return REALM_BIOME_LABELS[realmTier]?.[biome] ?? biome;
}

/** World-pixel blocking test used by both renderers. Water and forest block movement. */
export function isBlocked(worldX: number, worldY: number): boolean {
  const tx = Math.floor(worldX / TILE);
  const ty = Math.floor(worldY / TILE);
  const snap = gameStore.getSnapshot();
  if (snap.world.inDungeon && snap.world.dungeon) {
    return isDungeonTileBlocked(snap.world.dungeon, tx, ty);
  }
  const t = terrainCodeAt(tx, ty);
  return t === TERRAIN_WATER || t === TERRAIN_FOREST;
}

/**
 * Updates town / building zone flags, story biome hooks, and encounter HUD rate
 * for a tile — without rolling a battle. Used after teleport (e.g. knockout revival).
 */
export function syncZonesAtTile(tx: number, ty: number): void {
  const kind = terrainAt(tx, ty);
  const inTown = kind === "town";
  const biome = biomeAt(tx, ty);

  let canHeal = false;
  let canShop = false;
  let canPetShop = false;
  let canTrain = false;
  let canGuild = false;
  let canBoss = false;
  let canLibrary = false;
  let canForge = false;
  let canChapel = false;
  let canStables = false;
  let canMarket = false;
  let canVoidPortal = false;
  let canReturnPortal = false;
  let canDungeon = false;
  for (const b of BUILDINGS) {
    if (b.pos.x === tx && b.pos.y === ty) {
      switch (b.kind) {
        case "inn":
          canHeal = true;
          break;
        case "shop":
          canShop = true;
          break;
        case "petShop":
          canPetShop = true;
          break;
        case "train":
          canTrain = true;
          break;
        case "guild":
          canGuild = true;
          break;
        case "boss":
          canBoss = true;
          break;
        case "library":
          canLibrary = true;
          break;
        case "forge":
          canForge = true;
          break;
        case "chapel":
          canChapel = true;
          break;
        case "stables":
          canStables = true;
          break;
        case "market":
          canMarket = true;
          break;
        case "voidPortal":
          canVoidPortal = true;
          break;
        case "returnPortal":
          canReturnPortal = true;
          break;
        case "dungeon":
          canDungeon = true;
          break;
      }
    }
  }

  gameStore.updateWorldZones(
    inTown,
    canHeal,
    canShop,
    canPetShop,
    canTrain,
    canGuild,
    canBoss,
    canLibrary,
    canForge,
    canChapel,
    canStables,
    canMarket,
    canVoidPortal,
    canReturnPortal,
    canDungeon
  );

  gameStore.storyNoteBiomeVisited(biome);
  if (canBoss || canVoidPortal) gameStore.storyNoteBossArenaReached();

  if (inTown || kind === "water" || kind === "forest") {
    gameStore.setEncounterRate(0);
  } else {
    const rates = BIOME_ENCOUNTER_RATES[biome] ?? BIOME_ENCOUNTER_RATES.meadow;
    const base = kind === "road" ? rates.road : rates.grass;
    const nightMult = nightEncounterRateMultiplier(gameStore.getSnapshot().world.worldTime ?? 0);
    const encounterRate = clampEncounterStepChance(base * nightMult);
    gameStore.setEncounterRate(encounterRate);
  }
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildingOccupiesTile(tx: number, ty: number): boolean {
  return BUILDINGS.some((b) => b.pos.x === tx && b.pos.y === ty);
}

function isRoamerSpawnTile(tx: number, ty: number, spawnTx: number, spawnTy: number): boolean {
  const kind = terrainAt(tx, ty);
  if (kind === "town" || kind === "water" || kind === "forest") return false;
  if (buildingOccupiesTile(tx, ty)) return false;
  if (Math.hypot(tx - spawnTx, ty - spawnTy) < 5) return false;
  return true;
}

/**
 * Place visible overworld monsters (deterministic from world seed + realm tier).
 * Call after {@link regenerateWorld}; does not touch game state.
 */
export function buildRoamingMonsters(): RoamingMonster[] {
  const world = activeWorld;
  if (!world) return [];
  const rng = mulberry32((world.seed ^ 0xc13fad2b) >>> 0);
  const rt = worldRealmTier;
  const roamPool = ENEMIES.filter((e) => e.visibleRoamer && enemyAppearsInRealm(e, rt));
  if (roamPool.length === 0) return [];

  const count = Math.min(48, 9 + Math.floor(rng() * 10));
  const placed: RoamingMonster[] = [];
  const occupied = new Set<string>();
  const minDistSq = 16;
  const spawnTx = world.spawnX;
  const spawnTy = world.spawnY;

  let attempts = 0;
  while (placed.length < count && attempts < 6000) {
    attempts++;
    const tx = Math.floor(rng() * world.width);
    const ty = Math.floor(rng() * world.height);
    if (!isRoamerSpawnTile(tx, ty, spawnTx, spawnTy)) continue;
    const key = `${tx},${ty}`;
    if (occupied.has(key)) continue;
    let farEnough = true;
    for (const p of placed) {
      if ((p.tx - tx) ** 2 + (p.ty - ty) ** 2 < minDistSq) {
        farEnough = false;
        break;
      }
    }
    if (!farEnough) continue;

    const biome = biomeAt(tx, ty);
    const local = roamPool.filter((e) => !e.biomes?.length || e.biomes.includes(biome));
    const pickFrom = local.length > 0 ? local : roamPool;
    const def = pickFrom[Math.floor(rng() * pickFrom.length)]!;
    occupied.add(key);
    placed.push({ id: `rm-${world.seed}-${placed.length}-${tx}-${ty}`, enemyId: def.id, tx, ty });
  }
  return placed;
}

function isResourceSpawnTile(
  tx: number,
  ty: number,
  spawnTx: number,
  spawnTy: number,
  def: ResourceDefinition
): boolean {
  const kind = terrainAt(tx, ty);
  // Flora can live on grass AND in forest clearings (player can't walk in forest, so those
  // stay purely decorative). Roads / towns / water never spawn pickups.
  if (kind === "town" || kind === "water" || kind === "road") return false;
  if (buildingOccupiesTile(tx, ty)) return false;
  if (Math.hypot(tx - spawnTx, ty - spawnTy) < 3) return false;
  if (kind === "forest") return false;
  const biome = biomeAt(tx, ty);
  if (def.biomes.length > 0 && !def.biomes.includes(biome)) return false;
  return true;
}

/**
 * Place visible gatherable resources (flowers / mushrooms / herbs) across the overworld.
 * Deterministic from world seed + realm tier. Does not touch game state.
 * Skips tiles in `occupied` so picks never overlap a visible roamer.
 */
export function buildResourceNodes(occupied: Set<string> = new Set()): ResourceNode[] {
  const world = activeWorld;
  if (!world) return [];
  const rt = worldRealmTier;
  const pool = resourcesForRealm(rt);
  if (pool.length === 0) return [];
  const rng = mulberry32((world.seed ^ 0x71a8f13d) >>> 0);

  const count = Math.min(80, 28 + Math.floor(rng() * 24));
  const placed: ResourceNode[] = [];
  const used = new Set<string>(occupied);
  const minDistSq = 4;
  const spawnTx = world.spawnX;
  const spawnTy = world.spawnY;

  let attempts = 0;
  while (placed.length < count && attempts < 9000) {
    attempts++;
    const tx = Math.floor(rng() * world.width);
    const ty = Math.floor(rng() * world.height);
    const key = `${tx},${ty}`;
    if (used.has(key)) continue;

    const biome = biomeAt(tx, ty);
    const local = pool.filter((r) => r.biomes.length === 0 || r.biomes.includes(biome));
    const pickFrom = local.length > 0 ? local : pool;
    // Weighted pick.
    let totalW = 0;
    for (const r of pickFrom) totalW += r.spawnWeight ?? 1;
    let roll = rng() * totalW;
    let def: ResourceDefinition = pickFrom[0]!;
    for (const r of pickFrom) {
      roll -= r.spawnWeight ?? 1;
      if (roll <= 0) {
        def = r;
        break;
      }
    }

    if (!isResourceSpawnTile(tx, ty, spawnTx, spawnTy, def)) continue;

    let farEnough = true;
    for (const p of placed) {
      if ((p.tx - tx) ** 2 + (p.ty - ty) ** 2 < minDistSq) {
        farEnough = false;
        break;
      }
    }
    if (!farEnough) continue;

    used.add(key);
    placed.push({
      id: `res-${world.seed}-${placed.length}-${tx}-${ty}`,
      resourceKey: def.key,
      tx,
      ty
    });
  }
  // Guard against stale RESOURCES entries removed between saves.
  return placed.filter((n) => RESOURCES[n.resourceKey] !== undefined);
}

/**
 * Dispatch zone / encounter logic for the tile the player just moved onto.
 * Returns true if a random encounter was triggered so the caller can skip further movement.
 */
export function dispatchZonesAndEncounter(tx: number, ty: number): boolean {
  // Inside a dungeon, fully short-circuit the overworld pipeline and run the
  // dungeon-specific event dispatcher.
  const snap = gameStore.getSnapshot();
  if (snap.world.inDungeon) {
    return gameStore.dispatchDungeonTile(tx, ty);
  }
  syncZonesAtTile(tx, ty);
  // Gather pickups first — harmless, doesn't block an encounter roll after.
  gameStore.tryGatherResourceAtTile(tx, ty);
  const kind = terrainAt(tx, ty);
  const inTown = kind === "town";
  if (inTown || kind === "water" || kind === "forest") {
    return false;
  }
  if (gameStore.tryRoamerEncounterAtTile(tx, ty)) {
    return true;
  }
  const biome = biomeAt(tx, ty);
  const rates = BIOME_ENCOUNTER_RATES[biome] ?? BIOME_ENCOUNTER_RATES.meadow;
  const base = kind === "road" ? rates.road : rates.grass;
  const nightMult = nightEncounterRateMultiplier(gameStore.getSnapshot().world.worldTime ?? 0);
  const encounterRate = clampEncounterStepChance(base * nightMult);
  if (gameStore.wildernessEncounterStep(encounterRate)) {
    return false;
  }
  if (Math.random() < encounterRate) {
    gameStore.startEncounter(biome);
    return true;
  }
  return false;
}
