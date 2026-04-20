import { ITEM_DATA, formatItemTooltipSummary } from "../game/data";
import { itemHotbarAbbr } from "../game/inventoryHotbar";
import { gameStore } from "../game/state";
import type { ItemKey } from "../game/types";

function spriteTier(itemKey: ItemKey): 1 | 2 | 3 | 4 | 5 {
  const h = ITEM_DATA[itemKey].healAmount;
  if (h <= 25) return 1;
  if (h <= 40) return 2;
  if (h <= 60) return 3;
  if (h <= 85) return 4;
  return 5;
}

type Props = {
  itemKey: ItemKey;
  gold: number;
  revivalDebtLock: boolean;
};

export function ShopItemDetailPanel({ itemKey, gold, revivalDebtLock }: Props) {
  const d = ITEM_DATA[itemKey];
  const afford = gold >= d.price;
  const buyDisabled = revivalDebtLock || !afford;
  let buyTitle: string | undefined;
  if (revivalDebtLock) buyTitle = "Guild tithe lock — clear revival debt in the wilds first.";
  else if (!afford) buyTitle = `Need ${d.price}g (you have ${gold}g).`;

  return (
    <div className="box shop-item-detail-panel" aria-label={`${d.name} details`}>
      <div className="shop-item-detail-panel-inner">
        <div
          className={`shop-item-detail-sprite shop-item-detail-sprite--tier${spriteTier(itemKey)}`}
          aria-hidden
        >
          <span className="shop-item-detail-sprite-abbr">{itemHotbarAbbr(itemKey)}</span>
        </div>
        <div className="shop-item-detail-copy">
          <strong className="shop-item-detail-title">{d.name}</strong>
          <p className="shop-item-detail-stats">{formatItemTooltipSummary(itemKey)}</p>
          <p className="shop-item-detail-desc">
            Restores HP when used in the overworld. In battle, the listed fight bonuses apply when used on your turn.
          </p>
        </div>
      </div>
      <div className="shop-item-detail-actions">
        <button
          type="button"
          className="shop-item-detail-buy"
          disabled={buyDisabled}
          title={buyTitle}
          onClick={() => gameStore.purchaseItem(itemKey)}
        >
          Buy ({d.price}g)
        </button>
      </div>
    </div>
  );
}
