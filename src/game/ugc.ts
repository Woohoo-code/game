import type {
  EnemyDefinition,
  EnemyState,
  MonsterBodyShape,
  UgcArmor,
  UgcMonster,
  UgcState,
  UgcWeapon
} from "./types";

/** 25% platform tax / 75% to creator. */
export const UGC_TAX_RATE = 0.25;
/** Market tick cadence in ms. */
export const UGC_MARKET_TICK_MS = 6000;

export function initialUgc(): UgcState {
  return {
    monsters: [],
    weapons: [],
    armor: [],
    totalGross: 0,
    totalNet: 0,
    totalTax: 0,
    totalSales: 0
  };
}

const CODE_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomCodeBody(length: number): string {
  let s = "";
  if (globalThis.crypto?.getRandomValues) {
    const buf = new Uint8Array(length);
    globalThis.crypto.getRandomValues(buf);
    for (let i = 0; i < length; i++) {
      s += CODE_CHARS[buf[i]! % 36];
    }
    return s;
  }
  for (let i = 0; i < length; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * 36)];
  }
  return s;
}

/** Share / listing id — always exactly 10 characters (kind prefix + random). */
export function makeListingCode(kind: "m" | "w" | "a" | "p"): string {
  return kind + randomCodeBody(9);
}

export const MONSTER_BODY_SHAPES: readonly MonsterBodyShape[] = [
  "slime",
  "bat",
  "goblin",
  "wolf",
  "wraith",
  "drake",
  "spider",
  "scorpion"
] as const;

export const BODY_SHAPE_LABEL: Record<MonsterBodyShape, string> = {
  slime: "Blob",
  bat: "Flyer",
  goblin: "Humanoid",
  wolf: "Beast",
  wraith: "Spirit",
  drake: "Drake",
  spider: "Arachnid",
  scorpion: "Scorpion"
};

/** Suggested stat baselines per body shape, used when creating a new monster draft. */
export function defaultMonsterDraft(shape: MonsterBodyShape, playerLevel: number): Omit<UgcMonster, "id" | "createdAt" | "listed" | "sales" | "grossEarned"> {
  const base: Record<MonsterBodyShape, { hp: number; atk: number; def: number; spd: number; xp: number; gold: number }> = {
    slime: { hp: 20, atk: 6, def: 2, spd: 3, xp: 10, gold: 8 },
    bat: { hp: 18, atk: 7, def: 1, spd: 8, xp: 12, gold: 9 },
    goblin: { hp: 30, atk: 10, def: 4, spd: 6, xp: 18, gold: 16 },
    wolf: { hp: 40, atk: 13, def: 5, spd: 9, xp: 28, gold: 24 },
    wraith: { hp: 48, atk: 16, def: 7, spd: 10, xp: 38, gold: 34 },
    drake: { hp: 66, atk: 21, def: 11, spd: 8, xp: 55, gold: 46 },
    spider: { hp: 30, atk: 11, def: 3, spd: 8, xp: 22, gold: 18 },
    scorpion: { hp: 40, atk: 14, def: 6, spd: 7, xp: 30, gold: 26 }
  };
  const b = base[shape];
  return {
    name: `Custom ${BODY_SHAPE_LABEL[shape]}`,
    bodyShape: shape,
    colorPrimary: "#8855cc",
    colorAccent: "#221133",
    maxHp: b.hp,
    attack: b.atk,
    defense: b.def,
    speed: b.spd,
    xpReward: b.xp,
    goldReward: b.gold,
    minLevel: Math.max(1, playerLevel),
    price: 80
  };
}

export function defaultWeaponDraft(): Omit<UgcWeapon, "id" | "createdAt" | "listed" | "sales" | "grossEarned"> {
  return {
    name: "Custom Blade",
    attackBonus: 4,
    color: "#d9b45b",
    price: 120
  };
}

export function defaultArmorDraft(): Omit<UgcArmor, "id" | "createdAt" | "listed" | "sales" | "grossEarned"> {
  return {
    name: "Custom Plate",
    defenseBonus: 4,
    color: "#7bc4ff",
    price: 140
  };
}

export function newMonster(draft: ReturnType<typeof defaultMonsterDraft>): UgcMonster {
  return {
    ...draft,
    id: makeListingCode("m"),
    createdAt: Date.now(),
    listed: false,
    sales: 0,
    grossEarned: 0
  };
}

export function newWeapon(draft: ReturnType<typeof defaultWeaponDraft>): UgcWeapon {
  return {
    ...draft,
    id: makeListingCode("w"),
    createdAt: Date.now(),
    listed: false,
    sales: 0,
    grossEarned: 0
  };
}

export function newArmor(draft: ReturnType<typeof defaultArmorDraft>): UgcArmor {
  return {
    ...draft,
    id: makeListingCode("a"),
    createdAt: Date.now(),
    listed: false,
    sales: 0,
    grossEarned: 0
  };
}

/** Convert a UGC monster into the encounter-pool definition the battle system understands. */
export function ugcMonsterToEnemyDef(m: UgcMonster): EnemyDefinition {
  return {
    id: m.id,
    name: m.name,
    maxHp: m.maxHp,
    attack: m.attack,
    defense: m.defense,
    speed: m.speed,
    xpReward: m.xpReward,
    goldReward: m.goldReward,
    minLevel: m.minLevel,
    baseWeight: 1.4,
    weightGrowthPerLevel: 0.35,
    maxWeight: 6
  };
}

/** Bake a running enemy from a UGC template, preserving body shape + colors for 3D rendering. */
export function hydrateEnemyFromUgc(ugc: UgcMonster): EnemyState {
  const def = ugcMonsterToEnemyDef(ugc);
  return {
    ...def,
    hp: def.maxHp,
    bodyShape: ugc.bodyShape,
    customColors: { primary: ugc.colorPrimary, accent: ugc.colorAccent }
  };
}

/** Pick an encounter enemy from a merged pool (built-ins + UGC). */
export function pickEncounterFromPool(pool: EnemyDefinition[], playerLevel: number): EnemyDefinition | null {
  const candidates = pool.filter((enemy) => playerLevel >= enemy.minLevel);
  if (candidates.length === 0) return null;
  const weighted = candidates.map((enemy) => {
    const levelsPastGate = playerLevel - enemy.minLevel;
    const weight = Math.min(enemy.maxWeight, enemy.baseWeight + levelsPastGate * enemy.weightGrowthPerLevel);
    return { enemy, weight };
  });
  const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) return candidates[0];
  let roll = Math.random() * totalWeight;
  for (const row of weighted) {
    roll -= row.weight;
    if (roll <= 0) {
      return row.enemy;
    }
  }
  return weighted[weighted.length - 1].enemy;
}

/** Sales probability per tick for a given list price. Cheaper items move faster. */
export function saleChanceForPrice(price: number): number {
  if (price <= 0) return 0;
  return Math.max(0.03, 0.38 - price / 650);
}
