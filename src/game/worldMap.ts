import { gameStore } from "./state";
import type { BiomeKind } from "./types";
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

export const ROAD_ENCOUNTER_RATE = 0.02;
export const GRASS_ENCOUNTER_RATE = 0.12;
export const FOREST_ENCOUNTER_RATE = 0;

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
  boss: "BOSS"
};

const BUILDING_COLORS: Record<BuildingKind, number> = {
  inn: 0x7b2f2f,
  shop: 0x2e4f72,
  train: 0x6b4f8f,
  guild: 0x486d42,
  boss: 0x3d1054
};

// ── Mutable live bindings exposed as ES module exports ─────────────────────
// ES module imports are live references, so consumers automatically see new
// values whenever `regenerateWorld` reassigns these.

export let MAP_W: number = 60;
export let MAP_H: number = 40;
export let BUILDINGS: BuildingPlacement[] = [];
export let worldSeed: number = 0;
/** Bumped every time the active world changes — use as a React dep / key. */
export let worldVersion: number = 0;

let activeWorld: GeneratedWorld | null = null;

/** Initialise / replace the active world and update all live bindings. */
export function regenerateWorld(seed?: number): GeneratedWorld {
  const world = generateWorld(seed);
  activeWorld = world;
  MAP_W = world.width;
  MAP_H = world.height;
  worldSeed = world.seed;
  worldVersion += 1;

  const placements: BuildingPlacement[] = world.buildings.map((b) => ({
    kind: b.kind,
    label: BUILDING_LABELS[b.kind],
    color: BUILDING_COLORS[b.kind],
    pos: { x: b.x, y: b.y }
  }));
  BUILDINGS = placements;
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

/** World-pixel blocking test used by both renderers. Water and forest block movement. */
export function isBlocked(worldX: number, worldY: number): boolean {
  const tx = Math.floor(worldX / TILE);
  const ty = Math.floor(worldY / TILE);
  const t = terrainCodeAt(tx, ty);
  return t === TERRAIN_WATER || t === TERRAIN_FOREST;
}

/**
 * Dispatch zone / encounter logic for the tile the player just moved onto.
 * Returns true if a random encounter was triggered so the caller can skip further movement.
 */
export function dispatchZonesAndEncounter(tx: number, ty: number): boolean {
  const kind = terrainAt(tx, ty);
  const inTown = kind === "town";
  const biome = biomeAt(tx, ty);

  let canHeal = false;
  let canShop = false;
  let canTrain = false;
  let canGuild = false;
  let canBoss = false;
  for (const b of BUILDINGS) {
    if (b.pos.x === tx && b.pos.y === ty) {
      switch (b.kind) {
        case "inn":
          canHeal = true;
          break;
        case "shop":
          canShop = true;
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
      }
    }
  }

  gameStore.updateWorldZones(inTown, canHeal, canShop, canTrain, canGuild, canBoss);

  // Story hooks: track biome discovery + boss arena arrival.
  gameStore.storyNoteBiomeVisited(biome);
  if (canBoss) gameStore.storyNoteBossArenaReached();

  if (inTown || kind === "water" || kind === "forest") {
    gameStore.setEncounterRate(0);
    return false;
  }
  const encounterRate = kind === "road" ? ROAD_ENCOUNTER_RATE : GRASS_ENCOUNTER_RATE;
  if (gameStore.wildernessEncounterStep(encounterRate)) {
    return false;
  }
  if (Math.random() < encounterRate) {
    gameStore.startEncounter(biome);
    return true;
  }
  return false;
}
