/**
 * Dungeon layout generation + tile helpers.
 *
 * Dungeons are small self-contained maps (typically ~22×14) kept inside the
 * same TILE coordinate system as the overworld. When the player enters, the
 * overworld layout is preserved in state; only the renderers skip drawing it.
 */

import { DUNGEON_CHEST_LOOT, DUNGEON_ENEMIES } from "./data";
import {
  DUNGEON_TILE_EXIT,
  DUNGEON_TILE_FLOOR,
  DUNGEON_TILE_PILLAR,
  DUNGEON_TILE_WALL,
  type DungeonChest,
  type DungeonRoamer,
  type DungeonState,
  type ItemKey
} from "./types";

const DUNGEON_W = 22;
const DUNGEON_H = 14;

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

function idx(x: number, y: number): number {
  return y * DUNGEON_W + x;
}

function isInteriorFloor(tiles: number[], x: number, y: number): boolean {
  if (x <= 0 || y <= 0 || x >= DUNGEON_W - 1 || y >= DUNGEON_H - 1) return false;
  return tiles[idx(x, y)] === DUNGEON_TILE_FLOOR;
}

/**
 * Generate a dungeon deterministically from a seed. The map is a walled
 * rectangle with a handful of internal walls / pillars for visual texture,
 * 3–5 chests on floor tiles, and 5–9 undead visible roamers.
 */
export function generateDungeon(seed: number): DungeonState {
  const rng = mulberry32(seed);
  const width = DUNGEON_W;
  const height = DUNGEON_H;
  const tiles: number[] = new Array(width * height).fill(DUNGEON_TILE_FLOOR);

  // Outer wall ring.
  for (let x = 0; x < width; x++) {
    tiles[idx(x, 0)] = DUNGEON_TILE_WALL;
    tiles[idx(x, height - 1)] = DUNGEON_TILE_WALL;
  }
  for (let y = 0; y < height; y++) {
    tiles[idx(0, y)] = DUNGEON_TILE_WALL;
    tiles[idx(width - 1, y)] = DUNGEON_TILE_WALL;
  }

  // A few internal walls to break the room into chambers. Keep the corridors
  // wide so the player can always path around everything.
  const internalWallCount = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < internalWallCount; i++) {
    const horizontal = rng() < 0.5;
    if (horizontal) {
      const len = 3 + Math.floor(rng() * 4);
      const y = 3 + Math.floor(rng() * (height - 6));
      const x0 = 3 + Math.floor(rng() * (width - len - 4));
      for (let dx = 0; dx < len; dx++) {
        tiles[idx(x0 + dx, y)] = DUNGEON_TILE_WALL;
      }
    } else {
      const len = 2 + Math.floor(rng() * 3);
      const x = 3 + Math.floor(rng() * (width - 6));
      const y0 = 2 + Math.floor(rng() * (height - len - 3));
      for (let dy = 0; dy < len; dy++) {
        tiles[idx(x, y0 + dy)] = DUNGEON_TILE_WALL;
      }
    }
  }

  // A handful of purely decorative pillars (still block movement).
  const pillarCount = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < pillarCount; i++) {
    const x = 2 + Math.floor(rng() * (width - 4));
    const y = 2 + Math.floor(rng() * (height - 4));
    if (tiles[idx(x, y)] === DUNGEON_TILE_FLOOR) {
      tiles[idx(x, y)] = DUNGEON_TILE_PILLAR;
    }
  }

  // Entry / exit at the left wall mid-height.
  const entryTx = 1;
  const entryTy = Math.floor(height / 2);
  tiles[idx(entryTx, entryTy)] = DUNGEON_TILE_EXIT;
  // Guarantee the tile east of the exit is floor (so the player can walk in).
  tiles[idx(entryTx + 1, entryTy)] = DUNGEON_TILE_FLOOR;

  // Collect every free floor tile we can place things on.
  const freeTiles: { x: number; y: number }[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (!isInteriorFloor(tiles, x, y)) continue;
      // Keep a two-tile buffer around the exit so the player can safely step back.
      if (Math.abs(x - entryTx) + Math.abs(y - entryTy) <= 1) continue;
      freeTiles.push({ x, y });
    }
  }
  // Shuffle (Fisher–Yates with seeded rng).
  for (let i = freeTiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [freeTiles[i], freeTiles[j]] = [freeTiles[j]!, freeTiles[i]!];
  }

  const chests: DungeonChest[] = [];
  const roamers: DungeonRoamer[] = [];
  const consumed = new Set<string>();
  const consume = (p: { x: number; y: number }): boolean => {
    const key = `${p.x},${p.y}`;
    if (consumed.has(key)) return false;
    consumed.add(key);
    return true;
  };

  // 3–5 chests near the deeper part of the dungeon.
  const chestCount = 3 + Math.floor(rng() * 3);
  let placedChests = 0;
  for (const p of freeTiles) {
    if (placedChests >= chestCount) break;
    // Prefer tiles on the right half so chests feel like "deeper" loot.
    if (p.x < Math.floor(width * 0.45)) continue;
    if (!consume(p)) continue;
    const lootItem = DUNGEON_CHEST_LOOT[
      Math.floor(rng() * DUNGEON_CHEST_LOOT.length)
    ] as ItemKey;
    const lootGold = 40 + Math.floor(rng() * 110);
    chests.push({
      id: `chest-${seed}-${placedChests}-${p.x}-${p.y}`,
      tx: p.x,
      ty: p.y,
      opened: false,
      lootItem,
      lootGold
    });
    placedChests++;
  }

  // 5–9 undead roamers, skewed toward the deeper sections.
  const roamerCount = 5 + Math.floor(rng() * 5);
  let placedRoamers = 0;
  for (const p of freeTiles) {
    if (placedRoamers >= roamerCount) break;
    if (!consume(p)) continue;
    // Keep the first couple of tiles clear so the player isn't ambushed on entry.
    if (Math.abs(p.x - entryTx) + Math.abs(p.y - entryTy) <= 3) continue;
    const def = DUNGEON_ENEMIES[Math.floor(rng() * DUNGEON_ENEMIES.length)]!;
    roamers.push({
      id: `drm-${seed}-${placedRoamers}-${p.x}-${p.y}`,
      enemyId: def.id,
      tx: p.x,
      ty: p.y
    });
    placedRoamers++;
  }

  return {
    seed,
    width,
    height,
    tiles,
    entryTx,
    entryTy,
    chests,
    roamers
  };
}

/** Read a dungeon tile, treating out-of-bounds as wall. */
export function dungeonTileAt(dungeon: DungeonState, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= dungeon.width || ty >= dungeon.height) {
    return DUNGEON_TILE_WALL;
  }
  return dungeon.tiles[ty * dungeon.width + tx] ?? DUNGEON_TILE_WALL;
}

/** True when the tile blocks movement (walls, pillars, out-of-bounds). */
export function isDungeonTileBlocked(dungeon: DungeonState, tx: number, ty: number): boolean {
  const t = dungeonTileAt(dungeon, tx, ty);
  if (t === DUNGEON_TILE_WALL || t === DUNGEON_TILE_PILLAR) return true;
  // Chests, roamers, and the exit are walkable — stepping onto them triggers
  // the tile's action (open/fight/leave) via the dungeon event dispatcher.
  return false;
}
