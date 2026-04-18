import * as THREE from "three";
import type { TerrainKind } from "../game/worldMap";
import type { BiomeKind } from "../game/types";

/**
 * Procedural canvas textures for each terrain kind. Each texture is generated once
 * the first time it's requested and cached for the lifetime of the page.
 *
 * Textures are designed to tile cleanly (1 unit = 1 world tile) via RepeatWrapping.
 */

const cache = new Map<string, THREE.CanvasTexture>();

/** Canvas resolution for terrain + buildings (higher = sharper when zoomed in). */
const PROCEDURAL_TEX_SIZE = 256;

function makeCanvas(size = PROCEDURAL_TEX_SIZE): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) throw new Error("2D canvas unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

/** Scale feature counts when canvas is larger than the original 128² reference. */
function density(s: number, countAt128: number): number {
  const f = s / 128;
  return Math.max(1, Math.round(countAt128 * f * f));
}

function applyTextureQuality(tex: THREE.CanvasTexture): void {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 12;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
}

/** Subtle overlay grain so large color fields feel less flat (cheap vs per-pixel). */
function addFilmGrain(ctx: CanvasRenderingContext2D, s: number, seed: number): void {
  const r = seededRng(seed);
  const n = density(s, 420);
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "overlay";
  for (let i = 0; i < n; i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.fillStyle =
      r() > 0.5 ? `rgba(255,255,255,${0.025 + r() * 0.045})` : `rgba(0,0,0,${0.03 + r() * 0.06})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalCompositeOperation = prev;
}

/** Deterministic xorshift-ish RNG so every regeneration yields the exact same texture. */
function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s = s >>> 0;
    return s / 0xffffffff;
  };
}

function drawGrass(ctx: CanvasRenderingContext2D, s: number): void {
  const base = ctx.createRadialGradient(s * 0.35, s * 0.25, 0, s * 0.5, s * 0.5, s * 0.85);
  base.addColorStop(0, "#6aa858");
  base.addColorStop(0.4, "#528842");
  base.addColorStop(1, "#345a2c");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);

  const r = seededRng(101);

  for (let i = 0; i < density(s, 36); i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.fillStyle = `rgba(28, 44, 22, ${0.08 + r() * 0.14})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 5 + r() * 18, 4 + r() * 12, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < density(s, 200); i++) {
    const x = r() * s;
    const y = r() * s;
    const hue = 72 + Math.floor(r() * 38);
    const sat = 28 + Math.floor(r() * 24);
    const lum = 14 + Math.floor(r() * 12);
    ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lum}%, ${0.5 + r() * 0.32})`;
    ctx.lineWidth = 0.55 + r() * 1.05;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 3.2, y - (2.5 + r() * 6));
    ctx.stroke();
  }

  for (let i = 0; i < density(s, 140); i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.strokeStyle = `hsla(${78 + r() * 24 | 0}, ${42 + r() * 20 | 0}%, ${42 + r() * 18 | 0}%, ${0.28 + r() * 0.38})`;
    ctx.lineWidth = 0.35 + r() * 0.55;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + 0.8);
    ctx.lineTo(x + (r() - 0.5) * 2, y - (1.2 + r() * 2.8));
    ctx.stroke();
  }

  for (let i = 0; i < density(s, 95); i++) {
    ctx.fillStyle = `hsla(${84 + r() * 22 | 0}, ${50 + r() * 16 | 0}%, ${52 + r() * 12 | 0}%, ${0.25 + r() * 0.3})`;
    ctx.fillRect(r() * s, r() * s, 1.1 + r() * 0.8, 1.1 + r() * 0.8);
  }

  for (let i = 0; i < density(s, 22); i++) {
    const x = r() * s;
    const y = r() * s;
    const pet = ["#e8d848", "#e878a8", "#d8dae8", "#b8e868", "#f0c878"][(r() * 5) | 0]!;
    ctx.fillStyle = pet;
    ctx.beginPath();
    ctx.arc(x, y, 1.1 + r() * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(40, 55, 28, 0.55)";
    ctx.fillRect(x - 0.35, y + 0.9, 0.85, 0.55);
  }

  for (let i = 0; i < density(s, 18); i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.fillStyle = `rgba(90, 95, 88, ${0.35 + r() * 0.35})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 0.9 + r() * 1.2, 0.65 + r() * 0.9, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  addFilmGrain(ctx, s, 9101);
}

