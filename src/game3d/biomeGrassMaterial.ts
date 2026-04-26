import * as THREE from "three";
import type { BiomeKind } from "../game/types";
import { MAP_H, MAP_W, biomeAt } from "../game/worldMap";
import { getBiomeGroundTexture } from "./textures";

const BIOME_BYTE: Record<BiomeKind, number> = {
  meadow: 0,
  forest: 1,
  desert: 2,
  swamp: 3,
  tundra: 4,
};

export function buildBiomeIndexDataTexture(): THREE.DataTexture {
  const data = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      data[y * MAP_W + x] = BIOME_BYTE[biomeAt(x, y)];
    }
  }
  const tex = new THREE.DataTexture(data, MAP_W, MAP_H, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const MAP_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
	vec2 tileC = floor(vMapUv);
	vec2 fr = fract(vMapUv);

	int biomeIdAt(vec2 tile) {
		vec2 uvS = (tile + vec2(0.5)) / uBiomeMapSize;
		if (uvS.x < 0.0 || uvS.y < 0.0 || uvS.x > 1.0 || uvS.y > 1.0) return 0;
		float v = texture2D(biomeMap, uvS).r;
		return int(floor(v * 255.0 + 0.5));
	}

	vec4 sampBiome(int id, vec2 uv) {
		if (id <= 0) return texture2D(uTex0, uv);
		if (id == 1) return texture2D(uTex1, uv);
		if (id == 2) return texture2D(uTex2, uv);
		if (id == 3) return texture2D(uTex3, uv);
		return texture2D(uTex4, uv);
	}

	int bM = biomeIdAt(tileC);
	int bE = biomeIdAt(tileC + vec2(1.0, 0.0));
	int bW = biomeIdAt(tileC + vec2(-1.0, 0.0));
	int bN = biomeIdAt(tileC + vec2(0.0, -1.0));
	int bS = biomeIdAt(tileC + vec2(0.0, 1.0));

	float e0 = 0.34;
	float e1 = 0.64;

	float wE = (bE != bM) ? (1.0 - smoothstep(e0, e1, 1.0 - fr.x)) : 0.0;
	float wW = (bW != bM) ? (1.0 - smoothstep(e0, e1, fr.x)) : 0.0;
	float wN = (bN != bM) ? (1.0 - smoothstep(e0, e1, fr.y)) : 0.0;
	float wS = (bS != bM) ? (1.0 - smoothstep(e0, e1, 1.0 - fr.y)) : 0.0;

	float ws = wE + wW + wN + wS;
	float damp = 1.0 / (1.0 + 1.45 * ws * ws);
	wE *= damp;
	wW *= damp;
	wN *= damp;
	wS *= damp;

	float wC = max(0.0, 1.0 - wE - wW - wN - wS);
	vec4 blended = sampBiome(bM, vMapUv) * wC;
	blended += sampBiome(bE, vMapUv) * wE;
	blended += sampBiome(bW, vMapUv) * wW;
	blended += sampBiome(bN, vMapUv) * wN;
	blended += sampBiome(bS, vMapUv) * wS;
	float tw = wC + wE + wW + wN + wS;
	blended /= max(tw, 0.001);

	diffuseColor *= blended;
#endif
`;

const MAP_PARS_PATCH = /* glsl */ `
uniform sampler2D biomeMap;
uniform vec2 uBiomeMapSize;
uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform sampler2D uTex3;
uniform sampler2D uTex4;
`;

/**
 * Standard material whose `map` is ignored at shading time in favor of five biome
 * textures blended from a biome index map (rounded edge weights).
 */
export function createBiomeBlendGrassMaterial(
  realmTier: number,
  biomeIndexTex: THREE.DataTexture,
): THREE.MeshStandardMaterial {
  const tier = Math.max(1, Math.floor(realmTier));
  const t0 = getBiomeGroundTexture("meadow", tier);
  const t1 = getBiomeGroundTexture("forest", tier);
  const t2 = getBiomeGroundTexture("desert", tier);
  const t3 = getBiomeGroundTexture("swamp", tier);
  const t4 = getBiomeGroundTexture("tundra", tier);

  const whiteMap = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  whiteMap.needsUpdate = true;
  whiteMap.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshStandardMaterial({
    map: whiteMap,
    color: "#ffffff",
    roughness: 0.78,
    metalness: 0.02,
    envMapIntensity: 0.35,
  });

  mat.userData.biomeBlendGrass = true;

  const mapSizeVec = new THREE.Vector2(MAP_W, MAP_H);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.biomeMap = { value: biomeIndexTex };
    shader.uniforms.uBiomeMapSize = { value: mapSizeVec };
    shader.uniforms.uTex0 = { value: t0 };
    shader.uniforms.uTex1 = { value: t1 };
    shader.uniforms.uTex2 = { value: t2 };
    shader.uniforms.uTex3 = { value: t3 };
    shader.uniforms.uTex4 = { value: t4 };

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_pars_fragment>",
      `#include <map_pars_fragment>
${MAP_PARS_PATCH}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", MAP_FRAGMENT);
  };

  return mat;
}
