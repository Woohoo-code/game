import {
  ARMOR_STATS,
  BOSS_ENEMY,
  ENEMIES,
  ITEM_DATA,
  ITEM_PRIORITY,
  SHOP_ITEMS,
  SKILL_DATA,
  SKILL_ORDER,
  TOWN_MAP,
  WEAPON_STATS,
  PET_ATTACK_BUFF_CAP,
  PET_SHOP_OFFERS,
  getUnlockedSkills,
  petAttackBuffForParty,
  scaleEncounterForPlayerLevel
} from "./data";
import { LocalSaveRepository, type SaveRepository } from "./save";
import {
  normalizeFacialHair,
  normalizeHairStyle,
  type ArmorKey,
  type BattleState,
  type BiomeKind,
  type EnemyDefinition,
  type EnemyState,
  type GameSnapshot,
  type ItemKey,
  type MonsterBodyShape,
  type Pet,
  type PlayerAppearance,
  type PlayerState,
  type SkillKey,
  type StoryStage,
  type StoryState,
  type UgcArmor,
  type UgcMonster,
  type UgcState,
  type UgcWeapon,
  type WeaponKey,
  type WorldState
} from "./types";
import { STORY_CHAPTERS, initialStory, isStageComplete } from "./story";
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
import { isNightWilds, nightEnemyStatMultiplier } from "./worldClock";
import {
  TILE,
  clampEncounterStepChance,
  getSpawnPixel,
  nearestTown,
  regenerateWorld,
  swapBossTileForVoidPortal,
  syncZonesAtTile,
  worldSeed as activeWorldSeed,
  worldVersion as activeWorldVersion
} from "./worldMap";
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
  scorpion: { primary: "#d6a64c", accent: "#6f3a1a" }
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

const initialPlayer = (): PlayerState => {
  const spawn = getSpawnPixel();
  return {
    name: "Hero",
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
    map: "field",
    x: spawn.x,
    y: spawn.y,
    monstersDefeated: 0,
    bountyTier: 1,
    bossDefeated: false,
    appearance: defaultAppearance(),
    hasCreatedCharacter: false,
    hasTownMap: false,
    townMapEquipped: false,
    pets: [],
    activePetId: null,
    revivalDebtMonstersRemaining: 0
  };
};

const initialBattle = (): BattleState => ({
  inBattle: false,
  phase: "idle",
  log: ["Explore the field and watch for encounters."],
  enemy: null,
  skillCooldown: 0,
  itemAttackBonus: 0,
  itemDefenseBonus: 0
});

/** Tile moves on grass/road after a battle before random encounters can roll again. */
export const POST_ENCOUNTER_GRACE_STEPS = 10;

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
  voidPortalActive: false,
  encounterRate: 0,
  encounterGraceSteps: 0,
  worldSeed: activeWorldSeed,
  worldVersion: activeWorldVersion,
  worldTime: 0.28
});

class GameStore {
  private events = new EventTarget();
  private saveRepository: SaveRepository = new LocalSaveRepository();
  private marketInterval: ReturnType<typeof setInterval> | null = null;
  private state: GameSnapshot = {
    player: initialPlayer(),
    battle: initialBattle(),
    world: initialWorld(),
    eventLog: ["Reach town tiles to shop or rest at the inn."],
    ugc: initialUgc(),
    story: initialStory(),
    hasUnsavedChanges: true
  };

  /** Bumps once per {@link emit}; aligned with {@link lastPersistedVersion} after save/load. */
  private contentVersion = 0;
  private lastPersistedVersion = -1;

  constructor() {
    this.startMarketTicker();
  }

  subscribe(listener: () => void): () => void {
    const wrapped = () => listener();
    this.events.addEventListener("change", wrapped);
    return () => this.events.removeEventListener("change", wrapped);
  }

  getSnapshot(): GameSnapshot {
    return this.state;
  }

