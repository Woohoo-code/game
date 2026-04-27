import { useGameStore } from "../game/useGameStore";
import { FIGHTING_CLASS_LABELS, normalizeFightingClass } from "../game/types";
import { CAMPAIGN_PREMISE, hudCampaignGoal } from "../game/story";
import type { TerrainKind } from "../game/worldMap";
import {
  TILE,
  biomeAt,
  biomeDisplayName,
  encounterDangerDisplayPercent,
  terrainAt,
  townAtTile,
} from "../game/worldMap";
import { GAME_VERSION_LABEL } from "../version";
import { isNightWilds, nightEncounterRateMultiplier, timeOfDayClock24, timeOfDayLabel } from "../game/worldClock";
import { IconGold } from "./IconGold";

/** Short terrain names for the danger HUD (road reads as “Path”). */
const TERRAIN_HUD: Record<TerrainKind, string> = {
  grass: "Grass",
  road: "Path",
  water: "Water",
  forest: "Forest",
  hill: "Hills",
  town: "Town",
};

export function WorldStatusOverlay() {
  const snapshot = useGameStore();
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
  const realmTier = Math.max(1, Math.floor(snapshot.world.realmTier ?? 1));
  const standingTileLabel = snapshot.world.inDungeon
    ? snapshot.world.dungeon?.kind === "throneHall"
      ? "Throne hall"
      : "Crypt"
    : `${TERRAIN_HUD[terrainAt(tileX, tileY)]} · ${biomeDisplayName(biomeAt(tileX, tileY), realmTier)}`;
  const visitingTown = snapshot.world.inTown ? townAtTile(tileX, tileY) : null;

  return (
    <div className="world-status-overlay" aria-label="Status">
      <div className="world-status-overlay-inner">
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
        <div className="world-status-hero">
          <div className="world-status-hero-name" title={snapshot.player.name}>
            {snapshot.player.name}
          </div>
          <div className="world-status-hero-meta">
            <span className="world-status-hero-level">Lv {snapshot.player.level}</span>
            <span className="world-status-hero-class" title="Fighting class and unspent skill points">
              {FIGHTING_CLASS_LABELS[normalizeFightingClass(snapshot.player.fightingClass)]} ·{" "}
              {snapshot.player.skillPoints ?? 0} skill pt
            </span>
          </div>
        </div>
        {visitingTown ? (
          <div className="world-town-visit" role="status">
            <div className="world-town-visit-name">{visitingTown.name}</div>
            <div className="world-town-visit-epithet">{visitingTown.epithet}</div>
          </div>
        ) : null}
        <div
          className={`danger-meter${nightWilds && dangerPercent > 0 ? " danger-meter--night" : ""}`}
          title={[
            dangerPercent === 0
              ? "No random encounters on this terrain."
              : nightWilds && dangerPercent > 0
                ? `Wild encounter chance ×${nightEncounterMult.toFixed(2)} at night (vs day on the same terrain).`
                : "Per-step chance of a wild battle while moving on open terrain.",
            `Standing on: ${standingTileLabel}.`,
          ].join(" ")}
        >
          <div className="danger-meter-head">
            <strong>
              Danger: {dangerLabel} ({standingTileLabel})
            </strong>
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
      </div>
    </div>
  );
}
