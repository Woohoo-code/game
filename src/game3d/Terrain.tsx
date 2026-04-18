import { useMemo } from "react";
import * as THREE from "three";
import { MAP_H, MAP_W, type TerrainKind, terrainAt } from "../game/worldMap";

const COLOR_BY_TERRAIN: Record<TerrainKind, THREE.Color> = {
  grass: new THREE.Color("#4f7b45"),
  road: new THREE.Color("#8d7a5e"),
  water: new THREE.Color("#2f5f9a"),
  town: new THREE.Color("#a88960")
};

export function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let vi = 0;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const col = COLOR_BY_TERRAIN[terrainAt(x, y)].clone();
        col.convertSRGBToLinear();
        const h = terrainAt(x, y) === "water" ? -0.1 : 0;
        positions.push(x, h, y, x + 1, h, y, x + 1, h, y + 1, x, h, y + 1);
        for (let i = 0; i < 4; i++) colors.push(col.r, col.g, col.b);
        indices.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
        vi += 4;
      }
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshLambertMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  );
}
