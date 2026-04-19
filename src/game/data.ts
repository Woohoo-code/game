import type {
  ArmorKey,
  BattleStanceKind,
  BiomeKind,
  ElementKind,
  EnemyDefinition,
  HorseKey,
  ItemKey,
  MonsterBodyShape,
  ResourceKey,
  SkillKey,
  WeaponKey
} from "./types";

/** Max attack the active pet adds to your strike power (basic attack + skills). */
export const PET_ATTACK_BUFF_CAP = 10;

/** Cumulative Void Titan kills across all realms; UGC Studio unlocks at this count. */
export const UGC_STUDIO_VOID_TITANS_REQUIRED = 2;

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

/** Purchase order in the stables UI (five mounts, +1 speed each, +5 cap). */
export const STABLE_HORSE_ORDER: HorseKey[] = [
  "dustPony",
  "moorCob",
  "riverPalfrey",
  "sunCourser",
  "stormcharger"
];

export const STABLE_HORSES: Record<HorseKey, { name: string; price: number }> = {
  dustPony: { name: "Dust Pony", price: 38 },
  moorCob: { name: "Moor Cob", price: 58 },
  riverPalfrey: { name: "River Palfrey", price: 88 },
  sunCourser: { name: "Sun Courser", price: 128 },
  stormcharger: { name: "Stormcharger", price: 185 }
};

/** Total battle speed from owned mounts (each mount +1, max +5). */
export function stableHorseSpeedBonus(owned: readonly HorseKey[] | null | undefined): number {
  if (!owned?.length) return 0;
  const set = new Set<HorseKey>();
  for (const k of owned) {
    if (STABLE_HORSES[k]) set.add(k);
  }
  return Math.min(5, set.size);
}

export function petAttackBuffForParty(
  activePetId: string | null,
  pets: readonly { id: string; attackBonus: number }[] | null | undefined
): number {
  if (!activePetId || !pets) return 0;
  const pet = pets.find((p) => p.id === activePetId);
  if (!pet) return 0;
  return Math.min(PET_ATTACK_BUFF_CAP, Math.max(0, pet.attackBonus));
}

/** Max companion level from stables drills (separate from tame level 1 start). */
export const PET_STABLE_MAX_LEVEL = 25;

/** Gold fee for one stable training session (scales slightly with current pet level). */
export function stablePetTrainFee(petLevel: number): number {
  return 8 + Math.max(1, Math.floor(petLevel)) * 4;
}

/**
 * Real-time duration for one stable level-up (ms). Higher-level pets need longer drills.
 * Level 1 ≈ 32s, level 10 ≈ 2m20s, level 20 ≈ 4m20s.
 */
export function stablePetTrainDurationMs(petLevel: number): number {
  const L = Math.max(1, Math.floor(petLevel));
  return (20 + L * 12) * 1000;
}

