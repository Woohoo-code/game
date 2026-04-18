import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { EnemyState, MonsterBodyShape } from "../game/types";

interface ShapeProps {
  /** Primary body color. */
  primary?: string;
  /** Accent / trim / shadow color. */
  accent?: string;
}

/** Slow passive rotation + subtle bob for a "turntable" feel. */
function useIdleTurntable(speed = 0.45) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * speed;
  });
  return group;
}

function Slime({ primary = "#52bcd0", accent = "#0d2b34" }: ShapeProps) {
  const group = useIdleTurntable(0.35);
  const body = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!body.current) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 2.2) * 0.06;
    body.current.scale.set(s, 1 / s, s);
    body.current.position.y = 0.36 + Math.sin(t * 2.2) * 0.04;
  });
  return (
    <group ref={group}>
      <mesh ref={body} position={[0, 0.36, 0]} castShadow>
        <sphereGeometry args={[0.6, 40, 24]} />
        <meshPhysicalMaterial
          color={primary}
          roughness={0.15}
          transmission={0.25}
          thickness={0.6}
          emissive={accent}
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[-0.18, 0.46, 0.52]}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial color="#0f1c2a" />
      </mesh>
      <mesh position={[0.18, 0.46, 0.52]}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial color="#0f1c2a" />
      </mesh>
      <mesh position={[-0.16, 0.48, 0.58]}>
        <sphereGeometry args={[0.022, 10, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.2, 0.48, 0.58]}>
        <sphereGeometry args={[0.022, 10, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0.27, 0.52]} rotation={[Math.PI, 0, 0]}>
        <torusGeometry args={[0.14, 0.028, 12, 24, Math.PI]} />
        <meshStandardMaterial color="#0f1c2a" />
      </mesh>
    </group>
  );
}

