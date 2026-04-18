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
  library: { height: 1.52, wallColor: "#9aa8c0", roof: "slate", accent: "#3a4a6a", bannerColor: "#5a7aa8", labelColor: "#e8f0ff" },
  forge: { height: 1.58, wallColor: "#6a6260", roof: "red", accent: "#8b3a28", bannerColor: "#c45c38", labelColor: "#ffe8d8" },
  chapel: { height: 1.48, wallColor: "#d8d4cc", roof: "gold", accent: "#8a7040", bannerColor: "#d4b060", labelColor: "#fffaf0" },
  stables: { height: 1.4, wallColor: "#a87848", roof: "thatch", accent: "#5c3a18", bannerColor: "#8b6020", labelColor: "#ffe8c8" },
  market: { height: 1.52, wallColor: "#c9a060", roof: "red", accent: "#6a4028", bannerColor: "#b85830", labelColor: "#fff2cc" }
};

const W = 0.9;

export function Buildings() {
  useGameStore();
  return (
    <>
      {BUILDINGS.map((b, i) =>
        b.kind === "voidPortal" ? (
          <VoidPortalBuilding key={`void-portal-${b.pos.x}-${b.pos.y}-${i}`} x={b.pos.x} y={b.pos.y} label={b.label} />
        ) : (
          <Building key={`${b.kind}-${b.pos.x}-${b.pos.y}-${i}`} kind={b.kind} x={b.pos.x} y={b.pos.y} label={b.label} />
        )
      )}
    </>
  );
}

function VoidPortalBuilding({ x, y, label }: { x: number; y: number; label: string }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = spin.current;
    if (g) g.rotation.y += dt * 0.42;
  });
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
            color="#3a9ad0"
            emissive="#2266aa"
            emissiveIntensity={1.05}
            metalness={0.45}
            roughness={0.22}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0.35, 0.2]}>
          <torusGeometry args={[0.34, 0.045, 12, 40]} />
          <meshStandardMaterial
            color="#7a48c8"
            emissive="#402088"
            emissiveIntensity={0.95}
            metalness={0.5}
            roughness={0.28}
          />
        </mesh>
      </group>
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color="#e8f8ff" emissive="#88ccff" emissiveIntensity={1.4} roughness={0.2} />
      </mesh>
      <pointLight position={[0, 1.05, 0]} intensity={1.35} distance={4.5} color="#88ddff" />
      <Html center position={[0, 1.72, 0]} distanceFactor={10} zIndexRange={[20, 0]} pointerEvents="none">
        <div className="building-label-3d" style={{ borderColor: "#44aacc" }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

function Building({ kind, x, y, label }: { kind: BuildingKind; x: number; y: number; label: string }) {
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

      {/* Chimney (skip boss / rift landmarks) */}
      {kind !== "boss" && kind !== "voidPortal" && (
        <mesh position={[W / 2 - 0.2, h + 0.25, -W / 2 + 0.2]} castShadow>
          <boxGeometry args={[0.14, 0.3, 0.14]} />
          <meshStandardMaterial color="#454049" roughness={0.9} />
        </mesh>
      )}

      {/* Floating name label */}
      <Html
        center
        position={[0, h + 0.95, 0]}
        distanceFactor={9}
        zIndexRange={[20, 0]}
        pointerEvents="none"
      >
        <div className="building-label-3d" style={{ borderColor: style.bannerColor }}>
          {label}
        </div>
      </Html>
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

function KindIcon({ kind }: { kind: BuildingKind }): JSX.Element {
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
    case "voidPortal":
      return <PortalGlyph />;
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
  }
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
