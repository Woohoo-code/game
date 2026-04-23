import { useRef, type MutableRefObject, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useFBX, useGLTF, useAnimations } from "@react-three/drei";
import type {
  FacialHairStyle,
  HairStyle,
  PlayerAppearance,
} from "../game/types";

interface CharacterModelProps {
  appearance: PlayerAppearance;
  /** When true, the model auto-rotates (preview). */
  turntable?: boolean;
  /** When true, adds a soft forward marker so facing reads clearly in gameplay. */
  showFaceMarker?: boolean;
  /**
   * Optional per-frame flag for "the character is walking". When present the
   * arms and legs pivot at the shoulders / hips to produce an alternating
   * walk cycle; when absent (or `.current === false`) the limbs rest. Passed
   * through from {@link Player3D}, whose movement input already drives a
   * ref of this exact shape.
   */
  movingRef?: MutableRefObject<boolean>;
  /**
   * Optional per-frame flag for "the character is dead".
   */
  deadRef?: MutableRefObject<boolean>;
  /**
   * When true the character adopts a seated riding pose: legs splay outward
   * at the hips to straddle the mount, arms tilt forward as if holding reins,
   * and the walking swing cycle is suppressed. Player3D toggles this based
   * on horse ownership.
   */
  riding?: boolean;
}

/** Peak swing angle at each shoulder / hip (radians). ~17° reads as a brisk walk without looking cartoony. */
const LIMB_SWING_AMP = 0.3;
/** Swing frequency (rad/s). 2π·1.4 ≈ 8.8 gives ~1.4 full cycles/sec — natural human cadence. */
const LIMB_SWING_FREQ = 8.8;
/** How fast the swing amplitude ramps up when starting/stopping (1/s — `damp` rate). */
const LIMB_SWING_ATTACK = 10;
/** Legs splay outward (rad, Z-axis) when riding so boots clear the horse's body. */
const RIDING_LEG_SPREAD = 0.7;
/** Arms tilt forward (rad, X-axis) when riding to mimic holding reins. */
const RIDING_ARM_FORWARD = -0.3;

/**
 * Central anatomy constants. Tweak these and the whole body scales together;
 * feature positions below are all anchored to HEAD_Y / HEAD_R.
 */
const HEAD_Y = 0.9;
const HEAD_R = 0.185;
/** Base shoulder ring Y — arm upper joint hangs from here. */
const SHOULDER_Y = 0.68;
/** Waist / belt line Y — chest tapers down to this. */
const WAIST_Y = 0.42;
/** Pelvis top — thighs start here. */
const HIP_Y = 0.4;

/* ── Materials ──────────────────────────────────────────────────────────── */

/** Skin: physical material with subtle clearcoat + sheen for soft highlights. */
const SkinMat = ({ color }: { color: string }) => (
  <meshPhysicalMaterial
    color={color}
    roughness={0.52}
    clearcoat={0.14}
    clearcoatRoughness={0.45}
    sheen={0.12}
    sheenColor="#ffd6c2"
    sheenRoughness={0.9}
  />
);

/** Cloth tunic / coat — matte with a faint sheen so folds don't read plastic. */
const ClothMat = ({
  color,
  roughness = 0.78,
}: {
  color: string;
  roughness?: number;
}) => (
  <meshPhysicalMaterial
    color={color}
    roughness={roughness}
    sheen={0.25}
    sheenRoughness={0.85}
    sheenColor="#1a1a1a"
  />
);

/** Pants / leather — slightly waxier than tunic. */
const LeatherMat = ({ color }: { color: string }) => (
  <meshPhysicalMaterial
    color={color}
    roughness={0.6}
    clearcoat={0.25}
    clearcoatRoughness={0.55}
  />
);

const hairMat = (color: string) => (
  <meshPhysicalMaterial
    color={color}
    roughness={0.62}
    sheen={0.4}
    sheenRoughness={0.5}
    sheenColor={color}
    clearcoat={0.08}
  />
);

const beardMat = (color: string) => (
  <meshStandardMaterial color={color} roughness={0.9} metalness={0.02} />
);

/* ── Facial hair ────────────────────────────────────────────────────────── */

