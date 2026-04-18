import type { ArmorKey, EnemyDefinition, ItemKey, SkillKey, WeaponKey } from "./types";

export const ENEMIES: EnemyDefinition[] = [
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
    maxWeight: 12
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
    maxWeight: 11
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
    maxWeight: 12
  },
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
    maxWeight: 10
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
    baseWeight: 1.2,
    weightGrowthPerLevel: 0.75,
    maxWeight: 8
  },
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
    maxWeight: 7
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
