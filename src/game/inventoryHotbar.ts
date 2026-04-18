import { ALL_ITEM_KEYS, ITEM_DATA } from "./data";
import type { ItemKey } from "./types";

export const HOTBAR_SIZE = 10;

/** Keys 1–9 then 0 map to hotbar indices 0–9. */
export const HOTBAR_KEY_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

const allowedKeys = new Set<ItemKey>(ALL_ITEM_KEYS);

export function defaultItemHotbar(): (ItemKey | null)[] {
  return ["potion", "hiPotion", "megaPotion", null, null, null, null, null, null, null];
}

export function normalizeItemHotbar(value: unknown): (ItemKey | null)[] {
  const arr = Array.isArray(value) ? value : [];
  const out: (ItemKey | null)[] = [];
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const v = arr[i];
    if (v === null || v === undefined || v === "") {
      out.push(null);
    } else if (typeof v === "string" && allowedKeys.has(v as ItemKey)) {
      out.push(v as ItemKey);
    } else {
      out.push(null);
    }
  }
  return out;
}

export function mergeItemInventory(raw: unknown): Record<ItemKey, number> {
  const base = Object.fromEntries(ALL_ITEM_KEYS.map((k) => [k, 0])) as Record<ItemKey, number>;
  if (raw && typeof raw === "object") {
    for (const k of ALL_ITEM_KEYS) {
      const n = (raw as Record<string, unknown>)[k];
      if (typeof n === "number" && Number.isFinite(n)) {
        base[k] = Math.max(0, Math.floor(n));
      }
    }
  }
  return base;
}

/** Two-letter hint for cramped hotbar cells. */
export function itemHotbarAbbr(key: ItemKey): string {
  const name = ITEM_DATA[key].name;
  const parts = name.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
  }
  return name.replace(/\s+/g, "").slice(0, 2).toUpperCase() || "??";
}

export function itemOnHotbarCount(hotbar: readonly (ItemKey | null)[], key: ItemKey): number {
  return hotbar.reduce((n, s) => n + (s === key ? 1 : 0), 0);
}
