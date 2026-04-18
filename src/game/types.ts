export type ItemKey =
  | "potion"
  | "hiPotion"
  | "megaPotion"
  | "sipsGinseng"
  | "berryTonic"
  | "dewdropVial"
  | "honeySalve"
  | "mossDraught"
  | "riverWater"
  | "herbalPaste"
  | "minersAle"
  | "wyrmTea"
  | "spiritBandage"
  | "elixirLight"
  | "sunOrchidMix"
  | "frostleafBrew"
  | "shadowTincture"
  | "amberSerum"
  | "cometDrop"
  | "celestialNectar"
  | "dragonBloodSap"
  | "empressBalm"
  | "worldTreeDew";
export type WeaponKey = "woodSword" | "ironSword" | "steelSword" | "mythrilBlade";
export type ArmorKey = "clothArmor" | "chainMail" | "knightArmor" | "dragonArmor";
export type SkillKey = "spark" | "iceShard" | "thunderLance" | "meteorBreak";

export type HairStyle =
  | "short"
  | "spiky"
  | "long"
  | "bald"
  | "buzz"
  | "ponytail"
  | "curly"
  | "sidePart"
  | "braids"
  | "mohawk";

/** UI / migration order for hair options. */
export const HAIR_STYLE_ORDER: readonly HairStyle[] = [
  "short",
  "spiky",
  "long",
  "bald",
  "buzz",
  "ponytail",
  "curly",
  "sidePart",
  "braids",
  "mohawk"
];

export const HAIR_STYLE_LABELS: Record<HairStyle, string> = {
  short: "Short",
  spiky: "Spiky",
  long: "Long",
  bald: "Bald",
  buzz: "Buzz",
  ponytail: "Ponytail",
  curly: "Curly",
  sidePart: "Side part",
  braids: "Braids",
  mohawk: "Mohawk"
};

export function normalizeHairStyle(value: unknown): HairStyle {
  return HAIR_STYLE_ORDER.includes(value as HairStyle) ? (value as HairStyle) : "short";
}

export type FacialHairStyle = "none" | "stubble" | "goatee" | "shortBeard" | "fullBeard";

export const FACIAL_HAIR_ORDER: readonly FacialHairStyle[] = [
  "none",
  "stubble",
  "goatee",
  "shortBeard",
  "fullBeard"
];

export const FACIAL_HAIR_LABELS: Record<FacialHairStyle, string> = {
  none: "Clean shaven",
  stubble: "Stubble",
  goatee: "Goatee",
  shortBeard: "Short beard",
  fullBeard: "Full beard"
};

export function normalizeFacialHair(value: unknown): FacialHairStyle {
  return FACIAL_HAIR_ORDER.includes(value as FacialHairStyle) ? (value as FacialHairStyle) : "none";
}

export interface PlayerAppearance {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  /** Chin / cheek facial hair; `none` hides beard meshes. */
  facialHair: FacialHairStyle;
  /** Beard / stubble tint (often matches hair). */
  beardColor: string;
  outfit: string;
  pants: string;
}

export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  weapon: WeaponKey;
  armor: ArmorKey;
  items: Record<ItemKey, number>;
  /** Quick-use slots for keys 1–9 then 0; null = empty. Always length 10 when normalized. */
  itemHotbar: (ItemKey | null)[];
  map: string;
  x: number;
  y: number;
  monstersDefeated: number;
  bountyTier: number;
  bossDefeated: boolean;
  appearance: PlayerAppearance;
  /** True once the player has gone through the character creation screen. */
  hasCreatedCharacter: boolean;
  /** True once the player has purchased the Town Map at a shop. One-time buy. */
  hasTownMap: boolean;
  /** When true (and {@link hasTownMap}), the overworld compass overlay is active. */
  townMapEquipped: boolean;
  /** Tamed pet companions the player has collected. */
  pets: Pet[];
  /** The currently active pet (follows in overworld, assists in battle). Null = no pet out. */
  activePetId: string | null;
  /**
   * After a knockout, each gold short of the 10g revival tithe requires one wild
   * kill to clear. While positive, shops, inn, pets, training, and guild payouts are locked.
   */
  revivalDebtMonstersRemaining: number;
}

/** A tamed companion. Inherits body shape + colors from the monster species it was tamed from. */
export interface Pet {
  id: string;
  name: string;
  speciesId: string;
  speciesName: string;
  bodyShape: MonsterBodyShape;
  colorPrimary: string;
  colorAccent: string;
  level: number;
  /** Flat damage the pet adds to the player's basic attacks. */
  attackBonus: number;
  tamedAt: number;
}

/** Distinct overworld regions with their own flora, palette, and monster pools. */
export type BiomeKind = "meadow" | "forest" | "desert" | "swamp" | "tundra";

export interface EnemyDefinition {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  xpReward: number;
  goldReward: number;
  minLevel: number;
  baseWeight: number;
  weightGrowthPerLevel: number;
  maxWeight: number;
  /**
   * Biomes this enemy can spawn in. Omit (or empty) to allow every biome.
   * Used to gate encounter pools regionally.
   */
  biomes?: BiomeKind[];
  /** Explicit body-shape override (for palette variants reusing an existing model). */
  bodyShape?: MonsterBodyShape;
  /** Optional color overrides applied to the 3D model. */
  customColors?: { primary?: string; accent?: string };
}

