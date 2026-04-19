import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { isRealmBossEnemyId } from "../game/data";
import { gameStore } from "../game/state";
import type { EnemyState } from "../game/types";
import { MonsterModel } from "./MonsterModels";

/** Duration of the monster-hit recoil animation in seconds. */
const HIT_SHAKE_DURATION = 0.32;

function MonsterHitGroup({ enemy }: { enemy: EnemyState }) {
  const group = useRef<THREE.Group>(null);
  const lastHit = useRef<number>(gameStore.getSnapshot().battle.lastPlayerHitAt ?? 0);
  const animStart = useRef<number>(-10);
  const tmpTime = useRef({ t: 0 });

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const hitAt = gameStore.getSnapshot().battle.lastPlayerHitAt ?? 0;
    if (hitAt > lastHit.current) {
      lastHit.current = hitAt;
      animStart.current = tmpTime.current.t;
    }
    tmpTime.current.t += delta;
    const elapsed = tmpTime.current.t - animStart.current;
    if (elapsed < HIT_SHAKE_DURATION) {
      const progress = elapsed / HIT_SHAKE_DURATION;
      const decay = 1 - progress;
      // Sharp recoil: pushed back + tilted, with a high-frequency jitter on top.
      const shake = Math.sin(progress * 40) * 0.04 * decay;
      g.position.set(shake, 0.02 * decay, -0.12 * decay * decay);
      g.rotation.set(-0.18 * decay * decay, shake * 4, shake * 2);
    } else {
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
    }
  });

  return (
    <group ref={group}>
      <MonsterModel enemy={enemy} />
    </group>
  );
}

export function MonsterPortrait3D({ enemy }: { enemy: EnemyState }) {
  const isBoss = isRealmBossEnemyId(enemy.id);
  return (
    <div className={`monster-3d${isBoss ? " monster-3d-boss" : ""}`}>
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
        <directionalLight
          position={[2, 3, 2]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
        />
        <directionalLight position={[-2, 1.5, -1]} intensity={0.25} color="#8aa4c4" />

        <group position={[0, -0.35, 0]}>
          <MonsterHitGroup enemy={enemy} />
          {/* Soft ground disc that catches shadows */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <circleGeometry args={[1.1, 40]} />
            <meshStandardMaterial color="#1b2a3a" roughness={1} />
          </mesh>
        </group>
      </Canvas>
    </div>
  );
}
