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

function makeCanvas(size = 128): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { canvas, ctx };
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
  // Base green with vertical gradient so tiles feel lit.
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, "#538447");
  grad.addColorStop(1, "#446f3b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  const r = seededRng(101);

  // Blades (darker)
  for (let i = 0; i < 260; i++) {
    const x = r() * s;
    const y = r() * s;
    const hue = 70 + Math.floor(r() * 40);
    const sat = 35 + Math.floor(r() * 15);
    const lum = 22 + Math.floor(r() * 12);
    ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lum}%, 0.75)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 2, y - (2 + r() * 3));
    ctx.stroke();
  }

  // Bright highlight flecks
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `hsla(${85 + r() * 25 | 0}, 55%, 55%, 0.5)`;
    ctx.fillRect(r() * s, r() * s, 1.5, 1.5);
  }

  // A few micro-flowers
  for (let i = 0; i < 12; i++) {
    const x = r() * s;
    const y = r() * s;
    const hues = ["#e8e04a", "#f08fbf", "#d6d8e6"];
    ctx.fillStyle = hues[(r() * hues.length) | 0];
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, "#9d8868");
  grad.addColorStop(1, "#7d6a50");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  const r = seededRng(202);

  // Wheel ruts
  ctx.strokeStyle = "rgba(70, 55, 38, 0.45)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    const y = s * (0.33 + i * 0.33) + (r() - 0.5) * 4;
    ctx.moveTo(0, y);
    for (let x = 0; x <= s; x += 4) {
      ctx.lineTo(x, y + Math.sin(x * 0.1 + i) * 1.2);
    }
    ctx.stroke();
  }

  // Pebbles
  for (let i = 0; i < 140; i++) {
    const x = r() * s;
    const y = r() * s;
    const size = 1 + r() * 2.2;
    const shade = 150 + Math.floor(r() * 60);
    ctx.fillStyle = `rgba(${shade}, ${shade - 22}, ${shade - 45}, 0.85)`;
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.7, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dust specks
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = "rgba(120, 100, 70, 0.4)";
    ctx.fillRect(r() * s, r() * s, 1, 1);
  }
}

function drawWater(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, "#2f72b8");
  grad.addColorStop(0.6, "#235a98");
  grad.addColorStop(1, "#1a4477");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  const r = seededRng(303);

  // Ripple bands
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(150, 200, 240, ${0.18 + r() * 0.25})`;
    ctx.lineWidth = 1 + r() * 1.2;
    ctx.beginPath();
    const baseY = (i * s) / 14 + r() * 3;
    ctx.moveTo(0, baseY);
    const amp = 1 + r() * 2.5;
    const freq = 0.15 + r() * 0.2;
    for (let x = 0; x <= s; x += 3) {
      ctx.lineTo(x, baseY + Math.sin(x * freq + i) * amp);
    }
    ctx.stroke();
  }

  // Sparkles
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(220, 240, 255, ${0.4 + r() * 0.5})`;
    const x = r() * s;
    const y = r() * s;
    ctx.fillRect(x, y, 1.5, 1);
  }
}

function drawTown(ctx: CanvasRenderingContext2D, s: number): void {
  // Tight sandstone cobble pattern.
  ctx.fillStyle = "#8a6f4f";
  ctx.fillRect(0, 0, s, s);

  const r = seededRng(404);
  const cell = 16;
  for (let gy = 0; gy < s; gy += cell) {
    for (let gx = 0; gx < s; gx += cell) {
      // Alternate offset per row for brickwork
      const offset = (Math.floor(gy / cell) % 2) * (cell / 2);
      const x = gx + offset;
      const jitter = (r() - 0.5) * 2;
      const shade = 150 + Math.floor(r() * 55);
      ctx.fillStyle = `rgb(${shade}, ${shade - 30}, ${shade - 55})`;
      ctx.beginPath();
      ctx.roundRect(x + 1 + jitter, gy + 1 + jitter, cell - 2, cell - 2, 2);
      ctx.fill();
      // Speckles
      ctx.fillStyle = "rgba(80, 60, 40, 0.4)";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + 2 + r() * (cell - 4), gy + 2 + r() * (cell - 4), 1, 1);
      }
    }
  }

  // Grout darkening
  ctx.strokeStyle = "rgba(45, 30, 20, 0.5)";
  ctx.lineWidth = 1;
  for (let y = 0; y <= s; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(s, y);
    ctx.stroke();
  }
}

