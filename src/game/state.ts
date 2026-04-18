import { ARMOR_STATS, BOSS_ENEMY, ENEMIES, ITEM_DATA, ITEM_PRIORITY, SKILL_DATA, TOWN_MAP, WEAPON_STATS, getUnlockedSkills } from "./data";
import { LocalSaveRepository, type SaveRepository } from "./save";
import type {
  ArmorKey,
  BattleState,
  BiomeKind,
  EnemyDefinition,
  EnemyState,
  GameSnapshot,
  ItemKey,
  PlayerAppearance,
  PlayerState,
  SkillKey,
  StoryStage,
  StoryState,
  UgcArmor,
  UgcMonster,
  UgcState,
  UgcWeapon,
  WeaponKey,
  WorldState
} from "./types";
import { STORY_CHAPTERS, initialStory, isStageComplete } from "./story";
import {
  UGC_MARKET_TICK_MS,
  UGC_TAX_RATE,
  hydrateEnemyFromUgc,
  initialUgc,
  newArmor as newUgcArmor,
  newMonster as newUgcMonster,
  newWeapon as newUgcWeapon,
  pickEncounterFromPool,
  saleChanceForPrice,
  ugcMonsterToEnemyDef
} from "./ugc";
import { TILE, getSpawnPixel, regenerateWorld, worldSeed as activeWorldSeed, worldVersion as activeWorldVersion } from "./worldMap";
import { randomSeed } from "./worldGen";

export const defaultAppearance = (): PlayerAppearance => ({
  skin: "#f1c9a5",
  hair: "#6b4b2a",
  hairStyle: "short",
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
    items: { potion: 2, hiPotion: 0, megaPotion: 0 },
    map: "field",
    x: spawn.x,
    y: spawn.y,
    monstersDefeated: 0,
    bountyTier: 1,
    bossDefeated: false,
    appearance: defaultAppearance(),
    hasCreatedCharacter: false,
    hasTownMap: false
  };
};

const initialBattle = (): BattleState => ({
  inBattle: false,
  phase: "idle",
  log: ["Explore the field and watch for encounters."],
  enemy: null,
  skillCooldown: 0
});

/** Tile moves on grass/road after a battle before random encounters can roll again. */
export const POST_ENCOUNTER_GRACE_STEPS = 10;

