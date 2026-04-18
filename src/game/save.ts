import type { GameSnapshot } from "./types";

export interface SaveRepository {
  save(slot: string, snapshot: GameSnapshot): Promise<void>;
  load(slot: string): Promise<GameSnapshot | null>;
  /** Remove all persisted slots (e.g. localStorage keys for this game). */
  clearAll(): Promise<void>;
}

const prefix = "rpg-poc-save:";

export class LocalSaveRepository implements SaveRepository {
  async save(slot: string, snapshot: GameSnapshot): Promise<void> {
    localStorage.setItem(prefix + slot, JSON.stringify(snapshot));
  }

  async load(slot: string): Promise<GameSnapshot | null> {
    const raw = localStorage.getItem(prefix + slot);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as GameSnapshot;
  }

  async clearAll(): Promise<void> {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      localStorage.removeItem(key);
    }
  }
}

export class CloudSaveRepository implements SaveRepository {
  async save(): Promise<void> {
    throw new Error("Cloud save not implemented yet.");
  }

  async load(): Promise<GameSnapshot | null> {
    throw new Error("Cloud save not implemented yet.");
  }

  async clearAll(): Promise<void> {
    throw new Error("Cloud save not implemented yet.");
  }
}
