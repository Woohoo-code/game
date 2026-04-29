import { memo, useRef, useMemo, type MutableRefObject, useEffect, useLayoutEffect, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAnimations, useFBX, useGLTF } from "@react-three/drei";
import type { FacialHairStyle, HairStyle, PlayerAppearance } from "../game/types";
import { gameStore } from "../game/state";
import { publicAssetUrl } from "./publicAssetUrl";

interface CharacterModelProps {
  appearance: PlayerAppearance;
  /** When true, skip the soft foot disc (e.g. overworld uses a sun-aligned shadow instead). */
  omitContactShadow?: boolean;
  /** When true, show no procedural placeholder while the FBX loads. */
  hideLoadingFallback?: boolean;
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
   * When true the character adopts a seated riding pose: legs splay outward
   * at the hips to straddle the mount, arms tilt forward as if holding reins,
   * and the walking swing cycle is suppressed. Player3D toggles this based
   * on horse ownership.
   */
  riding?: boolean;
}

/** Uniform scale vs prior default (~25% smaller). */
const CHARACTER_MODEL_SCALE = 0.75;

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

/* ── Procedural full-body fallback ─────────────────────────────────────── */

/** Renders the complete hero using only Three.js primitives.
 *  Used as the <Suspense> fallback while the FBX model is loading so the
 *  player always sees a character — never an invisible slot. */
function ProceduralBody({
  appearance,
  movingRef,
  riding = false,
  showFaceMarker = false,
}: {
  appearance: PlayerAppearance;
  movingRef?: MutableRefObject<boolean>;
  riding?: boolean;
  showFaceMarker?: boolean;
}) {
  const skin = appearance.skin;
  const hair = appearance.hair;
  const outfit = appearance.outfit;
  const pants = appearance.pants;
  const bootCol = "#2a1a12";
  const buckleCol = "#c8a24a";
  return (
    <group>
      {/* Legs + boots */}
      <Leg side={-1} pants={pants} bootCol={bootCol} movingRef={movingRef} riding={riding} />
      <Leg side={1} pants={pants} bootCol={bootCol} movingRef={movingRef} riding={riding} />
      {/* Pelvis — small cylinder that bridges thighs */}
      <mesh position={[0, HIP_Y + 0.008, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.175, 0.07, 18]} />
        <LeatherMat color={pants} />
      </mesh>
      {/* Belt */}
      <mesh position={[0, WAIST_Y + 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.048, 22]} />
        <meshPhysicalMaterial color="#2a2030" roughness={0.55} clearcoat={0.35} clearcoatRoughness={0.4} />
      </mesh>
      {/* Belt buckle */}
      <mesh position={[0, WAIST_Y + 0.02, -0.18]} castShadow>
        <boxGeometry args={[0.06, 0.038, 0.018]} />
        <meshPhysicalMaterial color={buckleCol} roughness={0.3} metalness={0.75} clearcoat={0.8} />
      </mesh>
      {/* Torso — tapered waist + broader chest */}
      <mesh position={[0, WAIST_Y + 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.185, 0.175, 0.18, 22]} />
        <ClothMat color={outfit} />
      </mesh>
      <mesh position={[0, SHOULDER_Y - 0.04, 0]} castShadow>
        <capsuleGeometry args={[0.21, 0.08, 10, 18]} />
        <ClothMat color={outfit} />
      </mesh>
      {/* Chest V-neck / tunic collar */}
      <mesh position={[0, SHOULDER_Y - 0.02, -0.185]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.14, 0.06, 0.015]} />
        <SkinMat color={skin} />
      </mesh>
      {/* Arms (articulated) */}
      <Arm side={-1} outfit={outfit} skin={skin} movingRef={movingRef} riding={riding} />
      <Arm side={1} outfit={outfit} skin={skin} movingRef={movingRef} riding={riding} />
      {/* Neck */}
      <mesh position={[0, HEAD_Y - 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.072, 0.082, 0.09, 18]} />
        <SkinMat color={skin} />
      </mesh>
      {/* Head */}
      <mesh position={[0, HEAD_Y, 0]} castShadow>
        <sphereGeometry args={[HEAD_R, 32, 24]} />
        <SkinMat color={skin} />
      </mesh>
      <Face skin={skin} />
      <Beard style={appearance.facialHair} color={appearance.beardColor} />
      <Hair style={appearance.hairStyle} color={hair} />
      {showFaceMarker && (
        <mesh position={[0, HEAD_Y, -HEAD_R - 0.016]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color="#fff6dd" emissive="#ffe8aa" emissiveIntensity={0.22} />
        </mesh>
      )}
    </group>
  );
}

