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

/** Stables mounts — each adds +1 speed in battle (max five owned). */
export type HorseKey = "dustPony" | "moorCob" | "riverPalfrey" | "sunCourser" | "stormcharger";

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
  /** Gatherable overworld resources awaiting sale at a market. */
  resources: Record<ResourceKey, number>;
  map: string;
  x: number;
  y: number;
  monstersDefeated: number;
  bountyTier: number;
  /** True once the Void Titan in the *current* realm has been defeated (cleared when crossing a rift). */
  bossDefeated: boolean;
  /** Total Void Titans defeated across all realms (UGC Studio unlocks after two). */
  voidTitansDefeated: number;
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
  /** Owned mounts from the stables; each grants +1 battle speed, capped at five total. */
  horsesOwned: HorseKey[];
  /**
   * Stables pet drill in progress: companion levels up when `readyAt` (epoch ms) is reached.
   * Only one at a time; advanced by the overworld clock tick while not in battle.
   */
  petStableTraining: { petId: string; readyAt: number } | null;
  /**
   * Guild lock: each point requires one won wild battle to clear (chapel blessing
   * can reduce by 1). While positive, shops, inn, pets, training, and guild payouts are locked.
   * Legacy saves may still carry debt from the old revival tithe; new knockouts strip gold/gear instead.
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

/** Combat affinity for damage modifiers (weapon/skills vs foe). Cycle: fire→air→earth→water→fire. */
export type ElementKind = "fire" | "water" | "earth" | "air";

export interface EnemyDefinition {
  id: string;
  name: string;
  /** Used for type effectiveness when the player attacks this foe. */
  element: ElementKind;
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
   * Lowest realm tier where this enemy can appear (`realmTier` from world state).
   * Omit for 1 — same as original Aetheria.
   */
  minRealmTier?: number;
  /**
   * Highest realm tier where this enemy appears. Omit for no cap.
   * World-1 roster uses `maxRealmTier: 1` so portal realms get their own pools.
   */
  maxRealmTier?: number;
  /**
   * Biomes this enemy can spawn in. Omit (or empty) to allow every biome.
   * Used to gate encounter pools regionally.
   */
  biomes?: BiomeKind[];
  /** Explicit body-shape override (for palette variants reusing an existing model). */
  bodyShape?: MonsterBodyShape;
  /** Optional color overrides applied to the 3D model. */
  customColors?: { primary?: string; accent?: string };
  /**
   * When true, this species appears only as a visible overworld roamer (not in random encounter rolls).
   */
  visibleRoamer?: boolean;
}

/** A visible monster placed on the procedural map until the player engages it. */
export interface RoamingMonster {
  id: string;
  enemyId: string;
  tx: number;
  ty: number;
}

/** Gatherable overworld flora — sold to the town market for gold. */
export type ResourceKey =
  | "meadowBlossom"
  | "forestFern"
  | "sunOrchid"
  | "glowCap"
  | "mirrorLily"
  | "emberMoss"
  | "frostPetal"
  | "starAnise"
  | "voidTruffle";

/** A harvestable plant/mushroom placed on the procedural map until picked. */
export interface ResourceNode {
  id: string;
  resourceKey: ResourceKey;
  tx: number;
  ty: number;
}

/**
 * Dungeon tile codes. Dungeons are small self-contained maps overlaid on the
 * same TILE grid as the overworld (indices 0..dungeonW-1 × 0..dungeonH-1).
 */
export const DUNGEON_TILE_WALL = 0;
export const DUNGEON_TILE_FLOOR = 1;
/** Stepping onto this tile lets the player leave and return to the overworld. */
export const DUNGEON_TILE_EXIT = 2;
/** Decorative pillar — blocks movement, rendered differently from a wall. */
export const DUNGEON_TILE_PILLAR = 3;

/** Type-level set of dungeon tile codes for discriminated handling. */
export type DungeonTileCode =
  | typeof DUNGEON_TILE_WALL
  | typeof DUNGEON_TILE_FLOOR
  | typeof DUNGEON_TILE_EXIT
  | typeof DUNGEON_TILE_PILLAR;

/** A treasure chest inside a dungeon. */
export interface DungeonChest {
  id: string;
  tx: number;
  ty: number;
  opened: boolean;
  /** Preselected loot so re-opening the chest isn't re-randomized. */
  lootItem: ItemKey;
  /** Gold contained in the chest. */
  lootGold: number;
}

/** A visible monster placed inside the dungeon until the player engages it. */
export interface DungeonRoamer {
  id: string;
  enemyId: string;
  tx: number;
  ty: number;
}

/** Live state of the currently-loaded dungeon (null when the player isn't inside). */
export interface DungeonState {
  seed: number;
  width: number;
  height: number;
  /** row-major width*height tile codes (see DUNGEON_TILE_* consts) */
  tiles: number[];
  /** Tile the player materializes on when entering. Also a valid exit tile. */
  entryTx: number;
  entryTy: number;
  chests: DungeonChest[];
  roamers: DungeonRoamer[];
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

export type BattlePhase =
  | "idle"
  | "playerTurn"
  | "enemyTurn"
  | "won"
  /** Rewards applied; battle UI lingers so the player can read the log before returning to the field. */
  | "victoryPending"
  | "lost"
  | "escaped"
  /** Player HP reached 0; revival runs after `gameStore.acknowledgeKnockout()`. */
  | "knockoutPending";

/** Player combat approach — changes outgoing/incoming damage and (for Fortune) win rewards. */
export type BattleStanceKind = "balanced" | "stealth" | "power" | "fortune";

export interface BattleState {
  inBattle: boolean;
  phase: BattlePhase;
  log: string[];
  enemy: EnemyState | null;
  /** Active fighting style until you change it or the battle ends. */
  stance: BattleStanceKind;
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
  /**
   * After using Dodge, the next enemy attack rolls evasion (speed + stance) before damage.
   * Cleared when that swing resolves.
   */
  dodgeReady?: boolean;
  /**
   * Fraction (0–0.55) shaved from the next incoming foe hit after using Brace.
   * Cleared when that hit lands.
   */
  nextHitMitigation?: number;
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
  /** Standing on the wilderness restore spring (full HP, no cost). */
  canRestoreSpring: boolean;
  /** Standing on the return rift near the spawn point in a portal realm (realm 2+). */
  canReturnPortal: boolean;
  /**
   * When true, the boss landmark on this save's world seed is rendered as {@link BuildingKind} `voidPortal`.
   * Cleared when crossing into a new realm.
   */
  voidPortalActive: boolean;
  /** Realm index: 1 = original world, 2+ = post-portal worlds. */
  realmTier: number;
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
  /** Visible wilderness foes (not used for random encounter rolls). */
  roamingMonsters: RoamingMonster[];
  /** Harvestable flora on the overworld — sold at town markets. */
  resourceNodes: ResourceNode[];
  /** Standing on the dungeon entrance building (realm 2+ only). */
  canDungeon: boolean;
  /** Standing on the entry/exit tile inside an active dungeon. */
  canLeaveDungeon: boolean;
  /** True when the player is inside a dungeon — overworld rendering is suspended. */
  inDungeon: boolean;
  /** Active dungeon map + contents (null when outside a dungeon). */
  dungeon: DungeonState | null;
  /** Cached overworld pixel position, restored when the player leaves the dungeon. */
  overworldReturnX: number;
  overworldReturnY: number;
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
  /** Combat element; omitted on older saves — inferred from body shape when hydrating. */
  element?: ElementKind;
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
