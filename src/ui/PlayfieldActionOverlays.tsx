import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ARMOR_STATS,
  GEAR_SELLBACK_FRACTION,
  ITEM_DATA,
  armorSellDowngrade,
  formatItemTooltipSummary,
  gearSellRefundGold,
  PET_SHOP_OFFERS,
  PET_STABLE_MAX_LEVEL,
  RESOURCES,
  RESOURCE_KEYS,
  SHOP_ITEMS,
  STABLE_HORSE_ORDER,
  STABLE_HORSES,
  TOWN_MAP,
  UGC_STUDIO_VOID_TITANS_REQUIRED,
  WEAPON_STATS,
  weaponSellDowngrade,
  stableHorseSpeedBonus,
  stablePetTrainDurationMs,
  stablePetTrainFee
} from "../game/data";
import { gameStore } from "../game/state";
import { STORY_CHAPTERS } from "../game/story";
import { useGameStore } from "../game/useGameStore";
import type { ItemKey, ResourceKey } from "../game/types";

type Props = {
  onOpenJournal: () => void;
  onOpenInventory: () => void;
  onOpenUgc: () => void;
  onOpenPets: () => void;
  /** Shop consumable grid: selected item for the detail panel (not an immediate purchase). */
  selectedShopItem: ItemKey | null;
  onSelectShopItem: Dispatch<SetStateAction<ItemKey | null>>;
};

