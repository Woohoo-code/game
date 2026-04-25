import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerAppearance } from "../game/types";
import { CharacterModel } from "./CharacterModel";

/** Self-contained preview canvas showing a turntable hero. */
export function CharacterPreview({ appearance }: { appearance: PlayerAppearance }) {
  return (
    <div className="character-preview">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.52, 2.55], fov: 28 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color attach="background" args={["#182334"]} />
        <fog attach="fog" args={["#182334", 5, 12]} />
        <hemisphereLight args={["#b9ccff", "#2a1d2c", 0.6]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[2.2, 4.2, 2]} intensity={1.15} castShadow />
        <directionalLight position={[-2, 2.2, -1]} intensity={0.38} color="#8aa4c4" />
        <group position={[0, 0.02, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[1.5, 40]} />
            <meshStandardMaterial color="#1b2a3a" roughness={1} />
          </mesh>
          <CharacterModel appearance={appearance} turntable />
        </group>
      </Canvas>
    </div>
  );
}
