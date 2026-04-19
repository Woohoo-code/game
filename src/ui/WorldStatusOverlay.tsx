import type { ReactNode } from "react";
import { ARMOR_STATS, WEAPON_STATS, petAttackBuffForParty, stableHorseSpeedBonus } from "../game/data";
import { useGameStore } from "../game/useGameStore";
import type { WeaponKey } from "../game/types";
import { CAMPAIGN_PREMISE, hudCampaignGoal } from "../game/story";
import { TILE, encounterDangerDisplayPercent, townAtTile } from "../game/worldMap";
import { GAME_VERSION_LABEL } from "../version";
import { isNightWilds, nightEncounterRateMultiplier, timeOfDayClock24, timeOfDayLabel } from "../game/worldClock";
import { IconGold } from "./IconGold";

/** HUD sword icon tints — wood earth tones, iron silver, steel blue-steel, mythril arcane teal. */
const WEAPON_HUD_SWORD: Record<
  WeaponKey,
  { blade: string; bladeShade: string; guard: string; grip: string; pommel: string }
> = {
  woodSword: {
    blade: "#d4a574",
    bladeShade: "#8b5a2b",
    guard: "#5c3d24",
    grip: "#4a301c",
    pommel: "#6b4528"
  },
  ironSword: {
    blade: "#e2e6ee",
    bladeShade: "#9aa2ae",
    guard: "#5a5f68",
    grip: "#3a3f48",
    pommel: "#6d737c"
  },
  steelSword: {
    blade: "#b0c4d8",
    bladeShade: "#5f7a94",
    guard: "#3d4f64",
    grip: "#283545",
    pommel: "#4a6278"
  },
  mythrilBlade: {
    blade: "#a8f2ff",
    bladeShade: "#3aa8c4",
    guard: "#3d4e9c",
    grip: "#2a3570",
    pommel: "#5a6ed0"
  }
};

function IconSword({ weapon }: { weapon: WeaponKey }) {
  const c = WEAPON_HUD_SWORD[weapon];
  return (
    <svg className="hud-sword-svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      {/* Blade under crossguard */}
      <path d="M12 1.75 L14.1 12.35 H9.9 Z" fill={c.blade} />
      <path d="M12 3.2 L13.15 12.35 H10.85 Z" fill={c.bladeShade} opacity="0.55" />
      <rect x="5.5" y="12.4" width="13" height="2.4" rx="0.5" fill={c.guard} />
      <rect x="10.25" y="14.8" width="3.5" height="4.8" rx="0.45" fill={c.grip} />
      <circle cx="12" cy="20.6" r="1.85" fill={c.pommel} />
    </svg>
  );
}

/** Attack power (total) — distinct from equipped-weapon icon. */
function IconPower({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2l2.2 6.8H21l-5.5 4 2.1 6.7L12 15.4 6.4 19.5l2.1-6.7L3 8.8h6.8L12 2z"
      />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3zm0 2.18 6 2.25v5.57c0 4.52-3 8.65-6 9.73-3-1.08-6-5.21-6-9.73V6.43l6-2.25z"
      />
    </svg>
  );
}

function IconBolt({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M13 2 3 14h8l-1 8 10-12h-8l1-8z" />
    </svg>
  );
}

