import { memo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { HorseKey } from "../game/types";

function coatForMount(k: HorseKey): { body: string; mane: string; hoof: string } {
  switch (k) {
    case "dustPony":
      return { body: "#b5a898", mane: "#6d6258", hoof: "#2a2420" };
    case "moorCob":
      return { body: "#6e5c4a", mane: "#3a3028", hoof: "#1c1814" };
    case "riverPalfrey":
      return { body: "#5a6572", mane: "#2c3540", hoof: "#181c22" };
    case "sunCourser":
      return { body: "#c9a050", mane: "#6b4a28", hoof: "#2a1c10" };
    case "stormcharger":
      return { body: "#4a4558", mane: "#1e1a28", hoof: "#0e0c12" };
    default:
      return { body: "#7a6655", mane: "#3d3228", hoof: "#1a1612" };
  }
}

/**
 * Simple mount under the hero: body, neck, head, four legs with a walk cycle when `movingRef` is true.
 * Faces local −Z (matches CharacterModel / player facing).
 */
export const MountHorse3D = memo(function MountHorse3D({
  mountKey,
  movingRef
}: {
  mountKey: HorseKey;
  movingRef: MutableRefObject<boolean>;
}) {
  const phase = useRef(0);
  const bob = useRef(0);
  const flRef = useRef<THREE.Group>(null);
  const frRef = useRef<THREE.Group>(null);
  const blRef = useRef<THREE.Group>(null);
  const brRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const { body, mane, hoof } = coatForMount(mountKey);

  useFrame((_, dt) => {
    const moving = movingRef.current;
    if (moving) {
      phase.current += dt * 11;
    } else {
      phase.current += dt * 0.9;
    }
    const p = phase.current;
    const stride = moving ? 0.55 : 0.06;
    const s0 = Math.sin(p) * stride;
    const s1 = Math.sin(p + Math.PI) * stride;

    if (flRef.current) flRef.current.rotation.x = s0;
    if (frRef.current) frRef.current.rotation.x = s1;
    if (blRef.current) blRef.current.rotation.x = s1;
    if (brRef.current) brRef.current.rotation.x = s0;

    bob.current = moving ? Math.sin(p * 2) * 0.018 : Math.sin(p * 0.8) * 0.008;
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.34 + bob.current;
    }
  });

  const legMat = <meshStandardMaterial color={body} roughness={0.62} />;
  const hoofMat = <meshStandardMaterial color={hoof} roughness={0.75} />;

  return (
    <group name="mount-horse">
      <group ref={bodyRef} position={[0, 0.34, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.44, 0.2, 0.74]} />
          {legMat}
        </mesh>
        <mesh position={[0, 0.06, -0.38]} rotation={[0.5, 0, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.2, 6, 8]} />
          {legMat}
        </mesh>
        <mesh position={[0, 0.14, -0.58]} castShadow>
          <boxGeometry args={[0.16, 0.12, 0.26]} />
          {legMat}
        </mesh>
        <mesh position={[0.02, 0.12, -0.52]} castShadow>
          <boxGeometry args={[0.04, 0.06, 0.08]} />
          <meshStandardMaterial color={mane} roughness={0.88} />
        </mesh>

        <group ref={flRef} position={[0.16, -0.06, 0.26]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.26, 5, 8]} />
            {legMat}
          </mesh>
          <mesh position={[0, -0.3, 0.02]} castShadow>
            <boxGeometry args={[0.07, 0.05, 0.09]} />
            {hoofMat}
          </mesh>
        </group>
        <group ref={frRef} position={[-0.16, -0.06, 0.26]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.26, 5, 8]} />
            {legMat}
          </mesh>
          <mesh position={[0, -0.3, 0.02]} castShadow>
            <boxGeometry args={[0.07, 0.05, 0.09]} />
            {hoofMat}
          </mesh>
        </group>
        <group ref={blRef} position={[0.16, -0.06, -0.28]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.28, 5, 8]} />
            {legMat}
          </mesh>
          <mesh position={[0, -0.32, 0.02]} castShadow>
            <boxGeometry args={[0.07, 0.05, 0.09]} />
            {hoofMat}
          </mesh>
        </group>
        <group ref={brRef} position={[-0.16, -0.06, -0.28]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.28, 5, 8]} />
            {legMat}
          </mesh>
          <mesh position={[0, -0.32, 0.02]} castShadow>
            <boxGeometry args={[0.07, 0.05, 0.09]} />
            {hoofMat}
          </mesh>
        </group>
      </group>
    </group>
  );
});
