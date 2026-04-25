import { useMemo } from "react";
import * as THREE from "three";
import type { CastleWallSegment } from "../game/worldGen";
import { getActiveWorld } from "../game/worldMap";
import { getCastleWallTexture } from "./textures";

const WALL_H = 1.62;
const THICK = 0.17;
const MERLON_H = 0.22;
const MERLON_W = 0.26;

/** Slight per-tile warmth so long runs of wall are not perfectly identical. */
function stoneTintHex(tx: number, ty: number): string {
  const h = ((tx * 31 + ty * 17) & 0xff) / 255;
  const c = new THREE.Color(0.94 + h * 0.04, 0.93 + (1 - h) * 0.04, 0.92 + h * 0.03);
  return `#${c.getHexString()}`;
}

function WallSegmentMesh({
  seg,
  wallMap,
}: {
  seg: CastleWallSegment;
  wallMap: THREE.CanvasTexture;
}) {
  const cx = seg.tx + 0.5;
  const cz = seg.ty + 0.5;
  const tint = stoneTintHex(seg.tx, seg.ty);
  const isEw = seg.along === "ew";
  const w = isEw ? 1 : THICK;
  const d = isEw ? THICK : 1;
  const merlons = 3;
  const off = (i: number) => (i - (merlons - 1) / 2) * 0.24;

  return (
    <group position={[cx, 0, cz]}>
      <mesh castShadow receiveShadow position={[0, WALL_H / 2, 0]}>
        <boxGeometry args={[w, WALL_H, d]} />
        <meshStandardMaterial
          map={wallMap}
          color={tint}
          roughness={0.88}
          metalness={0.04}
          envMapIntensity={0.38}
        />
      </mesh>
      {/* Merlons — read as crenellated curtain, not one solid block */}
      {Array.from({ length: merlons }, (_, i) => (
        <mesh
          key={i}
          castShadow
          position={[isEw ? off(i) : 0, WALL_H + MERLON_H / 2, isEw ? 0 : off(i)]}
        >
          <boxGeometry args={[isEw ? MERLON_W : THICK * 0.95, MERLON_H, isEw ? THICK * 0.95 : MERLON_W]} />
          <meshStandardMaterial
            map={wallMap}
            color={tint}
            roughness={0.84}
            metalness={0.04}
            envMapIntensity={0.34}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Curtain wall around Crownkeep (realm 1) — many independent segments from world gen. */
export function CrownkeepCastleWalls3D() {
  const segs = getActiveWorld().crownkeepCastleWalls;
  const wallMap = useMemo(() => {
    const t = getCastleWallTexture().clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2.15, 2.82);
    t.needsUpdate = true;
    return t;
  }, []);

  if (!segs?.length) return null;

  return (
    <group name="crownkeep-castle-walls">
      {segs.map((seg, i) => (
        <WallSegmentMesh key={`cw-${seg.tx}-${seg.ty}-${seg.along}-${i}`} seg={seg} wallMap={wallMap} />
      ))}
    </group>
  );
}

/** Iron portcullis and posts at the south curtain gap. */
export function CrownkeepSouthGate3D() {
  const gateStoneMap = useMemo(() => {
    const t = getCastleWallTexture().clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1.25, 2.35);
    t.needsUpdate = true;
    return t;
  }, []);
  const ck = getActiveWorld().crownkeep;
  if (!ck) return null;
  const gateTiles = ck.gateTiles;
  const gi = Math.min(Math.max(0, Math.floor((gateTiles.length - 1) / 2)), Math.max(0, gateTiles.length - 1));
  const center = gateTiles[gi];
  const cx = center ? center.tx + 0.5 : (ck.minX + ck.maxX) / 2 + 0.5;
  const z = center ? center.ty + 0.5 : ck.maxY + 1 + 0.5;
  return (
    <group name="crownkeep-south-gate" position={[cx, 0, z]}>
      <mesh position={[-1.05, 0.75, 0]} castShadow>
        <boxGeometry args={[0.45, 1.55, 0.35]} />
        <meshStandardMaterial
          map={gateStoneMap}
          color="#c8c2bc"
          roughness={0.88}
          metalness={0.04}
        />
      </mesh>
      <mesh position={[1.05, 0.75, 0]} castShadow>
        <boxGeometry args={[0.45, 1.55, 0.35]} />
        <meshStandardMaterial
          map={gateStoneMap}
          color="#c8c2bc"
          roughness={0.88}
          metalness={0.04}
        />
      </mesh>
      <mesh position={[0, 1.38, 0]} castShadow>
        <boxGeometry args={[2.85, 0.32, 0.4]} />
        <meshStandardMaterial
          map={gateStoneMap}
          color="#b0aaa4"
          roughness={0.84}
          metalness={0.06}
        />
      </mesh>
      <mesh position={[0, 0.82, 0.12]}>
        <boxGeometry args={[2.25, 1.35, 0.08]} />
        <meshStandardMaterial color="#2a2018" metalness={0.55} roughness={0.45} />
      </mesh>
    </group>
  );
}