function drawForest(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, "#38563a");
  grad.addColorStop(1, "#263f27");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  const r = seededRng(505);

  // Leaf litter
  for (let i = 0; i < 220; i++) {
    const x = r() * s;
    const y = r() * s;
    const hue = 70 + Math.floor(r() * 50);
    const sat = 25 + Math.floor(r() * 25);
    const lum = 20 + Math.floor(r() * 18);
    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lum}%, 0.8)`;
    ctx.fillRect(x, y, 2, 1.2);
  }

  // Fallen twigs
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = `rgba(${60 + r() * 30 | 0}, ${40 + r() * 20 | 0}, ${22 + r() * 15 | 0}, 0.85)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const x = r() * s;
    const y = r() * s;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6 + r() * 10, y + (r() - 0.5) * 6);
    ctx.stroke();
  }

  // Mushroom dots
  for (let i = 0; i < 6; i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.fillStyle = "#b95c3a";
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e7d8a9";
    ctx.fillRect(x - 0.5, y + 1, 1.2, 1.6);
  }
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
  const size = 128;
  const { canvas, ctx } = makeCanvas(size);
  DRAWERS[kind](ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cache.set(kind, tex);
  return tex;
}

// ── Biome-specific textures ───────────────────────────────────────────────

function drawSand(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, "#e0c074");
  grad.addColorStop(1, "#c69a4a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const r = seededRng(606);
  // Dune ripples
  for (let i = 0; i < 18; i++) {
    ctx.strokeStyle = `rgba(120, 80, 30, ${0.12 + r() * 0.18})`;
    ctx.lineWidth = 1 + r() * 1.4;
    ctx.beginPath();
    const y = (i * s) / 18 + r() * 3;
    ctx.moveTo(0, y);
    for (let x = 0; x <= s; x += 4) {
      ctx.lineTo(x, y + Math.sin(x * 0.12 + i * 0.7) * 2);
    }
    ctx.stroke();
  }
  // Sand grains
  for (let i = 0; i < 360; i++) {
    const shade = 160 + Math.floor(r() * 80);
    ctx.fillStyle = `rgba(${shade}, ${shade - 30}, ${shade - 80}, ${0.4 + r() * 0.4})`;
    ctx.fillRect(r() * s, r() * s, 1, 1);
  }
  // Pebbles
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = "rgba(100, 70, 30, 0.5)";
    ctx.beginPath();
    ctx.ellipse(r() * s, r() * s, 1.5 + r() * 2, 1 + r() * 1.5, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSnow(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, "#f3f7fa");
  grad.addColorStop(1, "#dce4ec");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const r = seededRng(707);
  // Blue shadow dapples
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(130, 160, 200, ${0.08 + r() * 0.14})`;
    const x = r() * s;
    const y = r() * s;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + r() * 8, 2 + r() * 4, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Snow sparkle
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.55 + r() * 0.35})`;
    ctx.fillRect(r() * s, r() * s, 1, 1);
  }
  // Faint ice cracks
  ctx.strokeStyle = "rgba(170, 200, 225, 0.35)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    let px = r() * s;
    let py = r() * s;
    ctx.moveTo(px, py);
    for (let j = 0; j < 4; j++) {
      px += (r() - 0.5) * 18;
      py += (r() - 0.5) * 18;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function drawMud(ctx: CanvasRenderingContext2D, s: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, "#555f37");
  grad.addColorStop(1, "#3e472a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const r = seededRng(808);
  // Puddles
  for (let i = 0; i < 8; i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.fillStyle = `rgba(40, 55, 40, ${0.35 + r() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 6 + r() * 7, 3 + r() * 4, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    // Reflection highlight
    ctx.fillStyle = "rgba(150, 170, 140, 0.18)";
    ctx.beginPath();
    ctx.ellipse(x - 2, y - 1, 4 + r() * 4, 1.5, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Reeds / grass blades
  for (let i = 0; i < 120; i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.strokeStyle = `hsla(${70 + r() * 25 | 0}, 35%, ${25 + r() * 18 | 0}%, 0.75)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 2, y - (2 + r() * 3));
    ctx.stroke();
  }
  // Moss dots
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${60 + r() * 40 | 0}, ${80 + r() * 50 | 0}, ${40 + r() * 30 | 0}, 0.6)`;
    ctx.fillRect(r() * s, r() * s, 1.4, 1.4);
  }
}

function drawMeadowGrass(ctx: CanvasRenderingContext2D, s: number): void {
  // A brighter, flower-filled variant of the default grass.
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, "#6aa05a");
  grad.addColorStop(1, "#548547");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const r = seededRng(909);
  for (let i = 0; i < 260; i++) {
    const x = r() * s;
    const y = r() * s;
    ctx.strokeStyle = `hsla(${85 + r() * 30 | 0}, ${40 + r() * 15 | 0}%, ${28 + r() * 14 | 0}%, 0.75)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 2, y - (2 + r() * 3));
    ctx.stroke();
  }
  // Abundant flowers
  const flowerHues = ["#e8e04a", "#f08fbf", "#f6d6ff", "#ffb55a", "#ffffff"];
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = flowerHues[(r() * flowerHues.length) | 0];
    ctx.fillRect(r() * s, r() * s, 2, 2);
  }
}

