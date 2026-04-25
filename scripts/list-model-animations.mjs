/**
 * List animation clip names in GLB/FBX (uses three loaders).
 * Run: node scripts/list-model-animations.mjs <path> [...]
 */
/* three/examples loaders expect browser-like globals in Node */
globalThis.self ??= globalThis;
globalThis.window ??= globalThis;
const noopEl = () => ({
  addEventListener: () => {},
  style: {},
  setAttribute: () => {},
  remove: () => {},
});
globalThis.document ??= {
  createElement: (tag) => (tag === "img" || tag === "canvas" ? noopEl() : {}),
  createElementNS: () => noopEl(),
  body: {},
};

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { LoadingManager, Group } from "three";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const manager = new LoadingManager();
const gltf = new GLTFLoader(manager);
const fbxL = new FBXLoader(manager);

function loadFbxOrGlb(p) {
  const buf = readFileSync(p);
  if (p.toLowerCase().endsWith(".glb") || p.toLowerCase().endsWith(".gltf")) {
    return new Promise((ok, err) => {
      gltf.parse(
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        "",
        (g) => ok(g),
        err,
      );
    });
  }
  return new Promise((ok, err) => {
    try {
      const obj = fbxL.parse(buf.buffer, "");
      ok({ animations: obj.animations, scene: obj });
    } catch (e) {
      err(e);
    }
  });
}

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("Usage: node scripts/list-model-animations.mjs <file> [...]");
  process.exit(1);
}

for (const rel of paths) {
  const p = resolve(rel);
  if (!existsSync(p)) {
    console.log(`\n[MISSING] ${p}`);
    continue;
  }
  console.log(`\n--- ${p} ---`);
  try {
    const data = await loadFbxOrGlb(p);
    const anims = data.animations ?? [];
    if (anims.length === 0) {
      console.log("  (no animation clips — likely mesh only or keyframes in scene children)");
    } else {
      for (const a of anims) {
        console.log(`  clip: "${a.name}"  duration: ${a.duration.toFixed(3)}s  tracks: ${a.tracks.length}`);
      }
    }
  } catch (e) {
    console.log(`  ERROR: ${e?.message || e}`);
  }
}
