import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { playStepThrottled, unlockAudio } from "../game/audio";
import {
  highestOwnedHorseKey,
  overworldHorseWalkSpeedMultiplier,
  stableHorseSpeedBonus,
} from "../game/data";
import { currentDungeonFloor } from "../game/dungeon";
import { inputController } from "../game/inputController";
import { gameStore } from "../game/state";
import type { PlayerAppearance } from "../game/types";
import { useGameStoreSelector } from "../game/useGameStore";
import { sunDirectionUnit, sunHeight01 } from "../game/worldClock";
import {
  MAP_H,
  MAP_W,
  TILE,
  TERRAIN_SPEED_MULT,
  dispatchZonesAndEncounter,
  isBlocked,
  terrainAt,
} from "../game/worldMap";
import { CharacterModel } from "./CharacterModel";
import { MountHorse3D } from "./MountHorse3D";

/** Match legacy Phaser walk: 140 px/s ÷ 32 px per tile. */
const WALK_SPEED_TILES = 140 / TILE;
const HALF_TILE = 0.5;
/** Default follow offset from player (world units); scaled by `cameraDistanceScale`. */
const BASE_CAM_OFFSET = new THREE.Vector3(0, 9, 9);

/** Soft foot shadow aligned with sun direction (overworld only). */
function PlayerGroundSunShadow({ worldTime }: { worldTime: number }) {
  const { rotY, elong, opacity, offsetX, offsetZ } = useMemo(() => {
    const dir = sunDirectionUnit(worldTime);
    const sx = -dir.x;
    const sz = -dir.z;
    const len = Math.hypot(sx, sz);
    const rotY = len < 1e-5 ? 0 : Math.atan2(sx, sz);
    const sunH = sunHeight01(worldTime);
    const elong = 1 + Math.min(2.9, len * 3.15);
    const opacity = Math.min(0.34, 0.1 + 0.14 * (1 - len * 0.28) + sunH * 0.08);
    // Nudge the decal center slightly opposite the sun on XZ so the darkest part sits closer
    // to the contact area when the sun is low (pure centered circles read “floating”).
    const flatLen = Math.hypot(dir.x, dir.z) || 1;
    const lowSun = 1 - sunH;
    const shift = 0.055 * lowSun * Math.min(1.35, elong * 0.42);
    const offsetX = (-dir.x / flatLen) * shift;
    const offsetZ = (-dir.z / flatLen) * shift;
    return { rotY, elong, opacity, offsetX, offsetZ };
  }, [worldTime]);

  return (
    <group position={[offsetX, 0, offsetZ]} rotation={[0, rotY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} scale={[elong, 1, 1]}>
        <circleGeometry args={[0.4, 32]} />
        <meshBasicMaterial color="#000" transparent opacity={opacity} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Player3D({
  appearance,
  cameraMotionEnabled = false,
  cameraDistanceScale = 1,
}: {
  appearance: PlayerAppearance;
  cameraMotionEnabled?: boolean;
  /** 1 = default follow distance; lower pulls the camera closer, higher pushes it back. */
  cameraDistanceScale?: number;
}) {
  const { inDungeon, worldTimeRaw, horsesOwned } = useGameStoreSelector((s) => ({
    inDungeon: s.world.inDungeon,
    worldTimeRaw: s.world.worldTime ?? 0,
    horsesOwned: s.player.horsesOwned ?? [],
  }));
  const worldTime = Number.isFinite(worldTimeRaw) ? worldTimeRaw : 0;
  const riding = stableHorseSpeedBonus(horsesOwned) > 0;
  const bestMount = highestOwnedHorseKey(horsesOwned);
  const groupRef = useRef<THREE.Group>(null);
  const lastTile = useRef({ x: -1, y: -1 });
  const camTargetLerp = useRef(new THREE.Vector3());
  const camPosLerp = useRef(new THREE.Vector3());
  const desiredCam = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());
  const movingRef = useRef(false);
  const deadRef = useRef(false);
  const { camera } = useThree();

  const camOffset = useMemo(
    () => BASE_CAM_OFFSET.clone().multiplyScalar(cameraDistanceScale),
    [cameraDistanceScale],
  );

  useEffect(() => {
    if (!groupRef.current) return;
    const p = gameStore.getSnapshot().player;
    groupRef.current.position.set(p.x / TILE, 0, p.y / TILE);
    camTargetLerp.current.set(p.x / TILE, 0, p.y / TILE);
    camPosLerp.current.set(
      p.x / TILE + camOffset.x,
      camOffset.y,
      p.y / TILE + camOffset.z,
    );
    camera.position.copy(camPosLerp.current);
    camera.lookAt(camTargetLerp.current);
  }, [camera, camOffset]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const snapshot = gameStore.getSnapshot();

    // Update dead state based on player health
    deadRef.current = snapshot.player.hp <= 0;

    // Snap in sync with external store changes (save/load).
    const storeTileX = snapshot.player.x / TILE;
    const storeTileZ = snapshot.player.y / TILE;
    if (
      Math.abs(group.position.x - storeTileX) > 1 ||
      Math.abs(group.position.z - storeTileZ) > 1
    ) {
      group.position.set(storeTileX, 0, storeTileZ);
    }

    if (!snapshot.battle.inBattle && !deadRef.current) {
      let vx = 0;
      let vz = 0;
      if (inputController.isPressed("left")) vx -= 1;
      if (inputController.isPressed("right")) vx += 1;
      if (inputController.isPressed("up")) vz -= 1;
      if (inputController.isPressed("down")) vz += 1;
      movingRef.current = vx !== 0 || vz !== 0;
      const horses = snapshot.player.horsesOwned ?? [];
      const walkMult = overworldHorseWalkSpeedMultiplier(horses);
      const dg = snapshot.world.inDungeon ? snapshot.world.dungeon : null;
      const dFloor = dg ? currentDungeonFloor(dg) : null;
      const boundW = dFloor ? dFloor.width : MAP_W;
      const boundH = dFloor ? dFloor.height : MAP_H;
      if (vx !== 0 || vz !== 0) {
        unlockAudio();
        const curTx = Math.floor(group.position.x);
        const curTy = Math.floor(group.position.z);
        // In dungeons everything is flat floor; skip terrain multiplier there.
        const terrainMult = dFloor
          ? 1
          : (TERRAIN_SPEED_MULT[terrainAt(curTx, curTy)] ?? 1);
        const step = WALK_SPEED_TILES * walkMult * terrainMult * delta;
        const nextX = THREE.MathUtils.clamp(
          group.position.x + vx * step,
          HALF_TILE,
          boundW - HALF_TILE,
        );
        const nextZ = THREE.MathUtils.clamp(
          group.position.z + vz * step,
          HALF_TILE,
          boundH - HALF_TILE,
        );
        const nextPxX = nextX * TILE;
        const nextPxY = nextZ * TILE;
        // Standard Three.js XZ move direction — mesh forward should align to (vx, vz) when
        // the asset faces +Z; face movement even when a wall blocks position (stops sliding
        // but shows intended direction). Previously atan2(-vx, -vz) was ~180° off for many FBX.
        group.rotation.y = Math.atan2(vx, vz);

        if (!isBlocked(nextPxX, nextPxY)) {
          group.position.x = nextX;
          group.position.z = nextZ;
          gameStore.setPosition(nextPxX, nextPxY);
          const tx = Math.floor(nextX);
          const ty = Math.floor(nextZ);
          if (tx !== lastTile.current.x || ty !== lastTile.current.y) {
            lastTile.current = { x: tx, y: ty };
            dispatchZonesAndEncounter(tx, ty);
            playStepThrottled();
          }
        }
      }
    } else {
      movingRef.current = false;
    }

    const movementLag = cameraMotionEnabled ? 0.12 : 1;
    const lookLag = cameraMotionEnabled ? 0.14 : 1;
    const tiltY = cameraMotionEnabled ? 0.3 : 0.15;
    desiredCam.current.set(
      group.position.x + camOffset.x,
      camOffset.y,
      group.position.z + camOffset.z,
    );
    camPosLerp.current.lerp(desiredCam.current, movementLag);
    camTargetLerp.current.lerp(
      lookTarget.current.set(group.position.x, tiltY, group.position.z),
      lookLag,
    );
    camera.position.copy(camPosLerp.current);
    camera.lookAt(camTargetLerp.current);
  });

  return (
    <group ref={groupRef}>
      {!inDungeon && <PlayerGroundSunShadow worldTime={worldTime} />}
      {riding && bestMount && !deadRef.current ? (
        <MountHorse3D mountKey={bestMount} movingRef={movingRef} />
      ) : null}
      {/* When riding, drop the pelvis onto the horse's back (saddle top sits
          at ~y=0.44; the character's local HIP_Y is 0.40, so 0.06 plants the
          pelvis on the saddle with a small seat bump). On foot, feet stay on
          the ground at y=0. */}
      <group position={[0, riding && !deadRef.current ? 0.06 : 0, 0]}>
        <CharacterModel
          appearance={appearance}
          omitContactShadow={!inDungeon}
          showFaceMarker
          movingRef={movingRef}
          riding={riding && !deadRef.current}
        />
      </group>
    </group>
  );
}
