import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { playStepThrottled, unlockAudio } from "../game/audio";
import { highestOwnedHorseKey, overworldHorseWalkSpeedMultiplier, stableHorseSpeedBonus } from "../game/data";
import { currentDungeonFloor } from "../game/dungeon";
import { inputController } from "../game/inputController";
import { gameStore } from "../game/state";
import type { PlayerAppearance } from "../game/types";
import { useGameStore } from "../game/useGameStore";
import {
  MAP_H,
  MAP_W,
  TILE,
  TERRAIN_SPEED_MULT,
  dispatchZonesAndEncounter,
  isBlocked,
  terrainAt
} from "../game/worldMap";
import { CharacterModel } from "./CharacterModel";
import { MountHorse3D } from "./MountHorse3D";

/** Phaser uses 140 px/s; 1 tile = 32 px, so this is tiles-per-second. */
const WALK_SPEED_TILES = 140 / TILE;
const HALF_TILE = 0.5;
const CAM_OFFSET = new THREE.Vector3(0, 9, 9);

export function Player3D({
  appearance,
  cameraMotionEnabled = false
}: {
  appearance: PlayerAppearance;
  cameraMotionEnabled?: boolean;
}) {
  const hud = useGameStore();
  const horsesOwned = hud.player.horsesOwned ?? [];
  const riding = stableHorseSpeedBonus(horsesOwned) > 0;
  const bestMount = highestOwnedHorseKey(horsesOwned);
  const groupRef = useRef<THREE.Group>(null);
  const lastTile = useRef({ x: -1, y: -1 });
  const camTargetLerp = useRef(new THREE.Vector3());
  const camPosLerp = useRef(new THREE.Vector3());
  const desiredCam = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());
  const movingRef = useRef(false);
  const { camera } = useThree();

  useEffect(() => {
    if (!groupRef.current) return;
    const p = gameStore.getSnapshot().player;
    groupRef.current.position.set(p.x / TILE, 0, p.y / TILE);
    camTargetLerp.current.set(p.x / TILE, 0, p.y / TILE);
    camPosLerp.current.set(p.x / TILE + CAM_OFFSET.x, CAM_OFFSET.y, p.y / TILE + CAM_OFFSET.z);
    camera.position.copy(camPosLerp.current);
    camera.lookAt(camTargetLerp.current);
  }, [camera]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const snapshot = gameStore.getSnapshot();

    // Snap in sync with external store changes (save/load).
    const storeTileX = snapshot.player.x / TILE;
    const storeTileZ = snapshot.player.y / TILE;
    if (Math.abs(group.position.x - storeTileX) > 1 || Math.abs(group.position.z - storeTileZ) > 1) {
      group.position.set(storeTileX, 0, storeTileZ);
    }

    if (!snapshot.battle.inBattle) {
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
          : TERRAIN_SPEED_MULT[terrainAt(curTx, curTy)] ?? 1;
        const step = WALK_SPEED_TILES * walkMult * terrainMult * delta;
        const nextX = THREE.MathUtils.clamp(group.position.x + vx * step, HALF_TILE, boundW - HALF_TILE);
        const nextZ = THREE.MathUtils.clamp(group.position.z + vz * step, HALF_TILE, boundH - HALF_TILE);
        const nextPxX = nextX * TILE;
        const nextPxY = nextZ * TILE;
        if (!isBlocked(nextPxX, nextPxY)) {
          group.position.x = nextX;
          group.position.z = nextZ;
          if (vx !== 0 || vz !== 0) {
            group.rotation.y = Math.atan2(-vx, -vz);
          }
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
    desiredCam.current.set(group.position.x + CAM_OFFSET.x, CAM_OFFSET.y, group.position.z + CAM_OFFSET.z);
    camPosLerp.current.lerp(desiredCam.current, movementLag);
    camTargetLerp.current.lerp(lookTarget.current.set(group.position.x, tiltY, group.position.z), lookLag);
    camera.position.copy(camPosLerp.current);
    camera.lookAt(camTargetLerp.current);
  });

  return (
    <group ref={groupRef}>
      {riding && bestMount ? <MountHorse3D mountKey={bestMount} movingRef={movingRef} /> : null}
      {/* When riding, drop the pelvis onto the horse's back (saddle top sits
          at ~y=0.44; the character's local HIP_Y is 0.40, so 0.06 plants the
          pelvis on the saddle with a small seat bump). On foot, feet stay on
          the ground at y=0. */}
      <group position={[0, riding ? 0.06 : 0, 0]}>
        <CharacterModel
          appearance={appearance}
          showFaceMarker
          movingRef={movingRef}
          riding={riding}
        />
      </group>
    </group>
  );
}
