import { useState } from "react";
import { flushSync } from "react-dom";
import { CharacterPreview } from "../game3d/CharacterPreview";
import { MobileFullscreenButton } from "./MobileFullscreenButton";
import { gameStore, defaultAppearance } from "../game/state";
import { useGameStore } from "../game/useGameStore";
import {
  FACIAL_HAIR_LABELS,
  FACIAL_HAIR_ORDER,
  FIGHTING_CLASS_LABELS,
  FIGHTING_CLASS_ORDER,
  HAIR_STYLE_LABELS,
  HAIR_STYLE_ORDER,
  normalizeFacialHair,
  normalizeFightingClass,
  normalizeHairStyle,
  type FightingClass,
  type PlayerAppearance
} from "../game/types";

const SKIN_PRESETS = ["#f6dbbf", "#f1c9a5", "#d9a07a", "#b07550", "#8a5a3a", "#5c3b25", "#3a2418"];
const HAIR_PRESETS = ["#141414", "#3b2b21", "#6b4b2a", "#a8743d", "#d5c07a", "#e7e2d6", "#c4453b", "#7a4de6", "#3fa8ff"];
const OUTFIT_PRESETS = ["#3564c3", "#c3353d", "#2e8c5a", "#6a2fa3", "#d48a1f", "#1d9aa8", "#2c2f37", "#d4d6db"];
const PANTS_PRESETS = ["#2a3550", "#3c2a1f", "#1c1f25", "#4a3e68", "#2f5030", "#6a5a36"];

const HAIR_STYLES = HAIR_STYLE_ORDER.map((id) => ({ id, label: HAIR_STYLE_LABELS[id] }));

const FACIAL_STYLES = FACIAL_HAIR_ORDER.map((id) => ({ id, label: FACIAL_HAIR_LABELS[id] }));

const CLASS_HINT: Record<FightingClass, string> = {
  knight: "+2 Attack — steady melee pressure.",
  wizard: "+15% skill damage — more tree points per level.",
  thief: "+2 Speed, +15% wild gold — slip past danger."
};

function Swatch({
  color,
  active,
  onSelect,
  ariaLabel
}: {
  color: string;
  active: boolean;
  onSelect: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`swatch${active ? " active" : ""}`}
      style={{ background: color }}
      onClick={onSelect}
    />
  );
}