/** World-1 wilds only; portal realms use {@link RIFTLANDS_ENEMIES}. */
const REALM1_ENEMIES_RAW: EnemyDefinition[] = [
  // ── Meadow (low level starter pool) ────────────────────────────────────
  {
    id: "slime",
    name: "Slime",
    element: "water",
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
    element: "air",
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
    element: "earth",
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
    biomes: ["meadow", "forest", "desert"],
    visibleRoamer: true
  },

  // ── Forest biome ───────────────────────────────────────────────────────
  {
    id: "wolf",
    name: "Dire Wolf",
    element: "earth",
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
    biomes: ["forest", "meadow"],
    visibleRoamer: true
  },
  {
    id: "forestSpider",
    name: "Forest Spider",
    element: "earth",
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
    customColors: { primary: "#3a2a1e", accent: "#9a2e2a" },
    visibleRoamer: true
  },
  {
    id: "caveBat",
    name: "Cave Bat",
    element: "air",
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
    element: "fire",
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
    customColors: { primary: "#d6a64c", accent: "#6f3a1a" },
    visibleRoamer: true
  },
  {
    id: "sandDrake",
    name: "Dune Drake",
    element: "fire",
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
    customColors: { primary: "#c49a4a", accent: "#5a3b1a" },
    visibleRoamer: true
  },

  // ── Swamp biome ────────────────────────────────────────────────────────
  {
    id: "bogSlime",
    name: "Bog Slime",
    element: "water",
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
    element: "water",
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
    customColors: { primary: "#4f5f36", accent: "#2a2415" },
    visibleRoamer: true
  },
  {
    id: "wraith",
    name: "Wraith",
    element: "air",
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
    biomes: ["swamp", "tundra"],
    visibleRoamer: true
  },

  // ── Tundra biome ───────────────────────────────────────────────────────
  {
    id: "frostWolf",
    name: "Frost Wolf",
    element: "water",
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
    customColors: { primary: "#dfe8f0", accent: "#6b8fb4" },
    visibleRoamer: true
  },
  {
    id: "iceWraith",
    name: "Ice Wraith",
    element: "water",
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
    customColors: { primary: "#2f4d6e", accent: "#8ce5ff" },
    visibleRoamer: true
  },

  // ── Generalist dragon (any biome at high level) ────────────────────────
  {
    id: "drake",
    name: "Young Drake",
    element: "fire",
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
    biomes: ["meadow", "forest", "tundra"],
    visibleRoamer: true
  },

  // ── Late wilds (high player level) ─────────────────────────────────────
  {
    id: "royalOoze",
    name: "Royal Ooze",
    element: "water",
    maxHp: 52,
    attack: 17,
    defense: 8,
    speed: 5,
    xpReward: 40,
    goldReward: 34,
    minLevel: 10,
    baseWeight: 2.2,
    weightGrowthPerLevel: 0.42,
    maxWeight: 10,
    biomes: ["meadow"],
    bodyShape: "slime",
    customColors: { primary: "#6a4088", accent: "#e0c8ff" }
  },
  {
    id: "gloomwing",
    name: "Gloomwing",
    element: "air",
    maxHp: 44,
    attack: 18,
    defense: 6,
    speed: 12,
    xpReward: 38,
    goldReward: 32,
    minLevel: 9,
    baseWeight: 2.4,
    weightGrowthPerLevel: 0.45,
    maxWeight: 10,
    biomes: ["meadow", "forest"],
    bodyShape: "bat",
    customColors: { primary: "#3a3550", accent: "#a080c8" }
  },
  {
    id: "ironclawMarauder",
    name: "Ironclaw Marauder",
    element: "earth",
    maxHp: 68,
    attack: 24,
    defense: 12,
    speed: 8,
    xpReward: 54,
    goldReward: 48,
    minLevel: 11,
    baseWeight: 1.8,
    weightGrowthPerLevel: 0.52,
    maxWeight: 9,
    biomes: ["meadow", "forest", "desert"],
    bodyShape: "goblin",
    customColors: { primary: "#4a4a58", accent: "#c8b060" }
  },
  {
    id: "thornbackRecluse",
    name: "Thornback Recluse",
    element: "earth",
    maxHp: 72,
    attack: 26,
    defense: 13,
    speed: 10,
    xpReward: 58,
    goldReward: 50,
    minLevel: 12,
    baseWeight: 1.5,
    weightGrowthPerLevel: 0.58,
    maxWeight: 9,
    biomes: ["forest"],
    bodyShape: "spider",
    customColors: { primary: "#1a1810", accent: "#b03050" }
  },
  {
    id: "siroccoWyrm",
    name: "Sirocco Wyrm",
    element: "fire",
    maxHp: 98,
    attack: 31,
    defense: 15,
    speed: 10,
    xpReward: 72,
    goldReward: 62,
    minLevel: 12,
    baseWeight: 1.1,
    weightGrowthPerLevel: 0.72,
    maxWeight: 8,
    biomes: ["desert"],
    bodyShape: "drake",
    customColors: { primary: "#d47830", accent: "#4a2010" }
  },
  {
    id: "abyssalLeech",
    name: "Abyssal Leech",
    element: "water",
    maxHp: 78,
    attack: 23,
    defense: 14,
    speed: 4,
    xpReward: 56,
    goldReward: 46,
    minLevel: 11,
    baseWeight: 1.6,
    weightGrowthPerLevel: 0.5,
    maxWeight: 9,
    biomes: ["swamp"],
    bodyShape: "slime",
    customColors: { primary: "#203028", accent: "#608868" }
  },
  {
    id: "gravewalker",
    name: "Gravewalker",
    element: "air",
    maxHp: 76,
    attack: 28,
    defense: 14,
    speed: 11,
    xpReward: 64,
    goldReward: 56,
    minLevel: 12,
    baseWeight: 1.35,
    weightGrowthPerLevel: 0.62,
    maxWeight: 8,
    biomes: ["swamp", "tundra"],
    bodyShape: "wraith",
    customColors: { primary: "#303040", accent: "#9090b0" }
  },
  {
    id: "glacialRevenant",
    name: "Glacial Revenant",
    element: "water",
    maxHp: 92,
    attack: 32,
    defense: 17,
    speed: 11,
    xpReward: 74,
    goldReward: 64,
    minLevel: 13,
    baseWeight: 1.15,
    weightGrowthPerLevel: 0.68,
    maxWeight: 8,
    biomes: ["tundra"],
    bodyShape: "wraith",
    customColors: { primary: "#102838", accent: "#70d0ff" }
  },
  {
    id: "rimeboundAlpha",
    name: "Rimebound Alpha",
    element: "water",
    maxHp: 88,
    attack: 30,
    defense: 16,
    speed: 12,
    xpReward: 70,
    goldReward: 60,
    minLevel: 13,
    baseWeight: 1.25,
    weightGrowthPerLevel: 0.65,
    maxWeight: 9,
    biomes: ["tundra"],
    bodyShape: "wolf",
    customColors: { primary: "#a8c8e8", accent: "#204060" }
  },
  {
    id: "elderDrake",
    name: "Elder Drake",
    element: "fire",
    maxHp: 128,
    attack: 38,
    defense: 20,
    speed: 9,
    xpReward: 92,
    goldReward: 78,
    minLevel: 15,
    baseWeight: 0.65,
    weightGrowthPerLevel: 0.95,
    maxWeight: 7,
    biomes: ["meadow", "forest", "tundra"],
    bodyShape: "drake",
    customColors: { primary: "#6a5030", accent: "#ffd060" }
  }
];

