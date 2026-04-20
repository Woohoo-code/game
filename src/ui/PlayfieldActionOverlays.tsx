import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
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
  overworldHorseWalkSpeedMultiplier,
  stableHorseSpeedBonus,
  stablePetTrainDurationMs,
  stablePetTrainFee,
  bossEnemyForRealm
} from "../game/data";
import { gameStore } from "../game/state";
import { STORY_CHAPTERS } from "../game/story";
import { innPatronRotationBucket, innPatronsForTown, type InnPatronAction } from "../game/townNpcs";
import { useGameStore } from "../game/useGameStore";
import { TILE, getTowns, townAtTile } from "../game/worldMap";
import { currentDungeonFloor } from "../game/dungeon";
import type { ItemKey, ResourceKey } from "../game/types";

const PLAYFIELD_HELP_BODY = (
  <>
    <p>
      <strong>Save</strong> writes your progress in town — use <kbd>Ctrl</kbd>+<kbd>S</kbd> (Windows/Linux) or{" "}
      <kbd>⌘</kbd>+<kbd>S</kbd> (Mac). Plain <kbd>S</kbd> is not bound so movement keys stay reliable.
    </p>
    <p>
      <strong>Items vs gear:</strong> the general merchant sells consumables and maps; the forge sells weapons and armor
      (and buyback). Use the backpack or <strong>Inventory</strong> (<kbd>I</kbd>) to manage your hotbar.
    </p>
    <p>
      In battle, <strong>Space</strong> (or <strong>Shift</strong>) attacks; <kbd>E</kbd> dodges and <kbd>B</kbd> braces.
      Hotbar digits work on your turn. Open <strong>Skills</strong> (<kbd>T</kbd>) on the overworld to spend skill points on
      your arcane tree.
    </p>
  </>
);

