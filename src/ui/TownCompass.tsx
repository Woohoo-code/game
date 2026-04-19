import { useMemo } from "react";
import { useGameStore } from "../game/useGameStore";
import { TILE, nearestTown } from "../game/worldMap";

/**
 * Floating compass overlay, rendered in the top-right stack with the world HUD
 * and touch controls (see `playfield-right-stack` in App).
 *
 * Visibility rules:
 *   - Hidden until the player buys the Town Map and chooses Equip Map at a shop.
 *   - Hidden whenever the player is standing on a town tile (no need for it!).
 *   - Hidden during battle so it doesn't clutter the combat UI.
 *
 * The needle rotates to point at the nearest town center. A small distance
 * readout under the dial tells the player how many tiles away home is.
 */
export function TownCompass() {
  const snapshot = useGameStore();

  // Early-out BEFORE computing angle when we don't need to render anything.
  const mapOut =
    snapshot.player.hasTownMap && (snapshot.player.townMapEquipped ?? false);
  const shouldRender = mapOut && !snapshot.world.inTown && !snapshot.battle.inBattle;

  // Recompute angle on every render (cheap). `useGameStore` re-renders on every
  // emit, which includes every tile-step of movement, so the needle stays live.
  const compass = useMemo(() => {
    if (!shouldRender) return null;
    const tileX = snapshot.player.x / TILE;
    const tileY = snapshot.player.y / TILE;
    const target = nearestTown(tileX, tileY);
    if (!target) return null;
    const toward = target.name;
    const dx = target.x - tileX;
    const dy = target.y - tileY;
    // atan2 returns radians in world/tile space where +y is "south" (down on screen).
    // Our arrow SVG is drawn pointing straight up (→ rotation of 0° means north).
    // We want rotation such that:
    //   east  (dx > 0, dy = 0)  → +90°
    //   south (dx = 0, dy > 0)  → 180°
    //   west  (dx < 0, dy = 0)  → 270° (or -90°)
    //   north (dx = 0, dy < 0)  →   0°
    const rad = Math.atan2(dy, dx); // east=0, south=+π/2, west=±π, north=-π/2
    const deg = (rad * 180) / Math.PI + 90; // shift so north = 0°
    return { angle: deg, distance: Math.round(target.distance), toward };
  }, [shouldRender, snapshot.player.x, snapshot.player.y]);

  if (!compass) return null;

  const { angle, distance, toward } = compass;
  const veryClose = distance <= 1;

  return (
    <div className="town-compass" role="img" aria-label={`Nearest settlement is ${toward}, about ${distance} tiles away`}>
      <div className="town-compass-dial">
        <span className="town-compass-tick n">N</span>
        <span className="town-compass-tick e">E</span>
        <span className="town-compass-tick s">S</span>
        <span className="town-compass-tick w">W</span>
        <svg
          className="town-compass-needle"
          viewBox="-10 -22 20 44"
          style={{ transform: `rotate(${angle}deg)` }}
          aria-hidden="true"
        >
          <polygon points="0,-18 -6,8 0,3 6,8" fill="#d9434b" stroke="#3a0a0c" strokeWidth="1" />
          <polygon points="0,18 -5,3 0,8 5,3" fill="#e4dcc0" stroke="#2a2418" strokeWidth="1" />
          <circle r="2.4" fill="#2a2418" />
        </svg>
      </div>
      <div className={`town-compass-label${veryClose ? " close" : ""}`}>
        {veryClose ? `${toward} · here` : `Toward ${toward} · ${distance}t`}
      </div>
    </div>
  );
}
