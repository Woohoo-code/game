import { useSyncExternalStore } from "react";
import { gameStore } from "./state";

export function useGameStore() {
  return useSyncExternalStore(
    (listener) => gameStore.subscribe(listener),
    () => gameStore.getSnapshot(),
    () => gameStore.getSnapshot()
  );
}
