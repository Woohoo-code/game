import { gameStore } from "../game/state";
import type { LevelUpCelebrationPayload } from "../game/types";
import { useGameStore } from "../game/useGameStore";

export function LevelUpCelebration({ payload }: { payload: LevelUpCelebrationPayload }) {
  const snapshot = useGameStore();
  const { hp, maxHp } = snapshot.player;
  const plural = payload.levelsGained !== 1;

  return (
    <div
      className="level-up-celebration-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-up-title"
    >
      <div className="level-up-celebration-card">
        <p className="level-up-celebration-eyebrow" aria-hidden>
          Level up
        </p>
        <h2 id="level-up-title" className="level-up-celebration-title">
          You reached level {payload.newLevel}
        </h2>
        {plural ? (
          <p className="level-up-celebration-batch">
            {payload.levelsGained} level{plural ? "s" : ""} applied — combined gains:
          </p>
        ) : null}
        <ul className="level-up-celebration-gains" aria-label="Stat increases">
          <li>
            <strong>+{payload.maxHpGained}</strong> max HP
          </li>
          <li>
            <strong>+{payload.attackGained}</strong> attack
          </li>
          <li>
            <strong>+{payload.defenseGained}</strong> defense
          </li>
          <li>
            <strong>+{payload.speedGained}</strong> speed
          </li>
          {payload.skillPointsGained != null && payload.skillPointsGained > 0 ? (
            <li>
              <strong>+{payload.skillPointsGained}</strong> skill point{payload.skillPointsGained === 1 ? "" : "s"} (spend
              in Skills)
            </li>
          ) : null}
        </ul>
        <p className="level-up-celebration-hp-line">
          Current vitality: <strong>{hp}</strong> / <strong>{maxHp}</strong> HP
          {hp < maxHp ? (
            <span className="level-up-celebration-hp-note">Max HP increased — current HP unchanged until you heal.</span>
          ) : null}
        </p>
        <p className="level-up-celebration-sub">Press continue when you are ready.</p>
        <button type="button" className="level-up-celebration-dismiss" onClick={() => gameStore.dismissLevelUpCelebration()}>
          Continue
        </button>
      </div>
    </div>
  );
}