/**
 * Post-rift overworlds (`realmTier` ≥ 2): new species, higher baseline stats than Aetheria.
 * Reuses body models with distinct palettes and names.
 */
const RIFTLANDS_ENEMIES: EnemyDefinition[] = [
  {
    id: "voidgelPrimordial",
    name: "Primordial Voidgel",
    element: "water",
    maxHp: 40,
    attack: 14,
    defense: 6,
    speed: 6,
    xpReward: 36,
    goldReward: 30,
    minLevel: 8,
    baseWeight: 5,
    weightGrowthPerLevel: 0.35,
    maxWeight: 11,
    minRealmTier: 2,
    biomes: ["meadow"],
    bodyShape: "slime",
    customColors: { primary: "#4a2a6e", accent: "#c9a8ff" }
  },
  {
    id: "shrikeGaleborn",
    name: "Galeborn Shrike",
    element: "air",
    maxHp: 36,
    attack: 16,
    defense: 5,
    speed: 14,
    xpReward: 34,
    goldReward: 28,
    minLevel: 9,
    baseWeight: 4.2,
    weightGrowthPerLevel: 0.38,
    maxWeight: 10,
    minRealmTier: 2,
    biomes: ["meadow", "forest"],
    bodyShape: "bat",
    customColors: { primary: "#6ec0d4", accent: "#1a3a48" }
  },
  {
    id: "ironpeltRaider",
    name: "Ironpelt Raider",
    element: "earth",
    maxHp: 58,
    attack: 21,
    defense: 11,
    speed: 8,
    xpReward: 48,
    goldReward: 42,
    minLevel: 10,
    baseWeight: 3.2,
    weightGrowthPerLevel: 0.42,
    maxWeight: 11,
    minRealmTier: 2,
    biomes: ["meadow", "forest", "desert"],
    bodyShape: "goblin",
    customColors: { primary: "#6a5a4a", accent: "#c0a060" },
    visibleRoamer: true
  },
  {
    id: "murkwolfPrime",
    name: "Murkwolf Prime",
    element: "earth",
    maxHp: 74,
    attack: 27,
    defense: 15,
    speed: 12,
    xpReward: 62,
    goldReward: 54,
    minLevel: 11,
    baseWeight: 2.2,
    weightGrowthPerLevel: 0.58,
    maxWeight: 10,
    minRealmTier: 2,
    biomes: ["forest", "meadow"],
    bodyShape: "wolf",
    customColors: { primary: "#1a1520", accent: "#8b2942" },
    visibleRoamer: true
  },
  {
    id: "widowAshenweb",
    name: "Ashenweb Widow",
    element: "earth",
    maxHp: 68,
    attack: 24,
    defense: 12,
    speed: 11,
    xpReward: 56,
    goldReward: 48,
    minLevel: 11,
    baseWeight: 2.6,
    weightGrowthPerLevel: 0.5,
    maxWeight: 10,
    minRealmTier: 2,
    biomes: ["forest"],
    bodyShape: "spider",
    customColors: { primary: "#2a2028", accent: "#d04060" },
    visibleRoamer: true
  },
  {
    id: "cavernScreamer",
    name: "Cavern Screamer",
    element: "air",
    maxHp: 46,
    attack: 19,
    defense: 6,
    speed: 13,
    xpReward: 42,
    goldReward: 34,
    minLevel: 10,
    baseWeight: 3,
    weightGrowthPerLevel: 0.42,
    maxWeight: 10,
    minRealmTier: 2,
    biomes: ["forest", "tundra"],
    bodyShape: "bat",
    customColors: { primary: "#e8d8f0", accent: "#804060" }
  },
  {
    id: "sunbrandStalker",
    name: "Sunbrand Stalker",
    element: "fire",
    maxHp: 88,
    attack: 32,
    defense: 17,
    speed: 10,
    xpReward: 72,
    goldReward: 62,
    minLevel: 12,
    baseWeight: 2.4,
    weightGrowthPerLevel: 0.52,
    maxWeight: 10,
    minRealmTier: 2,
    biomes: ["desert"],
    bodyShape: "scorpion",
    customColors: { primary: "#f0a040", accent: "#4a1810" },
    visibleRoamer: true
  },
  {
    id: "obsidianDuneSerpent",
    name: "Obsidian Dune Serpent",
    element: "fire",
    maxHp: 124,
    attack: 40,
    defense: 22,
    speed: 11,
    xpReward: 96,
    goldReward: 84,
    minLevel: 14,
    baseWeight: 0.95,
    weightGrowthPerLevel: 0.88,
    maxWeight: 8,
    minRealmTier: 2,
    biomes: ["desert"],
    bodyShape: "drake",
    customColors: { primary: "#1a1020", accent: "#ff6a30" },
    visibleRoamer: true
  },
  {
    id: "vitriolBloom",
    name: "Vitriol Bloom",
    element: "water",
    maxHp: 62,
    attack: 22,
    defense: 11,
    speed: 5,
    xpReward: 52,
    goldReward: 44,
    minLevel: 11,
    baseWeight: 3.4,
    weightGrowthPerLevel: 0.4,
    maxWeight: 11,
    minRealmTier: 2,
    biomes: ["swamp"],
    bodyShape: "slime",
    customColors: { primary: "#5a8040", accent: "#c8e020" }
  },
  {
    id: "hexmireMatron",
    name: "Hexmire Matron",
    element: "water",
    maxHp: 94,
    attack: 35,
    defense: 20,
    speed: 10,
    xpReward: 84,
    goldReward: 72,
    minLevel: 13,
    baseWeight: 1.5,
    weightGrowthPerLevel: 0.62,
    maxWeight: 9,
    minRealmTier: 2,
    biomes: ["swamp"],
    bodyShape: "goblin",
    customColors: { primary: "#304030", accent: "#a060c0" },
    visibleRoamer: true
  },
  {
    id: "netherVeil",
    name: "Nether Veil",
    element: "air",
    maxHp: 86,
    attack: 32,
    defense: 17,
    speed: 14,
    xpReward: 76,
    goldReward: 66,
    minLevel: 12,
    baseWeight: 1.6,
    weightGrowthPerLevel: 0.68,
    maxWeight: 9,
    minRealmTier: 2,
    biomes: ["swamp", "tundra"],
    bodyShape: "wraith",
    customColors: { primary: "#2a2040", accent: "#a090ff" },
    visibleRoamer: true
  },
  {
    id: "rimefangPacklord",
    name: "Rimefang Packlord",
    element: "water",
    maxHp: 82,
    attack: 30,
    defense: 16,
    speed: 13,
    xpReward: 70,
    goldReward: 60,
    minLevel: 12,
    baseWeight: 2,
    weightGrowthPerLevel: 0.58,
    maxWeight: 10,
    minRealmTier: 2,
    biomes: ["tundra"],
    bodyShape: "wolf",
    customColors: { primary: "#c8e8ff", accent: "#204878" },
    visibleRoamer: true
  },
  {
    id: "polarGeist",
    name: "Polar Geist",
    element: "water",
    maxHp: 102,
    attack: 36,
    defense: 21,
    speed: 13,
    xpReward: 92,
    goldReward: 78,
    minLevel: 14,
    baseWeight: 1.35,
    weightGrowthPerLevel: 0.78,
    maxWeight: 8,
    minRealmTier: 2,
    biomes: ["tundra"],
    bodyShape: "wraith",
    customColors: { primary: "#183048", accent: "#a0f0ff" },
    visibleRoamer: true
  },
  {
    id: "cometWyrmling",
    name: "Comet Wyrmling",
    element: "fire",
    maxHp: 108,
    attack: 38,
    defense: 22,
    speed: 10,
    xpReward: 98,
    goldReward: 84,
    minLevel: 15,
    baseWeight: 0.85,
    weightGrowthPerLevel: 0.9,
    maxWeight: 8,
    minRealmTier: 2,
    biomes: ["meadow", "forest", "tundra"],
    bodyShape: "drake",
    customColors: { primary: "#5068a0", accent: "#ffe8a0" },
    visibleRoamer: true
  },

  // ── Riftlands apex (very high level) ───────────────────────────────────
  {
    id: "nullBloom",
    name: "Null Bloom",
    element: "water",
    maxHp: 118,
    attack: 40,
    defense: 22,
    speed: 6,
    xpReward: 102,
    goldReward: 88,
    minLevel: 16,
    baseWeight: 1.15,
    weightGrowthPerLevel: 0.72,
    maxWeight: 8,
    minRealmTier: 2,
    biomes: ["swamp", "meadow"],
    bodyShape: "slime",
    customColors: { primary: "#201828", accent: "#ff60a0" }
  },
  {
    id: "eclipseStalker",
    name: "Eclipse Stalker",
    element: "earth",
    maxHp: 112,
    attack: 42,
    defense: 21,
    speed: 12,
    xpReward: 98,
    goldReward: 84,
    minLevel: 16,
    baseWeight: 1.05,
    weightGrowthPerLevel: 0.75,
    maxWeight: 8,
    minRealmTier: 2,
    biomes: ["forest"],
    bodyShape: "spider",
    customColors: { primary: "#0a0810", accent: "#7030c0" }
  },
  {
    id: "cinderpackWarmonger",
    name: "Cinderpack Warmonger",
    element: "earth",
    maxHp: 108,
    attack: 39,
    defense: 22,
    speed: 9,
    xpReward: 94,
    goldReward: 80,
    minLevel: 16,
    baseWeight: 1.1,
    weightGrowthPerLevel: 0.7,
    maxWeight: 8,
    minRealmTier: 2,
    biomes: ["desert", "meadow"],
    bodyShape: "goblin",
    customColors: { primary: "#5a3020", accent: "#ff9040" }
  },
  {
    id: "sunscorchTyrant",
    name: "Sunscorch Tyrant",
    element: "fire",
    maxHp: 138,
    attack: 46,
    defense: 24,
    speed: 10,
    xpReward: 118,
    goldReward: 100,
    minLevel: 17,
    baseWeight: 0.85,
    weightGrowthPerLevel: 0.82,
    maxWeight: 7,
    minRealmTier: 2,
    biomes: ["desert"],
    bodyShape: "scorpion",
    customColors: { primary: "#ffd040", accent: "#601010" }
  },
  {
    id: "stormchainAlpha",
    name: "Stormchain Alpha",
    element: "water",
    maxHp: 124,
    attack: 42,
    defense: 21,
    speed: 14,
    xpReward: 108,
    goldReward: 92,
    minLevel: 17,
    baseWeight: 0.95,
    weightGrowthPerLevel: 0.78,
    maxWeight: 8,
    minRealmTier: 2,
    biomes: ["tundra", "forest"],
    bodyShape: "wolf",
    customColors: { primary: "#d0e8ff", accent: "#304878" }
  },
  {
    id: "voidcrownHerald",
    name: "Voidcrown Herald",
    element: "air",
    maxHp: 132,
    attack: 44,
    defense: 23,
    speed: 13,
    xpReward: 118,
    goldReward: 100,
    minLevel: 18,
    baseWeight: 0.75,
    weightGrowthPerLevel: 0.85,
    maxWeight: 7,
    minRealmTier: 2,
    biomes: ["swamp", "tundra"],
    bodyShape: "wraith",
    customColors: { primary: "#181028", accent: "#c070ff" }
  },
  {
    id: "abyssDrakeMature",
    name: "Abyss Drake",
    element: "fire",
    maxHp: 168,
    attack: 52,
    defense: 28,
    speed: 10,
    xpReward: 142,
    goldReward: 118,
    minLevel: 19,
    baseWeight: 0.55,
    weightGrowthPerLevel: 0.95,
    maxWeight: 6,
    minRealmTier: 2,
    biomes: ["desert", "meadow", "tundra"],
    bodyShape: "drake",
    customColors: { primary: "#2a1838", accent: "#ff4848" }
  },
  {
    id: "starfallLeviathan",
    name: "Starfall Leviathan",
    element: "fire",
    maxHp: 198,
    attack: 58,
    defense: 32,
    speed: 9,
    xpReward: 168,
    goldReward: 138,
    minLevel: 21,
    baseWeight: 0.38,
    weightGrowthPerLevel: 1.05,
    maxWeight: 5,
    minRealmTier: 2,
    biomes: ["meadow", "forest", "desert", "tundra"],
    bodyShape: "drake",
    customColors: { primary: "#405080", accent: "#fff8a0" }
  }
];

