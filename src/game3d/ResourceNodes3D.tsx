import { useMemo } from "react";
import { RESOURCES, type ResourceDefinition, type ResourceShape } from "../game/data";
import type { ResourceNode } from "../game/types";
import { MAP_H, MAP_W } from "../game/worldMap";
import { useGameStore } from "../game/useGameStore";

interface ResolvedNode {
  id: string;
  tx: number;
  ty: number;
  def: ResourceDefinition;
}

/**
 * Render little flower / mushroom / herb markers on every pickup tile.
 * A small bob + rotation keeps them readable without being distracting.
 */
export function ResourceNodes3D() {
  const snapshot = useGameStore();
  const nodes = snapshot.world.resourceNodes ?? [];

  const resolved = useMemo<ResolvedNode[]>(() => {
    const out: ResolvedNode[] = [];
    for (const n of nodes) {
      if (n.tx < 0 || n.ty < 0 || n.tx >= MAP_W || n.ty >= MAP_H) continue;
      const def = RESOURCES[n.resourceKey];
      if (!def) continue;
      out.push({ id: n.id, tx: n.tx, ty: n.ty, def });
    }
    return out;
  }, [nodes]);

  if (snapshot.battle.inBattle || resolved.length === 0) return null;

  return (
    <group name="resource-nodes">
      {resolved.map((n) => {
        const seed = hashInt(n.tx * 7919 + n.ty * 131 + 17);
        const rot = (seed % 628) / 100;
        return (
          <group
            key={n.id}
            position={[n.tx + 0.5, 0, n.ty + 0.5]}
            rotation={[0, rot, 0]}
          >
            <ResourcePropModel shape={n.def.shape} def={n.def} />
          </group>
        );
      })}
    </group>
  );
}

function hashInt(v: number): number {
  let h = v >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function ResourcePropModel({
  shape,
  def
}: {
  shape: ResourceShape;
  def: ResourceDefinition;
}) {
  const primary = def.colorPrimary;
  const accent = def.colorAccent;

  if (shape === "mushroom") {
    return (
      <group scale={0.42}>
        {/* stem */}
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.11, 0.42, 8]} />
          <meshStandardMaterial color="#f4ead5" roughness={0.85} />
        </mesh>
        {/* cap */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={primary} roughness={0.55} emissive={accent} emissiveIntensity={0.18} />
        </mesh>
        {/* underside gills */}
        <mesh position={[0, 0.5, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.28, 0.04, 16, 1, true]} />
          <meshStandardMaterial color={accent} roughness={0.9} side={2} />
        </mesh>
      </group>
    );
  }

  if (shape === "herb") {
    return (
      <group scale={0.5}>
        {/* tuft of blades */}
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          const r = 0.08;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * r, 0.22, Math.sin(a) * r]}
              rotation={[Math.cos(a) * 0.35, a, Math.sin(a) * 0.35]}
              castShadow
            >
              <coneGeometry args={[0.07, 0.45, 6]} />
              <meshStandardMaterial color={primary} roughness={0.8} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.08, 10]} />
          <meshStandardMaterial color={accent} roughness={0.95} />
        </mesh>
      </group>
    );
  }

  if (shape === "crystalBloom") {
    return (
      <group scale={0.44}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 0.44, 8]} />
          <meshStandardMaterial color="#2f5a38" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.55, 0]} castShadow>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial
            color={primary}
            roughness={0.25}
            metalness={0.25}
            emissive={accent}
            emissiveIntensity={0.32}
          />
        </mesh>
      </group>
    );
  }

  // Default: "flower"
  return (
    <group scale={0.5}>
      {/* stem */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.035, 0.44, 6]} />
        <meshStandardMaterial color="#2f6d3a" roughness={0.9} />
      </mesh>
      {/* single leaf */}
      <mesh position={[0.08, 0.18, 0]} rotation={[0, 0, -0.6]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshStandardMaterial color="#49a055" roughness={0.8} />
      </mesh>
      {/* five petals in a ring */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        const r = 0.09;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.46, Math.sin(a) * r]} castShadow>
            <sphereGeometry args={[0.08, 10, 8]} />
            <meshStandardMaterial
              color={primary}
              roughness={0.55}
              emissive={primary}
              emissiveIntensity={0.08}
            />
          </mesh>
        );
      })}
      {/* center */}
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshStandardMaterial color={accent} roughness={0.7} />
      </mesh>
    </group>
  );
}