const initialWorld = (): WorldState => ({
  inTown: false,
  canHeal: false,
  canShop: false,
  canTrain: false,
  canGuild: false,
  canBoss: false,
  encounterRate: 0,
  encounterGraceSteps: 0,
  worldSeed: activeWorldSeed,
  worldVersion: activeWorldVersion
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
    story: initialStory()
  };

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
    }
  }

  /** Hook called by the encounter dispatcher when the player stands on the boss arena. */
  storyNoteBossArenaReached(): void {
    const s = this.state.story;
    if (!s.reachedBossArena) {
      s.reachedBossArena = true;
      this.evaluateStoryProgress();
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
    canTrain: boolean,
    canGuild: boolean,
    canBoss: boolean
  ): void {
    this.state.world.inTown = inTown;
    this.state.world.canHeal = canHeal;
    this.state.world.canShop = canShop;
    this.state.world.canTrain = canTrain;
    this.state.world.canGuild = canGuild;
    this.state.world.canBoss = canBoss;
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
      skillCooldown: 0
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
      this.state = {
        player: initialPlayer(),
        battle: initialBattle(),
        world: initialWorld(),
        eventLog: ["World reset complete. A new land has risen. Saved games cleared."],
        ugc: initialUgc(),
        story: initialStory()
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
      canTrain: false,
      canGuild: false,
      canBoss: false,
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

  setEncounterRate(encounterRate: number): void {
    this.state.world.encounterRate = encounterRate;
    this.emit();
  }

  /**
   * Call after moving onto a new tile where random encounters are possible (not town/water).
   * Updates HUD encounter rate, consumes one grace step if any, and returns whether to skip this step’s encounter roll.
   */
  wildernessEncounterStep(encounterRate: number): boolean {
    this.state.world.encounterRate = encounterRate;
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
    const ugcMatch = this.state.ugc.monsters.find((m) => m.id === template.id);
    const enemy: EnemyState = ugcMatch
      ? hydrateEnemyFromUgc(ugcMatch)
      : { ...template, hp: template.maxHp };
    this.state.battle = {
      inBattle: true,
      phase: this.playerSpeed() >= enemy.speed ? "playerTurn" : "enemyTurn",
      enemy,
      log: [`A wild ${enemy.name} appears!`],
      skillCooldown: 0
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
    this.afterPlayerAction();
  }

  playerSkill(skill: SkillKey = "spark"): void {
    if (!this.canPlayerAct()) return;
    if (!getUnlockedSkills(this.state.player.level).includes(skill)) {
      this.logBattle("That skill is not unlocked yet.");
      this.emit();
      return;
    }
    if (this.state.battle.skillCooldown > 0) {
      this.logBattle(`Skill is on cooldown for ${this.state.battle.skillCooldown} more turn(s).`);
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
    const heal = ITEM_DATA[item].healAmount;
    this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + heal);
    this.logBattle(`You used ${ITEM_DATA[item].name} and healed ${heal} HP.`);
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
    this.state.player.items[item] -= 1;
    const heal = ITEM_DATA[item].healAmount;
    this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + heal);
    this.logEvent(`You used ${ITEM_DATA[item].name} and healed ${heal} HP.`);
    this.emit();
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
    this.logEvent(`Bought the ${TOWN_MAP.name}. A new compass now guides you home.`);
    this.emit();
  }

  private buyItem(item: ItemKey): void {
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
    this.emit();
  }

  async load(slot = "slot1"): Promise<boolean> {
    const loaded = await this.saveRepository.load(slot);
    if (!loaded) {
      this.logEvent("No save found.");
      this.emit();
      return false;
    }
    this.state = loaded;
    if (this.state.battle.skillCooldown === undefined) {
      this.state.battle.skillCooldown = 0;
    }
    if (!this.state.eventLog) {
      this.state.eventLog = ["Save loaded from old format."];
    }
    this.state.player.items = {
      potion: this.state.player.items.potion ?? 0,
      hiPotion: this.state.player.items.hiPotion ?? 0,
      megaPotion: this.state.player.items.megaPotion ?? 0
    };
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
    }
    if (this.state.player.hasCreatedCharacter === undefined) {
      this.state.player.hasCreatedCharacter = true;
    }
    if (this.state.player.hasTownMap === undefined) {
      this.state.player.hasTownMap = false;
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
    if (this.state.world.encounterGraceSteps === undefined) {
      this.state.world.encounterGraceSteps = 0;
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

    this.logEvent("Save loaded.");
    this.emit();
    return true;
  }

  private playerAttackPower(): number {
    return this.state.player.attack + WEAPON_STATS[this.state.player.weapon].attackBonus;
  }

  private playerDefensePower(): number {
    return this.state.player.defense + ARMOR_STATS[this.state.player.armor].defenseBonus;
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
      this.state.player.gold = Math.max(0, this.state.player.gold - 10);
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
    this.state.player.gold += enemy.goldReward;
    this.state.player.xp += enemy.xpReward;
    this.state.player.monstersDefeated += 1;
    this.logBattle(`Gained ${enemy.xpReward} XP and ${enemy.goldReward} gold.`);

    // Story: track slain count and unique species.
    const story = this.state.story;
    story.monstersSlain += 1;
    if (enemy.id !== BOSS_ENEMY.id && !story.uniqueSpeciesDefeated.includes(enemy.id)) {
      story.uniqueSpeciesDefeated.push(enemy.id);
    }

    if (enemy.id === BOSS_ENEMY.id) {
      this.state.player.bossDefeated = true;
      this.logEvent("Void Titan defeated! UGC Studio and Reset Game are now unlocked.");
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

  private endBattle(): void {
    this.state.battle.inBattle = false;
    this.state.battle.enemy = null;
    this.state.battle.skillCooldown = 0;
    this.state.world.encounterGraceSteps = POST_ENCOUNTER_GRACE_STEPS;
    this.emit();
  }

  private randomVariance(): number {
    return Math.floor(Math.random() * 3) - 1;
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

  private emit(): void {
    // useSyncExternalStore compares snapshot references with Object.is.
    // Return a fresh snapshot object each emit so React always sees updates.
    this.state = {
      player: {
        ...this.state.player,
        items: { ...this.state.player.items },
        appearance: { ...this.state.player.appearance }
      },
      battle: {
        ...this.state.battle,
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
      }
    };
    this.events.dispatchEvent(new Event("change"));
  }
}

export const gameStore = new GameStore();
