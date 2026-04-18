import { useCallback, useEffect, useState } from "react";
import { ALL_ITEM_KEYS, ITEM_DATA, formatItemTooltipSummary } from "../game/data";
import { HOTBAR_KEY_LABELS, HOTBAR_SIZE, itemHotbarAbbr, itemOnHotbarCount, normalizeItemHotbar } from "../game/inventoryHotbar";
import { gameStore } from "../game/state";
import type { ItemKey } from "../game/types";
import { useGameStore } from "../game/useGameStore";

type Props = {
  /** When true, digit keys do not fire consumables (modals, story, etc.). */
  hotkeysBlocked?: boolean;
  /** LAN guest: hotbar and backpack cannot change host state from this device. */
  coopGuestLocked?: boolean;
};

function slotFromKeyCode(code: string): number {
  if (code === "Digit1") return 0;
  if (code === "Digit2") return 1;
  if (code === "Digit3") return 2;
  if (code === "Digit4") return 3;
  if (code === "Digit5") return 4;
  if (code === "Digit6") return 5;
  if (code === "Digit7") return 6;
  if (code === "Digit8") return 7;
  if (code === "Digit9") return 8;
  if (code === "Digit0") return 9;
  return -1;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

export function InventoryBar({ hotkeysBlocked = false, coopGuestLocked = false }: Props) {
  const snapshot = useGameStore();
  const [backpackOpen, setBackpackOpen] = useState(false);
  const hotbar = normalizeItemHotbar(snapshot.player.itemHotbar);

  const ownedStacks = ALL_ITEM_KEYS.filter((k) => snapshot.player.items[k] > 0).sort((a, b) =>
    ITEM_DATA[a].name.localeCompare(ITEM_DATA[b].name)
  );

  const useSlot = useCallback(
    (slotIndex: number) => {
      if (coopGuestLocked) return;
      if (snapshot.battle.inBattle && snapshot.battle.phase === "playerTurn") {
        gameStore.useHotbarSlot(slotIndex);
      } else if (!snapshot.battle.inBattle) {
        gameStore.useHotbarSlotInField(slotIndex);
      }
    },
    [coopGuestLocked, snapshot.battle.inBattle, snapshot.battle.phase]
  );

  useEffect(() => {
    if (hotkeysBlocked || backpackOpen || coopGuestLocked) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      const slot = slotFromKeyCode(e.code);
      if (slot < 0) return;
      e.preventDefault();
      useSlot(slot);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [coopGuestLocked, hotkeysBlocked, backpackOpen, useSlot]);

  useEffect(() => {
    if (!backpackOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        setBackpackOpen(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [backpackOpen]);

  return (
    <>
      <div className="inventory-bar" role="toolbar" aria-label="Item hotbar">
        <div className="inventory-bar-slots">
          {Array.from({ length: HOTBAR_SIZE }, (_, i) => {
            const key = hotbar[i];
            const qty = key ? snapshot.player.items[key] ?? 0 : 0;
            const disabled =
              snapshot.battle.inBattle &&
              (snapshot.battle.phase !== "playerTurn" || !key || qty <= 0);
            const fieldDisabled = !snapshot.battle.inBattle && (!key || qty <= 0);
            const clickDisabled = coopGuestLocked || (snapshot.battle.inBattle ? disabled : fieldDisabled);
            const title = key
              ? `${ITEM_DATA[key].name} ×${qty}\n${formatItemTooltipSummary(key)} · Hotkey ${HOTBAR_KEY_LABELS[i]}`
              : `Empty slot · Hotkey ${HOTBAR_KEY_LABELS[i]}`;
            return (
              <button
                key={i}
                type="button"
                className={`inventory-bar-slot${key ? "" : " inventory-bar-slot--empty"}${clickDisabled ? " inventory-bar-slot--disabled" : ""}`}
                title={title}
                aria-label={key ? `Use ${ITEM_DATA[key].name}, slot ${HOTBAR_KEY_LABELS[i]}` : `Empty hotbar slot ${HOTBAR_KEY_LABELS[i]}`}
                disabled={clickDisabled}
                onClick={() => useSlot(i)}
              >
                <span className="inventory-bar-slot-key">{HOTBAR_KEY_LABELS[i]}</span>
                {key ? (
                  <>
                    <span className="inventory-bar-slot-abbr">{itemHotbarAbbr(key)}</span>
                    <span className="inventory-bar-slot-qty">{qty}</span>
                  </>
                ) : (
                  <span className="inventory-bar-slot-dash">—</span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="inventory-bar-backpack-btn"
          title={
            coopGuestLocked
              ? "Only the host opens the backpack in LAN co-op."
              : "Backpack — all carried consumables and hotbar setup"
          }
          aria-label="Open backpack"
          aria-expanded={backpackOpen}
          disabled={coopGuestLocked}
          onClick={() => setBackpackOpen((o) => !o)}
        >
          <span className="inventory-bar-backpack-icon" aria-hidden>
            🎒
          </span>
        </button>
      </div>

      {backpackOpen && (
        <div
          className="inventory-backpack-backdrop"
          role="presentation"
          onClick={() => setBackpackOpen(false)}
        />
      )}
      {backpackOpen && (
        <div className="inventory-backpack-modal" role="dialog" aria-modal="true" aria-label="Backpack">
          <header className="inventory-backpack-head">
            <h2>Backpack</h2>
            <p className="inventory-backpack-hint">
              Items here are everything you carry. Put up to ten on the hotbar (keys 1–9, then 0) for quick use in
              battle and in the field.
            </p>
            <button type="button" className="inventory-backpack-close" onClick={() => setBackpackOpen(false)}>
              Close
            </button>
          </header>
          <div className="inventory-backpack-body">
            {ownedStacks.length === 0 ? (
              <p className="inventory-backpack-empty">No consumables yet — visit a shop in town.</p>
            ) : (
              <ul className="inventory-backpack-list">
                {ownedStacks.map((itemKey) => {
                  const onBar = itemOnHotbarCount(hotbar, itemKey);
                  const qty = snapshot.player.items[itemKey];
                  return (
                    <li key={itemKey} className="inventory-backpack-row">
                      <div className="inventory-backpack-row-main">
                        <strong>{ITEM_DATA[itemKey].name}</strong>
                        <span className="inventory-backpack-meta">
                          ×{qty} · {formatItemTooltipSummary(itemKey)}
                          {onBar > 0 ? <span className="inventory-backpack-onbar"> · on hotbar</span> : null}
                        </span>
                      </div>
                      <div className="inventory-backpack-row-actions">
                        <button
                          type="button"
                          className="inventory-backpack-use"
                          disabled={
                            snapshot.battle.inBattle ||
                            qty <= 0 ||
                            snapshot.player.hp >= snapshot.player.maxHp
                          }
                          title="Use outside battle (restores HP)"
                          onClick={() => gameStore.useConsumableInField(itemKey)}
                        >
                          Use
                        </button>
                        <span className="inventory-backpack-assign-label">Assign</span>
                        <div className="inventory-backpack-assign-slots" role="group" aria-label={`Assign ${ITEM_DATA[itemKey].name} to hotbar slot`}>
                          {HOTBAR_KEY_LABELS.map((label, slotIndex) => (
                            <button
                              key={label}
                              type="button"
                              className="inventory-backpack-slot-btn"
                              title={`Hotbar slot ${label}`}
                              onClick={() => {
                                gameStore.assignHotbarSlot(slotIndex, itemKey);
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