export function CharacterCreation({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const snapshot = useGameStore();
  const [name, setName] = useState(() =>
    snapshot.player.hasCreatedCharacter ? snapshot.player.name : ""
  );
  const [fightingClass, setFightingClass] = useState<FightingClass>(() =>
    snapshot.player.hasCreatedCharacter ? normalizeFightingClass(snapshot.player.fightingClass) : "knight"
  );
  const [appearance, setAppearance] = useState<PlayerAppearance>(() => {
    const base = defaultAppearance();
    const a = snapshot.player.appearance;
    if (!a) return base;
    return {
      ...base,
      ...a,
      hairStyle: normalizeHairStyle(a.hairStyle),
      facialHair: normalizeFacialHair(a.facialHair),
      beardColor: a.beardColor || a.hair || base.beardColor
    };
  });

  const update = (patch: Partial<PlayerAppearance>) => {
    setAppearance((a) => ({ ...a, ...patch }));
  };

  const randomize = () => {
    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
    setAppearance({
      skin: pick(SKIN_PRESETS),
      hair: pick(HAIR_PRESETS),
      hairStyle: pick(HAIR_STYLES).id,
      facialHair: pick(FACIAL_HAIR_ORDER),
      beardColor: pick(HAIR_PRESETS),
      outfit: pick(OUTFIT_PRESETS),
      pants: pick(PANTS_PRESETS)
    });
  };

  const submit = () => {
    // Flush the screen transition synchronously before emitting the store change.
    // Without this, useSyncExternalStore fires a synchronous re-render from
    // createCharacter() while screen is still "create", causing a one-frame
    // flash of the creation form with disabled class buttons before the
    // play screen appears.
    flushSync(() => onDone());
    gameStore.createCharacter(name || "Hero", appearance, fightingClass);
  };

  return (
    <div className="character-create" role="document" aria-label="Sign up — create your hero">
      <div className="character-create-inner">
        <header className="character-create-header">
          <div className="character-create-header-actions">
            <MobileFullscreenButton />
          </div>
          <p className="character-create-eyebrow">Sign up</p>
          <h1>Create your hero</h1>
          <p>Pick a name and look. Progress is saved in this browser when you use Save in town.</p>
        </header>

        <div className="character-create-body">
          <div className="character-create-preview">
            <CharacterPreview appearance={appearance} />
            <div className="character-create-namepill">{(name || "Hero").trim()}</div>
          </div>

          <form
            className="character-create-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="form-row">
              <span>Name</span>
              <input
                type="text"
                value={name}
                maxLength={18}
                placeholder="Hero"
                autoComplete="username"
                autoCapitalize="words"
                enterKeyHint="done"
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
            </label>

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

            <div className="form-row">
              <span>Skin</span>
              <div className="swatch-row">
                {SKIN_PRESETS.map((c) => (
                  <Swatch
                    key={c}
                    color={c}
                    active={appearance.skin === c}
                    ariaLabel={`Skin ${c}`}
                    onSelect={() => update({ skin: c })}
                  />
                ))}
                <input
                  type="color"
                  value={appearance.skin}
                  onChange={(e) => update({ skin: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <span>Hair color</span>
              <div className="swatch-row">
                {HAIR_PRESETS.map((c) => (
                  <Swatch
                    key={c}
                    color={c}
                    active={appearance.hair === c}
                    ariaLabel={`Hair ${c}`}
                    onSelect={() => update({ hair: c })}
                  />
                ))}
                <input
                  type="color"
                  value={appearance.hair}
                  onChange={(e) => update({ hair: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <span>Hair style</span>
              <div className="pill-row">
                {HAIR_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    className={`pill${appearance.hairStyle === style.id ? " active" : ""}`}
                    onClick={() => update({ hairStyle: style.id })}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <span>Facial hair</span>
              <div className="pill-row">
                {FACIAL_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    className={`pill${appearance.facialHair === style.id ? " active" : ""}`}
                    onClick={() => update({ facialHair: style.id })}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <span>Beard color</span>
              <div className="swatch-row">
                {HAIR_PRESETS.map((c) => (
                  <Swatch
                    key={c}
                    color={c}
                    active={appearance.beardColor === c}
                    ariaLabel={`Beard ${c}`}
                    onSelect={() => update({ beardColor: c })}
                  />
                ))}
                <input
                  type="color"
                  value={appearance.beardColor}
                  onChange={(e) => update({ beardColor: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <span>Outfit</span>
              <div className="swatch-row">
                {OUTFIT_PRESETS.map((c) => (
                  <Swatch
                    key={c}
                    color={c}
                    active={appearance.outfit === c}
                    ariaLabel={`Outfit ${c}`}
                    onSelect={() => update({ outfit: c })}
                  />
                ))}
                <input
                  type="color"
                  value={appearance.outfit}
                  onChange={(e) => update({ outfit: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <span>Pants</span>
              <div className="swatch-row">
                {PANTS_PRESETS.map((c) => (
                  <Swatch
                    key={c}
                    color={c}
                    active={appearance.pants === c}
                    ariaLabel={`Pants ${c}`}
                    onSelect={() => update({ pants: c })}
                  />
                ))}
                <input
                  type="color"
                  value={appearance.pants}
                  onChange={(e) => update({ pants: e.target.value })}
                />
              </div>
            </div>

            <div className="character-create-actions">
              <button type="button" className="secondary" onClick={onBack}>
                Back to log in
              </button>
              <button type="button" className="secondary" onClick={randomize}>
                Randomize
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
