import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Cloud, Clouds, Sky, Stars } from "@react-three/drei";
import * as THREE from "three";
import { inputController, type MoveDirection } from "../game/inputController";
import { gameStore } from "../game/state";
import { useGameStore } from "../game/useGameStore";
import { MAP_H, MAP_W } from "../game/worldMap";
import { WORLD_CLOCK_TICK_FRACTION, nightVisualBlend, sunHeight01 } from "../game/worldClock";
import { Buildings } from "./Buildings";
import { CrownkeepCastleWalls3D, CrownkeepSouthGate3D } from "./CastleWalls3D";
import { AmbientSparkles, GroundDecorations, TownFencing } from "./Decorations";
import { Dungeon3D } from "./Dungeon3D";
import { Pet3D } from "./Pet3D";
import { Player3D } from "./Player3D";
import { DungeonTorches } from "./DungeonTorches";
import { ResourceNodes3D } from "./ResourceNodes3D";
import { RoamingMonsters3D } from "./RoamingMonsters3D";
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

function keyboardTargetIsTyping(event: KeyboardEvent): boolean {
  const el = event.target;
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("input, textarea, select"));
}

/** Remount when the realm/world mesh changes so GL readiness resets per overworld. */
export function Overworld3D() {
  const worldVersion = useGameStore().world.worldVersion;
  return <Overworld3DScene key={worldVersion} />;
}

