import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { JSX } from "react";
import { BUILDINGS, type BuildingKind } from "../game/worldMap";
import { useGameStore } from "../game/useGameStore";
import { getRoofTexture, getWallTexture } from "./textures";

interface KindStyle {
  height: number;
  wallColor: string;
  roof: "red" | "slate" | "thatch" | "gold";
  accent: string;
  bannerColor: string;
  labelColor: string;
}

const STYLE: Record<BuildingKind, KindStyle> = {
  inn: { height: 1.55, wallColor: "#d4b485", roof: "thatch", accent: "#7b2f2f", bannerColor: "#b0332f", labelColor: "#ffe6c2" },
  shop: { height: 1.45, wallColor: "#c5b898", roof: "red", accent: "#2e4f72", bannerColor: "#2e78c2", labelColor: "#def2ff" },
  train: { height: 1.65, wallColor: "#a18cb5", roof: "slate", accent: "#6b4f8f", bannerColor: "#8658be", labelColor: "#f0e2ff" },
  guild: { height: 1.5, wallColor: "#a2b08b", roof: "slate", accent: "#486d42", bannerColor: "#5c8a46", labelColor: "#e8f6db" },
  petShop: { height: 1.42, wallColor: "#8fc4b4", roof: "slate", accent: "#2a6b5c", bannerColor: "#3d9a82", labelColor: "#e6fff8" },
  boss: { height: 2.1, wallColor: "#3b1d4a", roof: "gold", accent: "#3d1054", bannerColor: "#7b2bb0", labelColor: "#f1caff" },
  voidPortal: { height: 2.1, wallColor: "#1a3a52", roof: "slate", accent: "#44aaff", bannerColor: "#2a6aa8", labelColor: "#d8f4ff" },
  returnPortal: { height: 2.1, wallColor: "#1f3a2a", roof: "slate", accent: "#78e0a8", bannerColor: "#48a878", labelColor: "#e0ffe8" },
  dungeon: { height: 1.7, wallColor: "#3b3238", roof: "slate", accent: "#8a2d2d", bannerColor: "#6a1c1c", labelColor: "#f4d0c8" },
  library: { height: 1.52, wallColor: "#9aa8c0", roof: "slate", accent: "#3a4a6a", bannerColor: "#5a7aa8", labelColor: "#e8f0ff" },
  forge: { height: 1.58, wallColor: "#6a6260", roof: "red", accent: "#8b3a28", bannerColor: "#c45c38", labelColor: "#ffe8d8" },
  chapel: { height: 1.48, wallColor: "#d8d4cc", roof: "gold", accent: "#8a7040", bannerColor: "#d4b060", labelColor: "#fffaf0" },
  stables: { height: 1.4, wallColor: "#a87848", roof: "thatch", accent: "#5c3a18", bannerColor: "#8b6020", labelColor: "#ffe8c8" },
  market: { height: 1.52, wallColor: "#c9a060", roof: "red", accent: "#6a4028", bannerColor: "#b85830", labelColor: "#fff2cc" },
  throne: {
    height: 2.12,
    wallColor: "#6a6e82",
    roof: "gold",
    accent: "#2a2840",
    bannerColor: "#d4a020",
    labelColor: "#fff8e8"
  },
  restoreSpring: { height: 0.35, wallColor: "#4a9090", roof: "slate", accent: "#2a6a78", bannerColor: "#3a9aaa", labelColor: "#e8ffff" }
};

const W = 0.9;

/** Box-style merchants / services (special-case buildings use their own meshes). */
type BoxBuildingKind = Exclude<BuildingKind, "voidPortal" | "returnPortal" | "dungeon" | "restoreSpring">;

