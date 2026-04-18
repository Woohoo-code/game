import type { ArmorKey, EnemyDefinition, ItemKey, SkillKey, WeaponKey } from "./types";

export const ENEMIES: EnemyDefinition[] = [
  // ── Meadow (low level starter pool) ────────────────────────────────────
  {
    id: "slime",
    name: "Slime",
    maxHp: 16,
    attack: 5,
    defense: 1,
    speed: 4,
    xpReward: 8,
    goldReward: 6,
    minLevel: 1,
    baseWeight: 8,
    weightGrowthPerLevel: 0.1,
    maxWeight: 12,
    biomes: ["meadow"]
  },
  {
    id: "bat",
    name: "Bat",
    maxHp: 14,
    attack: 6,
    defense: 1,
    speed: 7,
    xpReward: 10,
    goldReward: 8,
    minLevel: 1,
    baseWeight: 6,
    weightGrowthPerLevel: 0.12,
    maxWeight: 11,
    biomes: ["meadow", "forest"]
  },
  {
    id: "goblin",
    name: "Goblin",
    maxHp: 24,
    attack: 8,
    defense: 3,
    speed: 5,
    xpReward: 16,
    goldReward: 14,
    minLevel: 2,
    baseWeight: 4,
    weightGrowthPerLevel: 0.22,
    maxWeight: 12,
    biomes: ["meadow", "forest", "desert"]
  },

  // ── Forest biome ───────────────────────────────────────────────────────
  {
    id: "wolf",
    name: "Dire Wolf",
    maxHp: 34,
    attack: 12,
    defense: 5,
    speed: 9,
    xpReward: 25,
    goldReward: 22,
    minLevel: 4,
    baseWeight: 2,
    weightGrowthPerLevel: 0.6,
    maxWeight: 10,
    biomes: ["forest", "meadow"]
  },
  {
    id: "forestSpider",
    name: "Forest Spider",
    maxHp: 28,
    attack: 10,
    defense: 3,
    speed: 8,
    xpReward: 20,
    goldReward: 16,
    minLevel: 3,
    baseWeight: 3.5,
    weightGrowthPerLevel: 0.35,
    maxWeight: 10,
    biomes: ["forest"],
    bodyShape: "spider",
    customColors: { primary: "#3a2a1e", accent: "#9a2e2a" }
  },
  {
    id: "caveBat",
    name: "Cave Bat",
    maxHp: 20,
    attack: 9,
    defense: 2,
    speed: 9,
    xpReward: 14,
    goldReward: 11,
    minLevel: 2,
    baseWeight: 3,
    weightGrowthPerLevel: 0.3,
    maxWeight: 9,
    biomes: ["forest", "tundra"],
    bodyShape: "bat",
    customColors: { primary: "#bdb4c8", accent: "#5f5578" }
  },

  // ── Desert biome ───────────────────────────────────────────────────────
  {
    id: "sandScorpion",
    name: "Sand Scorpion",
    maxHp: 38,
    attack: 14,
    defense: 6,
    speed: 7,
    xpReward: 28,
    goldReward: 24,
    minLevel: 3,
    baseWeight: 3,
    weightGrowthPerLevel: 0.4,
    maxWeight: 10,
    biomes: ["desert"],
    bodyShape: "scorpion",
    customColors: { primary: "#d6a64c", accent: "#6f3a1a" }
  },
  {
    id: "sandDrake",
    name: "Dune Drake",
    maxHp: 70,
    attack: 22,
    defense: 10,
    speed: 9,
    xpReward: 58,
    goldReward: 48,
    minLevel: 8,
    baseWeight: 0.8,
    weightGrowthPerLevel: 0.85,
    maxWeight: 7,
    biomes: ["desert"],
    bodyShape: "drake",
    customColors: { primary: "#c49a4a", accent: "#5a3b1a" }
  },

  // ── Swamp biome ────────────────────────────────────────────────────────
  {
    id: "bogSlime",
    name: "Bog Slime",
    maxHp: 26,
    attack: 7,
    defense: 3,
    speed: 3,
    xpReward: 14,
    goldReward: 11,
    minLevel: 2,
    baseWeight: 5,
    weightGrowthPerLevel: 0.15,
    maxWeight: 11,
    biomes: ["swamp"],
    bodyShape: "slime",
    customColors: { primary: "#5a7030", accent: "#2a2a10" }
  },
  {
    id: "bogHag",
    name: "Bog Hag",
    maxHp: 46,
    attack: 16,
    defense: 8,
    speed: 8,
    xpReward: 40,
    goldReward: 34,
    minLevel: 5,
    baseWeight: 1.6,
    weightGrowthPerLevel: 0.55,
    maxWeight: 8,
    biomes: ["swamp"],
    bodyShape: "goblin",
    customColors: { primary: "#4f5f36", accent: "#2a2415" }
  },
  {
    id: "wraith",
    name: "Wraith",
    maxHp: 44,
    attack: 15,
    defense: 7,
    speed: 10,
    xpReward: 36,
    goldReward: 32,
    minLevel: 6,
    baseWeight: 1.4,
    weightGrowthPerLevel: 0.7,
    maxWeight: 8,
    biomes: ["swamp", "tundra"]
  },

  // ── Tundra biome ───────────────────────────────────────────────────────
  {
    id: "frostWolf",
    name: "Frost Wolf",
    maxHp: 40,
    attack: 14,
    defense: 6,
    speed: 10,
    xpReward: 32,
    goldReward: 28,
    minLevel: 4,
    baseWeight: 2.4,
    weightGrowthPerLevel: 0.55,
    maxWeight: 10,
    biomes: ["tundra"],
    bodyShape: "wolf",
    customColors: { primary: "#dfe8f0", accent: "#6b8fb4" }
  },
  {
    id: "iceWraith",
    name: "Ice Wraith",
    maxHp: 50,
    attack: 17,
    defense: 8,
    speed: 11,
    xpReward: 44,
    goldReward: 38,
    minLevel: 6,
    baseWeight: 1.4,
    weightGrowthPerLevel: 0.75,
    maxWeight: 8,
    biomes: ["tundra"],
    bodyShape: "wraith",
    customColors: { primary: "#2f4d6e", accent: "#8ce5ff" }
  },

  // ── Generalist dragon (any biome at high level) ────────────────────────
  {
    id: "drake",
    name: "Young Drake",
    maxHp: 62,
    attack: 20,
    defense: 11,
    speed: 8,
    xpReward: 52,
    goldReward: 44,
    minLevel: 8,
    baseWeight: 0.8,
    weightGrowthPerLevel: 0.85,
    maxWeight: 7,
    biomes: ["meadow", "forest", "tundra"]
  }
];