function Bat({ primary = "#554a68", accent = "#3f3651" }: ShapeProps) {
  const group = useIdleTurntable(0.35);
  const leftWing = useRef<THREE.Group>(null);
  const rightWing = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const flap = Math.sin(t * 9) * 0.8;
    if (leftWing.current) leftWing.current.rotation.z = 0.2 + flap;
    if (rightWing.current) rightWing.current.rotation.z = -0.2 - flap;
    if (body.current) body.current.position.y = 0.55 + Math.sin(t * 2) * 0.06;
  });
  const wingColor = new THREE.Color(accent).lerp(new THREE.Color(primary), 0.4).getStyle();
  return (
    <group ref={group}>
      <group ref={body} position={[0, 0.55, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.28, 24, 18]} />
          <meshStandardMaterial color={primary} roughness={0.7} />
        </mesh>
        <mesh position={[-0.07, 0.29, 0.16]} rotation={[0, 0, 0.4]}>
          <coneGeometry args={[0.06, 0.16, 10]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <mesh position={[0.07, 0.29, 0.16]} rotation={[0, 0, -0.4]}>
          <coneGeometry args={[0.06, 0.16, 10]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <mesh position={[-0.1, 0.05, 0.26]}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshBasicMaterial color="#fff2b0" />
        </mesh>
        <mesh position={[0.1, 0.05, 0.26]}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshBasicMaterial color="#fff2b0" />
        </mesh>
        <mesh position={[-0.06, -0.16, 0.24]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.025, 0.1, 8]} />
          <meshStandardMaterial color="#f2dede" />
        </mesh>
        <mesh position={[0.06, -0.16, 0.24]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.025, 0.1, 8]} />
          <meshStandardMaterial color="#f2dede" />
        </mesh>
        <group ref={leftWing} position={[-0.22, 0.05, 0]}>
          <mesh position={[-0.36, 0, 0]} castShadow>
            <boxGeometry args={[0.74, 0.5, 0.03]} />
            <meshStandardMaterial color={wingColor} roughness={0.85} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <group ref={rightWing} position={[0.22, 0.05, 0]}>
          <mesh position={[0.36, 0, 0]} castShadow>
            <boxGeometry args={[0.74, 0.5, 0.03]} />
            <meshStandardMaterial color={wingColor} roughness={0.85} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Goblin({ primary = "#6eaa4f", accent = "#4f7a3a" }: ShapeProps) {
  const group = useIdleTurntable(0.35);
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!body.current) return;
    const t = clock.getElapsedTime();
    body.current.rotation.z = Math.sin(t * 2.5) * 0.04;
  });
  return (
    <group ref={group}>
      <group ref={body}>
        <mesh position={[0, 0.38, 0]} castShadow>
          <capsuleGeometry args={[0.22, 0.32, 8, 14]} />
          <meshStandardMaterial color={primary} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.78, 0]} castShadow>
          <sphereGeometry args={[0.23, 24, 18]} />
          <meshStandardMaterial color={primary} roughness={0.8} />
        </mesh>
        <mesh position={[-0.22, 0.82, -0.02]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.07, 0.18, 10]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <mesh position={[0.22, 0.82, -0.02]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.07, 0.18, 10]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <mesh position={[-0.08, 0.8, 0.2]}>
          <sphereGeometry args={[0.035, 12, 10]} />
          <meshStandardMaterial color="#142218" />
        </mesh>
        <mesh position={[0.08, 0.8, 0.2]}>
          <sphereGeometry args={[0.035, 12, 10]} />
          <meshStandardMaterial color="#142218" />
        </mesh>
        <mesh position={[-0.05, 0.66, 0.2]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.025, 0.08, 8]} />
          <meshStandardMaterial color="#efe6c8" />
        </mesh>
        <mesh position={[0.05, 0.66, 0.2]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.025, 0.08, 8]} />
          <meshStandardMaterial color="#efe6c8" />
        </mesh>
        <mesh position={[-0.32, 0.42, 0]} rotation={[0, 0, 0.15]} castShadow>
          <capsuleGeometry args={[0.08, 0.3, 6, 10]} />
          <meshStandardMaterial color={primary} />
        </mesh>
        <mesh position={[0.32, 0.42, 0]} rotation={[0, 0, -0.15]} castShadow>
          <capsuleGeometry args={[0.08, 0.3, 6, 10]} />
          <meshStandardMaterial color={primary} />
        </mesh>
        <mesh position={[-0.1, 0.08, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.18, 6, 10]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <mesh position={[0.1, 0.08, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.18, 6, 10]} />
          <meshStandardMaterial color={accent} />
        </mesh>
        <group position={[0.38, 0.58, 0.06]} rotation={[0, 0, -0.6]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.035, 0.05, 0.38, 10]} />
            <meshStandardMaterial color="#6d4a2a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.22, 0]} castShadow>
            <sphereGeometry args={[0.09, 14, 10]} />
            <meshStandardMaterial color="#5a3a20" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function DireWolf({ primary = "#6a6f76", accent = "#44464a" }: ShapeProps) {
  const group = useIdleTurntable(0.35);
  const tail = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!tail.current) return;
    tail.current.rotation.y = Math.sin(clock.getElapsedTime() * 3) * 0.3;
  });
  return (
    <group ref={group}>
      <mesh position={[0, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.22, 0.45, 6, 12]} />
        <meshStandardMaterial color={primary} roughness={0.85} />
      </mesh>
      <mesh position={[0.38, 0.5, 0]} castShadow>
        <sphereGeometry args={[0.2, 20, 16]} />
        <meshStandardMaterial color={primary} roughness={0.85} />
      </mesh>
      <mesh position={[0.58, 0.44, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <coneGeometry args={[0.11, 0.22, 12]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh position={[0.3, 0.7, 0.1]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.05, 0.14, 8]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh position={[0.3, 0.7, -0.1]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.05, 0.14, 8]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh position={[0.48, 0.54, 0.12]}>
        <sphereGeometry args={[0.03, 10, 8]} />
        <meshBasicMaterial color="#f7c24a" />
      </mesh>
      <mesh position={[0.48, 0.54, -0.12]}>
        <sphereGeometry args={[0.03, 10, 8]} />
        <meshBasicMaterial color="#f7c24a" />
      </mesh>
      {[
        [0.25, 0.13],
        [0.25, -0.13],
        [-0.22, 0.13],
        [-0.22, -0.13]
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.18, z]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.32, 8]} />
          <meshStandardMaterial color={accent} />
        </mesh>
      ))}
      <mesh ref={tail} position={[-0.4, 0.48, 0]} rotation={[0, 0, -0.7]}>
        <cylinderGeometry args={[0.04, 0.08, 0.4, 10]} />
        <meshStandardMaterial color={primary} />
      </mesh>
    </group>
  );
}

