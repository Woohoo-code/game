import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { HairStyle, PlayerAppearance } from "../game/types";

interface CharacterModelProps {
  appearance: PlayerAppearance;
  /** When true, the model auto-rotates (preview). */
  turntable?: boolean;
  /** When true, includes the small "nose" marker that makes facing direction readable in gameplay. */
  showFaceMarker?: boolean;
}

function Hair({ style, color }: { style: HairStyle; color: string }) {
  if (style === "bald") return null;
  if (style === "spiky") {
    return (
      <group position={[0, 1.05, 0]}>
        <mesh castShadow>
          <coneGeometry args={[0.19, 0.24, 12]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[-0.12, 0.02, 0]} rotation={[0, 0, -0.3]}>
          <coneGeometry args={[0.05, 0.14, 8]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh position={[0.12, 0.02, 0]} rotation={[0, 0, 0.3]}>
          <coneGeometry args={[0.05, 0.14, 8]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </group>
    );
  }
  if (style === "long") {
    return (
      <group>
        {/* Cap */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <sphereGeometry args={[0.21, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        {/* Long fall behind shoulders */}
        <mesh position={[0, 0.68, -0.14]} castShadow>
          <boxGeometry args={[0.36, 0.5, 0.08]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      </group>
    );
  }
  // short
  return (
    <mesh position={[0, 1.02, 0]} castShadow>
      <sphereGeometry args={[0.21, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

export function CharacterModel({ appearance, turntable = false, showFaceMarker = false }: CharacterModelProps) {
  const rootRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!turntable || !rootRef.current) return;
    rootRef.current.rotation.y += dt * 0.4;
  });
  const skin = appearance.skin;
  const hair = appearance.hair;
  const outfit = appearance.outfit;
  const pants = appearance.pants;
  return (
    <group ref={rootRef}>
      {/* Shadow-catcher circle under hero */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.28} />
      </mesh>

      {/* Pants / lower body */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.25, 14]} />
        <meshStandardMaterial color={pants} roughness={0.75} />
      </mesh>

      {/* Torso / outfit */}
      <mesh position={[0, 0.47, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.3, 6, 12]} />
        <meshStandardMaterial color={outfit} roughness={0.6} />
      </mesh>

      {/* Belt */}
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.225, 0.225, 0.05, 16]} />
        <meshStandardMaterial color="#2a2030" roughness={0.9} />
      </mesh>

      {/* Arms (skin sleeves) */}
      <mesh position={[-0.3, 0.5, 0]} rotation={[0, 0, 0.15]} castShadow>
        <capsuleGeometry args={[0.075, 0.26, 5, 10]} />
        <meshStandardMaterial color={outfit} roughness={0.7} />
      </mesh>
      <mesh position={[0.3, 0.5, 0]} rotation={[0, 0, -0.15]} castShadow>
        <capsuleGeometry args={[0.075, 0.26, 5, 10]} />
        <meshStandardMaterial color={outfit} roughness={0.7} />
      </mesh>
      {/* Hands */}
      <mesh position={[-0.36, 0.3, 0]} castShadow>
        <sphereGeometry args={[0.075, 12, 10]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0.36, 0.3, 0]} castShadow>
        <sphereGeometry args={[0.075, 12, 10]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <sphereGeometry args={[0.2, 22, 18]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.07, 0.92, -0.17]}>
        <sphereGeometry args={[0.022, 10, 8]} />
        <meshStandardMaterial color="#19202b" />
      </mesh>
      <mesh position={[0.07, 0.92, -0.17]}>
        <sphereGeometry args={[0.022, 10, 8]} />
        <meshStandardMaterial color="#19202b" />
      </mesh>

      {/* Hair */}
      <Hair style={appearance.hairStyle} color={hair} />

      {/* Small facing marker for overworld: tiny nose on -Z (forward) */}
      {showFaceMarker && (
        <mesh position={[0, 0.9, -0.21]} castShadow>
          <boxGeometry args={[0.06, 0.05, 0.05]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      )}
    </group>
  );
}