/**
 * Undead pool that only spawns inside dungeons. They never roll in random wilds
 * or appear as overworld roamers — {@link DUNGEON_ROAMER_IDS} selects from here.
 */
export const DUNGEON_ENEMIES: EnemyDefinition[] = [
  {
    id: "dungeonSkeleton",
    name: "Rattling Skeleton",
    element: "earth",
    maxHp: 64,
    attack: 22,
    defense: 9,
    speed: 8,
    xpReward: 44,
    goldReward: 36,
    minLevel: 6,
    baseWeight: 0,
    weightGrowthPerLevel: 0,
    maxWeight: 0,
    minRealmTier: 2,
    bodyShape: "goblin",
    customColors: { primary: "#e4e0d2", accent: "#33302a" }
  },
  {
    id: "dungeonZombie",
    name: "Sodden Zombie",
    element: "earth",
    maxHp: 84,
    attack: 19,
    defense: 11,
    speed: 4,
    xpReward: 48,
    goldReward: 38,
    minLevel: 7,
    baseWeight: 0,
    weightGrowthPerLevel: 0,
    maxWeight: 0,
    minRealmTier: 2,
    bodyShape: "slime",
    customColors: { primary: "#4a5a2a", accent: "#1a220a" }
  },
  {
    id: "dungeonBoneknight",
    name: "Bone Knight",
    element: "earth",
    maxHp: 112,
    attack: 30,
    defense: 17,
    speed: 9,
    xpReward: 78,
    goldReward: 66,
    minLevel: 9,
    baseWeight: 0,
    weightGrowthPerLevel: 0,
    maxWeight: 0,
    minRealmTier: 2,
    bodyShape: "wraith",
    customColors: { primary: "#d0cab0", accent: "#2a2a3a" }
  },
  {
    id: "dungeonCryptwyrm",
    name: "Crypt Wyrm",
    element: "air",
    maxHp: 98,
    attack: 28,
    defense: 13,
    speed: 13,
    xpReward: 72,
    goldReward: 58,
    minLevel: 9,
    baseWeight: 0,
    weightGrowthPerLevel: 0,
    maxWeight: 0,
    minRealmTier: 2,
    bodyShape: "drake",
    customColors: { primary: "#3a3a2a", accent: "#c6a858" }
  },
  {
    id: "dungeonGhoul",
    name: "Charnel Ghoul",
    element: "water",
    maxHp: 92,
    attack: 26,
    defense: 10,
    speed: 11,
    xpReward: 62,
    goldReward: 48,
    minLevel: 8,
    baseWeight: 0,
    weightGrowthPerLevel: 0,
    maxWeight: 0,
    minRealmTier: 2,
    bodyShape: "goblin",
    customColors: { primary: "#6a4a5a", accent: "#1a1018" }
  }
];

