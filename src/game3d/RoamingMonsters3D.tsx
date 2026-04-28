import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ENEMIES } from "../game/data";
import { gameStore } from "../game/state";
import type { EnemyState, RoamingMonster } from "../game/types";
import { useGameStoreSelector } from "../game/useGameStore";
import { MAP_H, MAP_W, TILE, isBlocked, isTownTile } from "../game/worldMap";
import { MonsterModel } from "./MonsterModels";

const HALF_TILE = 0.5;
/** Chebyshev distance on floored tile coords: max(|Δtx|,|Δty|) ≤ this → chase. */
const ROAMER_AGGRO_CHEBYSHEV = 2;
const ROAMER_CHASE_TILES_PER_SEC = 2.6;
const ROAMER_WANDER_TILES_PER_SEC = 0.4;
const ROAMER_WANDER_AMP = 0.52;
const ROAMER_TOUCH_DIST_TILES = 0.44;

function enemyStateForRoamer(row: RoamingMonster): EnemyState | null {
  const def = ENEMIES.find((e) => e.id === row.enemyId);
  if (!def) return null;
  return {
    ...def,
    hp: def.maxHp
  };
}

function hashUint(id: string, salt: number): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h + Math.imul(salt, 2654435761)) >>> 0;
}

function microOffset(id: string, salt: number): number {
  const u = (hashUint(id, salt) & 0xffff) / 0xffff;
  return (u - 0.5) * 0.2;
}

function phaseSeed(id: string, salt: number): number {
  return (hashUint(id, salt) % 628318) / 100000 * Math.PI * 2;
}

function resetRoamerPos(
  id: string,
  tx: number,
  ty: number,
  out: THREE.Vector2,
  wanderPhase: { current: number },
  ph0: number
): void {
  out.set(tx + 0.5 + microOffset(id, 11), ty + 0.5 + microOffset(id, 12));
  wanderPhase.current = phaseSeed(id, 0) + ph0 * 0.1;
}

function trySlideMove(pos: THREE.Vector2, nx: number, nz: number): void {
  const cx = THREE.MathUtils.clamp(nx, HALF_TILE, MAP_W - HALF_TILE);
  const cz = THREE.MathUtils.clamp(nz, HALF_TILE, MAP_H - HALF_TILE);
  if (!isBlocked(cx * TILE, cz * TILE)) {
    pos.set(cx, cz);
    return;
  }
  const cx0 = THREE.MathUtils.clamp(nx, HALF_TILE, MAP_W - HALF_TILE);
  if (!isBlocked(cx0 * TILE, pos.y * TILE)) {
    pos.x = cx0;
    return;
  }
  const cz0 = THREE.MathUtils.clamp(nz, HALF_TILE, MAP_H - HALF_TILE);
  if (!isBlocked(pos.x * TILE, cz0 * TILE)) {
    pos.y = cz0;
  }
}

function RoamerMob3D({ row, worldVersion }: { row: RoamingMonster; worldVersion: number }) {
  const groupRef = useRef<THREE.Group>(null);
  /** x,z in tile space (Vector2.y holds z). */
  const pos = useRef(new THREE.Vector2(row.tx + 0.5, row.ty + 0.5));
  const wanderPhase = useRef(0);
  const ph0 = useMemo(() => phaseSeed(row.id, 1), [row.id]);
  const ph1 = useMemo(() => phaseSeed(row.id, 2), [row.id]);
  /** Cached snapshot ref — updated via subscription, never read inside useFrame via function call. */
  const snapRef = useRef(gameStore.getSnapshot());
  useEffect(() => gameStore.subscribe(() => { snapRef.current = gameStore.getSnapshot(); }), []);

  useEffect(() => {
    resetRoamerPos(row.id, row.tx, row.ty, pos.current, wanderPhase, ph0);
    groupRef.current?.position.set(pos.current.x, 0, pos.current.y);
  }, [row.id, row.tx, row.ty, worldVersion, ph0]);

  useFrame((_, delta) => {
    const snap = snapRef.current;
    if (snap.battle.inBattle) return;

    const pTx = snap.player.x / TILE;
    const pTz = snap.player.y / TILE;
    const mx = pos.current.x;
    const mz = pos.current.y;

    // Safe-zone break: once the player steps onto a town tile the roamer
    // abandons the pursuit AND can't trigger a touch-engage. The monster
    // falls back to wandering around its anchor until the player leaves.
    const playerSafe = isTownTile(Math.floor(pTx), Math.floor(pTz));

    if (!playerSafe && Math.hypot(pTx - mx, pTz - mz) < ROAMER_TOUCH_DIST_TILES) {
      gameStore.tryEngageRoamerById(row.id);
      return;
    }

    const tileCheb = Math.max(
      Math.abs(Math.floor(pTx) - Math.floor(mx)),
      Math.abs(Math.floor(pTz) - Math.floor(mz))
    );
    const inAggro = !playerSafe && tileCheb <= ROAMER_AGGRO_CHEBYSHEV;

    let nx = mx;
    let nz = mz;

    if (inAggro) {
      const len = Math.hypot(pTx - mx, pTz - mz) || 1;
      const step = ROAMER_CHASE_TILES_PER_SEC * delta;
      nx = mx + ((pTx - mx) / len) * step;
      nz = mz + ((pTz - mz) / len) * step;
    } else {
      const ax = row.tx + 0.5;
      const az = row.ty + 0.5;
      wanderPhase.current += delta * 0.62;
      const tx = ax + Math.sin(wanderPhase.current + ph0) * ROAMER_WANDER_AMP;
      const tz = az + Math.cos(wanderPhase.current * 1.03 + ph1) * ROAMER_WANDER_AMP;
      const dx = tx - mx;
      const dz = tz - mz;
      const dlen = Math.hypot(dx, dz) || 1;
      const wstep = Math.min(ROAMER_WANDER_TILES_PER_SEC * delta, dlen);
      nx = mx + (dx / dlen) * wstep;
      nz = mz + (dz / dlen) * wstep;
    }

    trySlideMove(pos.current, nx, nz);

    const g = groupRef.current;
    if (g) {
      g.position.set(pos.current.x, 0, pos.current.y);
    }
  });

  const enemy = enemyStateForRoamer(row);
  if (!enemy) return null;

  return (
    <group ref={groupRef} scale={0.44}>
      <MonsterModel enemy={enemy} />
    </group>
  );
}

/** Visible overworld foes (random-encounter species stay hidden until a fight rolls). */
export function RoamingMonsters3D() {
  const { roamingMonsters, worldVersion, inBattle } = useGameStoreSelector(
    (s) => ({
      roamingMonsters: s.world.roamingMonsters,
      worldVersion: s.world.worldVersion,
      inBattle: s.battle.inBattle,
    })
  );
  const rows = roamingMonsters ?? [];
  if (inBattle || rows.length === 0) return null;

  return (
    <group name="roaming-monsters">
      {rows.map((row) => {
        if (row.tx < 0 || row.ty < 0 || row.tx >= MAP_W || row.ty >= MAP_H) return null;
        return <RoamerMob3D key={row.id} row={row} worldVersion={worldVersion} />;
      })}
    </group>
  );
}
