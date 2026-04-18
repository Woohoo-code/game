import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MonsterPreview3D } from "../game3d/MonsterPreview3D";
import { gameStore } from "../game/state";
import { useGameStore } from "../game/useGameStore";
import {
  BODY_SHAPE_LABEL,
  MONSTER_BODY_SHAPES,
  defaultArmorDraft,
  defaultMonsterDraft,
  defaultWeaponDraft,
  saleChanceForPrice
} from "../game/ugc";
import type {
  MonsterBodyShape,
  UgcArmor,
  UgcMonster,
  UgcWeapon
} from "../game/types";

type Tab = "monsters" | "weapons" | "armor" | "market";

export function UgcStudio({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("monsters");
  const [saveBusy, setSaveBusy] = useState(false);
  const [publishReady, setPublishReady] = useState(false);
  const publishRef = useRef<(() => void) | null>(null);

  const registerPublish = useCallback((fn: (() => void) | null) => {
    publishRef.current = fn;
    setPublishReady(fn != null);
  }, []);

  useEffect(() => {
    if (tab === "market") {
      publishRef.current = null;
      setPublishReady(false);
    }
  }, [tab]);

  const handleSave = async () => {
    setSaveBusy(true);
    try {
      await gameStore.save();
    } finally {
      setSaveBusy(false);
    }
  };

  const handlePublish = () => {
    publishRef.current?.();
  };

  const canPublish = tab !== "market" && publishReady;

  return (
    <div className="ugc-modal-backdrop" role="dialog" aria-modal="true" aria-label="UGC Studio">
      <div className="ugc-modal">
        <header className="ugc-header">
          <div>
            <h2>UGC Studio</h2>
            <p className="ugc-tagline">Design it, price it, collect 75%. (Platform keeps a 25% cut.)</p>
          </div>
        </header>

        <nav className="ugc-tabs">
          <button className={tab === "monsters" ? "active" : ""} onClick={() => setTab("monsters")}>
            Monsters
          </button>
          <button className={tab === "weapons" ? "active" : ""} onClick={() => setTab("weapons")}>
            Weapons
          </button>
          <button className={tab === "armor" ? "active" : ""} onClick={() => setTab("armor")}>
            Armor
          </button>
          <button className={tab === "market" ? "active" : ""} onClick={() => setTab("market")}>
            Market
          </button>
        </nav>

        <div className="ugc-body">
          {tab === "monsters" && <MonsterStudio registerPublish={registerPublish} />}
          {tab === "weapons" && <WeaponStudio registerPublish={registerPublish} />}
          {tab === "armor" && <ArmorStudio registerPublish={registerPublish} />}
          {tab === "market" && <MarketTab />}
        </div>

        <footer className="ugc-studio-footer">
          <p className="ugc-studio-footer-hint">
            <strong>Save</strong> writes your game (including UGC) to this browser. <strong>Publish</strong> adds the
            current draft to your library — then use <strong>List for sale</strong> on a card to put it on the market.
          </p>
          <div className="ugc-studio-footer-actions">
            <button type="button" className="secondary" disabled={saveBusy} onClick={() => void handleSave()}>
              {saveBusy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="primary"
              disabled={!canPublish}
              title={
                tab === "market"
                  ? "Open Monsters, Weapons, or Armor to publish a new creation."
                  : !publishReady
                    ? "Switch to a design tab to publish."
                    : undefined
              }
              onClick={handlePublish}
            >
              Publish
            </button>
            <button type="button" className="secondary ugc-studio-exit" onClick={onClose}>
              Exit
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── Monster Studio ──────────────────────────────────────────────────────────

function MonsterStudio({ registerPublish }: { registerPublish: (fn: (() => void) | null) => void }) {
  const snapshot = useGameStore();
  const [shape, setShape] = useState<MonsterBodyShape>("slime");
  const [draft, setDraft] = useState(() => defaultMonsterDraft("slime", snapshot.player.level));

  const setShapeAndReset = (s: MonsterBodyShape) => {
    setShape(s);
    setDraft(defaultMonsterDraft(s, snapshot.player.level));
  };

  const update = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    const publish = () => {
      gameStore.createUgcMonster({ ...draft, bodyShape: shape });
      setDraft(defaultMonsterDraft(shape, snapshot.player.level));
    };
    registerPublish(publish);
    return () => registerPublish(null);
  }, [registerPublish, draft, shape, snapshot.player.level]);

  return (
    <div className="ugc-grid">
      <div className="ugc-designer">
        <MonsterPreview3D shape={shape} primary={draft.colorPrimary} accent={draft.colorAccent} />

        <div className="pill-row">
          {MONSTER_BODY_SHAPES.map((s) => (
            <button
              key={s}
              type="button"
              className={`pill${shape === s ? " active" : ""}`}
              onClick={() => setShapeAndReset(s)}
            >
              {BODY_SHAPE_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="form-row">
          <span>Name</span>
          <input
            type="text"
            value={draft.name}
            maxLength={22}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>

        <div className="form-row two">
          <label>
            <span>Primary</span>
            <input
              type="color"
              value={draft.colorPrimary}
              onChange={(e) => update({ colorPrimary: e.target.value })}
            />
          </label>
          <label>
            <span>Accent</span>
            <input
              type="color"
              value={draft.colorAccent}
              onChange={(e) => update({ colorAccent: e.target.value })}
            />
          </label>
        </div>

        <StatSlider
          label="Max HP"
          value={draft.maxHp}
          min={10}
          max={200}
          step={2}
          onChange={(v) => update({ maxHp: v })}
        />
        <StatSlider label="Attack" value={draft.attack} min={3} max={40} onChange={(v) => update({ attack: v })} />
        <StatSlider label="Defense" value={draft.defense} min={0} max={22} onChange={(v) => update({ defense: v })} />
        <StatSlider label="Speed" value={draft.speed} min={1} max={15} onChange={(v) => update({ speed: v })} />
        <StatSlider
          label="XP reward"
          value={draft.xpReward}
          min={4}
          max={220}
          onChange={(v) => update({ xpReward: v })}
        />
        <StatSlider
          label="Gold reward"
          value={draft.goldReward}
          min={2}
          max={200}
          onChange={(v) => update({ goldReward: v })}
        />
        <StatSlider
          label="Min level"
          value={draft.minLevel}
          min={1}
          max={20}
          onChange={(v) => update({ minLevel: v })}
        />
        <StatSlider
          label="List price (gold)"
          value={draft.price}
          min={10}
          max={500}
          step={5}
          onChange={(v) => update({ price: v })}
          hint={`Est. sale chance: ${(saleChanceForPrice(draft.price) * 100).toFixed(0)}% per tick`}
        />

        <p className="muted small ugc-draft-hint">Use <strong>Publish</strong> at the bottom of the studio to add this design to your library.</p>
      </div>

      <div className="ugc-library">
        <h3>Your monsters ({snapshot.ugc.monsters.length})</h3>
        {snapshot.ugc.monsters.length === 0 && (
          <p className="muted">Nothing yet. Build one on the left — it'll appear in encounters AND on the market.</p>
        )}
        {snapshot.ugc.monsters.map((m) => (
          <MonsterCard key={m.id} monster={m} />
        ))}
      </div>
    </div>
  );
}

function MonsterCard({ monster }: { monster: UgcMonster }) {
  const [price, setPrice] = useState(monster.price);
  const toggleList = () => {
    gameStore.setUgcMonsterListing(monster.id, !monster.listed, price);
  };
  return (
    <div className={`ugc-card${monster.listed ? " listed" : ""}`}>
      <div
        className="ugc-card-swatch"
        style={{
          background: `linear-gradient(135deg, ${monster.colorPrimary} 0%, ${monster.colorAccent} 100%)`
        }}
        title={BODY_SHAPE_LABEL[monster.bodyShape]}
      />
      <div className="ugc-card-body">
        <div className="ugc-card-head">
          <strong>{monster.name}</strong>
          <span className="ugc-card-tag">{BODY_SHAPE_LABEL[monster.bodyShape]}</span>
        </div>
        <div className="ugc-card-stats">
          HP {monster.maxHp} · ATK {monster.attack} · DEF {monster.defense} · SPD {monster.speed} · Lv{monster.minLevel}+
        </div>
        <div className="ugc-card-sales">
          {monster.sales} sold · {monster.grossEarned}g gross
        </div>
        <div className="ugc-card-actions">
          <input
            type="number"
            min={5}
            max={500}
            step={5}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value) || 0)}
            className="price-input"
          />
          <button type="button" onClick={toggleList} className={monster.listed ? "secondary" : "primary"}>
            {monster.listed ? "Unlist" : "List for sale"}
          </button>
          <button type="button" className="danger" onClick={() => gameStore.deleteUgcMonster(monster.id)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Weapon Studio ───────────────────────────────────────────────────────────

function WeaponStudio({ registerPublish }: { registerPublish: (fn: (() => void) | null) => void }) {
  const snapshot = useGameStore();
  const [draft, setDraft] = useState(defaultWeaponDraft);

  const update = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    const publish = () => {
      gameStore.createUgcWeapon(draft);
      setDraft(defaultWeaponDraft());
    };
    registerPublish(publish);
    return () => registerPublish(null);
  }, [registerPublish, draft]);

  return (
    <div className="ugc-grid">
      <div className="ugc-designer">
        <WeaponArmorPreview color={draft.color} kind="weapon" stat={draft.attackBonus} />

        <div className="form-row">
          <span>Name</span>
          <input
            type="text"
            value={draft.name}
            maxLength={22}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
        <div className="form-row">
          <span>Color</span>
          <input type="color" value={draft.color} onChange={(e) => update({ color: e.target.value })} />
        </div>
        <StatSlider
          label="Attack bonus"
          value={draft.attackBonus}
          min={0}
          max={18}
          onChange={(v) => update({ attackBonus: v })}
        />
        <StatSlider
          label="List price"
          value={draft.price}
          min={20}
          max={500}
          step={5}
          onChange={(v) => update({ price: v })}
          hint={`Est. sale chance: ${(saleChanceForPrice(draft.price) * 100).toFixed(0)}% per tick`}
        />

        <p className="muted small ugc-draft-hint">Use <strong>Publish</strong> at the bottom of the studio to forge this weapon into your library.</p>
      </div>

      <div className="ugc-library">
        <h3>Your weapons ({snapshot.ugc.weapons.length})</h3>
        {snapshot.ugc.weapons.length === 0 && (
          <p className="muted">Forge a signature blade and list it on the bazaar.</p>
        )}
        {snapshot.ugc.weapons.map((w) => (
          <WeaponCard key={w.id} weapon={w} />
        ))}
      </div>
    </div>
  );
}

function WeaponCard({ weapon }: { weapon: UgcWeapon }) {
  const [price, setPrice] = useState(weapon.price);
  const toggleList = () => {
    gameStore.setUgcWeaponListing(weapon.id, !weapon.listed, price);
  };
  return (
    <div className={`ugc-card${weapon.listed ? " listed" : ""}`}>
      <div className="ugc-card-swatch" style={{ background: weapon.color }} />
      <div className="ugc-card-body">
        <div className="ugc-card-head">
          <strong>{weapon.name}</strong>
          <span className="ugc-card-tag">+{weapon.attackBonus} ATK</span>
        </div>
        <div className="ugc-card-sales">
          {weapon.sales} sold · {weapon.grossEarned}g gross
        </div>
        <div className="ugc-card-actions">
          <input
            type="number"
            min={10}
            max={500}
            step={5}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value) || 0)}
            className="price-input"
          />
          <button type="button" onClick={toggleList} className={weapon.listed ? "secondary" : "primary"}>
            {weapon.listed ? "Unlist" : "List for sale"}
          </button>
          <button type="button" className="danger" onClick={() => gameStore.deleteUgcWeapon(weapon.id)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Armor Studio ────────────────────────────────────────────────────────────

function ArmorStudio({ registerPublish }: { registerPublish: (fn: (() => void) | null) => void }) {
  const snapshot = useGameStore();
  const [draft, setDraft] = useState(defaultArmorDraft);

  const update = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    const publish = () => {
      gameStore.createUgcArmor(draft);
      setDraft(defaultArmorDraft());
    };
    registerPublish(publish);
    return () => registerPublish(null);
  }, [registerPublish, draft]);

  return (
    <div className="ugc-grid">
      <div className="ugc-designer">
        <WeaponArmorPreview color={draft.color} kind="armor" stat={draft.defenseBonus} />

        <div className="form-row">
          <span>Name</span>
          <input
            type="text"
            value={draft.name}
            maxLength={22}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
        <div className="form-row">
          <span>Color</span>
          <input type="color" value={draft.color} onChange={(e) => update({ color: e.target.value })} />
        </div>
        <StatSlider
          label="Defense bonus"
          value={draft.defenseBonus}
          min={0}
          max={18}
          onChange={(v) => update({ defenseBonus: v })}
        />
        <StatSlider
          label="List price"
          value={draft.price}
          min={20}
          max={500}
          step={5}
          onChange={(v) => update({ price: v })}
          hint={`Est. sale chance: ${(saleChanceForPrice(draft.price) * 100).toFixed(0)}% per tick`}
        />

        <p className="muted small ugc-draft-hint">Use <strong>Publish</strong> at the bottom of the studio to add this armor to your library.</p>
      </div>

      <div className="ugc-library">
        <h3>Your armor ({snapshot.ugc.armor.length})</h3>
        {snapshot.ugc.armor.length === 0 && (
          <p className="muted">Design a plate, chain, or robe — everything sells eventually.</p>
        )}
        {snapshot.ugc.armor.map((a) => (
          <ArmorCard key={a.id} armor={a} />
        ))}
      </div>
    </div>
  );
}

function ArmorCard({ armor }: { armor: UgcArmor }) {
  const [price, setPrice] = useState(armor.price);
  const toggleList = () => {
    gameStore.setUgcArmorListing(armor.id, !armor.listed, price);
  };
  return (
    <div className={`ugc-card${armor.listed ? " listed" : ""}`}>
      <div className="ugc-card-swatch" style={{ background: armor.color }} />
      <div className="ugc-card-body">
        <div className="ugc-card-head">
          <strong>{armor.name}</strong>
          <span className="ugc-card-tag">+{armor.defenseBonus} DEF</span>
        </div>
        <div className="ugc-card-sales">
          {armor.sales} sold · {armor.grossEarned}g gross
        </div>
        <div className="ugc-card-actions">
          <input
            type="number"
            min={10}
            max={500}
            step={5}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value) || 0)}
            className="price-input"
          />
          <button type="button" onClick={toggleList} className={armor.listed ? "secondary" : "primary"}>
            {armor.listed ? "Unlist" : "List for sale"}
          </button>
          <button type="button" className="danger" onClick={() => gameStore.deleteUgcArmor(armor.id)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Market tab (stats + all listings) ───────────────────────────────────────

function MarketTab() {
  const snapshot = useGameStore();
  const { ugc } = snapshot;
  const listingsCount = useMemo(
    () =>
      ugc.monsters.filter((m) => m.listed).length +
      ugc.weapons.filter((w) => w.listed).length +
      ugc.armor.filter((a) => a.listed).length,
    [ugc]
  );
  const creationsCount = ugc.monsters.length + ugc.weapons.length + ugc.armor.length;

  return (
    <div className="ugc-market">
      <div className="ugc-market-stats">
        <StatTile label="Active listings" value={listingsCount} />
        <StatTile label="Creations" value={creationsCount} />
        <StatTile label="Total sold" value={ugc.totalSales} />
        <StatTile label="Gross revenue" value={`${ugc.totalGross}g`} />
        <StatTile label="Your earnings (75%)" value={`${ugc.totalNet}g`} highlight />
        <StatTile label="Platform tax (25%)" value={`${ugc.totalTax}g`} muted />
      </div>

      <h3>Live listings</h3>
      {listingsCount === 0 && (
        <p className="muted">Nothing is listed right now — head to the Monsters/Weapons/Armor tabs to publish something.</p>
      )}

      {ugc.monsters.filter((m) => m.listed).length > 0 && (
        <section className="market-section">
          <h4>Monsters</h4>
          <div className="market-list">
            {ugc.monsters
              .filter((m) => m.listed)
              .map((m) => (
                <ListingRow
                  key={m.id}
                  title={m.name}
                  subtitle={`${BODY_SHAPE_LABEL[m.bodyShape]} · HP ${m.maxHp} · ATK ${m.attack}`}
                  price={m.price}
                  sales={m.sales}
                  gross={m.grossEarned}
                  swatch={`linear-gradient(135deg, ${m.colorPrimary} 0%, ${m.colorAccent} 100%)`}
                />
              ))}
          </div>
        </section>
      )}

      {ugc.weapons.filter((w) => w.listed).length > 0 && (
        <section className="market-section">
          <h4>Weapons</h4>
          <div className="market-list">
            {ugc.weapons
              .filter((w) => w.listed)
              .map((w) => (
                <ListingRow
                  key={w.id}
                  title={w.name}
                  subtitle={`+${w.attackBonus} ATK`}
                  price={w.price}
                  sales={w.sales}
                  gross={w.grossEarned}
                  swatch={w.color}
                />
              ))}
          </div>
        </section>
      )}

      {ugc.armor.filter((a) => a.listed).length > 0 && (
        <section className="market-section">
          <h4>Armor</h4>
          <div className="market-list">
            {ugc.armor
              .filter((a) => a.listed)
              .map((a) => (
                <ListingRow
                  key={a.id}
                  title={a.name}
                  subtitle={`+${a.defenseBonus} DEF`}
                  price={a.price}
                  sales={a.sales}
                  gross={a.grossEarned}
                  swatch={a.color}
                />
              ))}
          </div>
        </section>
      )}

        <p className="muted small">
        Tip: lower prices sell more often per market tick (~6s). Higher prices earn more per sale but move slower. New
        items are added from the Monsters / Weapons / Armor tabs with <strong>Publish</strong>, then listed here.
      </p>
    </div>
  );
}

function ListingRow({
  title,
  subtitle,
  price,
  sales,
  gross,
  swatch
}: {
  title: string;
  subtitle: string;
  price: number;
  sales: number;
  gross: number;
  swatch: string;
}) {
  return (
    <div className="market-row">
      <div className="market-row-swatch" style={{ background: swatch }} />
      <div className="market-row-body">
        <strong>{title}</strong>
        <span className="muted">{subtitle}</span>
      </div>
      <div className="market-row-stats">
        <div>
          <span>{price}g</span>
          <small>list price</small>
        </div>
        <div>
          <span>{sales}</span>
          <small>sales</small>
        </div>
        <div>
          <span>{gross}g</span>
          <small>gross</small>
        </div>
      </div>
    </div>
  );
}

// ─── Primitives ──────────────────────────────────────────────────────────────

function StatSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  hint
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="stat-slider">
      <span className="stat-slider-head">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

function StatTile({
  label,
  value,
  highlight,
  muted
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`stat-tile${highlight ? " highlight" : ""}${muted ? " muted" : ""}`}>
      <div className="stat-tile-value">{value}</div>
      <div className="stat-tile-label">{label}</div>
    </div>
  );
}

function WeaponArmorPreview({
  color,
  kind,
  stat
}: {
  color: string;
  kind: "weapon" | "armor";
  stat: number;
}) {
  return (
    <div className="gear-preview" aria-hidden="true">
      {kind === "weapon" ? (
        <svg viewBox="0 0 180 140" className="gear-svg">
          <rect x="84" y="18" width="12" height="80" fill={color} stroke="#111" strokeWidth="2" />
          <polygon points="90,8 80,22 100,22" fill={color} stroke="#111" strokeWidth="2" />
          <rect x="72" y="98" width="36" height="10" fill="#6a4a2a" stroke="#111" strokeWidth="2" />
          <rect x="86" y="108" width="8" height="24" fill="#3a2518" stroke="#111" strokeWidth="2" />
        </svg>
      ) : (
        <svg viewBox="0 0 180 140" className="gear-svg">
          <path
            d="M40,32 L90,18 L140,32 L132,100 L90,122 L48,100 Z"
            fill={color}
            stroke="#111"
            strokeWidth="2"
          />
          <path d="M90,18 L90,122" stroke="#111" strokeWidth="2" opacity="0.25" />
        </svg>
      )}
      <div className="gear-preview-tag">
        {kind === "weapon" ? `+${stat} ATK` : `+${stat} DEF`}
      </div>
    </div>
  );
}