function IconTimer({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function HudIconButton({
  className,
  title,
  ariaLabel,
  children
}: {
  className?: string;
  title: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button type="button" className={`hud-icon-btn ${className ?? ""}`} title={title} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

export function WorldStatusOverlay() {
  const snapshot = useGameStore();
  const weaponBonus = WEAPON_STATS[snapshot.player.weapon].attackBonus;
  const armorBonus = ARMOR_STATS[snapshot.player.armor].defenseBonus;
  const petAtk = petAttackBuffForParty(snapshot.player.activePetId, snapshot.player.pets);
  const horseSpd = stableHorseSpeedBonus(snapshot.player.horsesOwned ?? []);
  const speedTotal = snapshot.player.speed + horseSpd;
  const attackPower = snapshot.player.attack + weaponBonus + petAtk;
  const defensePower = snapshot.player.defense + armorBonus;
  const xpPercent = Math.max(0, Math.min(100, Math.round((snapshot.player.xp / snapshot.player.xpToNext) * 100)));
  const playerHpPercent = Math.max(0, Math.min(100, Math.round((snapshot.player.hp / snapshot.player.maxHp) * 100)));
  const dangerPercent = encounterDangerDisplayPercent(snapshot.world.encounterRate);
  const wt = snapshot.world.worldTime ?? 0;
  const tod = timeOfDayLabel(wt);
  const clock24 = timeOfDayClock24(wt);
  const nightWilds = isNightWilds(wt);
  const nightEncounterMult = nightEncounterRateMultiplier(wt);
  const dangerLabel =
    dangerPercent === 0
      ? "Safe"
      : dangerPercent < 25
        ? "Low"
        : dangerPercent < 55
          ? "Medium"
          : dangerPercent < 80
            ? "High"
            : "Perilous";

  const revivalDebt = snapshot.player.revivalDebtMonstersRemaining ?? 0;

  const w = WEAPON_STATS[snapshot.player.weapon];
  const a = ARMOR_STATS[snapshot.player.armor];

  const weaponTitle = [
    w.name,
    `Equipped weapon · +${weaponBonus} attack from gear`,
    ...(petAtk > 0 ? [`Active pet · +${petAtk} attack (max +10)`] : []),
    `Total attack power: ${attackPower} (${snapshot.player.attack} base + ${weaponBonus} weapon${petAtk ? ` + ${petAtk} pet` : ""})`
  ].join("\n");

  const armorTitle = [
    a.name,
    `Equipped armor · +${armorBonus} defense from gear`,
    `Total defense: ${defensePower} (${snapshot.player.defense} base + ${armorBonus} armor)`
  ].join("\n");

  const atkTitle = [
    `Attack power: ${attackPower}`,
    `Base ${snapshot.player.attack} + weapon ${weaponBonus}${petAtk ? ` + pet ${petAtk}` : ""}`,
    `Equipped: ${w.name}`
  ].join("\n");

  const defTitle = [
    `Defense: ${defensePower}`,
    `Base ${snapshot.player.defense} + armor ${armorBonus}`,
    `Equipped: ${a.name}`
  ].join("\n");

  const spdTitle = [
    `Speed: ${speedTotal} in battle`,
    horseSpd > 0
      ? `Base ${snapshot.player.speed} + ${horseSpd} from mounts (max +5)`
      : `Base ${snapshot.player.speed} — buy up to five mounts at stables for +5 max`,
    "Determines turn order in battle."
  ].join("\n");

  const cdTitle = [
    "Skill cooldown (in battle)",
    "After you cast any skill, every skill shares the same lockout. It ticks down by one after each enemy turn; stronger skills apply a longer lockout when cast."
  ].join("\n");

  const goldTitle = [`Gold: ${snapshot.player.gold}`, "Earned from battles and quests. Spend at the general merchant, forge, and other town services."].join("\n");

  const goal = hudCampaignGoal(
    snapshot.story.stage,
    snapshot.story,
    snapshot.player.level,
    snapshot.player.bossDefeated
  );
  const goalTooltip = [goal.tagline, goal.chapterTitle, goal.objective, goal.progress].filter(Boolean).join("\n");

  const tileX = Math.floor(snapshot.player.x / TILE);
  const tileY = Math.floor(snapshot.player.y / TILE);
  const visitingTown = snapshot.world.inTown ? townAtTile(tileX, tileY) : null;

  return (
    <div className="world-status-overlay" aria-label="Status">
      <div className="world-status-overlay-inner">
        <div className="world-status-hero">
          <div className="world-status-hero-name">{snapshot.player.name}</div>
          <div className="world-status-hero-level">Lv {snapshot.player.level}</div>
        </div>
        <h1 className="world-status-title">
          Monster Slayer <span className="world-status-version">{GAME_VERSION_LABEL}</span>
        </h1>
        <p
          className="world-time-chip"
          title={
            nightWilds
              ? "Night — wild encounters are more likely and foes hit harder."
              : "Time passes while you explore the overworld."
          }
        >
          <span className="world-time-label">{tod}</span>
          <span className="world-time-clock" aria-label={`In-game time ${clock24}`}>
            {clock24}
          </span>
          {nightWilds ? <span className="world-time-night"> · Night danger</span> : null}
        </p>
        {visitingTown ? (
          <div className="world-town-visit" role="status">
            <div className="world-town-visit-name">{visitingTown.name}</div>
            <div className="world-town-visit-epithet">{visitingTown.epithet}</div>
          </div>
        ) : null}
        <div
          className={`danger-meter${nightWilds && dangerPercent > 0 ? " danger-meter--night" : ""}`}
          title={
            dangerPercent === 0
              ? "No random encounters on this terrain."
              : nightWilds && dangerPercent > 0
                ? `Wild encounter chance ×${nightEncounterMult.toFixed(2)} at night (vs day on the same terrain).`
                : "Per-step chance of a wild battle while moving on open terrain."
          }
        >
          <div className="danger-meter-head">
            <strong>Danger: {dangerLabel}</strong>
            <span>{dangerPercent}%</span>
          </div>
          {nightWilds && dangerPercent > 0 ? (
            <p className="danger-meter-night-hint" role="status">
              Night — encounters ×{nightEncounterMult.toFixed(1)}
            </p>
          ) : null}
          <div className="danger-meter-track">
            <div className="danger-meter-fill" style={{ width: `${dangerPercent}%` }} />
          </div>
        </div>

        {revivalDebt > 0 ? (
          <div className="world-revival-debt" role="status" title="Clear by winning wild battles — not by fleeing.">
            <strong>Tithe lock</strong>
            <span>
              {revivalDebt} monster{revivalDebt === 1 ? "" : "s"} to slay
            </span>
          </div>
        ) : null}

        <div className="world-goal-panel" role="region" aria-label="Current goal" title={CAMPAIGN_PREMISE}>
          <div className="world-goal-eyebrow">Guild goal</div>
          <p className="world-goal-tagline">{goal.tagline}</p>
          <p className="world-goal-chapter">{goal.chapterTitle}</p>
          <p className="world-goal-objective">{goal.objective}</p>
          {goal.progress ? (
            <p className="world-goal-progress" title={goalTooltip}>
              {goal.progress}
            </p>
          ) : null}
        </div>

        <div className="world-gold-row" role="status" title={goldTitle}>
          <IconGold size={24} className="world-gold-icon" />
          <span className="world-gold-value">{snapshot.player.gold}</span>
        </div>
        <div className="hp-meter">
          <div className="hp-meter-head">
            <strong>HP</strong>
            <span>
              {snapshot.player.hp}/{snapshot.player.maxHp}
            </span>
          </div>
          <div className="hp-meter-track">
            <div className="hp-meter-fill" style={{ width: `${playerHpPercent}%` }} />
          </div>
        </div>
        <div className="xp-meter">
          <div className="xp-meter-head">
            <strong>XP</strong>
            <span>
              {snapshot.player.xp}/{snapshot.player.xpToNext}
            </span>
          </div>
          <div className="xp-meter-track">
            <div className="xp-meter-fill" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>

        <div className="world-hud-gear-stats">
          <div className="world-hud-gear-col">
            <div className="world-hud-section-label">Equipment</div>
            <div className="world-hud-icon-row" role="group" aria-label="Equipment">
              <HudIconButton
                className="hud-equip-weapon"
                ariaLabel={`Equipped weapon: ${w.name}`}
                title={weaponTitle}
              >
                <IconSword weapon={snapshot.player.weapon} />
              </HudIconButton>
              <HudIconButton className="hud-equip-armor" ariaLabel={`Equipped armor: ${a.name}`} title={armorTitle}>
                <IconShield />
              </HudIconButton>
            </div>
            <p className="world-hud-consumable-hint">
              Items vs gear: buy consumables and maps at the <strong>general merchant</strong>; weapons, armor, and buyback at
              the <strong>forge</strong>. Hotbar 1–9 / 0, backpack, or <strong>Inventory</strong> (<kbd>I</kbd>) for the full list.
            </p>
          </div>

          <div className="world-hud-gear-col">
            <div className="world-hud-section-label">Stats</div>
            <div className="world-hud-icon-row" role="group" aria-label="Combat stats">
              <HudIconButton className="hud-stat-atk" ariaLabel={`Attack power ${attackPower}`} title={atkTitle}>
                <IconPower />
              </HudIconButton>
              <HudIconButton className="hud-stat-def" ariaLabel={`Defense ${defensePower}`} title={defTitle}>
                <IconShield />
              </HudIconButton>
              <HudIconButton className="hud-stat-spd" ariaLabel={`Speed ${speedTotal}`} title={spdTitle}>
                <IconBolt />
              </HudIconButton>
              <HudIconButton
                className="hud-stat-cd"
                ariaLabel="Skill cooldown (shared across all skills, in battle)"
                title={cdTitle}
              >
                <IconTimer />
              </HudIconButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
