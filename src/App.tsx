import { useEffect, useRef, useState, type PointerEvent } from "react";
import Phaser from "phaser";
import { GameScene } from "./game/GameScene";
import { inputController, type MoveDirection } from "./game/inputController";
import { gameStore } from "./game/state";
import { ARMOR_STATS, ITEM_DATA, SKILL_DATA, WEAPON_STATS, getUnlockedSkills } from "./game/data";
import { useGameStore } from "./game/useGameStore";
import type { EnemyState, SkillKey } from "./game/types";
import { Overworld3D } from "./game3d/Overworld3D";

/**
 * Feature flag for the 3D prototype overworld.
 * Set to `false` to fall back to the Phaser 2D overworld that lives on the 2d-baseline branch/tag.
 */
const USE_3D_OVERWORLD = true;

function DirButton({ dir, label }: { dir: MoveDirection; label: string }) {
  const press = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    inputController.setPressed(dir, true);
  };
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    inputController.setPressed(dir, false);
  };

  return (
    <button
      className="dir-btn"
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  );
}

function MonsterPortrait({ enemy }: { enemy: EnemyState }) {
  if (enemy.id === "slime") {
    return (
      <svg viewBox="0 0 180 140" className="monster-svg" role="img" aria-label="Slime">
        <ellipse cx="90" cy="95" rx="60" ry="35" fill="#4da7b8" />
        <ellipse cx="90" cy="75" rx="42" ry="30" fill="#66c4d2" />
        <circle cx="74" cy="72" r="6" fill="#13293b" />
        <circle cx="106" cy="72" r="6" fill="#13293b" />
        <path d="M70,92 Q90,102 110,92" stroke="#13293b" strokeWidth="4" fill="none" />
      </svg>
    );
  }
  if (enemy.id === "bat") {
    return (
      <svg viewBox="0 0 180 140" className="monster-svg" role="img" aria-label="Bat">
        <ellipse cx="90" cy="78" rx="20" ry="20" fill="#5f566f" />
        <path d="M70,78 C42,48 22,52 10,78 C30,80 42,90 55,102 Z" fill="#4f475e" />
        <path d="M110,78 C138,48 158,52 170,78 C150,80 138,90 125,102 Z" fill="#4f475e" />
        <circle cx="83" cy="74" r="4" fill="#ffefef" />
        <circle cx="97" cy="74" r="4" fill="#ffefef" />
        <polygon points="88,88 83,98 92,95" fill="#f5d4d4" />
        <polygon points="92,88 97,98 88,95" fill="#f5d4d4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 180 140" className="monster-svg" role="img" aria-label="Goblin">
      <ellipse cx="90" cy="86" rx="34" ry="34" fill="#6eaa4f" />
      <polygon points="54,80 38,70 48,94" fill="#629645" />
      <polygon points="126,80 142,70 132,94" fill="#629645" />
      <circle cx="78" cy="82" r="5" fill="#142218" />
      <circle cx="102" cy="82" r="5" fill="#142218" />
      <rect x="74" y="96" width="32" height="6" rx="2" fill="#1f3b27" />
      <rect x="78" y="102" width="4" height="7" fill="#f0e0c6" />
      <rect x="98" y="102" width="4" height="7" fill="#f0e0c6" />
    </svg>
  );
}

function ItemIcon({ kind }: { kind: "potion" | "hiPotion" | "megaPotion" }) {
  const label = kind === "potion" ? "P" : kind === "hiPotion" ? "H" : "M";
  return <span className={`item-icon ${kind}`}>{label}</span>;
}

function WeaponIcon({ attackBonus }: { attackBonus: number }) {
  return (
    <span className="item-icon weapon" aria-hidden="true">
      +{attackBonus}
    </span>
  );
}

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const gameRef = useRef<Phaser.Game | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const snapshot = useGameStore();
  const unlockedSkills = getUnlockedSkills(snapshot.player.level);
  const weaponBonus = WEAPON_STATS[snapshot.player.weapon].attackBonus;
  const armorBonus = ARMOR_STATS[snapshot.player.armor].defenseBonus;
  const attackPower = snapshot.player.attack + weaponBonus;
  const defensePower = snapshot.player.defense + armorBonus;
  const xpPercent = Math.max(0, Math.min(100, Math.round((snapshot.player.xp / snapshot.player.xpToNext) * 100)));
  const playerHpPercent = Math.max(0, Math.min(100, Math.round((snapshot.player.hp / snapshot.player.maxHp) * 100)));
  const enemyHpPercent = snapshot.battle.enemy
    ? Math.max(0, Math.min(100, Math.round((snapshot.battle.enemy.hp / snapshot.battle.enemy.maxHp) * 100)))
    : 0;
  const dangerPercent = Math.min(100, Math.round(snapshot.world.encounterRate * 1000));
  const dangerLabel =
    dangerPercent === 0 ? "Safe" : dangerPercent < 40 ? "Low" : dangerPercent < 80 ? "Medium" : "High";
  const gold = snapshot.player.gold;
  const trainFee = 20 + snapshot.player.level * 6;
  const canAffordTraining = gold >= trainFee;

  useEffect(() => {
    if (!gameStarted) {
      return;
    }
    if (USE_3D_OVERWORLD) {
      return;
    }
    if (!mountRef.current) {
      return;
    }
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mountRef.current,
      width: 640,
      height: 448,
      backgroundColor: "#1b2330",
      scene: [GameScene]
    });
    gameRef.current = game;
    return () => {
      inputController.clear();
      game.destroy(true);
      gameRef.current = null;
    };
  }, [gameStarted]);

  if (!gameStarted) {
    return (
      <div className="title-screen">
        <div className="title-screen-inner">
          <h1 className="title-screen-logo">Monster Slayer</h1>
          <p className="title-screen-tagline">Roam the wilds, brave towns, and cut down what lurks beyond the road.</p>
          <button type="button" className="title-screen-play" onClick={() => setGameStarted(true)}>
            Play
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="main-column">
        <div className="panel">
          <h1>Monster Slayer</h1>
          <div className="danger-meter">
            <div className="danger-meter-head">
              <strong>Danger: {dangerLabel}</strong>
              <span>{dangerPercent}%</span>
            </div>
            <div className="danger-meter-track">
              <div className="danger-meter-fill" style={{ width: `${dangerPercent}%` }} />
            </div>
          </div>
          <p>
            Lv {snapshot.player.level} | HP {snapshot.player.hp}/{snapshot.player.maxHp} | Gold {snapshot.player.gold}
          </p>
          <div className="hp-meter">
            <div className="hp-meter-head">
              <strong>Player HP</strong>
              <span>
                {snapshot.player.hp}/{snapshot.player.maxHp}
              </span>
            </div>
            <div className="hp-meter-track">
              <div className="hp-meter-fill" style={{ width: `${playerHpPercent}%` }} />
            </div>
          </div>
          <div className="xp-meter">
            <div className="xp-meter-head">
              <strong>Next Level</strong>
              <span>
                {snapshot.player.xp}/{snapshot.player.xpToNext} XP
              </span>
            </div>
            <div className="xp-meter-track">
              <div className="xp-meter-fill" style={{ width: `${xpPercent}%` }} />
            </div>
          </div>
          <div className="inventory-card">
            <div className="inventory-header">Inventory</div>
            <div className="inventory-grid">
              <div className="inventory-entry">
                <WeaponIcon attackBonus={WEAPON_STATS[snapshot.player.weapon].attackBonus} />
                <div>
                  <div className="inventory-name">{WEAPON_STATS[snapshot.player.weapon].name}</div>
                  <div className="inventory-meta">Equipped weapon</div>
                </div>
              </div>
              <div className="inventory-entry">
                <WeaponIcon attackBonus={ARMOR_STATS[snapshot.player.armor].defenseBonus} />
                <div>
                  <div className="inventory-name">{ARMOR_STATS[snapshot.player.armor].name}</div>
                  <div className="inventory-meta">Equipped armor</div>
                </div>
              </div>
              <div className="inventory-entry">
                <ItemIcon kind="potion" />
                <div>
                  <div className="inventory-name">{ITEM_DATA.potion.name}</div>
                  <div className="inventory-meta">x{snapshot.player.items.potion}</div>
                </div>
              </div>
              <div className="inventory-entry">
                <ItemIcon kind="hiPotion" />
                <div>
                  <div className="inventory-name">{ITEM_DATA.hiPotion.name}</div>
                  <div className="inventory-meta">x{snapshot.player.items.hiPotion}</div>
                </div>
              </div>
              <div className="inventory-entry">
                <ItemIcon kind="megaPotion" />
                <div>
                  <div className="inventory-name">{ITEM_DATA.megaPotion.name}</div>
                  <div className="inventory-meta">x{snapshot.player.items.megaPotion}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="stats-card">
            <div className="inventory-header">Current Stats</div>
            <div className="stats-grid">
              <div className="stat-entry">
                <span className="stat-label">Attack Power</span>
                <span className="stat-value">
                  {attackPower} <small>(Base {snapshot.player.attack} + Weapon {weaponBonus})</small>
                </span>
              </div>
              <div className="stat-entry">
                <span className="stat-label">Defense</span>
                <span className="stat-value">
                  {defensePower} <small>(Base {snapshot.player.defense} + Armor {armorBonus})</small>
                </span>
              </div>
              <div className="stat-entry">
                <span className="stat-label">Speed</span>
                <span className="stat-value">{snapshot.player.speed}</span>
              </div>
              <div className="stat-entry">
                <span className="stat-label">Skill Cooldown</span>
                <span className="stat-value">{snapshot.battle.skillCooldown} turn(s)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="game-wrap">
          {USE_3D_OVERWORLD ? (
            <Overworld3D />
          ) : (
            <div ref={mountRef} className="phaser-mount" />
          )}
          <div className="touch-overlay">
            <div className="touch-pad">
              <DirButton dir="up" label="U" />
              <div className="row">
                <DirButton dir="left" label="L" />
                <DirButton dir="down" label="D" />
                <DirButton dir="right" label="R" />
              </div>
            </div>
          </div>
        </div>

        <div className="action-dock panel">
          <div className="row">
            <button onClick={() => gameStore.save()} disabled={!snapshot.world.inTown}>
              Save
            </button>
            <button onClick={() => gameStore.load()}>Load</button>
            <button onClick={() => gameStore.usePotionInField()} disabled={snapshot.battle.inBattle}>
              Use Potion
            </button>
          </div>
          <div className="row reset-game-row">
            <button
              type="button"
              className="reset-game-btn"
              onClick={() => {
                if (!window.confirm("Start a new journey? This clears your character and world progress.")) {
                  return;
                }
                gameStore.resetGame();
              }}
              disabled={snapshot.battle.inBattle || !snapshot.player.bossDefeated}
              title={
                snapshot.player.bossDefeated
                  ? undefined
                  : "Defeat the Void Titan in the southeast arena to unlock."
              }
            >
              Reset Game
            </button>
          </div>

          {snapshot.world.canShop && (
            <div className="box">
              <strong>Shop</strong>
              <div className="row">
                <button onClick={() => gameStore.buyPotion()} disabled={gold < ITEM_DATA.potion.price}>
                  Buy Potion ({ITEM_DATA.potion.price}g)
                </button>
                <button onClick={() => gameStore.buyHiPotion()} disabled={gold < ITEM_DATA.hiPotion.price}>
                  Buy Hi-Potion ({ITEM_DATA.hiPotion.price}g)
                </button>
                <button onClick={() => gameStore.buyMegaPotion()} disabled={gold < ITEM_DATA.megaPotion.price}>
                  Buy Mega Potion ({ITEM_DATA.megaPotion.price}g)
                </button>
                <button onClick={() => gameStore.buyIronSword()} disabled={gold < WEAPON_STATS.ironSword.price}>
                  Buy Iron Sword ({WEAPON_STATS.ironSword.price}g)
                </button>
                <button onClick={() => gameStore.buySteelSword()} disabled={gold < WEAPON_STATS.steelSword.price}>
                  Buy Steel Sword ({WEAPON_STATS.steelSword.price}g)
                </button>
                <button onClick={() => gameStore.buyMythrilBlade()} disabled={gold < WEAPON_STATS.mythrilBlade.price}>
                  Buy Mythril Blade ({WEAPON_STATS.mythrilBlade.price}g)
                </button>
                <button onClick={() => gameStore.buyChainMail()} disabled={gold < ARMOR_STATS.chainMail.price}>
                  Buy Chain Mail ({ARMOR_STATS.chainMail.price}g)
                </button>
                <button onClick={() => gameStore.buyKnightArmor()} disabled={gold < ARMOR_STATS.knightArmor.price}>
                  Buy Knight Armor ({ARMOR_STATS.knightArmor.price}g)
                </button>
                <button onClick={() => gameStore.buyDragonArmor()} disabled={gold < ARMOR_STATS.dragonArmor.price}>
                  Buy Dragon Armor ({ARMOR_STATS.dragonArmor.price}g)
                </button>
              </div>
            </div>
          )}

          {snapshot.world.canHeal && (
            <div className="box">
              <strong>Inn</strong>
              <button
                onClick={() => gameStore.healAtInn()}
                disabled={snapshot.player.hp >= snapshot.player.maxHp}
              >
                Rest (10g)
              </button>
            </div>
          )}

          {snapshot.world.canTrain && (
            <div className="box">
              <strong>Training Hall</strong> <span className="training-fee">({trainFee}g each)</span>
              <div className="row">
                <button onClick={() => gameStore.trainAttack()} disabled={!canAffordTraining}>
                  Train Attack
                </button>
                <button onClick={() => gameStore.trainDefense()} disabled={!canAffordTraining}>
                  Train Defense
                </button>
                <button onClick={() => gameStore.trainSpeed()} disabled={!canAffordTraining}>
                  Train Speed
                </button>
              </div>
            </div>
          )}

          {snapshot.world.canGuild && (
            <div className="box">
              <strong>Guild Board</strong>
              <p>
                Defeats: {snapshot.player.monstersDefeated} | Target: {4 + snapshot.player.bountyTier * 2}
              </p>
              <button
                onClick={() => gameStore.claimGuildBounty()}
                disabled={snapshot.player.monstersDefeated < 4 + snapshot.player.bountyTier * 2}
              >
                Claim Bounty
              </button>
            </div>
          )}

          {snapshot.world.canBoss && (
            <div className="box boss-arena">
              <strong>Void Arena</strong>
              <p className="boss-arena-hint">The Void Titan awaits.</p>
              <button
                type="button"
                onClick={() => gameStore.challengeBoss()}
                disabled={snapshot.battle.inBattle || snapshot.player.bossDefeated}
              >
                {snapshot.player.bossDefeated ? "Void Titan defeated" : "Challenge Void Titan"}
              </button>
            </div>
          )}

        </div>
      </div>

      <div className="right-column panel">
        <div className="box log">
          <strong>Event Log</strong>
          {snapshot.eventLog.map((line, idx) => (
            <p key={`event-${idx}`}>{line}</p>
          ))}
        </div>
        <div className="box log">
          <strong>Battle Log</strong>
          {snapshot.battle.log.map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>
        {snapshot.battle.inBattle && snapshot.battle.enemy && (
          <div className="box monster-panel">
            <strong>Monster</strong>
            <MonsterPortrait enemy={snapshot.battle.enemy} />
            <p className="monster-name">{snapshot.battle.enemy.name}</p>
            <div className="hp-meter enemy">
              <div className="hp-meter-head">
                <strong>HP</strong>
                <span>
                  {snapshot.battle.enemy.hp}/{snapshot.battle.enemy.maxHp}
                </span>
              </div>
              <div className="hp-meter-track">
                <div className="hp-meter-fill enemy" style={{ width: `${enemyHpPercent}%` }} />
              </div>
            </div>
            <div className="battle-actions">
              <div className="battle-action-primary row">
                <button onClick={() => gameStore.playerAttack()} disabled={snapshot.battle.phase !== "playerTurn"}>
                  Attack
                </button>
                <button onClick={() => gameStore.attemptRun()} disabled={snapshot.battle.phase !== "playerTurn"}>
                  Run
                </button>
              </div>
              {unlockedSkills.length > 0 && (
                <div className="battle-action-group">
                  <span className="battle-action-label">Skills</span>
                  <div className="row battle-skill-row">
                    {unlockedSkills.map((skill) => (
                      <button
                        key={skill}
                        onClick={() => gameStore.playerSkill(skill as SkillKey)}
                        disabled={snapshot.battle.phase !== "playerTurn" || snapshot.battle.skillCooldown > 0}
                      >
                        {SKILL_DATA[skill].name}{" "}
                        {snapshot.battle.skillCooldown > 0 ? `(CD ${snapshot.battle.skillCooldown})` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="battle-action-group">
                <span className="battle-action-label">Items</span>
                <div className="row battle-item-row">
                  <button
                    onClick={() => gameStore.usePotion("potion")}
                    disabled={snapshot.battle.phase !== "playerTurn" || snapshot.player.items.potion <= 0}
                  >
                    Potion ×{snapshot.player.items.potion}
                  </button>
                  <button
                    onClick={() => gameStore.usePotion("hiPotion")}
                    disabled={snapshot.battle.phase !== "playerTurn" || snapshot.player.items.hiPotion <= 0}
                  >
                    Hi-Potion ×{snapshot.player.items.hiPotion}
                  </button>
                  <button
                    onClick={() => gameStore.usePotion("megaPotion")}
                    disabled={snapshot.battle.phase !== "playerTurn" || snapshot.player.items.megaPotion <= 0}
                  >
                    Mega Potion ×{snapshot.player.items.megaPotion}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
