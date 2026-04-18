import type { ArmorKey, EnemyDefinition, ItemKey, MonsterBodyShape, SkillKey, WeaponKey } from "./types";

/** Max attack the active pet adds to your strike power (basic attack + skills). */
export const PET_ATTACK_BUFF_CAP = 10;

export interface PetShopOfferRow {
  key: string;
  title: string;
  speciesId: string;
  speciesName: string;
  bodyShape: MonsterBodyShape;
  colorPrimary: string;
  colorAccent: string;
  attackBonus: number;
  price: number;
}

/** Companions sold at the Pet Shop (second town). */
export const PET_SHOP_OFFERS: readonly PetShopOfferRow[] = [
  {
    key: "mosslet",
    title: "Mosslet",
    speciesId: "shop_mosslet",
    speciesName: "Mosslet",
    bodyShape: "slime",
    colorPrimary: "#6ecf8c",
    colorAccent: "#1e4a32",
    attackBonus: 2,
    price: 38
  },
  {
    key: "duskpip",
    title: "Dusk Pip",
    speciesId: "shop_duskpip",
    speciesName: "Dusk Pip",
    bodyShape: "bat",
    colorPrimary: "#7a6eb0",
    colorAccent: "#221830",
    attackBonus: 4,
    price: 85
  },
  {
    key: "ridgepup",
    title: "Ridge Pup",
    speciesId: "shop_ridgepup",
    speciesName: "Ridge Pup",
    bodyShape: "wolf",
    colorPrimary: "#c4a882",
    colorAccent: "#4a3824",
    attackBonus: 6,
    price: 155
  },
  {
    key: "emberling",
    title: "Emberling",
    speciesId: "shop_emberling",
    speciesName: "Emberling",
    bodyShape: "slime",
    colorPrimary: "#ff9955",
    colorAccent: "#5c2010",
    attackBonus: 8,
    price: 255
  },
  {
    key: "aethercub",
    title: "Aether Cub",
    speciesId: "shop_aethercub",
    speciesName: "Aether Cub",
    bodyShape: "wolf",
    colorPrimary: "#a8d4ff",
    colorAccent: "#2a5080",
    attackBonus: 10,
    price: 395
  }
];

export function petAttackBuffForParty(
  activePetId: string | null,
  pets: readonly { id: string; attackBonus: number }[] | null | undefined
): number {
  if (!activePetId || !pets) return 0;
  const pet = pets.find((p) => p.id === activePetId);
  if (!pet) return 0;
  return Math.min(PET_ATTACK_BUFF_CAP, Math.max(0, pet.attackBonus));
}

