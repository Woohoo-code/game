import { gameStore } from "./state";

/** World tile size in pixels. Used by the Phaser renderer and as the 3D unit size. */
export const TILE = 32;
export const MAP_W = 60;
export const MAP_H = 40;

export const ROAD_ENCOUNTER_RATE = 0.02;
export const GRASS_ENCOUNTER_RATE = 0.12;

export interface TileRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
export interface TilePoint {
  x: number;
  y: number;
}

export const TOWN_A: TileRect = { minX: 0, maxX: 7, minY: 0, maxY: 5 };
export const TOWN_B: TileRect = { minX: MAP_W - 8, maxX: MAP_W - 1, minY: MAP_H - 6, maxY: MAP_H - 1 };

export const INN_A: TilePoint = { x: 5, y: 3 };
export const SHOP_A: TilePoint = { x: 2, y: 3 };
export const TRAIN_A: TilePoint = { x: 6, y: 3 };
export const GUILD_A: TilePoint = { x: 1, y: 3 };

export const INN_B: TilePoint = { x: MAP_W - 4, y: MAP_H - 3 };
export const SHOP_B: TilePoint = { x: MAP_W - 2, y: MAP_H - 3 };
export const TRAIN_B: TilePoint = { x: MAP_W - 5, y: MAP_H - 3 };
export const GUILD_B: TilePoint = { x: MAP_W - 7, y: MAP_H - 3 };

/** Southeast town — Void Titan arena (stand on tile to unlock UI). */
export const BOSS_B: TilePoint = { x: MAP_W - 6, y: MAP_H - 4 };

export type BuildingKind = "inn" | "shop" | "train" | "guild" | "boss";

export interface BuildingPlacement {
  kind: BuildingKind;
  label: string;
  color: number;
  pos: TilePoint;
}

export const BUILDINGS: BuildingPlacement[] = [
  { kind: "inn", label: "INN", color: 0x7b2f2f, pos: INN_A },
  { kind: "shop", label: "SHOP", color: 0x2e4f72, pos: SHOP_A },
  { kind: "train", label: "TRAIN", color: 0x6b4f8f, pos: TRAIN_A },
  { kind: "guild", label: "GUILD", color: 0x486d42, pos: GUILD_A },
  { kind: "inn", label: "INN", color: 0x7b2f2f, pos: INN_B },
  { kind: "shop", label: "SHOP", color: 0x2e4f72, pos: SHOP_B },
  { kind: "train", label: "TRAIN", color: 0x6b4f8f, pos: TRAIN_B },
  { kind: "guild", label: "GUILD", color: 0x486d42, pos: GUILD_B },
  { kind: "boss", label: "BOSS", color: 0x3d1054, pos: BOSS_B }
];

export function isTownTile(x: number, y: number): boolean {
  const mainTown = x >= TOWN_A.minX && x <= TOWN_A.maxX && y >= TOWN_A.minY && y <= TOWN_A.maxY;
  const southEastTown = x >= TOWN_B.minX && x <= TOWN_B.maxX && y >= TOWN_B.minY && y <= TOWN_B.maxY;
  return mainTown || southEastTown;
}

export function isRoadTile(x: number, y: number): boolean {
  if (isTownTile(x, y)) return false;
  const northRoad = y >= TOWN_A.maxY && y <= TOWN_A.maxY + 1 && x >= TOWN_A.maxX;
  const southRoad = y >= TOWN_B.minY - 2 && y <= TOWN_B.minY - 1 && x <= TOWN_B.minX;
  const spineRoad =
    x >= Math.floor(MAP_W / 2) - 1 && x <= Math.floor(MAP_W / 2) && y >= TOWN_A.maxY && y <= TOWN_B.minY;
  const eastConnector =
    y >= Math.floor(MAP_H / 2) - 1 && y <= Math.floor(MAP_H / 2) && x >= Math.floor(MAP_W / 2) && x <= MAP_W - 8;
  return northRoad || southRoad || spineRoad || eastConnector;
}

export function isWaterTile(x: number, y: number): boolean {
  const northwestLake = x >= 14 && x <= 24 && y >= 2 && y <= 8;
  const centralLake = x >= 28 && x <= 36 && y >= 14 && y <= 22;
  const eastLake = x >= 45 && x <= 56 && y >= 6 && y <= 12;
  const southChannel = x >= 22 && x <= 25 && y >= 26 && y <= 36;
  return northwestLake || centralLake || eastLake || southChannel;
}

export type TerrainKind = "town" | "road" | "water" | "grass";

export function terrainAt(x: number, y: number): TerrainKind {
  if (isTownTile(x, y)) return "town";
  if (isRoadTile(x, y)) return "road";
  if (isWaterTile(x, y)) return "water";
  return "grass";
}

/** World-pixel blocking test used by both renderers. */
export function isBlocked(worldX: number, worldY: number): boolean {
  const tx = Math.floor(worldX / TILE);
  const ty = Math.floor(worldY / TILE);
  return isWaterTile(tx, ty) && !isRoadTile(tx, ty);
}

/**
 * Dispatch zone/encounter logic for the tile the player just moved onto.
 * Returns true if a random encounter was triggered so the caller can skip further movement.
 */
export function dispatchZonesAndEncounter(tx: number, ty: number): boolean {
  const inTown = isTownTile(tx, ty);
  const canHeal = samePoint(tx, ty, INN_A) || samePoint(tx, ty, INN_B);
  const canShop = samePoint(tx, ty, SHOP_A) || samePoint(tx, ty, SHOP_B);
  const canTrain = samePoint(tx, ty, TRAIN_A) || samePoint(tx, ty, TRAIN_B);
  const canGuild = samePoint(tx, ty, GUILD_A) || samePoint(tx, ty, GUILD_B);
  const canBoss = samePoint(tx, ty, BOSS_B);
  gameStore.updateWorldZones(inTown, canHeal, canShop, canTrain, canGuild, canBoss);
  if (inTown || isWaterTile(tx, ty)) {
    gameStore.setEncounterRate(0);
    return false;
  }
  const encounterRate = isRoadTile(tx, ty) ? ROAD_ENCOUNTER_RATE : GRASS_ENCOUNTER_RATE;
  if (gameStore.wildernessEncounterStep(encounterRate)) {
    return false;
  }
  if (Math.random() < encounterRate) {
    gameStore.startEncounter();
    return true;
  }
  return false;
}

function samePoint(x: number, y: number, p: TilePoint): boolean {
  return x === p.x && y === p.y;
}