export const ENEMIES: EnemyDefinition[] = [
  ...REALM1_ENEMIES_RAW.map((e) => ({ ...e, maxRealmTier: 1 })),
  ...RIFTLANDS_ENEMIES,
  ...DUNGEON_ENEMIES
];

/**
 * Rare loot pool rolled when the player opens a dungeon chest. Lists only
 * existing ItemKey values so the chest just adds to the player's bag.
 */
export const DUNGEON_CHEST_LOOT: readonly ItemKey[] = [
  "elixirLight",
  "sunOrchidMix",
  "frostleafBrew",
  "shadowTincture",
  "amberSerum",
  "cometDrop",
  "celestialNectar",
  "dragonBloodSap",
  "empressBalm",
  "worldTreeDew"
];

/** UI order for stance picker (Balanced default). */
export const BATTLE_STANCE_ORDER: readonly BattleStanceKind[] = ["balanced", "stealth", "power", "fortune"];

export type BattleStanceRow = {
  label: string;
  blurb: string;
  /** Fraction of enemy defense ignored (0–1) for weapon and skill hits. */
  defenseIgnore: number;
  /** Multiplier on your final damage after element effectiveness. */
  outgoingDamageMult: number;
  /** Multiplier on damage the monster deals to you on its turn. */
  incomingDamageMult: number;
  /** XP from this win (non-boss only). Bosses ignore reward mults. */
  xpRewardMult: number;
  goldRewardMult: number;
};

