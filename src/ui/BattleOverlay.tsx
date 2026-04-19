import { useCallback, useEffect, useRef, useState } from "react";
import {
  BATTLE_STANCE_ORDER,
  BATTLE_STANCES,
  ITEM_DATA,
  SKILL_DATA,
  WEAPON_STATS,
  formatItemTooltipSummary,
  getUnlockedSkills
} from "../game/data";
import { HOTBAR_KEY_LABELS, HOTBAR_SIZE, itemHotbarAbbr, normalizeItemHotbar } from "../game/inventoryHotbar";
import { ELEMENT_LABEL, ELEMENT_SYMBOL } from "../game/elements";
import { gameStore } from "../game/state";
import type { SkillKey } from "../game/types";
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

export function BattleOverlay() {
  const snapshot = useGameStore();
  const [actionPending, setActionPending] = useState(false);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (actionTimerRef.current) {
        clearTimeout(actionTimerRef.current);
        actionTimerRef.current = null;
      }
      setActionPending(false);
    }
  }, [snapshot.battle.inBattle]);

  useEffect(() => {
    if (!snapshot.battle.inBattle) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (keyboardTargetIsTyping(e.target)) return;
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
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [snapshot.battle.inBattle, queueBattleAction]);

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

  const actionsLocked = snapshot.battle.phase !== "playerTurn" || actionPending;

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true" aria-label="Battle">
      <div className="battle-overlay-backdrop" aria-hidden />
      <div className="battle-overlay-panel">
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
              <p className="monster-name">
                {enemy.name}{" "}
                <span className="battle-foe-elem" title={`${ELEMENT_LABEL[enemy.element]} — foe`} aria-hidden>
                  {ELEMENT_SYMBOL[enemy.element]}
                </span>
              </p>
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
            </div>
          </div>

          <div className="battle-overlay-column battle-overlay-column-actions">
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
                  title={`${ELEMENT_LABEL[WEAPON_STATS[snapshot.player.weapon].element]} attack — hotkey: Shift`}
                  aria-label="Weapon attack"
                  aria-keyshortcuts="Shift"
                >
                  <span className="battle-btn-elem" title={`${ELEMENT_LABEL[WEAPON_STATS[snapshot.player.weapon].element]} attack`} aria-hidden>
                    {ELEMENT_SYMBOL[WEAPON_STATS[snapshot.player.weapon].element]}
                  </span>{" "}
                  Attack <kbd className="battle-attack-kbd">⇧</kbd>
                </button>
                <button onClick={() => queueBattleAction(() => gameStore.attemptRun())} disabled={actionsLocked}>
                  Run
                </button>
              </div>
              <div className="battle-action-group battle-tactical-group">
                <span className="battle-action-label">Tactics</span>
                <p className="battle-tactical-hint">
                  <strong>Dodge</strong> (E) — next foe swing may miss (faster than enemy + Shadow helps).{" "}
                  <strong>Brace</strong> (B) — softens the next hit; cancels a queued brace if you Dodge instead.
                  Attacks and skills can <strong>crit</strong>. Foes may unleash a <strong>heavy swing</strong>.
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
                  Tap a slot or use keys <kbd>1</kbd>–<kbd>9</kbd> / <kbd>0</kbd> (assign in the backpack).
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
    </div>
  );
}
