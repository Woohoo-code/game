import * as THREE from "three";
import type { BiomeKind } from "../game/types";
import type { TerrainKind } from "../game/worldMap";
import { MAP_H, MAP_W, biomeAt, terrainAt } from "../game/worldMap";
import {
  biomeTerrainTint,
  getBiomeGroundTexture,
  getTerrainTexture,
} from "./textures";

/** Matches `worldGen` terrain codes for packed ground map (R channel). */
const TERRAIN_BYTE: Record<TerrainKind, number> = {
  grass: 0,
  road: 1,
  water: 2,
  town: 3,
  forest: 4,
  hill: 5,
};

const BIOME_BYTE: Record<BiomeKind, number> = {
  meadow: 0,
  forest: 1,
  desert: 2,
  swamp: 3,
  tundra: 4,
};

const BIOMES: BiomeKind[] = ["meadow", "forest", "desert", "swamp", "tundra"];

/**
 * RG8 data texture: R = terrain code (0–5), G = biome code (0–4).
 * Used by {@link createTerrainBlendGroundMaterial} for neighbor albedo blending.
 */
export function buildGroundIndexDataTexture(): THREE.DataTexture {
  const data = new Uint8Array(MAP_W * MAP_H * 2);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = (y * MAP_W + x) * 2;
      data[i] = TERRAIN_BYTE[terrainAt(x, y)];
      data[i + 1] = BIOME_BYTE[biomeAt(x, y)];
    }
  }
  const tex = new THREE.DataTexture(
    data,
    MAP_W,
    MAP_H,
    THREE.RGFormat,
    THREE.UnsignedByteType,
  );
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function parseTint(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

const MAP_PARS_PATCH = /* glsl */ `
uniform sampler2D groundMap;
uniform vec2 uGroundMapSize;
uniform sampler2D uGrass0;
uniform sampler2D uGrass1;
uniform sampler2D uGrass2;
uniform sampler2D uGrass3;
uniform sampler2D uGrass4;
uniform sampler2D uRoad;
uniform sampler2D uForest;
uniform sampler2D uHill;
uniform sampler2D uTown;
uniform sampler2D uWater;
uniform vec3 uTintRoad[5];
uniform vec3 uTintForest[5];
uniform vec3 uTintHill[5];
uniform vec3 uTintTown[5];
uniform vec3 uTintWater[5];
uniform float uDebugGround;
`;

const MAP_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
	vec2 tileC = floor(vMapUv);
	vec2 fr = fract(vMapUv);

	void readTB(vec2 tile, out int T, out int B) {
		vec2 uvS = (tile + vec2(0.5)) / uGroundMapSize;
		if (uvS.x < 0.0 || uvS.y < 0.0 || uvS.x > 1.0 || uvS.y > 1.0) {
			T = 2;
			B = 0;
			return;
		}
		vec4 s = texture2D(groundMap, uvS);
		T = int(floor(s.r * 255.0 + 0.5));
		B = int(floor(s.g * 255.0 + 0.5));
		B = clamp(B, 0, 4);
		T = clamp(T, 0, 5);
	}

	int sigAt(vec2 tile) {
		int T;
		int B;
		readTB(tile, T, B);
		return T * 16 + B;
	}

	vec4 sampGrassBiome(int b, vec2 uv) {
		if (b <= 0) return texture2D(uGrass0, uv);
		if (b == 1) return texture2D(uGrass1, uv);
		if (b == 2) return texture2D(uGrass2, uv);
		if (b == 3) return texture2D(uGrass3, uv);
		return texture2D(uGrass4, uv);
	}

	vec4 sampAlbedo(int T, int B, vec2 uv) {
		if (T == 0) return sampGrassBiome(B, uv);
		if (T == 1) return texture2D(uRoad, uv) * vec4(uTintRoad[B], 1.0);
		if (T == 2) return texture2D(uWater, uv) * vec4(uTintWater[B], 1.0);
		if (T == 3) return texture2D(uTown, uv) * vec4(uTintTown[B], 1.0);
		if (T == 4) return texture2D(uForest, uv) * vec4(uTintForest[B], 1.0);
		return texture2D(uHill, uv) * vec4(uTintHill[B], 1.0);
	}

	int Tc;
	int Bc;
	readTB(tileC, Tc, Bc);
	int sigC = Tc * 16 + Bc;

	float e0 = 0.34;
	float e1 = 0.66;

	float wE = (sigAt(tileC + vec2(1.0, 0.0)) != sigC) ? (1.0 - smoothstep(e0, e1, 1.0 - fr.x)) : 0.0;
	float wW = (sigAt(tileC + vec2(-1.0, 0.0)) != sigC) ? (1.0 - smoothstep(e0, e1, fr.x)) : 0.0;
	float wN = (sigAt(tileC + vec2(0.0, -1.0)) != sigC) ? (1.0 - smoothstep(e0, e1, fr.y)) : 0.0;
	float wS = (sigAt(tileC + vec2(0.0, 1.0)) != sigC) ? (1.0 - smoothstep(e0, e1, 1.0 - fr.y)) : 0.0;

	float wNE = (sigAt(tileC + vec2(1.0, -1.0)) != sigC)
		? ((1.0 - smoothstep(e0, e1, 1.0 - fr.x)) * (1.0 - smoothstep(e0, e1, fr.y))) : 0.0;
	float wNW = (sigAt(tileC + vec2(-1.0, -1.0)) != sigC)
		? ((1.0 - smoothstep(e0, e1, fr.x)) * (1.0 - smoothstep(e0, e1, fr.y))) : 0.0;
	float wSE = (sigAt(tileC + vec2(1.0, 1.0)) != sigC)
		? ((1.0 - smoothstep(e0, e1, 1.0 - fr.x)) * (1.0 - smoothstep(e0, e1, 1.0 - fr.y))) : 0.0;
	float wSW = (sigAt(tileC + vec2(-1.0, 1.0)) != sigC)
		? ((1.0 - smoothstep(e0, e1, fr.x)) * (1.0 - smoothstep(e0, e1, 1.0 - fr.y))) : 0.0;

	float wDiag = 0.38;
	wNE *= wDiag;
	wNW *= wDiag;
	wSE *= wDiag;
	wSW *= wDiag;

	float ws = wE + wW + wN + wS + wNE + wNW + wSE + wSW;
	float damp = 1.0 / (1.0 + 1.15 * ws * ws);
	wE *= damp;
	wW *= damp;
	wN *= damp;
	wS *= damp;
	wNE *= damp;
	wNW *= damp;
	wSE *= damp;
	wSW *= damp;

	int Te, Be, Tw, Bw, Tn, Bn, Ts, Bs;
	readTB(tileC + vec2(1.0, 0.0), Te, Be);
	readTB(tileC + vec2(-1.0, 0.0), Tw, Bw);
	readTB(tileC + vec2(0.0, -1.0), Tn, Bn);
	readTB(tileC + vec2(0.0, 1.0), Ts, Bs);
	int Tne, Bne, Tnw, Bnw, Tse, Bse, Tsw, Bsw;
	readTB(tileC + vec2(1.0, -1.0), Tne, Bne);
	readTB(tileC + vec2(-1.0, -1.0), Tnw, Bnw);
	readTB(tileC + vec2(1.0, 1.0), Tse, Bse);
	readTB(tileC + vec2(-1.0, 1.0), Tsw, Bsw);

	float wC = max(0.0, 1.0 - wE - wW - wN - wS - wNE - wNW - wSE - wSW);
	vec4 blended = sampAlbedo(Tc, Bc, vMapUv) * wC;
	blended += sampAlbedo(Te, Be, vMapUv) * wE;
	blended += sampAlbedo(Tw, Bw, vMapUv) * wW;
	blended += sampAlbedo(Tn, Bn, vMapUv) * wN;
	blended += sampAlbedo(Ts, Bs, vMapUv) * wS;
	blended += sampAlbedo(Tne, Bne, vMapUv) * wNE;
	blended += sampAlbedo(Tnw, Bnw, vMapUv) * wNW;
	blended += sampAlbedo(Tse, Bse, vMapUv) * wSE;
	blended += sampAlbedo(Tsw, Bsw, vMapUv) * wSW;

	float tw = wC + wE + wW + wN + wS + wNE + wNW + wSE + wSW;
	blended /= max(tw, 0.001);

	if (uDebugGround > 0.5) {
		diffuseColor *= vec4(vec3(float(Tc) / 5.0, float(Bc) / 4.0, 0.25), 1.0);
	} else {
		diffuseColor *= blended;
	}
#endif
`;

/**
 * Land tiles (all kinds except animated water): blends albedo across terrain kind +
 * biome boundaries using the packed ground index map. Water stays a separate mesh
 * with scrolling UVs; land/water edges still soften via the static `uWater` sample here.
 */
export function createTerrainBlendGroundMaterial(
  realmTier: number,
  groundIndexTex: THREE.DataTexture,
): THREE.MeshStandardMaterial {
  const tier = Math.max(1, Math.floor(realmTier));
  const g0 = getBiomeGroundTexture("meadow", tier);
  const g1 = getBiomeGroundTexture("forest", tier);
  const g2 = getBiomeGroundTexture("desert", tier);
  const g3 = getBiomeGroundTexture("swamp", tier);
  const g4 = getBiomeGroundTexture("tundra", tier);

  const road = getTerrainTexture("road");
  const forest = getTerrainTexture("forest");
  const hill = getTerrainTexture("hill");
  const town = getTerrainTexture("town");
  const water = getTerrainTexture("water");

  const tintRoad: THREE.Vector3[] = [];
  const tintForest: THREE.Vector3[] = [];
  const tintHill: THREE.Vector3[] = [];
  const tintTown: THREE.Vector3[] = [];
  const tintWater: THREE.Vector3[] = [];
  for (const b of BIOMES) {
    tintRoad.push(parseTint(biomeTerrainTint(b, "road", tier)));
    tintForest.push(parseTint(biomeTerrainTint(b, "forest", tier)));
    tintHill.push(parseTint(biomeTerrainTint(b, "hill", tier)));
    tintTown.push(parseTint(biomeTerrainTint(b, "town", tier)));
    tintWater.push(parseTint(biomeTerrainTint(b, "water", tier)));
  }

  const whiteMap = new THREE.DataTexture(
    new Uint8Array([255, 255, 255, 255]),
    1,
    1,
    THREE.RGBAFormat,
  );
  whiteMap.needsUpdate = true;
  whiteMap.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshStandardMaterial({
    map: whiteMap,
    color: "#ffffff",
    roughness: 0.78,
    metalness: 0.02,
    envMapIntensity: 0.35,
  });

  mat.userData.terrainBlendGround = true;
  const uDebugGround = { value: 0 };
  mat.userData.uDebugGround = uDebugGround;
  /** Dedicated program — same rationale as biome grass blend (avoid cache collision → white ground). */
  mat.customProgramCacheKey = () => "terrainGroundBlendV1";

  const mapSizeVec = new THREE.Vector2(MAP_W, MAP_H);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.groundMap = { value: groundIndexTex };
    shader.uniforms.uGroundMapSize = { value: mapSizeVec };
    shader.uniforms.uGrass0 = { value: g0 };
    shader.uniforms.uGrass1 = { value: g1 };
    shader.uniforms.uGrass2 = { value: g2 };
    shader.uniforms.uGrass3 = { value: g3 };
    shader.uniforms.uGrass4 = { value: g4 };
    shader.uniforms.uRoad = { value: road };
    shader.uniforms.uForest = { value: forest };
    shader.uniforms.uHill = { value: hill };
    shader.uniforms.uTown = { value: town };
    shader.uniforms.uWater = { value: water };
    shader.uniforms.uTintRoad = { value: tintRoad };
    shader.uniforms.uTintForest = { value: tintForest };
    shader.uniforms.uTintHill = { value: tintHill };
    shader.uniforms.uTintTown = { value: tintTown };
    shader.uniforms.uTintWater = { value: tintWater };
    shader.uniforms.uDebugGround = uDebugGround;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_pars_fragment>",
      `#include <map_pars_fragment>
${MAP_PARS_PATCH}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", MAP_FRAGMENT);
  };

  return mat;
}
