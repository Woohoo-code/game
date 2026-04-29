import { useState } from "react";
import { flushSync } from "react-dom";
import { MobileFullscreenButton } from "./MobileFullscreenButton";
import { gameStore, defaultAppearance } from "../game/state";
import { useGameStore } from "../game/useGameStore";
import {
  FIGHTING_CLASS_LABELS,
  FIGHTING_CLASS_ORDER,
  normalizeFightingClass,
  type FightingClass
} from "../game/types";

const CLASS_HINT: Record<FightingClass, string> = {
  knight: "+2 Attack — steady melee pressure.",
  wizard: "+15% skill damage — more tree points per level.",
  thief: "+2 Speed, +15% wild gold — slip past danger."
};

export function CharacterCreation({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const snapshot = useGameStore();
  const [fightingClass, setFightingClass] = useState<FightingClass>(() =>
    snapshot.player.hasCreatedCharacter ? normalizeFightingClass(snapshot.player.fightingClass) : "knight"
  );

  const submit = () => {
    // Flush the screen transition synchronously before emitting the store change.
    flushSync(() => onDone());
    gameStore.createCharacter("Hero", defaultAppearance(), fightingClass);
  };

  return (
    <div className="character-create" role="document" aria-label="Choose your class">
      <div className="character-create-inner">
        <header className="character-create-header">
          <div className="character-create-header-actions">
            <MobileFullscreenButton />
          </div>
          <p className="character-create-eyebrow">Sign up</p>
          <h1>Choose your class</h1>
          <p>Pick a class to begin your adventure. Progress is saved in this browser when you use Save in town.</p>
        </header>

        <div className="character-create-body">
          <form
            className="character-create-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="form-row">
              <span>Fighting class</span>
              <div className="pill-row character-class-row">
                {FIGHTING_CLASS_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`pill${fightingClass === id ? " active" : ""}`}
                    disabled={snapshot.player.hasCreatedCharacter}
                    title={snapshot.player.hasCreatedCharacter ? "Class is set for this hero." : CLASS_HINT[id]}
                    onClick={() => setFightingClass(id)}
                  >
                    {FIGHTING_CLASS_LABELS[id]}
                  </button>
                ))}
              </div>
              <p className="character-class-hint">{CLASS_HINT[fightingClass]}</p>
            </div>

            <div className="character-create-actions">
              <button type="button" className="secondary" onClick={onBack}>
                Back to log in
              </button>
              <button type="submit" className="primary">
                Start adventure
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
