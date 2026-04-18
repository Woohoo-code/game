import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gameStore } from "../game/state";
import { TILE } from "../game/worldMap";
import { useGameStore } from "../game/useGameStore";
import { MonsterByShape } from "./MonsterModels";

/**
 * Active pet companion that trails the player in the overworld.
 *
 * Reads the player tile position directly from the store each frame (so it
 * keeps up with the smooth movement the player runs on) and lags a little
 * behind + to one side so it doesn't clip into the hero.
 */
const FOLLOW_OFFSET = new THREE.Vector3(-0.55, 0, 0.55);
const FOLLOW_LERP = 0.18;
const PET_SCALE = 0.55;

export function Pet3D() {
  const snapshot = useGameStore();
  const groupRef = useRef<THREE.Group>(null);
  const targetRef = useRef(new THREE.Vector3());

  const pets = snapshot.player.pets ?? [];
  const activePet = pets.find((p) => p.id === snapshot.player.activePetId) ?? null;

  useEffect(() => {
    if (!groupRef.current) return;
    const p = gameStore.getSnapshot().player;
    groupRef.current.position.set(p.x / TILE + FOLLOW_OFFSET.x, 0, p.y / TILE + FOLLOW_OFFSET.z);
  }, [activePet?.id]);

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;
    if (!activePet) return;
    const p = gameStore.getSnapshot().player;
    targetRef.current.set(p.x / TILE + FOLLOW_OFFSET.x, 0, p.y / TILE + FOLLOW_OFFSET.z);
    group.position.lerp(targetRef.current, Math.min(1, FOLLOW_LERP + dt));
    // Face toward the player so the pet looks like it's tagging along.
    const dx = p.x / TILE - group.position.x;
    const dz = p.y / TILE - group.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.02) {
      group.rotation.y = Math.atan2(-dx, -dz);
    }
  });

  if (!activePet) return null;

  return (
    <group ref={groupRef} scale={[PET_SCALE, PET_SCALE, PET_SCALE]}>
      <MonsterByShape
        shape={activePet.bodyShape}
        primary={activePet.colorPrimary}
        accent={activePet.colorAccent}
      />
    </group>
  );
}
