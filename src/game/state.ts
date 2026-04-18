import { ARMOR_STATS, BOSS_ENEMY, ITEM_DATA, ITEM_PRIORITY, SKILL_DATA, WEAPON_STATS, getUnlockedSkills, pickEncounterEnemy } from "./data";
import { LocalSaveRepository, type SaveRepository } from "./save";
import type { ArmorKey, BattleState, EnemyState, GameSnapshot, ItemKey, PlayerState, SkillKey, WeaponKey, WorldState } from "./types";

const initialPlayer = (): PlayerState => ({
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
  x: 64,
  y: 64,
  monstersDefeated: 0,
  bountyTier: 1,
  bossDefeated: false
});

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
  encounterGraceSteps: 0
});

class GameStore {
  private events = new EventTarget();
  private saveRepository: SaveRepository = new LocalSaveRepository();
  private state: GameSnapshot = {
    player: initialPlayer(),
    battle: initialBattle(),
    world: initialWorld(),
    eventLog: ["Reach town tiles to shop or rest at the inn."]
  };

  subscribe(listener: () => void): () => void {
    const wrapped = () => listener();
    this.events.addEventListener("change", wrapped);
    return () => this.events.removeEventListener("change", wrapped);
  }

  getSnapshot(): GameSnapshot {
    return this.state;
  }

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
      this.state = {
        player: initialPlayer(),
        battle: initialBattle(),
        world: initialWorld(),
        eventLog: ["World reset complete. Saved games cleared. A new journey begins."]
      };
      this.emit();
    })();
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

  startEncounter(): void {
    if (this.state.battle.inBattle) {
      return;
    }
    const template = pickEncounterEnemy(this.state.player.level);
    const enemy: EnemyState = { ...template, hp: template.maxHp };
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

  async save(slot = "slot1"): Promise<void> {
    await this.saveRepository.save(slot, this.state);
    this.logEvent("Game saved.");
    this.emit();
  }

  async load(slot = "slot1"): Promise<void> {
    const loaded = await this.saveRepository.load(slot);
    if (!loaded) {
      this.logEvent("No save found.");
      this.emit();
      return;
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
    this.logEvent("Save loaded.");
    this.emit();
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
    if (enemy.id === BOSS_ENEMY.id) {
      this.state.player.bossDefeated = true;
      this.logEvent("Void Titan defeated! Reset Game is now unlocked.");
    }
    this.resolveLevelUps();
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

  private emit(): void {
    // useSyncExternalStore compares snapshot references with Object.is.
    // Return a fresh snapshot object each emit so React always sees updates.
    this.state = {
      player: {
        ...this.state.player,
        items: { ...this.state.player.items }
      },
      battle: {
        ...this.state.battle,
        log: [...this.state.battle.log],
        enemy: this.state.battle.enemy ? { ...this.state.battle.enemy } : null
      },
      world: { ...this.state.world }
      ,
      eventLog: [...this.state.eventLog]
    };
    this.events.dispatchEvent(new Event("change"));
  }
}

export const gameStore = new GameStore();
