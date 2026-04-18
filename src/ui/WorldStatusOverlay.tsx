import type { ReactNode } from "react";
import { ARMOR_STATS, ITEM_DATA, WEAPON_STATS } from "../game/data";
import { useGameStore } from "../game/useGameStore";
import type { WeaponKey } from "../game/types";

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

function ItemIcon({ kind }: { kind: "potion" | "hiPotion" | "megaPotion" }) {
  const label = kind === "potion" ? "P" : kind === "hiPotion" ? "H" : "M";
  return <span className={`item-icon ${kind} item-icon--hud`}>{label}</span>;
}

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
  const attackPower = snapshot.player.attack + weaponBonus;
  const defensePower = snapshot.player.defense + armorBonus;
  const xpPercent = Math.max(0, Math.min(100, Math.round((snapshot.player.xp / snapshot.player.xpToNext) * 100)));
  const playerHpPercent = Math.max(0, Math.min(100, Math.round((snapshot.player.hp / snapshot.player.maxHp) * 100)));
  const dangerPercent = Math.min(100, Math.round(snapshot.world.encounterRate * 1000));
  const dangerLabel =
    dangerPercent === 0 ? "Safe" : dangerPercent < 40 ? "Low" : dangerPercent < 80 ? "Medium" : "High";

  const w = WEAPON_STATS[snapshot.player.weapon];
  const a = ARMOR_STATS[snapshot.player.armor];

  const weaponTitle = [
    w.name,
    `Equipped weapon · +${weaponBonus} attack from gear`,
    `Total attack power: ${attackPower} (${snapshot.player.attack} base + ${weaponBonus} weapon)`
  ].join("\n");

  const armorTitle = [
    a.name,
    `Equipped armor · +${armorBonus} defense from gear`,
    `Total defense: ${defensePower} (${snapshot.player.defense} base + ${armorBonus} armor)`
  ].join("\n");

  const potionTitle = (key: "potion" | "hiPotion" | "megaPotion", count: number) => {
    const it = ITEM_DATA[key];
    return [`${it.name} ×${count}`, `Heals ${it.healAmount} HP in battle.`, `Price when bought: ${it.price}g`].join(
      "\n"
    );
  };

  const atkTitle = [
    `Attack power: ${attackPower}`,
    `Base ${snapshot.player.attack} + weapon ${weaponBonus}`,
    `Equipped: ${w.name}`
  ].join("\n");

  const defTitle = [
    `Defense: ${defensePower}`,
    `Base ${snapshot.player.defense} + armor ${armorBonus}`,
    `Equipped: ${a.name}`
  ].join("\n");

  const spdTitle = [`Speed: ${snapshot.player.speed}`, "Determines turn order in battle."].join("\n");

  const cdTitle = [
    "Skill cooldowns (in battle)",
    "Each skill has its own timer. After you cast a skill, only that skill is locked until it ticks down between enemy turns."
  ].join("\n");

  return (
    <div className="world-status-overlay" aria-label="Status">
      <div className="world-status-overlay-inner">
        <h1 className="world-status-title">Monster Slayer</h1>
        <div className="danger-meter">
          <div className="danger-meter-head">
            <strong>Danger: {dangerLabel}</strong>
            <span>{dangerPercent}%</span>
          </div>
          <div className="danger-meter-track">
            <div className="danger-meter-fill" style={{ width: `${dangerPercent}%` }} />
          </div>
        </div>
        <p className="world-status-summary">
          <strong>{snapshot.player.name}</strong> — Lv {snapshot.player.level} · {snapshot.player.hp}/
          {snapshot.player.maxHp} HP · {snapshot.player.gold}g
        </p>
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

        <div className="world-hud-section-label">Inventory</div>
        <div className="world-hud-icon-row" role="group" aria-label="Inventory">
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
          <HudIconButton
            className="hud-potion"
            ariaLabel={`${ITEM_DATA.potion.name}, ${snapshot.player.items.potion} owned`}
            title={potionTitle("potion", snapshot.player.items.potion)}
          >
            <ItemIcon kind="potion" />
            <span className="hud-qty">{snapshot.player.items.potion}</span>
          </HudIconButton>
          <HudIconButton
            className="hud-potion"
            ariaLabel={`${ITEM_DATA.hiPotion.name}, ${snapshot.player.items.hiPotion} owned`}
            title={potionTitle("hiPotion", snapshot.player.items.hiPotion)}
          >
            <ItemIcon kind="hiPotion" />
            <span className="hud-qty">{snapshot.player.items.hiPotion}</span>
          </HudIconButton>
          <HudIconButton
            className="hud-potion"
            ariaLabel={`${ITEM_DATA.megaPotion.name}, ${snapshot.player.items.megaPotion} owned`}
            title={potionTitle("megaPotion", snapshot.player.items.megaPotion)}
          >
            <ItemIcon kind="megaPotion" />
            <span className="hud-qty">{snapshot.player.items.megaPotion}</span>
          </HudIconButton>
        </div>

        <div className="world-hud-section-label">Stats</div>
        <div className="world-hud-icon-row" role="group" aria-label="Combat stats">
          <HudIconButton className="hud-stat-atk" ariaLabel={`Attack power ${attackPower}`} title={atkTitle}>
            <IconPower />
          </HudIconButton>
          <HudIconButton className="hud-stat-def" ariaLabel={`Defense ${defensePower}`} title={defTitle}>
            <IconShield />
          </HudIconButton>
          <HudIconButton className="hud-stat-spd" ariaLabel={`Speed ${snapshot.player.speed}`} title={spdTitle}>
            <IconBolt />
          </HudIconButton>
          <HudIconButton
            className="hud-stat-cd"
            ariaLabel="Skill cooldowns (per skill, in battle)"
            title={cdTitle}
          >
            <IconTimer />
          </HudIconButton>
        </div>
      </div>
    </div>
  );
}
