import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  BATTLE_STANCE_ORDER,
  BATTLE_STANCES,
  ITEM_DATA,
  SKILL_DATA,
  WEAPON_STATS,
  formatItemTooltipSummary,
  orderedLearnedSkills
} from "../game/data";
import { HOTBAR_KEY_LABELS, HOTBAR_SIZE, itemHotbarAbbr, normalizeItemHotbar } from "../game/inventoryHotbar";
import { ELEMENT_LABEL, ELEMENT_SYMBOL } from "../game/elements";
import { gameStore } from "../game/state";
import type { BattleVictorySummary, EnemyState, SkillKey } from "../game/types";
import { useGameStore } from "../game/useGameStore";
import { MonsterPortrait3D } from "../game3d/MonsterPortrait3D";
import { IconGold } from "./IconGold";

/** Short pause after picking a command so each choice reads clearly before resolving. */
const BATTLE_ACTION_DELAY_MS = 420;

function keyboardTargetIsTyping(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

function EnemyStatusChips({ enemy }: { enemy: EnemyState }) {
  const oiled = enemy.oiled ?? 0;
  const marked = !!enemy.marked;
  const shred = enemy.shredStacks ?? 0;
  if (oiled <= 0 && !marked && shred <= 0) return null;
  return (
    <div className="enemy-status-chips" aria-label="Active debuffs">
      {oiled > 0 && (
        <span
          className="enemy-status-chip enemy-status-chip--oil"
          title="Oil: fire attacks deal +40% damage"
        >
          Oil · {oiled}
        </span>
      )}
      {marked && (
        <span
          className="enemy-status-chip enemy-status-chip--mark"
          title="Marked: your next strike auto-crits"
        >
          Marked
        </span>
      )}
      {shred > 0 && (
        <span
          className={`enemy-status-chip enemy-status-chip--shred${shred >= 3 ? " enemy-status-chip--shred-primed" : ""}`}
          title={
            shred >= 3
              ? "Shred primed — next Shred detonates for heavy damage"
              : `Shred stacks · detonates at 3+`
          }
        >
          Shred · {shred}/5{shred >= 3 ? " · PRIMED" : ""}
        </span>
      )}
    </div>
  );
}

function PlayerHitFlash({ lastEnemyHitAt }: { lastEnemyHitAt: number }) {
  const [visible, setVisible] = useState(false);
  const prev = useRef(0);
  useEffect(() => {
    if (lastEnemyHitAt > prev.current) {
      prev.current = lastEnemyHitAt;
      setVisible(true);
      const t = window.setTimeout(() => setVisible(false), 260);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [lastEnemyHitAt]);
  return <div className={`battle-hit-flash${visible ? " battle-hit-flash--on" : ""}`} aria-hidden />;
}

function BattleHpMeterTrack({
  hp,
  maxHp,
  variant
}: {
  hp: number;
  maxHp: number;
  variant: "player" | "enemy";
}) {
  const fraction = maxHp > 0 ? hp / maxHp : 0;
  const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  const prevFrac = useRef(fraction);
  const [flash, setFlash] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const prev = prevFrac.current;
    if (fraction < prev - 1e-8 && maxHp > 0) {
      const fromPct = Math.max(0, Math.min(100, Math.round(prev * 100)));
      const toPct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
      setFlash({ left: toPct, width: Math.max(0, fromPct - toPct) });
      const t = window.setTimeout(() => setFlash(null), 1000);
      prevFrac.current = fraction;
      return () => window.clearTimeout(t);
    }
    prevFrac.current = fraction;
  }, [fraction, maxHp]);

  const sliceStyle: CSSProperties | undefined =
    flash && flash.width > 0
      ? { left: `${flash.left}%`, width: `${flash.width}%` }
      : undefined;

  return (
    <div className="hp-meter-track battle-hp-meter-track">
      <div className={`hp-meter-fill${variant === "enemy" ? " enemy" : ""}`} style={{ width: `${pct}%` }} />
      {sliceStyle ? <div className="battle-hp-flash-slice" style={sliceStyle} /> : null}
    </div>
  );
}

function VictorySummaryLines({ summary }: { summary: BattleVictorySummary }) {
  return (
    <ul className="battle-victory-summary-list">
      <li>
        <strong>+{summary.xpGained}</strong> XP
      </li>
      <li>
        <strong>+{summary.goldGained}</strong> gold
        {summary.luckyGold ? <span className="battle-victory-lucky"> (lucky drop!)</span> : null}
      </li>
      {summary.itemDropName ? (
        <li>
          Item: <strong>{summary.itemDropName}</strong>
        </li>
      ) : null}
      {summary.levelsGained > 0 ? (
        <li>
          Level{summary.levelsGained > 1 ? "s" : ""} gained: <strong>+{summary.levelsGained}</strong>
        </li>
      ) : null}
      {summary.petTamedName ? (
        <li>
          New pet: <strong>{summary.petTamedName}</strong>
        </li>
      ) : null}
    </ul>
  );
}

type Props = {
  battleLogCollapsed?: boolean;
  onToggleBattleLogCollapse?: () => void;
};

export function BattleOverlay({ battleLogCollapsed = false, onToggleBattleLogCollapse }: Props) {
  const snapshot = useGameStore();
  const [actionPending, setActionPending] = useState(false);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knockoutAckRef = useRef<HTMLButtonElement | null>(null);
  const knockoutFocusDoneRef = useRef(false);

  const queueBattleAction = useCallback((run: () => void) => {
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
    if (!snapshot.battle.inBattle || snapshot.battle.phase !== "knockoutPending") {
      return;
    }
    if (knockoutFocusDoneRef.current) return;
    knockoutFocusDoneRef.current = true;
    const id = window.requestAnimationFrame(() => knockoutAckRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [snapshot.battle.inBattle, snapshot.battle.phase]);

  useEffect(() => {
    if (!snapshot.battle.inBattle) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (keyboardTargetIsTyping(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        queueBattleAction(() => gameStore.playerAttack());
        return;
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        e.preventDefault();
        queueBattleAction(() => gameStore.playerAttack());
        return;
      }
      if (e.code === "KeyE") {
        e.preventDefault();
        queueBattleAction(() => gameStore.playerDodge());
        return;
      }
      if (e.code === "KeyB") {
        e.preventDefault();
        queueBattleAction(() => gameStore.playerBrace());
        return;
      }
      if (e.code === "KeyH") {
        e.preventDefault();
        queueBattleAction(() => gameStore.playerHeavyStrike());
        return;
      }
      if (e.code === "KeyD") {
        e.preventDefault();
        queueBattleAction(() => gameStore.playerDashAttack());
        return;
      }
      if (e.code === "KeyG") {
        e.preventDefault();
        queueBattleAction(() => gameStore.playerGuard());
        return;
      }
      if (e.code === "KeyR") {
        e.preventDefault();
        queueBattleAction(() => gameStore.playerRiskStrike());
        return;
      }
      if (e.code === "KeyO") {
        e.preventDefault();
        queueBattleAction(() => gameStore.playerOil());
        return;
      }
      if (e.code === "KeyM") {
        e.preventDefault();
        queueBattleAction(() => gameStore.playerMark());
        return;
      }
      if (e.code === "KeyS") {
        e.preventDefault();
        queueBattleAction(() => gameStore.playerShred());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [snapshot.battle.inBattle, queueBattleAction]);

  const unlockedSkills = orderedLearnedSkills(snapshot.player.learnedSkills);
  const xpPercent = Math.max(0, Math.min(100, Math.round((snapshot.player.xp / snapshot.player.xpToNext) * 100)));
  const enemy = snapshot.battle.enemy;
  const knockoutPending = snapshot.battle.phase === "knockoutPending";
  const victoryPending = snapshot.battle.phase === "victoryPending";

  if (!snapshot.battle.inBattle || !enemy) {
    return null;
  }

  const actionsLocked =
    snapshot.battle.phase !== "playerTurn" ||
    actionPending ||
    knockoutPending ||
    victoryPending;

  const panelModClass = knockoutPending
    ? " battle-overlay-panel--knockout-dim"
    : victoryPending
      ? " battle-overlay-panel--victory-linger"
      : "";

  const positional = snapshot.battle.positional;
  const hasPositional = !!(positional?.highGround || positional?.ambush);
  const lastEnemyHitAt = snapshot.battle.lastEnemyHitAt ?? 0;

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true" aria-label="Battle">
      <div className="battle-overlay-backdrop" aria-hidden />
      <div className={`battle-overlay-panel${panelModClass}`}>
        <PlayerHitFlash lastEnemyHitAt={lastEnemyHitAt} />
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
                <BattleHpMeterTrack hp={snapshot.player.hp} maxHp={snapshot.player.maxHp} variant="player" />
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
              {hasPositional && (
                <p className="battle-positional" role="status">
                  {positional?.highGround && (
                    <span className="battle-positional-chip battle-positional-chip--high">
                      High ground · +15% dmg
                    </span>
                  )}
                  {positional?.ambush && (
                    <span className="battle-positional-chip battle-positional-chip--ambush">
                      Ambush ready · +20% next strike
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="box monster-panel monster-panel--overlay">
              <strong>Monster</strong>
              <MonsterPortrait3D enemy={enemy} />
              <p className="monster-name">
                {enemy.name}{" "}
                <span className="battle-foe-elem" title={`${ELEMENT_LABEL[enemy.element]} — foe`} aria-hidden>
                  {ELEMENT_SYMBOL[enemy.element]}
                </span>
              </p>
              <div className="hp-meter enemy">
                <div className="hp-meter-head">
                  <strong>HP</strong>
                  <span>{victoryPending ? "Defeated" : `${enemy.hp}/${enemy.maxHp}`}</span>
                </div>
                <BattleHpMeterTrack hp={enemy.hp} maxHp={enemy.maxHp} variant="enemy" />
              </div>
              <EnemyStatusChips enemy={enemy} />
            </div>
          </div>

          <div className="battle-overlay-column battle-overlay-column-actions">
            {victoryPending && (
              <div className="battle-victory-linger" role="status" aria-live="polite">
                <strong className="battle-victory-title">Victory!</strong>
                {snapshot.battle.victorySummary ? (
                  <VictorySummaryLines summary={snapshot.battle.victorySummary} />
                ) : (
                  <p className="battle-victory-fallback">Returning to the field in a moment…</p>
                )}
              </div>
            )}
            <div className="battle-actions">
              <div className="battle-action-group battle-stance-group">
                <span className="battle-action-label">Fighting style</span>
                <div className="battle-stance-row" role="radiogroup" aria-label="Fighting style">
                  {BATTLE_STANCE_ORDER.map((key) => {
                    const active = snapshot.battle.stance === key;
                    const row = BATTLE_STANCES[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`battle-stance-btn${active ? " battle-stance-btn--active" : ""}`}
                        disabled={actionsLocked}
                        title={row.blurb}
                        onClick={() => gameStore.setBattleStance(key)}
                      >
                        {row.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="battle-action-primary row">
                <button
                  type="button"
                  onClick={() => queueBattleAction(() => gameStore.playerAttack())}
                  disabled={actionsLocked}
                  title={`${ELEMENT_LABEL[WEAPON_STATS[snapshot.player.weapon].element]} attack — Space or Shift`}
                  aria-label="Weapon attack"
                  aria-keyshortcuts="Space Shift"
                >
                  <span className="battle-btn-elem" title={`${ELEMENT_LABEL[WEAPON_STATS[snapshot.player.weapon].element]} attack`} aria-hidden>
                    {ELEMENT_SYMBOL[WEAPON_STATS[snapshot.player.weapon].element]}
                  </span>{" "}
                  Attack <kbd className="battle-attack-kbd">Space</kbd>
                  <span className="battle-attack-kbd-alt" aria-hidden>
                    {" "}
                    / <kbd className="battle-attack-kbd">⇧</kbd>
                  </span>
                </button>
                <button onClick={() => queueBattleAction(() => gameStore.attemptRun())} disabled={actionsLocked}>
                  Run
                </button>
              </div>
              <div className="battle-action-group battle-tactical-group">
                <span className="battle-action-label">
                  Tactics
                  <span className="battle-guard-energy" title="Guard energy — fuels Risk Strike">
                    {" · Energy "}
                    <strong>{snapshot.battle.guardEnergy ?? 0}</strong>/3
                  </span>
                </span>
                <p className="battle-tactical-hint">
                  <strong>Dodge</strong> (E) may evade · <strong>Brace</strong> (B) softens ·{" "}
                  <strong>Heavy</strong> (H) 2× dmg but you lose a turn ·{" "}
                  <strong>Dash</strong> (D) half dmg, resets evasion + ambush ·{" "}
                  <strong>Guard</strong> (G) halves next hit + builds Energy ·{" "}
                  <strong>Risk</strong> (R) gamble for a huge payoff (Energy boosts odds).
                </p>
                <div className="row battle-tactical-row">
                  <button
                    type="button"
                    onClick={() => queueBattleAction(() => gameStore.playerDodge())}
                    disabled={actionsLocked}
                    title="Spend this turn; roll evasion on the enemy's next attack (hotkey: E)"
                  >
                    Dodge <kbd className="battle-attack-kbd">E</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => queueBattleAction(() => gameStore.playerBrace())}
                    disabled={actionsLocked}
                    title="Spend this turn; reduce damage from the enemy's next hit (hotkey: B)"
                  >
                    Brace <kbd className="battle-attack-kbd">B</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => queueBattleAction(() => gameStore.playerHeavyStrike())}
                    disabled={actionsLocked}
                    title="2× damage but the enemy gets a free extra swing (hotkey: H)"
                    className="battle-tactical-btn battle-tactical-btn--heavy"
                  >
                    Heavy <kbd className="battle-attack-kbd">H</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => queueBattleAction(() => gameStore.playerDashAttack())}
                    disabled={actionsLocked}
                    title="Half-damage hit — refreshes Dodge and Ambush for next turn (hotkey: D)"
                    className="battle-tactical-btn battle-tactical-btn--dash"
                  >
                    Dash <kbd className="battle-attack-kbd">D</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => queueBattleAction(() => gameStore.playerGuard())}
                    disabled={actionsLocked}
                    title="Halve the next incoming hit and bank +1 Energy (hotkey: G)"
                    className="battle-tactical-btn battle-tactical-btn--guard"
                  >
                    Guard <kbd className="battle-attack-kbd">G</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => queueBattleAction(() => gameStore.playerRiskStrike())}
                    disabled={actionsLocked}
                    title="Gamble: base 55% to hit for ~2.2× dmg; energy boosts odds and damage. Miss costs 8% max HP (hotkey: R)"
                    className="battle-tactical-btn battle-tactical-btn--risk"
                  >
                    Risk <kbd className="battle-attack-kbd">R</kbd>
                  </button>
                </div>
              </div>
              <div className="battle-action-group battle-debuff-group">
                <span className="battle-action-label">Debuffs</span>
                <p className="battle-tactical-hint">
                  <strong>Oil</strong> (O) — 3 turns; fire attacks +40%.{" "}
                  <strong>Mark</strong> (M) — next strike auto-crits.{" "}
                  <strong>Shred</strong> (S) — stacks to 5; at 3+ stacks it detonates.
                </p>
                <div className="row battle-tactical-row">
                  <button
                    type="button"
                    onClick={() => queueBattleAction(() => gameStore.playerOil())}
                    disabled={actionsLocked}
                    title="Coat the foe for 3 turns; fire attacks deal +40% while active (hotkey: O)"
                    className="battle-tactical-btn battle-tactical-btn--oil"
                  >
                    Oil <kbd className="battle-attack-kbd">O</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => queueBattleAction(() => gameStore.playerMark())}
                    disabled={actionsLocked}
                    title="Your next offensive strike auto-crits (hotkey: M)"
                    className="battle-tactical-btn battle-tactical-btn--mark"
                  >
                    Mark <kbd className="battle-attack-kbd">M</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => queueBattleAction(() => gameStore.playerShred())}
                    disabled={actionsLocked}
                    title="Deal ~55% dmg + add a shred stack (cap 5). 3+ stacks triggers a detonation (hotkey: S)"
                    className="battle-tactical-btn battle-tactical-btn--shred"
                  >
                    Shred <kbd className="battle-attack-kbd">S</kbd>
                  </button>
                </div>
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
                        <span
                          className="battle-btn-elem"
                          title={`${ELEMENT_LABEL[SKILL_DATA[skill].element]} — ${SKILL_DATA[skill].name}`}
                          aria-hidden
                        >
                          {ELEMENT_SYMBOL[SKILL_DATA[skill].element]}
                        </span>{" "}
                        {SKILL_DATA[skill].name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="battle-action-group battle-action-group--items">
                <span className="battle-action-label">Items</span>
                <p className="battle-items-hint">
                  Tap a slot or use <kbd>1</kbd>–<kbd>9</kbd> / <kbd>0</kbd> or numpad (assign in the backpack).
                </p>
                <div className="battle-item-hotbar" role="toolbar" aria-label="Battle consumable hotbar">
                  {Array.from({ length: HOTBAR_SIZE }, (_, i) => {
                    const hotbar = normalizeItemHotbar(snapshot.player.itemHotbar);
                    const itemKey = hotbar[i];
                    const qty = itemKey ? snapshot.player.items[itemKey] ?? 0 : 0;
                    const slotDisabled = actionsLocked || !itemKey || qty <= 0;
                    const title = itemKey
                      ? `${ITEM_DATA[itemKey].name} ×${qty}\n${formatItemTooltipSummary(itemKey)} · Hotkey ${HOTBAR_KEY_LABELS[i]}`
                      : `Empty slot · Hotkey ${HOTBAR_KEY_LABELS[i]}`;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`battle-item-hotbar-slot${itemKey ? "" : " battle-item-hotbar-slot--empty"}`}
                        title={title}
                        aria-label={
                          itemKey
                            ? `Use ${ITEM_DATA[itemKey].name} from slot ${HOTBAR_KEY_LABELS[i]}`
                            : `Empty hotbar slot ${HOTBAR_KEY_LABELS[i]}`
                        }
                        disabled={slotDisabled}
                        onClick={() =>
                          queueBattleAction(() => {
                            gameStore.useHotbarSlot(i);
                          })
                        }
                      >
                        <span className="battle-item-hotbar-key">{HOTBAR_KEY_LABELS[i]}</span>
                        {itemKey ? (
                          <>
                            <span className="battle-item-hotbar-abbr">{itemHotbarAbbr(itemKey)}</span>
                            <span className="battle-item-hotbar-qty">×{qty}</span>
                          </>
                        ) : (
                          <span className="battle-item-hotbar-dash">—</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {battleLogCollapsed ? (
              <button
                type="button"
                className="log-collapsed-chip battle-log-collapsed-chip"
                onClick={() => onToggleBattleLogCollapse?.()}
                aria-label="Expand battle log"
              >
                Battle Log
              </button>
            ) : (
              <div className="box log battle-overlay-battle-log">
                <div className="log-collapsible-head">
                  <strong>Battle Log</strong>
                  <button
                    type="button"
                    className="log-collapse-btn"
                    onClick={() => onToggleBattleLogCollapse?.()}
                    aria-label="Collapse battle log"
                    title="Collapse"
                  >
                    —
                  </button>
                </div>
                {snapshot.battle.log.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            )}
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
            <button
              ref={knockoutAckRef}
              type="button"
              className="battle-death-screen__ack"
              onClick={() => gameStore.acknowledgeKnockout()}
            >
              Acknowledge defeat and continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