export const ENEMIES: EnemyDefinition[] = [
  // ── Meadow (low level starter pool) ────────────────────────────────────
  {
    id: "slime",
    name: "Slime",
    maxHp: 13,
    attack: 4,
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
    maxHp: 12,
    attack: 5,
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
    maxHp: 21,
    attack: 7,
    defense: 2,
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

/**
 * Combat-strength multiplier for a random encounter vs current player level.
 * Low `minLevel` foes are softened when first unlocked, then ramp as the player
 * outlevels the gate. Mid and high-tier enemies start closer to full strength
 * and scale up more aggressively so late wilds stay threatening.
 */
export function encounterCombatMultiplier(def: EnemyDefinition, playerLevel: number): number {
  const d = Math.max(0, playerLevel - def.minLevel);

  if (def.minLevel <= 2) {
    const ease = 0.66 + Math.min(0.32, d * 0.072 + Math.max(0, playerLevel - 5) * 0.038);
    const ramp = 1 + Math.min(0.44, d * 0.036);
    return Math.min(1.5, ease * ramp);
  }
  if (def.minLevel <= 4) {
    const ease = 0.86 + Math.min(0.14, d * 0.048);
    const ramp = 1 + Math.min(0.55, d * 0.044);
    return Math.min(1.58, ease * ramp);
  }
  const ease = def.minLevel >= 8 ? 1.0 : 0.93 + Math.min(0.09, d * 0.028);
  const perLevel = def.minLevel >= 8 ? 0.062 : def.minLevel >= 6 ? 0.056 : 0.05;
  const ramp = 1 + Math.min(0.72, d * perLevel);
  return Math.min(1.78, ease * ramp);
}

/** Apply {@link encounterCombatMultiplier} to combat stats (and mild reward scaling). */
export function scaleEncounterForPlayerLevel(def: EnemyDefinition, playerLevel: number): EnemyDefinition {
  const combat = encounterCombatMultiplier(def, playerLevel);
  const rewards = 0.74 + 0.26 * combat;
  return {
    ...def,
    maxHp: Math.max(1, Math.round(def.maxHp * combat)),
    attack: Math.max(1, Math.round(def.attack * combat)),
    defense: Math.max(0, Math.round(def.defense * combat)),
    speed: Math.max(1, Math.round(def.speed * combat)),
    xpReward: Math.max(1, Math.round(def.xpReward * rewards)),
    goldReward: Math.max(0, Math.round(def.goldReward * rewards))
  };
}

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

/** Extra effects when a consumable is used in battle (field use is heal-only). */
export type ItemBattleExtra = {
  /** Immediate chip to the current foe (reduced by part of their defense, minimum 1). */
  splashDamage?: number;
  /** Flat attack bonus for the rest of this fight (stacks). */
  attackBuff?: number;
  /** Flat defense bonus for the rest of this fight (stacks). */
  defenseBuff?: number;
  /** Reduces shared skill cooldown by this many turns (immediate, not below 0). */
  cooldownCuts?: number;
};

export type ItemDefinition = {
  name: string;
  healAmount: number;
  price: number;
  extra?: ItemBattleExtra;
};

export const ITEM_DATA: Record<ItemKey, ItemDefinition> = {
  potion: { name: "Potion", healAmount: 20, price: 12, extra: { splashDamage: 5 } },
  hiPotion: { name: "Hi-Potion", healAmount: 45, price: 34, extra: { splashDamage: 12, cooldownCuts: 1 } },
  megaPotion: { name: "Mega Potion", healAmount: 80, price: 78, extra: { splashDamage: 22, attackBuff: 1 } },
  sipsGinseng: { name: "Ginseng Sip", healAmount: 10, price: 8, extra: { attackBuff: 1 } },
  berryTonic: { name: "Berry Tonic", healAmount: 14, price: 10, extra: { defenseBuff: 1 } },
  dewdropVial: { name: "Dewdrop Vial", healAmount: 16, price: 11, extra: { splashDamage: 9 } },
  honeySalve: { name: "Honey Salve", healAmount: 18, price: 12, extra: { attackBuff: 1, splashDamage: 4 } },
  mossDraught: { name: "Moss Draught", healAmount: 22, price: 14, extra: { defenseBuff: 2 } },
  riverWater: { name: "River Water", healAmount: 24, price: 15, extra: { splashDamage: 11, cooldownCuts: 1 } },
  herbalPaste: { name: "Herbal Paste", healAmount: 26, price: 16, extra: { attackBuff: 2 } },
  minersAle: { name: "Miner's Ale", healAmount: 30, price: 18, extra: { attackBuff: 1, defenseBuff: 1 } },
  wyrmTea: { name: "Wyrm Tea", healAmount: 35, price: 22, extra: { splashDamage: 22 } },
  spiritBandage: { name: "Spirit Bandage", healAmount: 38, price: 24, extra: { defenseBuff: 1, cooldownCuts: 1 } },
  elixirLight: { name: "Light Elixir", healAmount: 42, price: 28, extra: { splashDamage: 16, attackBuff: 1 } },
  sunOrchidMix: { name: "Sun Orchid Mix", healAmount: 48, price: 32, extra: { attackBuff: 3 } },
  frostleafBrew: { name: "Frostleaf Brew", healAmount: 52, price: 36, extra: { splashDamage: 30 } },
  shadowTincture: { name: "Shadow Tincture", healAmount: 58, price: 40, extra: { defenseBuff: 4 } },
  amberSerum: { name: "Amber Serum", healAmount: 64, price: 45, extra: { cooldownCuts: 2 } },
  cometDrop: { name: "Comet Drop", healAmount: 70, price: 52, extra: { splashDamage: 42 } },
  celestialNectar: { name: "Celestial Nectar", healAmount: 88, price: 62, extra: { attackBuff: 2, defenseBuff: 2 } },
  dragonBloodSap: { name: "Dragonblood Sap", healAmount: 95, price: 70, extra: { splashDamage: 28, cooldownCuts: 1 } },
  empressBalm: { name: "Empress Balm", healAmount: 105, price: 80, extra: { cooldownCuts: 3 } },
  worldTreeDew: {
    name: "World-Tree Dew",
    healAmount: 120,
    price: 95,
    extra: { splashDamage: 50, cooldownCuts: 2, attackBuff: 2, defenseBuff: 2 }
  }
};

/** Tooltip / shop line: heal plus battle-only extras. */
export function formatItemTooltipSummary(key: ItemKey): string {
  const d = ITEM_DATA[key];
  const bits: string[] = [`+${d.healAmount} HP`];
  const e = d.extra;
  if (!e) return bits.join(" · ");
  if (e.splashDamage) bits.push(`~${e.splashDamage} splash`);
  if (e.attackBuff) bits.push(`+${e.attackBuff} ATK (fight)`);
  if (e.defenseBuff) bits.push(`+${e.defenseBuff} DEF (fight)`);
  if (e.cooldownCuts) bits.push(`−${e.cooldownCuts} skill CD`);
  return bits.join(" · ");
}

/** Stable iteration order for migrations and empty inventory templates. */
export const ALL_ITEM_KEYS = Object.keys(ITEM_DATA) as ItemKey[];

/** Best healing consumable first (field auto-use, overflow healing). */
export const ITEM_PRIORITY: ItemKey[] = (ALL_ITEM_KEYS as ItemKey[]).slice().sort((a, b) => {
  const ha = ITEM_DATA[a].healAmount;
  const hb = ITEM_DATA[b].healAmount;
  if (hb !== ha) return hb - ha;
  return ITEM_DATA[a].price - ITEM_DATA[b].price;
});

/** All consumables sold in general stores (cheapest first in UI). */
export const SHOP_ITEMS: ItemKey[] = (ALL_ITEM_KEYS as ItemKey[]).slice().sort(
  (a, b) => ITEM_DATA[a].price - ITEM_DATA[b].price
);

/** One-time purchase — enables the floating compass overlay that points to the nearest town. */
export const TOWN_MAP = {
  name: "Town Map",
  price: 40,
  description: "A compass-inked scroll that always points toward the nearest town."
} as const;
export const SHOP_WEAPONS: WeaponKey[] = ["ironSword", "steelSword", "mythrilBlade"];

/** `cooldown` = shared skill lockout turns after that skill is cast (all skills unusable until it ticks down). */
export const SKILL_DATA = {
  spark: { name: "Spark", minLevel: 1, powerBonus: 4, cooldown: 2 },
  iceShard: { name: "Ice Shard", minLevel: 3, powerBonus: 8, cooldown: 3 },
  thunderLance: { name: "Thunder Lance", minLevel: 5, powerBonus: 12, cooldown: 4 },
  meteorBreak: { name: "Meteor Break", minLevel: 8, powerBonus: 18, cooldown: 5 }
} as const satisfies Record<SkillKey, { name: string; minLevel: number; powerBonus: number; cooldown: number }>;

export const SKILL_ORDER: SkillKey[] = ["spark", "iceShard", "thunderLance", "meteorBreak"];

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
