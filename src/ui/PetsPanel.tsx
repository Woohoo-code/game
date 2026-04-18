import { useState } from "react";
import { gameStore } from "../game/state";
import type { Pet } from "../game/types";
import { useGameStore } from "../game/useGameStore";
import { MonsterPreview3D } from "../game3d/MonsterPreview3D";

/**
 * Collection + management modal for tamed pet companions.
 *
 * The player can see every pet they have befriended, rename them, switch the
 * active companion (the one that follows them around and assists in battle),
 * or release a pet back to the wild.
 */
export function PetsPanel({ onClose }: { onClose: () => void }) {
  const snapshot = useGameStore();
  const pets = snapshot.player.pets ?? [];
  const activeId = snapshot.player.activePetId;
  const [selectedId, setSelectedId] = useState<string | null>(activeId ?? pets[0]?.id ?? null);
  const [nameDraft, setNameDraft] = useState("");

  const selected: Pet | null = pets.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="story-modal-backdrop" onClick={onClose}>
      <div
        className="pets-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Pets"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pets-panel-head">
          <h2>Pets</h2>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {pets.length === 0 ? (
          <div className="pets-empty">
            <p>
              You have not tamed any monsters yet. Defeat wild enemies in the field —
              some will befriend you after being bested.
            </p>
          </div>
        ) : (
          <div className="pets-panel-grid">
            <div className="pets-panel-list">
              <p className="pets-list-hint">
                Collection: {pets.length} / 12 · Active pet joins you in the overworld
                and strikes after your basic attacks in battle.
              </p>
              <ul className="pets-list">
                {pets.map((pet) => (
                  <li
                    key={pet.id}
                    className={[
                      "pets-list-item",
                      pet.id === selectedId ? "selected" : "",
                      pet.id === activeId ? "active" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <button
                      type="button"
                      className="pets-list-btn"
                      onClick={() => {
                        setSelectedId(pet.id);
                        setNameDraft("");
                      }}
                    >
                      <span
                        className="pets-swatch"
                        style={{
                          background: `linear-gradient(135deg, ${pet.colorPrimary}, ${pet.colorAccent})`
                        }}
                        aria-hidden
                      />
                      <span className="pets-list-info">
                        <strong>{pet.name}</strong>
                        <span className="pets-list-sub">
                          Lv {pet.level} · +{pet.attackBonus} ATK
                          {pet.id === activeId ? " · Active" : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pets-panel-detail">
              {selected ? (
                <>
                  <div className="pets-preview">
                    <MonsterPreview3D
                      shape={selected.bodyShape}
                      primary={selected.colorPrimary}
                      accent={selected.colorAccent}
                    />
                  </div>
                  <h3 className="pets-detail-name">{selected.name}</h3>
                  <p className="pets-detail-meta">
                    Species: {selected.speciesName}
                    <br />
                    Level {selected.level} · +{selected.attackBonus} attack follow-up
                  </p>

                  <div className="pets-detail-row">
                    <input
                      type="text"
                      placeholder="Rename…"
                      value={nameDraft}
                      maxLength={18}
                      onChange={(e) => setNameDraft(e.target.value)}
                    />
                    <button
                      type="button"
                      className="secondary"
                      disabled={nameDraft.trim().length === 0}
                      onClick={() => {
                        gameStore.renamePet(selected.id, nameDraft);
                        setNameDraft("");
                      }}
                    >
                      Rename
                    </button>
                  </div>

                  <div className="pets-detail-actions">
                    {selected.id === activeId ? (
                      <button type="button" onClick={() => gameStore.setActivePet(null)}>
                        Send to rest
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary"
                        onClick={() => gameStore.setActivePet(selected.id)}
                      >
                        Set active
                      </button>
                    )}
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        if (!window.confirm(`Release ${selected.name} back into the wild?`)) return;
                        gameStore.releasePet(selected.id);
                        setSelectedId(null);
                      }}
                    >
                      Release
                    </button>
                  </div>
                </>
              ) : (
                <p className="pets-detail-empty">Select a pet to inspect them.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
