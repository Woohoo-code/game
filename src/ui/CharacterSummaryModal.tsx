import {
  ARMOR_STATS,
  WEAPON_STATS,
  overworldHorseWalkSpeedMultiplier,
  petAttackBuffForParty,
  stableHorseSpeedBonus
} from "../game/data";
import { useGameStore } from "../game/useGameStore";

export function CharacterSummaryModal({ onClose }: { onClose: () => void }) {
  const snapshot = useGameStore();
  const weapon = WEAPON_STATS[snapshot.player.weapon];
  const armor = ARMOR_STATS[snapshot.player.armor];
  const weaponBonus = weapon.attackBonus;
  const armorBonus = armor.defenseBonus;
  const petAtk = petAttackBuffForParty(snapshot.player.activePetId, snapshot.player.pets);
  const attackPower = snapshot.player.attack + weaponBonus + petAtk;
  const defensePower = snapshot.player.defense + armorBonus;
  const horseCount = stableHorseSpeedBonus(snapshot.player.horsesOwned ?? []);
  const walkPct = Math.round((overworldHorseWalkSpeedMultiplier(snapshot.player.horsesOwned ?? []) - 1) * 100);
  const battleSpeed = snapshot.player.speed;

  return (
    <div className="story-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="playfield-help-modal character-summary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-summary-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="playfield-help-modal-head">
          <h2 id="character-summary-title">Character</h2>
          <button
            type="button"
            className="playfield-help-modal-close"
            onClick={onClose}
            aria-label="Close character summary"
          >
            ×
          </button>
        </div>
        <div className="playfield-help-modal-body character-summary-body">
          <div className="character-summary-grid">
            <section className="character-summary-card">
              <h3>Equipment</h3>
              <p>
                <strong>Weapon:</strong> {weapon.name}
              </p>
              <p className="character-summary-sub">+{weaponBonus} attack from gear</p>
              <p>
                <strong>Armor:</strong> {armor.name}
              </p>
              <p className="character-summary-sub">+{armorBonus} defense from gear</p>
            </section>
            <section className="character-summary-card">
              <h3>Core stats</h3>
              <p>
                <strong>Attack:</strong> {attackPower}
              </p>
              <p className="character-summary-sub">
                {snapshot.player.attack} base + {weaponBonus} weapon
                {petAtk > 0 ? ` + ${petAtk} pet` : ""}
              </p>
              <p>
                <strong>Defense:</strong> {defensePower}
              </p>
              <p className="character-summary-sub">{snapshot.player.defense} base + {armorBonus} armor</p>
              <p>
                <strong>Battle speed:</strong> {battleSpeed}
              </p>
            </section>
          </div>
          <section className="character-summary-card">
            <h3>Overworld movement</h3>
            <p>
              <strong>Mount bonus:</strong> +{walkPct}%
            </p>
            <p className="character-summary-sub">
              {horseCount}/5 horses owned. Mounts only affect overworld movement speed.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