/* ── Asset preload ─────────────────────────────────────────────────────── */

// Start fetching the idle animation as soon as this module is imported so it
// arrives before the component mounts (critical-path asset).
useGLTF.preload(publicAssetUrl("idle.glb"), undefined, true);
useFBX.preload(publicAssetUrl("Knight D Pelegrini.fbx"));

let deferredNonCriticalPreloadsScheduled = false;

export function deferNonCriticalPreloads() {
  if (deferredNonCriticalPreloadsScheduled) return;
  deferredNonCriticalPreloadsScheduled = true;

  const load = () => {
    useGLTF.preload(publicAssetUrl("walk.glb"), undefined, true);
    useFBX.preload(publicAssetUrl("death.fbx"));
  };

  const globalScope = globalThis as {
    requestIdleCallback?: (callback: () => void) => number;
  };

  if (typeof globalScope.requestIdleCallback === "function") {
    globalScope.requestIdleCallback(load);
    return;
  }

  window.setTimeout(load, 2000);
}

/* ── Shared type for lazily-loaded animation actions ──────────────────── */

interface LazyAnimActions {
  walk: THREE.AnimationAction | null;
  death: THREE.AnimationAction | null;
}

const GLB_TO_KNIGHT_BONE: Record<string, string> = {
  root: "mixamorigHips",
  pelvis: "mixamorigHips",
  spine_01: "mixamorigSpine",
  spine_02: "mixamorigSpine1",
  spine_03: "mixamorigSpine2",
  neck_01: "mixamorigNeck",
  head: "mixamorigHead",
  head_leaf: "mixamorigHeadTop_End",
  clavicle_l: "mixamorigLeftShoulder",
  upperarm_l: "mixamorigLeftArm",
  lowerarm_l: "mixamorigLeftForeArm",
  hand_l: "mixamorigLeftHand",
  thigh_l: "mixamorigLeftUpLeg",
  calf_l: "mixamorigLeftLeg",
  foot_l: "mixamorigLeftFoot",
  ball_l: "mixamorigLeftToeBase",
  ball_leaf_l: "mixamorigLeftToe_End",
  clavicle_r: "mixamorigRightShoulder",
  upperarm_r: "mixamorigRightArm",
  lowerarm_r: "mixamorigRightForeArm",
  hand_r: "mixamorigRightHand",
  thigh_r: "mixamorigRightUpLeg",
  calf_r: "mixamorigRightLeg",
  foot_r: "mixamorigRightFoot",
  ball_r: "mixamorigRightToeBase",
  ball_leaf_r: "mixamorigRightToe_End"
};

const GLB_LOWER_BODY_NODES = new Set([
  "pelvis",
  "thigh_l",
  "calf_l",
  "foot_l",
  "ball_l",
  "ball_leaf_l",
  "thigh_r",
  "calf_r",
  "foot_r",
  "ball_r",
  "ball_leaf_r",
]);

for (const side of ["l", "r"] as const) {
  const sideName = side === "l" ? "Left" : "Right";
  for (const [glbPrefix, fbxPrefix] of [
    ["index", "Index"],
    ["middle", "Middle"],
    ["pinky", "Pinky"],
    ["ring", "Ring"],
    ["thumb", "Thumb"]
  ] as const) {
    for (let i = 1; i <= 3; i++) {
      GLB_TO_KNIGHT_BONE[`${glbPrefix}_0${i}_${side}`] = `mixamorig${sideName}Hand${fbxPrefix}${i}`;
    }
    GLB_TO_KNIGHT_BONE[`${glbPrefix}_04_leaf_${side}`] = `mixamorig${sideName}Hand${fbxPrefix}4`;
  }
}

