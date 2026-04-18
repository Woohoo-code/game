import type { ReactNode } from "react";
import { ARMOR_STATS, ITEM_DATA, WEAPON_STATS } from "../game/data";
import { useGameStore } from "../game/useGameStore";

function ItemIcon({ kind }: { kind: "potion" | "hiPotion" | "megaPotion" }) {
  const label = kind === "potion" ? "P" : kind === "hiPotion" ? "H" : "M";
  return <span className={`item-icon ${kind} item-icon--hud`}>{label}</span>;
}

function IconSword({ className }: { className?: string }) {
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
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.5 3.5 20.5 9.5 9 21H3v-6L14.5 3.5z" />
      <path d="M7 17l3-3" />
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
            <IconSword />
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