  /**
   * LAN guest: replace local state with the host snapshot and align generated world
   * ({@link regenerateWorld}) when the seed differs.
   */
  applyLanGuestSnapshot(remote: GameSnapshot): void {
    const seed = remote.world?.worldSeed;
    if (typeof seed === "number" && Number.isFinite(seed) && seed !== activeWorldSeed) {
      regenerateWorld(seed);
    }
    this.state = structuredClone(remote) as GameSnapshot;
    this.state.world.worldSeed = activeWorldSeed;
    this.state.world.worldVersion = activeWorldVersion;
    if (this.state.world.voidPortalActive && this.state.player.bossDefeated) {
      swapBossTileForVoidPortal();
      this.state.world.worldVersion = activeWorldVersion;
    }
    // Host snapshot is already live game state — skip per-tick migrateLoadedGameSnapshot for performance.
    this.emit();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Character creation / appearance
  // ────────────────────────────────────────────────────────────────────────────

  createCharacter(name: string, appearance: PlayerAppearance): void {
    const cleanName = name.trim().slice(0, 18) || "Hero";
    this.state.player.name = cleanName;
    this.state.player.appearance = { ...appearance };
    this.state.player.hasCreatedCharacter = true;
    this.logEvent(`${cleanName} steps out onto the road.`);
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
    if (isStageComplete(s.stage, s)) {
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
    this.emit();
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
    canVoidPortal: boolean
  ): void {
    this.state.world.inTown = inTown;
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
      this.logEvent("Stand on the blue rift where the Void Titan fell.");
      this.emit();
      return;
    }
    this.state.world.voidPortalActive = false;
    regenerateWorld(randomSeed());
    const spawn = getSpawnPixel();
    this.state.player.x = spawn.x;
    this.state.player.y = spawn.y;
    this.state.world.worldSeed = activeWorldSeed;
    this.state.world.worldVersion = activeWorldVersion;
    const tx = Math.floor(spawn.x / TILE);
    const ty = Math.floor(spawn.y / TILE);
    syncZonesAtTile(tx, ty);
    this.logEvent("You step through the rift — only this new land remains.");
    this.emit();
  }

  challengeBoss(): void {
    if (this.state.battle.inBattle) {
      return;
    }
    if (this.state.player.bossDefeated) {
      this.logEvent("The Void Titan has already been defeated.");
      this.emit();
      return;
    }
    const enemy: EnemyState = { ...BOSS_ENEMY, hp: BOSS_ENEMY.maxHp };
    this.state.battle = {
      inBattle: true,
      phase: this.playerSpeed() >= enemy.speed ? "playerTurn" : "enemyTurn",
      enemy,
      log: [`${enemy.name} challenges you!`],
      skillCooldown: this.state.battle.skillCooldown,
      itemAttackBonus: 0,
      itemDefenseBonus: 0
    };
    this.emit();
    if (this.state.battle.phase === "enemyTurn") {
      this.enemyTurn();
    }
  }

  resetGame(): void {
    if (!this.state.player.bossDefeated) {
      this.logEvent("Defeat the top-right boss first to unlock reset.");
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
      this.state = {
        player: initialPlayer(),
        battle: initialBattle(),
        world: initialWorld(),
        eventLog: ["World reset complete. A new land has risen. Saved games cleared."],
        ugc: initialUgc(),
        story: initialStory(),
        hasUnsavedChanges: true
      };
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
    regenerateWorld(seed);
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
      voidPortalActive: false,
      encounterRate: 0,
      encounterGraceSteps: 0
    };
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
    const debt = this.state.player.revivalDebtMonstersRemaining ?? 0;
    const needsHeal = this.state.player.hp < this.state.player.maxHp;
    if (!needsHeal && debt <= 0) {
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
    if (debt > 0) {
      this.state.player.revivalDebtMonstersRemaining = debt - 1;
      this.logEvent(
        `Blessing received: healed ${heal} HP and eased your tithe by 1 (${this.state.player.revivalDebtMonstersRemaining} left).`
      );
    } else {
      this.logEvent(`Blessing received: healed ${heal} HP.`);
    }
    this.emit();
  }

  rideAtStables(): void {
    if (!this.state.world.canStables) {
      this.logEvent("Visit the stables for agility drills.");
      this.emit();
      return;
    }
    const fee = 18 + this.state.player.level * 4;
    if (this.state.player.gold < fee) {
      this.logEvent(`Stable drills cost ${fee}g.`);
      this.emit();
      return;
    }
    this.state.player.gold -= fee;
    this.state.player.speed += 1;
    this.logEvent(`You run mounted drills. +1 speed for ${fee}g.`);
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

  /**
   * Call after moving onto a new tile where random encounters are possible (not town/water).
   * Updates HUD encounter rate, consumes one grace step if any, and returns whether to skip this step’s encounter roll.
   */
  /** Advance the day / night clock (no-op while in battle). */
  tickWorldClock(dayFraction: number): void {
    if (this.state.battle.inBattle) return;
    const base = this.state.world.worldTime ?? 0;
    const next = base + dayFraction;
    this.state.world.worldTime = Number.isFinite(next) ? next : 0.28;
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

  startEncounter(biome?: BiomeKind): void {
    if (this.state.battle.inBattle) {
      return;
    }
    const builtInPool: EnemyDefinition[] = biome
      ? ENEMIES.filter((e) => !e.biomes || e.biomes.length === 0 || e.biomes.includes(biome))
      : ENEMIES;
    const pool: EnemyDefinition[] = [
      ...builtInPool,
      ...this.state.ugc.monsters.map(ugcMonsterToEnemyDef)
    ];
    const template = pickEncounterFromPool(pool, this.state.player.level)
      ?? pickEncounterFromPool(ENEMIES, this.state.player.level);
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
    this.state.battle = {
      inBattle: true,
      phase: this.playerSpeed() >= enemy.speed ? "playerTurn" : "enemyTurn",
      enemy,
      log: [atNight ? `Under dark skies, a wild ${enemy.name} appears!` : `A wild ${enemy.name} appears!`],
      skillCooldown: this.state.battle.skillCooldown,
      itemAttackBonus: 0,
      itemDefenseBonus: 0
    };
    this.emit();
    if (this.state.battle.phase === "enemyTurn") {
      this.enemyTurn();
    }
  }

  playerAttack(): void {
    if (!this.canPlayerAct()) return;
    const enemy = this.state.battle.enemy;
    if (!enemy) return;
    const damage = Math.max(1, this.playerAttackPower() - enemy.defense + this.randomVariance());
    enemy.hp = Math.max(0, enemy.hp - damage);
    this.logBattle(`You attack for ${damage} damage.`);
    this.maybePetFollowUp(enemy);
    this.afterPlayerAction();
  }

  playerSkill(skill: SkillKey = "spark"): void {
    if (!this.canPlayerAct()) return;
    if (!getUnlockedSkills(this.state.player.level).includes(skill)) {
      this.logBattle("That skill is not unlocked yet.");
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
    const skillData = SKILL_DATA[skill];
    const damage = Math.max(2, this.playerAttackPower() + skillData.powerBonus - enemy.defense + this.randomVariance());
    enemy.hp = Math.max(0, enemy.hp - damage);
    this.logBattle(`You cast ${skillData.name} for ${damage} damage.`);
    this.state.battle.skillCooldown = skillData.cooldown;
    this.afterPlayerAction();
  }

  usePotion(item: ItemKey = "potion"): void {
    if (!this.canPlayerAct()) return;
    if (this.state.player.items[item] <= 0) {
      this.logBattle("No healing items left.");
      this.emit();
      return;
    }
    this.state.player.items[item] -= 1;
    const def = ITEM_DATA[item];
    const heal = def.healAmount;
    this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + heal);
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
          this.state.battle.phase = "won";
          this.applyRewards(enemy);
          this.endBattle();
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
    this.logEvent(`Bought the ${TOWN_MAP.name}. Press Equip Map in any shop to show the compass in the wilds.`);
    this.emit();
  }

  /** Toggle the Town Map compass while you own the map (shop context or future UI). */
  setTownMapEquipped(equipped: boolean): void {
    if (!this.state.player.hasTownMap) {
      this.logEvent("Buy a Town Map at a shop first.");
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

  private buyWeapon(weapon: WeaponKey): void {
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
    this.logEvent("You feel refreshed after resting.");
    this.emit();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // UGC Studio (gated on bossDefeated at the UI layer)
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
      const error = "Finish or flee the battle before importing a transfer.";
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
    if (this.state.world.voidPortalActive === undefined) {
      this.state.world.voidPortalActive = false;
    }
    if (this.state.world.encounterGraceSteps === undefined) {
      this.state.world.encounterGraceSteps = 0;
    }
    if (typeof this.state.world.worldTime !== "number" || !Number.isFinite(this.state.world.worldTime)) {
      this.state.world.worldTime = 0.28;
    }
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
          if (stage === "ch1_firstHunts" && s.monstersSlain < 5) break;
          if (stage === "ch2_gearUp" && !s.boughtBetterGear) break;
          if (stage === "ch3_wanderer") break; // need biomes visited — start this fresh
          if (stage === "ch4_whispers" && p.level < 5) break;
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
      regenerateWorld(savedSeed);
    } else {
      regenerateWorld(randomSeed());
      const spawn = getSpawnPixel();
      this.state.player.x = spawn.x;
      this.state.player.y = spawn.y;
      this.logEvent("Save predates procedural worlds — generated a fresh land.");
    }
    this.state.world.worldSeed = activeWorldSeed;
    this.state.world.worldVersion = activeWorldVersion;
    if (this.state.world.voidPortalActive && this.state.player.bossDefeated) {
      swapBossTileForVoidPortal();
      this.state.world.worldVersion = activeWorldVersion;
    }

    if (typeof this.state.hasUnsavedChanges !== "boolean") {
      this.state.hasUnsavedChanges = true;
    }
  }

  private playerAttackPower(): number {
    const w = WEAPON_STATS[this.state.player.weapon].attackBonus;
    const pet = petAttackBuffForParty(this.state.player.activePetId, this.state.player.pets);
    const itemAtk = this.state.battle.inBattle ? (this.state.battle.itemAttackBonus ?? 0) : 0;
    return this.state.player.attack + w + pet + itemAtk;
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

  private enemyTurn(): void {
    if (!this.state.battle.inBattle || !this.state.battle.enemy) return;
    const enemy = this.state.battle.enemy;
    const damage = Math.max(1, enemy.attack - this.playerDefensePower() + this.randomVariance());
    this.state.player.hp = Math.max(0, this.state.player.hp - damage);
    this.logBattle(`${enemy.name} hits you for ${damage} damage.`);
    if (this.state.player.hp <= 0) {
      this.state.battle.phase = "lost";
      this.logBattle("You were knocked out.");
      this.state.player.hp = this.state.player.maxHp;
      this.onKnockoutRevival();
      this.endBattle();
      return;
    }
    this.state.battle.phase = "playerTurn";
    if (this.state.battle.skillCooldown > 0) {
      this.state.battle.skillCooldown -= 1;
    }
    this.emit();
  }

  private applyRewards(enemy: EnemyState): void {
    // Gold variance: every drop rolls within ±25% of the base reward, with a
    // 10% chance for a "lucky" 2x payout. Bosses always drop their exact gold
    // so flavor text and chapter rewards stay predictable.
    const base = enemy.goldReward;
    let goldGained = base;
    let luckyDrop = false;
    if (enemy.id !== BOSS_ENEMY.id && base > 0) {
      const variance = 1 + (Math.random() * 0.5 - 0.25); // 0.75 .. 1.25
      goldGained = Math.max(1, Math.round(base * variance));
      if (Math.random() < 0.1) {
        luckyDrop = true;
        goldGained *= 2;
      }
    }
    this.state.player.gold += goldGained;
    this.state.player.xp += enemy.xpReward;
    this.state.player.monstersDefeated += 1;

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

    if (luckyDrop) {
      this.logBattle(`Lucky drop! Gained ${enemy.xpReward} XP and ${goldGained} gold.`);
    } else {
      this.logBattle(`Gained ${enemy.xpReward} XP and ${goldGained} gold.`);
    }

    // Taming: a defeated monster may decide to follow the player. Chance is
    // slightly higher the earlier the player is (helps new players build a
    // stable of companions), capped at a modest rate.
    this.maybeTame(enemy);

    // Story: track slain count and unique species.
    const story = this.state.story;
    story.monstersSlain += 1;
    if (enemy.id !== BOSS_ENEMY.id && !story.uniqueSpeciesDefeated.includes(enemy.id)) {
      story.uniqueSpeciesDefeated.push(enemy.id);
    }

    if (enemy.id === BOSS_ENEMY.id) {
      this.state.player.bossDefeated = true;
      this.state.world.voidPortalActive = true;
      swapBossTileForVoidPortal();
      this.state.world.worldSeed = activeWorldSeed;
      this.state.world.worldVersion = activeWorldVersion;
      this.logEvent(
        "Void Titan defeated! UGC Studio and Reset Game are now unlocked. A rift opens on the arena tile — step through for a new realm."
      );
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
  }

  private resolveLevelUps(): void {
    while (this.state.player.xp >= this.state.player.xpToNext) {
      const levelBefore = this.state.player.level;
      this.state.player.xp -= this.state.player.xpToNext;
      this.state.player.level += 1;
      this.state.player.xpToNext = Math.floor(this.state.player.xpToNext * 1.35);
      this.state.player.maxHp += 8;
      this.state.player.attack += 2;
      this.state.player.defense += 1;
      this.state.player.speed += 1;
      this.logEvent(`Level up! You are now level ${this.state.player.level}.`);
      for (const skill of getUnlockedSkills(this.state.player.level)) {
        if (SKILL_DATA[skill].minLevel === this.state.player.level && levelBefore < this.state.player.level) {
          this.logEvent(`New skill unlocked: ${SKILL_DATA[skill].name}.`);
        }
      }
      // Story: Chapter 4 ("Whispers of the Titan") completes at level 5.
      if (this.state.story.stage === "ch4_whispers" && this.state.player.level >= 5) {
        this.completeCurrentChapter();
      }
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

  /** Knockout: 10g tithe (partial gold applies), debt = gold shortfall in kills, warp to nearest town. */
  private onKnockoutRevival(): void {
    const fee = 10;
    const had = this.state.player.gold;
    const pay = Math.min(had, fee);
    this.state.player.gold = had - pay;
    const short = fee - pay;
    if (short > 0) {
      this.state.player.revivalDebtMonstersRemaining =
        (this.state.player.revivalDebtMonstersRemaining ?? 0) + short;
    }

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

    const debt = this.state.player.revivalDebtMonstersRemaining ?? 0;
    if (short > 0) {
      this.logBattle(
        `The Guild drags you to the nearest village. You paid ${pay}g of the ${fee}g revival tithe — slay ${debt} more beast${debt === 1 ? "" : "s"} before shops, the inn, pets, training, or guild pay unlock.`
      );
      this.logEvent(this.revivalDebtBlockMessage());
    } else {
      this.logBattle(`The Guild revives you in the nearest village. Tithe paid (${fee}g).`);
    }
  }

  private endBattle(): void {
    this.state.battle.inBattle = false;
    this.state.battle.enemy = null;
    this.state.battle.itemAttackBonus = 0;
    this.state.battle.itemDefenseBonus = 0;
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
    const dmg = Math.max(1, 2 + Math.floor(pet.level / 2) + this.randomVariance());
    enemy.hp = Math.max(0, enemy.hp - dmg);
    this.logBattle(`${pet.name} strikes for ${dmg}.`);
  }

  /** Roll to tame a defeated monster. Void Titan and duplicates up to the cap are skipped. */
  private maybeTame(enemy: EnemyState): void {
    if (this.revivalDebtActive()) return;
    if (enemy.id === BOSS_ENEMY.id) return;
    if (this.state.player.pets.length >= 12) return; // gentle collection cap
    const baseChance = 0.1;
    const levelScale = Math.max(0, 3 - (enemy.minLevel - this.state.player.level)) * 0.015;
    if (Math.random() >= baseChance + levelScale) return;
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
        items: { ...this.state.player.items },
        itemHotbar: [...normalizeItemHotbar(this.state.player.itemHotbar ?? defaultItemHotbar())],
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
      hasUnsavedChanges
    };
    this.events.dispatchEvent(new Event("change"));
  }
}

export const gameStore = new GameStore();