function Wraith({ primary = "#3a2a4a", accent = "#b15dff" }: ShapeProps) {
  const group = useIdleTurntable(0.25);
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!body.current) return;
    const t = clock.getElapsedTime();
    body.current.position.y = 0.3 + Math.sin(t * 1.4) * 0.07;
    body.current.rotation.z = Math.sin(t * 1.1) * 0.04;
  });
  return (
    <group ref={group}>
      <group ref={body}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <coneGeometry args={[0.45, 1.0, 18, 1, true]} />
          <meshStandardMaterial
            color={primary}
            roughness={0.7}
            transparent
            opacity={0.88}
            emissive={accent}
            emissiveIntensity={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.28, 20, 14]} />
          <meshStandardMaterial color="#0a0612" emissive="#1a0a22" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[-0.09, 0.62, 0.22]}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshBasicMaterial color={accent} />
        </mesh>
        <mesh position={[0.09, 0.62, 0.22]}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshBasicMaterial color={accent} />
        </mesh>
        <pointLight position={[0, 0.6, 0.35]} color={accent} intensity={0.6} distance={1.5} />
      </group>
    </group>
  );
}

function YoungDrake({ primary = "#a5342a", accent = "#d9a85a" }: ShapeProps) {
  const group = useIdleTurntable(0.35);
  const leftWing = useRef<THREE.Group>(null);
  const rightWing = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const flap = Math.sin(t * 3.5) * 0.4;
    if (leftWing.current) leftWing.current.rotation.z = 0.3 + flap;
    if (rightWing.current) rightWing.current.rotation.z = -0.3 - flap;
  });
  const darker = new THREE.Color(primary).multiplyScalar(0.8).getStyle();
  const wingColor = new THREE.Color(primary).multiplyScalar(0.6).getStyle();
  return (
    <group ref={group}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.24, 0.4, 8, 14]} />
        <meshStandardMaterial color={primary} roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.34, 0.16]}>
        <sphereGeometry args={[0.2, 18, 12]} />
        <meshStandardMaterial color={accent} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.7, 0.18]} rotation={[0.4, 0, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 0.28, 10]} />
        <meshStandardMaterial color={primary} />
      </mesh>
      <mesh position={[0, 0.88, 0.3]} castShadow>
        <sphereGeometry args={[0.17, 20, 14]} />
        <meshStandardMaterial color={primary} />
      </mesh>
      <mesh position={[0, 0.84, 0.46]} castShadow>
        <boxGeometry args={[0.18, 0.1, 0.18]} />
        <meshStandardMaterial color={darker} />
      </mesh>
      <mesh position={[-0.08, 1.02, 0.22]} rotation={[-0.4, 0, -0.1]}>
        <coneGeometry args={[0.04, 0.18, 10]} />
        <meshStandardMaterial color="#1d1a16" />
      </mesh>
      <mesh position={[0.08, 1.02, 0.22]} rotation={[-0.4, 0, 0.1]}>
        <coneGeometry args={[0.04, 0.18, 10]} />
        <meshStandardMaterial color="#1d1a16" />
      </mesh>
      <mesh position={[-0.07, 0.92, 0.42]}>
        <sphereGeometry args={[0.028, 10, 8]} />
        <meshBasicMaterial color="#ffe16a" />
      </mesh>
      <mesh position={[0.07, 0.92, 0.42]}>
        <sphereGeometry args={[0.028, 10, 8]} />
        <meshBasicMaterial color="#ffe16a" />
      </mesh>
      <group ref={leftWing} position={[-0.18, 0.58, -0.05]}>
        <mesh position={[-0.3, 0.08, 0]} rotation={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.56, 0.42, 0.02]} />
          <meshStandardMaterial color={wingColor} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group ref={rightWing} position={[0.18, 0.58, -0.05]}>
        <mesh position={[0.3, 0.08, 0]} rotation={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.56, 0.42, 0.02]} />
          <meshStandardMaterial color={wingColor} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh position={[0, 0.34, -0.35]} rotation={[0.9, 0, 0]}>
        <coneGeometry args={[0.1, 0.4, 12]} />
        <meshStandardMaterial color={primary} />
      </mesh>
      <mesh position={[-0.13, 0.12, 0.05]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.22, 8]} />
        <meshStandardMaterial color={darker} />
      </mesh>
      <mesh position={[0.13, 0.12, 0.05]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.22, 8]} />
        <meshStandardMaterial color={darker} />
      </mesh>
    </group>
  );
}

