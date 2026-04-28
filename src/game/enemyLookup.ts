import { ENEMIES } from "./data";

export const ENEMY_BY_ID = new Map(ENEMIES.map((enemy) => [enemy.id, enemy] as const));