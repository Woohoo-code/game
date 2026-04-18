export type ItemKey = "potion" | "hiPotion" | "megaPotion";
export type WeaponKey = "woodSword" | "ironSword" | "steelSword" | "mythrilBlade";
export type ArmorKey = "clothArmor" | "chainMail" | "knightArmor" | "dragonArmor";
export type SkillKey = "spark" | "iceShard" | "thunderLance" | "meteorBreak";

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
  map: string;
  x: number;
  y: number;
  monstersDefeated: number;
  bountyTier: number;
  bossDefeated: boolean;
}

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
}

export interface EnemyState extends EnemyDefinition {
  hp: number;
}

export type BattlePhase = "idle" | "playerTurn" | "enemyTurn" | "won" | "lost" | "escaped";

export interface BattleState {
  inBattle: boolean;
  phase: BattlePhase;
  log: string[];
  enemy: EnemyState | null;
  skillCooldown: number;
}

export interface WorldState {
  inTown: boolean;
  canHeal: boolean;
  canShop: boolean;
  canTrain: boolean;
  canGuild: boolean;
  canBoss: boolean;
  encounterRate: number;
  /** Random encounter rolls are skipped until this hits 0 (ticks down on each wilderness tile step). */
  encounterGraceSteps: number;
}

export interface GameSnapshot {
  player: PlayerState;
  battle: BattleState;
  world: WorldState;
  eventLog: string[];
}
