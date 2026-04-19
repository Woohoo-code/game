/**
 * Procedural inn patrons — pure helpers (no game state import).
 * Used when the player stands on an inn tile in town.
 */

import type { FightingClass } from "./types";

export type InnPatronAction = "bribe" | "intimidate" | "recruit" | "manipulate";

export interface InnPatron {
  /** Stable within the current rotation bucket (0, 1, 2). */
  slot: number;
  name: string;
  role: string;
  /** Flavor — what they are carrying or know. */
  carries: string;
  bribeGold: number;
  /** Raw attack (before weapon) needed to cow them. */
  intimidateAttackNeed: number;
  recruitGold: number;
  /** Battles of +2 ATK after a successful recruit. */
  recruitFights: number;
  /** defense + level (plus class tweaks) must meet this to manipulate. */
  manipulateCunningNeed: number;
}

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

const FIRST = [
  "Mara",
  "Cedric",
  "Iris",
  "Torin",
  "Selka",
  "Bran",
  "Yvette",
  "Odo",
  "Nessa",
  "Galen"
] as const;
const LAST = [
  "Vance",
  "Thistle",
  "Crowe",
  "Ashford",
  "Dunlow",
  "Marche",
  "Reede",
  "Blackwood",
  "Harrow",
  "Fenn"
] as const;
const ROLES = [
  "Courier with a wax-sealed satchel",
  "Nervous clerk counting coins",
  "Traveling fence with quiet hands",
  "Retired scout nursing ale",
  "Guild runner between tables",
  "Caravan guard off duty"
] as const;
const CARRIES = [
  "route maps and gossip",
  "forged chits and a silver tongue",
  "a purse heavier than it looks",
  "letters meant for someone else",
  "a rumor about the wilds",
  "contacts at the market gate"
] as const;

/** World-time bucket so the taproom crowd rotates as days pass. */
export function innPatronRotationBucket(worldTime: number): number {
  if (!Number.isFinite(worldTime)) return 0;
  return Math.floor(worldTime * 12) % 100000;
}

export function innPatronsForTown(worldSeed: number, townIndex: 0 | 1, bucket: number): InnPatron[] {
  const out: InnPatron[] = [];
  for (let slot = 0; slot < 3; slot++) {
    const rng = mulberry32((worldSeed ^ (townIndex + 1) * 0xa341316c ^ bucket * 0x9e3779b9 ^ (slot + 1) * 0x85ebca6b) >>> 0);
    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const role = pick(ROLES);
    const carries = pick(CARRIES);
    const bribeGold = 12 + Math.floor(rng() * 18) + townIndex * 4;
    const intimidateAttackNeed = 7 + Math.floor(rng() * 8) + townIndex * 2 + slot;
    const recruitGold = 35 + Math.floor(rng() * 40) + townIndex * 10;
    const recruitFights = 2 + Math.floor(rng() * 3);
    const manipulateCunningNeed = 4 + Math.floor(rng() * 6) + townIndex + slot * 2;
    out.push({
      slot,
      name,
      role,
      carries,
      bribeGold,
      intimidateAttackNeed,
      recruitGold,
      recruitFights,
      manipulateCunningNeed
    });
  }
  return out;
}

export function playerCunningForNpc(level: number, defense: number, fightingClass: FightingClass): number {
  let v = level + defense;
  if (fightingClass === "wizard") v += 1;
  if (fightingClass === "thief") v += 2;
  return v;
}

export function playerAttackForIntimidate(rawAttack: number, fightingClass: FightingClass): number {
  return rawAttack + (fightingClass === "knight" ? 1 : 0);
}
