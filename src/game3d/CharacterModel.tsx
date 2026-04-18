import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { FacialHairStyle, HairStyle, PlayerAppearance } from "../game/types";

interface CharacterModelProps {
  appearance: PlayerAppearance;
  /** When true, the model auto-rotates (preview). */
  turntable?: boolean;
  /** When true, adds a soft forward marker so facing reads clearly in gameplay. */
  showFaceMarker?: boolean;
}

const hairMat = (color: string) => (
  <meshStandardMaterial color={color} roughness={0.78} metalness={0.08} />
);

const beardMat = (color: string) => (
  <meshStandardMaterial color={color} roughness={0.88} metalness={0.04} />
);

/** Chin / jaw facial hair in front-of-face space (same −Z hemisphere as mouth). */
function Beard({ style, color }: { style: FacialHairStyle; color: string }) {
  if (style === "none") return null;

  if (style === "stubble") {
    const dots: [number, number, number][] = [
      [-0.1, 0.84, -0.168],
      [-0.05, 0.82, -0.174],
      [0, 0.805, -0.178],
      [0.05, 0.82, -0.174],
      [0.1, 0.84, -0.168],
      [-0.08, 0.78, -0.165],
      [0.08, 0.78, -0.165],
      [0, 0.772, -0.178],
      [-0.04, 0.798, -0.176],
      [0.04, 0.798, -0.176]
    ];
    return (
      <group>
        {dots.map((p, i) => (
          <mesh key={i} position={p} castShadow>
            <sphereGeometry args={[0.018, 6, 6]} />
            {beardMat(color)}
          </mesh>
        ))}
      </group>
    );
  }

  if (style === "goatee") {
    return (
      <group>
        <mesh position={[0, 0.798, -0.186]} rotation={[0.25, 0, 0]} castShadow>
          <capsuleGeometry args={[0.038, 0.1, 5, 8]} />
          {beardMat(color)}
        </mesh>
        <mesh position={[0, 0.758, -0.172]} castShadow>
          <sphereGeometry args={[0.045, 10, 8]} />
          {beardMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "shortBeard") {
    return (
      <group>
        <mesh position={[0, 0.8, -0.168]} rotation={[0.12, 0, 0]} castShadow>
          <boxGeometry args={[0.22, 0.1, 0.1]} />
          {beardMat(color)}
        </mesh>
        <mesh position={[-0.1, 0.82, -0.15]} rotation={[0.08, 0, 0.12]} castShadow>
          <boxGeometry args={[0.08, 0.09, 0.08]} />
          {beardMat(color)}
        </mesh>
        <mesh position={[0.1, 0.82, -0.15]} rotation={[0.08, 0, -0.12]} castShadow>
          <boxGeometry args={[0.08, 0.09, 0.08]} />
          {beardMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "fullBeard") {
    return (
      <group>
        <mesh position={[0, 0.795, -0.162]} rotation={[0.1, 0, 0]} castShadow>
          <boxGeometry args={[0.26, 0.14, 0.12]} />
          {beardMat(color)}
        </mesh>
        <mesh position={[-0.12, 0.825, -0.138]} rotation={[0.05, 0, 0.18]} castShadow>
          <boxGeometry args={[0.1, 0.14, 0.1]} />
          {beardMat(color)}
        </mesh>
        <mesh position={[0.12, 0.825, -0.138]} rotation={[0.05, 0, -0.18]} castShadow>
          <boxGeometry args={[0.1, 0.14, 0.1]} />
          {beardMat(color)}
        </mesh>
        <mesh position={[0, 0.752, -0.168]} castShadow>
          <sphereGeometry args={[0.055, 10, 8]} />
          {beardMat(color)}
        </mesh>
      </group>
    );
  }

  return null;
}

/** Eyes, brows, nose, mouth, ears — sits on the head sphere. */
function Face({ skin }: { skin: string }) {
  const sclera = "#e8eef8";
  const iris = "#2a3a55";
  const pupil = "#0a0c10";
  const brow = "#2c2218";
  const lip = "#a85a5a";

  return (
    <group>
      {/* Sclera */}
      <mesh position={[-0.072, 0.918, -0.166]}>
        <sphereGeometry args={[0.03, 14, 12]} />
        <meshStandardMaterial color={sclera} roughness={0.35} />
      </mesh>
      <mesh position={[0.072, 0.918, -0.166]}>
        <sphereGeometry args={[0.03, 14, 12]} />
        <meshStandardMaterial color={sclera} roughness={0.35} />
      </mesh>
      {/* Irises */}
      <mesh position={[-0.072, 0.916, -0.178]}>
        <sphereGeometry args={[0.017, 12, 10]} />
        <meshStandardMaterial color={iris} roughness={0.45} />
      </mesh>
      <mesh position={[0.072, 0.916, -0.178]}>
        <sphereGeometry args={[0.017, 12, 10]} />
        <meshStandardMaterial color={iris} roughness={0.45} />
      </mesh>
      {/* Pupils */}
      <mesh position={[-0.072, 0.914, -0.186]}>
        <sphereGeometry args={[0.009, 8, 8]} />
        <meshStandardMaterial color={pupil} roughness={0.25} />
      </mesh>
      <mesh position={[0.072, 0.914, -0.186]}>
        <sphereGeometry args={[0.009, 8, 8]} />
        <meshStandardMaterial color={pupil} roughness={0.25} />
      </mesh>
      {/* Catchlights */}
      <mesh position={[-0.078, 0.926, -0.192]}>
        <sphereGeometry args={[0.0045, 6, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0.066, 0.926, -0.192]}>
        <sphereGeometry args={[0.0045, 6, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} />
      </mesh>
      {/* Eyebrows */}
      <mesh position={[-0.07, 0.968, -0.158]} rotation={[0.12, 0, -0.12]}>
        <boxGeometry args={[0.095, 0.016, 0.014]} />
        <meshStandardMaterial color={brow} roughness={0.92} />
      </mesh>
      <mesh position={[0.07, 0.968, -0.158]} rotation={[0.12, 0, 0.12]}>
        <boxGeometry args={[0.095, 0.016, 0.014]} />
        <meshStandardMaterial color={brow} roughness={0.92} />
      </mesh>
      {/* Nose bridge + tip */}
      <mesh position={[0, 0.895, -0.188]} rotation={[0.35, 0, 0]}>
        <capsuleGeometry args={[0.038, 0.07, 4, 8]} />
        <meshStandardMaterial color={skin} roughness={0.62} />
      </mesh>
      {/* Mouth */}
      <mesh position={[0, 0.818, -0.182]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[0.065, 0.018, 0.012]} />
        <meshStandardMaterial color={lip} roughness={0.55} />
      </mesh>
      {/* Ears */}
      <mesh position={[-0.195, 0.898, -0.015]} rotation={[0, 0, -0.15]} castShadow>
        <sphereGeometry args={[0.045, 12, 10]} />
        <meshStandardMaterial color={skin} roughness={0.65} />
      </mesh>
      <mesh position={[0.195, 0.898, -0.015]} rotation={[0, 0, 0.15]} castShadow>
        <sphereGeometry args={[0.045, 12, 10]} />
        <meshStandardMaterial color={skin} roughness={0.65} />
      </mesh>
    </group>
  );
}

function Hair({ style, color }: { style: HairStyle; color: string }) {
  if (style === "bald") return null;

  if (style === "spiky") {
    return (
      <group position={[0, 1.05, 0]}>
        <mesh castShadow>
          <coneGeometry args={[0.19, 0.24, 12]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[-0.12, 0.02, 0]} rotation={[0, 0, -0.3]} castShadow>
          <coneGeometry args={[0.05, 0.14, 8]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0.12, 0.02, 0]} rotation={[0, 0, 0.3]} castShadow>
          <coneGeometry args={[0.05, 0.14, 8]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, 0.12, -0.06]} rotation={[0.5, 0, 0]} castShadow>
          <coneGeometry args={[0.045, 0.12, 8]} />
          {hairMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "long") {
    return (
      <group>
        <mesh position={[0, 1.0, 0]} castShadow>
          <sphereGeometry args={[0.21, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, 0.68, 0.14]} castShadow>
          <boxGeometry args={[0.36, 0.52, 0.09]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, 0.52, 0.12]} castShadow>
          <boxGeometry args={[0.28, 0.22, 0.07]} />
          {hairMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "buzz") {
    return (
      <mesh position={[0, 1.01, 0]} scale={[1, 0.42, 1]} castShadow>
        <sphereGeometry args={[0.2, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {hairMat(color)}
      </mesh>
    );
  }

  if (style === "ponytail") {
    return (
      <group>
        <mesh position={[0, 1.0, 0]} castShadow>
          <sphereGeometry args={[0.2, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, 0.88, 0.22]} rotation={[-0.85, 0, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.26, 6, 10]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, 0.72, 0.28]} castShadow>
          <sphereGeometry args={[0.07, 12, 10]} />
          {hairMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "curly") {
    const curls: [number, number, number][] = [
      [-0.1, 1.05, 0.06],
      [0, 1.1, 0.08],
      [0.1, 1.05, 0.06],
      [-0.14, 1.0, 0.02],
      [0.14, 1.0, 0.02],
      [-0.06, 1.06, 0.06],
      [0.06, 1.06, 0.06],
      [0, 1.12, 0.04]
    ];
    return (
      <group>
        <mesh position={[0, 0.98, 0]} castShadow>
          <sphereGeometry args={[0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {hairMat(color)}
        </mesh>
        {curls.map((p, i) => (
          <mesh key={i} position={p} castShadow>
            <sphereGeometry args={[0.06, 10, 8]} />
            {hairMat(color)}
          </mesh>
        ))}
      </group>
    );
  }

  if (style === "sidePart") {
    return (
      <group>
        <mesh position={[0, 1.02, 0]} rotation={[0, 0, 0.1]} castShadow>
          <sphereGeometry args={[0.2, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[-0.1, 0.98, 0.04]} rotation={[0.15, 0, -0.35]} castShadow>
          <boxGeometry args={[0.14, 0.2, 0.16]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0.06, 1.0, -0.02]} castShadow>
          <boxGeometry args={[0.12, 0.08, 0.14]} />
          {hairMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "braids") {
    return (
      <group>
        <mesh position={[0, 1.0, 0]} castShadow>
          <sphereGeometry args={[0.19, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[-0.11, 0.82, 0.1]} rotation={[0.15, 0, -0.12]} castShadow>
          <capsuleGeometry args={[0.04, 0.34, 5, 8]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0.11, 0.82, 0.1]} rotation={[0.15, 0, 0.12]} castShadow>
          <capsuleGeometry args={[0.04, 0.34, 5, 8]} />
          {hairMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "mohawk") {
    return (
      <group>
        <mesh position={[0, 1.06, 0]} castShadow>
          <boxGeometry args={[0.09, 0.14, 0.22]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, 1.18, 0]} castShadow>
          <boxGeometry args={[0.08, 0.12, 0.2]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, 1.28, -0.02]} castShadow>
          <boxGeometry args={[0.065, 0.1, 0.16]} />
          {hairMat(color)}
        </mesh>
      </group>
    );
  }

  // short (default)
  return (
    <mesh position={[0, 1.02, 0]} castShadow>
      <sphereGeometry args={[0.21, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      {hairMat(color)}
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
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.34, 22]} />
        <meshBasicMaterial color="#000" transparent opacity={0.28} />
      </mesh>

      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.25, 16]} />
        <meshStandardMaterial color={pants} roughness={0.72} />
      </mesh>

      <mesh position={[0, 0.47, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.32, 8, 14]} />
        <meshStandardMaterial color={outfit} roughness={0.58} />
      </mesh>

      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.228, 0.228, 0.05, 18]} />
        <meshStandardMaterial color="#2a2030" roughness={0.88} />
      </mesh>

      <mesh position={[-0.3, 0.5, 0]} rotation={[0, 0, 0.15]} castShadow>
        <capsuleGeometry args={[0.075, 0.26, 6, 10]} />
        <meshStandardMaterial color={outfit} roughness={0.68} />
      </mesh>
      <mesh position={[0.3, 0.5, 0]} rotation={[0, 0, -0.15]} castShadow>
        <capsuleGeometry args={[0.075, 0.26, 6, 10]} />
        <meshStandardMaterial color={outfit} roughness={0.68} />
      </mesh>
      <mesh position={[-0.36, 0.3, 0]} castShadow>
        <sphereGeometry args={[0.075, 14, 12]} />
        <meshStandardMaterial color={skin} roughness={0.68} />
      </mesh>
      <mesh position={[0.36, 0.3, 0]} castShadow>
        <sphereGeometry args={[0.075, 14, 12]} />
        <meshStandardMaterial color={skin} roughness={0.68} />
      </mesh>

      <mesh position={[0, 0.9, 0]} castShadow>
        <sphereGeometry args={[0.2, 28, 22]} />
        <meshStandardMaterial color={skin} roughness={0.58} />
      </mesh>

      <Face skin={skin} />
      <Beard style={appearance.facialHair} color={appearance.beardColor} />
      <Hair style={appearance.hairStyle} color={hair} />

      {showFaceMarker && (
        <mesh position={[0, 0.9, -0.208]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color="#fff6dd" emissive="#ffe8aa" emissiveIntensity={0.22} />
        </mesh>
      )}
    </group>
  );
}