export function Buildings() {
  const snapshot = useGameStore();
  const showLabel = !snapshot.battle.inBattle;
  return (
    <>
      {BUILDINGS.map((b, i) =>
        b.kind === "voidPortal" ? (
          <VoidPortalBuilding
            key={`void-portal-${b.pos.x}-${b.pos.y}-${i}`}
            x={b.pos.x}
            y={b.pos.y}
            label={b.label}
            showLabel={showLabel}
            palette="void"
          />
        ) : b.kind === "returnPortal" ? (
          <VoidPortalBuilding
            key={`return-portal-${b.pos.x}-${b.pos.y}-${i}`}
            x={b.pos.x}
            y={b.pos.y}
            label={b.label}
            showLabel={showLabel}
            palette="return"
          />
        ) : b.kind === "dungeon" ? (
          <DungeonEntranceBuilding
            key={`dungeon-${b.pos.x}-${b.pos.y}-${i}`}
            x={b.pos.x}
            y={b.pos.y}
            label={b.label}
            showLabel={showLabel}
          />
        ) : b.kind === "restoreSpring" ? (
          <RestoreSpringBuilding key={`spring-${b.pos.x}-${b.pos.y}-${i}`} x={b.pos.x} y={b.pos.y} label={b.label} />
        ) : (
          <Building
            key={`${b.kind}-${b.pos.x}-${b.pos.y}-${i}`}
            kind={b.kind as BoxBuildingKind}
            x={b.pos.x}
            y={b.pos.y}
            label={b.label}
            showLabel={showLabel}
          />
        )
      )}
    </>
  );
}