function drawForestFloor(ctx: CanvasRenderingContext2D, s: number): void {
  // Darker, leaf-litter grass for forest biome exteriors.
  const grad = ctx.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, "#3d5a34");
  grad.addColorStop(1, "#2b4226");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const r = seededRng(1010);
  for (let i = 0; i < 240; i++) {
    const x = r() * s;
    const y = r() * s;
    const hue = 60 + Math.floor(r() * 55);
    ctx.fillStyle = `hsla(${hue}, 30%, ${18 + r() * 15 | 0}%, 0.85)`;
    ctx.fillRect(x, y, 2, 1.3);
  }
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(${60 + r() * 30 | 0}, ${40 + r() * 20 | 0}, ${20 + r() * 15 | 0}, 0.8)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const x = r() * s;
    const y = r() * s;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6 + r() * 10, y + (r() - 0.5) * 6);
    ctx.stroke();
  }
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
  const size = 128;
  const { canvas, ctx } = makeCanvas(size);
  BIOME_FLOOR_DRAWERS[biome](ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
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
  const size = 128;
  const { canvas, ctx } = makeCanvas(size);
  const palette = {
    red: ["#8b2a26", "#6f1f1c", "#b1423c"],
    slate: ["#3b4654", "#2a3240", "#566479"],
    thatch: ["#b48746", "#8a6432", "#d4a660"],
    gold: ["#6c4a23", "#a07030", "#d6a74a"]
  }[variant];
  ctx.fillStyle = palette[1];
  ctx.fillRect(0, 0, size, size);
  const rowH = 14;
  for (let y = 0; y < size; y += rowH) {
    const rowOffset = ((y / rowH) | 0) % 2 === 0 ? 0 : 12;
    for (let x = -20; x < size + 20; x += 24) {
      ctx.fillStyle = palette[0];
      ctx.beginPath();
      ctx.arc(x + rowOffset + 12, y + rowH + 2, 14, Math.PI, 0, false);
      ctx.fill();
      ctx.strokeStyle = palette[2];
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

/** Plaster / stone wall texture for building bodies. */
export function getWallTexture(variant: "inn" | "shop" | "train" | "guild" | "boss"): THREE.CanvasTexture {
  const key = `wall-${variant}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const size = 128;
  const { canvas, ctx } = makeCanvas(size);
  const palette = {
    inn: { base: "#d4b485", accent: "#b0926a", trim: "#7a5a3a" },
    shop: { base: "#c5b898", accent: "#a69a7c", trim: "#5e4d36" },
    train: { base: "#a18cb5", accent: "#8e7aa0", trim: "#5a4a6d" },
    guild: { base: "#a2b08b", accent: "#869472", trim: "#4e5a3c" },
    boss: { base: "#3b1d4a", accent: "#612a78", trim: "#1a0a25" }
  }[variant];
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, size, size);

  const r = seededRng(variant === "inn" ? 11 : variant === "shop" ? 22 : variant === "train" ? 33 : variant === "guild" ? 44 : 55);

  // Horizontal wood beams
  ctx.fillStyle = palette.trim;
  for (let i = 0; i < 3; i++) {
    const y = (size / 3) * i + 4;
    ctx.fillRect(0, y, size, 4);
  }
  // Vertical beams
  for (let i = 0; i < 4; i++) {
    const x = (size / 4) * i + 2;
    ctx.fillRect(x, 0, 3, size);
  }
  // Plaster speckle
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.04 + r() * 0.08})`;
    ctx.fillRect(r() * size, r() * size, 1, 1);
  }
  // Warm highlight splotches
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.15 + r() * 0.15;
    ctx.fillRect(r() * size, r() * size, 4 + r() * 6, 2 + r() * 4);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}
