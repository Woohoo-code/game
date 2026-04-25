/// <reference types="vite/client" />
import { useCallback, useEffect, useRef, useState } from "react";
import { syncProceduralBgmToMusicPreference, unlockAudio } from "./audio";

/**
 * Background music preference (`msty-music` in localStorage). The game uses
 * procedural WebAudio BGM from `audio.ts` only — no second MP3 layer.
 */

const STORAGE_KEY = "msty-music";
const DEFAULT_VOLUME = 0.45;

interface MusicPrefs {
  enabled: boolean;
  volume: number;
}

function loadPrefs(): MusicPrefs {
  if (typeof window === "undefined") return { enabled: true, volume: DEFAULT_VOLUME };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: true, volume: DEFAULT_VOLUME };
    const p = JSON.parse(raw) as Partial<MusicPrefs>;
    return {
      enabled: typeof p.enabled === "boolean" ? p.enabled : true,
      volume: typeof p.volume === "number" ? Math.max(0, Math.min(1, p.volume)) : DEFAULT_VOLUME
    };
  } catch {
    return { enabled: true, volume: DEFAULT_VOLUME };
  }
}

function savePrefs(prefs: MusicPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota/security errors */
  }
}

let prefs: MusicPrefs = loadPrefs();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function isMusicEnabled(): boolean {
  return prefs.enabled;
}

/**
 * @deprecated Kept for any external checks; procedural BGM is always what plays.
 */
export function isThemeStreamPreferred(): boolean {
  return false;
}

export function getMusicVolume(): number {
  return prefs.volume;
}

export async function setMusicEnabled(enabled: boolean): Promise<void> {
  prefs = { ...prefs, enabled };
  savePrefs(prefs);
  syncProceduralBgmToMusicPreference();
  notify();
}

export function setMusicVolume(volume: number): void {
  const v = Math.max(0, Math.min(1, volume));
  prefs = { ...prefs, volume: v };
  savePrefs(prefs);
  notify();
}

export function subscribeMusic(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let didBootstrap = false;

/** Nudge WebAudio on first gesture so `playMusic` can start after unlock. */
export function bootstrapMusicOnGesture(): void {
  if (typeof window === "undefined") return;
  if (didBootstrap) return;
  didBootstrap = true;
  const kick = () => {
    unlockAudio();
    syncProceduralBgmToMusicPreference();
  };
  window.addEventListener("pointerdown", kick, { once: true });
  window.addEventListener("keydown", kick, { once: true });
  window.addEventListener("touchstart", kick, { once: true });
  syncProceduralBgmToMusicPreference();
}

/**
 * React hook — returns the live enabled state and a toggle function.
 */
export function useBackgroundMusic(): {
  enabled: boolean;
  toggle: () => void;
  volume: number;
  setVolume: (v: number) => void;
} {
  const [enabled, setEnabled] = useState<boolean>(() => prefs.enabled);
  const [volume, setVolumeState] = useState<number>(() => prefs.volume);

  useEffect(() => {
    const fn = () => {
      setEnabled(prefs.enabled);
      setVolumeState(prefs.volume);
    };
    return subscribeMusic(fn);
  }, []);

  const toggle = useCallback(() => {
    void setMusicEnabled(!prefs.enabled);
  }, []);

  const setVolume = useCallback((v: number) => {
    setMusicVolume(v);
  }, []);

  return { enabled, toggle, volume, setVolume };
}

/**
 * Invisible mount — starts the gesture-based WebAudio bootstrap once on app start.
 */
export function BackgroundMusicMount(): null {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    bootstrapMusicOnGesture();
  }, []);
  return null;
}
