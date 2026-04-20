import type { ElementKind } from "./types";

/** Rock–paper–scissors wheel: each element deals ~150% to the next, ~75% vs the one strong into you. */
export const ELEMENT_BEATS: Record<ElementKind, ElementKind> = {
  fire: "air",
  air: "earth",
  earth: "water",
  water: "fire"
};

const SUPER = 1.5;
const RESIST = 0.75;

export function elementDamageMultiplier(attackElement: ElementKind, defenderElement: ElementKind): number {
  if (ELEMENT_BEATS[attackElement] === defenderElement) return SUPER;
  if (ELEMENT_BEATS[defenderElement] === attackElement) return RESIST;
  return 1;
}

export const ELEMENT_SYMBOL: Record<ElementKind, string> = {
  fire: "🔥",
  water: "💧",
  earth: "🪨",
  air: "💨"
};

export const ELEMENT_LABEL: Record<ElementKind, string> = {
  fire: "Fire",
  water: "Water",
  earth: "Earth",
  air: "Air"
};

/** Short line for battle log after damage number. */
export function elementBattleLogSuffix(mult: number): string {
  if (mult > 1.04) return " Super effective!";
  if (mult < 0.96) return " Not very effective…";
  return "";
}

const ELEMENT_ORDER: ElementKind[] = ["fire", "water", "earth", "air"];

export function normalizeElementKind(value: unknown): ElementKind | undefined {
  if (typeof value !== "string") return undefined;
  return ELEMENT_ORDER.includes(value as ElementKind) ? (value as ElementKind) : undefined;
}
