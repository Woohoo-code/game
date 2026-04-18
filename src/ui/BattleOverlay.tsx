import { SKILL_DATA, getUnlockedSkills } from "../game/data";
import { gameStore } from "../game/state";
import type { SkillKey } from "../game/types";
import { useGameStore } from "../game/useGameStore";
import { MonsterPortrait3D } from "../game3d/MonsterPortrait3D";

export function BattleOverlay() {
  const snapshot = useGameStore();
  const unlockedSkills = getUnlockedSkills(snapshot.player.level);
  const xpPercent = Math.max(0, Math.min(100, Math.round((snapshot.player.xp / snapshot.player.xpToNext) * 100)));
  const playerHpPercent = Math.max(0, Math.min(100, Math.round((snapshot.player.hp / snapshot.player.maxHp) * 100)));
  const enemy = snapshot.battle.enemy;
  const enemyHpPercent = enemy
    ? Math.max(0, Math.min(100, Math.round((enemy.hp / enemy.maxHp) * 100)))
    : 0;

  if (!snapshot.battle.inBattle || !enemy) {
    return null;
  }

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true" aria-label="Battle">
      <div className="battle-overlay-backdrop" aria-hidden />
      <div className="battle-overlay-panel">
        <div className="battle-overlay-grid">
          <div className="battle-overlay-column battle-overlay-column-player">
            <div className="battle-player-hud battle-player-hud--overlay">
              <div className="battle-player-hud-head">
                <strong>{snapshot.player.name}</strong>
                <span>
                  Lv {snapshot.player.level} · {snapshot.player.hp}/{snapshot.player.maxHp} HP ·{" "}
                  {snapshot.player.gold}g
                </span>
              </div>
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
            </div>
          </div>

          <div className="battle-overlay-column battle-overlay-column-foe">
            <div className="box monster-panel monster-panel--overlay">
              <strong>Monster</strong>
              <MonsterPortrait3D enemy={enemy} />
              <p className="monster-name">{enemy.name}</p>
              <div className="hp-meter enemy">
                <div className="hp-meter-head">
                  <strong>HP</strong>
                  <span>
                    {enemy.hp}/{enemy.maxHp}
                  </span>
                </div>
                <div className="hp-meter-track">
                  <div className="hp-meter-fill enemy" style={{ width: `${enemyHpPercent}%` }} />
                </div>
              </div>
              <div className="box log battle-overlay-battle-log">
                <strong>Battle Log</strong>
                {snapshot.battle.log.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
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
                          disabled={
                            snapshot.battle.phase !== "playerTurn" || (snapshot.battle.skillCooldowns[skill] ?? 0) > 0
                          }
                        >
                          {SKILL_DATA[skill].name}{" "}
                          {(snapshot.battle.skillCooldowns[skill] ?? 0) > 0
                            ? `(CD ${snapshot.battle.skillCooldowns[skill]})`
                            : ""}
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
          </div>
        </div>
      </div>
      <div className="battle-overlay-flashburst" aria-hidden />
    </div>
  );
}