function Spider({ primary = "#3a2a1e", accent = "#9a2e2a" }: ShapeProps) {
  const group = useIdleTurntable(0.3);
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!body.current) return;
    const t = clock.getElapsedTime();
    body.current.position.y = 0.24 + Math.abs(Math.sin(t * 4)) * 0.04;
  });
  // Eight legs rendered symmetrically
  const legAngles = [-0.9, -0.4, 0.4, 0.9];
  return (
    <group ref={group}>
      <group ref={body}>
        {/* Abdomen (rear sphere) */}
        <mesh position={[-0.22, 0.24, 0]} castShadow>
          <sphereGeometry args={[0.28, 24, 18]} />
          <meshStandardMaterial color={primary} roughness={0.85} />
        </mesh>
        {/* Red stripe on abdomen */}
        <mesh position={[-0.22, 0.36, 0]}>
          <sphereGeometry args={[0.12, 14, 10]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.15} />
        </mesh>
        {/* Cephalothorax (front body) */}
        <mesh position={[0.1, 0.2, 0]} castShadow>
          <sphereGeometry args={[0.2, 20, 14]} />
          <meshStandardMaterial color={primary} roughness={0.85} />
        </mesh>
        {/* Row of eyes */}
        {[-0.06, -0.02, 0.02, 0.06].map((oz, i) => (
          <mesh key={i} position={[0.28, 0.28, oz]}>
            <sphereGeometry args={[0.025, 10, 8]} />
            <meshBasicMaterial color="#ffe16a" />
          </mesh>
        ))}
        {/* Small fangs */}
        <mesh position={[0.3, 0.15, -0.05]} rotation={[Math.PI, 0, 0.3]}>
          <coneGeometry args={[0.02, 0.07, 6]} />
          <meshStandardMaterial color="#f2e9d1" />
        </mesh>
        <mesh position={[0.3, 0.15, 0.05]} rotation={[Math.PI, 0, -0.3]}>
          <coneGeometry args={[0.02, 0.07, 6]} />
          <meshStandardMaterial color="#f2e9d1" />
        </mesh>
        {/* Legs — four on each side */}
        {legAngles.map((ang, i) => (
          <group key={`L${i}`} position={[0.05, 0.22, 0.12]} rotation={[0, ang, 0]}>
            <mesh position={[0.18, -0.02, 0]} rotation={[0, 0, -0.5]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.32, 6]} />
              <meshStandardMaterial color={primary} />
            </mesh>
            <mesh position={[0.3, -0.15, 0]} rotation={[0, 0, -1.2]} castShadow>
              <cylinderGeometry args={[0.018, 0.018, 0.28, 6]} />
              <meshStandardMaterial color={primary} />
            </mesh>
          </group>
        ))}
        {legAngles.map((ang, i) => (
          <group key={`R${i}`} position={[0.05, 0.22, -0.12]} rotation={[0, -ang, 0]}>
            <mesh position={[0.18, -0.02, 0]} rotation={[0, 0, -0.5]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.32, 6]} />
              <meshStandardMaterial color={primary} />
            </mesh>
            <mesh position={[0.3, -0.15, 0]} rotation={[0, 0, -1.2]} castShadow>
              <cylinderGeometry args={[0.018, 0.018, 0.28, 6]} />
              <meshStandardMaterial color={primary} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Scorpion({ primary = "#d6a64c", accent = "#6f3a1a" }: ShapeProps) {
  const group = useIdleTurntable(0.3);
  const tail = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!tail.current) return;
    const t = clock.getElapsedTime();
    tail.current.rotation.x = -0.4 + Math.sin(t * 2.5) * 0.15;
  });
  return (
    <group ref={group}>
      {/* Main abdomen segments */}
      <mesh position={[-0.2, 0.18, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.13, 0.25, 6, 10]} />
        <meshStandardMaterial color={primary} roughness={0.55} metalness={0.2} />
      </mesh>
      {/* Segment ridges */}
      {[-0.05, -0.2, -0.35].map((xz, i) => (
        <mesh key={i} position={[xz, 0.24, 0]}>
          <torusGeometry args={[0.14, 0.02, 8, 14]} />
          <meshStandardMaterial color={accent} />
        </mesh>
      ))}
      {/* Head + claws base */}
      <mesh position={[0.1, 0.18, 0]} castShadow>
        <sphereGeometry args={[0.16, 20, 14]} />
        <meshStandardMaterial color={primary} roughness={0.55} metalness={0.2} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.2, 0.26, 0.06]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>
      <mesh position={[0.2, 0.26, -0.06]}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>
      {/* Pincers — arm + claw tips each side */}
      {[1, -1].map((sign) => (
        <group key={sign} position={[0.28, 0.18, 0.18 * sign]} rotation={[0, 0.4 * sign, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.035, 0.04, 0.22, 8]} />
            <meshStandardMaterial color={primary} />
          </mesh>
          <mesh position={[0, 0.14, 0]} castShadow>
            <boxGeometry args={[0.14, 0.08, 0.1]} />
            <meshStandardMaterial color={accent} roughness={0.5} />
          </mesh>
          <mesh position={[0.08, 0.14, 0.04]} rotation={[0, 0, -0.5]}>
            <coneGeometry args={[0.025, 0.1, 8]} />
            <meshStandardMaterial color="#1a0f06" />
          </mesh>
          <mesh position={[0.08, 0.14, -0.04]} rotation={[0, 0, -0.5]}>
            <coneGeometry args={[0.025, 0.1, 8]} />
            <meshStandardMaterial color="#1a0f06" />
          </mesh>
        </group>
      ))}
      {/* Legs — three per side */}
      {[0.05, -0.1, -0.25].map((ox, idx) =>
        [1, -1].map((sign) => (
          <mesh
            key={`leg-${idx}-${sign}`}
            position={[ox, 0.08, 0.16 * sign]}
            rotation={[0, 0, 0.5 * sign]}
            castShadow
          >
            <cylinderGeometry args={[0.018, 0.02, 0.22, 6]} />
            <meshStandardMaterial color={primary} />
          </mesh>
        ))
      )}
      {/* Curling tail */}
      <group ref={tail} position={[-0.45, 0.22, 0]} rotation={[-0.4, 0, 0]}>
        <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.28, 8]} />
          <meshStandardMaterial color={primary} />
        </mesh>
        <mesh position={[-0.16, 0.18, 0]} rotation={[0, 0, Math.PI / 2 + 0.6]} castShadow>
          <cylinderGeometry args={[0.035, 0.04, 0.22, 8]} />
          <meshStandardMaterial color={primary} />
        </mesh>
        <mesh position={[-0.28, 0.3, 0]} rotation={[0, 0, Math.PI / 2 + 1.2]} castShadow>
          <cylinderGeometry args={[0.028, 0.035, 0.18, 8]} />
          <meshStandardMaterial color={primary} />
        </mesh>
        {/* Stinger */}
        <mesh position={[-0.34, 0.44, 0]} rotation={[0, 0, Math.PI + 0.4]}>
          <coneGeometry args={[0.035, 0.12, 10]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function VoidTitan() {
  const group = useIdleTurntable(0.22);
  const core = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!core.current) return;
    const t = clock.getElapsedTime();
    const p = 0.9 + Math.sin(t * 2.5) * 0.1;
    core.current.scale.set(p, p, p);
    const mat = core.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1.2 + Math.sin(t * 2.5) * 0.6;
  });
  return (
    <group ref={group}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <coneGeometry args={[0.55, 0.9, 20, 1, true]} />
        <meshStandardMaterial color="#1a0d2a" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.35, 8, 14]} />
        <meshStandardMaterial color="#140820" roughness={0.8} />
      </mesh>
      <mesh ref={core} position={[0, 0.78, 0.22]}>
        <sphereGeometry args={[0.14, 20, 16]} />
        <meshStandardMaterial color="#2a0a4a" emissive="#a850ff" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0, 1.22, 0]} castShadow>
        <sphereGeometry args={[0.22, 24, 18]} />
        <meshStandardMaterial color="#0f0720" roughness={0.85} />
      </mesh>
      <mesh position={[-0.08, 1.24, 0.2]}>
        <sphereGeometry args={[0.035, 12, 10]} />
        <meshBasicMaterial color="#d6a8ff" />
      </mesh>
      <mesh position={[0.08, 1.24, 0.2]}>
        <sphereGeometry args={[0.035, 12, 10]} />
        <meshBasicMaterial color="#d6a8ff" />
      </mesh>
      <mesh position={[-0.18, 1.42, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.05, 0.32, 10]} />
        <meshStandardMaterial color="#050208" />
      </mesh>
      <mesh position={[0.18, 1.42, 0]} rotation={[0, 0, 0.3]}>
        <coneGeometry args={[0.05, 0.32, 10]} />
        <meshStandardMaterial color="#050208" />
      </mesh>
      <mesh position={[0, 1.48, 0]}>
        <coneGeometry args={[0.055, 0.4, 10]} />
        <meshStandardMaterial color="#050208" />
      </mesh>
      <mesh position={[-0.35, 0.92, 0]} rotation={[0, 0, -0.5]} castShadow>
        <coneGeometry args={[0.08, 0.3, 10]} />
        <meshStandardMaterial color="#241236" />
      </mesh>
      <mesh position={[0.35, 0.92, 0]} rotation={[0, 0, 0.5]} castShadow>
        <coneGeometry args={[0.08, 0.3, 10]} />
        <meshStandardMaterial color="#241236" />
      </mesh>
      <pointLight position={[0, 0.85, 0.6]} color="#a850ff" intensity={1.1} distance={2.5} />
    </group>
  );
}