function keyboardTargetIsTyping(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

type Props = {
  onOpenJournal: () => void;
  onOpenInventory: () => void;
  onOpenSkills: () => void;
  onOpenUgc: () => void;
  onOpenPets: () => void;
  onOpenSettings: () => void;
  /** Shop consumable grid: selected item for the detail panel (not an immediate purchase). */
  selectedShopItem: ItemKey | null;
  onSelectShopItem: Dispatch<SetStateAction<ItemKey | null>>;
};

export function PlayfieldActionOverlays({
  onOpenJournal,
  onOpenInventory,
  onOpenSkills,
  onOpenUgc,
  onOpenPets,
  onOpenSettings,
  selectedShopItem,
  onSelectShopItem
}: Props) {
  const snapshot = useGameStore();
  const coopGuest = false;
  const [playfieldHelpOpen, setPlayfieldHelpOpen] = useState(false);
  const [merchantHintOpen, setMerchantHintOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key !== "s" && e.key !== "S") return;
      if (keyboardTargetIsTyping(e.target)) return;
      e.preventDefault();
      const s = gameStore.getSnapshot();
      if (!s.world.inTown || !s.hasUnsavedChanges) return;
      void gameStore.save();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

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
  const mountWalkPct = Math.round((overworldHorseWalkSpeedMultiplier(horsesOwned) - 1) * 100);
  const realmBoss = bossEnemyForRealm(snapshot.world.realmTier ?? 1);
  const hasBuildingContext =
    snapshot.world.canShop ||
    snapshot.world.canPetShop ||
    snapshot.world.canHeal ||
    snapshot.world.canTrain ||
    snapshot.world.canGuild ||
    snapshot.world.canThrone ||
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
    snapshot.world.canEnterThroneHall ||
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
            <div className="row playfield-dock-help-row">
              <button
                type="button"
                className="playfield-dock-help-btn"
                onClick={() => setPlayfieldHelpOpen(true)}
                title="Keyboard shortcuts and how shops work"
              >
                Help
              </button>
            </div>
            <div className="row">
              <button
                type="button"
                className="playfield-save-btn"
                onClick={() => gameStore.save()}
                disabled={!snapshot.world.inTown || !snapshot.hasUnsavedChanges}
                title={
                  !snapshot.world.inTown
                    ? "Save is only available in town."
                    : !snapshot.hasUnsavedChanges
                      ? "Nothing new to save since your last save."
                      : "Save to this browser (Ctrl+S or ⌘+S)"
                }
              >
                <span className="playfield-save-btn-label">Save</span>
                <span className="playfield-save-btn-kbd" aria-hidden>
                  Ctrl+S
                </span>
              </button>
              <button type="button" onClick={() => gameStore.load()}>
                Load
              </button>
              <button type="button" onClick={onOpenSettings}>
                Settings
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
                onClick={onOpenSkills}
                title="Skill tree — spend skill points (shortcut T)"
              >
                Skills
                {(snapshot.player.skillPoints ?? 0) > 0 && (
                  <span className="journal-open-badge">{snapshot.player.skillPoints}</span>
                )}
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
                    : "Defeat two realm guardians (beat one, cross the rift, beat the next realm's boss) to unlock UGC Studio."
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
                  snapshot.player.voidTitansDefeated >= 1 ? undefined : "Defeat a realm guardian in the arena to unlock."
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
                <div className="shop-box-head-row">
                  <strong>General merchant</strong>
                  <button
                    type="button"
                    className="shop-hint-help-btn"
                    onClick={() => setMerchantHintOpen(true)}
                    title="What the general merchant sells"
                  >
                    Help
                  </button>
                </div>
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
              <div className="box inn-taproom-box">
                <strong>Inn</strong>
                <button
                  type="button"
                  onClick={() => gameStore.healAtInn()}
                  disabled={revivalDebtLock || snapshot.player.hp >= snapshot.player.maxHp}
                  title={revivalDebtLock ? revivalDebtTitle : undefined}
                >
                  Rest (10g)
                </button>
                {(() => {
                  const tx = Math.floor(snapshot.player.x / TILE);
                  const ty = Math.floor(snapshot.player.y / TILE);
                  const here = townAtTile(tx, ty);
                  const towns = getTowns();
                  const townIx: 0 | 1 =
                    !here || towns.length < 2 || (towns[0]!.x === here.x && towns[0]!.y === here.y) ? 0 : 1;
                  const bucket = innPatronRotationBucket(snapshot.world.worldTime ?? 0);
                  const patrons = innPatronsForTown(snapshot.world.worldSeed ?? 0, townIx, bucket);
                  const used = new Set(snapshot.player.npcPatronsUsed ?? []);
                  const call = (slot: number, action: InnPatronAction) => gameStore.interactInnPatron(slot, action);
                  return (
                    <div className="inn-patrons">
                      <p className="inn-patrons-lede">
                        Taproom patrons swap stories as the lamps dim — coin, fear, favors, and lies all spend the same
                        here.
                      </p>
                      {patrons.map((npc) => {
                        const slotUsed = used.has(String(npc.slot));
                        return (
                          <div key={`${bucket}-${npc.slot}`} className="inn-patron-card">
                            <div className="inn-patron-head">
                              <strong>{npc.name}</strong>
                              <span className="inn-patron-role">{npc.role}</span>
                            </div>
                            <p className="inn-patron-carries">Carries: {npc.carries}</p>
                            <div className="inn-patron-actions">
                              <button
                                type="button"
                                disabled={revivalDebtLock || slotUsed || gold < npc.bribeGold}
                                title={revivalDebtLock ? revivalDebtTitle : `Pay ${npc.bribeGold}g for contraband`}
                                onClick={() => call(npc.slot, "bribe")}
                              >
                                Bribe ({npc.bribeGold}g)
                              </button>
                              <button
                                type="button"
                                disabled={revivalDebtLock || slotUsed}
                                title="Cow them with a hard stare — may pay out or cost you"
                                onClick={() => call(npc.slot, "intimidate")}
                              >
                                Intimidate
                              </button>
                              <button
                                type="button"
                                disabled={revivalDebtLock || slotUsed || gold < npc.recruitGold}
                                title={revivalDebtLock ? revivalDebtTitle : `Hire for ${npc.recruitGold}g — +2 ATK in wild fights`}
                                onClick={() => call(npc.slot, "recruit")}
                              >
                                Recruit ({npc.recruitGold}g)
                              </button>
                              <button
                                type="button"
                                disabled={revivalDebtLock || slotUsed}
                                title="Lean on gossip and half-truths — safer steps if they crack"
                                onClick={() => call(npc.slot, "manipulate")}
                              >
                                Manipulate
                              </button>
                            </div>
                            {slotUsed ? <p className="inn-patron-spent">Done with you tonight.</p> : null}
                          </div>
                        );
                      })}
                      {(snapshot.player.npcMercenaryBattlesLeft ?? 0) > 0 ? (
                        <p className="inn-merc-note">
                          Hired muscle: <strong>{snapshot.player.npcMercenaryBattlesLeft}</strong> wild fight
                          {(snapshot.player.npcMercenaryBattlesLeft ?? 0) === 1 ? "" : "s"} left (+2 ATK each).
                        </p>
                      ) : null}
                    </div>
                  );
                })()}
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

            {snapshot.world.canThrone && (
              <div className="box king-throne-box">
                <strong>The King</strong>
                <p className="king-throne-flavor">
                  His Majesty pays those who thin the wilds. Return after fresh kills for gold, royal recognition, and a
                  blessing upon your arms.
                </p>
                <p>
                  Hunts since last audience:{" "}
                  {Math.max(0, (snapshot.player.kingAudienceTally ?? 0) - (snapshot.player.kingAudienceTallyLastClaim ?? 0))}
                  /8
                </p>
                <button
                  type="button"
                  onClick={() => gameStore.claimKingFavor()}
                  disabled={
                    revivalDebtLock ||
                    (snapshot.player.kingAudienceTally ?? 0) - (snapshot.player.kingAudienceTallyLastClaim ?? 0) < 8
                  }
                  title={revivalDebtLock ? revivalDebtTitle : undefined}
                >
                  Receive royal favor
                </button>
              </div>
            )}

            {snapshot.world.canBoss && (
              <div className="box boss-arena">
                <strong>Void Arena</strong>
                <p className="boss-arena-hint">The realm guardian awaits — {realmBoss.name}.</p>
                <button
                  type="button"
                  onClick={() => gameStore.challengeBoss()}
                  disabled={snapshot.battle.inBattle || snapshot.player.bossDefeated}
                >
                  {snapshot.player.bossDefeated ? `${realmBoss.name} defeated` : `Challenge ${realmBoss.name}`}
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

            {snapshot.world.canEnterThroneHall && (
              <div className="box throne-hall-entrance">
                <strong>Royal Hall</strong>
                <p className="boss-arena-hint">The Royal Hall doors stand open — petitioners walk the long carpet to the throne.</p>
                <button type="button" onClick={() => gameStore.enterThroneHall()} disabled={snapshot.battle.inBattle}>
                  Enter the Royal Hall
                </button>
              </div>
            )}

            {snapshot.world.inDungeon && snapshot.world.dungeon && snapshot.world.dungeon.kind !== "throneHall" && (
              <div className="box dungeon-depth-hud">
                <strong>Crypt depth</strong>
                <p>
                  Floor <strong>{snapshot.world.dungeon.levelIndex + 1}</strong> of{" "}
                  <strong>{snapshot.world.dungeon.depth}</strong>
                </p>
                <p className="boss-arena-hint">
                  Step on violet stairs to go deeper; green stairs climb toward the exit level.
                </p>
              </div>
            )}

            {snapshot.world.inDungeon && snapshot.world.dungeon && (
              (() => {
                const floor = currentDungeonFloor(snapshot.world.dungeon);
                if (!floor) return null;
                const ptx = Math.floor(snapshot.player.x / TILE);
                const pty = Math.floor(snapshot.player.y / TILE);
                // Chests block movement, so the player ends up on an adjacent
                // tile when they bump into one. Detect chests within Chebyshev
                // distance 1 so the "Open" button stays visible for the whole
                // approach instead of flickering for a single frame.
                const chestNearby = floor.chests.find(
                  (c) =>
                    !c.opened &&
                    Math.abs(c.tx - ptx) <= 1 &&
                    Math.abs(c.ty - pty) <= 1
                );
                if (!chestNearby) return null;
                return (
                  <div className="box">
                    <strong>Treasure chest</strong>
                    <p className="boss-arena-hint">
                      A sturdy chest blocks the way. Crack the lid to claim the haul.
                    </p>
                    <button
                      type="button"
                      onClick={() => gameStore.openDungeonChest(chestNearby.id)}
                      disabled={snapshot.battle.inBattle}
                    >
                      Open chest
                    </button>
                  </div>
                );
              })()
            )}

            {snapshot.world.canDescendStairs && snapshot.world.dungeon && (
              <div className="box">
                <strong>Descending stairs</strong>
                <p className="boss-arena-hint">
                  Cold air rises from the steps below — floor{" "}
                  <strong>{snapshot.world.dungeon.levelIndex + 2}</strong> of{" "}
                  <strong>{snapshot.world.dungeon.depth}</strong> waits in the dark.
                </p>
                <button
                  type="button"
                  onClick={() => gameStore.descendStairs()}
                  disabled={snapshot.battle.inBattle}
                >
                  Go deeper
                </button>
              </div>
            )}

            {snapshot.world.canAscendStairs && snapshot.world.dungeon && (
              <div className="box">
                <strong>Ascending stairs</strong>
                <p className="boss-arena-hint">
                  The stone spirals up toward floor{" "}
                  <strong>{snapshot.world.dungeon.levelIndex}</strong> of{" "}
                  <strong>{snapshot.world.dungeon.depth}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => gameStore.ascendStairs()}
                  disabled={snapshot.battle.inBattle}
                >
                  Climb up
                </button>
              </div>
            )}

            {snapshot.world.canLeaveDungeon && (
              (() => {
                const inThroneHall =
                  snapshot.world.inDungeon && snapshot.world.dungeon?.kind === "throneHall";
                return (
                  <div className="box return-rift">
                    <strong>{inThroneHall ? "Royal Hall doors" : "Dungeon stairs"}</strong>
                    <p className="boss-arena-hint">
                      {inThroneHall
                        ? "The heavy oak doors are just behind you — step out to return to the courtyard."
                        : "Warm air drifts down from the surface. Climb back up to the overworld — your haul comes with you."}
                    </p>
                    <button
                      type="button"
                      onClick={() => gameStore.leaveDungeon()}
                      disabled={snapshot.battle.inBattle}
                    >
                      {inThroneHall ? "Leave the Royal Hall" : "Leave dungeon"}
                    </button>
                  </div>
                );
              })()
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
                  Buy mounts — each adds <strong>+12% overworld walk speed</strong> (max five). Current travel bonus:{" "}
                  <strong>
                    +{mountWalkPct}% ({mountBonus}/5 mounts)
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
                                : `${h.name} — +12% overworld walk (${h.price}g)`
                        }
                      >
                        {owned ? "✓ " : ""}
                        {h.name} ({h.price}g) +walk
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

      {playfieldHelpOpen && (
        <div className="story-modal-backdrop" role="presentation" onClick={() => setPlayfieldHelpOpen(false)}>
          <div
            className="playfield-help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="playfield-help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="playfield-help-modal-head">
              <h2 id="playfield-help-title">Help</h2>
              <button
                type="button"
                className="playfield-help-modal-close"
                onClick={() => setPlayfieldHelpOpen(false)}
                aria-label="Close help"
              >
                ×
              </button>
            </div>
            <div className="playfield-help-modal-body">{PLAYFIELD_HELP_BODY}</div>
          </div>
        </div>
      )}

      {merchantHintOpen && (
        <div className="story-modal-backdrop" role="presentation" onClick={() => setMerchantHintOpen(false)}>
          <div
            className="playfield-help-modal playfield-merchant-hint-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="merchant-hint-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="playfield-help-modal-head">
              <h2 id="merchant-hint-title">General merchant</h2>
              <button
                type="button"
                className="playfield-help-modal-close"
                onClick={() => setMerchantHintOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="playfield-help-modal-body">
              <p>
                Consumables and maps only — assign favorites on the hotbar (keys 1–9, 0, or numpad) or from the backpack.
                Weapons and armor are sold at the <strong>forge</strong>.
              </p>
            </div>
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
