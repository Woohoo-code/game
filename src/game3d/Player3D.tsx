import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { inputController } from "../game/inputController";
import { gameStore } from "../game/state";
import { MAP_H, MAP_W, TILE, dispatchZonesAndEncounter, isBlocked } from "../game/worldMap";

/** Phaser uses 140 px/s; 1 tile = 32 px, so this is tiles-per-second. */
const WALK_SPEED_TILES = 140 / TILE;
const HALF_TILE = 0.5;
const CAM_OFFSET = new THREE.Vector3(0, 9, 9);

export function Player3D() {
  const groupRef = useRef<THREE.Group>(null);
  const lastTile = useRef({ x: -1, y: -1 });
  const camTargetLerp = useRef(new THREE.Vector3());
  const camPosLerp = useRef(new THREE.Vector3());
  const desiredCam = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());
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
      if (vx !== 0 || vz !== 0) {
        const step = WALK_SPEED_TILES * delta;
        const nextX = THREE.MathUtils.clamp(group.position.x + vx * step, HALF_TILE, MAP_W - HALF_TILE);
        const nextZ = THREE.MathUtils.clamp(group.position.z + vz * step, HALF_TILE, MAP_H - HALF_TILE);
        const nextPxX = nextX * TILE;
        const nextPxY = nextZ * TILE;
        if (!isBlocked(nextPxX, nextPxY)) {
          group.position.x = nextX;
          group.position.z = nextZ;
          if (vx !== 0 || vz !== 0) {
            group.rotation.y = Math.atan2(vx, -vz);
          }
          gameStore.setPosition(nextPxX, nextPxY);
          const tx = Math.floor(nextX);
          const ty = Math.floor(nextZ);
          if (tx !== lastTile.current.x || ty !== lastTile.current.y) {
            lastTile.current = { x: tx, y: ty };
            dispatchZonesAndEncounter(tx, ty);
          }
        }
      }
    }

    desiredCam.current.set(
      group.position.x + CAM_OFFSET.x,
      CAM_OFFSET.y,
      group.position.z + CAM_OFFSET.z
    );
    camPosLerp.current.lerp(desiredCam.current, 0.12);
    camTargetLerp.current.lerp(lookTarget.current.set(group.position.x, 0.3, group.position.z), 0.14);
    camera.position.copy(camPosLerp.current);
    camera.lookAt(camTargetLerp.current);
  });

  return (
    <group ref={groupRef}>
      {/* Shadow-catcher circle under the hero */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.28} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.45, 4, 10]} />
        <meshStandardMaterial color="#3564c3" roughness={0.6} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.92, 0]} castShadow>
        <sphereGeometry args={[0.2, 18, 14]} />
        <meshStandardMaterial color="#f6d2b0" roughness={0.6} />
      </mesh>
      {/* Hair tuft so facing direction is readable */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <coneGeometry args={[0.18, 0.18, 12]} />
        <meshStandardMaterial color="#6b4b2a" roughness={0.9} />
      </mesh>
      {/* Nose-direction marker (points +Z locally, so we can see facing) */}
      <mesh position={[0, 0.92, -0.22]} castShadow>
        <boxGeometry args={[0.08, 0.08, 0.06]} />
        <meshStandardMaterial color="#c38264" roughness={0.9} />
      </mesh>
    </group>
  );
}
