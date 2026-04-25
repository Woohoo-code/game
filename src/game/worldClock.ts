/**
 * Shared day / night for the overworld. `fractDay(t)` = 0 at midnight, 0.5 at noon.
 * Schedule (24h): **dusk** 17:00–19:00, **night** 19:00–07:00 (combat/encounter night).
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

/** Sun direction (unit, Y-up) for a given in-game time — same phase as {@link sunHeight01}. */
export function sunDirectionUnit(worldTime: number): { x: number; y: number; z: number } {
  const u = fractDay(worldTime);
  const sunH = sunHeight01(worldTime);
  const ang = (u - 0.25) * Math.PI * 2;
  const minElev = 0.1;
  const maxElev = Math.PI / 2.08;
  const elev = minElev + sunH * (maxElev - minElev);
  const ch = Math.cos(elev);
  const x = ch * Math.sin(ang);
  const y = Math.sin(elev);
  const z = ch * Math.cos(ang);
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

/** Positions for a directional light + target so cast shadows match time of day (map XZ, Y-up). */
export function sunShadowLightForMap(
  worldTime: number,
  mapW: number,
  mapH: number,
): { pos: [number, number, number]; target: [number, number, number] } {
  const dir = sunDirectionUnit(worldTime);
  const dist = Math.max(mapW, mapH) * 2.55;
  const cx = mapW / 2;
  const cz = mapH / 2;
  const pos: [number, number, number] = [
    cx + dir.x * dist,
    Math.max(22, dir.y * dist),
    cz + dir.z * dist,
  ];
  return { pos, target: [cx, 0, cz] };
}

const FRAC_7AM = 7 / 24;
const FRAC_5PM = 17 / 24;
const FRAC_7PM = 19 / 24;

/** 0 = full day visuals, 1 = full night. */
export function nightVisualBlend(worldTime: number): number {
  const u = fractDay(worldTime);
  if (u >= FRAC_7PM || u < FRAC_7AM) {
    const s = sunHeight01(worldTime);
    return Math.min(1, Math.max(0.55, 1 - s * 0.95));
  }
  if (u >= FRAC_5PM && u < FRAC_7PM) {
    const t = (u - FRAC_5PM) / (FRAC_7PM - FRAC_5PM);
    return 0.22 + t * 0.48;
  }
  const s = sunHeight01(worldTime);
  return Math.min(1, Math.max(0, 1 - s * 1.12));
}

/** True when wilds are “night” for encounter + enemy buffs (19:00–07:00). */
export function isNightWilds(worldTime: number): boolean {
  const u = fractDay(worldTime);
  return u >= FRAC_7PM || u < FRAC_7AM;
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
  if (u >= FRAC_7PM || u < FRAC_7AM) return "Night";
  if (u >= FRAC_5PM && u < FRAC_7PM) return "Dusk";
  if (u < 0.12) return "Dawn";
  if (u < 0.36) return "Morning";
  if (u < 0.52) return "Day";
  if (u < FRAC_5PM) return "Afternoon";
  return "Dusk";
}
