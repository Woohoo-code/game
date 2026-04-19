import { ENEMIES } from "../game/data";
import { MAP_H, MAP_W } from "../game/worldMap";
import type { EnemyState, RoamingMonster } from "../game/types";
import { useGameStore } from "../game/useGameStore";
import { MonsterModel } from "./MonsterModels";

function enemyStateForRoamer(row: RoamingMonster): EnemyState | null {
  const def = ENEMIES.find((e) => e.id === row.enemyId);
  if (!def) return null;
  return {
    ...def,
    hp: def.maxHp
  };
}

/** Visible overworld foes (random-encounter species stay hidden until a fight rolls). */
export function RoamingMonsters3D() {
  const snapshot = useGameStore();
  const rows = snapshot.world.roamingMonsters ?? [];
  if (snapshot.battle.inBattle || rows.length === 0) return null;

  return (
    <group name="roaming-monsters">
      {rows.map((row) => {
        const enemy = enemyStateForRoamer(row);
        if (!enemy) return null;
        if (row.tx < 0 || row.ty < 0 || row.tx >= MAP_W || row.ty >= MAP_H) return null;
        return (
          <group key={row.id} position={[row.tx + 0.5, 0, row.ty + 0.5]} scale={0.44}>
            <MonsterModel enemy={enemy} />
          </group>
        );
      })}
    </group>
  );
}