function Beard({ style, color }: { style: FacialHairStyle; color: string }) {
  if (style === "none") return null;

  const chinY = HEAD_Y - 0.1; // was 0.8
  const jawZ = -0.158; // pulled in slightly to sit on the smaller head surface

  if (style === "stubble") {
    const dots: [number, number, number][] = [
      [-0.09, chinY + 0.04, jawZ],
      [-0.045, chinY + 0.025, jawZ - 0.006],
      [0, chinY + 0.01, jawZ - 0.01],
      [0.045, chinY + 0.025, jawZ - 0.006],
      [0.09, chinY + 0.04, jawZ],
      [-0.07, chinY - 0.02, jawZ + 0.003],
      [0.07, chinY - 0.02, jawZ + 0.003],
      [0, chinY - 0.03, jawZ - 0.008],
      [-0.035, chinY, jawZ - 0.005],
      [0.035, chinY, jawZ - 0.005],
    ];
    return (
      <group>
        {dots.map((p, i) => (
          <mesh key={i} position={p} castShadow>
            <sphereGeometry args={[0.014, 6, 6]} />
            {beardMat(color)}
          </mesh>
        ))}
      </group>
    );
  }

  if (style === "goatee") {
    return (
      <group>
        <mesh
          position={[0, chinY - 0.01, jawZ - 0.014]}
          rotation={[0.25, 0, 0]}
          castShadow
        >
          <capsuleGeometry args={[0.032, 0.09, 5, 8]} />
          {beardMat(color)}
        </mesh>
        <mesh position={[0, chinY - 0.05, jawZ - 0.002]} castShadow>
          <sphereGeometry args={[0.038, 10, 8]} />
          {beardMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "shortBeard") {
    return (
      <group>
        <mesh
          position={[0, chinY + 0.005, jawZ + 0.002]}
          rotation={[0.12, 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.2, 0.09, 0.09]} />
          {beardMat(color)}
        </mesh>
        <mesh
          position={[-0.09, chinY + 0.03, jawZ + 0.014]}
          rotation={[0.08, 0, 0.12]}
          castShadow
        >
          <boxGeometry args={[0.07, 0.08, 0.075]} />
          {beardMat(color)}
        </mesh>
        <mesh
          position={[0.09, chinY + 0.03, jawZ + 0.014]}
          rotation={[0.08, 0, -0.12]}
          castShadow
        >
          <boxGeometry args={[0.07, 0.08, 0.075]} />
          {beardMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "fullBeard") {
    return (
      <group>
        <mesh
          position={[0, chinY + 0.002, jawZ + 0.008]}
          rotation={[0.1, 0, 0]}
          castShadow
        >
          <boxGeometry args={[0.235, 0.13, 0.11]} />
          {beardMat(color)}
        </mesh>
        <mesh
          position={[-0.11, chinY + 0.03, jawZ + 0.028]}
          rotation={[0.05, 0, 0.18]}
          castShadow
        >
          <boxGeometry args={[0.09, 0.13, 0.09]} />
          {beardMat(color)}
        </mesh>
        <mesh
          position={[0.11, chinY + 0.03, jawZ + 0.028]}
          rotation={[0.05, 0, -0.18]}
          castShadow
        >
          <boxGeometry args={[0.09, 0.13, 0.09]} />
          {beardMat(color)}
        </mesh>
        <mesh position={[0, chinY - 0.04, jawZ - 0.002]} castShadow>
          <sphereGeometry args={[0.05, 12, 10]} />
          {beardMat(color)}
        </mesh>
      </group>
    );
  }

  return null;
}

/* ── Face ──────────────────────────────────────────────────────────────── */

function Face({ skin }: { skin: string }) {
  const sclera = "#ededf2";
  const iris = "#3a4a6a";
  const pupil = "#0a0c10";
  const browCol = "#2c2018";
  const lipCol = "#9b5050";

  // Head surface pulled-in radius — features sit just under the sphere skin.
  const eyeY = HEAD_Y + 0.012;
  const eyeZ = -HEAD_R + 0.042; // inset so eyeballs don't bulge
  const eyeX = 0.063;

  return (
    <group>
      {/* Eye sockets — very slight dark tint so the eyes read as inset even without shadows. */}
      <mesh position={[-eyeX, eyeY, eyeZ + 0.004]}>
        <sphereGeometry args={[0.032, 16, 12]} />
        <meshStandardMaterial color="#1a1412" roughness={1} />
      </mesh>
      <mesh position={[eyeX, eyeY, eyeZ + 0.004]}>
        <sphereGeometry args={[0.032, 16, 12]} />
        <meshStandardMaterial color="#1a1412" roughness={1} />
      </mesh>

      {/* Sclera (whites) — smaller than before for a more human read. */}
      <mesh position={[-eyeX, eyeY, eyeZ]}>
        <sphereGeometry args={[0.022, 18, 14]} />
        <meshPhysicalMaterial
          color={sclera}
          roughness={0.22}
          clearcoat={0.6}
          clearcoatRoughness={0.1}
        />
      </mesh>
      <mesh position={[eyeX, eyeY, eyeZ]}>
        <sphereGeometry args={[0.022, 18, 14]} />
        <meshPhysicalMaterial
          color={sclera}
          roughness={0.22}
          clearcoat={0.6}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* Irises */}
      <mesh position={[-eyeX, eyeY - 0.001, eyeZ - 0.009]}>
        <sphereGeometry args={[0.011, 14, 12]} />
        <meshPhysicalMaterial
          color={iris}
          roughness={0.35}
          clearcoat={0.7}
          clearcoatRoughness={0.2}
        />
      </mesh>
      <mesh position={[eyeX, eyeY - 0.001, eyeZ - 0.009]}>
        <sphereGeometry args={[0.011, 14, 12]} />
        <meshPhysicalMaterial
          color={iris}
          roughness={0.35}
          clearcoat={0.7}
          clearcoatRoughness={0.2}
        />
      </mesh>

      {/* Pupils */}
      <mesh position={[-eyeX, eyeY - 0.001, eyeZ - 0.013]}>
        <sphereGeometry args={[0.006, 10, 8]} />
        <meshStandardMaterial color={pupil} roughness={0.2} />
      </mesh>
      <mesh position={[eyeX, eyeY - 0.001, eyeZ - 0.013]}>
        <sphereGeometry args={[0.006, 10, 8]} />
        <meshStandardMaterial color={pupil} roughness={0.2} />
      </mesh>

      {/* Catchlights — offset to sell the eye curvature. */}
      <mesh position={[-eyeX - 0.006, eyeY + 0.006, eyeZ - 0.015]}>
        <sphereGeometry args={[0.003, 6, 6]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.55}
        />
      </mesh>
      <mesh position={[eyeX - 0.006, eyeY + 0.006, eyeZ - 0.015]}>
        <sphereGeometry args={[0.003, 6, 6]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.55}
        />
      </mesh>

      {/* Upper eyelids — thin curved caps that drop the cartoon-eye vibe. */}
      <mesh
        position={[-eyeX, eyeY + 0.014, eyeZ + 0.002]}
        rotation={[0.35, 0, -0.08]}
      >
        <sphereGeometry
          args={[0.028, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <SkinMat color={skin} />
      </mesh>
      <mesh
        position={[eyeX, eyeY + 0.014, eyeZ + 0.002]}
        rotation={[0.35, 0, 0.08]}
      >
        <sphereGeometry
          args={[0.028, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        <SkinMat color={skin} />
      </mesh>

      {/* Eyebrows — softer, lower-profile strokes. */}
      <mesh
        position={[-0.068, HEAD_Y + 0.048, -HEAD_R + 0.05]}
        rotation={[0.18, 0, -0.14]}
      >
        <boxGeometry args={[0.082, 0.012, 0.01]} />
        <meshStandardMaterial color={browCol} roughness={0.95} />
      </mesh>
      <mesh
        position={[0.068, HEAD_Y + 0.048, -HEAD_R + 0.05]}
        rotation={[0.18, 0, 0.14]}
      >
        <boxGeometry args={[0.082, 0.012, 0.01]} />
        <meshStandardMaterial color={browCol} roughness={0.95} />
      </mesh>

      {/* Cheek / jaw shading — extra skin lobes that thicken the lower face
          so the head isn't a perfect sphere. */}
      <mesh position={[-0.1, HEAD_Y - 0.05, -HEAD_R + 0.08]} castShadow>
        <sphereGeometry args={[0.068, 14, 12]} />
        <SkinMat color={skin} />
      </mesh>
      <mesh position={[0.1, HEAD_Y - 0.05, -HEAD_R + 0.08]} castShadow>
        <sphereGeometry args={[0.068, 14, 12]} />
        <SkinMat color={skin} />
      </mesh>

      {/* Nose — bridge + subtle tip + nostril shadow */}
      <mesh
        position={[0, HEAD_Y - 0.015, -HEAD_R + 0.008]}
        rotation={[0.3, 0, 0]}
      >
        <capsuleGeometry args={[0.026, 0.058, 6, 10]} />
        <SkinMat color={skin} />
      </mesh>
      <mesh position={[0, HEAD_Y - 0.05, -HEAD_R - 0.002]}>
        <sphereGeometry args={[0.024, 12, 10]} />
        <SkinMat color={skin} />
      </mesh>
      <mesh position={[-0.011, HEAD_Y - 0.058, -HEAD_R - 0.004]}>
        <sphereGeometry args={[0.006, 6, 6]} />
        <meshStandardMaterial color="#1a1210" roughness={1} />
      </mesh>
      <mesh position={[0.011, HEAD_Y - 0.058, -HEAD_R - 0.004]}>
        <sphereGeometry args={[0.006, 6, 6]} />
        <meshStandardMaterial color="#1a1210" roughness={1} />
      </mesh>

      {/* Upper + lower lip — thin boxes with subtle offset for a shaped mouth */}
      <mesh
        position={[0, HEAD_Y - 0.085, -HEAD_R + 0.012]}
        rotation={[0.12, 0, 0]}
      >
        <boxGeometry args={[0.058, 0.009, 0.012]} />
        <meshStandardMaterial color={lipCol} roughness={0.4} />
      </mesh>
      <mesh
        position={[0, HEAD_Y - 0.098, -HEAD_R + 0.01]}
        rotation={[0.08, 0, 0]}
      >
        <boxGeometry args={[0.05, 0.013, 0.013]} />
        <meshStandardMaterial color={lipCol} roughness={0.5} />
      </mesh>

      {/* Chin bump */}
      <mesh position={[0, HEAD_Y - 0.13, -HEAD_R + 0.04]} castShadow>
        <sphereGeometry args={[0.048, 14, 12]} />
        <SkinMat color={skin} />
      </mesh>

      {/* Ears — tucked tighter to the head with a flat, oval outline */}
      <mesh
        position={[-HEAD_R - 0.008, HEAD_Y - 0.01, 0.004]}
        rotation={[0, 0, -0.12]}
        scale={[0.7, 1, 0.55]}
        castShadow
      >
        <sphereGeometry args={[0.04, 14, 12]} />
        <SkinMat color={skin} />
      </mesh>
      <mesh
        position={[HEAD_R + 0.008, HEAD_Y - 0.01, 0.004]}
        rotation={[0, 0, 0.12]}
        scale={[0.7, 1, 0.55]}
        castShadow
      >
        <sphereGeometry args={[0.04, 14, 12]} />
        <SkinMat color={skin} />
      </mesh>
    </group>
  );
}

/* ── Hair ──────────────────────────────────────────────────────────────── */

function Hair({ style, color }: { style: HairStyle; color: string }) {
  if (style === "bald") return null;
  const crownY = HEAD_Y + 0.12;

  if (style === "spiky") {
    return (
      <group position={[0, crownY, 0]}>
        <mesh castShadow>
          <sphereGeometry
            args={[0.175, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          {hairMat(color)}
        </mesh>
        <mesh
          position={[-0.09, 0.06, -0.02]}
          rotation={[0.2, 0, -0.35]}
          castShadow
        >
          <coneGeometry args={[0.04, 0.16, 10]} />
          {hairMat(color)}
        </mesh>
        <mesh
          position={[0.09, 0.06, -0.02]}
          rotation={[0.2, 0, 0.35]}
          castShadow
        >
          <coneGeometry args={[0.04, 0.16, 10]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, 0.08, -0.06]} rotation={[0.5, 0, 0]} castShadow>
          <coneGeometry args={[0.038, 0.14, 10]} />
          {hairMat(color)}
        </mesh>
        <mesh
          position={[-0.04, 0.09, 0.03]}
          rotation={[-0.3, 0, -0.1]}
          castShadow
        >
          <coneGeometry args={[0.033, 0.12, 8]} />
          {hairMat(color)}
        </mesh>
        <mesh
          position={[0.04, 0.09, 0.03]}
          rotation={[-0.3, 0, 0.1]}
          castShadow
        >
          <coneGeometry args={[0.033, 0.12, 8]} />
          {hairMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "long") {
    return (
      <group>
        <mesh position={[0, crownY - 0.02, 0]} castShadow>
          <sphereGeometry
            args={[0.198, 26, 18, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, 0.6, 0.12]} castShadow>
          <boxGeometry args={[0.34, 0.5, 0.08]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, 0.48, 0.11]} castShadow>
          <boxGeometry args={[0.26, 0.2, 0.065]} />
          {hairMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "buzz") {
    return (
      <mesh position={[0, crownY - 0.02, 0]} scale={[1, 0.38, 1]} castShadow>
        <sphereGeometry
          args={[0.192, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2]}
        />
        {hairMat(color)}
      </mesh>
    );
  }

  if (style === "ponytail") {
    return (
      <group>
        <mesh position={[0, crownY - 0.02, 0]} castShadow>
          <sphereGeometry
            args={[0.192, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, 0.82, 0.2]} rotation={[-0.75, 0, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.24, 6, 12]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, 0.66, 0.26]} castShadow>
          <sphereGeometry args={[0.065, 14, 12]} />
          {hairMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "curly") {
    const curls: [number, number, number][] = [
      [-0.09, crownY, 0.04],
      [0, crownY + 0.04, 0.06],
      [0.09, crownY, 0.04],
      [-0.13, crownY - 0.04, 0],
      [0.13, crownY - 0.04, 0],
      [-0.055, crownY + 0.01, 0.04],
      [0.055, crownY + 0.01, 0.04],
      [0, crownY + 0.06, 0.02],
      [-0.11, crownY + 0.02, -0.04],
      [0.11, crownY + 0.02, -0.04],
    ];
    return (
      <group>
        <mesh position={[0, crownY - 0.04, 0]} castShadow>
          <sphereGeometry
            args={[0.17, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          {hairMat(color)}
        </mesh>
        {curls.map((p, i) => (
          <mesh key={i} position={p} castShadow>
            <sphereGeometry args={[0.054, 12, 10]} />
            {hairMat(color)}
          </mesh>
        ))}
      </group>
    );
  }

  if (style === "sidePart") {
    return (
      <group>
        <mesh
          position={[0, crownY - 0.02, 0]}
          rotation={[0, 0, 0.08]}
          castShadow
        >
          <sphereGeometry
            args={[0.192, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          {hairMat(color)}
        </mesh>
        <mesh
          position={[-0.095, crownY - 0.05, 0.02]}
          rotation={[0.2, 0, -0.4]}
          castShadow
        >
          <boxGeometry args={[0.12, 0.18, 0.14]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0.05, crownY - 0.01, -0.02]} castShadow>
          <boxGeometry args={[0.1, 0.07, 0.12]} />
          {hairMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "braids") {
    return (
      <group>
        <mesh position={[0, crownY - 0.02, 0]} castShadow>
          <sphereGeometry
            args={[0.185, 22, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          {hairMat(color)}
        </mesh>
        <mesh
          position={[-0.105, 0.76, 0.08]}
          rotation={[0.15, 0, -0.12]}
          castShadow
        >
          <capsuleGeometry args={[0.035, 0.32, 6, 10]} />
          {hairMat(color)}
        </mesh>
        <mesh
          position={[0.105, 0.76, 0.08]}
          rotation={[0.15, 0, 0.12]}
          castShadow
        >
          <capsuleGeometry args={[0.035, 0.32, 6, 10]} />
          {hairMat(color)}
        </mesh>
      </group>
    );
  }

  if (style === "mohawk") {
    return (
      <group>
        <mesh position={[0, crownY, 0]} castShadow>
          <boxGeometry args={[0.082, 0.13, 0.2]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, crownY + 0.1, 0]} castShadow>
          <boxGeometry args={[0.072, 0.11, 0.18]} />
          {hairMat(color)}
        </mesh>
        <mesh position={[0, crownY + 0.19, -0.02]} castShadow>
          <boxGeometry args={[0.058, 0.09, 0.14]} />
          {hairMat(color)}
        </mesh>
      </group>
    );
  }

  // short (default)
  return (
    <mesh position={[0, crownY - 0.02, 0]} castShadow>
      <sphereGeometry args={[0.192, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
      {hairMat(color)}
    </mesh>
  );
}

/* ── Limb helpers — articulated upper / lower segments with a visible joint. */

function Arm({
  side,
  outfit,
  skin,
  movingRef,
  riding,
}: {
  /** −1 = left, +1 = right */
  side: -1 | 1;
  outfit: string;
  skin: string;
  movingRef?: MutableRefObject<boolean>;
  riding?: boolean;
}) {
  const sx = 0.255 * side;
  // Pivot group sits AT the shoulder; inner group cancels the translation so
  // the original child positions (written in body-local space) still land in
  // the right place at rotation = 0. Rotating the pivot swings the whole
  // articulated chain around the shoulder joint.
  const pivotRef = useRef<THREE.Group>(null);
  const amp = useRef(0);
  useFrame((state, dt) => {
    const pivot = pivotRef.current;
    if (!pivot) return;
    if (riding) {
      // Eased toward a static reins-holding pose rather than snapping, so the
      // transition between walking and mounting doesn't pop.
      pivot.rotation.x = THREE.MathUtils.damp(
        pivot.rotation.x,
        RIDING_ARM_FORWARD,
        10,
        dt,
      );
      pivot.rotation.z = THREE.MathUtils.damp(pivot.rotation.z, 0, 10, dt);
      amp.current = 0;
      return;
    }
    const moving = movingRef?.current ?? false;
    amp.current = THREE.MathUtils.damp(
      amp.current,
      moving ? 1 : 0,
      LIMB_SWING_ATTACK,
      dt,
    );
    // Arms swing opposite to the same-side leg: left arm forward when left leg
    // back, etc. `side` flips phase between left/right; the leading minus
    // inverts relative to Leg's swing so arm and leg on the same side oppose.
    const swing =
      -Math.sin(state.clock.elapsedTime * LIMB_SWING_FREQ) *
      side *
      LIMB_SWING_AMP *
      amp.current;
    pivot.rotation.x = THREE.MathUtils.damp(pivot.rotation.x, swing, 20, dt);
    pivot.rotation.z = THREE.MathUtils.damp(pivot.rotation.z, 0, 10, dt);
  });
  return (
    <group position={[sx, SHOULDER_Y, 0]} ref={pivotRef}>
      <group position={[-sx, -SHOULDER_Y, 0]}>
        {/* Shoulder cap */}
        <mesh position={[sx, SHOULDER_Y + 0.02, 0]} castShadow>
          <sphereGeometry args={[0.09, 18, 14]} />
          <ClothMat color={outfit} roughness={0.7} />
        </mesh>
        {/* Upper arm */}
        <mesh
          position={[sx + 0.012 * side, SHOULDER_Y - 0.09, 0]}
          rotation={[0, 0, 0.12 * -side]}
          castShadow
        >
          <capsuleGeometry args={[0.062, 0.14, 8, 14]} />
          <ClothMat color={outfit} roughness={0.72} />
        </mesh>
        {/* Elbow joint */}
        <mesh position={[sx + 0.026 * side, SHOULDER_Y - 0.2, 0]} castShadow>
          <sphereGeometry args={[0.055, 14, 12]} />
          <ClothMat color={outfit} roughness={0.75} />
        </mesh>
        {/* Forearm — slight inward bend */}
        <mesh
          position={[sx + 0.036 * side, SHOULDER_Y - 0.29, 0.015]}
          rotation={[-0.15, 0, 0.05 * -side]}
          castShadow
        >
          <capsuleGeometry args={[0.05, 0.13, 8, 14]} />
          <SkinMat color={skin} />
        </mesh>
        {/* Wrist cuff — tiny stripe that reads as sleeve edge */}
        <mesh
          position={[sx + 0.048 * side, SHOULDER_Y - 0.22, 0.008]}
          castShadow
        >
          <cylinderGeometry args={[0.055, 0.055, 0.025, 16]} />
          <ClothMat color={outfit} roughness={0.6} />
        </mesh>
        {/* Hand — flattened ellipsoid, not a sphere */}
        <group
          position={[sx + 0.05 * side, SHOULDER_Y - 0.38, 0.028]}
          rotation={[0, 0, 0.2 * -side]}
        >
          <mesh castShadow scale={[0.8, 1.2, 0.55]}>
            <sphereGeometry args={[0.06, 14, 12]} />
            <SkinMat color={skin} />
          </mesh>
          {/* Thumb */}
          <mesh
            position={[-0.022 * side, -0.006, 0.022]}
            rotation={[0.1, 0, 0.3 * side]}
            castShadow
          >
            <capsuleGeometry args={[0.014, 0.022, 4, 8]} />
            <SkinMat color={skin} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Leg({
  side,
  pants,
  bootCol,
  movingRef,
  riding,
}: {
  side: -1 | 1;
  pants: string;
  bootCol: string;
  movingRef?: MutableRefObject<boolean>;
  riding?: boolean;
}) {
  const sx = 0.09 * side;
  // Pivot at the hip, inner group cancels translation — same trick as Arm.
  const pivotRef = useRef<THREE.Group>(null);
  const amp = useRef(0);
  useFrame((state, dt) => {
    const pivot = pivotRef.current;
    if (!pivot) return;
    if (riding) {
      // Splay outward to straddle the horse; keep X rotation flat so the leg
      // hangs vertically from the rotated hip. Damp for smooth mount / dismount.
      pivot.rotation.z = THREE.MathUtils.damp(
        pivot.rotation.z,
        side * RIDING_LEG_SPREAD,
        10,
        dt,
      );
      pivot.rotation.x = THREE.MathUtils.damp(pivot.rotation.x, 0, 10, dt);
      amp.current = 0;
      return;
    }
    const moving = movingRef?.current ?? false;
    amp.current = THREE.MathUtils.damp(
      amp.current,
      moving ? 1 : 0,
      LIMB_SWING_ATTACK,
      dt,
    );
    // Left leg (-1) and right leg (+1) swing out of phase via `side`.
    const swing =
      Math.sin(state.clock.elapsedTime * LIMB_SWING_FREQ) *
      side *
      LIMB_SWING_AMP *
      amp.current;
    pivot.rotation.x = THREE.MathUtils.damp(pivot.rotation.x, swing, 20, dt);
    pivot.rotation.z = THREE.MathUtils.damp(pivot.rotation.z, 0, 10, dt);
  });
  return (
    <group position={[sx, HIP_Y, 0]} ref={pivotRef}>
      <group position={[-sx, -HIP_Y, 0]}>
        {/* Thigh */}
        <mesh position={[sx, HIP_Y - 0.1, 0]} castShadow>
          <capsuleGeometry args={[0.088, 0.16, 8, 14]} />
          <LeatherMat color={pants} />
        </mesh>
        {/* Knee */}
        <mesh position={[sx, HIP_Y - 0.22, 0.008]} castShadow>
          <sphereGeometry args={[0.075, 14, 12]} />
          <LeatherMat color={pants} />
        </mesh>
        {/* Calf */}
        <mesh position={[sx, HIP_Y - 0.32, 0.002]} castShadow>
          <capsuleGeometry args={[0.072, 0.16, 8, 14]} />
          <LeatherMat color={pants} />
        </mesh>
        {/* Boot shaft — slightly wider than calf for silhouette */}
        <mesh position={[sx, 0.06, 0.012]} castShadow>
          <cylinderGeometry args={[0.08, 0.086, 0.08, 16]} />
          <meshPhysicalMaterial
            color={bootCol}
            roughness={0.42}
            clearcoat={0.45}
            clearcoatRoughness={0.4}
          />
        </mesh>
        {/* Boot foot — elongated forward so the character reads oriented */}
        <group position={[sx, 0.028, 0.05]}>
          <mesh castShadow scale={[1, 0.55, 1.5]}>
            <sphereGeometry args={[0.08, 16, 12]} />
            <meshPhysicalMaterial
              color={bootCol}
              roughness={0.4}
              clearcoat={0.5}
              clearcoatRoughness={0.35}
            />
          </mesh>
          {/* Sole lip */}
          <mesh position={[0, -0.028, -0.01]} scale={[1.02, 0.16, 1.45]}>
            <sphereGeometry args={[0.08, 16, 10]} />
            <meshStandardMaterial color="#1a1410" roughness={0.85} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ── Root model ────────────────────────────────────────────────────────── */

export function CharacterModel({
  appearance,
  turntable = false,
  showFaceMarker = false,
  movingRef,
  deadRef,
  riding = false,
}: CharacterModelProps) {
  const rootRef = useRef<THREE.Group>(null);

  // Load the Knight FBX (base model + maybe some animations)
  const fbx = useFBX("/Knight D Pelegrini.fbx");

  // Load the walk animation GLB
  const { animations: walkAnims } = useGLTF("/walk.glb");

  // Load the death animation FBX
  const deathFbx = useFBX("/death.fbx");

  // Combine the animations into a single array for useAnimations
  const allAnimations = [
    ...fbx.animations,
    ...walkAnims,
    ...deathFbx.animations,
  ];
  const { actions, names } = useAnimations(allAnimations, rootRef);

  useEffect(() => {
    if (names.length > 0) {
      console.log("Available animations:", names);
      // We will handle playing animations in a useFrame hook based on movingRef
    }
  }, [actions, names]);

  // Handle animation state based on movingRef and deadRef
  useFrame(() => {
    if (!actions) return;

    // We assume the first animation from the walk.glb is the walk cycle
    // and the first from the fbx is an idle cycle. We fall back to names[0] if needed.
    const walkAnimName =
      walkAnims.length > 0
        ? walkAnims[0].name
        : names.find((n) => n.toLowerCase().includes("walk")) || names[0];
    const idleAnimName =
      fbx.animations.length > 0
        ? fbx.animations[0].name
        : names.find((n) => n.toLowerCase().includes("idle")) || names[0];
    const deathAnimName =
      deathFbx.animations.length > 0
        ? deathFbx.animations[0].name
        : names.find((n) => n.toLowerCase().includes("death")) || names[0];

    const walkAction = actions[walkAnimName];
    const idleAction = actions[idleAnimName];
    const deathAction = actions[deathAnimName];

    if (deadRef?.current) {
      if (idleAction && idleAction.isRunning()) {
        idleAction.fadeOut(0.2);
      }
      if (walkAction && walkAction.isRunning()) {
        walkAction.fadeOut(0.2);
      }
      if (deathAction && !deathAction.isRunning()) {
        deathAction.reset().fadeIn(0.2).play();
        deathAction.clampWhenFinished = true;
        deathAction.loop = THREE.LoopOnce;
      }
    } else if (movingRef?.current) {
      if (deathAction && deathAction.isRunning()) {
        deathAction.fadeOut(0.2);
      }
      if (idleAction && idleAction.isRunning()) {
        idleAction.fadeOut(0.2);
      }
      if (walkAction && !walkAction.isRunning()) {
        walkAction.reset().fadeIn(0.2).play();
      }
    } else {
      if (deathAction && deathAction.isRunning()) {
        deathAction.fadeOut(0.2);
      }
      if (walkAction && walkAction.isRunning()) {
        walkAction.fadeOut(0.2);
      }
      if (idleAction && !idleAction.isRunning()) {
        idleAction.reset().fadeIn(0.2).play();
      }
    }
  });

  // Turn table logic
  useFrame((_, dt) => {
    if (!turntable || !rootRef.current) return;
    rootRef.current.rotation.y += dt * 0.4;
  });

  // Adjust material properties on the FBX to fit our art style
  useEffect(() => {
    fbx.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Optionally tweak materials here
      }
    });
  }, [fbx]);

  // We scale the model to match the player size
  return (
    <group ref={rootRef} dispose={null}>
      {/* Soft ground contact shadow */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.34, 28]} />
        <meshBasicMaterial color="#000" transparent opacity={0.28} />
      </mesh>

      <group scale={[0.01, 0.01, 0.01]} position={[0, 0, 0]}>
        <primitive object={fbx} />
      </group>
    </group>
  );
}
