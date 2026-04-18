import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Cloud, Clouds, Sky } from "@react-three/drei";
import * as THREE from "three";
import { inputController, type MoveDirection } from "../game/inputController";
import { useGameStore } from "../game/useGameStore";
import { MAP_H, MAP_W } from "../game/worldMap";
import { Buildings } from "./Buildings";
import { AmbientSparkles, GroundDecorations, TownFencing } from "./Decorations";
import { Player3D } from "./Player3D";
import { Forests, Terrain } from "./Terrain";

const KEY_TO_DIR: Record<string, MoveDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  a: "left",
  A: "left",
  s: "down",
  S: "down",
  d: "right",
  D: "right"
};

export function Overworld3D() {
  const snapshot = useGameStore();
  const worldVersion = snapshot.world.worldVersion;

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      const dir = KEY_TO_DIR[event.key];
      if (!dir) return;
      event.preventDefault();
      inputController.setPressed(dir, true);
    };
    const onUp = (event: KeyboardEvent) => {
      const dir = KEY_TO_DIR[event.key];
      if (!dir) return;
      event.preventDefault();
      inputController.setPressed(dir, false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      inputController.clear();
    };
  }, []);

  return (
    <div className="phaser-mount overworld-3d">
      <Canvas
        key={worldVersion}
        shadows
        dpr={[1, 2]}
        camera={{ position: [MAP_W / 2, 14, MAP_H + 6], fov: 50, near: 0.1, far: 200 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color attach="background" args={["#1b2330"]} />
        <fog attach="fog" args={["#2a3648", 32, 72]} />

        <Sky
          distance={450000}
          sunPosition={[60, 20, 40]}
          inclination={0.48}
          azimuth={0.25}
          rayleigh={0.9}
          turbidity={7}
          mieCoefficient={0.003}
          mieDirectionalG={0.85}
        />

        <Clouds material={THREE.MeshBasicMaterial}>
          <Cloud
            seed={worldVersion}
            segments={18}
            bounds={[18, 2, 18]}
            volume={8}
            color="#f4f6fb"
            position={[MAP_W / 2, 22, MAP_H / 2]}
            fade={50}
            opacity={0.65}
          />
          <Cloud
            seed={worldVersion + 7}
            segments={14}
            bounds={[12, 2, 12]}
            volume={5}
            color="#e6ecf4"
            position={[MAP_W / 3, 18, MAP_H / 4]}
            opacity={0.45}
          />
        </Clouds>

        <hemisphereLight args={["#cde3f2", "#2b2a36", 0.55]} />
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[MAP_W * 0.75, 38, MAP_H * 0.3]}
          intensity={1.15}
          color="#fff2dc"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={90}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
          shadow-bias={-0.0008}
        />
        {/* Warm rim light from the opposite side */}
        <directionalLight
          position={[-10, 18, -10]}
          intensity={0.35}
          color="#6c80a0"
        />

        <Terrain />
        <Forests />
        <GroundDecorations />
        <TownFencing />
        <AmbientSparkles />
        <Buildings />
        <Player3D />
      </Canvas>
    </div>
  );
}