/** Render a body shape with optional color overrides; used for both built-in and UGC monsters. */
export function MonsterByShape({ shape, primary, accent }: { shape: MonsterBodyShape; primary?: string; accent?: string }) {
  switch (shape) {
    case "slime":
      return <Slime primary={primary} accent={accent} />;
    case "bat":
      return <Bat primary={primary} accent={accent} />;
    case "goblin":
      return <Goblin primary={primary} accent={accent} />;
    case "wolf":
      return <DireWolf primary={primary} accent={accent} />;
    case "wraith":
      return <Wraith primary={primary} accent={accent} />;
    case "drake":
      return <YoungDrake primary={primary} accent={accent} />;
    case "spider":
      return <Spider primary={primary} accent={accent} />;
    case "scorpion":
      return <Scorpion primary={primary} accent={accent} />;
    default:
      return <Goblin primary={primary} accent={accent} />;
  }
}

const BUILTIN_SHAPE_BY_ID: Record<string, MonsterBodyShape> = {
  slime: "slime",
  bat: "bat",
  goblin: "goblin",
  wolf: "wolf",
  wraith: "wraith",
  drake: "drake"
};

export function MonsterModel({ enemy }: { enemy: EnemyState }) {
  if (enemy.id === "voidTitan") return <VoidTitan />;
  const shape: MonsterBodyShape =
    enemy.bodyShape ?? BUILTIN_SHAPE_BY_ID[enemy.id] ?? "goblin";
  return (
    <MonsterByShape
      shape={shape}
      primary={enemy.customColors?.primary}
      accent={enemy.customColors?.accent}
    />
  );
}
