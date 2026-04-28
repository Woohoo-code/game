import { useRef } from "react";
import { useSyncExternalStore } from "react";
import { gameStore } from "./state";
import type { GameSnapshot } from "./types";

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== "object" || a === null ||
    typeof b !== "object" || b === null
  ) return false;
  const ka = Object.keys(a as Record<string, unknown>);
  if (ka.length !== Object.keys(b as Record<string, unknown>).length) return false;
  for (const k of ka) {
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
  }
  return true;
}

export function useGameStore() {
  return useSyncExternalStore(
    (listener) => gameStore.subscribe(listener),
    () => gameStore.getSnapshot(),
    () => gameStore.getSnapshot()
  );
}

/**
 * Subscribe to a derived slice of game state. Only re-renders when the
 * selected value changes (shallow equality). Use this instead of useGameStore()
 * in components that only need a small part of the snapshot.
 */
export function useGameStoreSelector<T>(selector: (s: GameSnapshot) => T): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const lastRef = useRef<T | undefined>(undefined);

  return useSyncExternalStore(
    (listener) => gameStore.subscribe(listener),
    () => {
      const next = selectorRef.current(gameStore.getSnapshot());
      if (shallowEqual(lastRef.current, next)) return lastRef.current as T;
      lastRef.current = next;
      return next;
    },
    () => selectorRef.current(gameStore.getSnapshot())
  );
}