export const BOSS_ENEMY: EnemyDefinition = {
  id: "voidTitan",
  name: "Void Titan",
  maxHp: 220,
  attack: 36,
  defense: 18,
  speed: 13,
  xpReward: 240,
  goldReward: 260,
  minLevel: 1,
  baseWeight: 0,
  weightGrowthPerLevel: 0,
  maxWeight: 0
};

export const WEAPON_STATS = {
  woodSword: { name: "Wood Sword", attackBonus: 0, price: 0 },
  ironSword: { name: "Iron Sword", attackBonus: 3, price: 60 },
  steelSword: { name: "Steel Sword", attackBonus: 6, price: 140 },
  mythrilBlade: { name: "Mythril Blade", attackBonus: 10, price: 280 }
} as const satisfies Record<WeaponKey, { name: string; attackBonus: number; price: number }>;

export const ARMOR_STATS = {
  clothArmor: { name: "Cloth Armor", defenseBonus: 0, price: 0 },
  chainMail: { name: "Chain Mail", defenseBonus: 3, price: 80 },
  knightArmor: { name: "Knight Armor", defenseBonus: 6, price: 170 },
  dragonArmor: { name: "Dragon Armor", defenseBonus: 10, price: 320 }
} as const satisfies Record<ArmorKey, { name: string; defenseBonus: number; price: number }>;

export const ITEM_DATA = {
  potion: { name: "Potion", healAmount: 20, price: 12 },
  hiPotion: { name: "Hi-Potion", healAmount: 45, price: 34 },
  megaPotion: { name: "Mega Potion", healAmount: 80, price: 78 }
} as const satisfies Record<ItemKey, { name: string; healAmount: number; price: number }>;

/** One-time purchase — enables the floating compass overlay that points to the nearest town. */
export const TOWN_MAP = {
  name: "Town Map",
  price: 40,
  description: "A compass-inked scroll that always points toward the nearest town."
} as const;

export const ITEM_PRIORITY: ItemKey[] = ["megaPotion", "hiPotion", "potion"];
export const SHOP_ITEMS: ItemKey[] = ["potion", "hiPotion", "megaPotion"];
export const SHOP_WEAPONS: WeaponKey[] = ["ironSword", "steelSword", "mythrilBlade"];

export const SKILL_DATA = {
  spark: { name: "Spark", minLevel: 1, powerBonus: 4, cooldown: 2 },
  iceShard: { name: "Ice Shard", minLevel: 3, powerBonus: 8, cooldown: 3 },
  thunderLance: { name: "Thunder Lance", minLevel: 5, powerBonus: 12, cooldown: 4 },
  meteorBreak: { name: "Meteor Break", minLevel: 8, powerBonus: 18, cooldown: 5 }
} as const satisfies Record<SkillKey, { name: string; minLevel: number; powerBonus: number; cooldown: number }>;

const SKILL_ORDER: SkillKey[] = ["spark", "iceShard", "thunderLance", "meteorBreak"];

export function getUnlockedSkills(level: number): SkillKey[] {
  return SKILL_ORDER.filter((skill) => level >= SKILL_DATA[skill].minLevel);
}

export function pickEncounterEnemy(playerLevel: number): EnemyDefinition {
  const candidates = ENEMIES.filter((enemy) => playerLevel >= enemy.minLevel);
  const weighted = candidates.map((enemy) => {
    const levelsPastGate = playerLevel - enemy.minLevel;
    const weight = Math.min(enemy.maxWeight, enemy.baseWeight + levelsPastGate * enemy.weightGrowthPerLevel);
    return { enemy, weight };
  });

  const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const row of weighted) {
    roll -= row.weight;
    if (roll <= 0) {
      return row.enemy;
    }
  }
  return weighted[weighted.length - 1].enemy;
}
