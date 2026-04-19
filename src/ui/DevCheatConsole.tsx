import { useState } from "react";
import { DEV_CHEAT_PLAYER_NAME, gameStore } from "../game/state";
import { useGameStore } from "../game/useGameStore";

function grantNextLevelXp(): void {
  const p = gameStore.getSnapshot().player;
  gameStore.devCheatAddXp(Math.max(1, p.xpToNext - p.xp));
}

export function DevCheatConsole() {
  const snapshot = useGameStore();
  const [open, setOpen] = useState(false);

  if (!snapshot.player.hasCreatedCharacter || snapshot.player.name !== DEV_CHEAT_PLAYER_NAME) {
    return null;
  }

  const p = snapshot.player;

  return (
    <div className="dev-cheat-console">
      <button type="button" className="dev-cheat-console-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "▼" : "▶"} Debug stats
      </button>
      {open && (
        <div className="dev-cheat-console-body">
          <p className="dev-cheat-console-readout">
            Lv {p.level} · HP {p.hp}/{p.maxHp} · ATK {p.attack} · DEF {p.defense} · SPD {p.speed} · {p.gold}g · XP{" "}
            {p.xp}/{p.xpToNext}
          </p>
          <div className="dev-cheat-console-actions">
            <button type="button" onClick={() => gameStore.devCheatAddCombatStat("attack")}>
              +1 ATK
            </button>
            <button type="button" onClick={() => gameStore.devCheatAddCombatStat("defense")}>
              +1 DEF
            </button>
            <button type="button" onClick={() => gameStore.devCheatAddCombatStat("speed")}>
              +1 SPD
            </button>
            <button type="button" onClick={() => gameStore.devCheatAddMaxHp(10)}>
              +10 max HP
            </button>
            <button type="button" onClick={() => gameStore.devCheatFullHeal()}>
              Full heal
            </button>
            <button type="button" onClick={() => gameStore.devCheatAddGold(100)}>
              +100 gold
            </button>
            <button type="button" onClick={() => gameStore.devCheatAddXp(50)}>
              +50 XP
            </button>
            <button type="button" onClick={grantNextLevelXp}>
              Level +1
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
