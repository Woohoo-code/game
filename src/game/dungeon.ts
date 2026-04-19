/**
 * Dungeon layout generation + tile helpers.
 *
 * Dungeons are small self-contained maps (~22×14) per floor. Up to four floors;
 * stairs link deeper levels. Realm 2+ only (see GameStore.enterDungeon).
 */

import { DUNGEON_CHEST_LOOT, DUNGEON_ENEMIES } from "./data";
import {
  DUNGEON_TILE_EXIT,
  DUNGEON_TILE_FLOOR,
  DUNGEON_TILE_PILLAR,
  DUNGEON_TILE_STAIRS_DOWN,
  DUNGEON_TILE_STAIRS_UP,
  DUNGEON_TILE_WALL,
  type DungeonChest,
  type DungeonFloorState,
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

function isWalkableFloorCode(t: number): boolean {
  return (
    t === DUNGEON_TILE_FLOOR ||
    t === DUNGEON_TILE_EXIT ||
    t === DUNGEON_TILE_STAIRS_DOWN ||
    t === DUNGEON_TILE_STAIRS_UP
  );
}

function isInteriorFloorTile(tiles: number[], x: number, y: number): boolean {
  if (x <= 0 || y <= 0 || x >= DUNGEON_W - 1 || y >= DUNGEON_H - 1) return false;
  const t = tiles[idx(x, y)];
  return t === DUNGEON_TILE_FLOOR;
}

/** Active floor for movement / rendering. */
export function currentDungeonFloor(d: DungeonState | null | undefined): DungeonFloorState | null {
  if (!d?.floors?.length) return null;
  return d.floors[d.levelIndex] ?? null;
}

/**
 * Generate a full dungeon run (1–4 floors). Each floor has its own tiles, chests,
 * and roamers; {@link DungeonState.levelIndex} selects the active floor.
 */
export function generateDungeon(seed: number): DungeonState {
  const rng = mulberry32(seed);
  const depth = 1 + Math.floor(rng() * 4);
  const floors: DungeonFloorState[] = [];
  for (let fi = 0; fi < depth; fi++) {
    const floorSeed = (seed + fi * 0x9e3779b9) >>> 0;
    floors.push(generateDungeonFloor(floorSeed, fi, depth, mulberry32(floorSeed)));
  }
  return {
    seed,
    depth,
    levelIndex: 0,
    floors,
    kind: "dungeon"
  };
}

/** Short carpeted hall in Crownkeep — no chests or monsters; exit south, king north. */
export function generateCastleThroneHall(seed: number): DungeonState {
  const W = 9;
  const H = 18;
  const tiles: number[] = new Array(W * H).fill(DUNGEON_TILE_WALL);
  for (let y = 1; y <= 16; y++) {
    for (const x of [3, 4, 5] as const) {
      tiles[y * W + x] = DUNGEON_TILE_FLOOR;
    }
  }
  const exitX = 4;
  const exitY = 16;
  tiles[exitY * W + exitX] = DUNGEON_TILE_EXIT;
  const entryTx = 4;
  const entryTy = 15;
  const throneHallAudience = { tx: 4, ty: 1 };

  const floor: DungeonFloorState = {
    width: W,
    height: H,
    tiles,
    entryTx,
    entryTy,
    chests: [],
    roamers: [],
    throneHallAudience
  };

  return {
    seed,
    depth: 1,
    levelIndex: 0,
    floors: [floor],
    kind: "throneHall"
  };
}

function generateDungeonFloor(
  seed: number,
  floorIndex: number,
  totalDepth: number,
  rng: () => number
): DungeonFloorState {
  const width = DUNGEON_W;
  const height = DUNGEON_H;
  const tiles: number[] = new Array(width * height).fill(DUNGEON_TILE_FLOOR);

  for (let x = 0; x < width; x++) {
    tiles[idx(x, 0)] = DUNGEON_TILE_WALL;
    tiles[idx(x, height - 1)] = DUNGEON_TILE_WALL;
  }
  for (let y = 0; y < height; y++) {
    tiles[idx(0, y)] = DUNGEON_TILE_WALL;
    tiles[idx(width - 1, y)] = DUNGEON_TILE_WALL;
  }

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

  const pillarCount = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < pillarCount; i++) {
    const x = 2 + Math.floor(rng() * (width - 4));
    const y = 2 + Math.floor(rng() * (height - 4));
    if (tiles[idx(x, y)] === DUNGEON_TILE_FLOOR) {
      tiles[idx(x, y)] = DUNGEON_TILE_PILLAR;
    }
  }

  const entryTx = 1;
  const entryTy = Math.floor(height / 2);

  if (floorIndex === 0) {
    tiles[idx(entryTx, entryTy)] = DUNGEON_TILE_EXIT;
    tiles[idx(entryTx + 1, entryTy)] = DUNGEON_TILE_FLOOR;
  } else {
    tiles[idx(entryTx, entryTy)] = DUNGEON_TILE_STAIRS_UP;
    tiles[idx(entryTx + 1, entryTy)] = DUNGEON_TILE_FLOOR;
  }

  const freeTiles: { x: number; y: number }[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (!isInteriorFloorTile(tiles, x, y)) continue;
      if (Math.abs(x - entryTx) + Math.abs(y - entryTy) <= 1) continue;
      freeTiles.push({ x, y });
    }
  }
  for (let i = freeTiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [freeTiles[i], freeTiles[j]] = [freeTiles[j]!, freeTiles[i]!];
  }

  let placedStairsDown: { x: number; y: number } | null = null;
  if (floorIndex < totalDepth - 1) {
    for (const p of freeTiles) {
      if (p.x < Math.floor(width * 0.48)) continue;
      if (Math.abs(p.x - entryTx) + Math.abs(p.y - entryTy) < 5) continue;
      if (tiles[idx(p.x, p.y)] !== DUNGEON_TILE_FLOOR) continue;
      tiles[idx(p.x, p.y)] = DUNGEON_TILE_STAIRS_DOWN;
      placedStairsDown = { x: p.x, y: p.y };
      break;
    }
    if (!placedStairsDown) {
      for (let y = 1; y < height - 1 && !placedStairsDown; y++) {
        for (let x = 2; x < width - 1; x++) {
          if (tiles[idx(x, y)] !== DUNGEON_TILE_FLOOR) continue;
          if (Math.abs(x - entryTx) + Math.abs(y - entryTy) < 4) continue;
          tiles[idx(x, y)] = DUNGEON_TILE_STAIRS_DOWN;
          placedStairsDown = { x, y };
          break;
        }
      }
    }
  }

  const consumed = new Set<string>();
  const consume = (p: { x: number; y: number }): boolean => {
    const key = `${p.x},${p.y}`;
    if (consumed.has(key)) return false;
    consumed.add(key);
    return true;
  };

  const chests: DungeonChest[] = [];
  const chestCount = 3 + Math.floor(rng() * 3);
  let placedChests = 0;
  for (const p of freeTiles) {
    if (placedChests >= chestCount) break;
    if (tiles[idx(p.x, p.y)] !== DUNGEON_TILE_FLOOR) continue;
    if (p.x < Math.floor(width * 0.45)) continue;
    if (!consume(p)) continue;
    const lootItem = DUNGEON_CHEST_LOOT[Math.floor(rng() * DUNGEON_CHEST_LOOT.length)] as ItemKey;
    const lootGold = 40 + Math.floor(rng() * 110) + floorIndex * 15;
    chests.push({
      id: `chest-${seed}-${floorIndex}-${placedChests}-${p.x}-${p.y}`,
      tx: p.x,
      ty: p.y,
      opened: false,
      lootItem,
      lootGold
    });
    placedChests++;
  }

  const roamers: DungeonRoamer[] = [];
  const roamerCount = 5 + Math.floor(rng() * 5);
  let placedRoamers = 0;
  for (const p of freeTiles) {
    if (placedRoamers >= roamerCount) break;
    if (tiles[idx(p.x, p.y)] !== DUNGEON_TILE_FLOOR) continue;
    if (!consume(p)) continue;
    if (Math.abs(p.x - entryTx) + Math.abs(p.y - entryTy) <= 3) continue;
    const def = DUNGEON_ENEMIES[Math.floor(rng() * DUNGEON_ENEMIES.length)]!;
    roamers.push({
      id: `drm-${seed}-${floorIndex}-${placedRoamers}-${p.x}-${p.y}`,
      enemyId: def.id,
      tx: p.x,
      ty: p.y
    });
    placedRoamers++;
  }

  return {
    width,
    height,
    tiles,
    entryTx,
    entryTy,
    chests,
    roamers
  };
}

/** Read a dungeon tile on the active floor; out-of-bounds reads as wall. */
export function dungeonTileAt(dungeon: DungeonState, tx: number, ty: number): number {
  const f = currentDungeonFloor(dungeon);
  if (!f) return DUNGEON_TILE_WALL;
  if (tx < 0 || ty < 0 || tx >= f.width || ty >= f.height) {
    return DUNGEON_TILE_WALL;
  }
  return f.tiles[ty * f.width + tx] ?? DUNGEON_TILE_WALL;
}

export function isDungeonTileBlocked(dungeon: DungeonState, tx: number, ty: number): boolean {
  const t = dungeonTileAt(dungeon, tx, ty);
  if (t === DUNGEON_TILE_WALL || t === DUNGEON_TILE_PILLAR) return true;
  return false;
}

export function findFirstTileOfKind(f: DungeonFloorState, kind: number): { tx: number; ty: number } | null {
  for (let y = 0; y < f.height; y++) {
    for (let x = 0; x < f.width; x++) {
      if (f.tiles[y * f.width + x] === kind) return { tx: x, ty: y };
    }
  }
  return null;
}
