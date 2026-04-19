/**
 * Shared day / night phase for the overworld (0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk).
 * `worldTime` is unbounded; always reduce with {@link fractDay} for cycles.
 */

/** Real seconds for one full in-game day at 1 Hz {@link WORLD_CLOCK_TICK_FRACTION} ticks (default 6 min). */
export const WORLD_CLOCK_SECONDS_PER_DAY = 360;

/** Call once per second: `gameStore.tickWorldClock(WORLD_CLOCK_TICK_FRACTION)`. */
export const WORLD_CLOCK_TICK_FRACTION = 1 / WORLD_CLOCK_SECONDS_PER_DAY;

export function fractDay(t: number): number {
  if (!Number.isFinite(t)) return 0;
  return ((t % 1) + 1) % 1;
}

/** 0 = deep night, 1 = bright day — smooth cosine curve. */
export function sunHeight01(worldTime: number): number {
  const u = fractDay(worldTime);
  return 0.5 + 0.5 * Math.cos((u - 0.25) * Math.PI * 2);
}

/** 0 = full day visuals, 1 = full night. */
export function nightVisualBlend(worldTime: number): number {
  const s = sunHeight01(worldTime);
  return Math.min(1, Math.max(0, 1 - s * 1.15));
}

/** True when wilds are considered “night” for encounter + enemy buffs. */
export function isNightWilds(worldTime: number): boolean {
  return sunHeight01(worldTime) < 0.38;
}

/** Multiplies per-step encounter rate (still clamped globally). Stronger at deeper night. */
export function nightEncounterRateMultiplier(worldTime: number): number {
  if (!isNightWilds(worldTime)) return 1;
  const s = sunHeight01(worldTime);
  const depth = Math.min(1, (0.38 - s) / 0.38);
  return 1 + 0.82 * depth;
}

/** Applied to rolled enemy HP/ATK/DEF/SPD after level scaling. */
export function nightEnemyStatMultiplier(worldTime: number): number {
  if (!isNightWilds(worldTime)) return 1;
  const s = sunHeight01(worldTime);
  const depth = Math.min(1, (0.38 - s) / 0.38);
  return 1 + 0.14 * depth;
}

/** In-game 24h clock string like "14:37" derived from `worldTime` (0 = midnight). */
export function timeOfDayClock24(worldTime: number): string {
  const u = fractDay(worldTime);
  const totalMinutes = Math.floor(u * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const hh = hours < 10 ? `0${hours}` : `${hours}`;
  const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hh}:${mm}`;
}

export function timeOfDayLabel(worldTime: number): string {
  const u = fractDay(worldTime);
  if (u < 0.07) return "Midnight";
  if (u < 0.14) return "Night";
  if (u < 0.22) return "Dawn";
  if (u < 0.36) return "Morning";
  if (u < 0.52) return "Day";
  if (u < 0.62) return "Afternoon";
  if (u < 0.72) return "Dusk";
  if (u < 0.82) return "Nightfall";
  return "Night";
}