function retargetGlbClipToKnight(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks
    .map((track) => {
      const dot = track.name.indexOf(".");
      if (dot <= 0) return null;
      const node = track.name.slice(0, dot);
      const prop = track.name.slice(dot + 1);
      // GLB `root` is an exporter pivot (often a fixed Y↔Z correction); never drive the Knight root.
      // The GLB lower body was authored under a different root/pelvis correction than this FBX.
      // Retargeting only those descendant bones against the Knight bind pelvis makes legs detach;
      // keep lower body in the FBX bind pose rather than applying incompatible partial tracks.
      if (node === "root") return null;
      if (GLB_LOWER_BODY_NODES.has(node)) return null;
      const mapped = GLB_TO_KNIGHT_BONE[node];
      if (!mapped) return null;
      const next = track.clone();
      next.name = `${mapped}.${prop}`;
      return next;
    })
    .filter((track): track is THREE.KeyframeTrack => track !== null);

  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

/**
 * Binds a walk loop on the shared mixer. Prefer a clip on the **same** Knight FBX so bones
 * retarget; `walk.glb` is a fallback and only animates if it matches that rig (otherwise T-pose).
 */
function WalkAnimLoader({
  embeddedAnimations,
  mixer,
  lazyRef,
}: {
  embeddedAnimations: THREE.AnimationClip[];
  mixer: THREE.AnimationMixer;
  lazyRef: MutableRefObject<LazyAnimActions>;
}) {
  const { animations: walkGlb } = useGLTF(publicAssetUrl("walk.glb"), undefined, true);
  const retargetedWalkGlb = useMemo(() => walkGlb.map(retargetGlbClipToKnight), [walkGlb]);
  useEffect(() => {
    const fromEmbedded = embeddedAnimations.find((a) =>
      /walk|Walk|WALK|jog|Jog|JOG|run|Run|RUN|march|March|forward|Forward/.test(a.name),
    );
    // Never fall back to `walk.glb` animations[0] — that clip is often a swim/prone take and
    // reads horribly when mislabeled. Only play GLB clips whose names look like locomotion.
    const fromGlb = retargetedWalkGlb.find((a) =>
      /Walk_Loop|walk|Walk|WALK|jog|Jog|run|Run|march|March|forward|Forward/.test(a.name),
    );
    const clip = fromEmbedded ?? fromGlb ?? null;
    if (clip) {
      const act = mixer.clipAction(clip);
      act.loop = THREE.LoopRepeat;
      act.setEffectiveWeight(1);
      lazyRef.current.walk = act;
    } else {
      lazyRef.current.walk = null;
    }
    return () => {
      lazyRef.current.walk?.stop();
      lazyRef.current.walk = null;
    };
  }, [embeddedAnimations, retargetedWalkGlb, mixer, lazyRef]);
  return null;
}

/** Loads death.fbx and registers its first clip on the shared mixer.
 *  Rendered inside a <Suspense fallback={null}> so it only loads on demand. */
function DeathAnimLoader({
  mixer,
  lazyRef,
}: {
  mixer: THREE.AnimationMixer;
  lazyRef: MutableRefObject<LazyAnimActions>;
}) {
  const deathFbx = useFBX(publicAssetUrl("death.fbx")) as THREE.Group;
  const deathAnimations = deathFbx.animations;
  useEffect(() => {
    if (deathAnimations.length > 0) {
      lazyRef.current.death = mixer.clipAction(deathAnimations[0]);
    }
    return () => {
      lazyRef.current.death?.stop();
      lazyRef.current.death = null;
    };
  }, [deathAnimations, mixer, lazyRef]);
  return null;
}

/* ── Character rig (inner, suspending) ─────────────────────────────────── */

/** How strongly hero color choices shift each material from its authored base. */
const FBX_TINT_BLEND = 0.52;

type FbxTintSlot = "skin" | "outfit" | "pants";

function fbxTintKey(meshName: string, matName: string): string {
  return `${meshName} ${matName}`.toLowerCase();
}

/** Map meshes/materials to tint slots; returns null for metal/weapons (leave base color). */
function resolveFbxTintSlot(meshName: string, matName: string): FbxTintSlot | null {
  const k = fbxTintKey(meshName, matName);
  if (
    /\b(sword|blade|dagger|arrow|quiver|weapon|buckler|shield|metal|steel|iron|silver|gold|bronze|gem|crystal|rivet|chainmail_ring)\b/.test(
      k,
    )
  ) {
    return null;
  }
  if (/\b(eye|lash|teeth|mouth|lip|brow)\b/.test(k)) return null;
  if (/\b(head_hands|face|skin|neck|palm|knuckle|flesh)\b/.test(k)) return "skin";
  if (/\b(lower_armor|boot|shoe|feet|foot|sock|greave|pant|trouser|chausses|legging|thigh|calf|underpant|denim|jean)\b/.test(k)) return "pants";
  if (
    /_(leg|boot|foot|shoe|pant)\b/.test(k) ||
    /\blegs?\b/.test(k)
  ) {
    return "pants";
  }
  if (
    /\b(face|skin|neck|palm|knuckle|flesh)\b/.test(k) ||
    /\b(hand|finger)s?\b/.test(k) ||
    (/\bhead\b/.test(k) && !/\b(helmet|helm|hood)\b/.test(k))
  ) {
    return "skin";
  }
  if (
    /\b(cape|cloak|robe|coat|tunic|cloth|mail|plate|chest|torso|armor|armour|gauntlet|glove|bracer|belt|shoulder|sleeve|tabard|surcoat|gambeson|vest|skirt|robe)\b/.test(
      k,
    ) ||
    /\b(upper|forearm|arm|body|torso)\b/.test(k)
  ) {
    return "outfit";
  }
  return "outfit";
}

/** Loads the Knight FBX and drives all its animations.
 *  This component suspends (via useFBX/useGLTF) until both the base model
 *  and idle animation are ready — CharacterModel shows ProceduralBody as the
 *  Suspense fallback in the meantime, so only ONE geometry is ever visible. */
function FBXCharacterInner({
  appearance,
  movingRef,
}: {
  appearance: PlayerAppearance;
  movingRef?: MutableRefObject<boolean>;
}) {
  const fbx = useFBX(publicAssetUrl("Knight D Pelegrini.fbx")) as THREE.Group;
  const knightScene = fbx;
  const knightAnimations = fbx.animations;
  const { animations: idleAnims } = useGLTF(publicAssetUrl("idle.glb"), undefined, true);
  const retargetedIdleAnims = useMemo(() => idleAnims.map(retargetGlbClipToKnight), [idleAnims]);

  useEffect(() => {
    deferNonCriticalPreloads();
  }, []);

  /**
   * Bind all eager clips through Drei's animation helper. The GLB idle clip
   * targets the Knight rig by bone names; using a separate manual mixer can
   * leave the skinned mesh in bind pose on first paint / page deploys.
   */
  const fbxClips = useMemo(() => [...knightAnimations, ...retargetedIdleAnims], [knightAnimations, retargetedIdleAnims]);
  const { actions, names, mixer } = useAnimations(fbxClips, knightScene);

  useLayoutEffect(() => {
    const skin = new THREE.Color(appearance.skin);
    const outfit = new THREE.Color(appearance.outfit);
    const pants = new THREE.Color(appearance.pants);
    knightScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const childData = child.userData as { fbxTintMaterialsCloned?: boolean };
      if (!childData.fbxTintMaterialsCloned) {
        child.material = Array.isArray(child.material)
          ? child.material.map((mat) => mat.clone())
          : child.material.clone();
        childData.fbxTintMaterialsCloned = true;
      }
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!("color" in mat) || !(mat.color instanceof THREE.Color)) continue;
        const ud = mat.userData as { fbxTintBase?: THREE.Color };
        if (!ud.fbxTintBase) ud.fbxTintBase = mat.color.clone();
        const base = ud.fbxTintBase;
        const slot = resolveFbxTintSlot(child.name, mat.name || "");
        if (slot === null) {
          mat.color.copy(base);
          continue;
        }
        const target =
          slot === "skin" ? skin : slot === "pants" ? pants : outfit;
        mat.color.copy(base).lerp(target, FBX_TINT_BLEND);
      }
    });
  }, [knightScene, appearance.skin, appearance.outfit, appearance.pants]);

  const lazyActionsRef = useRef<LazyAnimActions>({ walk: null, death: null });
  /** Once per HP≤0 spell — avoids restarting death every frame after the clip finishes, and avoids parent/child `useFrame` ordering issues with a ref. */
  const deathStartedThisKnockoutRef = useRef(false);
  const lowerBodyPoseRef = useRef<
    Partial<Record<"lThigh" | "lCalf" | "lFoot" | "rThigh" | "rCalf" | "rFoot", { bone: THREE.Object3D; base: THREE.Quaternion }>>
  >({});
  const manualWalkPhaseRef = useRef(0);
  const manualWalkQuatRef = useRef(new THREE.Quaternion());
  const manualWalkEulerRef = useRef(new THREE.Euler(0, 0, 0, "XYZ"));

  useEffect(() => {
    const byKey: Array<[
      keyof typeof lowerBodyPoseRef.current,
      string,
    ]> = [
      ["lThigh", "mixamorigLeftUpLeg"],
      ["lCalf", "mixamorigLeftLeg"],
      ["lFoot", "mixamorigLeftFoot"],
      ["rThigh", "mixamorigRightUpLeg"],
      ["rCalf", "mixamorigRightLeg"],
      ["rFoot", "mixamorigRightFoot"],
    ];
    const next: typeof lowerBodyPoseRef.current = {};
    for (const [key, boneName] of byKey) {
      const bone = knightScene.getObjectByName(boneName);
      if (bone) next[key] = { bone, base: bone.quaternion.clone() };
    }
    lowerBodyPoseRef.current = next;
  }, [knightScene]);

  /**
   * Idle clip: `idle.glb` ships `Idle_No_Loop`; the Knight mesh FBX may only
   * include a useless "mixamo.com" placeholder, so prefer the GLB idle.
   */
  const idleNameRef = useRef<string>("");
  useEffect(() => {
    const glbIdle = retargetedIdleAnims.find(
      (a) => /idle|Idl|breathe|standing|neutral/i.test(a.name) && a.name.length > 0,
    );
    const fbxIdle = knightAnimations.find(
      (a) =>
        a.duration > 0.2 &&
        !/^mixamo\.com$/i.test(a.name.trim()) &&
        /idle|breathe|standing|neutral/i.test(a.name),
    );
    // Avoid `animations[0]` / `names[0]` fallbacks — first GLB clip may not be a standing idle.
    idleNameRef.current =
      glbIdle?.name ??
      fbxIdle?.name ??
      names.find((n) => /idle/i.test(n) && !/^mixamo\.com$/i.test(n.trim())) ??
      "";
  }, [knightAnimations, retargetedIdleAnims, names]);

  useFrame((_, delta) => {
    const idleAnimName = idleNameRef.current;
    const idleAction = idleAnimName ? actions[idleAnimName] : undefined;
    const walkAction = lazyActionsRef.current.walk;
    const deathAction = lazyActionsRef.current.death;
    const playerDead = gameStore.getSnapshot().player.hp <= 0;
    const moving = Boolean(movingRef?.current);

    if (!playerDead) {
      deathStartedThisKnockoutRef.current = false;
    }

    if (playerDead) {
      if (idleAction?.isRunning()) idleAction.fadeOut(0.2);
      if (walkAction?.isRunning()) walkAction.fadeOut(0.2);
      if (deathAction && !deathStartedThisKnockoutRef.current) {
        deathStartedThisKnockoutRef.current = true;
        deathAction.reset().fadeIn(0.2).play();
        deathAction.clampWhenFinished = true;
        deathAction.loop = THREE.LoopOnce;
      }
    } else if (moving) {
      if (deathAction && (deathAction.isRunning() || deathAction.getEffectiveWeight() > 0.001)) {
        deathAction.fadeOut(0.2);
      }
      if (idleAction?.isRunning()) idleAction.fadeOut(0.2);
      if (walkAction && !walkAction.isRunning()) {
        walkAction.reset().fadeIn(0.2).play();
      } else if (!walkAction && idleAction && !idleAction.isRunning()) {
        idleAction.reset().fadeIn(0.1).play();
      }
    } else {
      if (deathAction && (deathAction.isRunning() || deathAction.getEffectiveWeight() > 0.001)) {
        deathAction.fadeOut(0.2);
      }
      if (walkAction?.isRunning()) walkAction.fadeOut(0.2);
      if (idleAction && !idleAction.isRunning()) {
        idleAction.reset().fadeIn(0.2).play();
      }
    }

    const lowerBody = lowerBodyPoseRef.current;
    const setLowerBone = (key: keyof typeof lowerBody, x: number) => {
      const part = lowerBody[key];
      if (!part) return;
      manualWalkEulerRef.current.set(x, 0, 0);
      manualWalkQuatRef.current.setFromEuler(manualWalkEulerRef.current);
      part.bone.quaternion.copy(part.base).multiply(manualWalkQuatRef.current);
    };

    if (!playerDead && moving) {
      manualWalkPhaseRef.current += delta * LIMB_SWING_FREQ;
      const swing = Math.sin(manualWalkPhaseRef.current);
      const l = swing * 0.46;
      const r = -swing * 0.46;
      setLowerBone("lThigh", l);
      setLowerBone("rThigh", r);
      setLowerBone("lCalf", Math.max(0, -l) * 0.72);
      setLowerBone("rCalf", Math.max(0, -r) * 0.72);
      setLowerBone("lFoot", -l * 0.22);
      setLowerBone("rFoot", -r * 0.22);
    } else {
      const settle = 1 - Math.exp(-delta * LIMB_SWING_ATTACK);
      for (const part of Object.values(lowerBody)) {
        if (!part) continue;
        part.bone.quaternion.slerp(part.base, settle);
      }
    }
  });

  useEffect(() => {
    knightScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [knightScene]);

  return (
    <group>
      {/*
        If the hero still looks ~90°/180° off after Player3D facing fixes, add rotation.y on
        this inner group (e.g. Math.PI) — FBX forward axes vary by export. */}
      <group scale={[0.01, 0.01, 0.01]} position={[0, 0, 0]}>
        <primitive object={knightScene} />
      </group>
      {/* Walk animation — loads lazily, doesn't block first paint */}
      <Suspense fallback={null}>
        <WalkAnimLoader embeddedAnimations={knightAnimations} mixer={mixer} lazyRef={lazyActionsRef} />
      </Suspense>
      {/* Death animation — loads lazily, only needed when character dies */}
      <Suspense fallback={null}>
        <DeathAnimLoader mixer={mixer} lazyRef={lazyActionsRef} />
      </Suspense>
    </group>
  );
}