function RestoreSpringBuilding({ x, y, label }: { x: number; y: number; label: string }) {
  const ripple = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ripple.current;
    if (m) {
      const s = 1 + Math.sin(performance.now() * 0.0022) * 0.04;
      m.scale.setScalar(s);
    }
  });
  return (
    <group position={[x + 0.5, 0, y + 0.5]}>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[0.42, 0.48, 0.08, 24]} />
        <meshStandardMaterial color="#5a7870" roughness={0.88} />
      </mesh>
      <mesh ref={ripple} position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.36, 28]} />
        <meshStandardMaterial
          color="#4ad8d0"
          emissive="#1a7088"
          emissiveIntensity={0.55}
          metalness={0.15}
          roughness={0.35}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.18, 20]} />
        <meshStandardMaterial
          color="#b8f8ff"
          emissive="#6ae0f0"
          emissiveIntensity={0.9}
          metalness={0.2}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[-0.28, 0.12, 0.22]} castShadow>
        <dodecahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial color="#6a6862" roughness={0.9} />
      </mesh>
      <mesh position={[0.26, 0.1, -0.2]} castShadow>
        <dodecahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial color="#5a5854" roughness={0.92} />
      </mesh>
      <pointLight position={[0, 0.45, 0]} intensity={0.85} distance={3.8} color="#7af0e8" />
      <Html center position={[0, 0.95, 0]} distanceFactor={10} zIndexRange={[2, 0]} pointerEvents="none">
        <div className="building-label-3d" style={{ borderColor: "#3aacb8" }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

type PortalPalette = "void" | "return";

const PORTAL_PALETTES: Record<
  PortalPalette,
  {
    outerRing: string;
    outerEmissive: string;
    innerRing: string;
    innerEmissive: string;
    core: string;
    coreEmissive: string;
    light: string;
    border: string;
  }
> = {
  void: {
    outerRing: "#3a9ad0",
    outerEmissive: "#2266aa",
    innerRing: "#7a48c8",
    innerEmissive: "#402088",
    core: "#e8f8ff",
    coreEmissive: "#88ccff",
    light: "#88ddff",
    border: "#44aacc"
  },
  return: {
    outerRing: "#5ed69b",
    outerEmissive: "#24784e",
    innerRing: "#e8d36a",
    innerEmissive: "#8a6a20",
    core: "#f0ffe8",
    coreEmissive: "#9ee8b8",
    light: "#9ee8b8",
    border: "#58b88a"
  }
};

function VoidPortalBuilding({
  x,
  y,
  label,
  showLabel,
  palette = "void"
}: {
  x: number;
  y: number;
  label: string;
  showLabel: boolean;
  palette?: PortalPalette;
}) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = spin.current;
    if (g) g.rotation.y += dt * 0.42;
  });
  const p = PORTAL_PALETTES[palette];
  return (
    <group position={[x + 0.5, 0, y + 0.5]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.7, 0.12, 28]} />
        <meshStandardMaterial color="#1e2430" emissive="#0a1420" emissiveIntensity={0.35} roughness={0.92} />
      </mesh>
      <group ref={spin} position={[0, 0.88, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.52, 0.07, 14, 52]} />
          <meshStandardMaterial
            color={p.outerRing}
            emissive={p.outerEmissive}
            emissiveIntensity={1.05}
            metalness={0.45}
            roughness={0.22}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0.35, 0.2]}>
          <torusGeometry args={[0.34, 0.045, 12, 40]} />
          <meshStandardMaterial
            color={p.innerRing}
            emissive={p.innerEmissive}
            emissiveIntensity={0.95}
            metalness={0.5}
            roughness={0.28}
          />
        </mesh>
      </group>
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color={p.core} emissive={p.coreEmissive} emissiveIntensity={1.4} roughness={0.2} />
      </mesh>
      <pointLight position={[0, 1.05, 0]} intensity={1.35} distance={4.5} color={p.light} />
      {showLabel && (
        <Html center position={[0, 1.72, 0]} distanceFactor={10} zIndexRange={[2, 0]} pointerEvents="none">
          <div className="building-label-3d" style={{ borderColor: p.border }}>
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * Dungeon entrance — a dark stone arch with a "DUNGEON" signpost planted out front.
 * Visually distinct from the regular box buildings so the player can pick it out
 * from across the map.
 */
function DungeonEntranceBuilding({
  x,
  y,
  label,
  showLabel
}: {
  x: number;
  y: number;
  label: string;
  showLabel: boolean;
}) {
  return (
    <group position={[x + 0.5, 0, y + 0.5]}>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.72, 0.08, 18]} />
        <meshStandardMaterial color="#2a2128" roughness={0.95} />
      </mesh>
      <group position={[0, 0, 0]}>
        <mesh position={[-0.32, 0.38, 0]} castShadow>
          <boxGeometry args={[0.18, 0.78, 0.5]} />
          <meshStandardMaterial color="#3b3238" roughness={0.92} />
        </mesh>
        <mesh position={[0.32, 0.38, 0]} castShadow>
          <boxGeometry args={[0.18, 0.78, 0.5]} />
          <meshStandardMaterial color="#3b3238" roughness={0.92} />
        </mesh>
        <mesh position={[0, 0.82, 0]} castShadow>
          <boxGeometry args={[0.82, 0.14, 0.52]} />
          <meshStandardMaterial color="#2a2328" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <boxGeometry args={[0.44, 0.74, 0.3]} />
          <meshStandardMaterial color="#07060a" emissive="#0a0406" emissiveIntensity={0.18} roughness={1} />
        </mesh>
        <mesh position={[-0.32, 0.82, 0]} castShadow>
          <boxGeometry args={[0.05, 0.18, 0.05]} />
          <meshStandardMaterial color="#6a1c1c" emissive="#441010" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0.32, 0.82, 0]} castShadow>
          <boxGeometry args={[0.05, 0.18, 0.05]} />
          <meshStandardMaterial color="#6a1c1c" emissive="#441010" emissiveIntensity={0.6} />
        </mesh>
      </group>
      <group position={[0, 0, 0.6]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <boxGeometry args={[0.05, 0.46, 0.05]} />
          <meshStandardMaterial color="#4a3628" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.48, 0.02]} castShadow>
          <boxGeometry args={[0.6, 0.22, 0.04]} />
          <meshStandardMaterial color="#8a6848" roughness={0.85} />
        </mesh>
        <Html
          position={[0, 0.48, 0.05]}
          center
          distanceFactor={4}
          zIndexRange={[2, 0]}
          pointerEvents="none"
        >
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "9px",
              fontWeight: 900,
              color: "#f4d0c8",
              letterSpacing: "1px",
              textShadow: "0 1px 0 #000",
              padding: "1px 4px",
              background: "rgba(42,28,28,0.7)",
              border: "1px solid #6a1c1c",
              borderRadius: "2px"
            }}
          >
            DUNGEON
          </div>
        </Html>
      </group>
      <pointLight position={[0, 0.35, 0.1]} intensity={0.6} distance={2.2} color="#ff6a4a" />
      {showLabel && (
        <Html center position={[0, 1.35, 0]} distanceFactor={10} zIndexRange={[2, 0]} pointerEvents="none">
          <div className="building-label-3d" style={{ borderColor: "#6a1c1c" }}>
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

function Building({
  kind,
  x,
  y,
  label,
  showLabel
}: {
  kind: BoxBuildingKind;
  x: number;
  y: number;
  label: string;
  showLabel: boolean;
}) {
  const style = STYLE[kind];
  const h = style.height;
  const wallTex = getWallTexture(kind);
  const roofTex = getRoofTexture(style.roof);

  return (
    <group position={[x + 0.5, 0, y + 0.5]}>
      {/* Stone foundation skirt */}
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
        <boxGeometry args={[W + 0.06, 0.1, W + 0.06]} />
        <meshStandardMaterial color="#4a4a54" roughness={0.95} />
      </mesh>

      {/* Main body */}
      <mesh position={[0, h / 2 + 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, h, W]} />
        <meshStandardMaterial map={wallTex} color={style.wallColor} roughness={0.85} />
      </mesh>

      {/* Sloped roof — pyramid */}
      <mesh position={[0, h + 0.3, 0]} castShadow>
        <coneGeometry args={[W * 0.78, 0.55, 4]} />
        <meshStandardMaterial map={roofTex} roughness={0.8} />
      </mesh>
      {/* Ridge cap */}
      <mesh position={[0, h + 0.6, 0]} castShadow>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial color={style.accent} roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Front door facing +Z */}
      <mesh position={[0, 0.28, W / 2 + 0.001]} castShadow>
        <boxGeometry args={[0.26, 0.45, 0.02]} />
        <meshStandardMaterial color="#3b2515" roughness={0.9} />
      </mesh>
      {/* Door handle */}
      <mesh position={[0.08, 0.28, W / 2 + 0.015]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial color="#d4b250" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* Door frame */}
      <mesh position={[0, 0.28, W / 2 + 0.002]}>
        <boxGeometry args={[0.32, 0.51, 0.005]} />
        <meshStandardMaterial color={style.accent} roughness={0.8} />
      </mesh>

      {/* Side windows — left & right */}
      <Window side="left" h={h} color={style.accent} />
      <Window side="right" h={h} color={style.accent} />
      <Window side="back" h={h} color={style.accent} />

      {/* Banner hanging near the door */}
      <group position={[0, h * 0.62, W / 2 + 0.008]}>
        <mesh>
          <boxGeometry args={[0.5, 0.22, 0.012]} />
          <meshStandardMaterial color={style.bannerColor} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <coneGeometry args={[0.08, 0.12, 3]} />
          <meshStandardMaterial color={style.bannerColor} roughness={0.7} />
        </mesh>
      </group>

      {/* Kind-specific icon attached above the door */}
      <group position={[0, h * 0.66, W / 2 + 0.025]}>
        <KindIcon kind={kind} />
      </group>

      {/* Lanterns on either side of the door */}
      <Lantern position={[-0.36, 0.55, W / 2 + 0.02]} />
      <Lantern position={[0.36, 0.55, W / 2 + 0.02]} />

      {/* Chimney (skip boss landmark) */}
      {kind !== "boss" && (
        <mesh position={[W / 2 - 0.2, h + 0.25, -W / 2 + 0.2]} castShadow>
          <boxGeometry args={[0.14, 0.3, 0.14]} />
          <meshStandardMaterial color="#454049" roughness={0.9} />
        </mesh>
      )}

      {/* Floating name label (hidden during battle) */}
      {showLabel && (
        <Html
          center
          position={[0, h + 0.95, 0]}
          distanceFactor={9}
          zIndexRange={[2, 0]}
          pointerEvents="none"
        >
          <div className="building-label-3d" style={{ borderColor: style.bannerColor }}>
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

function Window({ side, h, color }: { side: "left" | "right" | "back"; h: number; color: string }): JSX.Element {
  const hy = h * 0.55;
  if (side === "left") {
    return (
      <>
        <mesh position={[-(W / 2 + 0.001), hy, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <boxGeometry args={[0.22, 0.22, 0.005]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
        <mesh position={[-(W / 2 + 0.004), hy, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <boxGeometry args={[0.16, 0.16, 0.002]} />
          <meshStandardMaterial color="#b3d9f5" emissive="#6faad1" emissiveIntensity={0.35} />
        </mesh>
      </>
    );
  }
  if (side === "right") {
    return (
      <>
        <mesh position={[W / 2 + 0.001, hy, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.22, 0.22, 0.005]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
        <mesh position={[W / 2 + 0.004, hy, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.16, 0.16, 0.002]} />
          <meshStandardMaterial color="#b3d9f5" emissive="#6faad1" emissiveIntensity={0.35} />
        </mesh>
      </>
    );
  }
  // back
  return (
    <>
      <mesh position={[0, hy, -(W / 2 + 0.001)]}>
        <boxGeometry args={[0.22, 0.22, 0.005]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, hy, -(W / 2 + 0.004)]}>
        <boxGeometry args={[0.16, 0.16, 0.002]} />
        <meshStandardMaterial color="#b3d9f5" emissive="#6faad1" emissiveIntensity={0.35} />
      </mesh>
    </>
  );
}

function Lantern({ position }: { position: [number, number, number] }): JSX.Element {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.04, 0.01, 0.04]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[0.06, 0.1, 0.06]} />
        <meshStandardMaterial color="#ffd27a" emissive="#ffb347" emissiveIntensity={1.2} />
      </mesh>
      <pointLight intensity={0.45} distance={2.2} color="#ffc676" position={[0, -0.02, 0]} />
    </group>
  );
}

function KindIcon({ kind }: { kind: BoxBuildingKind }): JSX.Element {
  switch (kind) {
    case "inn":
      return <BedIcon />;
    case "shop":
      return <CoinIcon />;
    case "train":
      return <SwordIcon />;
    case "guild":
      return <ShieldIcon />;
    case "petShop":
      return <PawIcon />;
    case "boss":
      return <SkullIcon />;
    case "library":
      return <BookIcon />;
    case "forge":
      return <AnvilIcon />;
    case "chapel":
      return <CrossIcon />;
    case "stables":
      return <HorseshoeIcon />;
    case "market":
      return <StallIcon />;
    case "throne":
      return <CrownIcon />;
  }
}

function CrownIcon(): JSX.Element {
  return (
    <group scale={1.08}>
      <mesh position={[0, 0.02, 0]}>
        <torusGeometry args={[0.1, 0.022, 8, 20]} />
        <meshStandardMaterial color="#f0d060" emissive="#a07020" emissiveIntensity={0.35} metalness={0.55} roughness={0.35} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.sin((i / 5) * Math.PI * 2) * 0.09, 0.08, Math.cos((i / 5) * Math.PI * 2) * 0.09]}>
          <coneGeometry args={[0.028, 0.07, 5]} />
          <meshStandardMaterial color="#ffe8a0" emissive="#c89030" emissiveIntensity={0.25} metalness={0.4} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function PortalGlyph(): JSX.Element {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.09, 0.026, 8, 22]} />
      <meshStandardMaterial color="#9ad8ff" emissive="#4488ff" emissiveIntensity={0.75} metalness={0.35} roughness={0.3} />
    </mesh>
  );
}

function PawIcon(): JSX.Element {
  return (
    <group scale={1.05}>
      <mesh position={[0, -0.02, 0.06]} rotation={[0.2, 0, 0]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#c8f0e4" roughness={0.55} />
      </mesh>
      <mesh position={[-0.06, -0.05, 0.02]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color="#7ab8a8" roughness={0.65} />
      </mesh>
      <mesh position={[0.06, -0.05, 0.02]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color="#7ab8a8" roughness={0.65} />
      </mesh>
      <mesh position={[-0.05, -0.08, -0.04]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshStandardMaterial color="#6aa898" roughness={0.65} />
      </mesh>
      <mesh position={[0.05, -0.08, -0.04]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshStandardMaterial color="#6aa898" roughness={0.65} />
      </mesh>
    </group>
  );
}

function BedIcon(): JSX.Element {
  return (
    <>
      <mesh>
        <boxGeometry args={[0.22, 0.05, 0.005]} />
        <meshStandardMaterial color="#fff4d6" emissive="#f0e0b0" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[-0.07, 0.02, 0.002]}>
        <boxGeometry args={[0.06, 0.05, 0.005]} />
        <meshStandardMaterial color="#f26f6f" />
      </mesh>
    </>
  );
}

function CoinIcon(): JSX.Element {
  return (
    <mesh rotation={[0, 0, 0]}>
      <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />
      <meshStandardMaterial color="#f1c653" emissive="#c29325" emissiveIntensity={0.35} metalness={0.6} roughness={0.3} />
    </mesh>
  );
}

function SwordIcon(): JSX.Element {
  return (
    <group>
      {/* Blade */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.04, 0.18, 0.005]} />
        <meshStandardMaterial color="#d8dde5" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Guard */}
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[0.18, 0.03, 0.01]} />
        <meshStandardMaterial color="#8b6a2b" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Grip */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.035, 0.06, 0.01]} />
        <meshStandardMaterial color="#4a2a18" roughness={0.9} />
      </mesh>
    </group>
  );
}

function ShieldIcon(): JSX.Element {
  return (
    <>
      <mesh>
        <cylinderGeometry args={[0.1, 0.08, 0.015, 5]} />
        <meshStandardMaterial color="#c9d2b1" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[0.02, 0.14, 0.005]} />
        <meshStandardMaterial color="#486d42" />
      </mesh>
      <mesh position={[0, 0, 0.01]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.02, 0.14, 0.005]} />
        <meshStandardMaterial color="#486d42" />
      </mesh>
    </>
  );
}

function SkullIcon(): JSX.Element {
  return (
    <>
      <mesh>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial color="#ece4d7" emissive="#9180ad" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[-0.025, 0.005, 0.07]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color="#1a0d2a" />
      </mesh>
      <mesh position={[0.025, 0.005, 0.07]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color="#1a0d2a" />
      </mesh>
      <mesh position={[0, -0.04, 0.072]}>
        <boxGeometry args={[0.04, 0.02, 0.005]} />
        <meshBasicMaterial color="#1a0d2a" />
      </mesh>
    </>
  );
}

function BookIcon(): JSX.Element {
  return (
    <group rotation={[0.1, 0, 0]}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.14, 0.18, 0.04]} />
        <meshStandardMaterial color="#4a5a78" roughness={0.65} />
      </mesh>
      <mesh position={[0.002, 0.002, 0.022]}>
        <boxGeometry args={[0.1, 0.14, 0.008]} />
        <meshStandardMaterial color="#e8e4dc" emissive="#b8c4d8" emissiveIntensity={0.12} roughness={0.8} />
      </mesh>
    </group>
  );
}

