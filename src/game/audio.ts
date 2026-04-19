/**
 * Procedural game audio — WebAudio only, zero assets shipped.
 *
 * Design notes:
 * - AudioContext is created lazily on the first user gesture (autoplay policy).
 * - Every SFX is synthesized from oscillators + noise with a short envelope, so
 *   muting / unloading is instant and the bundle stays asset-free.
 * - Mute + master volume persist in localStorage under "msty-audio".
 */

export type SfxKind =
  | "attack" // plain weapon swing
  | "skill" // spellcast
  | "hit" // taking a hit (enemy → player)
  | "heal" // potion / restore
  | "levelUp"
  | "step" // footstep on overworld tile change
  | "encounter" // wild foe appears
  | "victory"
  | "defeat"
  | "ui"; // generic click

const STORAGE_KEY = "msty-audio";

interface AudioPrefs {
  muted: boolean;
  volume: number; // 0..1 master
}

function loadPrefs(): AudioPrefs {
  if (typeof window === "undefined") return { muted: false, volume: 0.6 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { muted: false, volume: 0.6 };
    const p = JSON.parse(raw) as Partial<AudioPrefs>;
    return {
      muted: typeof p.muted === "boolean" ? p.muted : false,
      volume: typeof p.volume === "number" ? Math.max(0, Math.min(1, p.volume)) : 0.6
    };
  } catch {
    return { muted: false, volume: 0.6 };
  }
}

function savePrefs(prefs: AudioPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota/security errors */
  }
}

let prefs: AudioPrefs = loadPrefs();
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const listeners = new Set<() => void>();
let lastStepAt = 0;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = prefs.muted ? 0 : prefs.volume;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

/** Call once from a user-gesture handler (keydown, click) to unlock audio. */
export function unlockAudio(): void {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {
      /* ignored */
    });
  }
}

export function isAudioMuted(): boolean {
  return prefs.muted;
}

export function getAudioVolume(): number {
  return prefs.volume;
}

export function setAudioMuted(muted: boolean): void {
  prefs = { ...prefs, muted };
  savePrefs(prefs);
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : prefs.volume, ctx.currentTime, 0.02);
  listeners.forEach((fn) => fn());
}

export function setAudioVolume(volume: number): void {
  const v = Math.max(0, Math.min(1, volume));
  prefs = { ...prefs, volume: v };
  savePrefs(prefs);
  if (master && ctx && !prefs.muted) master.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
  listeners.forEach((fn) => fn());
}

export function subscribeAudioPrefs(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── SFX synthesis helpers ────────────────────────────────────────────────

function playTone(
  opts: {
    freq: number;
    endFreq?: number;
    type?: OscillatorType;
    durationMs: number;
    attackMs?: number;
    releaseMs?: number;
    gain?: number;
    delayMs?: number;
  }
): void {
  const c = ensureCtx();
  if (!c || !master) return;
  if (prefs.muted) return;
  const start = c.currentTime + (opts.delayMs ?? 0) / 1000;
  const dur = opts.durationMs / 1000;
  const osc = c.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), start + dur);
  }
  const g = c.createGain();
  const peak = opts.gain ?? 0.25;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + (opts.attackMs ?? 8) / 1000);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function playNoise(opts: {
  durationMs: number;
  gain?: number;
  bandpass?: { freq: number; q: number };
  delayMs?: number;
}): void {
  const c = ensureCtx();
  if (!c || !master) return;
  if (prefs.muted) return;
  const start = c.currentTime + (opts.delayMs ?? 0) / 1000;
  const dur = opts.durationMs / 1000;
  const frames = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const peak = opts.gain ?? 0.18;
  g.gain.setValueAtTime(peak, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  if (opts.bandpass) {
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = opts.bandpass.freq;
    f.Q.value = opts.bandpass.q;
    src.connect(f).connect(g).connect(master);
  } else {
    src.connect(g).connect(master);
  }
  src.start(start);
  src.stop(start + dur + 0.02);
}

// ── Public API: playSfx ───────────────────────────────────────────────────

export function playSfx(kind: SfxKind): void {
  if (prefs.muted) return;
  switch (kind) {
    case "attack": {
      // whoosh + thud
      playNoise({ durationMs: 120, gain: 0.28, bandpass: { freq: 1800, q: 1.2 } });
      playTone({ freq: 220, endFreq: 90, type: "square", durationMs: 120, gain: 0.18, delayMs: 40 });
      return;
    }
    case "skill": {
      // ascending chime
      playTone({ freq: 440, endFreq: 880, type: "triangle", durationMs: 220, gain: 0.22 });
      playTone({ freq: 660, endFreq: 1320, type: "sine", durationMs: 260, gain: 0.14, delayMs: 40 });
      return;
    }
    case "hit": {
      // low thump + noise burst
      playTone({ freq: 140, endFreq: 60, type: "sawtooth", durationMs: 180, gain: 0.26 });
      playNoise({ durationMs: 90, gain: 0.22, bandpass: { freq: 600, q: 0.8 } });
      return;
    }
    case "heal": {
      playTone({ freq: 660, endFreq: 990, type: "sine", durationMs: 260, gain: 0.2 });
      playTone({ freq: 990, endFreq: 1320, type: "sine", durationMs: 300, gain: 0.14, delayMs: 80 });
      return;
    }
    case "levelUp": {
      playTone({ freq: 523, type: "triangle", durationMs: 180, gain: 0.22 });
      playTone({ freq: 659, type: "triangle", durationMs: 180, gain: 0.22, delayMs: 140 });
      playTone({ freq: 784, type: "triangle", durationMs: 260, gain: 0.22, delayMs: 280 });
      playTone({ freq: 1046, type: "sine", durationMs: 420, gain: 0.18, delayMs: 420 });
      return;
    }
    case "step": {
      // quick dampened tick — rate-limited in playStepThrottled
      playNoise({ durationMs: 50, gain: 0.08, bandpass: { freq: 240, q: 1.4 } });
      return;
    }
    case "encounter": {
      playTone({ freq: 180, endFreq: 320, type: "sawtooth", durationMs: 260, gain: 0.22 });
      playTone({ freq: 120, endFreq: 80, type: "square", durationMs: 320, gain: 0.18, delayMs: 120 });
      return;
    }
    case "victory": {
      playTone({ freq: 523, type: "triangle", durationMs: 160, gain: 0.22 });
      playTone({ freq: 784, type: "triangle", durationMs: 160, gain: 0.22, delayMs: 140 });
      playTone({ freq: 1046, type: "triangle", durationMs: 360, gain: 0.24, delayMs: 280 });
      return;
    }
    case "defeat": {
      playTone({ freq: 440, endFreq: 110, type: "sawtooth", durationMs: 700, gain: 0.22 });
      return;
    }
    case "ui": {
      playTone({ freq: 720, endFreq: 880, type: "sine", durationMs: 80, gain: 0.14 });
      return;
    }
  }
}

/**
 * Step SFX rate-limited to avoid spam when a key is held and tile edges are crossed rapidly.
 * `minIntervalMs` gate prevents firing more than ~4x per second.
 */
export function playStepThrottled(minIntervalMs = 240): void {
  if (prefs.muted) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastStepAt < minIntervalMs) return;
  lastStepAt = now;
  playSfx("step");
}
