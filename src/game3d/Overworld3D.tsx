import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { inputController, type MoveDirection } from "../game/inputController";
import { MAP_H, MAP_W } from "../game/worldMap";
import { Buildings } from "./Buildings";
import { Player3D } from "./Player3D";
import { Terrain } from "./Terrain";

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
        shadows
        dpr={[1, 2]}
        camera={{ position: [MAP_W / 2, 14, MAP_H + 6], fov: 50, near: 0.1, far: 200 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color attach="background" args={["#1b2330"]} />
        <fog attach="fog" args={["#1b2330", 28, 60]} />
        <hemisphereLight args={["#d8e3f2", "#1b2430", 0.45]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[25, 35, 15]}
          intensity={1.05}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={80}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <Terrain />
        <Buildings />
        <Player3D />
      </Canvas>
    </div>
  );
}
