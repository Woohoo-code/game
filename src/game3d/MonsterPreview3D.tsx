import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { MonsterBodyShape } from "../game/types";
import { MonsterByShape } from "./MonsterModels";

/** Turntable preview for UGC monster design (shape + color customization). */
export function MonsterPreview3D({
  shape,
  primary,
  accent
}: {
  shape: MonsterBodyShape;
  primary: string;
  accent: string;
}) {
  return (
    <div className="monster-3d monster-3d-preview">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.9, 2.6], fov: 30 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color attach="background" args={["#14202e"]} />
        <fog attach="fog" args={["#14202e", 4, 8]} />
        <hemisphereLight args={["#b9ccff", "#2a1d2c", 0.6]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[2, 3, 2]} intensity={1.2} castShadow />
        <directionalLight position={[-2, 1.5, -1]} intensity={0.25} color="#8aa4c4" />
        <group position={[0, -0.35, 0]}>
          <MonsterByShape shape={shape} primary={primary} accent={accent} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[1.1, 40]} />
            <meshStandardMaterial color="#1b2a3a" roughness={1} />
          </mesh>
        </group>
      </Canvas>
    </div>
  );
}
