import {
  ARMOR_STATS,
  armorSellDowngrade,
  bossEnemyForRealm,
  isRealmBossEnemyId,
  ENEMIES,
  enemiesForRealm,
  ITEM_DATA,
  ITEM_PRIORITY,
  SHOP_ITEMS,
  UGC_STUDIO_VOID_TITANS_REQUIRED,
  SKILL_DATA,
  SKILL_ORDER,
  TOWN_MAP,
  WEAPON_STATS,
  GEAR_SELLBACK_FRACTION,
  gearSellRefundGold,
  weaponSellDowngrade,
  PET_ATTACK_BUFF_CAP,
  PET_SHOP_OFFERS,
  PET_STABLE_MAX_LEVEL,
  battleGoldClassMultiplier,
  canLearnSkillNow,
  orderedLearnedSkills,
  skillPointsPerLevel,
  skillPowerClassMultiplier,
  SKILL_TREE,
  totalPointCostOnTree,
  getUnlockedSkills,
  pickEncounterEnemy,
  petAttackBuffForParty,
  rollMonsterConsumableDrop,
  stablePetTrainDurationMs,
  stablePetTrainFee,
  scaleEncounterForPlayerLevel,
  defaultElementForEnemyId,
  STABLE_HORSES,
  STABLE_HORSE_ORDER,
  stableHorseSpeedBonus,
  BATTLE_STANCE_ORDER,
  battleStanceModifiers,
  RESOURCES,
  RESOURCE_KEYS,
  emptyResourceBag
} from "./data";
import { elementBattleLogSuffix, elementDamageMultiplier, normalizeElementKind } from "./elements";
import { LocalSaveRepository, type SaveRepository } from "./save";
import {
  normalizeFacialHair,
  normalizeHairStyle,
  type ArmorKey,
  type BattleVictorySummary,
  type BattleStanceKind,
  type BattleState,
  type HorseKey,
  type BiomeKind,
  DUNGEON_TILE_EXIT,
  DUNGEON_TILE_STAIRS_DOWN,
  DUNGEON_TILE_STAIRS_UP,
  type ElementKind,
  type EnemyDefinition,
  type EnemyState,
  type FightingClass,
  type GameSnapshot,
  type LevelUpCelebrationPayload,
  type ItemKey,
  type MonsterBodyShape,
  type Pet,
  type PlayerAppearance,
  type PlayerState,
  type ResourceKey,
  type SkillKey,
  FIGHTING_CLASS_LABELS,
  normalizeFightingClass,
  type StoryStage,
  type StoryState,
  type UgcArmor,
  type UgcMonster,
  type UgcState,
  type UgcWeapon,
  type WeaponKey,
  type WorldState
} from "./types";
import {
  STORY_CHAPTERS,
  STORY_CH1_MONSTERS_TO_SLAY,
  STORY_CH4_LEVEL_REQUIRED,
  initialStory,
  isStageComplete
} from "./story";
import {
  UGC_MARKET_TICK_MS,
  UGC_TAX_RATE,
  initialUgc,
  makeListingCode,
  newArmor as newUgcArmor,
  newMonster as newUgcMonster,
  newWeapon as newUgcWeapon,
  pickEncounterFromPool,
  saleChanceForPrice,
  ugcMonsterToEnemyDef
} from "./ugc";
import { currentDungeonFloor, findFirstTileOfKind, generateCastleThroneHall, generateDungeon } from "./dungeon";
import { isNightWilds, nightEnemyStatMultiplier } from "./worldClock";
import {
  biomeAt,
  buildResourceNodes,
  buildRoamingMonsters,
  getTowns,
  TILE,
  clampEncounterStepChance,
  getSpawnPixel,
  isTownTile,
  nearestTown,
  regenerateWorld,
  swapBossTileForVoidPortal,
  syncZonesAtTile,
  terrainAt,
  townAtTile,
  worldRealmTier as activeWorldRealmTier,
  worldSeed as activeWorldSeed,
  worldVersion as activeWorldVersion
} from "./worldMap";
import { playSfx, playMusic } from "./audio";
import {
  innPatronRotationBucket,
  innPatronsForTown,
  playerAttackForIntimidate,
  playerCunningForNpc,
  type InnPatronAction
} from "./townNpcs";
import { randomSeed } from "./worldGen";
import {
  HOTBAR_SIZE,
  defaultItemHotbar,
  mergeItemInventory,
  normalizeItemHotbar
} from "./inventoryHotbar";
import { copyToClipboard, decodeTransferBundle, encodeTransferBundle, generateTransferKey } from "./transferSave";

/** Map built-in enemy ids to a shared body shape for UI / pet rendering. */
const BUILTIN_SHAPE_BY_ID: Record<string, MonsterBodyShape> = {
  slime: "slime",
  bat: "bat",
  goblin: "goblin",
  mangoMan: "mangoMan",
  wolf: "wolf",
  wraith: "wraith",
  drake: "drake",
  forestSpider: "spider",
  caveBat: "bat",
  sandScorpion: "scorpion",
  sandDrake: "drake",
  bogSlime: "slime",
  bogHag: "goblin",
  frostWolf: "wolf",
  iceWraith: "wraith"
};

/** Fallback color palette per body shape for pet rendering if the enemy lacks overrides. */
const DEFAULT_PET_COLORS: Record<MonsterBodyShape, { primary: string; accent: string }> = {
  slime: { primary: "#52bcd0", accent: "#0d2b34" },
  bat: { primary: "#554a68", accent: "#3f3651" },
  goblin: { primary: "#6aa15a", accent: "#2a3a1e" },
  wolf: { primary: "#7a6c5a", accent: "#2a1e14" },
  wraith: { primary: "#6e5aa1", accent: "#1b1030" },
  drake: { primary: "#9a4e3a", accent: "#2a1008" },
  spider: { primary: "#3a2a1e", accent: "#9a2e2a" },
  scorpion: { primary: "#d6a64c", accent: "#6f3a1a" },
  mangoMan: { primary: "#f4a020", accent: "#1e6b32" }
};

export const defaultAppearance = (): PlayerAppearance => ({
  skin: "#f1c9a5",
  hair: "#6b4b2a",
  hairStyle: "short",
  facialHair: "none",
  beardColor: "#6b4b2a",
  outfit: "#3564c3",
  pants: "#2a3550"
});

/** When the player's name matches exactly, a debug stat console is shown in the UI. */
export const DEV_CHEAT_PLAYER_NAME = "deviledeggs";

const initialPlayer = (): PlayerState => {
  const spawn = getSpawnPixel();
  return {
    name: "Hero",
    fightingClass: "knight",
    skillPoints: 0,
    learnedSkills: ["spark"],
    level: 1,
    xp: 0,
    xpToNext: 20,
    gold: 30,
    maxHp: 40,
    hp: 40,
    attack: 8,
    defense: 3,
    speed: 5,
    weapon: "woodSword",
    armor: "clothArmor",
    items: mergeItemInventory({ potion: 2 }),
    itemHotbar: defaultItemHotbar(),
    resources: emptyResourceBag(),
    map: "field",
    x: spawn.x,
    y: spawn.y,
    monstersDefeated: 0,
    kingFavorsClaimed: 0,
    kingAudienceTally: 0,
    kingAudienceTallyLastClaim: 0,
    bountyTier: 1,
    bossDefeated: false,
    voidTitansDefeated: 0,
    appearance: defaultAppearance(),
    hasCreatedCharacter: false,
    hasTownMap: false,
    townMapEquipped: false,
    pets: [],
    activePetId: null,
    horsesOwned: [],
    petStableTraining: null,
    revivalDebtMonstersRemaining: 0,
    npcMercenaryBattlesLeft: 0,
    npcPatronRotationBucket: -1,
    npcPatronsUsed: []
  };
};

const nowMs = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const initialBattle = (): BattleState => ({
  inBattle: false,
  phase: "idle",
  log: ["Explore the field and watch for encounters."],
  enemy: null,
  skillCooldown: 0,
  itemAttackBonus: 0,
  itemDefenseBonus: 0,
  stance: "balanced",
  victorySummary: null,
  stunTurns: 0,
  guardEnergy: 0
});

/** Tile moves on grass/road after a battle before random encounters can roll again. */
export const POST_ENCOUNTER_GRACE_STEPS = 10;

/** After a win, keep the battle overlay up this long so defeat + reward lines stay visible. */
const VICTORY_BATTLE_LINGER_MS = 3200;

const initialWorld = (): WorldState => ({
  inTown: false,
  canHeal: false,
  canShop: false,
  canPetShop: false,
  canTrain: false,
  canGuild: false,
  canBoss: false,
  canLibrary: false,
  canForge: false,
  canChapel: false,
  canStables: false,
  canMarket: false,
  canVoidPortal: false,
  canRestoreSpring: false,
  canReturnPortal: false,
  canDungeon: false,
  canEnterThroneHall: false,
  canThrone: false,
  canLeaveDungeon: false,
  canDescendStairs: false,
  canAscendStairs: false,
  inDungeon: false,
  dungeon: null,
  overworldReturnX: 0,
  overworldReturnY: 0,
  voidPortalActive: false,
  realmTier: 1,
  encounterRate: 0,
  encounterGraceSteps: 0,
  worldSeed: activeWorldSeed,
  worldVersion: activeWorldVersion,
  worldTime: 0.28,
  roamingMonsters: [],
  resourceNodes: []
});

class GameStore {
  private events = new EventTarget();
  private saveRepository: SaveRepository = new LocalSaveRepository();
  private marketInterval: ReturnType<typeof setInterval> | null = null;
  private victoryExitTimer: ReturnType<typeof setTimeout> | null = null;
  /** Coalesces high-frequency pixel moves into fewer React syncs (see {@link setPosition}). */
  private positionEmitTimer: number | null = null;
  private state: GameSnapshot = {
    player: initialPlayer(),
    battle: initialBattle(),
    world: initialWorld(),
    eventLog: [
      "You begin at Crownkeep — the King's castle. Hunt monsters in his name, then walk to the Royal Hall at the top of the courtyard and step through its doors to petition the throne. Shops and inn ring the courtyard; a relic restore spring waits somewhere in the wilds."
    ],
    ugc: initialUgc(),
    story: initialStory(),
    hasUnsavedChanges: true,
    pendingLevelUpCelebration: null,
    sleeping: false
  };

  /** Bumps once per {@link emit}; aligned with {@link lastPersistedVersion} after save/load. */
  private contentVersion = 0;
  private lastPersistedVersion = -1;

  constructor() {
    this.startMarketTicker();
    this.refreshRoamingMonsters();
  }

  private refreshRoamingMonsters(): void {
    this.state.world.roamingMonsters = buildRoamingMonsters();
    this.refreshResourceNodes();
  }

  private refreshResourceNodes(): void {
    const roamerTiles = new Set(
      (this.state.world.roamingMonsters ?? []).map((r) => `${r.tx},${r.ty}`)
    );
    this.state.world.resourceNodes = buildResourceNodes(roamerTiles);
  }

  subscribe(listener: () => void): () => void {
    const wrapped = () => listener();
    this.events.addEventListener("change", wrapped);
    return () => this.events.removeEventListener("change", wrapped);
  }

  getSnapshot(): GameSnapshot {
    return this.state;
  }

