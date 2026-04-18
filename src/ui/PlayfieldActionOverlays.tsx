import { useState } from "react";
import { ARMOR_STATS, ITEM_DATA, formatItemTooltipSummary, PET_SHOP_OFFERS, SHOP_ITEMS, TOWN_MAP, WEAPON_STATS } from "../game/data";
import { getLanRoomCode } from "../coop/lanCoop";
import { useLanCoopRole } from "../coop/useLanCoopRole";
import { gameStore } from "../game/state";
import { STORY_CHAPTERS } from "../game/story";
import { useGameStore } from "../game/useGameStore";
import { LanCoopPanel } from "./LanCoopPanel";

type Props = {
  onOpenJournal: () => void;
  onOpenUgc: () => void;
  onOpenPets: () => void;
};

export function PlayfieldActionOverlays({ onOpenJournal, onOpenUgc, onOpenPets }: Props) {
  const snapshot = useGameStore();
  const lanRole = useLanCoopRole();
  const coopGuest = lanRole === "guest";
  const [lanPanelOpen, setLanPanelOpen] = useState(false);

  if (snapshot.battle.inBattle) {
    return null;
  }

  const gold = snapshot.player.gold;
  const pets = snapshot.player.pets ?? [];
  const trainFee = 20 + snapshot.player.level * 6;
  const libraryFee = 14 + snapshot.player.level * 3;
  const forgeFee = 30 + snapshot.player.level * 8;
  const stablesFee = 18 + snapshot.player.level * 4;
  const canAffordTraining = gold >= trainFee;
  const revivalDebt = snapshot.player.revivalDebtMonstersRemaining ?? 0;
  const revivalDebtLock = revivalDebt > 0;
  const revivalDebtTitle = `Guild lock: slay ${revivalDebt} more monster${revivalDebt === 1 ? "" : "s"} in the wilds to clear your revival tithe.`;
  const hasBuildingContext =
    snapshot.world.canShop ||
    snapshot.world.canPetShop ||
    snapshot.world.canHeal ||
    snapshot.world.canTrain ||
    snapshot.world.canGuild ||
    snapshot.world.canBoss ||
    snapshot.world.canLibrary ||
    snapshot.world.canForge ||
    snapshot.world.canChapel ||
    snapshot.world.canStables ||
    snapshot.world.canMarket ||
    snapshot.world.canVoidPortal;

  return (
    <>
      {lanPanelOpen && <LanCoopPanel onClose={() => setLanPanelOpen(false)} />}
      <div className="playfield-left-rail" aria-label="Game controls">
        <div className="playfield-dock-overlay" aria-label="Game actions">
          <div className="playfield-dock-inner action-dock">
            {lanRole !== "solo" && (
              <div className="lan-coop-strip" role="status">
                {lanRole === "host" ? (
                  <>
                    <strong>LAN host</strong> — code <strong>{getLanRoomCode() ?? "—"}</strong>.{" "}
                    <button type="button" className="lan-coop-strip-btn" onClick={() => setLanPanelOpen(true)}>
                      Open LAN panel
                    </button>
                  </>
                ) : (
                  <>
                    <strong>LAN guest</strong> — synced from host.{" "}
                    <button type="button" className="lan-coop-strip-btn" onClick={() => setLanPanelOpen(true)}>
                      Open LAN panel
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="row">
              <button
                type="button"
                onClick={() => gameStore.save()}
                disabled={coopGuest || !snapshot.world.inTown || !snapshot.hasUnsavedChanges}
                title={
                  coopGuest
                    ? "Only the host can save in LAN co-op."
                    : !snapshot.world.inTown
                      ? "Save is only available in town."
                      : !snapshot.hasUnsavedChanges
                        ? "Nothing new to save since your last save."
                        : undefined
                }
              >
                Save
              </button>
              <button type="button" onClick={() => gameStore.load()} disabled={coopGuest} title={coopGuest ? "Host controls saves in LAN co-op." : undefined}>
                Load
              </button>
              <button type="button" onClick={() => gameStore.usePotionInField()} disabled={coopGuest} title={coopGuest ? "Host uses items in LAN co-op." : undefined}>
                Use Potion
              </button>
              <button
                type="button"
                onClick={() => void gameStore.exportTransferCode()}
                disabled={coopGuest || !snapshot.player.hasCreatedCharacter}
                title={
                  coopGuest
                    ? "Only the host can export saves in LAN co-op."
                    : "Copy one line to the clipboard for another device (includes a 10-digit key and your full save)."
                }
              >
                Copy transfer line
              </button>
              <button type="button" onClick={() => setLanPanelOpen(true)} title="Host or join a session on your local network.">
                LAN co-op
              </button>
            </div>
            <div className="row reset-game-row">
              <button
                type="button"
                className="journal-open-btn"
                onClick={onOpenJournal}
                title={STORY_CHAPTERS[snapshot.story.stage].objective}
              >
                Journal
                <span className="journal-open-badge">
                  {STORY_CHAPTERS[snapshot.story.stage].title.split(" — ")[0]}
                </span>
              </button>
              <button
                type="button"
                className="journal-open-btn"
                onClick={onOpenPets}
                disabled={coopGuest}
                title={coopGuest ? "Only the host manages pets in LAN co-op." : "View and manage your pet companions."}
              >
                Pets
                {pets.length > 0 && (
                  <span className="journal-open-badge">
                    {snapshot.player.activePetId
                      ? (pets.find((p) => p.id === snapshot.player.activePetId)?.name ?? "—")
                      : `${pets.length}`}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="ugc-open-btn"
                onClick={onOpenUgc}
                disabled={coopGuest || !snapshot.player.bossDefeated}
                title={
                  coopGuest
                    ? "Only the host opens UGC Studio in LAN co-op."
                    : snapshot.player.bossDefeated
                      ? "Create monsters, weapons, and armor. List them for sale."
                      : "Defeat the Void Titan to unlock the UGC Studio."
                }
              >
                UGC Studio
                {snapshot.player.bossDefeated && snapshot.ugc.totalSales > 0 && (
                  <span className="ugc-open-badge">{snapshot.ugc.totalSales} sold</span>
                )}
              </button>
              <button
                type="button"
                className="reset-game-btn"
                onClick={() => {
                  if (!window.confirm("Start a new journey? This clears your character, UGC, and world progress.")) {
                    return;
                  }
                  gameStore.resetGame();
                }}
                disabled={coopGuest || snapshot.battle.inBattle || !snapshot.player.bossDefeated}
                title={
                  coopGuest
                    ? "Only the host can reset in LAN co-op."
                    : snapshot.player.bossDefeated
                      ? undefined
                      : "Defeat the Void Titan in the southeast arena to unlock."
                }
              >
                Reset Game
              </button>
            </div>
          </div>
        </div>
      </div>

      {hasBuildingContext && (
        <div
          className="playfield-context-overlay playfield-context-overlay--dock-bottom"
          role="region"
          aria-label="Building actions"
        >
          <div className="playfield-context-inner">
            {revivalDebtLock && (
              <div className="box revival-debt-banner" role="status">
                <strong>Guild tithe lock</strong>
                <p>
                  Slay <strong>{revivalDebt}</strong> more monster{revivalDebt === 1 ? "" : "s"} in the wilds — then shops,
                  inn, pets, training, guild pay, and specialty buildings unlock again.
                </p>
              </div>
            )}
            {snapshot.world.canPetShop && (
              <div className="box">
                <strong>Companion Emporium</strong>
                <p className="pet-shop-hint">
                  Adopt a pet — your active companion adds to attack (up to +10) and strikes after your basic hits.
                </p>
                <div className="row">
                  {PET_SHOP_OFFERS.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => gameStore.buyPetShopOffer(o.key)}
                      disabled={revivalDebtLock || coopGuest || gold < o.price || pets.length >= 12}
                      title={
                        revivalDebtLock
                          ? revivalDebtTitle
                          : `${o.title} · +${o.attackBonus} ATK while active · ${o.price}g`
                      }
                    >
                      {o.title} (+{o.attackBonus} ATK, {o.price}g)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {snapshot.world.canShop && (
              <div className="box shop-box">
                <strong>Shop</strong>
                <p className="shop-consumables-hint">Consumables — assign favorites on the hotbar (keys 1–9, 0) or from the backpack.</p>
                <div className="row shop-consumable-grid">
                  {SHOP_ITEMS.map((itemKey) => (
                    <button
                      key={itemKey}
                      type="button"
                      onClick={() => gameStore.purchaseItem(itemKey)}
                      disabled={revivalDebtLock || coopGuest || gold < ITEM_DATA[itemKey].price}
                      title={
                        revivalDebtLock
                          ? revivalDebtTitle
                          : `${ITEM_DATA[itemKey].name} · ${formatItemTooltipSummary(itemKey)}`
                      }
                    >
                      {ITEM_DATA[itemKey].name} ({ITEM_DATA[itemKey].price}g)
                    </button>
                  ))}
                </div>
                <div className="row">
                  <button
                    type="button"
                    onClick={() => gameStore.buyIronSword()}
                    disabled={revivalDebtLock || coopGuest || gold < WEAPON_STATS.ironSword.price}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Buy Iron Sword ({WEAPON_STATS.ironSword.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buySteelSword()}
                    disabled={revivalDebtLock || coopGuest || gold < WEAPON_STATS.steelSword.price}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Buy Steel Sword ({WEAPON_STATS.steelSword.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buyMythrilBlade()}
                    disabled={revivalDebtLock || coopGuest || gold < WEAPON_STATS.mythrilBlade.price}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Buy Mythril Blade ({WEAPON_STATS.mythrilBlade.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buyChainMail()}
                    disabled={revivalDebtLock || coopGuest || gold < ARMOR_STATS.chainMail.price}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Buy Chain Mail ({ARMOR_STATS.chainMail.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buyKnightArmor()}
                    disabled={revivalDebtLock || coopGuest || gold < ARMOR_STATS.knightArmor.price}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Buy Knight Armor ({ARMOR_STATS.knightArmor.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buyDragonArmor()}
                    disabled={revivalDebtLock || coopGuest || gold < ARMOR_STATS.dragonArmor.price}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Buy Dragon Armor ({ARMOR_STATS.dragonArmor.price}g)
                  </button>
                  {!snapshot.player.hasTownMap ? (
                    <button
                      type="button"
                      onClick={() => gameStore.buyTownMap()}
                      disabled={revivalDebtLock || coopGuest || gold < TOWN_MAP.price}
                      title={revivalDebtLock ? revivalDebtTitle : TOWN_MAP.description}
                    >
                      Buy {TOWN_MAP.name} ({TOWN_MAP.price}g)
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => gameStore.setTownMapEquipped(true)}
                        disabled={coopGuest || (snapshot.player.townMapEquipped ?? false)}
                        title="Show the town compass while exploring outside town."
                      >
                        Equip map
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => gameStore.setTownMapEquipped(false)}
                        disabled={coopGuest || !(snapshot.player.townMapEquipped ?? false)}
                        title="Hide the compass overlay until you equip again."
                      >
                        Stow map
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {snapshot.world.canHeal && (
              <div className="box">
                <strong>Inn</strong>
                <button
                  type="button"
                  onClick={() => gameStore.healAtInn()}
                  disabled={revivalDebtLock || coopGuest || snapshot.player.hp >= snapshot.player.maxHp}
                  title={revivalDebtLock ? revivalDebtTitle : undefined}
                >
                  Rest (10g)
                </button>
              </div>
            )}

            {snapshot.world.canTrain && (
              <div className="box">
                <strong>Training Hall</strong> <span className="training-fee">({trainFee}g each)</span>
                <div className="row">
                  <button
                    type="button"
                    onClick={() => gameStore.trainAttack()}
                    disabled={revivalDebtLock || coopGuest || !canAffordTraining}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Train Attack
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.trainDefense()}
                    disabled={revivalDebtLock || coopGuest || !canAffordTraining}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Train Defense
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.trainSpeed()}
                    disabled={revivalDebtLock || coopGuest || !canAffordTraining}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Train Speed
                  </button>
                </div>
              </div>
            )}

            {snapshot.world.canGuild && (
              <div className="box">
                <strong>Guild Board</strong>
                <p>
                  Defeats: {snapshot.player.monstersDefeated} | Target: {4 + snapshot.player.bountyTier * 2}
                </p>
                <button
                  type="button"
                  onClick={() => gameStore.claimGuildBounty()}
                  disabled={
                    revivalDebtLock ||
                    coopGuest ||
                    snapshot.player.monstersDefeated < 4 + snapshot.player.bountyTier * 2
                  }
                  title={revivalDebtLock ? revivalDebtTitle : undefined}
                >
                  Claim Bounty
                </button>
              </div>
            )}

            {snapshot.world.canBoss && (
              <div className="box boss-arena">
                <strong>Void Arena</strong>
                <p className="boss-arena-hint">The Void Titan awaits.</p>
                <button
                  type="button"
                  onClick={() => gameStore.challengeBoss()}
                  disabled={coopGuest || snapshot.battle.inBattle || snapshot.player.bossDefeated}
                >
                  {snapshot.player.bossDefeated ? "Void Titan defeated" : "Challenge Void Titan"}
                </button>
              </div>
            )}

            {snapshot.world.canVoidPortal && (
              <div className="box realm-rift">
                <strong>Dimensional rift</strong>
                <p className="boss-arena-hint">
                  The old arena is gone — only this tear in the world remains. Cross to generate a new realm (one overworld
                  loads at a time).
                </p>
                <button
                  type="button"
                  onClick={() => gameStore.enterRealmPortal()}
                  disabled={coopGuest || snapshot.battle.inBattle}
                  title={coopGuest ? "Only the host can cross realms in LAN co-op." : undefined}
                >
                  Enter new realm
                </button>
              </div>
            )}

            {snapshot.world.canLibrary && (
              <div className="box">
                <strong>Library</strong> <span className="training-fee">({libraryFee}g)</span>
                <p>Study old field manuals for instant XP.</p>
                <button
                  type="button"
                  onClick={() => gameStore.studyAtLibrary()}
                  disabled={revivalDebtLock || coopGuest || gold < libraryFee}
                  title={revivalDebtLock ? revivalDebtTitle : undefined}
                >
                  Study lore
                </button>
              </div>
            )}

            {snapshot.world.canForge && (
              <div className="box">
                <strong>Forge</strong> <span className="training-fee">({forgeFee}g)</span>
                <p>Temper your gear for permanent stats.</p>
                <button
                  type="button"
                  onClick={() => gameStore.temperAtForge()}
                  disabled={revivalDebtLock || coopGuest || gold < forgeFee}
                  title={revivalDebtLock ? revivalDebtTitle : undefined}
                >
                  Temper weapon
                </button>
              </div>
            )}

            {snapshot.world.canChapel && (
              <div className="box">
                <strong>Chapel</strong>
                <p>Receive a blessing: heal and reduce revival debt by 1 if any remains.</p>
                <button
                  type="button"
                  onClick={() => gameStore.prayAtChapel()}
                  disabled={coopGuest || gold < 12}
                >
                  Receive blessing (12g)
                </button>
              </div>
            )}

            {snapshot.world.canStables && (
              <div className="box">
                <strong>Stables</strong> <span className="training-fee">({stablesFee}g)</span>
                <p>Mounted drills sharpen your reaction speed.</p>
                <button
                  type="button"
                  onClick={() => gameStore.rideAtStables()}
                  disabled={revivalDebtLock || coopGuest || gold < stablesFee}
                  title={revivalDebtLock ? revivalDebtTitle : undefined}
                >
                  Ride drills
                </button>
              </div>
            )}

            {snapshot.world.canMarket && (
              <div className="box">
                <strong>Market</strong>
                <p>Haggle for a discounted random consumable bundle.</p>
                <button type="button" onClick={() => gameStore.haggleAtMarket()} disabled={revivalDebtLock || coopGuest}>
                  Haggle bundle
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
