import { ARMOR_STATS, ITEM_DATA, TOWN_MAP, WEAPON_STATS } from "../game/data";
import { gameStore } from "../game/state";
import { STORY_CHAPTERS } from "../game/story";
import { useGameStore } from "../game/useGameStore";

type Props = {
  onOpenJournal: () => void;
  onOpenUgc: () => void;
};

export function PlayfieldActionOverlays({ onOpenJournal, onOpenUgc }: Props) {
  const snapshot = useGameStore();
  if (snapshot.battle.inBattle) {
    return null;
  }

  const gold = snapshot.player.gold;
  const trainFee = 20 + snapshot.player.level * 6;
  const canAffordTraining = gold >= trainFee;
  const hasBuildingContext =
    snapshot.world.canShop ||
    snapshot.world.canHeal ||
    snapshot.world.canTrain ||
    snapshot.world.canGuild ||
    snapshot.world.canBoss;

  return (
    <>
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
              className="ugc-open-btn"
              onClick={onOpenUgc}
              disabled={!snapshot.player.bossDefeated}
              title={
                snapshot.player.bossDefeated
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
              disabled={snapshot.battle.inBattle || !snapshot.player.bossDefeated}
              title={
                snapshot.player.bossDefeated
                  ? undefined
                  : "Defeat the Void Titan in the southeast arena to unlock."
              }
            >
              Reset Game
            </button>
          </div>
        </div>
      </div>

      {hasBuildingContext && (
        <div className="playfield-context-overlay" role="region" aria-label="Building actions">
          <div className="playfield-context-inner">
            {snapshot.world.canShop && (
              <div className="box">
                <strong>Shop</strong>
                <div className="row">
                  <button type="button" onClick={() => gameStore.buyPotion()} disabled={gold < ITEM_DATA.potion.price}>
                    Buy Potion ({ITEM_DATA.potion.price}g)
                  </button>
                  <button type="button" onClick={() => gameStore.buyHiPotion()} disabled={gold < ITEM_DATA.hiPotion.price}>
                    Buy Hi-Potion ({ITEM_DATA.hiPotion.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buyMegaPotion()}
                    disabled={gold < ITEM_DATA.megaPotion.price}
                  >
                    Buy Mega Potion ({ITEM_DATA.megaPotion.price}g)
                  </button>
                  <button type="button" onClick={() => gameStore.buyIronSword()} disabled={gold < WEAPON_STATS.ironSword.price}>
                    Buy Iron Sword ({WEAPON_STATS.ironSword.price}g)
                  </button>
                  <button type="button" onClick={() => gameStore.buySteelSword()} disabled={gold < WEAPON_STATS.steelSword.price}>
                    Buy Steel Sword ({WEAPON_STATS.steelSword.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buyMythrilBlade()}
                    disabled={gold < WEAPON_STATS.mythrilBlade.price}
                  >
                    Buy Mythril Blade ({WEAPON_STATS.mythrilBlade.price}g)
                  </button>
                  <button type="button" onClick={() => gameStore.buyChainMail()} disabled={gold < ARMOR_STATS.chainMail.price}>
                    Buy Chain Mail ({ARMOR_STATS.chainMail.price}g)
                  </button>
                  <button type="button" onClick={() => gameStore.buyKnightArmor()} disabled={gold < ARMOR_STATS.knightArmor.price}>
                    Buy Knight Armor ({ARMOR_STATS.knightArmor.price}g)
                  </button>
                  <button type="button" onClick={() => gameStore.buyDragonArmor()} disabled={gold < ARMOR_STATS.dragonArmor.price}>
                    Buy Dragon Armor ({ARMOR_STATS.dragonArmor.price}g)
                  </button>
                  <button
                    type="button"
                    onClick={() => gameStore.buyTownMap()}
                    disabled={snapshot.player.hasTownMap || gold < TOWN_MAP.price}
                    title={
                      snapshot.player.hasTownMap ? "Already owned." : TOWN_MAP.description
                    }
                  >
                    {snapshot.player.hasTownMap
                      ? `${TOWN_MAP.name} (owned)`
                      : `Buy ${TOWN_MAP.name} (${TOWN_MAP.price}g)`}
                  </button>
                </div>
              </div>
            )}

            {snapshot.world.canHeal && (
              <div className="box">
                <strong>Inn</strong>
                <button
                  type="button"
                  onClick={() => gameStore.healAtInn()}
                  disabled={snapshot.player.hp >= snapshot.player.maxHp}
                >
                  Rest (10g)
                </button>
              </div>
            )}

            {snapshot.world.canTrain && (
              <div className="box">
                <strong>Training Hall</strong> <span className="training-fee">({trainFee}g each)</span>
                <div className="row">
                  <button type="button" onClick={() => gameStore.trainAttack()} disabled={!canAffordTraining}>
                    Train Attack
                  </button>
                  <button type="button" onClick={() => gameStore.trainDefense()} disabled={!canAffordTraining}>
                    Train Defense
                  </button>
                  <button type="button" onClick={() => gameStore.trainSpeed()} disabled={!canAffordTraining}>
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
                  disabled={snapshot.player.monstersDefeated < 4 + snapshot.player.bountyTier * 2}
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
          </div>
        </div>
      )}
    </>
  );
}
