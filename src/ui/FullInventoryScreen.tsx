import { useEffect } from "react";
import {
  ALL_ITEM_KEYS,
  ARMOR_STATS,
  ITEM_DATA,
  WEAPON_STATS,
  formatItemTooltipSummary
} from "../game/data";
import { HOTBAR_KEY_LABELS, itemOnHotbarCount, normalizeItemHotbar } from "../game/inventoryHotbar";
import { gameStore } from "../game/state";
import type { ItemKey } from "../game/types";
import { useGameStore } from "../game/useGameStore";
import { IconGold } from "./IconGold";

type Props = {
  open: boolean;
  onClose: () => void;
  /** LAN guest: read-only view, no use / hotbar assign. */
  coopGuestLocked?: boolean;
};

function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

const ITEMS_SORTED: ItemKey[] = [...ALL_ITEM_KEYS].sort((a, b) =>
  ITEM_DATA[a].name.localeCompare(ITEM_DATA[b].name)
);

export function FullInventoryScreen({ open, onClose, coopGuestLocked = false }: Props) {
  const snapshot = useGameStore();
  const hotbar = normalizeItemHotbar(snapshot.player.itemHotbar);

  const carriedKinds = ALL_ITEM_KEYS.filter((k) => (snapshot.player.items[k] ?? 0) > 0).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      if (e.code === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const w = WEAPON_STATS[snapshot.player.weapon];
  const a = ARMOR_STATS[snapshot.player.armor];

  return (
    <>
      <div className="full-inventory-backdrop" role="presentation" onClick={onClose} />
      <div
        className="full-inventory-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="full-inventory-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="full-inventory-head">
          <div className="full-inventory-head-text">
            <h2 id="full-inventory-title">Inventory</h2>
            <p className="full-inventory-sub">
              Every consumable type in the game — carried counts, shop prices, and battle effects. Hotbar keys{" "}
              <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd>. Press <kbd>I</kbd> or <kbd>Esc</kbd> to close.
            </p>
          </div>
          <button type="button" className="full-inventory-close" onClick={onClose}>
            Close
          </button>
        </header>

        {coopGuestLocked ? (
          <p className="full-inventory-guest-banner" role="status">
            LAN guest view — inventory is synced from the host; you cannot use items or change the hotbar here.
          </p>
        ) : null}

        <section className="full-inventory-equip" aria-label="Gold and equipment">
          <div className="full-inventory-equip-card">
            <span className="full-inventory-equip-label">Gold</span>
            <div className="full-inventory-gold-row">
              <IconGold size={28} className="full-inventory-gold-icon" />
              <span className="full-inventory-gold-val">{snapshot.player.gold}</span>
            </div>
          </div>
          <div className="full-inventory-equip-card">
            <span className="full-inventory-equip-label">Weapon</span>
            <strong className="full-inventory-equip-name">{w.name}</strong>
            <span className="full-inventory-equip-meta">+{w.attackBonus} attack from gear</span>
          </div>
          <div className="full-inventory-equip-card">
            <span className="full-inventory-equip-label">Armor</span>
            <strong className="full-inventory-equip-name">{a.name}</strong>
            <span className="full-inventory-equip-meta">+{a.defenseBonus} defense from gear</span>
          </div>
          <div className="full-inventory-equip-card full-inventory-equip-card--meta">
            <span className="full-inventory-equip-label">Carried</span>
            <strong className="full-inventory-equip-name">{carriedKinds}</strong>
            <span className="full-inventory-equip-meta">item types you are carrying</span>
          </div>
        </section>

        <div className="full-inventory-grid-wrap">
          <div className="full-inventory-grid" role="list">
            {ITEMS_SORTED.map((itemKey) => {
              const qty = snapshot.player.items[itemKey] ?? 0;
              const def = ITEM_DATA[itemKey];
              const onBar = itemOnHotbarCount(hotbar, itemKey);
              const empty = qty <= 0;
              return (
                <article
                  key={itemKey}
                  className={`full-inventory-card${empty ? " full-inventory-card--empty" : ""}`}
                  role="listitem"
                >
                  <div className="full-inventory-card-top">
                    <h3 className="full-inventory-card-name">{def.name}</h3>
                    <span className={`full-inventory-card-qty${empty ? " full-inventory-card-qty--zero" : ""}`} aria-label={`Quantity ${qty}`}>
                      ×{qty}
                    </span>
                  </div>
                  <p className="full-inventory-card-effects">{formatItemTooltipSummary(itemKey)}</p>
                  <p className="full-inventory-card-price">Shop: {def.price}g</p>
                  {onBar > 0 && !empty ? (
                    <p className="full-inventory-card-hotbar">
                      On hotbar ({onBar} slot{onBar > 1 ? "s" : ""})
                    </p>
                  ) : null}
                  {!coopGuestLocked && !empty ? (
                    <div className="full-inventory-card-actions">
                      <button
                        type="button"
                        className="full-inventory-use-btn"
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
                      <span className="full-inventory-assign-label">Assign</span>
                      <div className="full-inventory-assign-row" role="group" aria-label={`Assign ${def.name}`}>
                        {HOTBAR_KEY_LABELS.map((label, slotIndex) => (
                          <button
                            key={`${itemKey}-${label}`}
                            type="button"
                            className="full-inventory-slot-btn"
                            title={`Hotbar ${label}`}
                            onClick={() => gameStore.assignHotbarSlot(slotIndex, itemKey)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