  dismissLevelUpCelebration(): void {
    if (!this.state.pendingLevelUpCelebration) return;
    this.state.pendingLevelUpCelebration = null;
    this.emit();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Character creation / appearance
  // ────────────────────────────────────────────────────────────────────────────

  createCharacter(name: string, appearance: PlayerAppearance, fightingClass: FightingClass = "knight"): void {
    const cleanName = name.trim().slice(0, 18) || "Hero";
    const fc = normalizeFightingClass(fightingClass);
    this.state.player.name = cleanName;
    this.state.player.appearance = { ...appearance };
    this.state.player.fightingClass = fc;
    this.state.player.learnedSkills = ["spark"];
    this.state.player.skillPoints = 0;
    // Starter combat stats before class bonuses (same baseline as {@link initialPlayer}).
    this.state.player.attack = 8;
    this.state.player.defense = 3;
    this.state.player.speed = 5;
    if (fc === "knight") {
      this.state.player.attack += 2;
    } else if (fc === "thief") {
      this.state.player.speed += 2;
    }
    this.state.player.hasCreatedCharacter = true;
    this.logEvent(`${cleanName} steps out onto the road — ${FIGHTING_CLASS_LABELS[fc]}.`);
    this.emit();
  }

  /** Spend skill points on the arcane tree (not during battle). */
  learnSkill(skill: SkillKey): void {
    if (this.state.battle.inBattle) {
      this.logEvent("Open the Skills panel outside of combat to spend skill points.");
      this.emit();
      return;
    }
    const p = this.state.player;
    const learned = [...(p.learnedSkills ?? ["spark"])];
    const status = canLearnSkillNow(learned, skill, p.skillPoints ?? 0);
    if (status === "owned") {
      this.logEvent("You have already mastered that skill.");
      this.emit();
      return;
    }
    if (status === "locked") {
      this.logEvent("Learn the prior skill on the tree first.");
      this.emit();
      return;
    }
    if (status === "points") {
      this.logEvent(`Not enough skill points (need ${SKILL_TREE[skill].pointCost}).`);
      this.emit();
      return;
    }
    const cost = SKILL_TREE[skill].pointCost;
    p.skillPoints = (p.skillPoints ?? 0) - cost;
    p.learnedSkills = [...learned, skill];
    this.logEvent(`Learned ${SKILL_DATA[skill].name} (${cost} skill point${cost === 1 ? "" : "s"}).`);
    this.emit();
  }

  updateAppearance(patch: Partial<PlayerAppearance>): void {
    this.state.player.appearance = { ...this.state.player.appearance, ...patch };
    this.emit();
  }

  setPlayerName(name: string): void {
    this.state.player.name = name.slice(0, 18);
    this.emit();
  }

  private devCheatAllowed(): boolean {
    return this.state.player.name === DEV_CHEAT_PLAYER_NAME;
  }

  /** +N to attack, defense, or speed (no-op unless {@link DEV_CHEAT_PLAYER_NAME}). */
  devCheatAddCombatStat(stat: "attack" | "defense" | "speed", delta = 1): void {
    if (!this.devCheatAllowed()) return;
    this.state.player[stat] += delta;
    this.emit();
  }

  /** Increase max HP by `delta` and heal by the same amount (capped at max). */
  devCheatAddMaxHp(delta = 10): void {
    if (!this.devCheatAllowed()) return;
    const p = this.state.player;
    p.maxHp += delta;
    p.hp = Math.min(p.maxHp, p.hp + delta);
    this.emit();
  }

  devCheatAddGold(delta = 100): void {
    if (!this.devCheatAllowed()) return;
    this.state.player.gold += delta;
    this.emit();
  }

  devCheatFullHeal(): void {
    if (!this.devCheatAllowed()) return;
    this.state.player.hp = this.state.player.maxHp;
    this.emit();
  }

  /** Grant XP and run normal level-up resolution (skills, story hooks, celebration). */
  devCheatAddXp(amount: number): void {
    if (!this.devCheatAllowed() || amount <= 0) return;
    this.state.player.xp += amount;
    this.resolveLevelUps();
    this.emit();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Story progression
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Mark the opening prologue modal as seen and auto-advance into Chapter 1.
   * Called by the Journal UI after the player dismisses the prologue.
   */
  dismissPrologue(): void {
    const s = this.state.story;
    if (s.prologueSeen) return;
    s.prologueSeen = true;
    if (s.stage === "prologue") {
      this.completeCurrentChapter();
    }
    this.emit();
  }

  /** Mark the epilogue modal as seen; no further advancement. */
  dismissEpilogue(): void {
    if (!this.state.story.epilogueSeen) {
      this.state.story.epilogueSeen = true;
      this.emit();
    }
  }

  /** Consume the pending chapter-toast slot once the UI has displayed it. */
  consumeChapterToast(): void {
    if (this.state.story.pendingChapterToast != null) {
      this.state.story.pendingChapterToast = null;
      this.emit();
    }
  }

  /** Return the current chapter definition for UI display. */
  getCurrentChapter() {
    return STORY_CHAPTERS[this.state.story.stage];
  }

  /**
   * Mark the current chapter complete, pay out its reward, and advance to the
   * next stage. Called internally after {@link evaluateStoryProgress} detects
   * the objective has been met (or by `dismissPrologue` for the intro).
   */
  private completeCurrentChapter(): void {
    const s = this.state.story;
    const def = STORY_CHAPTERS[s.stage];

    s.completed.push({ stage: s.stage, title: def.title, completedAt: Date.now() });

    if (def.reward) {
      if (def.reward.gold) this.state.player.gold += def.reward.gold;
      if (def.reward.xp) this.state.player.xp += def.reward.xp;
      this.logEvent(def.reward.message);
    }

    if (def.next) {
      const completedStage = s.stage;
      s.stage = def.next;
      s.pendingChapterToast = completedStage;
      const nextDef = STORY_CHAPTERS[s.stage];
      this.logEvent(`New chapter begins — ${nextDef.title}.`);
      if (def.reward) {
        this.resolveLevelUps();
      }
      // A newly-unlocked chapter may already be complete (e.g. the player is
      // already past the next requirement). Chain advancement once.
      this.evaluateStoryProgress();
    }
  }

  /** Evaluate whether the current chapter's objective is satisfied and advance if so. */
  private evaluateStoryProgress(): void {
    const s = this.state.story;
    // Don't auto-advance prologue/epilogue — those are gated on the UI modal.
    if (s.stage === "prologue" || s.stage === "epilogue") return;
    // Pass the player level so Chapter 4 ("Whispers of the Titan") advances
    // the moment the objective is met — including the edge case where the
    // player was already past the level threshold when they reached ch4 via
    // chain-advancement from an earlier chapter's reward. Previously ch4
    // was only advanced inside `resolveLevelUps` at the exact moment of a
    // level-up, so a player who arrived at ch4 at level 8 would be stuck
    // until they hit level 9.
    if (isStageComplete(s.stage, s, this.state.player.level)) {
      this.completeCurrentChapter();
    }
  }

  /** Hook called by the encounter dispatcher whenever the player enters a new biome. */
  storyNoteBiomeVisited(biome: BiomeKind): void {
    const s = this.state.story;
    if (!s.biomesVisited.includes(biome)) {
      s.biomesVisited.push(biome);
      this.evaluateStoryProgress();
      this.emit();
    }
  }

  /** Hook called by the encounter dispatcher when the player stands on the boss arena. */
  storyNoteBossArenaReached(): void {
    const s = this.state.story;
    if (!s.reachedBossArena) {
      s.reachedBossArena = true;
      this.evaluateStoryProgress();
      this.emit();
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // World / positioning
  // ────────────────────────────────────────────────────────────────────────────

  setPosition(x: number, y: number): void {
    this.state.player.x = x;
    this.state.player.y = y;
    if (this.positionEmitTimer !== null) return;
    this.positionEmitTimer = window.setTimeout(() => {
      this.positionEmitTimer = null;
      this.emit();
    }, 50);
  }

  private clearPositionEmitDebounce(): void {
    if (this.positionEmitTimer !== null) {
      clearTimeout(this.positionEmitTimer);
      this.positionEmitTimer = null;
    }
  }

  updateWorldZones(
    inTown: boolean,
    canHeal: boolean,
    canShop: boolean,
    canPetShop: boolean,
    canTrain: boolean,
    canGuild: boolean,
    canBoss: boolean,
    canLibrary: boolean,
    canForge: boolean,
    canChapel: boolean,
    canStables: boolean,
    canMarket: boolean,
    canVoidPortal: boolean,
    canRestoreSpring: boolean,
    canReturnPortal: boolean,
    canDungeon: boolean,
    canEnterThroneHall: boolean,
    canThrone: boolean
  ): void {
    this.state.world.inTown = inTown;
    this.updateMusic();
    this.state.world.canHeal = canHeal;
    this.state.world.canShop = canShop;
    this.state.world.canPetShop = canPetShop;
    this.state.world.canTrain = canTrain;
    this.state.world.canGuild = canGuild;
    this.state.world.canBoss = canBoss;
    this.state.world.canLibrary = canLibrary;
    this.state.world.canForge = canForge;
    this.state.world.canChapel = canChapel;
    this.state.world.canStables = canStables;
    this.state.world.canMarket = canMarket;
    this.state.world.canVoidPortal = canVoidPortal;
    this.state.world.canRestoreSpring = canRestoreSpring;
    this.state.world.canReturnPortal = canReturnPortal;
    this.state.world.canDungeon = canDungeon;
    this.state.world.canEnterThroneHall = canEnterThroneHall;
    this.state.world.canThrone = canThrone;
    this.emit();
  }

  /** Cross into a freshly generated realm (boss arena tile becomes a rift after the titan falls). */
  enterRealmPortal(): void {
    if (this.state.battle.inBattle) {
      this.logEvent("Finish the battle before crossing the rift.");
      this.emit();
      return;
    }
    if (!this.state.world.canVoidPortal) {
      this.logEvent("Stand on the blue rift where the arena guardian fell.");
      this.emit();
      return;
    }
    this.state.world.voidPortalActive = false;
    this.state.player.bossDefeated = false;
    const nextRealmTier = Math.max(2, Math.floor((this.state.world.realmTier ?? 1) + 1));
    regenerateWorld(randomSeed(), nextRealmTier);
    const spawn = getSpawnPixel();
    this.state.player.x = spawn.x;
    this.state.player.y = spawn.y;
    this.state.world.worldSeed = activeWorldSeed;
    this.state.world.worldVersion = activeWorldVersion;
    this.state.world.realmTier = nextRealmTier;
    this.refreshRoamingMonsters();
    const tx = Math.floor(spawn.x / TILE);
    const ty = Math.floor(spawn.y / TILE);
    syncZonesAtTile(tx, ty);
    this.logEvent("You step through the rift — only this new land remains.");
    this.emit();
  }

  /**
   * Step through the stable return rift near the spawn of a portal realm to
   * drop back into a freshly generated tier-1 world. Preserves all player
   * progression (gear, pets, XP, resources, story) — only the overworld itself
   * is reshaped.
   */
  returnToRealmOne(): void {
    if (this.state.battle.inBattle) {
      this.logEvent("Finish the battle before stepping through the rift.");
      this.emit();
      return;
    }
    if (!this.state.world.canReturnPortal) {
      this.logEvent("Stand on the return rift near the spawn town to go back.");
      this.emit();
      return;
    }
    if ((this.state.world.realmTier ?? 1) <= 1) {
      this.logEvent("You are already in the first world.");
      this.emit();
      return;
    }
    // A fresh tier-1 world means the player has to re-face that realm's Void Titan
    // (different seed), so drop the flag unless they somehow kept it set.
    this.state.world.voidPortalActive = false;
    this.state.player.bossDefeated = false;
    regenerateWorld(randomSeed(), 1);
    const spawn = getSpawnPixel();
    this.state.player.x = spawn.x;
    this.state.player.y = spawn.y;
    this.state.world.worldSeed = activeWorldSeed;
    this.state.world.worldVersion = activeWorldVersion;
    this.state.world.realmTier = 1;
    this.state.world.canReturnPortal = false;
    this.refreshRoamingMonsters();
    const tx = Math.floor(spawn.x / TILE);
    const ty = Math.floor(spawn.y / TILE);
    syncZonesAtTile(tx, ty);
    this.logEvent("You step through the return rift — familiar skies greet you again.");
    this.emit();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Dungeon (realm 2+)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Descend into the dungeon on the tile the player is standing on. The overworld
   * layout stays in memory untouched — only the renderers skip drawing it while
   * `world.inDungeon` is true. The player's overworld position is saved so
   * {@link leaveDungeon} can drop them back exactly where they entered.
   */
  enterDungeon(): void {
    if (this.state.battle.inBattle) {
      this.logEvent("Finish the fight before descending.");
      this.emit();
      return;
    }
    if (this.state.world.inDungeon) {
      this.logEvent("You are already inside the dungeon.");
      this.emit();
      return;
    }
    if (!this.state.world.canDungeon) {
      this.logEvent("Stand at the dungeon entrance to descend.");
      this.emit();
      return;
    }
    if ((this.state.world.realmTier ?? 1) < 2) {
      this.logEvent("No dungeon stirs in this realm.");
      this.emit();
      return;
    }

    // Seed the layout off of the current world so each world has its own dungeon,
    // but also mix in a time component so re-entering after clearing gives a new run.
    const seed = ((this.state.world.worldSeed ?? 1) * 101 + Date.now()) >>> 0;
    const dungeon = generateDungeon(seed);

    this.state.world.overworldReturnX = this.state.player.x;
    this.state.world.overworldReturnY = this.state.player.y;
    this.state.world.dungeon = dungeon;
    this.state.world.inDungeon = true;
    this.updateMusic();
    this.state.world.canLeaveDungeon = true; // they materialize on the exit tile
    // Clear overworld flags so action overlays don't keep offering town shops etc.
    this.state.world.inTown = false;
    this.updateMusic();
    this.state.world.canHeal = false;
    this.state.world.canShop = false;
    this.state.world.canPetShop = false;
    this.state.world.canTrain = false;
    this.state.world.canGuild = false;
    this.state.world.canBoss = false;
    this.state.world.canLibrary = false;
    this.state.world.canForge = false;
    this.state.world.canChapel = false;
    this.state.world.canStables = false;
    this.state.world.canMarket = false;
    this.state.world.canVoidPortal = false;
    this.state.world.canReturnPortal = false;
    this.state.world.canDungeon = false;
    this.state.world.canEnterThroneHall = false;
    this.state.world.canThrone = false;

    const f0 = dungeon.floors[0]!;
    this.state.player.x = f0.entryTx * TILE + TILE / 2;
    this.state.player.y = f0.entryTy * TILE + TILE / 2;

    this.logEvent(
      dungeon.depth > 1
        ? `You descend the dungeon stairs — ${dungeon.depth} levels of cold stone await.`
        : "You descend the dungeon stairs. Cold stone swallows the light."
    );
    this.emit();
    {
      const tx = Math.floor(this.state.player.x / TILE);
      const ty = Math.floor(this.state.player.y / TILE);
      this.dispatchDungeonTile(tx, ty);
    }
  }

  /** Enter Crownkeep's Royal Hall toward the king (realm 1, only while standing on the Royal Hall building). */
  enterThroneHall(): void {
    if (this.state.battle.inBattle) {
      this.logEvent("Finish the fight before entering the keep.");
      this.emit();
      return;
    }
    if (this.state.world.inDungeon) {
      this.emit();
      return;
    }
    if (!this.state.world.canEnterThroneHall) {
      this.logEvent("Approach the Royal Hall doors in Crownkeep to petition the throne.");
      this.emit();
      return;
    }
    if ((this.state.world.realmTier ?? 1) !== 1) {
      this.logEvent("The royal hall is sealed in this realm.");
      this.emit();
      return;
    }

    const seed = (this.state.world.worldSeed ?? 1) ^ 0x4b1d;
    const dungeon = generateCastleThroneHall(seed);

    this.state.world.overworldReturnX = this.state.player.x;
    this.state.world.overworldReturnY = this.state.player.y;
    this.state.world.dungeon = dungeon;
    this.state.world.inDungeon = true;
    this.updateMusic();
    this.state.world.canLeaveDungeon = false;
    this.state.world.inTown = false;
    this.updateMusic();
    this.state.world.canHeal = false;
    this.state.world.canShop = false;
    this.state.world.canPetShop = false;
    this.state.world.canTrain = false;
    this.state.world.canGuild = false;
    this.state.world.canBoss = false;
    this.state.world.canLibrary = false;
    this.state.world.canForge = false;
    this.state.world.canChapel = false;
    this.state.world.canStables = false;
    this.state.world.canMarket = false;
    this.state.world.canVoidPortal = false;
    this.state.world.canRestoreSpring = false;
    this.state.world.canReturnPortal = false;
    this.state.world.canDungeon = false;
    this.state.world.canEnterThroneHall = false;
    this.state.world.canThrone = false;

    const f0 = dungeon.floors[0]!;
    this.state.player.x = f0.entryTx * TILE + TILE / 2;
    this.state.player.y = f0.entryTy * TILE + TILE / 2;

    this.logEvent("The gates swing — a long carpet runs toward the distant throne.");
    this.emit();
  }

  /**
   * Climb back up out of the dungeon. Must be standing on the exit tile (the
   * same tile used as entry) — {@link dispatchDungeonTile} keeps that flag synced.
   */
  leaveDungeon(): void {
    if (this.state.battle.inBattle) {
      this.logEvent("Finish the fight before leaving the dungeon.");
      this.emit();
      return;
    }
    if (!this.state.world.inDungeon) {
      this.emit();
      return;
    }
    if (!this.state.world.canLeaveDungeon) {
      this.logEvent("The stairs out are elsewhere in the dungeon.");
      this.emit();
      return;
    }

    const wasThroneHall = this.state.world.dungeon?.kind === "throneHall";
    this.state.player.x = this.state.world.overworldReturnX;
    this.state.player.y = this.state.world.overworldReturnY;
    this.state.world.inDungeon = false;
    this.updateMusic();
    this.state.world.dungeon = null;
    this.state.world.canLeaveDungeon = false;

    // Re-sync the overworld zones for the tile the player is returning to.
    const tx = Math.floor(this.state.player.x / TILE);
    const ty = Math.floor(this.state.player.y / TILE);
    syncZonesAtTile(tx, ty);

    this.logEvent(
      wasThroneHall ? "You step back through the gate into the courtyard." : "You climb back into daylight."
    );
    this.emit();
  }

  /**
   * Tile-event dispatcher for dungeon movement. Mirrors {@link dispatchZonesAndEncounter}
   * for the overworld: checks for exit / chest / monster on the tile the player
   * just stepped on. Returns true when an encounter starts so the caller can skip
   * further movement for this frame.
   */
  dispatchDungeonTile(tx: number, ty: number): boolean {
    const dungeon = this.state.world.dungeon;
    if (!this.state.world.inDungeon || !dungeon) return false;

    const floor = currentDungeonFloor(dungeon);
    if (!floor) return false;
    const tile = floor.tiles[ty * floor.width + tx] ?? 0;

    this.state.world.canThrone = false;

    // Stairs no longer auto-trigger — they surface an action button so the
    // player has to confirm the floor change, matching chests and buildings.
    this.state.world.canDescendStairs =
      tile === DUNGEON_TILE_STAIRS_DOWN && dungeon.levelIndex < dungeon.depth - 1;
    this.state.world.canAscendStairs =
      tile === DUNGEON_TILE_STAIRS_UP && dungeon.levelIndex > 0;

    this.state.world.canLeaveDungeon =
      tile === DUNGEON_TILE_EXIT && dungeon.levelIndex === 0;

    if (dungeon.kind === "throneHall" && floor.throneHallAudience) {
      const a = floor.throneHallAudience;
      // The audience "zone" spans the throne tile plus every walkable tile
      // within two steps south — previously this was a single tile, which
      // caused the Royal Favor window to wink out the instant the player
      // drifted off-center. Keeping the window visible around the dais is
      // more forgiving without letting it leak outside the throne room.
      const dx = Math.abs(tx - a.tx);
      const dy = ty - a.ty;
      const withinThroneZone =
        tile !== DUNGEON_TILE_EXIT && dx <= 1 && dy >= 0 && dy <= 2;
      if (withinThroneZone) {
        this.state.world.canThrone = true;
      }
    }

    // Chests no longer auto-open when you step on the tile — the player must
    // press the "Open chest" action button (see PlayfieldActionOverlays). This
    // matches how buildings / doors work and prevents accidental loot pickups.

    // Roamer engage — walking onto a visible undead starts the fight.
    const roamerIdx = floor.roamers.findIndex((r) => r.tx === tx && r.ty === ty);
    if (roamerIdx !== -1) {
      const roamer = floor.roamers[roamerIdx]!;
      const def = ENEMIES.find((e) => e.id === roamer.enemyId);
      // Always remove the roamer — even if the def lookup fails we don't want
      // the ghost tile blocking movement forever.
      floor.roamers = floor.roamers.filter((_, i) => i !== roamerIdx);
      if (def) {
        this.startEncounter(undefined, { forcedTemplate: def, roamerEngage: true });
        this.emit();
        return true;
      }
    }

    this.emit();
    return false;
  }

  /** Open the chest with {@link chestId} if the player is adjacent and it isn't already open. */
  openDungeonChest(chestId: string): void {
    const dungeon = this.state.world.dungeon;
    if (!this.state.world.inDungeon || !dungeon) return;
    const floor = currentDungeonFloor(dungeon);
    if (!floor) return;
    const chest = floor.chests.find((c) => c.id === chestId);
    if (!chest || chest.opened) return;
    const ptx = Math.floor(this.state.player.x / TILE);
    const pty = Math.floor(this.state.player.y / TILE);
    const adjacent = Math.abs(chest.tx - ptx) <= 1 && Math.abs(chest.ty - pty) <= 1;
    if (!adjacent) {
      this.logEvent("Move next to the chest to open it.");
      this.emit();
      return;
    }
    chest.opened = true;
    // Add loot.
    const curr = this.state.player.items[chest.lootItem] ?? 0;
    this.state.player.items[chest.lootItem] = curr + 1;
    this.state.player.gold += chest.lootGold;
    const itemLabel = ITEM_DATA[chest.lootItem]?.name ?? chest.lootItem;
    this.logEvent(`Chest! ${itemLabel} (+${chest.lootGold}g).`);
    playSfx("pickup");
    this.emit();
  }

  /**
   * Descend to the next dungeon floor — requires the player to be standing on
   * a DUNGEON_TILE_STAIRS_DOWN tile (see {@link dispatchDungeonTile}, which
   * flags `world.canDescendStairs`). Used by the action-button UI.
   */
  descendStairs(): void {
    if (this.state.battle.inBattle) return;
    const dungeon = this.state.world.dungeon;
    if (!this.state.world.inDungeon || !dungeon) return;
    if (!this.state.world.canDescendStairs) return;
    if (dungeon.levelIndex >= dungeon.depth - 1) return;
    dungeon.levelIndex += 1;
    const dest = currentDungeonFloor(dungeon)!;
    this.state.player.x = dest.entryTx * TILE + TILE / 2;
    this.state.player.y = dest.entryTy * TILE + TILE / 2;
    this.logEvent(`Deeper — floor ${dungeon.levelIndex + 1} of ${dungeon.depth}.`);
    this.state.world.canLeaveDungeon = false;
    this.state.world.canDescendStairs = false;
    this.state.world.canAscendStairs = false;
    this.emit();
    {
      const tx = Math.floor(this.state.player.x / TILE);
      const ty = Math.floor(this.state.player.y / TILE);
      this.dispatchDungeonTile(tx, ty);
    }
  }

  /**
   * Climb to the previous dungeon floor. Requires the player to be standing on
   * a DUNGEON_TILE_STAIRS_UP tile (see {@link dispatchDungeonTile}, which
   * flags `world.canAscendStairs`).
   */
  ascendStairs(): void {
    if (this.state.battle.inBattle) return;
    const dungeon = this.state.world.dungeon;
    if (!this.state.world.inDungeon || !dungeon) return;
    if (!this.state.world.canAscendStairs) return;
    if (dungeon.levelIndex <= 0) return;
    dungeon.levelIndex -= 1;
    const dest = currentDungeonFloor(dungeon)!;
    const sd = findFirstTileOfKind(dest, DUNGEON_TILE_STAIRS_DOWN);
    if (sd) {
      this.state.player.x = sd.tx * TILE + TILE / 2;
      this.state.player.y = sd.ty * TILE + TILE / 2;
    }
    this.logEvent(`Climbing — floor ${dungeon.levelIndex + 1} of ${dungeon.depth}.`);
    this.state.world.canLeaveDungeon = false;
    this.state.world.canDescendStairs = false;
    this.state.world.canAscendStairs = false;
    this.emit();
    {
      const tx = Math.floor(this.state.player.x / TILE);
      const ty = Math.floor(this.state.player.y / TILE);
      this.dispatchDungeonTile(tx, ty);
    }
  }

  challengeBoss(): void {
    if (this.state.battle.inBattle) {
      return;
    }
    if (this.state.player.bossDefeated) {
      const b = bossEnemyForRealm(this.state.world.realmTier ?? 1);
      this.logEvent(`${b.name} has already been defeated.`);
      this.emit();
      return;
    }
    const bossDef = bossEnemyForRealm(this.state.world.realmTier ?? 1);
    const enemy: EnemyState = { ...bossDef, hp: bossDef.maxHp };
    this.clearVictoryExitTimer();
    this.state.battle = {
      inBattle: true,
      phase: this.playerSpeed() >= enemy.speed ? "playerTurn" : "enemyTurn",
      enemy,
      log: [`${enemy.name} challenges you!`],
      skillCooldown: this.state.battle.skillCooldown,
      itemAttackBonus: 0,
      itemDefenseBonus: 0,
      // Carry the player's chosen fighting style over from the previous fight
      // so they don't have to re-pick "Power" / "Stealth" / "Fortune" every battle.
      stance: this.state.battle.stance ?? "balanced",
      dodgeReady: false,
      nextHitMitigation: 0,
      victorySummary: null
    };
    this.emit();
    if (this.state.battle.phase === "enemyTurn") {
      this.enemyTurn();
    }
  }

  resetGame(): void {
    if ((this.state.player.voidTitansDefeated ?? 0) < 1) {
      this.logEvent("Defeat a realm guardian in the arena first to unlock reset.");
      this.emit();
      return;
    }
    void (async () => {
      try {
        await this.saveRepository.clearAll();
      } catch {
        this.logEvent("Could not clear saved games.");
      }
      regenerateWorld(randomSeed());
      this.lastPersistedVersion = -1;
      this.clearVictoryExitTimer();
      this.state = {
        player: initialPlayer(),
        battle: initialBattle(),
        world: initialWorld(),
        eventLog: ["World reset complete. A new land has risen. Saved games cleared."],
        ugc: initialUgc(),
        story: initialStory(),
        hasUnsavedChanges: true,
        pendingLevelUpCelebration: null,
        sleeping: false
      };
      this.refreshRoamingMonsters();
      this.emit();
    })();
  }

  /**
   * Generate a brand-new procedural world. Can be triggered at any time outside of battle —
   * player position is moved to the new spawn. UGC and progression are preserved.
   */
  regenerateOverworld(seed?: number): void {
    if (this.state.battle.inBattle) {
      this.logEvent("Finish the current battle before reshaping the world.");
      this.emit();
      return;
    }
    regenerateWorld(seed, Math.max(1, Math.floor(this.state.world.realmTier ?? 1)));
    const spawn = getSpawnPixel();
    this.state.player.x = spawn.x;
    this.state.player.y = spawn.y;
    this.state.world = {
      ...this.state.world,
      worldSeed: activeWorldSeed,
      worldVersion: activeWorldVersion,
      inTown: true,
      canHeal: false,
      canShop: false,
      canPetShop: false,
      canTrain: false,
      canGuild: false,
      canBoss: false,
      canLibrary: false,
      canForge: false,
      canChapel: false,
      canStables: false,
      canMarket: false,
      canVoidPortal: false,
      canRestoreSpring: false,
      canReturnPortal: false,
      canDungeon: false,
      canEnterThroneHall: false,
      canThrone: false,
      canLeaveDungeon: false,
      canDescendStairs: false,
      canAscendStairs: false,
      inDungeon: false,
      dungeon: null,
      overworldReturnX: 0,
      overworldReturnY: 0,
      voidPortalActive: false,
      realmTier: Math.max(1, Math.floor(this.state.world.realmTier ?? 1)),
      encounterRate: 0,
      encounterGraceSteps: 0,
      roamingMonsters: [],
      resourceNodes: []
    };
    this.updateMusic();
    this.refreshRoamingMonsters();
    this.logEvent("The land reshapes itself. A new world stretches before you.");
    this.emit();
  }

  trainAttack(): void {
    this.trainStat("attack");
  }

  trainDefense(): void {
    this.trainStat("defense");
  }

  trainSpeed(): void {
    this.trainStat("speed");
  }

  claimGuildBounty(): void {
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    const target = this.currentBountyTarget();
    if (this.state.player.monstersDefeated < target) {
      this.logEvent(`Guild bounty progress: ${this.state.player.monstersDefeated}/${target} defeated.`);
      this.emit();
      return;
    }
    const rewardGold = 20 + this.state.player.bountyTier * 18;
    const rewardXp = 12 + this.state.player.bountyTier * 10;
    this.state.player.monstersDefeated -= target;
    this.state.player.gold += rewardGold;
    this.state.player.xp += rewardXp;
    this.state.player.bountyTier += 1;
    this.logEvent(`Guild reward claimed! +${rewardGold}g and +${rewardXp} XP.`);
    this.resolveLevelUps();
    this.emit();
  }

  /** Crownkeep throne — gold, XP, stats after enough new wild kills since the last audience. */
  claimKingFavor(): void {
    if (!this.state.world.canThrone) {
      this.logEvent("Only the throne in Crownkeep can grant the King's favor.");
      this.emit();
      return;
    }
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    const p = this.state.player;
    const tally = p.kingAudienceTally ?? 0;
    const baseline = p.kingAudienceTallyLastClaim ?? 0;
    const needNew = 8;
    if (tally < baseline + needNew) {
      const short = baseline + needNew - tally;
      this.logEvent(
        `The King nods — bring proof of ${short} more beast${short === 1 ? "" : "s"} slain since your last audience.`
      );
      this.emit();
      return;
    }
    const tier = p.kingFavorsClaimed ?? 0;
    const goldReward = 40 + tier * 18;
    const xpReward = 22 + tier * 10;
    p.gold += goldReward;
    p.xp += xpReward;
    p.maxHp += 2;
    p.hp = Math.min(p.maxHp, p.hp + 2);
    if (tier % 2 === 0) {
      p.attack += 1;
    } else {
      p.defense += 1;
    }
    p.kingFavorsClaimed = tier + 1;
    p.kingAudienceTallyLastClaim = tally;
    this.logEvent(
      `The King praises your hunts. Royal favor: +${goldReward}g, +${xpReward} XP, +2 max HP, +1 ${tier % 2 === 0 ? "Attack" : "Defense"}.`
    );
    this.resolveLevelUps();
    this.emit();
  }

  studyAtLibrary(): void {
    if (!this.state.world.canLibrary) {
      this.logEvent("Visit a library to study old monster lore.");
      this.emit();
      return;
    }
    const fee = 14 + this.state.player.level * 3;
    if (this.state.player.gold < fee) {
      this.logEvent(`Library study session costs ${fee}g.`);
      this.emit();
      return;
    }
    const xpGain = 10 + this.state.player.level * 4;
    this.state.player.gold -= fee;
    this.state.player.xp += xpGain;
    this.logEvent(`You study ancient battle texts. +${xpGain} XP for ${fee}g.`);
    this.resolveLevelUps();
    this.emit();
  }

  temperAtForge(): void {
    if (!this.state.world.canForge) {
      this.logEvent("Visit a forge to temper your gear.");
      this.emit();
      return;
    }
    const fee = 30 + this.state.player.level * 8;
    if (this.state.player.gold < fee) {
      this.logEvent(`Forgemaster tempering costs ${fee}g.`);
      this.emit();
      return;
    }
    this.state.player.gold -= fee;
    this.state.player.attack += 1;
    this.state.player.maxHp += 3;
    this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + 3);
    this.logEvent(`The forge hardens your edge: +1 attack, +3 max HP (${fee}g).`);
    this.emit();
  }

  prayAtChapel(): void {
    if (!this.state.world.canChapel) {
      this.logEvent("Visit a chapel for a blessing.");
      this.emit();
      return;
    }
    const fee = 5;
    const needsHeal = this.state.player.hp < this.state.player.maxHp;
    if (!needsHeal) {
      this.logEvent("You feel steady already; no chapel blessing is needed.");
      this.emit();
      return;
    }
    if (this.state.player.gold < fee) {
      this.logEvent(`A chapel blessing costs ${fee}g.`);
      this.emit();
      return;
    }
    this.state.player.gold -= fee;
    const heal = Math.max(12, Math.floor(this.state.player.maxHp * 0.35));
    this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + heal);
    this.logEvent(`Blessing received: healed ${heal} HP.`);
    this.emit();
  }

  buyStableHorse(horseKey: HorseKey): void {
    if (!this.state.world.canStables) {
      this.logEvent("Visit the stables to browse mounts.");
      this.emit();
      return;
    }
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    const def = STABLE_HORSES[horseKey];
    if (!def) return;
    const owned = this.state.player.horsesOwned;
    if (owned.includes(horseKey)) {
      this.logEvent(`${def.name} is already in your stable.`);
      this.emit();
      return;
    }
    if (owned.length >= 5) {
      this.logEvent("Five mounts are enough — your stable is full.");
      this.emit();
      return;
    }
    if (this.state.player.gold < def.price) {
      this.logEvent(`${def.name} costs ${def.price}g.`);
      this.emit();
      return;
    }
    this.state.player.gold -= def.price;
    this.state.player.horsesOwned = [...owned, horseKey];
    const bonus = stableHorseSpeedBonus(this.state.player.horsesOwned);
    const pct = Math.round((0.12 * bonus) * 100);
    this.logEvent(`Stabled ${def.name}! Mounts now speed up overworld travel (+${pct}% walk with ${bonus} mount${bonus === 1 ? "" : "s"}, max five).`);
    this.emit();
  }

  haggleAtMarket(): void {
    if (!this.state.world.canMarket) {
      this.logEvent("Visit the market square to haggle.");
      this.emit();
      return;
    }
    const picks = Math.random() < 0.35 ? 3 : 2;
    const rolled: ItemKey[] = [];
    let retail = 0;
    for (let i = 0; i < picks; i++) {
      const key = SHOP_ITEMS[Math.floor(Math.random() * SHOP_ITEMS.length)];
      rolled.push(key);
      retail += ITEM_DATA[key].price;
    }
    const cost = Math.max(8, Math.round(retail * 0.55));
    if (this.state.player.gold < cost) {
      this.logEvent(`A market bundle costs ${cost}g.`);
      this.emit();
      return;
    }
    this.state.player.gold -= cost;
    for (const key of rolled) this.state.player.items[key] += 1;
    const names = rolled.map((key) => ITEM_DATA[key].name).join(", ");
    this.logEvent(`You haggle a market bundle (${names}) for ${cost}g.`);
    this.emit();
  }

  setEncounterRate(encounterRate: number): void {
    this.state.world.encounterRate = clampEncounterStepChance(encounterRate);
    this.emit();
  }

  /** Advance the day / night clock (no-op while in battle). */
  tickWorldClock(dayFraction: number): void {
    if (this.state.battle.inBattle) return;
    const base = this.state.world.worldTime ?? 0;
    const next = base + dayFraction;
    this.state.world.worldTime = Number.isFinite(next) ? next : 0.28;
    const px = this.state.player.x ?? 0;
    const py = this.state.player.y ?? 0;
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    syncZonesAtTile(tx, ty);
    this.tickPetStableTraining();
  }

  /** One companion levels up when their stable drill timer elapses (real-time). */
  private tickPetStableTraining(): void {
    const job = this.state.player.petStableTraining;
    if (!job) return;
    if (Date.now() < job.readyAt) return;

    const pet = this.state.player.pets.find((p) => p.id === job.petId);
    this.state.player.petStableTraining = null;
    if (!pet) {
      this.emit();
      return;
    }
    if (pet.level >= PET_STABLE_MAX_LEVEL) {
      this.logEvent(`${pet.name} is already at max stable training (Lv ${PET_STABLE_MAX_LEVEL}).`);
      this.emit();
      return;
    }
    const newLevel = pet.level + 1;
    const newBonus = Math.min(PET_ATTACK_BUFF_CAP, pet.attackBonus + 1);
    this.state.player.pets = this.state.player.pets.map((p) =>
      p.id === job.petId ? { ...p, level: newLevel, attackBonus: newBonus } : p
    );
    this.logEvent(
      `${pet.name} finished stable drills — now level ${newLevel}! (ATK bonus up to +${PET_ATTACK_BUFF_CAP} while active)`
    );
    this.emit();
  }

  /** Begin a timed level-up for one pet at the stables (fee + longer wait for higher levels). */
  startPetStableTraining(petId: string): void {
    if (!this.state.world.canStables) {
      this.logEvent("Visit the stables to train companions.");
      this.emit();
      return;
    }
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    this.tickPetStableTraining();
    const existing = this.state.player.petStableTraining;
    if (existing && Date.now() < existing.readyAt) {
      this.logEvent("Finish the current stable drill before starting another.");
      this.emit();
      return;
    }
    const pet = this.state.player.pets.find((p) => p.id === petId);
    if (!pet) return;
    if (pet.level >= PET_STABLE_MAX_LEVEL) {
      this.logEvent(`${pet.name} has reached max stable training (Lv ${PET_STABLE_MAX_LEVEL}).`);
      this.emit();
      return;
    }
    const fee = stablePetTrainFee(pet.level);
    if (this.state.player.gold < fee) {
      this.logEvent(`Stable drills cost ${fee}g for ${pet.name} (Lv ${pet.level}).`);
      this.emit();
      return;
    }
    const durationMs = stablePetTrainDurationMs(pet.level);
    this.state.player.gold -= fee;
    this.state.player.petStableTraining = { petId, readyAt: Date.now() + durationMs };
    const sec = Math.ceil(durationMs / 1000);
    this.logEvent(`The stable takes ${pet.name} for drills (${sec}s, ${fee}g paid).`);
    this.emit();
  }

  wildernessEncounterStep(encounterRate: number): boolean {
    this.state.world.encounterRate = clampEncounterStepChance(encounterRate);
    if (this.state.world.encounterGraceSteps > 0) {
      this.state.world.encounterGraceSteps -= 1;
      this.emit();
      return true;
    }
    this.emit();
    return false;
  }

  /**
   * Step onto a tile that holds a gatherable flower / mushroom. Harvests it (stores in the
   * resource bag) and removes the node from the map. Safe to call on every step — returns
   * false when no node is present.
   */
  tryGatherResourceAtTile(tx: number, ty: number): boolean {
    if (this.state.battle.inBattle) return false;
    const list = this.state.world.resourceNodes ?? [];
    const idx = list.findIndex((n) => n.tx === tx && n.ty === ty);
    if (idx === -1) return false;
    const node = list[idx]!;
    const def = RESOURCES[node.resourceKey];
    this.state.world.resourceNodes = list.filter((_, i) => i !== idx);
    if (!def) {
      this.emit();
      return true;
    }
    const bag = this.state.player.resources ?? emptyResourceBag();
    bag[node.resourceKey] = (bag[node.resourceKey] ?? 0) + 1;
    this.state.player.resources = bag;
    this.logEvent(`Gathered a ${def.name} (market value ${def.sellPrice}g).`);
    playSfx("pickup");
    this.emit();
    return true;
  }

  /** Sell one unit of a resource at the market. */
  sellResource(key: ResourceKey, amount: number = 1): void {
    if (!this.state.world.canMarket) {
      this.logEvent("Visit the market square to sell gatherings.");
      this.emit();
      return;
    }
    const def = RESOURCES[key];
    if (!def) return;
    const bag = this.state.player.resources ?? emptyResourceBag();
    const have = bag[key] ?? 0;
    const qty = Math.max(1, Math.min(Math.floor(amount), have));
    if (qty <= 0) {
      this.logEvent(`No ${def.name} on hand to sell.`);
      this.emit();
      return;
    }
    const gold = qty * def.sellPrice;
    bag[key] = have - qty;
    this.state.player.resources = bag;
    this.state.player.gold += gold;
    this.logEvent(
      qty === 1
        ? `Sold 1 ${def.name} for ${gold}g.`
        : `Sold ${qty}× ${def.name} for ${gold}g.`
    );
    this.emit();
  }

  /** Sell the entire resource bag in one transaction. */
  sellAllResources(): void {
    if (!this.state.world.canMarket) {
      this.logEvent("Visit the market square to sell gatherings.");
      this.emit();
      return;
    }
    const bag = this.state.player.resources ?? emptyResourceBag();
    let totalGold = 0;
    let totalCount = 0;
    for (const key of RESOURCE_KEYS) {
      const have = bag[key] ?? 0;
      if (have <= 0) continue;
      const def = RESOURCES[key];
      if (!def) continue;
      totalGold += have * def.sellPrice;
      totalCount += have;
      bag[key] = 0;
    }
    if (totalCount === 0) {
      this.logEvent("Your forage bag is empty.");
      this.emit();
      return;
    }
    this.state.player.resources = bag;
    this.state.player.gold += totalGold;
    this.logEvent(`Sold ${totalCount} gathered resource${totalCount === 1 ? "" : "s"} for ${totalGold}g.`);
    this.emit();
  }

  private engageRoamerAtIndex(idx: number, tileForBiome: { tx: number; ty: number }): boolean {
    if (this.state.battle.inBattle) return false;
    const list = this.state.world.roamingMonsters ?? [];
    const row = list[idx];
    if (!row) return false;
    const def = ENEMIES.find((e) => e.id === row.enemyId);
    this.state.world.roamingMonsters = list.filter((_, i) => i !== idx);
    if (!def) {
      this.emit();
      return false;
    }
    const biome = biomeAt(tileForBiome.tx, tileForBiome.ty);
    this.startEncounter(biome, { forcedTemplate: def, roamerEngage: true });
    return true;
  }

  /**
   * True when the player is currently standing on a safe town tile. Roamers
   * drop aggro and can't touch-engage while this holds — towns are sanctuary.
   */
  private playerInSafeZone(): boolean {
    const tx = Math.floor((this.state.player.x ?? 0) / TILE);
    const ty = Math.floor((this.state.player.y ?? 0) / TILE);
    return isTownTile(tx, ty);
  }

  /** Step onto a tile that holds a visible roamer — starts battle and removes it from the map. */
  tryRoamerEncounterAtTile(tx: number, ty: number): boolean {
    if (this.state.battle.inBattle) return false;
    if (this.playerInSafeZone()) return false;
    const list = this.state.world.roamingMonsters ?? [];
    const idx = list.findIndex((m) => m.tx === tx && m.ty === ty);
    if (idx === -1) return false;
    return this.engageRoamerAtIndex(idx, { tx, ty });
  }

  /** Proximity / touch engage (3D smooth roamers): match by id, biome from roamer's anchor tile. */
  tryEngageRoamerById(id: string): boolean {
    if (this.state.battle.inBattle) return false;
    if (this.playerInSafeZone()) return false;
    const list = this.state.world.roamingMonsters ?? [];
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    const row = list[idx];
    return this.engageRoamerAtIndex(idx, { tx: row.tx, ty: row.ty });
  }

  startEncounter(
    biome?: BiomeKind,
    opts?: { forcedTemplate?: EnemyDefinition; roamerEngage?: boolean; preferWeakestWild?: boolean }
  ): void {
    if (this.state.battle.inBattle) {
      return;
    }
    const rt = Math.max(1, Math.floor(this.state.world.realmTier ?? 1));
    const forced = opts?.forcedTemplate;
    const realmBuiltInRandom = enemiesForRealm(rt, biome, { randomEncounterOnly: true });
    const pool: EnemyDefinition[] = forced
      ? [forced]
      : [...realmBuiltInRandom, ...this.state.ugc.monsters.map(ugcMonsterToEnemyDef)];

    let template: EnemyDefinition | null = forced
      ? forced
      : null;

    if (!template && opts?.preferWeakestWild && realmBuiltInRandom.length > 0) {
      const minLv = Math.min(...realmBuiltInRandom.map((e) => e.minLevel));
      const lowTier = realmBuiltInRandom.filter((e) => e.minLevel === minLv);
      template = lowTier[Math.floor(Math.random() * lowTier.length)]!;
    }

    if (!template) {
      template =
        pickEncounterFromPool(pool, this.state.player.level) ??
        pickEncounterFromPool(realmBuiltInRandom, 99) ??
        pickEncounterFromPool(enemiesForRealm(rt, undefined, { randomEncounterOnly: true }), this.state.player.level) ??
        pickEncounterEnemy(this.state.player.level, rt);
    }
    if (!template) return;
    const level = this.state.player.level;
    const ugcMatch = this.state.ugc.monsters.find((m) => m.id === template.id);
    // UGC monsters use studio stats as-is (no level-scaling or night combat buffs).
    const scaled = ugcMatch ? template : scaleEncounterForPlayerLevel(template, level);
    const nm = ugcMatch ? 1 : nightEnemyStatMultiplier(this.state.world.worldTime ?? 0);
    const atNight = isNightWilds(this.state.world.worldTime ?? 0);
    const buffHp = Math.max(1, Math.round(scaled.maxHp * nm));
    const buffAtk = Math.max(1, Math.round(scaled.attack * nm));
    const buffDef = Math.max(0, Math.round(scaled.defense * nm));
    const buffSpd = Math.max(1, Math.round(scaled.speed * nm));
    const enemy: EnemyState = {
      ...scaled,
      maxHp: buffHp,
      attack: buffAtk,
      defense: buffDef,
      speed: buffSpd,
      hp: buffHp,
      ...(ugcMatch
        ? {
            bodyShape: ugcMatch.bodyShape,
            customColors: { primary: ugcMatch.colorPrimary, accent: ugcMatch.colorAccent }
          }
        : {})
    };
    this.clearVictoryExitTimer();
    const intro =
      opts?.roamerEngage
        ? `You run into a roaming ${enemy.name}!`
        : atNight
          ? `Under dark skies, a wild ${enemy.name} appears!`
          : `A wild ${enemy.name} appears!`;
    const playerTileX = Math.floor((this.state.player.x ?? 0) / TILE);
    const playerTileY = Math.floor((this.state.player.y ?? 0) / TILE);
    const encounterTerrain = terrainAt(playerTileX, playerTileY);
    const positional: { highGround?: boolean; ambush?: boolean } = {};
    if (encounterTerrain === "hill") positional.highGround = true;
    if (encounterTerrain === "forest" || opts?.roamerEngage) positional.ambush = true;
    this.state.battle = {
      inBattle: true,
      phase: this.playerSpeed() >= enemy.speed ? "playerTurn" : "enemyTurn",
      enemy,
      log: [intro],
      skillCooldown: this.state.battle.skillCooldown,
      itemAttackBonus: 0,
      itemDefenseBonus: 0,
      // Persist the player's chosen fighting style across encounters so they
      // keep their preferred stance instead of being forced back to Balanced.
      stance: this.state.battle.stance ?? "balanced",
      dodgeReady: false,
      nextHitMitigation: 0,
      victorySummary: null,
      encounterTerrain,
      positional,
      stunTurns: 0,
      guardEnergy: 0
    };
    if (positional.highGround) {
      this.logBattle("High ground — you swing down with extra force.");
    } else if (positional.ambush) {
      this.logBattle("You set upon them before they can set their stance — next strike bites harder.");
    }
    playSfx("encounter");
    this.emit();
    if (this.state.battle.phase === "enemyTurn") {
      this.enemyTurn();
    }
  }

  /** Change combat approach (weapon, skills, and pet follow-ups use stance modifiers). */
  setBattleStance(stance: BattleStanceKind): void {
    if (!this.canPlayerAct()) return;
    if (!BATTLE_STANCE_ORDER.includes(stance)) return;
    if (this.state.battle.stance === stance) return;
    this.state.battle.stance = stance;
    const row = battleStanceModifiers(stance);
    this.logBattle(`Stance: ${row.label}.`);
    this.emit();
  }

  /** Spend your turn to roll evasion on the foe's next swing (speed + stance). */
  playerDodge(): void {
    if (!this.canPlayerAct()) return;
    this.state.battle.dodgeReady = true;
    this.state.battle.nextHitMitigation = 0;
    
    // Add stance synergy: Balanced/Stealth give extra mitigation for dodging
    const sm = battleStanceModifiers(this.state.battle.stance);
    let msg = "You focus on footwork — ready to dodge the next strike.";
    if (sm.label === "Balanced" || sm.label === "Shadow") {
      this.state.battle.nextHitMitigation = 0.15; // Bonus mitigation
      msg += " (Stance synergy: partial cover)";
    }
    
    this.logBattle(msg);
    this.finishPlayerTurnWithoutOffense();
  }

  /** Spend your turn to brace; the next enemy hit deals less damage. */
  playerBrace(): void {
    if (!this.canPlayerAct()) return;
    this.state.battle.dodgeReady = false;
    
    // Add stance synergy: Power/Balanced provide better bracing
    const sm = battleStanceModifiers(this.state.battle.stance);
    let mitigation = 0.34;
    let msg = "You brace behind your guard — the next hit will land softer.";
    if (sm.label === "Balanced" || sm.label === "Strong") {
      mitigation = 0.5; // Bonus mitigation
      msg += " (Stance synergy: reinforced)";
    }
    
    this.state.battle.nextHitMitigation = mitigation;
    this.logBattle(msg);
    this.finishPlayerTurnWithoutOffense();
  }

  /**
   * Heavy Strike — wind up a 2x damage swing at the cost of your next turn
   * (enemy takes a free extra swing while you recover).
   */
  playerHeavyStrike(): void {
    if (!this.canPlayerAct()) return;
    const enemy = this.state.battle.enemy;
    if (!enemy) return;
    const sm = battleStanceModifiers(this.state.battle.stance);
    const atkEl = WEAPON_STATS[this.state.player.weapon].element;
    const effDef = Math.max(0, enemy.defense * (1 - sm.defenseIgnore));
    const raw = Math.max(2, this.playerAttackPower() - effDef + this.randomVariance());
    const mult = elementDamageMultiplier(atkEl, enemy.element);
    
    // Add stance synergy: Power stance doubles damage, others only 1.5x
    const powerMult = (sm.label === "Strong") ? 2.5 : 2;
    let damage = Math.max(2, Math.round(raw * mult * sm.outgoingDamageMult * powerMult));
    
    const posMult = this.consumePositionalMultiplier();
    if (posMult.mult !== 1) {
      damage = Math.max(2, Math.round(damage * posMult.mult));
    }
    const oil = this.consumeEnemyOilMult(atkEl);
    if (oil.mult !== 1) {
      damage = Math.max(2, Math.round(damage * oil.mult));
    }
    const crit = this.consumeEnemyMarkCrit(this.rollPlayerCrit());
    if (crit.mult > 1) {
      damage = Math.max(2, Math.round(damage * crit.mult));
    }
    enemy.hp = Math.max(0, enemy.hp - damage);
    const stanceTag = sm.label !== "Balanced" ? ` (${sm.label})` : "";
    
    const synergy = (sm.label === "Strong") ? " (Strong synergy: crushing weight)" : "";
    this.logBattle(
      `HEAVY STRIKE for ${damage} damage — you're off-balance for the next turn.${elementBattleLogSuffix(mult)}${crit.suffix}${stanceTag}${posMult.suffix}${oil.suffix}${synergy}`
    );
    this.state.battle.lastPlayerHitAt = nowMs();
    this.state.battle.stunTurns = 1;
    playSfx("attack");
    this.maybePetFollowUp(enemy);
    this.afterPlayerAction();
  }

  /**
   * Dash Attack — lower-damage strike (~55%) that repositions you: the next
   * enemy swing rolls evasion (dodgeReady) and your next offense gets the
   * Ambush edge restored.
   */
  playerDashAttack(): void {
    if (!this.canPlayerAct()) return;
    const enemy = this.state.battle.enemy;
    if (!enemy) return;
    const sm = battleStanceModifiers(this.state.battle.stance);
    const atkEl = WEAPON_STATS[this.state.player.weapon].element;
    const effDef = Math.max(0, enemy.defense * (1 - sm.defenseIgnore));
    const raw = Math.max(1, this.playerAttackPower() - effDef + this.randomVariance());
    const mult = elementDamageMultiplier(atkEl, enemy.element);
    let damage = Math.max(1, Math.round(raw * mult * sm.outgoingDamageMult * 0.55));
    const oil = this.consumeEnemyOilMult(atkEl);
    if (oil.mult !== 1) {
      damage = Math.max(1, Math.round(damage * oil.mult));
    }
    const crit = this.consumeEnemyMarkCrit(this.rollPlayerCrit());
    if (crit.mult > 1) {
      damage = Math.max(1, Math.round(damage * crit.mult));
    }
    enemy.hp = Math.max(0, enemy.hp - damage);
    const stanceTag = sm.label !== "Balanced" ? ` (${sm.label})` : "";
    const pos = (this.state.battle.positional = this.state.battle.positional ?? {});
    pos.ambush = true;
    this.state.battle.dodgeReady = true;
    this.state.battle.nextHitMitigation = 0;
    this.logBattle(
      `Dash attack — ${damage} damage. You reposition: ready to dodge, ambush primed.${elementBattleLogSuffix(mult)}${crit.suffix}${stanceTag}${oil.suffix}`
    );
    this.state.battle.lastPlayerHitAt = nowMs();
    playSfx("attack");
    this.afterPlayerAction();
  }

  /**
   * Guard — brace variant that soaks 50% off the next hit AND builds one
   * charge of Guard energy (capped at 3). Spent by Risk Strike.
   */
  playerGuard(): void {
    if (!this.canPlayerAct()) return;
    this.state.battle.dodgeReady = false;
    this.state.battle.nextHitMitigation = 0.5;
    const current = this.state.battle.guardEnergy ?? 0;
    const next = Math.min(3, current + 1);
    this.state.battle.guardEnergy = next;
    this.logBattle(`Guard raised — next hit halves. Energy: ${next}/3.`);
    this.finishPlayerTurnWithoutOffense();
  }

  /**
   * Risk Strike — gambled offense. Base hit chance 55% (+12% per stored Guard
   * energy). On hit: 2.2x damage (+0.4x per energy). On miss: you take recoil
   * (8% max HP) and the enemy gets a free turn. Consumes ALL guard energy.
   */
  playerRiskStrike(): void {
    if (!this.canPlayerAct()) return;
    const enemy = this.state.battle.enemy;
    if (!enemy) return;
    const energy = this.state.battle.guardEnergy ?? 0;
    this.state.battle.guardEnergy = 0;
    const hitChance = Math.min(0.95, 0.55 + energy * 0.12);
    const roll = Math.random();
    if (roll > hitChance) {
      const recoil = Math.max(1, Math.round(this.state.player.maxHp * 0.08));
      this.state.player.hp = Math.max(0, this.state.player.hp - recoil);
      this.state.battle.lastEnemyHitAt = nowMs();
      this.logBattle(
        `Risk Strike MISSES! Your wild swing costs you ${recoil} HP — the opening is wide.`
      );
      playSfx("hit");
      if (this.state.player.hp <= 0) {
        this.state.battle.phase = "knockoutPending";
        this.logBattle("You were knocked out.");
        playSfx("defeat");
        this.emit();
        return;
      }
      this.finishPlayerTurnWithoutOffense();
      return;
    }
    const sm = battleStanceModifiers(this.state.battle.stance);
    const atkEl = WEAPON_STATS[this.state.player.weapon].element;
    const effDef = Math.max(0, enemy.defense * (1 - sm.defenseIgnore));
    const riskMult = 2.2 + energy * 0.4;
    const raw = Math.max(3, this.playerAttackPower() - effDef + this.randomVariance());
    const mult = elementDamageMultiplier(atkEl, enemy.element);
    let damage = Math.max(3, Math.round(raw * mult * sm.outgoingDamageMult * riskMult));
    const posMult = this.consumePositionalMultiplier();
    if (posMult.mult !== 1) {
      damage = Math.max(3, Math.round(damage * posMult.mult));
    }
    const oil = this.consumeEnemyOilMult(atkEl);
    if (oil.mult !== 1) {
      damage = Math.max(3, Math.round(damage * oil.mult));
    }
    const crit = this.consumeEnemyMarkCrit(this.rollPlayerCrit());
    if (crit.mult > 1) {
      damage = Math.max(3, Math.round(damage * crit.mult));
    }
    enemy.hp = Math.max(0, enemy.hp - damage);
    const stanceTag = sm.label !== "Balanced" ? ` (${sm.label})` : "";
    const energyTag = energy > 0 ? ` (spent ${energy} energy)` : "";
    this.logBattle(
      `RISK STRIKE LANDS for ${damage} damage!${energyTag}${elementBattleLogSuffix(mult)}${crit.suffix}${stanceTag}${posMult.suffix}${oil.suffix}`
    );
    this.state.battle.lastPlayerHitAt = nowMs();
    playSfx("skill");
    this.afterPlayerAction();
  }

  /**
   * Oil — coats the foe for 3 turns. Fire-element attacks/skills deal +40%
   * damage while oil is active. Costs the turn; no direct damage.
   */
  playerOil(): void {
    if (!this.canPlayerAct()) return;
    const enemy = this.state.battle.enemy;
    if (!enemy) return;
    enemy.oiled = 3;
    this.logBattle(`You slick ${enemy.name} with oil — fire attacks will burn deeper for 3 turns.`);
    this.finishPlayerTurnWithoutOffense();
  }

  /**
   * Mark — your next offensive strike auto-crits (min 1.5×) then clears the
   * mark. Costs the turn; no direct damage. Stacks with natural crit rolls —
   * a rolled bigger crit wins.
   */
  playerMark(): void {
    if (!this.canPlayerAct()) return;
    const enemy = this.state.battle.enemy;
    if (!enemy) return;
    enemy.marked = true;
    this.logBattle(`You line up a killing point on ${enemy.name} — next strike is a guaranteed critical.`);
    this.finishPlayerTurnWithoutOffense();
  }

  /**
   * Shred — builds bleed stacks (capped at 5). Each application deals ~55%
   * damage and adds +1 stack. When the new stack count reaches 3+, the wound
   * EXPLODES: damage scales with (1.5 + 0.5 × stacks) and stacks clear.
   */
  playerShred(): void {
    if (!this.canPlayerAct()) return;
    const enemy = this.state.battle.enemy;
    if (!enemy) return;
    const sm = battleStanceModifiers(this.state.battle.stance);
    const atkEl = WEAPON_STATS[this.state.player.weapon].element;
    const effDef = Math.max(0, enemy.defense * (1 - sm.defenseIgnore));
    const curStacks = enemy.shredStacks ?? 0;
    const nextStacks = Math.min(5, curStacks + 1);
    const shouldDetonate = nextStacks >= 3;
    const baseFactor = shouldDetonate ? 1.5 + 0.5 * nextStacks : 0.55;
    const raw = Math.max(1, this.playerAttackPower() - effDef + this.randomVariance());
    const mult = elementDamageMultiplier(atkEl, enemy.element);
    let damage = Math.max(1, Math.round(raw * mult * sm.outgoingDamageMult * baseFactor));
    const posMult = this.consumePositionalMultiplier();
    if (posMult.mult !== 1) {
      damage = Math.max(1, Math.round(damage * posMult.mult));
    }
    const oil = this.consumeEnemyOilMult(atkEl);
    if (oil.mult !== 1) {
      damage = Math.max(1, Math.round(damage * oil.mult));
    }
    const crit = this.consumeEnemyMarkCrit(this.rollPlayerCrit());
    if (crit.mult > 1) {
      damage = Math.max(1, Math.round(damage * crit.mult));
    }
    enemy.hp = Math.max(0, enemy.hp - damage);
    const stanceTag = sm.label !== "Balanced" ? ` (${sm.label})` : "";
    if (shouldDetonate) {
      enemy.shredStacks = 0;
      this.logBattle(
        `SHRED DETONATES (${nextStacks} stacks) for ${damage} damage!${elementBattleLogSuffix(mult)}${crit.suffix}${stanceTag}${posMult.suffix}${oil.suffix}`
      );
      playSfx("skill");
    } else {
      enemy.shredStacks = nextStacks;
      this.logBattle(
        `Shred applied (${nextStacks}/5) — ${damage} damage.${elementBattleLogSuffix(mult)}${crit.suffix}${stanceTag}${posMult.suffix}${oil.suffix}`
      );
      playSfx("attack");
    }
    this.state.battle.lastPlayerHitAt = nowMs();
    this.afterPlayerAction();
  }

  playerAttack(): void {
    if (!this.canPlayerAct()) return;
    const enemy = this.state.battle.enemy;
    if (!enemy) return;
    const sm = battleStanceModifiers(this.state.battle.stance);
    const atkEl = WEAPON_STATS[this.state.player.weapon].element;
    const effDef = Math.max(0, enemy.defense * (1 - sm.defenseIgnore));
    const raw = Math.max(1, this.playerAttackPower() - effDef + this.randomVariance());
    const mult = elementDamageMultiplier(atkEl, enemy.element);
    let damage = Math.max(1, Math.round(raw * mult * sm.outgoingDamageMult));
    const posMult = this.consumePositionalMultiplier();
    if (posMult.mult !== 1) {
      damage = Math.max(1, Math.round(damage * posMult.mult));
    }
    const oil = this.consumeEnemyOilMult(atkEl);
    if (oil.mult !== 1) {
      damage = Math.max(1, Math.round(damage * oil.mult));
    }
    const crit = this.consumeEnemyMarkCrit(this.rollPlayerCrit());
    if (crit.mult > 1) {
      damage = Math.max(1, Math.round(damage * crit.mult));
    }
    enemy.hp = Math.max(0, enemy.hp - damage);
    const stanceTag = sm.label !== "Balanced" ? ` (${sm.label})` : "";
    this.logBattle(
      `You attack for ${damage} damage.${elementBattleLogSuffix(mult)}${crit.suffix}${stanceTag}${posMult.suffix}${oil.suffix}`
    );
    this.state.battle.lastPlayerHitAt = nowMs();
    playSfx("attack");
    this.maybePetFollowUp(enemy);
    this.afterPlayerAction();
  }

  playerSkill(skill: SkillKey = "spark"): void {
    if (!this.canPlayerAct()) return;
    if (!orderedLearnedSkills(this.state.player.learnedSkills).includes(skill)) {
      this.logBattle("You have not learned that skill yet — spend points in Skills.");
      this.emit();
      return;
    }
    const cd = this.state.battle.skillCooldown ?? 0;
    if (cd > 0) {
      this.logBattle(`Skills are on cooldown for ${cd} more turn(s).`);
      this.emit();
      return;
    }
    const enemy = this.state.battle.enemy;
    if (!enemy) return;
    const sm = battleStanceModifiers(this.state.battle.stance);
    const skillData = SKILL_DATA[skill];
    const effDef = Math.max(0, enemy.defense * (1 - sm.defenseIgnore));
    const raw = Math.max(2, this.playerAttackPower() + skillData.powerBonus - effDef + this.randomVariance());
    const mult = elementDamageMultiplier(skillData.element, enemy.element);
    const classSkillMult = skillPowerClassMultiplier(this.state.player.fightingClass);
    let damage = Math.max(2, Math.round(raw * mult * sm.outgoingDamageMult * classSkillMult));
    const posMult = this.consumePositionalMultiplier();
    if (posMult.mult !== 1) {
      damage = Math.max(2, Math.round(damage * posMult.mult));
    }
    const oil = this.consumeEnemyOilMult(skillData.element);
    if (oil.mult !== 1) {
      damage = Math.max(2, Math.round(damage * oil.mult));
    }
    const crit = this.consumeEnemyMarkCrit(this.rollPlayerCrit());
    if (crit.mult > 1) {
      damage = Math.max(2, Math.round(damage * crit.mult));
    }
    enemy.hp = Math.max(0, enemy.hp - damage);
    const stanceTag = sm.label !== "Balanced" ? ` (${sm.label})` : "";
    this.logBattle(
      `You cast ${skillData.name} for ${damage} damage.${elementBattleLogSuffix(mult)}${crit.suffix}${stanceTag}${posMult.suffix}${oil.suffix}`
    );
    this.state.battle.skillCooldown = skillData.cooldown;
    this.state.battle.lastPlayerHitAt = nowMs();
    playSfx("skill");
    this.afterPlayerAction();
  }

  usePotion(item: ItemKey = "potion"): void {
    if (!this.canPlayerAct()) return;
    const count = this.state.player.items[item] ?? 0;
    if (count <= 0) {
      this.logBattle("No healing items left.");
      this.emit();
      return;
    }
    this.state.player.items[item] -= 1;
    const def = ITEM_DATA[item];
    const heal = def.healAmount;
    this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + heal);
    playSfx("heal");
    const msg: string[] = [`You used ${def.name} (+${heal} HP).`];
    const enemy = this.state.battle.enemy;
    const extra = def.extra;
    if (extra) {
      if (extra.attackBuff) {
        this.state.battle.itemAttackBonus = (this.state.battle.itemAttackBonus ?? 0) + extra.attackBuff;
        msg.push(`+${extra.attackBuff} ATK this fight.`);
      }
      if (extra.defenseBuff) {
        this.state.battle.itemDefenseBonus = (this.state.battle.itemDefenseBonus ?? 0) + extra.defenseBuff;
        msg.push(`+${extra.defenseBuff} DEF this fight.`);
      }
      if (extra.cooldownCuts && (this.state.battle.skillCooldown ?? 0) > 0) {
        const cut = Math.min(this.state.battle.skillCooldown, extra.cooldownCuts);
        this.state.battle.skillCooldown -= cut;
        msg.push(`Skills −${cut} CD.`);
      }
      if (enemy && extra.splashDamage) {
        const mitigated = Math.max(1, extra.splashDamage - Math.floor(enemy.defense / 5));
        enemy.hp = Math.max(0, enemy.hp - mitigated);
        msg.push(`${enemy.name} takes ${mitigated} splash damage.`);
        if (enemy.hp <= 0) {
          msg.push(`${enemy.name} falls!`);
          this.logBattle(msg.join(" "));
          this.state.battle.phase = "victoryPending";
          this.applyRewards(enemy);
          this.scheduleVictoryBattleExit();
          this.emit();
          return;
        }
      }
    }
    this.logBattle(msg.join(" "));
    this.state.battle.phase = "enemyTurn";
    this.emit();
    this.enemyTurn();
  }

  usePotionInField(): void {
    if (this.state.battle.inBattle) {
      this.logEvent("Use battle Item action during combat.");
      this.emit();
      return;
    }
    const item = this.pickBestHealingItem();
    if (!item) {
      this.logEvent("No healing items left.");
      this.emit();
      return;
    }
    if (this.state.player.hp >= this.state.player.maxHp) {
      this.logEvent("HP is already full.");
      this.emit();
      return;
    }
    this.consumeHealingItemInField(item);
  }

  /** Use a healing consumable from inventory while exploring (not tied to hotbar layout). */
  useConsumableInField(item: ItemKey): void {
    if (this.state.battle.inBattle) {
      this.logEvent("During combat, use hotbar keys 1–9 / 0 or the battle panel.");
      this.emit();
      return;
    }
    if (this.state.player.items[item] <= 0) {
      this.logEvent(`You are out of ${ITEM_DATA[item].name}.`);
      this.emit();
      return;
    }
    if (this.state.player.hp >= this.state.player.maxHp) {
      this.logEvent("HP is already full.");
      this.emit();
      return;
    }
    this.consumeHealingItemInField(item);
  }

  /** Use the consumable bound to hotbar slot `slotIndex` (0 = key 1, … 8 = key 9, 9 = key 0) while exploring. */
  useHotbarSlotInField(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= HOTBAR_SIZE) return;
    const bar = normalizeItemHotbar(this.state.player.itemHotbar);
    this.state.player.itemHotbar = bar;
    const item = bar[slotIndex];
    if (!item) {
      this.logEvent("That hotbar slot is empty.");
      this.emit();
      return;
    }
    this.useConsumableInField(item);
  }

  /** Use the consumable on the hotbar during the player's battle turn. */
  useHotbarSlot(slotIndex: number): void {
    if (!this.canPlayerAct()) return;
    if (slotIndex < 0 || slotIndex >= HOTBAR_SIZE) return;
    const bar = normalizeItemHotbar(this.state.player.itemHotbar);
    this.state.player.itemHotbar = bar;
    const item = bar[slotIndex];
    if (!item) {
      this.logBattle("That hotbar slot is empty.");
      this.emit();
      return;
    }
    this.usePotion(item);
  }

  assignHotbarSlot(slotIndex: number, item: ItemKey | null): void {
    if (slotIndex < 0 || slotIndex >= HOTBAR_SIZE) return;
    const bar = normalizeItemHotbar(this.state.player.itemHotbar);
    bar[slotIndex] = item;
    this.state.player.itemHotbar = bar;
    this.emit();
  }

  /** Buy any shop-listed consumable (same rules as the classic potion purchases). */
  purchaseItem(item: ItemKey): void {
    this.buyItem(item);
  }

  /**
   * After the enemy's killing blow, the player stays at 0 HP until they click through
   * the knockout screen (LAN guests wait for the host).
   */
  acknowledgeKnockout(): void {
    if (!this.state.battle.inBattle || this.state.battle.phase !== "knockoutPending") {
      return;
    }
    this.state.player.hp = this.state.player.maxHp;
    this.state.battle.phase = "lost";
    this.onKnockoutRevival();
    this.endBattle();
  }

  attemptRun(): void {
    if (!this.canPlayerAct()) return;
    const success = Math.random() < 0.65;
    if (success) {
      this.logBattle("You escaped safely.");
      this.state.battle.phase = "escaped";
      this.endBattle();
      return;
    }
    this.logBattle("Couldn't escape!");
    this.state.battle.phase = "enemyTurn";
    this.emit();
    this.enemyTurn();
  }

  buyPotion(): void {
    this.buyItem("potion");
  }

  buyHiPotion(): void {
    this.buyItem("hiPotion");
  }

  buyMegaPotion(): void {
    this.buyItem("megaPotion");
  }

  /** One-time purchase of the Town Map — enables the compass overlay. */
  buyTownMap(): void {
    if (!this.state.world.canShop) {
      this.logEvent("Buy a Town Map from the general merchant.");
      this.emit();
      return;
    }
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    if (this.state.player.hasTownMap) {
      this.logEvent("You already own a Town Map.");
      this.emit();
      return;
    }
    if (this.state.player.gold < TOWN_MAP.price) {
      this.logEvent(`Not enough gold for ${TOWN_MAP.name}.`);
      this.emit();
      return;
    }
    this.state.player.gold -= TOWN_MAP.price;
    this.state.player.hasTownMap = true;
    this.state.player.townMapEquipped = false;
    this.logEvent(`Bought the ${TOWN_MAP.name}. Press Equip Map at the general merchant to show the compass in the wilds.`);
    this.emit();
  }

  /** Toggle the Town Map compass while you own the map (general merchant). */
  setTownMapEquipped(equipped: boolean): void {
    if (!this.state.world.canShop) {
      this.logEvent("Equip or stow your Town Map at the general merchant.");
      this.emit();
      return;
    }
    if (!this.state.player.hasTownMap) {
      this.logEvent("Buy a Town Map at the general merchant first.");
      this.emit();
      return;
    }
    if ((this.state.player.townMapEquipped ?? false) === equipped) return;
    this.state.player.townMapEquipped = equipped;
    this.logEvent(
      equipped ? "Town Map equipped — compass points toward town when you are away." : "Town Map stowed — compass hidden."
    );
    this.emit();
  }

  private buyItem(item: ItemKey): void {
    if (!this.state.world.canShop) {
      this.logEvent("Visit the general merchant to buy consumables.");
      this.emit();
      return;
    }
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    const price = ITEM_DATA[item].price;
    if (this.state.player.gold < price) {
      this.logEvent(`Not enough gold for ${ITEM_DATA[item].name}.`);
      this.emit();
      return;
    }
    this.state.player.gold -= price;
    this.state.player.items[item] += 1;
    this.logEvent(`Bought 1 ${ITEM_DATA[item].name}.`);
    this.emit();
  }

  buyIronSword(): void {
    this.buyWeapon("ironSword");
  }

  buySteelSword(): void {
    this.buyWeapon("steelSword");
  }

  buyMythrilBlade(): void {
    this.buyWeapon("mythrilBlade");
  }

  buyChainMail(): void {
    this.buyArmor("chainMail");
  }

  buyKnightArmor(): void {
    this.buyArmor("knightArmor");
  }

  buyDragonArmor(): void {
    this.buyArmor("dragonArmor");
  }

  /** Sell equipped weapon one tier down; gain 40% of the sold tier's list price (forge armory). */
  sellWeaponToShop(): void {
    if (this.state.battle.inBattle) {
      this.logEvent("You can't sell gear during a battle.");
      this.emit();
      return;
    }
    if (!this.state.world.canForge) {
      this.logEvent("Sell weapons at the forge armory.");
      this.emit();
      return;
    }
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    const w = this.state.player.weapon;
    const down = weaponSellDowngrade(w);
    if (!down) {
      this.logEvent("Nothing to sell — you're already on the guild-issue wood sword.");
      this.emit();
      return;
    }
    const sold = WEAPON_STATS[w];
    const refund = gearSellRefundGold(sold.price);
    this.state.player.weapon = down;
    this.state.player.gold += refund;
    if (down === "woodSword") {
      this.state.story.boughtBetterGear = false;
      this.evaluateStoryProgress();
    }
    this.logEvent(
      `Sold ${sold.name} for ${refund}g (${Math.round(GEAR_SELLBACK_FRACTION * 100)}% buyback). Equipped ${WEAPON_STATS[down].name}.`
    );
    this.emit();
  }

  /** Sell equipped armor one tier down; gain 40% of the sold tier's list price (forge armory). */
  sellArmorToShop(): void {
    if (this.state.battle.inBattle) {
      this.logEvent("You can't sell gear during a battle.");
      this.emit();
      return;
    }
    if (!this.state.world.canForge) {
      this.logEvent("Sell armor at the forge armory.");
      this.emit();
      return;
    }
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    const a = this.state.player.armor;
    const down = armorSellDowngrade(a);
    if (!down) {
      this.logEvent("Nothing to sell — you're already on guild-issue cloth armor.");
      this.emit();
      return;
    }
    const sold = ARMOR_STATS[a];
    const refund = gearSellRefundGold(sold.price);
    this.state.player.armor = down;
    this.state.player.gold += refund;
    this.logEvent(
      `Sold ${sold.name} for ${refund}g (${Math.round(GEAR_SELLBACK_FRACTION * 100)}% buyback). Equipped ${ARMOR_STATS[down].name}.`
    );
    this.emit();
  }

  private buyWeapon(weapon: WeaponKey): void {
    if (!this.state.world.canForge) {
      this.logEvent("Buy weapons at the forge armory.");
      this.emit();
      return;
    }
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    const target = WEAPON_STATS[weapon];
    const current = WEAPON_STATS[this.state.player.weapon];
    if (target.attackBonus <= current.attackBonus) {
      this.logEvent(`${target.name} is not an upgrade.`);
      this.emit();
      return;
    }
    if (this.state.player.gold < target.price) {
      this.logEvent(`Not enough gold for ${target.name}.`);
      this.emit();
      return;
    }
    this.state.player.gold -= target.price;
    this.state.player.weapon = weapon;
    this.logEvent(`Bought ${target.name}.`);
    // Story: any upgrade past the wooden sword satisfies Chapter 2.
    if (weapon !== "woodSword") {
      this.state.story.boughtBetterGear = true;
      this.evaluateStoryProgress();
    }
    this.emit();
  }

  private buyArmor(armor: ArmorKey): void {
    if (!this.state.world.canForge) {
      this.logEvent("Buy armor at the forge armory.");
      this.emit();
      return;
    }
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    const target = ARMOR_STATS[armor];
    const current = ARMOR_STATS[this.state.player.armor];
    if (target.defenseBonus <= current.defenseBonus) {
      this.logEvent(`${target.name} is not an upgrade.`);
      this.emit();
      return;
    }
    if (this.state.player.gold < target.price) {
      this.logEvent(`Not enough gold for ${target.name}.`);
      this.emit();
      return;
    }
    this.state.player.gold -= target.price;
    this.state.player.armor = armor;
    this.logEvent(`Bought ${target.name}.`);
    this.emit();
  }

  healAtInn(): void {
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    if (this.state.sleeping) return;
    const fee = 10;
    if (this.state.player.hp >= this.state.player.maxHp) {
      this.logEvent("HP is already full.");
      this.emit();
      return;
    }
    if (this.state.player.gold < fee) {
      this.logEvent("Not enough gold to rest.");
      this.emit();
      return;
    }
    this.state.player.gold -= fee;
    this.state.player.hp = this.state.player.maxHp;
    this.logEvent("You settle in and fall asleep at the inn...");
    this.state.sleeping = true;
    this.emit();
    // Advance the world clock to the next 07:00 and drop the sleep overlay
    // after a short splash. Roughly 2.5s of real time lets the player take
    // in the sunrise transition without feeling like a stall.
    window.setTimeout(() => {
      const now = this.state.world.worldTime ?? 0;
      const dayStart = Math.floor(now);
      const sevenAm = 7 / 24;
      // If it's already past 07:00 today, jump to 07:00 tomorrow so the
      // player always wakes *after* the current in-game moment.
      const frac = now - dayStart;
      const next = frac < sevenAm ? dayStart + sevenAm : dayStart + 1 + sevenAm;
      this.state.world.worldTime = next;
      this.state.sleeping = false;
      this.logEvent("You wake at dawn — 07:00.");
      // Re-run zone sync so time-of-day-driven NPC rotations refresh.
      const tx = Math.floor((this.state.player.x ?? 0) / TILE);
      const ty = Math.floor((this.state.player.y ?? 0) / TILE);
      syncZonesAtTile(tx, ty);
      this.emit();
    }, 2500);
  }

  private syncInnPatronRotation(): void {
    const b = innPatronRotationBucket(this.state.world.worldTime ?? 0);
    if ((this.state.player.npcPatronRotationBucket ?? -999999) !== b) {
      this.state.player.npcPatronRotationBucket = b;
      this.state.player.npcPatronsUsed = [];
    }
  }

  private currentTownIndexForPatrons(): 0 | 1 {
    const tx = Math.floor(this.state.player.x / TILE);
    const ty = Math.floor(this.state.player.y / TILE);
    const here = townAtTile(tx, ty);
    const towns = getTowns();
    if (!here || towns.length < 2) return 0;
    return towns[0]!.x === here.x && towns[0]!.y === here.y ? 0 : 1;
  }

  /**
   * Taproom patrons at the inn: bribe for contraband, intimidate for coin,
   * recruit a brawler (+2 ATK for several wild fights), or manipulate for safer roads.
   */
  interactInnPatron(slot: number, action: InnPatronAction): void {
    if (this.state.battle.inBattle) {
      this.logEvent("Patrons scatter when steel is drawn — finish the fight first.");
      this.emit();
      return;
    }
    if (!this.state.world.canHeal) {
      this.logEvent("Only the inn taproom hosts these hangers-on.");
      this.emit();
      return;
    }
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    if (slot < 0 || slot > 2) return;
    this.syncInnPatronRotation();
    const bucket = innPatronRotationBucket(this.state.world.worldTime ?? 0);
    const slotKey = String(slot);
    if ((this.state.player.npcPatronsUsed ?? []).includes(slotKey)) {
      this.logEvent("That patron has already had their fill of you tonight.");
      this.emit();
      return;
    }
    const townIx = this.currentTownIndexForPatrons();
    const patrons = innPatronsForTown(this.state.world.worldSeed ?? 0, townIx, bucket);
    const npc = patrons[slot];
    if (!npc) return;

    const mark = () => {
      const used = [...(this.state.player.npcPatronsUsed ?? [])];
      if (!used.includes(slotKey)) used.push(slotKey);
      this.state.player.npcPatronsUsed = used;
    };

    const BRIBE_ITEMS = (["potion", "berryTonic", "riverWater", "honeySalve"] as const) satisfies readonly ItemKey[];
    const pickBribeItem = (): ItemKey => BRIBE_ITEMS[Math.floor(Math.random() * BRIBE_ITEMS.length)]!;

    if (action === "bribe") {
      if (this.state.player.gold < npc.bribeGold) {
        this.logEvent(`They want ${npc.bribeGold}g to look the other way — you are short.`);
        this.emit();
        return;
      }
      this.state.player.gold -= npc.bribeGold;
      const item = pickBribeItem();
      this.state.player.items = mergeItemInventory({
        ...this.state.player.items,
        [item]: (this.state.player.items[item] ?? 0) + 1
      });
      this.logEvent(`${npc.name} slips you ${ITEM_DATA[item].name} for ${npc.bribeGold}g.`);
      mark();
      this.emit();
      return;
    }

    if (action === "intimidate") {
      const atk = playerAttackForIntimidate(this.state.player.attack, this.state.player.fightingClass);
      if (atk >= npc.intimidateAttackNeed) {
        const shake = 8 + Math.floor(Math.random() * 18);
        this.state.player.gold += shake;
        this.logEvent(
          `${npc.name} blanches — you palm ${shake}g from their belt before the taproom notices.`
        );
      } else {
        const fine = 6;
        this.state.player.gold = Math.max(0, this.state.player.gold - fine);
        this.logEvent(
          `${npc.name} calls your bluff. The innkeeper shoots you a look — you drop ${fine}g to calm the room.`
        );
      }
      mark();
      this.emit();
      return;
    }

    if (action === "recruit") {
      if (this.state.player.gold < npc.recruitGold) {
        this.logEvent(`${npc.name} wants ${npc.recruitGold}g up front for muscle.`);
        this.emit();
        return;
      }
      this.state.player.gold -= npc.recruitGold;
      const add = npc.recruitFights;
      const cap = 12;
      this.state.player.npcMercenaryBattlesLeft = Math.min(
        cap,
        (this.state.player.npcMercenaryBattlesLeft ?? 0) + add
      );
      this.logEvent(
        `${npc.name} rolls their shoulders. ${add} wild fights — they fight beside you (+2 ATK each).`
      );
      mark();
      this.emit();
      return;
    }

    // manipulate
    const cunning = playerCunningForNpc(
      this.state.player.level,
      this.state.player.defense,
      this.state.player.fightingClass
    );
    if (cunning >= npc.manipulateCunningNeed) {
      const grace = 12;
      this.state.world.encounterGraceSteps = Math.min(
        40,
        (this.state.world.encounterGraceSteps ?? 0) + grace
      );
      this.logEvent(
        `${npc.name} leans in and maps patrol gaps — ${grace} safer steps before the wilds notice you again.`
      );
    } else {
      this.logEvent(`${npc.name} smiles politely and changes the subject. Your read was off.`);
    }
    mark();
    this.emit();
  }

  /** Wilderness restore spring — full heal, no gold (works even under revival guild lock). */
  healAtRestoreSpring(): void {
    if (this.state.battle.inBattle) {
      this.logEvent("You can't use the spring during a battle.");
      this.emit();
      return;
    }
    if (!this.state.world.canRestoreSpring) {
      this.logEvent("Move onto the glowing spring to drink.");
      this.emit();
      return;
    }
    if (this.state.player.hp >= this.state.player.maxHp) {
      this.logEvent("The spring's water is cool and clear — you're already at full vigor.");
      this.emit();
      return;
    }
    this.state.player.hp = this.state.player.maxHp;
    this.logEvent("You cup the relic spring's water — warmth spreads through you. HP restored.");
    this.emit();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // UGC Studio (gated on voidTitansDefeated >= UGC_STUDIO_VOID_TITANS_REQUIRED at the UI layer)
  // ────────────────────────────────────────────────────────────────────────────

  createUgcMonster(draft: Parameters<typeof newUgcMonster>[0]): string {
    const monster = newUgcMonster(draft);
    this.state.ugc.monsters = [...this.state.ugc.monsters, monster];
    this.logEvent(`Designed new monster: ${monster.name}.`);
    this.emit();
    return monster.id;
  }

  updateUgcMonster(id: string, patch: Partial<UgcMonster>): void {
    this.state.ugc.monsters = this.state.ugc.monsters.map((m) =>
      m.id === id ? { ...m, ...patch } : m
    );
    this.emit();
  }

  deleteUgcMonster(id: string): void {
    const victim = this.state.ugc.monsters.find((m) => m.id === id);
    this.state.ugc.monsters = this.state.ugc.monsters.filter((m) => m.id !== id);
    if (victim) this.logEvent(`Deleted UGC monster "${victim.name}".`);
    this.emit();
  }

  createUgcWeapon(draft: Parameters<typeof newUgcWeapon>[0]): string {
    const weapon = newUgcWeapon(draft);
    this.state.ugc.weapons = [...this.state.ugc.weapons, weapon];
    this.logEvent(`Forged new weapon: ${weapon.name}.`);
    this.emit();
    return weapon.id;
  }

  updateUgcWeapon(id: string, patch: Partial<UgcWeapon>): void {
    this.state.ugc.weapons = this.state.ugc.weapons.map((w) =>
      w.id === id ? { ...w, ...patch } : w
    );
    this.emit();
  }

  deleteUgcWeapon(id: string): void {
    const victim = this.state.ugc.weapons.find((w) => w.id === id);
    this.state.ugc.weapons = this.state.ugc.weapons.filter((w) => w.id !== id);
    if (victim) this.logEvent(`Deleted UGC weapon "${victim.name}".`);
    this.emit();
  }

  createUgcArmor(draft: Parameters<typeof newUgcArmor>[0]): string {
    const armor = newUgcArmor(draft);
    this.state.ugc.armor = [...this.state.ugc.armor, armor];
    this.logEvent(`Designed new armor: ${armor.name}.`);
    this.emit();
    return armor.id;
  }

  updateUgcArmor(id: string, patch: Partial<UgcArmor>): void {
    this.state.ugc.armor = this.state.ugc.armor.map((a) =>
      a.id === id ? { ...a, ...patch } : a
    );
    this.emit();
  }

  deleteUgcArmor(id: string): void {
    const victim = this.state.ugc.armor.find((a) => a.id === id);
    this.state.ugc.armor = this.state.ugc.armor.filter((a) => a.id !== id);
    if (victim) this.logEvent(`Deleted UGC armor "${victim.name}".`);
    this.emit();
  }

  setUgcMonsterListing(id: string, listed: boolean, price?: number): void {
    this.state.ugc.monsters = this.state.ugc.monsters.map((m) =>
      m.id === id ? { ...m, listed, price: price ?? m.price } : m
    );
    this.logEvent(`Monster ${listed ? "listed" : "unlisted"} on marketplace.`);
    this.emit();
  }

  setUgcWeaponListing(id: string, listed: boolean, price?: number): void {
    this.state.ugc.weapons = this.state.ugc.weapons.map((w) =>
      w.id === id ? { ...w, listed, price: price ?? w.price } : w
    );
    this.logEvent(`Weapon ${listed ? "listed" : "unlisted"} on marketplace.`);
    this.emit();
  }

  setUgcArmorListing(id: string, listed: boolean, price?: number): void {
    this.state.ugc.armor = this.state.ugc.armor.map((a) =>
      a.id === id ? { ...a, listed, price: price ?? a.price } : a
    );
    this.logEvent(`Armor ${listed ? "listed" : "unlisted"} on marketplace.`);
    this.emit();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Save / load
  // ────────────────────────────────────────────────────────────────────────────

  async save(slot = "slot1"): Promise<void> {
    await this.saveRepository.save(slot, this.state);
    this.logEvent("Game saved.");
    this.emit(true);
  }

  async load(slot = "slot1"): Promise<boolean> {
    const loaded = await this.saveRepository.load(slot);
    if (!loaded) {
      this.logEvent("No save found.");
      this.emit();
      return false;
    }
    this.state = loaded as GameSnapshot;
    this.migrateLoadedGameSnapshot();
    this.logEvent("Save loaded.");
    this.emit(true);
    return true;
  }

  /**
   * Copies a single-line transfer bundle to the clipboard (`MS1|<10-digit-key>|<base64>`).
   * The full line is what you paste on another device; the 10-digit key is for your notes / verification.
   */
  async exportTransferCode(): Promise<boolean> {
    if (!this.state.player.hasCreatedCharacter) {
      this.logEvent("Create a character first, then export a transfer code.");
      this.emit();
      return false;
    }
    const key = generateTransferKey();
    try {
      const bundle = encodeTransferBundle(key, this.state);
      const ok = await copyToClipboard(bundle);
      if (ok) {
        this.logEvent(
          `Transfer line copied. 10-digit key: ${key} — on the other device, paste the full line (Import transfer). The key is only a memo; the line holds your save.`
        );
        this.emit();
        return true;
      }
      this.logEvent("Clipboard blocked — allow clipboard for this site and try again.");
      this.emit();
      return false;
    } catch {
      this.logEvent("Could not build transfer code.");
      this.emit();
      return false;
    }
  }

  /**
   * Restores from a transfer bundle pasted from another device, then writes the browser save slot.
   * @returns `{ ok: true }` or `{ ok: false, error }` (error is safe to show on the title screen).
   */
  async importTransferCode(
    raw: string,
    slot = "slot1"
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (this.state.battle.inBattle) {
      const error = "Finish the battle (or acknowledge a knockout) before importing a transfer.";
      this.logEvent(error);
      this.emit();
      return { ok: false, error };
    }
    const decoded = decodeTransferBundle(raw);
    if (!decoded) {
      const error = "Invalid transfer — paste the entire line from the other device (starts with MS1|).";
      this.logEvent(error);
      this.emit();
      return { ok: false, error };
    }
    this.state = decoded.snapshot;
    this.migrateLoadedGameSnapshot();
    await this.saveRepository.save(slot, this.state);
    this.logEvent(`Imported progress (transfer key ${decoded.key}). Saved to this browser.`);
    this.emit(true);
    return { ok: true };
  }

  /** Normalizes loaded or imported snapshots (shared by load + import transfer). */
  private migrateLoadedGameSnapshot(): void {
    const battleLoaded = this.state.battle as BattleState & {
      skillCooldowns?: Partial<Record<SkillKey, number>>;
    };
    let skillCd = 0;
    if (typeof battleLoaded.skillCooldown === "number" && Number.isFinite(battleLoaded.skillCooldown)) {
      skillCd = Math.max(0, Math.floor(battleLoaded.skillCooldown));
    } else if (battleLoaded.skillCooldowns && typeof battleLoaded.skillCooldowns === "object") {
      for (const k of SKILL_ORDER) {
        const v = battleLoaded.skillCooldowns[k];
        if (typeof v === "number" && Number.isFinite(v) && v > skillCd) {
          skillCd = Math.max(0, Math.floor(v));
        }
      }
    }
    delete battleLoaded.skillCooldowns;
    battleLoaded.skillCooldown = skillCd;
    if (typeof battleLoaded.itemAttackBonus !== "number" || !Number.isFinite(battleLoaded.itemAttackBonus)) {
      battleLoaded.itemAttackBonus = 0;
    } else {
      battleLoaded.itemAttackBonus = Math.max(0, Math.floor(battleLoaded.itemAttackBonus));
    }
    if (typeof battleLoaded.itemDefenseBonus !== "number" || !Number.isFinite(battleLoaded.itemDefenseBonus)) {
      battleLoaded.itemDefenseBonus = 0;
    } else {
      battleLoaded.itemDefenseBonus = Math.max(0, Math.floor(battleLoaded.itemDefenseBonus));
    }
    const st = battleLoaded.stance;
    battleLoaded.stance = BATTLE_STANCE_ORDER.includes(st as BattleStanceKind)
      ? (st as BattleStanceKind)
      : "balanced";
    battleLoaded.dodgeReady = battleLoaded.dodgeReady === true;
    const mit = battleLoaded.nextHitMitigation;
    if (typeof mit !== "number" || !Number.isFinite(mit)) {
      battleLoaded.nextHitMitigation = 0;
    } else {
      battleLoaded.nextHitMitigation = Math.min(0.55, Math.max(0, mit));
    }
    const vsUnknown = battleLoaded.victorySummary;
    if (
      vsUnknown &&
      typeof vsUnknown === "object" &&
      typeof (vsUnknown as BattleVictorySummary).xpGained === "number" &&
      typeof (vsUnknown as BattleVictorySummary).goldGained === "number"
    ) {
      const vs = vsUnknown as BattleVictorySummary;
      battleLoaded.victorySummary = {
        xpGained: Math.max(0, Math.floor(vs.xpGained)),
        goldGained: Math.max(0, Math.floor(vs.goldGained)),
        luckyGold: vs.luckyGold === true,
        itemDropName: typeof vs.itemDropName === "string" ? vs.itemDropName : null,
        levelsGained: Math.max(0, Math.floor(vs.levelsGained ?? 0)),
        petTamedName: typeof vs.petTamedName === "string" ? vs.petTamedName : null
      };
    } else {
      battleLoaded.victorySummary = null;
    }
    const cel = this.state.pendingLevelUpCelebration as Partial<LevelUpCelebrationPayload> | null;
    if (cel && typeof cel.newLevel === "number" && cel.newLevel > 0) {
      const nl = Math.floor(cel.newLevel);
      const lg =
        typeof cel.levelsGained === "number" && cel.levelsGained > 0
          ? Math.floor(cel.levelsGained)
          : 1;
      this.state.pendingLevelUpCelebration = {
        newLevel: nl,
        levelsGained: lg,
        maxHpGained:
          typeof cel.maxHpGained === "number" && cel.maxHpGained >= 0 ? Math.floor(cel.maxHpGained) : lg * 8,
        attackGained:
          typeof cel.attackGained === "number" && cel.attackGained >= 0 ? Math.floor(cel.attackGained) : lg * 2,
        defenseGained:
          typeof cel.defenseGained === "number" && cel.defenseGained >= 0 ? Math.floor(cel.defenseGained) : lg,
        speedGained: typeof cel.speedGained === "number" && cel.speedGained >= 0 ? Math.floor(cel.speedGained) : lg,
        skillPointsGained:
          typeof cel.skillPointsGained === "number" && cel.skillPointsGained >= 0
            ? Math.floor(cel.skillPointsGained)
            : undefined
      };
    } else {
      this.state.pendingLevelUpCelebration = null;
    }
    if (this.state.battle.enemy) {
      const e = this.state.battle.enemy as EnemyState & { element?: unknown };
      const ok = normalizeElementKind(e.element);
      e.element = ok ?? defaultElementForEnemyId(e.id);
    }
    if (!this.state.eventLog) {
      this.state.eventLog = ["Save loaded from old format."];
    }
    this.state.player.items = mergeItemInventory(this.state.player.items);
    this.state.player.itemHotbar = normalizeItemHotbar(
      this.state.player.itemHotbar ?? defaultItemHotbar()
    );
    if (this.state.player.monstersDefeated === undefined) {
      this.state.player.monstersDefeated = 0;
    }
    if (this.state.player.kingFavorsClaimed === undefined) {
      this.state.player.kingFavorsClaimed = 0;
    }
    if (this.state.player.kingAudienceTally === undefined) {
      this.state.player.kingAudienceTally = Math.max(0, Math.floor(this.state.player.monstersDefeated ?? 0));
    } else {
      this.state.player.kingAudienceTally = Math.max(0, Math.floor(this.state.player.kingAudienceTally));
    }
    if (this.state.player.kingAudienceTallyLastClaim === undefined) {
      this.state.player.kingAudienceTallyLastClaim = 0;
    } else {
      this.state.player.kingAudienceTallyLastClaim = Math.max(
        0,
        Math.floor(this.state.player.kingAudienceTallyLastClaim)
      );
    }
    if (this.state.player.kingAudienceTallyLastClaim > this.state.player.kingAudienceTally) {
      this.state.player.kingAudienceTallyLastClaim = this.state.player.kingAudienceTally;
    }
    this.state.player.fightingClass = normalizeFightingClass(this.state.player.fightingClass);
    if (Array.isArray(this.state.player.learnedSkills)) {
      const validSkill = new Set<SkillKey>(SKILL_ORDER);
      this.state.player.learnedSkills = this.state.player.learnedSkills.filter(
        (s): s is SkillKey => typeof s === "string" && validSkill.has(s as SkillKey)
      );
      if (!this.state.player.learnedSkills.includes("spark")) {
        this.state.player.learnedSkills.unshift("spark");
      }
    }
    if (!Array.isArray(this.state.player.learnedSkills) || this.state.player.learnedSkills.length === 0) {
      this.state.player.learnedSkills = getUnlockedSkills(this.state.player.level);
      if (this.state.player.learnedSkills.length === 0) {
        this.state.player.learnedSkills = ["spark"];
      }
    } else {
      this.state.player.learnedSkills = orderedLearnedSkills(this.state.player.learnedSkills);
    }
    if (typeof this.state.player.skillPoints !== "number" || !Number.isFinite(this.state.player.skillPoints)) {
      const lv = Math.max(1, Math.floor(this.state.player.level));
      const earned = Math.max(0, lv - 1) * skillPointsPerLevel(this.state.player.fightingClass);
      const spent = totalPointCostOnTree(this.state.player.learnedSkills);
      this.state.player.skillPoints = Math.max(0, earned - spent);
    } else {
      this.state.player.skillPoints = Math.max(0, Math.floor(this.state.player.skillPoints));
    }
    if (this.state.player.bountyTier === undefined) {
      this.state.player.bountyTier = 1;
    }
    if (this.state.player.bossDefeated === undefined) {
      this.state.player.bossDefeated = false;
    }
    if (this.state.player.armor === undefined) {
      this.state.player.armor = "clothArmor";
    }
    if (!this.state.player.appearance) {
      this.state.player.appearance = defaultAppearance();
    } else {
      this.state.player.appearance.hairStyle = normalizeHairStyle(this.state.player.appearance.hairStyle);
      this.state.player.appearance.facialHair = normalizeFacialHair(this.state.player.appearance.facialHair);
      if (
        this.state.player.appearance.beardColor === undefined ||
        this.state.player.appearance.beardColor === ""
      ) {
        this.state.player.appearance.beardColor = this.state.player.appearance.hair ?? "#6b4b2a";
      }
    }
    if (this.state.player.hasCreatedCharacter === undefined) {
      this.state.player.hasCreatedCharacter = true;
    }
    if (this.state.player.hasTownMap === undefined) {
      this.state.player.hasTownMap = false;
    }
    if (this.state.player.townMapEquipped === undefined) {
      this.state.player.townMapEquipped = this.state.player.hasTownMap;
    }
    if (!Array.isArray(this.state.player.pets)) {
      this.state.player.pets = [];
    }
    if (this.state.player.activePetId === undefined) {
      this.state.player.activePetId = null;
    }
    // Drop a stale activePetId reference if the pet was removed in older save.
    if (
      this.state.player.activePetId &&
      !this.state.player.pets.some((p) => p.id === this.state.player.activePetId)
    ) {
      this.state.player.activePetId = null;
    }
    if (
      typeof this.state.player.revivalDebtMonstersRemaining !== "number" ||
      !Number.isFinite(this.state.player.revivalDebtMonstersRemaining)
    ) {
      this.state.player.revivalDebtMonstersRemaining = 0;
    } else {
      this.state.player.revivalDebtMonstersRemaining = Math.max(
        0,
        Math.floor(this.state.player.revivalDebtMonstersRemaining)
      );
    }
    if (typeof this.state.player.npcMercenaryBattlesLeft !== "number" || !Number.isFinite(this.state.player.npcMercenaryBattlesLeft)) {
      this.state.player.npcMercenaryBattlesLeft = 0;
    } else {
      this.state.player.npcMercenaryBattlesLeft = Math.max(0, Math.floor(this.state.player.npcMercenaryBattlesLeft));
    }
    if (typeof this.state.player.npcPatronRotationBucket !== "number" || !Number.isFinite(this.state.player.npcPatronRotationBucket)) {
      this.state.player.npcPatronRotationBucket = -1;
    }
    if (!Array.isArray(this.state.player.npcPatronsUsed)) {
      this.state.player.npcPatronsUsed = [];
    }
    if (!Array.isArray(this.state.player.horsesOwned)) {
      this.state.player.horsesOwned = [];
    } else {
      const valid = new Set<HorseKey>(STABLE_HORSE_ORDER);
      const seen = new Set<HorseKey>();
      const dedup: HorseKey[] = [];
      for (const k of this.state.player.horsesOwned) {
        if (typeof k === "string" && valid.has(k as HorseKey) && !seen.has(k as HorseKey)) {
          seen.add(k as HorseKey);
          dedup.push(k as HorseKey);
          if (dedup.length >= 5) break;
        }
      }
      this.state.player.horsesOwned = dedup;
    }
    if (this.state.player.petStableTraining === undefined) {
      this.state.player.petStableTraining = null;
    } else if (
      this.state.player.petStableTraining &&
      (typeof this.state.player.petStableTraining.petId !== "string" ||
        typeof this.state.player.petStableTraining.readyAt !== "number" ||
        !Number.isFinite(this.state.player.petStableTraining.readyAt))
    ) {
      this.state.player.petStableTraining = null;
    } else if (
      this.state.player.petStableTraining &&
      !this.state.player.pets.some((p) => p.id === this.state.player.petStableTraining!.petId)
    ) {
      this.state.player.petStableTraining = null;
    }
    if (this.state.world.canPetShop === undefined) {
      this.state.world.canPetShop = false;
    }
    if (this.state.world.canTrain === undefined) {
      this.state.world.canTrain = false;
    }
    if (this.state.world.canGuild === undefined) {
      this.state.world.canGuild = false;
    }
    if (this.state.world.canBoss === undefined) {
      this.state.world.canBoss = false;
    }
    if (this.state.world.canLibrary === undefined) {
      this.state.world.canLibrary = false;
    }
    if (this.state.world.canForge === undefined) {
      this.state.world.canForge = false;
    }
    if (this.state.world.canChapel === undefined) {
      this.state.world.canChapel = false;
    }
    if (this.state.world.canStables === undefined) {
      this.state.world.canStables = false;
    }
    if (this.state.world.canMarket === undefined) {
      this.state.world.canMarket = false;
    }
    if (this.state.world.canVoidPortal === undefined) {
      this.state.world.canVoidPortal = false;
    }
    if (this.state.world.canRestoreSpring === undefined) {
      this.state.world.canRestoreSpring = false;
    }
    if (this.state.world.canReturnPortal === undefined) {
      this.state.world.canReturnPortal = false;
    }
    if (this.state.world.canDungeon === undefined) {
      this.state.world.canDungeon = false;
    }
    if (this.state.world.canEnterThroneHall === undefined) {
      this.state.world.canEnterThroneHall = false;
    }
    if (this.state.world.canThrone === undefined) {
      this.state.world.canThrone = false;
    }
    if (this.state.world.canLeaveDungeon === undefined) {
      this.state.world.canLeaveDungeon = false;
    }
    if (this.state.world.inDungeon === undefined) {
      this.state.world.inDungeon = false;
    this.updateMusic();
    }
    if (this.state.world.dungeon === undefined) {
      this.state.world.dungeon = null;
    }
    if (typeof this.state.world.overworldReturnX !== "number") {
      this.state.world.overworldReturnX = 0;
    }
    if (typeof this.state.world.overworldReturnY !== "number") {
      this.state.world.overworldReturnY = 0;
    }
    // If a save has the player mid-dungeon but the dungeon object is malformed,
    // pop them out to the overworld return point so they aren't stuck.
    if (this.state.world.inDungeon && !this.state.world.dungeon) {
      this.state.world.inDungeon = false;
    this.updateMusic();
      this.state.world.canLeaveDungeon = false;
      this.state.player.x = this.state.world.overworldReturnX;
      this.state.player.y = this.state.world.overworldReturnY;
    }
    const rawDg = this.state.world.dungeon;
    if (
      rawDg &&
      typeof rawDg === "object" &&
      "tiles" in rawDg &&
      !("floors" in rawDg) &&
      Array.isArray((rawDg as { tiles: unknown }).tiles)
    ) {
      const legacy = rawDg as {
        seed: number;
        width: number;
        height: number;
        tiles: number[];
        entryTx: number;
        entryTy: number;
        chests: { id: string; tx: number; ty: number; opened: boolean; lootItem: ItemKey; lootGold: number }[];
        roamers: { id: string; enemyId: string; tx: number; ty: number }[];
      };
      this.state.world.dungeon = {
        seed: legacy.seed ?? 0,
        depth: 1,
        levelIndex: 0,
        floors: [
          {
            width: legacy.width,
            height: legacy.height,
            tiles: legacy.tiles,
            entryTx: legacy.entryTx,
            entryTy: legacy.entryTy,
            chests: legacy.chests ?? [],
            roamers: legacy.roamers ?? []
          }
        ],
        kind: "dungeon"
      };
    }
    const dgHydrated = this.state.world.dungeon;
    if (dgHydrated && dgHydrated.kind === undefined) {
      dgHydrated.kind = "dungeon";
    }
    if (this.state.world.voidPortalActive === undefined) {
      this.state.world.voidPortalActive = false;
    }
    if (typeof this.state.world.realmTier !== "number" || !Number.isFinite(this.state.world.realmTier)) {
      this.state.world.realmTier = 1;
    } else {
      this.state.world.realmTier = Math.max(1, Math.floor(this.state.world.realmTier));
    }
    if (
      typeof this.state.player.voidTitansDefeated !== "number" ||
      !Number.isFinite(this.state.player.voidTitansDefeated)
    ) {
      const rt = this.state.world.realmTier;
      const bd = this.state.player.bossDefeated ? 1 : 0;
      this.state.player.voidTitansDefeated = Math.max(0, rt - 1 + bd);
    } else {
      this.state.player.voidTitansDefeated = Math.max(0, Math.floor(this.state.player.voidTitansDefeated));
    }
    if (this.state.world.encounterGraceSteps === undefined) {
      this.state.world.encounterGraceSteps = 0;
    }
    if (typeof this.state.world.worldTime !== "number" || !Number.isFinite(this.state.world.worldTime)) {
      this.state.world.worldTime = 0.28;
    }
    if (!Array.isArray(this.state.world.roamingMonsters)) {
      this.state.world.roamingMonsters = [];
    }
    if (!Array.isArray(this.state.world.resourceNodes)) {
      this.state.world.resourceNodes = [];
    }
    // Backfill / sanitize the resource bag so older saves load cleanly.
    const priorBag = (this.state.player.resources ?? {}) as Record<string, unknown>;
    const mergedBag = emptyResourceBag();
    for (const key of RESOURCE_KEYS) {
      const n = priorBag[key];
      if (typeof n === "number" && Number.isFinite(n) && n > 0) {
        mergedBag[key] = Math.floor(n);
      }
    }
    this.state.player.resources = mergedBag;
    if (!this.state.ugc) {
      this.state.ugc = initialUgc();
    }

    // Story migration: if the save predates the storyline, reconstruct a sensible
    // starting point from existing progress so veteran players aren't thrown
    // back to the prologue.
    if (!this.state.story) {
      this.state.story = initialStory();
      const s = this.state.story;
      const p = this.state.player;
      s.prologueSeen = true;
      s.monstersSlain = p.monstersDefeated;
      s.boughtBetterGear = p.weapon !== "woodSword";
      if (p.bossDefeated) {
        s.stage = "epilogue";
      } else {
        // Advance as far as known state already satisfies.
        const chain: StoryStage[] = [
          "ch1_firstHunts",
          "ch2_gearUp",
          "ch3_wanderer",
          "ch4_whispers",
          "ch5_trials",
          "ch6_titanAwaits"
        ];
        s.stage = "ch1_firstHunts";
        for (const stage of chain) {
          s.stage = stage;
          if (stage === "ch1_firstHunts" && s.monstersSlain < STORY_CH1_MONSTERS_TO_SLAY) break;
          if (stage === "ch2_gearUp" && !s.boughtBetterGear) break;
          if (stage === "ch3_wanderer") break; // need biomes visited — start this fresh
          if (stage === "ch4_whispers" && p.level < STORY_CH4_LEVEL_REQUIRED) break;
          if (stage === "ch5_trials") break; // need species list — start fresh
        }
      }
    } else {
      // Fill in new fields that may be missing on older story saves.
      this.state.story.pendingChapterToast ??= null;
      this.state.story.biomesVisited ??= [];
      this.state.story.uniqueSpeciesDefeated ??= [];
      this.state.story.completed ??= [];
      this.state.story.reachedBossArena ??= false;
    }

    // Restore the procedural world. If the save predates procedural worlds, roll a new seed
    // and plunk the player onto the new spawn so they don't get stranded in water/forest.
    const savedSeed = this.state.world.worldSeed;
    if (typeof savedSeed === "number" && savedSeed !== 0) {
      regenerateWorld(savedSeed, this.state.world.realmTier);
    } else {
      regenerateWorld(randomSeed(), this.state.world.realmTier);
      const spawn = getSpawnPixel();
      this.state.player.x = spawn.x;
      this.state.player.y = spawn.y;
      this.logEvent("Save predates procedural worlds — generated a fresh land.");
    }
    this.state.world.worldSeed = activeWorldSeed;
    this.state.world.worldVersion = activeWorldVersion;
    this.state.world.realmTier = Math.max(1, Math.floor(activeWorldRealmTier));
    if (this.state.world.voidPortalActive && this.state.player.bossDefeated) {
      swapBossTileForVoidPortal();
      this.state.world.worldVersion = activeWorldVersion;
    }

    this.refreshRoamingMonsters();

    if (typeof this.state.hasUnsavedChanges !== "boolean") {
      this.state.hasUnsavedChanges = true;
    }
  }

  private playerAttackPower(): number {
    const w = WEAPON_STATS[this.state.player.weapon].attackBonus;
    const pet = petAttackBuffForParty(this.state.player.activePetId, this.state.player.pets);
    const itemAtk = this.state.battle.inBattle ? (this.state.battle.itemAttackBonus ?? 0) : 0;
    const merc =
      this.state.battle.inBattle && (this.state.player.npcMercenaryBattlesLeft ?? 0) > 0 ? 2 : 0;
    return this.state.player.attack + w + pet + itemAtk + merc;
  }

  private playerDefensePower(): number {
    const itemDef = this.state.battle.inBattle ? (this.state.battle.itemDefenseBonus ?? 0) : 0;
    return this.state.player.defense + ARMOR_STATS[this.state.player.armor].defenseBonus + itemDef;
  }

  private playerSpeed(): number {
    return this.state.player.speed;
  }

  private afterPlayerAction(): void {
    const enemy = this.state.battle.enemy;
    if (!enemy) return;
    if (enemy.hp <= 0) {
      this.state.battle.phase = "victoryPending";
      this.logBattle(`${enemy.name} defeated!`);
      playSfx("victory");
      this.applyRewards(enemy);
      this.scheduleVictoryBattleExit();
      this.emit();
      return;
    }
    this.state.battle.phase = "enemyTurn";
    this.emit();
    this.enemyTurn();
  }

  /** Pass turn without attacking (Dodge / Brace). */
  private finishPlayerTurnWithoutOffense(): void {
    const enemy = this.state.battle.enemy;
    if (!enemy) return;
    if (enemy.hp <= 0) {
      this.state.battle.phase = "won";
      this.logBattle(`${enemy.name} defeated!`);
      this.applyRewards(enemy);
      this.endBattle();
      return;
    }
    this.state.battle.phase = "enemyTurn";
    this.emit();
    this.enemyTurn();
  }

  private computeDodgeChance(enemy: EnemyState): number {
    const st = this.state.battle.stance;
    let p = 0.16 + (this.playerSpeed() - enemy.speed) * 0.028;
    if (st === "stealth") p += 0.09;
    if (st === "power") p -= 0.06;
    if (st === "fortune") p += 0.04;
    if (st === "balanced") p += 0.02;
    return Math.min(0.52, Math.max(0.08, p));
  }

  /**
   * If the enemy is oiled and the incoming attack is fire-element, returns a
   * 1.4× multiplier + log tag. Oil ticks down in {@link resumePlayerPhaseAfterEnemy}
   * so calling this helper does NOT decrement — it only reads.
   */
  private consumeEnemyOilMult(element: ElementKind): { mult: number; suffix: string } {
    const enemy = this.state.battle.enemy;
    if (!enemy || (enemy.oiled ?? 0) <= 0 || element !== "fire") {
      return { mult: 1, suffix: "" };
    }
    return { mult: 1.4, suffix: " Oil ignites!" };
  }

  /**
   * If the enemy is marked, forces the offensive strike to crit for at least
   * 1.5× and clears the mark. Otherwise returns the natural crit roll untouched.
   */
  private consumeEnemyMarkCrit(natural: { mult: number; suffix: string }): {
    mult: number;
    suffix: string;
  } {
    const enemy = this.state.battle.enemy;
    if (!enemy || !enemy.marked) return natural;
    enemy.marked = false;
    return { mult: Math.max(1.5, natural.mult), suffix: " Marked crit!" };
  }

  /**
   * Rolls the positional damage bonus for the current player offense and
   * consumes one-shot edges (ambush). Returns `mult` of 1 when there's no edge.
   *
   * High-ground persists for the whole fight; ambush fires once then clears.
   */
  private consumePositionalMultiplier(): { mult: number; suffix: string } {
    const pos = this.state.battle.positional;
    if (!pos) return { mult: 1, suffix: "" };
    let mult = 1;
    const tags: string[] = [];
    if (pos.ambush) {
      mult *= 1.2;
      tags.push("Ambush!");
      pos.ambush = false;
    }
    if (pos.highGround) {
      mult *= 1.15;
      tags.push("High ground!");
    }
    return { mult, suffix: tags.length ? ` ${tags.join(" ")}` : "" };
  }

  private rollPlayerCrit(): { mult: number; suffix: string } {
    const st = this.state.battle.stance;
    let p = 0.11;
    if (st === "fortune") p += 0.055;
    if (st === "power") p += 0.035;
    if (st === "stealth") p -= 0.025;
    p = Math.min(0.3, Math.max(0.055, p));
    if (Math.random() < p) {
      return { mult: 1.34, suffix: " Critical!" };
    }
    return { mult: 1, suffix: "" };
  }

  private resumePlayerPhaseAfterEnemy(): void {
    if ((this.state.battle.skillCooldown ?? 0) > 0) {
      this.state.battle.skillCooldown -= 1;
    }
    const enemy = this.state.battle.enemy;
    if (enemy && (enemy.oiled ?? 0) > 0) {
      enemy.oiled = (enemy.oiled ?? 0) - 1;
      if ((enemy.oiled ?? 0) <= 0) {
        this.logBattle("The oil coating burns away.");
      }
    }
    const stun = this.state.battle.stunTurns ?? 0;
    if (stun > 0 && this.state.battle.inBattle && this.state.battle.enemy && this.state.battle.enemy.hp > 0) {
      this.state.battle.stunTurns = stun - 1;
      const enemyName = this.state.battle.enemy.name;
      this.logBattle(`You're still recovering — ${enemyName} swings again!`);
      this.state.battle.phase = "enemyTurn";
      this.emit();
      this.enemyTurn();
      return;
    }
    this.state.battle.phase = "playerTurn";
    this.emit();
  }

  private enemyTurn(): void {
    if (!this.state.battle.inBattle || !this.state.battle.enemy) return;
    const enemy = this.state.battle.enemy;
    const sm = battleStanceModifiers(this.state.battle.stance);
    const isBoss = isRealmBossEnemyId(enemy.id);

    if (this.state.battle.dodgeReady) {
      this.state.battle.dodgeReady = false;
      const dodgeP = this.computeDodgeChance(enemy);
      if (Math.random() < dodgeP) {
        this.logBattle(`You dodge ${enemy.name}'s strike!`);
        this.resumePlayerPhaseAfterEnemy();
        return;
      }
    }

    let rawHit = Math.max(1, enemy.attack - this.playerDefensePower() + this.randomVariance());
    let heavy = false;
    if (!isBoss && Math.random() < 0.13) {
      heavy = true;
      rawHit = Math.max(1, Math.round(rawHit * 1.28));
    }
    let damage = Math.max(1, Math.round(rawHit * sm.incomingDamageMult));
    const mit = Math.min(0.55, Math.max(0, this.state.battle.nextHitMitigation ?? 0));
    this.state.battle.nextHitMitigation = 0;
    damage = Math.max(1, Math.round(damage * (1 - mit)));

    this.state.player.hp = Math.max(0, this.state.player.hp - damage);
    const bits: string[] = [];
    if (heavy) bits.push("Heavy swing!");
    if (mit > 0) bits.push("Brace absorbed part of it.");
    const extra = bits.length ? ` ${bits.join(" ")}` : "";
    this.logBattle(`${enemy.name} hits you for ${damage} damage.${extra}`);
    this.state.battle.lastEnemyHitAt = nowMs();
    playSfx("hit");
    if (this.state.player.hp <= 0) {
      this.state.battle.phase = "knockoutPending";
      this.logBattle("You were knocked out.");
      playSfx("defeat");
      this.emit();
      return;
    }
    this.resumePlayerPhaseAfterEnemy();
  }

  private applyRewards(enemy: EnemyState): void {
    const levelBeforeRewards = this.state.player.level;
    const stanceMods = battleStanceModifiers(this.state.battle.stance);
    const isBoss = isRealmBossEnemyId(enemy.id);
    const rewardGoldMult = isBoss ? 1 : stanceMods.goldRewardMult;
    const rewardXpMult = isBoss ? 1 : stanceMods.xpRewardMult;
    // Gold variance: every drop rolls within ±25% of the base reward, with a
    // 10% chance for a "lucky" 2x payout. Bosses always drop their exact gold
    // so flavor text and chapter rewards stay predictable.
    const base = enemy.goldReward;
    let goldGained = base;
    let luckyDrop = false;
    if (!isBoss && base > 0) {
      const variance = 1 + (Math.random() * 0.5 - 0.25); // 0.75 .. 1.25
      goldGained = Math.max(1, Math.round(base * variance));
      if (Math.random() < 0.1) {
        luckyDrop = true;
        goldGained *= 2;
      }
      goldGained = Math.max(1, Math.round(goldGained * rewardGoldMult));
      goldGained = Math.max(1, Math.round(goldGained * battleGoldClassMultiplier(this.state.player.fightingClass)));
    }
    const xpGained = Math.round(enemy.xpReward * rewardXpMult);
    this.state.player.gold += goldGained;
    this.state.player.xp += xpGained;
    this.state.player.monstersDefeated += 1;
    this.state.player.kingAudienceTally = (this.state.player.kingAudienceTally ?? 0) + 1;
    if (!isBoss && (this.state.player.npcMercenaryBattlesLeft ?? 0) > 0) {
      this.state.player.npcMercenaryBattlesLeft = Math.max(
        0,
        (this.state.player.npcMercenaryBattlesLeft ?? 0) - 1
      );
      this.logBattle("Your hired blade keeps pace — one fight struck from their contract.");
    }

    const debtBefore = this.state.player.revivalDebtMonstersRemaining ?? 0;
    if (debtBefore > 0) {
      this.state.player.revivalDebtMonstersRemaining = debtBefore - 1;
      if (this.state.player.revivalDebtMonstersRemaining === 0) {
        this.logEvent("Revival tithe settled — town shops, rest, pets, training, and guild contracts are yours again.");
      } else {
        this.logBattle(
          `Tithe: ${this.state.player.revivalDebtMonstersRemaining} more win${this.state.player.revivalDebtMonstersRemaining === 1 ? "" : "s"} before the Guild lifts its lock.`
        );
      }
    }

    const fortuneNote =
      !isBoss && stanceMods.label === "Fortune" && (rewardXpMult > 1 || rewardGoldMult > 1)
        ? " Fortune stance boosted rewards."
        : "";
    if (luckyDrop) {
      this.logBattle(`Lucky drop! Gained ${xpGained} XP and ${goldGained} gold.${fortuneNote}`);
    } else {
      this.logBattle(`Gained ${xpGained} XP and ${goldGained} gold.${fortuneNote}`);
    }

    const itemDrop = rollMonsterConsumableDrop(enemy);
    if (itemDrop) {
      this.state.player.items[itemDrop] += 1;
      this.logBattle(`${enemy.name} dropped ${ITEM_DATA[itemDrop].name}!`);
    }

    // Taming: a defeated monster may decide to follow the player. Chance is
    // slightly higher the earlier the player is (helps new players build a
    // stable of companions), capped at a modest rate.
    const petTamedName = this.maybeTame(enemy);

    // Story: track slain count and unique species.
    const story = this.state.story;
    story.monstersSlain += 1;
    if (!isRealmBossEnemyId(enemy.id) && !story.uniqueSpeciesDefeated.includes(enemy.id)) {
      story.uniqueSpeciesDefeated.push(enemy.id);
    }

    if (isRealmBossEnemyId(enemy.id)) {
      this.state.player.voidTitansDefeated = Math.max(0, Math.floor(this.state.player.voidTitansDefeated ?? 0)) + 1;
      this.state.player.bossDefeated = true;
      this.state.world.voidPortalActive = true;
      swapBossTileForVoidPortal();
      this.state.world.worldSeed = activeWorldSeed;
      this.state.world.worldVersion = activeWorldVersion;
      const titans = this.state.player.voidTitansDefeated;
      if (titans === 1) {
        this.logEvent(
          `${enemy.name} falls! Reset Game unlocks from the journal strip. A rift opens on the arena — cross into a deadlier realm and defeat the next guardian to open UGC Studio.`
        );
      } else if (titans === UGC_STUDIO_VOID_TITANS_REQUIRED) {
        this.logEvent(
          `${enemy.name} falls! UGC Studio unlocks — design monsters, weapons, and armor for the marketplace. A new rift opens on the arena tile.`
        );
      } else {
        this.logEvent(`${enemy.name} falls! A rift opens on the arena tile — step through for a new realm.`);
      }
      // Force-advance the storyline to the epilogue regardless of which chapter
      // the player is on — anyone who rushes the boss still gets the outro.
      story.reachedBossArena = true;
      // Cap the chain to guard against a misconfigured STORY_CHAPTERS map.
      let safety = 16;
      while (this.state.story.stage !== "epilogue" && safety-- > 0) {
        const next = STORY_CHAPTERS[this.state.story.stage].next;
        if (!next) break;
        this.completeCurrentChapter();
      }
      const tx = Math.floor(this.state.player.x / TILE);
      const ty = Math.floor(this.state.player.y / TILE);
      syncZonesAtTile(tx, ty);
    }

    this.resolveLevelUps();
    this.evaluateStoryProgress();

    const summary: BattleVictorySummary = {
      xpGained,
      goldGained,
      luckyGold: luckyDrop,
      itemDropName: itemDrop ? ITEM_DATA[itemDrop].name : null,
      levelsGained: Math.max(0, this.state.player.level - levelBeforeRewards),
      petTamedName
    };
    this.state.battle.victorySummary = summary;
  }

  private resolveLevelUps(): void {
    const levelStart = this.state.player.level;
    let skillPointsBatch = 0;
    while (this.state.player.xp >= this.state.player.xpToNext) {
      this.state.player.xp -= this.state.player.xpToNext;
      this.state.player.level += 1;
      this.state.player.xpToNext = Math.floor(this.state.player.xpToNext * 1.35);
      this.state.player.maxHp += 8;
      this.state.player.attack += 2;
      this.state.player.defense += 1;
      this.state.player.speed += 1;
      const spp = skillPointsPerLevel(this.state.player.fightingClass);
      this.state.player.skillPoints = (this.state.player.skillPoints ?? 0) + spp;
      skillPointsBatch += spp;
      this.logEvent(`Level up! You are now level ${this.state.player.level}. +${spp} skill point${spp === 1 ? "" : "s"} — spend them in Skills.`);
    }
    if (this.state.player.level > levelStart) {
      // Chapter 4 ("Whispers of the Titan") is the only stage gated on
      // player level, so re-evaluate here. `evaluateStoryProgress` is
      // idempotent and no-ops on prologue/epilogue, so it's safe to call
      // on every real level-up.
      this.evaluateStoryProgress();
      const n = this.state.player.level - levelStart;
      this.state.pendingLevelUpCelebration = {
        newLevel: this.state.player.level,
        levelsGained: n,
        maxHpGained: n * 8,
        attackGained: n * 2,
        defenseGained: n,
        speedGained: n,
        skillPointsGained: skillPointsBatch
      };
      playSfx("levelUp");
    }
  }

  private currentBountyTarget(): number {
    return 4 + this.state.player.bountyTier * 2;
  }

  private trainStat(stat: "attack" | "defense" | "speed"): void {
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    const fee = 20 + this.state.player.level * 6;
    if (this.state.player.gold < fee) {
      this.logEvent(`Training costs ${fee}g.`);
      this.emit();
      return;
    }
    this.state.player.gold -= fee;
    this.state.player[stat] += 1;
    this.logEvent(`Training complete: +1 ${stat} for ${fee}g.`);
    this.emit();
  }

  private revivalDebtActive(): boolean {
    return (this.state.player.revivalDebtMonstersRemaining ?? 0) > 0;
  }

  private revivalDebtBlockMessage(): string {
    const n = this.state.player.revivalDebtMonstersRemaining ?? 0;
    return `The Guild seizes town privileges until you settle your revival tithe: ${n} more monster${n === 1 ? "" : "s"} to slay in the wilds.`;
  }

  /** Knockout: lose all gold and equipped shop gear (reset to starter sword & cloth), warp to nearest town. */
  private onKnockoutRevival(): void {
    const goldLost = this.state.player.gold;
    const hadWeapon = this.state.player.weapon;
    const hadArmor = this.state.player.armor;
    const lostGear = hadWeapon !== "woodSword" || hadArmor !== "clothArmor";

    this.state.player.gold = 0;
    this.state.player.weapon = "woodSword";
    this.state.player.armor = "clothArmor";
    this.state.story.boughtBetterGear = false;

    const tx = Math.floor(this.state.player.x / TILE);
    const ty = Math.floor(this.state.player.y / TILE);
    const town = nearestTown(tx, ty);
    if (town) {
      this.state.player.x = town.x * TILE + TILE / 2;
      this.state.player.y = town.y * TILE + TILE / 2;
    } else {
      const s = getSpawnPixel();
      this.state.player.x = s.x;
      this.state.player.y = s.y;
    }
    const ntx = Math.floor(this.state.player.x / TILE);
    const nty = Math.floor(this.state.player.y / TILE);
    syncZonesAtTile(ntx, nty);

    const parts: string[] = [
      `The Guild hauls you to the nearest village. Your purse is emptied (${goldLost}g seized).`
    ];
    if (lostGear) {
      parts.push(
        `Your arms are stripped — ${WEAPON_STATS[hadWeapon].name} and ${ARMOR_STATS[hadArmor].name} are gone.`
      );
    }
    this.logBattle(parts.join(" "));
    this.logEvent("Knockout: all gold lost; weapon and armor reset to guild-issued gear.");
  }

  private clearVictoryExitTimer(): void {
    if (this.victoryExitTimer !== null) {
      clearTimeout(this.victoryExitTimer);
      this.victoryExitTimer = null;
    }
  }

  /** Close the battle overlay after {@link VICTORY_BATTLE_LINGER_MS} so reward lines stay visible. */
  private scheduleVictoryBattleExit(): void {
    this.clearVictoryExitTimer();
    this.victoryExitTimer = setTimeout(() => {
      this.victoryExitTimer = null;
      if (!this.state.battle.inBattle || this.state.battle.phase !== "victoryPending") return;
      this.endBattle();
    }, VICTORY_BATTLE_LINGER_MS);
  }

  private endBattle(): void {
    this.clearVictoryExitTimer();
    this.state.battle.inBattle = false;
    this.updateMusic();
    this.state.battle.enemy = null;
    this.state.battle.itemAttackBonus = 0;
    this.state.battle.itemDefenseBonus = 0;
    // Intentionally do NOT reset stance — the player's chosen fighting style
    // carries over to the next encounter. {@link startEncounter} reads this value.
    this.state.battle.dodgeReady = false;
    this.state.battle.nextHitMitigation = 0;
    this.state.battle.victorySummary = null;
    this.state.world.encounterGraceSteps = POST_ENCOUNTER_GRACE_STEPS;
    this.emit();
  }

  private randomVariance(): number {
    return Math.floor(Math.random() * 3) - 1;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Pets
  // ────────────────────────────────────────────────────────────────────────────

  /** Active pet lookup (null if no slot selected or invalid id). */
  private getActivePet(): Pet | null {
    const id = this.state.player.activePetId;
    if (!id) return null;
    return this.state.player.pets.find((p) => p.id === id) ?? null;
  }

  /** Pet strikes a follow-up on the player's basic attack when engaged. */
  private maybePetFollowUp(enemy: EnemyState): void {
    if (enemy.hp <= 0) return;
    const pet = this.getActivePet();
    if (!pet) return;
    // Extra chip after your swing — main attack already includes up to +10 from {@link petAttackBuffForParty}.
    const sm = battleStanceModifiers(this.state.battle.stance);
    const atkEl = WEAPON_STATS[this.state.player.weapon].element;
    const raw = Math.max(1, 2 + Math.floor(pet.level / 2) + this.randomVariance());
    const mult = elementDamageMultiplier(atkEl, enemy.element);
    const dmg = Math.max(1, Math.round(raw * mult * sm.outgoingDamageMult));
    enemy.hp = Math.max(0, enemy.hp - dmg);
    this.logBattle(`${pet.name} strikes for ${dmg}${elementBattleLogSuffix(mult)}`);
  }

  /** Roll to tame a defeated monster. Void Titan and duplicates up to the cap are skipped. */
  /** @returns display name of the new pet when taming succeeds. */
  private maybeTame(enemy: EnemyState): string | null {
    if (this.revivalDebtActive()) return null;
    if (isRealmBossEnemyId(enemy.id)) return null;
    if (this.state.player.pets.length >= 12) return null; // gentle collection cap
    const baseChance = 0.1;
    const levelScale = Math.max(0, 3 - (enemy.minLevel - this.state.player.level)) * 0.015;
    if (Math.random() >= baseChance + levelScale) return null;
    const shape = enemy.bodyShape ?? BUILTIN_SHAPE_BY_ID[enemy.id] ?? "goblin";
    const pet: Pet = {
      id: makeListingCode("p"),
      name: enemy.name,
      speciesId: enemy.id,
      speciesName: enemy.name,
      bodyShape: shape,
      colorPrimary: enemy.customColors?.primary ?? DEFAULT_PET_COLORS[shape].primary,
      colorAccent: enemy.customColors?.accent ?? DEFAULT_PET_COLORS[shape].accent,
      level: 1,
      attackBonus: Math.min(PET_ATTACK_BUFF_CAP, Math.max(1, Math.round(enemy.attack * 0.3))),
      tamedAt: Date.now()
    };
    this.state.player.pets = [...this.state.player.pets, pet];
    if (!this.state.player.activePetId) {
      this.state.player.activePetId = pet.id;
    }
    this.logBattle(`${enemy.name} befriends you and joins as a pet!`);
    this.logEvent(`New pet tamed: ${enemy.name}.`);
    return pet.name;
  }

  setActivePet(id: string | null): void {
    if (id && !this.state.player.pets.some((p) => p.id === id)) return;
    this.state.player.activePetId = id;
    if (id) {
      const pet = this.state.player.pets.find((p) => p.id === id);
      if (pet) this.logEvent(`${pet.name} is now your active companion.`);
    } else {
      this.logEvent("Your pet is resting.");
    }
    this.emit();
  }

  buyPetShopOffer(offerKey: string): void {
    const offer = PET_SHOP_OFFERS.find((o) => o.key === offerKey);
    if (!offer) return;
    if (this.revivalDebtActive()) {
      this.logEvent(this.revivalDebtBlockMessage());
      this.emit();
      return;
    }
    if (!this.state.world.canPetShop) {
      this.logEvent("Visit the Companion Emporium in town to adopt pets.");
      this.emit();
      return;
    }
    if (this.state.player.pets.length >= 12) {
      this.logEvent("Your stable is full (12 pets). Release one before adopting another.");
      this.emit();
      return;
    }
    if (this.state.player.gold < offer.price) {
      this.logEvent(`${offer.title} costs ${offer.price}g.`);
      this.emit();
      return;
    }
    this.state.player.gold -= offer.price;
    const pet: Pet = {
      id: makeListingCode("p"),
      name: offer.title,
      speciesId: offer.speciesId,
      speciesName: offer.speciesName,
      bodyShape: offer.bodyShape,
      colorPrimary: offer.colorPrimary,
      colorAccent: offer.colorAccent,
      level: 1,
      attackBonus: offer.attackBonus,
      tamedAt: Date.now()
    };
    this.state.player.pets = [...this.state.player.pets, pet];
    if (!this.state.player.activePetId) {
      this.state.player.activePetId = pet.id;
    }
    this.logEvent(
      `Adopted ${offer.title}! Adds +${offer.attackBonus} to attack while active (companions cap at +${PET_ATTACK_BUFF_CAP}).`
    );
    this.emit();
  }

  renamePet(id: string, name: string): void {
    const clean = name.trim().slice(0, 18);
    if (!clean) return;
    this.state.player.pets = this.state.player.pets.map((p) =>
      p.id === id ? { ...p, name: clean } : p
    );
    this.emit();
  }

  releasePet(id: string): void {
    const pet = this.state.player.pets.find((p) => p.id === id);
    if (!pet) return;
    this.state.player.pets = this.state.player.pets.filter((p) => p.id !== id);
    if (this.state.player.activePetId === id) {
      this.state.player.activePetId = this.state.player.pets[0]?.id ?? null;
    }
    if (this.state.player.petStableTraining?.petId === id) {
      this.state.player.petStableTraining = null;
    }
    this.logEvent(`You set ${pet.name} free.`);
    this.emit();
  }

  private canPlayerAct(): boolean {
    return this.state.battle.inBattle && this.state.battle.phase === "playerTurn";
  }

  private pickBestHealingItem(): ItemKey | null {
    for (const item of ITEM_PRIORITY) {
      if (this.state.player.items[item] > 0) {
        return item;
      }
    }
    return null;
  }

  private consumeHealingItemInField(item: ItemKey): void {
    this.state.player.items[item] -= 1;
    const heal = ITEM_DATA[item].healAmount;
    this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + heal);
    this.logEvent(`You used ${ITEM_DATA[item].name} and healed ${heal} HP.`);
    this.emit();
  }

  private logBattle(message: string): void {
    this.state.battle.log = [message, ...this.state.battle.log].slice(0, 8);
  }

  public updateMusic() {
    if (this.state.battle.inBattle) {
      playMusic("battle");
    } else if (this.state.world.inDungeon) {
      playMusic("dungeon");
    } else if (this.state.world.inTown) {
      playMusic("town");
    } else {
      playMusic("overworld");
    }
  }

  private logEvent(message: string): void {
    this.state.eventLog = [message, ...this.state.eventLog].slice(0, 8);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Marketplace simulation (passive NPC sales)
  // ────────────────────────────────────────────────────────────────────────────

  private startMarketTicker(): void {
    if (this.marketInterval) clearInterval(this.marketInterval);
    this.marketInterval = setInterval(() => this.tickMarketplace(), UGC_MARKET_TICK_MS);
  }

  private tickMarketplace(): void {
    const ugc: UgcState = this.state.ugc;
    if (!ugc) return;
    if (this.state.battle.inBattle) return;
    if (!this.state.player.hasCreatedCharacter) return;

    let totalGross = 0;
    let totalNet = 0;
    let totalTax = 0;
    let totalCount = 0;
    const soldNames: string[] = [];

    const rollList = <T extends { listed: boolean; price: number; sales: number; grossEarned: number; name: string }>(
      list: T[]
    ): T[] =>
      list.map((item) => {
        if (!item.listed || item.price <= 0) return item;
        const chance = saleChanceForPrice(item.price);
        if (Math.random() < chance) {
          const net = Math.round(item.price * (1 - UGC_TAX_RATE));
          const tax = item.price - net;
          totalGross += item.price;
          totalNet += net;
          totalTax += tax;
          totalCount += 1;
          soldNames.push(item.name);
          return { ...item, sales: item.sales + 1, grossEarned: item.grossEarned + item.price };
        }
        return item;
      });

    const monsters = rollList(ugc.monsters);
    const weapons = rollList(ugc.weapons);
    const armor = rollList(ugc.armor);

    if (totalCount === 0) return;

    this.state.ugc = {
      ...ugc,
      monsters,
      weapons,
      armor,
      totalGross: ugc.totalGross + totalGross,
      totalNet: ugc.totalNet + totalNet,
      totalTax: ugc.totalTax + totalTax,
      totalSales: ugc.totalSales + totalCount
    };
    this.state.player.gold += totalNet;
    const preview = soldNames.slice(0, 2).join(", ");
    const more = soldNames.length > 2 ? ` +${soldNames.length - 2} more` : "";
    this.logEvent(`UGC sold ${totalCount} listing${totalCount === 1 ? "" : "s"} (${preview}${more}): +${totalNet}g (tax ${totalTax}g).`);
    this.emit();
  }

  /**
   * @param markPersisted — pass true after a successful save/load so the snapshot
   *   matches what persistence considers current (clears {@link GameSnapshot.hasUnsavedChanges}).
   */
  private emit(markPersisted = false): void {
    this.clearPositionEmitDebounce();
    // useSyncExternalStore compares snapshot references with Object.is.
    // Return a fresh snapshot object each emit so React always sees updates.
    this.contentVersion++;
    if (markPersisted) {
      this.lastPersistedVersion = this.contentVersion;
    }
    const hasUnsavedChanges = this.contentVersion !== this.lastPersistedVersion;
    const pets = Array.isArray(this.state.player.pets) ? this.state.player.pets : [];
    this.state = {
      player: {
        ...this.state.player,
        items: mergeItemInventory(this.state.player.items),
        itemHotbar: [...normalizeItemHotbar(this.state.player.itemHotbar ?? defaultItemHotbar())],
        learnedSkills: [...(this.state.player.learnedSkills ?? ["spark"])],
        npcPatronsUsed: [...(this.state.player.npcPatronsUsed ?? [])],
        appearance: { ...this.state.player.appearance },
        pets: pets.map((p) => ({ ...p }))
      },
      battle: {
        ...this.state.battle,
        skillCooldown: this.state.battle.skillCooldown,
        log: [...this.state.battle.log],
        enemy: this.state.battle.enemy ? { ...this.state.battle.enemy } : null
      },
      world: { ...this.state.world },
      eventLog: [...this.state.eventLog],
      ugc: {
        ...this.state.ugc,
        monsters: this.state.ugc.monsters.map((m) => ({ ...m })),
        weapons: this.state.ugc.weapons.map((w) => ({ ...w })),
        armor: this.state.ugc.armor.map((a) => ({ ...a }))
      },
      story: {
        ...this.state.story,
        biomesVisited: [...this.state.story.biomesVisited],
        uniqueSpeciesDefeated: [...this.state.story.uniqueSpeciesDefeated],
        completed: this.state.story.completed.map((c) => ({ ...c }))
      },
      hasUnsavedChanges,
      pendingLevelUpCelebration: this.state.pendingLevelUpCelebration ?? null,
      sleeping: this.state.sleeping ?? false
    };
    this.events.dispatchEvent(new Event("change"));
  }
}

export const gameStore = new GameStore();