export const BATTLE_STANCES: Record<BattleStanceKind, BattleStanceRow> = {
  balanced: {
    label: "Balanced",
    blurb: "Standard exchanges — no special modifiers.",
    defenseIgnore: 0,
    outgoingDamageMult: 1,
    incomingDamageMult: 1,
    xpRewardMult: 1,
    goldRewardMult: 1
  },
  stealth: {
    label: "Shadow",
    blurb: "Strike weak points: ignore part of the foe's defense and take less damage; hits are slightly softer.",
    defenseIgnore: 0.26,
    outgoingDamageMult: 0.96,
    incomingDamageMult: 0.82,
    xpRewardMult: 1,
    goldRewardMult: 1
  },
  power: {
    label: "Strong",
    blurb: "All-out offense: harder hits, but the enemy's blows sting more.",
    defenseIgnore: 0.06,
    outgoingDamageMult: 1.22,
    incomingDamageMult: 1.14,
    xpRewardMult: 1,
    goldRewardMult: 1
  },
  fortune: {
    label: "Fortune",
    blurb: "Fight for spoils: bonus XP and gold if you win; slightly weaker attacks.",
    defenseIgnore: 0,
    outgoingDamageMult: 0.93,
    incomingDamageMult: 1,
    xpRewardMult: 1.15,
    goldRewardMult: 1.12
  }
};

export function battleStanceModifiers(stance: BattleStanceKind | undefined): BattleStanceRow {
  if (stance && BATTLE_STANCES[stance]) return BATTLE_STANCES[stance];
  return BATTLE_STANCES.balanced;
}

/** Whether a definition can spawn random encounters on this realm tier. */
export function enemyAppearsInRealm(def: EnemyDefinition, realmTier: number): boolean {
  const rt = Math.max(1, Math.floor(realmTier));
  const minR = def.minRealmTier ?? 1;
  const maxR = def.maxRealmTier ?? 999;
  return rt >= minR && rt <= maxR;
}