function AnvilIcon(): JSX.Element {
  return (
    <group>
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[0.16, 0.05, 0.08]} />
        <meshStandardMaterial color="#3a3a42" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.1, 0.08, 0.06]} />
        <meshStandardMaterial color="#5a5a68" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

function CrossIcon(): JSX.Element {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.04, 0.2, 0.015]} />
        <meshStandardMaterial color="#d4c8a8" metalness={0.25} roughness={0.45} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.04, 0.14, 0.015]} />
        <meshStandardMaterial color="#c8b890" metalness={0.25} roughness={0.45} />
      </mesh>
    </group>
  );
}

function HorseshoeIcon(): JSX.Element {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.07, 0.022, 8, 16, Math.PI * 1.25]} />
      <meshStandardMaterial color="#6a4a28" metalness={0.35} roughness={0.55} />
    </mesh>
  );
}

function StallIcon(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.2, 0.04, 0.06]} />
        <meshStandardMaterial color="#c04030" roughness={0.65} />
      </mesh>
      <mesh position={[-0.06, -0.02, 0.02]}>
        <boxGeometry args={[0.04, 0.1, 0.04]} />
        <meshStandardMaterial color="#8a6040" roughness={0.75} />
      </mesh>
      <mesh position={[0.06, -0.02, 0.02]}>
        <boxGeometry args={[0.04, 0.1, 0.04]} />
        <meshStandardMaterial color="#8a6040" roughness={0.75} />
      </mesh>
    </group>
  );
}
