import { useCallback, useEffect, useRef, useState } from "react";
import { isLanGuest } from "../coop/lanCoop";
import { SKILL_DATA, getUnlockedSkills } from "../game/data";
import { gameStore } from "../game/state";
import type { SkillKey } from "../game/types";
import { useGameStore } from "../game/useGameStore";
import { MonsterPortrait3D } from "../game3d/MonsterPortrait3D";
import { IconGold } from "./IconGold";

/** Short pause after picking a command so each choice reads clearly before resolving. */
const BATTLE_ACTION_DELAY_MS = 420;

export function BattleOverlay() {
  const snapshot = useGameStore();
  const [actionPending, setActionPending] = useState(false);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knockoutAckRef = useRef<HTMLButtonElement | null>(null);
  const knockoutFocusDoneRef = useRef(false);

  const queueBattleAction = useCallback((run: () => void) => {
    if (isLanGuest()) return;
    if (actionPending) return;
    const snap = gameStore.getSnapshot();
    if (!snap.battle.inBattle || snap.battle.phase !== "playerTurn") return;
    setActionPending(true);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    actionTimerRef.current = setTimeout(() => {
      actionTimerRef.current = null;
      try {
        const s = gameStore.getSnapshot();
        if (s.battle.inBattle && s.battle.phase === "playerTurn") {
          run();
        }
      } finally {
        setActionPending(false);
      }
    }, BATTLE_ACTION_DELAY_MS);
  }, [actionPending]);

  useEffect(() => {
    return () => {
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!snapshot.battle.inBattle) {
      knockoutFocusDoneRef.current = false;
      if (actionTimerRef.current) {
        clearTimeout(actionTimerRef.current);
        actionTimerRef.current = null;
      }
      setActionPending(false);
    }
  }, [snapshot.battle.inBattle]);

  useEffect(() => {
    if (!snapshot.battle.inBattle || snapshot.battle.phase !== "knockoutPending" || isLanGuest()) {
      return;
    }
    if (knockoutFocusDoneRef.current) return;
    knockoutFocusDoneRef.current = true;
    const id = window.requestAnimationFrame(() => knockoutAckRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [snapshot.battle.inBattle, snapshot.battle.phase]);

  const unlockedSkills = getUnlockedSkills(snapshot.player.level);
  const xpPercent = Math.max(0, Math.min(100, Math.round((snapshot.player.xp / snapshot.player.xpToNext) * 100)));
  const playerHpPercent = Math.max(0, Math.min(100, Math.round((snapshot.player.hp / snapshot.player.maxHp) * 100)));
  const enemy = snapshot.battle.enemy;
  const enemyHpPercent = enemy
    ? Math.max(0, Math.min(100, Math.round((enemy.hp / enemy.maxHp) * 100)))
    : 0;
  const knockoutPending = snapshot.battle.phase === "knockoutPending";
  const victoryPending = snapshot.battle.phase === "victoryPending";

  if (!snapshot.battle.inBattle || !enemy) {
    return null;
  }

  const actionsLocked =
    isLanGuest() ||
    snapshot.battle.phase !== "playerTurn" ||
    actionPending ||
    knockoutPending ||
    victoryPending;

  const panelModClass = knockoutPending
    ? " battle-overlay-panel--knockout-dim"
    : victoryPending
      ? " battle-overlay-panel--victory-linger"
      : "";

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true" aria-label="Battle">
      <div className="battle-overlay-backdrop" aria-hidden />
      <div className={`battle-overlay-panel${panelModClass}`}>
        <div className="battle-overlay-grid">
          <div className="battle-overlay-column battle-overlay-column-main">
            <div className="battle-player-hud battle-player-hud--overlay">
              <div className="battle-player-hud-head">
                <div className="battle-player-hud-head-main">
                  <strong>{snapshot.player.name}</strong>
                  <span>
                    Lv {snapshot.player.level} · {snapshot.player.hp}/{snapshot.player.maxHp} HP
                  </span>
                </div>
                <div className="battle-gold-row" role="status" title={`Gold: ${snapshot.player.gold}`}>
                  <IconGold size={22} className="battle-gold-icon" />
                  <span className="battle-gold-value">{snapshot.player.gold}</span>
                </div>
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
              {((snapshot.battle.itemAttackBonus ?? 0) > 0 || (snapshot.battle.itemDefenseBonus ?? 0) > 0) && (
                <p className="battle-item-buffs" role="status">
                  Item potency: +{snapshot.battle.itemAttackBonus ?? 0} ATK · +{snapshot.battle.itemDefenseBonus ?? 0}{" "}
                  DEF this fight
                </p>
              )}
            </div>
            <div className="box monster-panel monster-panel--overlay">
              <strong>Monster</strong>
              <MonsterPortrait3D enemy={enemy} />
              <p className="monster-name">{enemy.name}</p>
              <div className="hp-meter enemy">
                <div className="hp-meter-head">
                  <strong>HP</strong>
                  <span>{victoryPending ? "Defeated" : `${enemy.hp}/${enemy.maxHp}`}</span>
                </div>
                <div className="hp-meter-track">
                  <div className="hp-meter-fill enemy" style={{ width: `${enemyHpPercent}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="battle-overlay-column battle-overlay-column-actions">
            {victoryPending && (
              <div className="battle-victory-linger" role="status" aria-live="polite">
                <strong>Victory</strong>
                <p>Rewards are logged below. Returning to the field in a moment…</p>
              </div>
            )}
            <div className="battle-actions">
              <div className="battle-action-primary row">
                <button onClick={() => queueBattleAction(() => gameStore.playerAttack())} disabled={actionsLocked}>
                  Attack
                </button>
                <button onClick={() => queueBattleAction(() => gameStore.attemptRun())} disabled={actionsLocked}>
                  Run
                </button>
              </div>
              {unlockedSkills.length > 0 && (
                <div className="battle-action-group">
                  <span className="battle-action-label">
                    Skills
                    {(snapshot.battle.skillCooldown ?? 0) > 0
                      ? ` · CD ${snapshot.battle.skillCooldown}`
                      : ""}
                  </span>
                  <div className="row battle-skill-row">
                    {unlockedSkills.map((skill) => (
                      <button
                        key={skill}
                        onClick={() => queueBattleAction(() => gameStore.playerSkill(skill as SkillKey))}
                        disabled={actionsLocked || (snapshot.battle.skillCooldown ?? 0) > 0}
                      >
                        {SKILL_DATA[skill].name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="battle-action-group battle-action-group--items-hint">
                <span className="battle-action-label">Items</span>
                <p className="battle-items-hint">
                  Use the bottom hotbar: keys <kbd>1</kbd>–<kbd>9</kbd> and <kbd>0</kbd>. Open the backpack to assign
                  consumables to slots.
                </p>
              </div>
            </div>
            <div className="box log battle-overlay-battle-log">
              <strong>Battle Log</strong>
              {snapshot.battle.log.map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="battle-overlay-flashburst" aria-hidden />
      {knockoutPending && (
        <div
          className="battle-death-screen"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="battle-death-title"
          aria-describedby="battle-death-desc"
        >
          <div className="battle-death-screen__vignette" aria-hidden />
          <div className="battle-death-screen__content">
            <p className="battle-death-screen__eyebrow" aria-hidden>
              Defeat
            </p>
            <h2 id="battle-death-title" className="battle-death-screen__title">
              You have fallen
            </h2>
            <p id="battle-death-desc" className="battle-death-screen__subtitle">
              {enemy.name} struck the final blow. If you continue, the Guild seizes <strong>all your gold</strong> and your{" "}
              <strong>equipped weapon and armor</strong> (replaced with starter gear) before dragging you to safety.
            </p>
            {isLanGuest() ? (
              <p className="battle-death-screen__guest-hint" role="status">
                Waiting for the host to acknowledge…
              </p>
            ) : (
              <button
                ref={knockoutAckRef}
                type="button"
                className="battle-death-screen__ack"
                onClick={() => gameStore.acknowledgeKnockout()}
              >
                Acknowledge defeat and continue
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