/** Built-in encounter pool for the current realm (and biome when set). */
export function enemiesForRealm(
  realmTier: number,
  biome?: BiomeKind,
  opts?: { randomEncounterOnly?: boolean }
): EnemyDefinition[] {
  const rt = Math.max(1, Math.floor(realmTier));
  return ENEMIES.filter((e) => {
    if (!enemyAppearsInRealm(e, rt)) return false;
    if (opts?.randomEncounterOnly && e.visibleRoamer) return false;
    if (biome == null) return true;
    return !e.biomes || e.biomes.length === 0 || e.biomes.includes(biome);
  });
}

export const BOSS_ENEMY: EnemyDefinition = {
  id: "voidTitan",
  name: "Void Titan",
  element: "air",
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

/** Arena boss for the active realm — same id for story/3D; stronger from the second world onward. */
export function bossEnemyForRealm(realmTier: number): EnemyDefinition {
  const tier = Math.max(1, Math.floor(realmTier));
  if (tier <= 1) return BOSS_ENEMY;
  const mult = 1 + (tier - 1) * 0.32;
  return {
    ...BOSS_ENEMY,
    name: "Abyss-Touched Void Titan",
    maxHp: Math.round(BOSS_ENEMY.maxHp * mult),
    attack: Math.round(BOSS_ENEMY.attack * mult),
    defense: Math.round(BOSS_ENEMY.defense * mult),
    speed: Math.round(BOSS_ENEMY.speed * mult),
    xpReward: Math.round(BOSS_ENEMY.xpReward * mult),
    goldReward: Math.round(BOSS_ENEMY.goldReward * mult)
  };
}

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
  woodSword: { name: "Wood Sword", attackBonus: 0, price: 0, element: "earth" as const },
  ironSword: { name: "Iron Sword", attackBonus: 3, price: 60, element: "earth" as const },
  steelSword: { name: "Steel Sword", attackBonus: 6, price: 140, element: "earth" as const },
  mythrilBlade: { name: "Mythril Blade", attackBonus: 10, price: 280, element: "air" as const }
} as const satisfies Record<WeaponKey, { name: string; attackBonus: number; price: number; element: ElementKind }>;

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
  spark: { name: "Spark", minLevel: 1, powerBonus: 4, cooldown: 2, element: "air" as const },
  iceShard: { name: "Ice Shard", minLevel: 3, powerBonus: 8, cooldown: 3, element: "water" as const },
  thunderLance: { name: "Thunder Lance", minLevel: 5, powerBonus: 12, cooldown: 4, element: "air" as const },
  meteorBreak: { name: "Meteor Break", minLevel: 8, powerBonus: 18, cooldown: 5, element: "earth" as const }
} as const satisfies Record<SkillKey, { name: string; minLevel: number; powerBonus: number; cooldown: number; element: ElementKind }>;

export const SKILL_ORDER: SkillKey[] = ["spark", "iceShard", "thunderLance", "meteorBreak"];

export function getUnlockedSkills(level: number): SkillKey[] {
  return SKILL_ORDER.filter((skill) => level >= SKILL_DATA[skill].minLevel);
}

/** Resolve element for saves / legacy encounters that omit {@link EnemyDefinition.element}. */
export function defaultElementForEnemyId(id: string): ElementKind {
  const row = ENEMIES.find((e) => e.id === id);
  if (row) return row.element;
  if (id === BOSS_ENEMY.id) return BOSS_ENEMY.element;
  return "earth";
}

/** Visual style hint used by the 2D / 3D renderers to draw a collectable. */
export type ResourceShape = "flower" | "mushroom" | "herb" | "crystalBloom";

export interface ResourceDefinition {
  key: ResourceKey;
  name: string;
  shape: ResourceShape;
  /** Base sell price at the town market (per unit). */
  sellPrice: number;
  description: string;
  /** Biomes where this species naturally grows. Empty = any biome. */
  biomes: BiomeKind[];
  /** Primary tint (petal / cap / leaf). */
  colorPrimary: string;
  /** Secondary tint (stem / spots / gill). */
  colorAccent: string;
  /** Lowest realm tier where this node can appear. */
  minRealmTier?: number;
  /** Highest realm tier where this node appears. */
  maxRealmTier?: number;
  /** Relative spawn weight within eligible pool (defaults to 1). */
  spawnWeight?: number;
}