export function PlayfieldActionOverlays({
  onOpenJournal,
  onOpenInventory,
  onOpenUgc,
  onOpenPets,
  selectedShopItem,
  onSelectShopItem
}: Props) {
  const snapshot = useGameStore();
  const coopGuest = false;

  if (snapshot.battle.inBattle) {
    return null;
  }

  const gold = snapshot.player.gold;
  const pets = snapshot.player.pets ?? [];
  const trainFee = 20 + snapshot.player.level * 6;
  const libraryFee = 14 + snapshot.player.level * 3;
  const forgeFee = 30 + snapshot.player.level * 8;
  const canAffordTraining = gold >= trainFee;
  const revivalDebt = snapshot.player.revivalDebtMonstersRemaining ?? 0;
  const revivalDebtLock = revivalDebt > 0;
  const revivalDebtTitle = `Guild lock: slay ${revivalDebt} more monster${revivalDebt === 1 ? "" : "s"} in the wilds to clear your revival tithe.`;
  const horsesOwned = snapshot.player.horsesOwned ?? [];
  const mountBonus = stableHorseSpeedBonus(horsesOwned);
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
    snapshot.world.canVoidPortal ||
    snapshot.world.canRestoreSpring ||
    snapshot.world.canReturnPortal ||
    snapshot.world.canDungeon ||
    snapshot.world.canLeaveDungeon;

  const weaponDownAfterSell = weaponSellDowngrade(snapshot.player.weapon);
  const armorDownAfterSell = armorSellDowngrade(snapshot.player.armor);
  const weaponSellRefund = weaponDownAfterSell
    ? gearSellRefundGold(WEAPON_STATS[snapshot.player.weapon].price)
    : 0;
  const armorSellRefund = armorDownAfterSell ? gearSellRefundGold(ARMOR_STATS[snapshot.player.armor].price) : 0;

  return (
    <>
      <div className="playfield-left-rail" aria-label="Game controls">
        <div className="playfield-dock-overlay" aria-label="Game actions">
          <div className="playfield-dock-inner action-dock">
            <div className="row">
              <button
                type="button"
                onClick={() => gameStore.save()}
                disabled={!snapshot.world.inTown || !snapshot.hasUnsavedChanges}
                title={
                  !snapshot.world.inTown
                    ? "Save is only available in town."
                    : !snapshot.hasUnsavedChanges
                      ? "Nothing new to save since your last save."
                      : undefined
                }
              >
                Save
              </button>
              <button type="button" onClick={() => gameStore.load()}>
                Load
              </button>
              <button type="button" onClick={() => gameStore.usePotionInField()}>
                Use Potion
              </button>
              <button
                type="button"
                onClick={() => void gameStore.exportTransferCode()}
                disabled={!snapshot.player.hasCreatedCharacter}
                title="Copy one line to the clipboard for another device (includes a 10-digit key and your full save)."
              >
                Copy transfer line
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
                className="journal-open-btn full-inventory-open-btn"
                onClick={onOpenInventory}
                title="Full inventory — every item type, gold, and equipment (shortcut I)"
              >
                Inventory
              </button>
              <button
                type="button"
                className="journal-open-btn"
                onClick={onOpenPets}
                title="View and manage your pet companions."
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
                disabled={snapshot.player.voidTitansDefeated < UGC_STUDIO_VOID_TITANS_REQUIRED}
                title={
                  snapshot.player.voidTitansDefeated >= UGC_STUDIO_VOID_TITANS_REQUIRED
                    ? "Create monsters, weapons, and armor. List them for sale."
                    : "Defeat two Void Titans (beat one, cross the rift, beat the next realm's Titan) to unlock UGC Studio."
                }
              >
                UGC Studio
                {snapshot.player.voidTitansDefeated >= UGC_STUDIO_VOID_TITANS_REQUIRED &&
                  snapshot.ugc.totalSales > 0 && (
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
                disabled={snapshot.battle.inBattle || snapshot.player.voidTitansDefeated < 1}
                title={
                  snapshot.player.voidTitansDefeated >= 1 ? undefined : "Defeat a Void Titan in the arena to unlock."
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
                      disabled={revivalDebtLock || gold < o.price || pets.length >= 12}
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
                <strong>General merchant</strong>
                <p className="shop-consumables-hint">
                  Consumables and maps only — assign favorites on the hotbar (keys 1–9, 0) or from the backpack. Weapons and
                  armor are sold at the <strong>forge</strong>.
                </p>
                <div className="row shop-consumable-grid">
                  {SHOP_ITEMS.map((itemKey) => {
                    const itemDisabled = revivalDebtLock;
                    const isSelected = selectedShopItem === itemKey;
                    return (
                      <button
                        key={itemKey}
                        type="button"
                        className={isSelected ? "shop-consumable-btn shop-consumable-btn--selected" : "shop-consumable-btn"}
                        onClick={() =>
                          onSelectShopItem(isSelected ? null : itemKey)
                        }
                        disabled={itemDisabled}
                        title={
                          revivalDebtLock
                            ? revivalDebtTitle
                            : `${ITEM_DATA[itemKey].name} · ${formatItemTooltipSummary(itemKey)} — click for details`
                        }
                      >
                        {ITEM_DATA[itemKey].name} ({ITEM_DATA[itemKey].price}g)
                      </button>
                    );
                  })}
                </div>
                <div className="row">
                  <button
                    type="button"
                    onClick={() => gameStore.buyIronSword()}
                    disabled={revivalDebtLock || gold < WEAPON_STATS.ironSword.price}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Buy Iron Sword ({WEAPON_STATS.ironSword.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buySteelSword()}
                    disabled={revivalDebtLock || gold < WEAPON_STATS.steelSword.price}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Buy Steel Sword ({WEAPON_STATS.steelSword.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buyMythrilBlade()}
                    disabled={revivalDebtLock || gold < WEAPON_STATS.mythrilBlade.price}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Buy Mythril Blade ({WEAPON_STATS.mythrilBlade.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buyChainMail()}
                    disabled={revivalDebtLock || gold < ARMOR_STATS.chainMail.price}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Buy Chain Mail ({ARMOR_STATS.chainMail.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buyKnightArmor()}
                    disabled={revivalDebtLock || gold < ARMOR_STATS.knightArmor.price}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Buy Knight Armor ({ARMOR_STATS.knightArmor.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buyDragonArmor()}
                    disabled={revivalDebtLock || gold < ARMOR_STATS.dragonArmor.price}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Buy Dragon Armor ({ARMOR_STATS.dragonArmor.price}g)
                  </button>
                  {!snapshot.player.hasTownMap ? (
                    <button
                      type="button"
                      onClick={() => gameStore.buyTownMap()}
                      disabled={revivalDebtLock || gold < TOWN_MAP.price}
                      title={revivalDebtLock ? revivalDebtTitle : TOWN_MAP.description}
                    >
                      Buy {TOWN_MAP.name} ({TOWN_MAP.price}g)
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => gameStore.setTownMapEquipped(true)}
                        disabled={(snapshot.player.townMapEquipped ?? false)}
                        title="Show the town compass while exploring outside town."
                      >
                        Equip map
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => gameStore.setTownMapEquipped(false)}
                        disabled={!(snapshot.player.townMapEquipped ?? false)}
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
                  disabled={revivalDebtLock || snapshot.player.hp >= snapshot.player.maxHp}
                  title={revivalDebtLock ? revivalDebtTitle : undefined}
                >
                  Rest (10g)
                </button>
              </div>
            )}

            {snapshot.world.canRestoreSpring && (
              <div className="box">
                <strong>Restore spring</strong>
                <p className="boss-arena-hint">Ancient waters — no fee.</p>
                <button
                  type="button"
                  onClick={() => gameStore.healAtRestoreSpring()}
                  disabled={coopGuest || snapshot.player.hp >= snapshot.player.maxHp}
                  title={coopGuest ? "LAN guest: healing is host-driven from their session." : undefined}
                >
                  Drink (restore HP)
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
                    disabled={revivalDebtLock || !canAffordTraining}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Train Attack
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.trainDefense()}
                    disabled={revivalDebtLock || !canAffordTraining}
                    title={revivalDebtLock ? revivalDebtTitle : undefined}
                  >
                    Train Defense
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.trainSpeed()}
                    disabled={revivalDebtLock || !canAffordTraining}
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
                  disabled={revivalDebtLock || snapshot.player.monstersDefeated < 4 + snapshot.player.bountyTier * 2}
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
                  disabled={snapshot.battle.inBattle || snapshot.player.bossDefeated}
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
                  disabled={snapshot.battle.inBattle}
                >
                  Enter new realm
                </button>
              </div>
            )}

            {snapshot.world.canReturnPortal && (
              <div className="box return-rift">
                <strong>Return rift</strong>
                <p className="boss-arena-hint">
                  A stable rift anchored near the town — step through to return to a fresh first world. Your gear,
                  companions, and story progress come with you.
                </p>
                <button
                  type="button"
                  onClick={() => gameStore.returnToRealmOne()}
                  disabled={snapshot.battle.inBattle}
                >
                  Return to first world
                </button>
              </div>
            )}

            {snapshot.world.canDungeon && (
              <div className="box dungeon-entrance">
                <strong>Dungeon</strong>
                <p className="boss-arena-hint">
                  Past the iron-bound door, skeletons and zombies prowl the crypt halls. Rare treasures
                  wait in chests further in — but only the bold descend.
                </p>
                <button
                  type="button"
                  onClick={() => gameStore.enterDungeon()}
                  disabled={snapshot.battle.inBattle}
                >
                  Descend into dungeon
                </button>
              </div>
            )}

            {snapshot.world.canLeaveDungeon && (
              <div className="box return-rift">
                <strong>Dungeon stairs</strong>
                <p className="boss-arena-hint">
                  Warm air drifts down from the surface. Climb back up to the overworld — your haul
                  comes with you.
                </p>
                <button
                  type="button"
                  onClick={() => gameStore.leaveDungeon()}
                  disabled={snapshot.battle.inBattle}
                >
                  Leave dungeon
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
                  disabled={revivalDebtLock || gold < libraryFee}
                  title={revivalDebtLock ? revivalDebtTitle : undefined}
                >
                  Study lore
                </button>
              </div>
            )}

            {snapshot.world.canForge && (
              <div className="box shop-box forge-armory-box">
                <strong>Forge &amp; armory</strong>
                <p className="shop-gear-buyback-hint">
                  Buy weapons and armor here. Buyback: sell your equipped piece for{" "}
                  <strong>{Math.round(GEAR_SELLBACK_FRACTION * 100)}%</strong> of that tier's list price (you step down
                  one tier).
                </p>
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
                </div>
                <div className="row shop-gear-sell-row">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => gameStore.sellWeaponToShop()}
                    disabled={revivalDebtLock || coopGuest || !weaponDownAfterSell}
                    title={
                      revivalDebtLock
                        ? revivalDebtTitle
                        : weaponDownAfterSell
                          ? `Sell ${WEAPON_STATS[snapshot.player.weapon].name} for ${weaponSellRefund}g (${Math.round(GEAR_SELLBACK_FRACTION * 100)}% of list price). Equip ${WEAPON_STATS[weaponDownAfterSell].name}.`
                          : "You already carry the starter wood sword."
                    }
                  >
                    {weaponDownAfterSell
                      ? `Sell sword (+${weaponSellRefund}g) → ${WEAPON_STATS[weaponDownAfterSell].name}`
                      : "Sell sword (starter)"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => gameStore.sellArmorToShop()}
                    disabled={revivalDebtLock || coopGuest || !armorDownAfterSell}
                    title={
                      revivalDebtLock
                        ? revivalDebtTitle
                        : armorDownAfterSell
                          ? `Sell ${ARMOR_STATS[snapshot.player.armor].name} for ${armorSellRefund}g (${Math.round(GEAR_SELLBACK_FRACTION * 100)}% of list price). Equip ${ARMOR_STATS[armorDownAfterSell].name}.`
                          : "You already wear guild-issue cloth armor."
                    }
                  >
                    {armorDownAfterSell
                      ? `Sell armor (+${armorSellRefund}g) → ${ARMOR_STATS[armorDownAfterSell].name}`
                      : "Sell armor (starter)"}
                  </button>
                </div>
                <p className="forge-temper-hint">
                  Tempering <span className="training-fee">({forgeFee}g)</span> — permanent edge on your weapon.
                </p>
                <button
                  type="button"
                  onClick={() => gameStore.temperAtForge()}
                  disabled={revivalDebtLock || gold < forgeFee}
                  title={revivalDebtLock ? revivalDebtTitle : undefined}
                >
                  Temper weapon
                </button>
              </div>
            )}

            {snapshot.world.canChapel && (
              <div className="box">
                <strong>Chapel</strong>
                <p>Receive a blessing: restore HP. Tithe debt clears only from wild victories.</p>
                <button
                  type="button"
                  onClick={() => gameStore.prayAtChapel()}
                  disabled={gold < 5}
                >
                  Receive blessing (5g)
                </button>
              </div>
            )}

            {snapshot.world.canStables && (
              <div className="box">
                <strong>Stables</strong>
                <p>
                  Buy mounts — each adds <strong>+1 speed</strong> in battle. Current mounts:{" "}
                  <strong>
                    +{mountBonus}/5
                  </strong>
                </p>
                <p className="stable-pet-train-hint">
                  Companion drills level one pet at a time; wait time and fee grow with their current level (cap Lv{" "}
                  {PET_STABLE_MAX_LEVEL}).
                </p>
                {pets.length > 0 ? (
                  <ul className="stable-pet-train-list">
                    {pets.map((pet) => {
                      const train = snapshot.player.petStableTraining;
                      const fee = stablePetTrainFee(pet.level);
                      const durSec = Math.ceil(stablePetTrainDurationMs(pet.level) / 1000);
                      const drilling = train?.petId === pet.id;
                      const now = Date.now();
                      const otherBusy = Boolean(train && train.petId !== pet.id && now < train.readyAt);
                      const waitSec =
                        drilling && train ? Math.max(0, Math.ceil((train.readyAt - now) / 1000)) : 0;
                      const maxed = pet.level >= PET_STABLE_MAX_LEVEL;
                      return (
                        <li key={pet.id} className="stable-pet-train-row">
                          <span className="stable-pet-train-meta">
                            <strong>{pet.name}</strong> · Lv {pet.level}
                            {drilling ? (
                              <span className="stable-pet-train-timer"> — in drills ({waitSec}s)</span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => gameStore.startPetStableTraining(pet.id)}
                            disabled={revivalDebtLock || otherBusy || drilling || maxed || gold < fee}
                            title={
                              revivalDebtLock
                                ? revivalDebtTitle
                                : maxed
                                  ? `Max stable level (${PET_STABLE_MAX_LEVEL}).`
                                  : otherBusy
                                    ? "Another companion is still in drills."
                                    : `Pay ${fee}g · about ${durSec}s`
                            }
                          >
                            {drilling ? "Drilling…" : maxed ? "Max Lv" : `Train (${fee}g, ~${durSec}s)`}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="stable-pet-train-empty">
                    No companions yet — tame monsters in battle or visit the Companion Emporium.
                  </p>
                )}
                <div className="stable-horse-list" role="list">
                  {STABLE_HORSE_ORDER.map((key) => {
                    const h = STABLE_HORSES[key];
                    const owned = horsesOwned.includes(key);
                    const stableFull = horsesOwned.length >= 5;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="listitem"
                        className="stable-horse-btn"
                        onClick={() => gameStore.buyStableHorse(key)}
                        disabled={revivalDebtLock || owned || stableFull || gold < h.price}
                        title={
                          owned
                            ? `${h.name} — owned`
                            : stableFull
                              ? "Stable full (five mounts)."
                              : revivalDebtLock
                                ? revivalDebtTitle
                                : `${h.name} — +1 battle speed (${h.price}g)`
                        }
                      >
                        {owned ? "✓ " : ""}
                        {h.name} ({h.price}g) +1 SPD
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {snapshot.world.canMarket && (
              <div className="box">
                <strong>Market</strong>
                <p>Haggle for a discounted random consumable bundle.</p>
                <button type="button" onClick={() => gameStore.haggleAtMarket()} disabled={revivalDebtLock}>
                  Haggle bundle
                </button>
                <MarketResourceSell revivalDebtLock={revivalDebtLock} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Lists every non-zero gathered resource in the player's forage bag and lets the
 * user unload them at the market. Hidden entirely when the bag is empty so the
 * Market panel stays compact for brand-new saves.
 */
function MarketResourceSell({ revivalDebtLock }: { revivalDebtLock: boolean }) {
  const snapshot = useGameStore();
  const bag = snapshot.player.resources ?? {};
  const rows = RESOURCE_KEYS.map((key) => ({ key, count: bag[key] ?? 0 }))
    .filter((r) => r.count > 0)
    .map((r) => ({ ...r, def: RESOURCES[r.key] }));

  if (rows.length === 0) {
    return (
      <p className="market-forage-empty">
        Forage bag empty — pick flowers, mushrooms, and herbs out in the wilds to sell them back here.
      </p>
    );
  }

  const totalGold = rows.reduce((sum, r) => sum + r.count * r.def.sellPrice, 0);
  const totalCount = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="market-forage">
      <div className="market-forage-head">
        <strong>Forage bag</strong>
        <span>
          {totalCount} item{totalCount === 1 ? "" : "s"} · worth {totalGold}g
        </span>
      </div>
      <ul className="market-forage-list">
        {rows.map(({ key, count, def }) => (
          <li key={key} className="market-forage-row">
            <span
              className="market-forage-swatch"
              style={{
                background: def.colorPrimary,
                boxShadow: `0 0 0 2px ${def.colorAccent} inset`
              }}
              aria-hidden
            />
            <span className="market-forage-name">
              {def.name} <span className="market-forage-count">×{count}</span>
            </span>
            <span className="market-forage-price">{def.sellPrice}g</span>
            <button
              type="button"
              onClick={() => gameStore.sellResource(key as ResourceKey, 1)}
              disabled={revivalDebtLock}
            >
              Sell 1
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="market-forage-sell-all"
        onClick={() => gameStore.sellAllResources()}
        disabled={revivalDebtLock}
      >
        Sell all ({totalGold}g)
      </button>
    </div>
  );
}