function Overworld3DScene() {
  const snapshot = useGameStore();
  const worldVersion = snapshot.world.worldVersion;
  const [glReady, setGlReady] = useState(false);
  const worldTimeRaw = snapshot.world.worldTime ?? 0;
  const worldTime = Number.isFinite(worldTimeRaw) ? worldTimeRaw : 0;

  const view = useMemo(() => {
    const span = Math.hypot(MAP_W, MAP_H);
    const extent = Math.max(MAP_W, MAP_H);
    const cloudHalf = Math.min(120, Math.max(22, extent * 0.22));
    return {
      camFar: Math.min(14_000, Math.max(400, span * 3.4)),
      fogNear: Math.min(120, Math.max(24, span * 0.06)),
      fogFar: Math.min(1400, Math.max(160, span * 1.25)),
      shadowCamFar: Math.min(700, Math.max(120, span * 1.1)),
      shadowHalf: Math.max(48, extent * 0.52),
      cloudBounds: [cloudHalf, 2, cloudHalf] as [number, number, number]
    };
  }, [worldVersion]);

  const nb = useMemo(() => nightVisualBlend(worldTime), [worldTime]);
  const sunH = useMemo(() => sunHeight01(worldTime), [worldTime]);

  const sunPosition = useMemo(
    () => new THREE.Vector3(55 + sunH * 35, 18 + sunH * 52, 38 - sunH * 18),
    [sunH]
  );

  const bgHex = useMemo(() => {
    const a = new THREE.Color("#1b2330");
    const b = new THREE.Color("#05070c");
    return "#" + a.lerp(b, nb).getHexString();
  }, [nb]);

  const fogHex = useMemo(() => {
    const a = new THREE.Color("#2a3648");
    const b = new THREE.Color("#0d121c");
    return "#" + a.lerp(b, nb).getHexString();
  }, [nb]);

  const fogNearEff = THREE.MathUtils.lerp(view.fogNear, view.fogNear * 0.82, nb);
  const fogFarEff = THREE.MathUtils.lerp(view.fogFar, view.fogFar * 0.88, nb);
  const hemiIntensity = THREE.MathUtils.lerp(0.55, 0.2, nb);
  const ambIntensity = THREE.MathUtils.lerp(0.25, 0.07, nb);
  const sunIntensity = THREE.MathUtils.lerp(1.15, 0.22, nb);
  const sunColor = useMemo(() => {
    const a = new THREE.Color("#fff2dc");
    const b = new THREE.Color("#8fb0e8");
    return "#" + a.lerp(b, nb).getHexString();
  }, [nb]);
  const rimIntensity = THREE.MathUtils.lerp(0.35, 0.14, nb);
  const moonIntensity = Math.min(0.58, nb * 1.25);
  const cloudOpacityA = THREE.MathUtils.lerp(0.65, 0.22, nb);
  const cloudOpacityB = THREE.MathUtils.lerp(0.45, 0.12, nb);

  useEffect(() => {
    const id = window.setInterval(() => {
      gameStore.tickWorldClock(WORLD_CLOCK_TICK_FRACTION);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (keyboardTargetIsTyping(event)) return;
      // Ctrl/⌘/Alt combos (e.g. Ctrl+S save, Ctrl+R refresh) must NOT trigger WASD movement.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const dir = KEY_TO_DIR[event.key];
      if (!dir) return;
      event.preventDefault();
      inputController.setPressed(dir, true);
    };
    const onUp = (event: KeyboardEvent) => {
      if (keyboardTargetIsTyping(event)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
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

  const sunTilt = 0.48 - nb * 0.36;

  return (
    <div className="phaser-mount overworld-3d">
      {!glReady && (
        <div className="overworld-load-splash" aria-busy="true" aria-label="Loading world">
          <p className="overworld-load-splash-text">Loading…</p>
        </div>
      )}
      {/* Parent `key={worldVersion}` remounts this subtree whenever the realm changes — only one overworld GL context at a time. */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [MAP_W / 2, 14, MAP_H + 6], fov: 50, near: 0.1, far: view.camFar }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setGlReady(true));
          });
        }}
      >
        <color attach="background" args={[snapshot.world.inDungeon ? "#060406" : bgHex]} />
        <fog attach="fog" args={snapshot.world.inDungeon ? ["#07040a", 8, 28] : [fogHex, fogNearEff, fogFarEff]} />

        {!snapshot.world.inDungeon && (
          <>
            <Sky
              distance={450000}
              sunPosition={sunPosition}
              inclination={sunTilt}
              azimuth={0.25 + nb * 0.12}
              rayleigh={0.9 - nb * 0.54}
              turbidity={7 + nb * 16}
              mieCoefficient={0.003 + nb * 0.022}
              mieDirectionalG={0.85 - nb * 0.22}
            />
            {nb > 0.32 && (
              <Stars
                radius={140}
                depth={52}
                count={1600}
                factor={3.2}
                saturation={0}
                fade
                speed={0.85}
              />
            )}
            <Clouds material={THREE.MeshBasicMaterial}>
              <Cloud
                seed={worldVersion}
                segments={18}
                bounds={view.cloudBounds}
                volume={8}
                color="#f4f6fb"
                position={[MAP_W / 2, 22, MAP_H / 2]}
                fade={Math.min(120, 36 + view.cloudBounds[0])}
                opacity={cloudOpacityA}
              />
              <Cloud
                seed={worldVersion + 7}
                segments={14}
                bounds={[view.cloudBounds[0] * 0.65, 2, view.cloudBounds[2] * 0.65]}
                volume={5}
                color="#e6ecf4"
                position={[MAP_W / 3, 18, MAP_H / 4]}
                opacity={cloudOpacityB}
              />
            </Clouds>
          </>
        )}

        <hemisphereLight args={["#cde3f2", "#2b2a36", snapshot.world.inDungeon ? 0 : hemiIntensity]} />
        <ambientLight intensity={snapshot.world.inDungeon ? 0 : ambIntensity} />
        <directionalLight
          position={[MAP_W * 0.75, 38, MAP_H * 0.3]}
          intensity={snapshot.world.inDungeon ? 0 : sunIntensity}
          color={sunColor}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={view.shadowCamFar}
          shadow-camera-left={-view.shadowHalf}
          shadow-camera-right={view.shadowHalf}
          shadow-camera-top={view.shadowHalf}
          shadow-camera-bottom={-view.shadowHalf}
          shadow-bias={-0.0008}
        />
        <directionalLight position={[-10, 18, -10]} intensity={rimIntensity} color="#6c80a0" />
        <pointLight
          position={[MAP_W * 0.45, 28, MAP_H * 0.55]}
          intensity={moonIntensity}
          distance={Math.max(90, Math.max(MAP_W, MAP_H) * 1.2)}
          color="#b8d4ff"
        />

        {snapshot.world.inDungeon ? (
          <Dungeon3D />
        ) : (
          <>
            <Terrain />
            <Forests />
            <DungeonTorches />
            <GroundDecorations />
            <TownFencing />
            <CrownkeepCastleWalls3D />
            <CrownkeepSouthGate3D />
            <AmbientSparkles />
            <Buildings />
            <ResourceNodes3D />
            <RoamingMonsters3D />
          </>
        )}
        <Player3D appearance={snapshot.player.appearance} />
        {!snapshot.world.inDungeon && <Pet3D />}
      </Canvas>
    </div>
  );
}