/** Body shapes available to both built-in and UGC monsters. */
export type MonsterBodyShape =
  | "slime"
  | "bat"
  | "goblin"
  | "wolf"
  | "wraith"
  | "drake"
  | "spider"
  | "scorpion";

export interface EnemyState extends EnemyDefinition {
  hp: number;
}

export type BattlePhase = "idle" | "playerTurn" | "enemyTurn" | "won" | "lost" | "escaped";

export interface BattleState {
  inBattle: boolean;
  phase: BattlePhase;
  log: string[];
  enemy: EnemyState | null;
  /**
   * Shared skill lockout: after casting any skill, all skills are unusable until
   * this hits 0 (ticks down by 1 after each enemy turn). Casting sets it from
   * that skill's per-skill cooldown value in game data.
   */
  skillCooldown: number;
  /** Flat attack from consumables used this fight; cleared when the battle ends. */
  itemAttackBonus: number;
  /** Flat defense from consumables used this fight; cleared when the battle ends. */
  itemDefenseBonus: number;
}

export interface WorldState {
  inTown: boolean;
  canHeal: boolean;
  canShop: boolean;
  /** Companion Emporium — adopt pets that add up to +10 attack while active. */
  canPetShop: boolean;
  canTrain: boolean;
  canGuild: boolean;
  canBoss: boolean;
  canLibrary: boolean;
  canForge: boolean;
  canChapel: boolean;
  canStables: boolean;
  canMarket: boolean;
  /** Standing on the post-boss dimensional rift (same tile as the former arena). */
  canVoidPortal: boolean;
  /**
   * When true, the boss landmark on this save's world seed is rendered as {@link BuildingKind} `voidPortal`.
   * Cleared when crossing into a new realm.
   */
  voidPortalActive: boolean;
  encounterRate: number;
  /** Random encounter rolls are skipped until this hits 0 (ticks down on each wilderness tile step). */
  encounterGraceSteps: number;
  /** Seed used to procedurally generate the active overworld. */
  worldSeed: number;
  /** Bumped every time the world is regenerated — used as a React render dependency. */
  worldVersion: number;
  /**
   * Day / night phase (any number; use fractional part as 0–1 cycle).
   * Advances in real time while exploring; pauses in battle.
   */
  worldTime: number;
}

/** Shared fields for all marketplace-listed UGC creations. */
export interface UgcListing {
  listed: boolean;
  price: number;
  sales: number;
  /** Total gross gold the listing has generated (creator + tax). */
  grossEarned: number;
}

export interface UgcMonster extends UgcListing {
  id: string;
  name: string;
  bodyShape: MonsterBodyShape;
  colorPrimary: string;
  colorAccent: string;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  xpReward: number;
  goldReward: number;
  minLevel: number;
  createdAt: number;
}

export interface UgcWeapon extends UgcListing {
  id: string;
  name: string;
  attackBonus: number;
  color: string;
  createdAt: number;
}

export interface UgcArmor extends UgcListing {
  id: string;
  name: string;
  defenseBonus: number;
  color: string;
  createdAt: number;
}

/** Full UGC studio + marketplace state. */
export interface UgcState {
  monsters: UgcMonster[];
  weapons: UgcWeapon[];
  armor: UgcArmor[];
  /** Lifetime gross gold generated by all listings. */
  totalGross: number;
  /** Lifetime 75% creator share paid into the player's wallet. */
  totalNet: number;
  /** Lifetime 25% platform tax withheld. */
  totalTax: number;
  totalSales: number;
}

/** Named chapter / stage the player is currently on. */
export type StoryStage =
  | "prologue"
  | "ch1_firstHunts"
  | "ch2_gearUp"
  | "ch3_wanderer"
  | "ch4_whispers"
  | "ch5_trials"
  | "ch6_titanAwaits"
  | "epilogue";

/** A record of a completed chapter, used by the in-game Journal. */
export interface StoryChapterRecord {
  stage: StoryStage;
  title: string;
  completedAt: number;
}

export interface StoryState {
  /** The chapter currently in progress (or "prologue"/"epilogue" for intro/outro). */
  stage: StoryStage;
  /** True once the player has dismissed the opening prologue modal. */
  prologueSeen: boolean;
  /** True once the player has dismissed the closing epilogue modal. */
  epilogueSeen: boolean;
  /** Total monsters the player has slain (battle victories). */
  monstersSlain: number;
  /** Unique biomes the player has stepped foot in. */
  biomesVisited: BiomeKind[];
  /** Unique enemy IDs the player has defeated at least once. */
  uniqueSpeciesDefeated: string[];
  /** True once the player has bought any weapon stronger than the starting wooden sword. */
  boughtBetterGear: boolean;
  /** True once the player has stood on the boss arena tile. */
  reachedBossArena: boolean;
  /** Chapters that have been completed, in order. */
  completed: StoryChapterRecord[];
  /**
   * Slot for a chapter transition UI to pick up — becomes the stage that was
   * just completed. The UI consumes it (via a store action) once it has
   * shown the banner, which resets this back to null.
   */
  pendingChapterToast: StoryStage | null;
}

export interface GameSnapshot {
  player: PlayerState;
  battle: BattleState;
  world: WorldState;
  eventLog: string[];
  ugc: UgcState;
  story: StoryState;
  /**
   * When false, persisted slot matches this snapshot (excluding the optional
   * trailing "Game saved." line that is written on the next save).
   */
  hasUnsavedChanges: boolean;
}