function drawRoad(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(0, 0, s * 0.55, s);
  grad.addColorStop(0, "#b8a280");
  grad.addColorStop(0.35, "#958568");
  grad.addColorStop(0.72, "#7a684e");
  grad.addColorStop(1, "#5c4a38");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  const r = seededRng(202);

  for (let i = 0; i < density(s, 620); i++) {
    const shade = 88 + Math.floor(r() * 78);
    const warm = 6 + Math.floor(r() * 18);
    ctx.fillStyle = `rgba(${shade + warm}, ${shade - 2}, ${shade - warm - 18}, ${0.1 + r() * 0.18})`;
    ctx.fillRect(r() * s, r() * s, 1, 1);
  }

  ctx.strokeStyle = "rgba(48, 36, 22, 0.22)";
  ctx.lineWidth = 1.1;
  for (let a = 0; a < 5; a++) {
    ctx.beginPath();
    let px = r() * s;
    let py = r() * s;
    ctx.moveTo(px, py);
    for (let k = 0; k < 8; k++) {
      px += (r() - 0.5) * 18;
      py += (r() - 0.5) * 18;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(42, 32, 20, 0.42)";
  ctx.lineWidth = 1.6 + r() * 1.2;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    const y = s * (0.31 + i * 0.36) + (r() - 0.5) * 5;
    ctx.moveTo(0, y);
    for (let x = 0; x <= s; x += 2) {
      ctx.lineTo(x, y + Math.sin(x * 0.095 + i * 1.7) * 1.8);
    }
    ctx.stroke();
  }

  for (let i = 0; i < density(s, 160); i++) {
    const x = r() * s;
    const y = r() * s;
    const size = 0.9 + r() * 2.8;
    const shade = 132 + Math.floor(r() * 88);
    ctx.fillStyle = `rgba(${shade}, ${shade - 18}, ${shade - 42}, ${0.45 + r() * 0.38})`;
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.62, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(32, 24, 14, 0.35)";
  ctx.lineWidth = 0.45;
  for (let i = 0; i < density(s, 12); i++) {
    ctx.beginPath();
    let px = r() * s;
    let py = r() * s;
    ctx.moveTo(px, py);
    for (let k = 0; k < 4; k++) {
      px += 4 + r() * 10;
      py += (r() - 0.5) * 3;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  addFilmGrain(ctx, s, 9202);
}

function drawWater(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(0, 0, s * 0.35, s);
  grad.addColorStop(0, "#4a8cd4");
  grad.addColorStop(0.3, "#2e6cb0");
  grad.addColorStop(0.65, "#1e5088");
  grad.addColorStop(1, "#0f2848");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  const r = seededRng(303);

  const deep = ctx.createRadialGradient(s * 0.72, s * 0.78, 0, s * 0.55, s * 0.55, s * 0.95);
  deep.addColorStop(0, "rgba(12, 40, 72, 0)");
  deep.addColorStop(1, "rgba(4, 18, 40, 0.45)");
  ctx.fillStyle = deep;
  ctx.fillRect(0, 0, s, s);

  for (let i = 0; i < density(s, 20); i++) {
    ctx.fillStyle = `rgba(6, 28, 52, ${0.06 + r() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(r() * s, r() * s, 12 + r() * 32, 7 + r() * 20, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const bands = Math.round(16 * (s / 128));
  for (let i = 0; i < bands; i++) {
    ctx.strokeStyle = `rgba(170, 220, 255, ${0.1 + r() * 0.18})`;
    ctx.lineWidth = 0.65 + r() * 1.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    const baseY = (i * s) / bands + r() * 2.5;
    ctx.moveTo(0, baseY);
    const amp = 0.9 + r() * 2.4;
    const freq = 0.1 + r() * 0.2;
    for (let x = 0; x <= s; x += 2) {
      ctx.lineTo(x, baseY + Math.sin(x * freq + i * 0.85) * amp);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(210, 245, 255, 0.1)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    const cx = r() * s;
    const cy = r() * s;
    ctx.arc(cx, cy, 6 + r() * 24, r() * Math.PI, r() * Math.PI + 1.4);
    ctx.stroke();
  }

  for (let i = 0; i < density(s, 55); i++) {
    ctx.fillStyle = `rgba(230, 248, 255, ${0.22 + r() * 0.38})`;
    const x = r() * s;
    const y = r() * s;
    ctx.fillRect(x, y, 1.1, 0.9);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  for (let i = 0; i < density(s, 8); i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + r() * 10, 1.2 + r() * 2, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  addFilmGrain(ctx, s, 9303);
}

function drawTown(ctx: CanvasRenderingContext2D, s: number): void {
  const base = ctx.createLinearGradient(0, 0, s * 0.4, s);
  base.addColorStop(0, "#9a7e5c");
  base.addColorStop(1, "#6a5238");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);

  const r = seededRng(404);
  const cell = Math.max(15, Math.round(17 * (s / 128)));
  for (let gy = 0; gy < s; gy += cell) {
    for (let gx = 0; gx < s; gx += cell) {
      const offset = (Math.floor(gy / cell) % 2) * (cell / 2);
      const x = gx + offset;
      const jitter = (r() - 0.5) * 3.2;
      const wobble = 0.85 + r() * 0.28;
      const stoneW = (cell - 3) * wobble;
      const stoneH = (cell - 3) * (0.92 + r() * 0.14);
      const shade = 128 + Math.floor(r() * 72);
      const lift = (r() - 0.5) * 1.2;
      ctx.fillStyle = `rgb(${shade - 6}, ${shade - 34}, ${shade - 58})`;
      ctx.beginPath();
      ctx.roundRect(x + 2 + jitter, gy + 2 + jitter + lift, stoneW, stoneH, 2.5 + r() * 1.5);
      ctx.fill();
      ctx.fillStyle = `rgb(${shade}, ${shade - 26}, ${shade - 50})`;
      ctx.beginPath();
      ctx.roundRect(x + 1.5 + jitter, gy + 1.2 + jitter + lift, stoneW, stoneH, 2.5 + r() * 1.5);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 242, 215, ${0.18 + r() * 0.12})`;
      ctx.lineWidth = 0.85;
      ctx.stroke();
      ctx.strokeStyle = "rgba(22, 14, 8, 0.28)";
      ctx.lineWidth = 0.55;
      ctx.stroke();
    }
  }

  ctx.fillStyle = "rgba(28, 18, 10, 0.42)";
  for (let gy = 0; gy < s; gy += cell) {
    for (let gx = 0; gx < s; gx += cell) {
      const offset = (Math.floor(gy / cell) % 2) * (cell / 2);
      const x = gx + offset;
      if (r() > 0.55) {
        ctx.fillRect(x + cell * 0.45, gy + cell * 0.2, 1.2, cell * 0.65);
      }
    }
  }

  for (let i = 0; i < density(s, 90); i++) {
    const shade = 70 + Math.floor(r() * 45);
    ctx.fillStyle = `rgba(${shade}, ${shade - 4}, ${shade - 8}, ${0.2 + r() * 0.25})`;
    ctx.fillRect(r() * s, r() * s, 1, 1);
  }

  addFilmGrain(ctx, s, 9404);
}

function drawForest(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(0, 0, s * 0.35, s);
  grad.addColorStop(0, "#3a5638");
  grad.addColorStop(0.55, "#283d26");
  grad.addColorStop(1, "#1a2818");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  const r = seededRng(505);

  for (let i = 0; i < density(s, 18); i++) {
    ctx.fillStyle = `rgba(255, 248, 220, ${0.03 + r() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(r() * s, r() * s, 8 + r() * 28, 5 + r() * 16, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < density(s, 240); i++) {
    const x = r() * s;
    const y = r() * s;
    const hue = 64 + Math.floor(r() * 48);
    const sat = 20 + Math.floor(r() * 26);
    const lum = 14 + Math.floor(r() * 18);
    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lum}%, ${0.58 + r() * 0.28})`;
    ctx.fillRect(x, y, 2.2 + r() * 0.8, 1 + r() * 0.55);
  }

  for (let i = 0; i < density(s, 14); i++) {
    ctx.strokeStyle = `rgba(${52 + r() * 28 | 0}, ${34 + r() * 20 | 0}, ${18 + r() * 16 | 0}, 0.75)`;
    ctx.lineWidth = 1 + r() * 0.75;
    ctx.lineCap = "round";
    ctx.beginPath();
    const x = r() * s;
    const y = r() * s;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 5 + r() * 16, y + (r() - 0.5) * 9);
    ctx.stroke();
  }

  for (let i = 0; i < density(s, 12); i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.fillStyle = "#8b4428";
    ctx.beginPath();
    ctx.arc(x, y, 1.4 + r() * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e4d8b8";
    ctx.fillRect(x - 0.45, y + 0.95, 1.15, 1.55);
  }

  for (let i = 0; i < density(s, 26); i++) {
    ctx.fillStyle = `rgba(45, 62, 38, ${0.25 + r() * 0.35})`;
    ctx.beginPath();
    ctx.ellipse(r() * s, r() * s, 2 + r() * 4, 1.2 + r() * 2.2, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  addFilmGrain(ctx, s, 9505);
}

const DRAWERS: Record<TerrainKind, (ctx: CanvasRenderingContext2D, size: number) => void> = {
  grass: drawGrass,
  road: drawRoad,
  water: drawWater,
  town: drawTown,
  forest: drawForest
};

export function getTerrainTexture(kind: TerrainKind): THREE.CanvasTexture {
  const cached = cache.get(kind);
  if (cached) return cached;
  const size = PROCEDURAL_TEX_SIZE;
  const { canvas, ctx } = makeCanvas(size);
  DRAWERS[kind](ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  applyTextureQuality(tex);
  cache.set(kind, tex);
  return tex;
}

// ── Biome-specific textures ───────────────────────────────────────────────

function drawSand(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(s * 0.15, 0, s * 0.85, s);
  grad.addColorStop(0, "#f0d898");
  grad.addColorStop(0.45, "#dcb868");
  grad.addColorStop(1, "#a87838");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const r = seededRng(606);
  const bands = Math.round(20 * (s / 128));
  for (let i = 0; i < bands; i++) {
    ctx.strokeStyle = `rgba(100, 62, 22, ${0.08 + r() * 0.14})`;
    ctx.lineWidth = 0.75 + r() * 1.25;
    ctx.lineCap = "round";
    ctx.beginPath();
    const y = (i * s) / bands + r() * 2.5;
    ctx.moveTo(0, y);
    for (let x = 0; x <= s; x += 2) {
      ctx.lineTo(x, y + Math.sin(x * 0.1 + i * 0.65) * 2.6);
    }
    ctx.stroke();
  }
  for (let i = 0; i < density(s, 400); i++) {
    const shade = 168 + Math.floor(r() * 85);
    ctx.fillStyle = `rgba(${shade}, ${shade - 32}, ${shade - 82}, ${0.28 + r() * 0.42})`;
    ctx.fillRect(r() * s, r() * s, 1, 1);
  }
  for (let i = 0; i < density(s, 16); i++) {
    ctx.fillStyle = "rgba(88, 54, 22, 0.45)";
    ctx.beginPath();
    ctx.ellipse(r() * s, r() * s, 1.6 + r() * 2.8, 1.1 + r() * 1.9, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  for (let i = 0; i < density(s, 28); i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.beginPath();
    ctx.arc(x, y, 0.35 + r() * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  addFilmGrain(ctx, s, 9606);
}

function drawSnow(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(0, 0, s * 0.5, s);
  grad.addColorStop(0, "#fafcfd");
  grad.addColorStop(0.4, "#e8eef4");
  grad.addColorStop(1, "#b8c8d8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const r = seededRng(707);
  const cool = ctx.createRadialGradient(s * 0.25, s * 0.2, 0, s * 0.5, s * 0.45, s * 0.9);
  cool.addColorStop(0, "rgba(200, 220, 245, 0.15)");
  cool.addColorStop(1, "rgba(120, 150, 190, 0.08)");
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < density(s, 48); i++) {
    ctx.fillStyle = `rgba(110, 140, 185, ${0.06 + r() * 0.1})`;
    const x = r() * s;
    const y = r() * s;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.5 + r() * 12, 2.2 + r() * 6, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < density(s, 220); i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.42 + r() * 0.45})`;
    ctx.fillRect(r() * s, r() * s, 1, 1);
  }
  ctx.strokeStyle = "rgba(140, 175, 210, 0.32)";
  ctx.lineWidth = 0.55;
  for (let i = 0; i < density(s, 8); i++) {
    ctx.beginPath();
    let px = r() * s;
    let py = r() * s;
    ctx.moveTo(px, py);
    for (let j = 0; j < 5; j++) {
      px += (r() - 0.5) * 20;
      py += (r() - 0.5) * 20;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  for (let i = 0; i < density(s, 35); i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.55 + r() * 0.35})`;
    const x = r() * s;
    const y = r() * s;
    ctx.beginPath();
    ctx.arc(x, y, 0.4 + r() * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  addFilmGrain(ctx, s, 9707);
}

function drawMud(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(0, s * 0.2, s, s * 0.9);
  grad.addColorStop(0, "#5a683e");
  grad.addColorStop(0.5, "#485530");
  grad.addColorStop(1, "#2a301c");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const r = seededRng(808);
  for (let i = 0; i < density(s, 12); i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.fillStyle = `rgba(18, 32, 22, ${0.35 + r() * 0.35})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 7 + r() * 12, 4 + r() * 6, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(140, 155, 125, 0.25)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(x - 1, y - 1.5, 5 + r() * 6, 2 + r() * 2.5, r() * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < density(s, 130); i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.strokeStyle = `hsla(${64 + r() * 32 | 0}, ${28 + r() * 14 | 0}%, ${20 + r() * 16 | 0}%, 0.72)`;
    ctx.lineWidth = 0.65 + r() * 0.75;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 2.8, y - (2.2 + r() * 4.5));
    ctx.stroke();
  }
  for (let i = 0; i < density(s, 70); i++) {
    ctx.fillStyle = `rgba(${48 + r() * 50 | 0}, ${68 + r() * 58 | 0}, ${32 + r() * 38 | 0}, 0.58)`;
    ctx.fillRect(r() * s, r() * s, 1.5, 1.5);
  }
  for (let i = 0; i < density(s, 8); i++) {
    ctx.strokeStyle = "rgba(55, 75, 48, 0.35)";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    let px = r() * s;
    let py = r() * s;
    ctx.moveTo(px, py);
    for (let k = 0; k < 5; k++) {
      px += (r() - 0.5) * 8;
      py += 3 + r() * 4;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  addFilmGrain(ctx, s, 9808);
}

function drawMeadowGrass(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createRadialGradient(s * 0.3, s * 0.25, 0, s * 0.5, s * 0.55, s * 0.95);
  grad.addColorStop(0, "#7ec868");
  grad.addColorStop(0.55, "#62a850");
  grad.addColorStop(1, "#4a823c");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const r = seededRng(909);
  for (let i = 0; i < density(s, 26); i++) {
    ctx.fillStyle = `rgba(36, 62, 30, ${0.09 + r() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(r() * s, r() * s, 6 + r() * 14, 4 + r() * 9, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < density(s, 200); i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.strokeStyle = `hsla(${84 + r() * 28 | 0}, ${44 + r() * 16 | 0}%, ${24 + r() * 14 | 0}%, 0.68)`;
    ctx.lineWidth = 0.6 + r() * 0.95;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 2.8, y - (2.4 + r() * 4.2));
    ctx.stroke();
  }
  for (let i = 0; i < density(s, 120); i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.strokeStyle = `hsla(${78 + r() * 20 | 0}, ${38 + r() * 14 | 0}%, ${38 + r() * 12 | 0}%, 0.35)`;
    ctx.lineWidth = 0.35 + r() * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y + 0.6);
    ctx.lineTo(x + (r() - 0.5) * 1.8, y - (1.2 + r() * 2.4));
    ctx.stroke();
  }
  const flowerHues = ["#e8d838", "#e878a8", "#f0d0ff", "#ffb040", "#ffffff", "#78d8b0"];
  for (let i = 0; i < density(s, 36); i++) {
    const x = r() * s;
    const y = r() * s;
    const c = flowerHues[(r() * flowerHues.length) | 0]!;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, 1 + r() * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(32, 48, 26, 0.5)";
    ctx.fillRect(x - 0.3, y + 0.75, 0.7, 0.45);
  }
  addFilmGrain(ctx, s, 9909);
}

function drawForestFloor(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(0, s * 0.1, s * 0.45, s);
  grad.addColorStop(0, "#4a663c");
  grad.addColorStop(0.55, "#344828");
  grad.addColorStop(1, "#1e2a18");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const r = seededRng(1010);
  for (let i = 0; i < density(s, 16); i++) {
    ctx.fillStyle = `rgba(200, 220, 160, ${0.04 + r() * 0.07})`;
    ctx.beginPath();
    ctx.ellipse(r() * s, r() * s, 10 + r() * 24, 6 + r() * 14, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < density(s, 260); i++) {
    const x = r() * s;
    const y = r() * s;
    const hue = 54 + Math.floor(r() * 52);
    ctx.fillStyle = `hsla(${hue}, ${24 + r() * 14 | 0}%, ${14 + r() * 14 | 0}%, ${0.68 + r() * 0.22})`;
    ctx.fillRect(x, y, 2.1 + r() * 0.7, 1.1 + r() * 0.45);
  }
  for (let i = 0; i < density(s, 18); i++) {
    ctx.strokeStyle = `rgba(${48 + r() * 30 | 0}, ${32 + r() * 20 | 0}, ${16 + r() * 14 | 0}, 0.78)`;
    ctx.lineWidth = 1 + r() * 0.55;
    ctx.lineCap = "round";
    ctx.beginPath();
    const x = r() * s;
    const y = r() * s;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 5 + r() * 14, y + (r() - 0.5) * 8);
    ctx.stroke();
  }
  for (let i = 0; i < density(s, 10); i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.fillStyle = "#6a4a2a";
    ctx.beginPath();
    ctx.ellipse(x, y, 1.2 + r() * 0.5, 1.8 + r() * 0.4, r() * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  addFilmGrain(ctx, s, 10110);
}

type BiomeFloorKind = BiomeKind;

const BIOME_FLOOR_DRAWERS: Record<BiomeFloorKind, (ctx: CanvasRenderingContext2D, size: number) => void> = {
  meadow: drawMeadowGrass,
  forest: drawForestFloor,
  desert: drawSand,
  swamp: drawMud,
  tundra: drawSnow
};

/**
 * Returns the ground/grass texture that best represents a biome. For "grass"-kind
 * tiles, this completely replaces the default grass texture. Road/town kinds stay
 * the same everywhere; water and forest can be tinted via {@link BIOME_TINT}.
 */
export function getBiomeGroundTexture(biome: BiomeKind): THREE.CanvasTexture {
  const key = `biome-${biome}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const size = PROCEDURAL_TEX_SIZE;
  const { canvas, ctx } = makeCanvas(size);
  BIOME_FLOOR_DRAWERS[biome](ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  applyTextureQuality(tex);
  cache.set(key, tex);
  return tex;
}

/**
 * Per-biome multiplicative tint applied to the base terrain material.color for
 * non-"grass" kinds where a full custom texture isn't needed. A white tint means
 * "use the base texture unmodified".
 */
export const BIOME_TINT: Record<BiomeKind, Record<TerrainKind, string>> = {
  meadow: {
    grass: "#ffffff",
    road: "#ffffff",
    water: "#ffffff",
    town: "#ffffff",
    forest: "#ffffff"
  },
  forest: {
    grass: "#ffffff",
    road: "#f3ecd8",
    water: "#e5f1f7",
    town: "#f3ecd6",
    forest: "#ffffff"
  },
  desert: {
    grass: "#ffffff",
    road: "#f4dca0",
    water: "#c0dce6",
    town: "#f5e3bc",
    forest: "#d4c690"
  },
  swamp: {
    grass: "#ffffff",
    road: "#c9bd9e",
    water: "#a8c485",
    town: "#bcb094",
    forest: "#a0b07c"
  },
  tundra: {
    grass: "#ffffff",
    road: "#dce0e4",
    water: "#d6e8ee",
    town: "#e3e7ec",
    forest: "#cdd8dc"
  }
};

/** Procedural roof tile texture (red clay / gray slate variants). */
export function getRoofTexture(variant: "red" | "slate" | "thatch" | "gold"): THREE.CanvasTexture {
  const key = `roof-${variant}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const size = PROCEDURAL_TEX_SIZE;
  const { canvas, ctx } = makeCanvas(size);
  const palette = {
    red: ["#8b2a26", "#6f1f1c", "#b1423c"],
    slate: ["#3b4654", "#2a3240", "#566479"],
    thatch: ["#b48746", "#8a6432", "#d4a660"],
    gold: ["#6c4a23", "#a07030", "#d6a74a"]
  }[variant];
  ctx.fillStyle = palette[1];
  ctx.fillRect(0, 0, size, size);
  const scale = size / 128;
  const rowH = Math.round(14 * scale);
  const tileW = Math.round(24 * scale);
  const arcR = 14 * scale;
  const stagger = Math.round(12 * scale);
  const cxOff = tileW / 2;
  const cyBase = rowH + 2 * scale;
  for (let y = 0; y < size; y += rowH) {
    const rowOffset = ((y / rowH) | 0) % 2 === 0 ? 0 : stagger;
    ctx.fillStyle = "rgba(12, 8, 6, 0.22)";
    for (let x = -tileW; x < size + tileW; x += tileW) {
      ctx.beginPath();
      ctx.ellipse(x + rowOffset + cxOff, y + cyBase + 1.2 * scale, arcR * 0.92, arcR * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let x = -tileW; x < size + tileW; x += tileW) {
      const cxi = x + rowOffset + cxOff;
      const cyi = y + cyBase;
      ctx.fillStyle = palette[0];
      ctx.beginPath();
      ctx.arc(cxi, cyi, arcR, Math.PI, 0, false);
      ctx.fill();
      ctx.fillStyle = palette[2];
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(cxi - arcR * 0.12, cyi - arcR * 0.08, arcR * 0.85, Math.PI * 1.05, Math.PI * 0.35, true);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = palette[2];
      ctx.lineWidth = Math.max(0.85, 1 * scale);
      ctx.beginPath();
      ctx.arc(cxi, cyi, arcR, Math.PI, 0, false);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 0.45 * scale;
      ctx.beginPath();
      ctx.arc(cxi, cyi + 0.5 * scale, arcR * 0.98, Math.PI * 1.02, Math.PI * 1.98, false);
      ctx.stroke();
    }
  }
  addFilmGrain(ctx, size, variant === "red" ? 11001 : variant === "slate" ? 11002 : variant === "thatch" ? 11003 : 11004);
  const tex = new THREE.CanvasTexture(canvas);
  applyTextureQuality(tex);
  cache.set(key, tex);
  return tex;
}

/** Plaster / stone wall texture for building bodies. */
const WALL_TEXTURE_SEED: Record<
  | "inn"
  | "shop"
  | "train"
  | "guild"
  | "petShop"
  | "boss"
  | "voidPortal"
  | "library"
  | "forge"
  | "chapel"
  | "stables"
  | "market",
  number
> = {
  inn: 11,
  shop: 22,
  train: 33,
  guild: 44,
  petShop: 66,
  boss: 55,
  voidPortal: 56,
  library: 77,
  forge: 88,
  chapel: 99,
  stables: 101,
  market: 112
};

export function getWallTexture(
  variant: keyof typeof WALL_TEXTURE_SEED
): THREE.CanvasTexture {
  const key = `wall-${variant}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const size = PROCEDURAL_TEX_SIZE;
  const { canvas, ctx } = makeCanvas(size);
  const palette = {
    inn: { base: "#d4b485", accent: "#b0926a", trim: "#7a5a3a" },
    shop: { base: "#c5b898", accent: "#a69a7c", trim: "#5e4d36" },
    train: { base: "#a18cb5", accent: "#8e7aa0", trim: "#5a4a6d" },
    guild: { base: "#a2b08b", accent: "#869472", trim: "#4e5a3c" },
    petShop: { base: "#8fc4b4", accent: "#6aa898", trim: "#2a5c50" },
    boss: { base: "#3b1d4a", accent: "#612a78", trim: "#1a0a25" },
    voidPortal: { base: "#1a3a52", accent: "#3a7aa8", trim: "#0a2840" },
    library: { base: "#a8b4c8", accent: "#7a8aa8", trim: "#3a4a62" },
    forge: { base: "#5a5654", accent: "#3a3634", trim: "#2a1810" },
    chapel: { base: "#e4e0d8", accent: "#c8c4b8", trim: "#7a6848" },
    stables: { base: "#9a7048", accent: "#6a4830", trim: "#4a3018" },
    market: { base: "#d4b078", accent: "#a88850", trim: "#6a4828" }
  }[variant];
  const grad = ctx.createLinearGradient(0, 0, size, size * 0.6);
  grad.addColorStop(0, palette.base);
  grad.addColorStop(1, palette.accent);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const r = seededRng(WALL_TEXTURE_SEED[variant]);

  const scale = size / 128;
  const beamH = Math.max(4, Math.round(4 * scale));
  const beamVw = Math.max(3, Math.round(3 * scale));
  const rows = 3 + Math.floor(scale);
  ctx.fillStyle = palette.trim;
  for (let i = 0; i < rows; i++) {
    const y = (size / rows) * i + Math.round(4 * scale);
    ctx.fillRect(0, y, size, beamH);
    const g = ctx.createLinearGradient(0, y, 0, y + beamH);
    g.addColorStop(0, "rgba(0,0,0,0.18)");
    g.addColorStop(0.45, "rgba(255,255,255,0.06)");
    g.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, size, beamH);
  }
  const cols = 4 + Math.floor(scale);
  for (let i = 0; i < cols; i++) {
    const x = (size / cols) * i + Math.round(2 * scale);
    ctx.fillStyle = palette.trim;
    ctx.fillRect(x, 0, beamVw, size);
    const gx = ctx.createLinearGradient(x, 0, x + beamVw, 0);
    gx.addColorStop(0, "rgba(0,0,0,0.2)");
    gx.addColorStop(0.5, "rgba(255,255,255,0.05)");
    gx.addColorStop(1, "rgba(0,0,0,0.15)");
    ctx.fillStyle = gx;
    ctx.fillRect(x, 0, beamVw, size);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.lineWidth = 0.55;
  for (let y = 0; y < size; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y + (r() - 0.5) * 0.8);
    ctx.lineTo(size, y + (r() - 0.5) * 0.8);
    ctx.stroke();
  }
  for (let i = 0; i < density(size, 220); i++) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.028 + r() * 0.08})`;
    ctx.fillRect(r() * size, r() * size, 1, 1);
  }
  for (let i = 0; i < density(size, 55); i++) {
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.1 + r() * 0.16;
    ctx.fillRect(r() * size, r() * size, 5 + r() * 10, 2 + r() * 6);
  }
  ctx.globalAlpha = 1;

  addFilmGrain(ctx, size, 12000 + WALL_TEXTURE_SEED[variant]);

  const tex = new THREE.CanvasTexture(canvas);
  applyTextureQuality(tex);
  cache.set(key, tex);
  return tex;
}