/* ── Root model ────────────────────────────────────────────────────────── */

export const CharacterModel = memo(function CharacterModel({
  appearance,
  omitContactShadow = false,
  hideLoadingFallback = false,
  turntable = false,
  showFaceMarker = false,
  movingRef,
  riding = false,
}: CharacterModelProps) {
  const rootRef = useRef<THREE.Group>(null);

  // ── Turntable (preview mode only) ────────────────────────────────────────
  useFrame((_, dt) => {
    if (!turntable || !rootRef.current) return;
    rootRef.current.rotation.y += dt * 0.4;
  });

  return (
    <group ref={rootRef} dispose={null}>
      <group scale={CHARACTER_MODEL_SCALE}>
        {!omitContactShadow && (
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.34, 28]} />
            <meshBasicMaterial color="#000" transparent opacity={0.28} />
          </mesh>
        )}

        {/* Body — FBX model once loaded (preferred); procedural geometry until
            then so the character is never invisible during the initial load. */}
        <Suspense
          fallback={
            hideLoadingFallback ? null : (
              <ProceduralBody
                appearance={appearance}
                movingRef={movingRef}
                riding={riding}
                showFaceMarker={showFaceMarker}
              />
            )
          }
        >
          <FBXCharacterInner appearance={appearance} movingRef={movingRef} />
        </Suspense>
      </group>
    </group>
  );
});
