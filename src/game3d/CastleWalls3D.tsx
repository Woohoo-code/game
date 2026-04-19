import * as THREE from "three";
import type { CastleWallSegment } from "../game/worldGen";
import { getActiveWorld } from "../game/worldMap";

const WALL_H = 1.62;
const THICK = 0.17;
const MERLON_H = 0.22;
const MERLON_W = 0.26;

function stoneColor(tx: number, ty: number): string {
  const h = ((tx * 31 + ty * 17) & 0xff) / 255;
  const r = 0.52 + h * 0.06;
  const g = 0.52 + (1 - h) * 0.05;
  const b = 0.54 + h * 0.04;
  return "#" + new THREE.Color(r, g, b).getHexString();
}

function WallSegmentMesh({ seg }: { seg: CastleWallSegment }) {
  const cx = seg.tx + 0.5;
  const cz = seg.ty + 0.5;
  const col = stoneColor(seg.tx, seg.ty);
  const isEw = seg.along === "ew";
  const w = isEw ? 1 : THICK;
  const d = isEw ? THICK : 1;
  const merlons = 3;
  const off = (i: number) => (i - (merlons - 1) / 2) * 0.24;

  return (
    <group position={[cx, 0, cz]}>
      <mesh castShadow receiveShadow position={[0, WALL_H / 2, 0]}>
        <boxGeometry args={[w, WALL_H, d]} />
        <meshStandardMaterial color={col} roughness={0.88} metalness={0.06} />
      </mesh>
      {/* Merlons — read as crenellated curtain, not one solid block */}
      {Array.from({ length: merlons }, (_, i) => (
        <mesh
          key={i}
          castShadow
          position={[isEw ? off(i) : 0, WALL_H + MERLON_H / 2, isEw ? 0 : off(i)]}
        >
          <boxGeometry args={[isEw ? MERLON_W : THICK * 0.95, MERLON_H, isEw ? THICK * 0.95 : MERLON_W]} />
          <meshStandardMaterial color={col} roughness={0.82} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

/** Curtain wall around Crownkeep (realm 1) — many independent segments from world gen. */
export function CrownkeepCastleWalls3D() {
  const segs = getActiveWorld().crownkeepCastleWalls;
  if (!segs?.length) return null;

  return (
    <group name="crownkeep-castle-walls">
      {segs.map((seg, i) => (
        <WallSegmentMesh key={`cw-${seg.tx}-${seg.ty}-${seg.along}-${i}`} seg={seg} />
      ))}
    </group>
  );
}

/** Iron portcullis and posts at the south curtain gap. */
export function CrownkeepSouthGate3D() {
  const ck = getActiveWorld().crownkeep;
  if (!ck) return null;
  const cx = (ck.minX + ck.maxX) / 2 + 0.5;
  const z = ck.maxY + 0.62;
  const stone = "#5a5048";
  return (
    <group name="crownkeep-south-gate" position={[cx, 0, z]}>
      <mesh position={[-1.05, 0.75, 0]} castShadow>
        <boxGeometry args={[0.45, 1.55, 0.35]} />
        <meshStandardMaterial color={stone} roughness={0.86} />
      </mesh>
      <mesh position={[1.05, 0.75, 0]} castShadow>
        <boxGeometry args={[0.45, 1.55, 0.35]} />
        <meshStandardMaterial color={stone} roughness={0.86} />
      </mesh>
      <mesh position={[0, 1.38, 0]} castShadow>
        <boxGeometry args={[2.85, 0.32, 0.4]} />
        <meshStandardMaterial color="#4a4038" roughness={0.82} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.82, 0.12]}>
        <boxGeometry args={[2.25, 1.35, 0.08]} />
        <meshStandardMaterial color="#2a2018" metalness={0.55} roughness={0.45} />
      </mesh>
    </group>
  );
}
