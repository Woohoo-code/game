import { Html } from "@react-three/drei";
import { BUILDINGS, type BuildingKind } from "../game/worldMap";

const HEIGHT_BY_KIND: Record<BuildingKind, number> = {
  inn: 1.3,
  shop: 1.3,
  train: 1.3,
  guild: 1.3,
  boss: 1.8
};

const COLOR_BY_KIND: Record<BuildingKind, string> = {
  inn: "#7b2f2f",
  shop: "#2e4f72",
  train: "#6b4f8f",
  guild: "#486d42",
  boss: "#3d1054"
};

export function Buildings() {
  return (
    <>
      {BUILDINGS.map((b, i) => {
        const h = HEIGHT_BY_KIND[b.kind];
        return (
          <group key={i} position={[b.pos.x + 0.5, 0, b.pos.y + 0.5]}>
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.85, h, 0.85]} />
              <meshStandardMaterial color={COLOR_BY_KIND[b.kind]} roughness={0.7} />
            </mesh>
            {/* Roof accent so it reads as a building and not a block */}
            <mesh position={[0, h + 0.12, 0]} castShadow>
              <boxGeometry args={[0.95, 0.18, 0.95]} />
              <meshStandardMaterial color="#1b222c" roughness={0.85} />
            </mesh>
            <Html
              center
              position={[0, h + 0.55, 0]}
              distanceFactor={9}
              zIndexRange={[20, 0]}
              pointerEvents="none"
            >
              <div className="building-label-3d">{b.label}</div>
            </Html>
          </group>
        );
      })}
    </>
  );
}