export const RESOURCES: Record<ResourceKey, ResourceDefinition> = {
  meadowBlossom: {
    key: "meadowBlossom",
    name: "Meadow Blossom",
    shape: "flower",
    sellPrice: 4,
    description: "Common pink bloom dotting open meadows. Sold cheap but found everywhere.",
    biomes: ["meadow"],
    colorPrimary: "#f06ea7",
    colorAccent: "#f9d34a",
    maxRealmTier: 1,
    spawnWeight: 2.2
  },
  forestFern: {
    key: "forestFern",
    name: "Fiddlehead Fern",
    shape: "herb",
    sellPrice: 6,
    description: "Tender fern curls prized by apothecaries for poultices.",
    biomes: ["forest", "meadow"],
    colorPrimary: "#3d8a4a",
    colorAccent: "#173b1f",
    maxRealmTier: 1,
    spawnWeight: 1.6
  },
  sunOrchid: {
    key: "sunOrchid",
    name: "Sun Orchid",
    shape: "flower",
    sellPrice: 11,
    description: "Sun-warmed petals exude a faint honey aroma. Favored by perfumers.",
    biomes: ["desert", "meadow"],
    colorPrimary: "#ffb347",
    colorAccent: "#b24d00",
    maxRealmTier: 1,
    spawnWeight: 1.1
  },
  glowCap: {
    key: "glowCap",
    name: "Glow Cap",
    shape: "mushroom",
    sellPrice: 9,
    description: "Luminous swamp toadstool. Alchemists pay well for its phosphorescent spores.",
    biomes: ["swamp", "forest"],
    colorPrimary: "#6ee3c4",
    colorAccent: "#244a3a",
    maxRealmTier: 1,
    spawnWeight: 1.3
  },
  mirrorLily: {
    key: "mirrorLily",
    name: "Mirror Lily",
    shape: "flower",
    sellPrice: 16,
    description: "Silver-petaled bog flower that never wilts once picked.",
    biomes: ["swamp"],
    colorPrimary: "#d6e8ff",
    colorAccent: "#3d5a7a",
    maxRealmTier: 1,
    spawnWeight: 0.8
  },
  emberMoss: {
    key: "emberMoss",
    name: "Ember Moss",
    shape: "herb",
    sellPrice: 13,
    description: "Smouldering desert moss; forges use it as a natural bellows accelerant.",
    biomes: ["desert"],
    colorPrimary: "#d94a2b",
    colorAccent: "#4a1508",
    maxRealmTier: 1,
    spawnWeight: 0.9
  },
  frostPetal: {
    key: "frostPetal",
    name: "Frost Petal",
    shape: "flower",
    sellPrice: 15,
    description: "Crystallized bloom that only opens on tundra ice. Cold to the touch.",
    biomes: ["tundra"],
    colorPrimary: "#b9e7ff",
    colorAccent: "#2a5a82",
    maxRealmTier: 1,
    spawnWeight: 0.9
  },
  starAnise: {
    key: "starAnise",
    name: "Starlight Anise",
    shape: "flower",
    sellPrice: 24,
    description: "Eight-pointed bloom glowing faintly in rift lands. Reserved for court apothecaries.",
    biomes: ["meadow", "forest", "tundra"],
    colorPrimary: "#c7aaff",
    colorAccent: "#3a1e6a",
    minRealmTier: 2,
    spawnWeight: 1.4
  },
  voidTruffle: {
    key: "voidTruffle",
    name: "Void Truffle",
    shape: "mushroom",
    sellPrice: 32,
    description: "Obsidian-hued fungus from beyond the rift. Singular in flavor and in price.",
    biomes: ["swamp", "desert", "forest", "tundra"],
    colorPrimary: "#2c1240",
    colorAccent: "#9a6bff",
    minRealmTier: 2,
    spawnWeight: 1.1
  }
};

export const RESOURCE_KEYS: readonly ResourceKey[] = [
  "meadowBlossom",
  "forestFern",
  "sunOrchid",
  "glowCap",
  "mirrorLily",
  "emberMoss",
  "frostPetal",
  "starAnise",
  "voidTruffle"
];

/** Baseline empty resource bag — used for fresh players and migration backfill. */
export function emptyResourceBag(): Record<ResourceKey, number> {
  return {
    meadowBlossom: 0,
    forestFern: 0,
    sunOrchid: 0,
    glowCap: 0,
    mirrorLily: 0,
    emberMoss: 0,
    frostPetal: 0,
    starAnise: 0,
    voidTruffle: 0
  };
}

export function resourceAppearsInRealm(def: ResourceDefinition, realmTier: number): boolean {
  const min = def.minRealmTier ?? 1;
  const max = def.maxRealmTier ?? Infinity;
  return realmTier >= min && realmTier <= max;
}

/** Eligible resource species for a realm (and optionally a specific biome). */
export function resourcesForRealm(realmTier: number, biome?: BiomeKind): ResourceDefinition[] {
  const rt = Math.max(1, Math.floor(realmTier));
  const all = (Object.values(RESOURCES) as ResourceDefinition[]).filter((r) =>
    resourceAppearsInRealm(r, rt)
  );
  if (!biome) return all;
  return all.filter((r) => r.biomes.length === 0 || r.biomes.includes(biome));
}

export function pickEncounterEnemy(playerLevel: number, realmTier: number = 1): EnemyDefinition {
  const pool = enemiesForRealm(realmTier, undefined, { randomEncounterOnly: true });
  const candidates = pool.filter((enemy) => playerLevel >= enemy.minLevel);
  if (candidates.length === 0) {
    if (pool.length > 0) {
      return [...pool].sort((a, b) => a.minLevel - b.minLevel || a.id.localeCompare(b.id))[0]!;
    }
    return ENEMIES[0]!;
  }
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
