/// <reference types="vite/client" />
import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Background music manager — plays a looping theme from `/audio/monster-slayer-theme.mp3`.
 *
 * - Lazily creates a single <audio> element and loops it.
 * - Honors browser autoplay policy: starts muted on mount and attempts to unmute
 *   on the first user gesture (pointerdown / keydown / touchstart). If the
 *   browser still blocks playback (e.g. Safari without gesture), the user can
 *   tap the music toggle button to start it.
 * - Preference (on/off, volume) persists in localStorage under `msty-music`.
 */

const STORAGE_KEY = "msty-music";
const MUSIC_URL = `${import.meta.env.BASE_URL}audio/monster-slayer-theme.mp3`;
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

let audioEl: HTMLAudioElement | null = null;
let prefs: MusicPrefs = loadPrefs();
const listeners = new Set<() => void>();

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (audioEl) return audioEl;
  const el = new Audio(MUSIC_URL);
  el.loop = true;
  el.preload = "auto";
  el.volume = prefs.volume;
  audioEl = el;
  return el;
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function isMusicEnabled(): boolean {
  return prefs.enabled;
}

export function getMusicVolume(): number {
  return prefs.volume;
}

async function tryPlay(el: HTMLAudioElement): Promise<boolean> {
  try {
    await el.play();
    return true;
  } catch {
    return false;
  }
}

export async function setMusicEnabled(enabled: boolean): Promise<void> {
  prefs = { ...prefs, enabled };
  savePrefs(prefs);
  const el = ensureAudio();
  if (!el) return;
  if (enabled) {
    el.volume = prefs.volume;
    await tryPlay(el);
  } else {
    el.pause();
  }
  notify();
}

export function setMusicVolume(volume: number): void {
  const v = Math.max(0, Math.min(1, volume));
  prefs = { ...prefs, volume: v };
  savePrefs(prefs);
  if (audioEl) audioEl.volume = v;
  notify();
}

export function subscribeMusic(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Try to start music on the first user gesture — used to satisfy autoplay. */
export function bootstrapMusicOnGesture(): void {
  if (typeof window === "undefined") return;
  if (!prefs.enabled) return;
  const el = ensureAudio();
  if (!el) return;

  const kick = () => {
    void tryPlay(el).then((ok) => {
      if (ok) cleanup();
    });
  };
  const cleanup = () => {
    window.removeEventListener("pointerdown", kick);
    window.removeEventListener("keydown", kick);
    window.removeEventListener("touchstart", kick);
  };
  window.addEventListener("pointerdown", kick, { once: false });
  window.addEventListener("keydown", kick, { once: false });
  window.addEventListener("touchstart", kick, { once: false });

  // Best-effort attempt straight away (works on most desktop browsers after
  // the very first click that mounted the app).
  void tryPlay(el);
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
 * Invisible mount — starts the gesture-based autoplay bootstrap once on app
 * start. Place this once at the top of the app so music begins as soon as
 * the browser allows.
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
