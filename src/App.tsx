import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import Phaser from "phaser";
import { GameScene } from "./game/GameScene";
import { inputController, type MoveDirection } from "./game/inputController";
import { UGC_STUDIO_VOID_TITANS_REQUIRED } from "./game/data";
import { gameStore } from "./game/state";
import { CAMPAIGN_TAGLINE } from "./game/story";
import { GAME_VERSION_LABEL } from "./version";
import { useGameStore } from "./game/useGameStore";
import { Overworld3D } from "./game3d/Overworld3D";
import { CharacterCreation } from "./ui/CharacterCreation";
import { TownCompass } from "./ui/TownCompass";
import { UgcStudio } from "./ui/UgcStudio";
import { BattleOverlay } from "./ui/BattleOverlay";
import { PetsPanel } from "./ui/PetsPanel";
import { PlayfieldActionOverlays } from "./ui/PlayfieldActionOverlays";
import { WorldStatusOverlay } from "./ui/WorldStatusOverlay";
import {
  ChapterToast,
  Journal,
  StoryEpilogueModal,
  StoryIntroModal,
  useStoryOverlays
} from "./ui/Journal";
import { MobileFullscreenButton } from "./ui/MobileFullscreenButton";
import { InventoryBar } from "./ui/InventoryBar";
import { ShopItemDetailPanel } from "./ui/ShopItemDetailPanel";
import type { ItemKey } from "./game/types";

/**
 * Feature flag for the 3D prototype overworld.
 * Set to `false` to fall back to the Phaser 2D overworld that lives on the 2d-baseline branch/tag.
 */
const USE_3D_OVERWORLD = true;

/** Viewport wide enough for the larger hotbar layout (compact bar still shows below this). */
const DESKTOP_INVENTORY_MQ = "(min-width: 1024px)";

function useDesktopInventoryBar(): boolean {
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(DESKTOP_INVENTORY_MQ).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_INVENTORY_MQ);
    const fn = () => setWide(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return wide;
}

type Screen = "title" | "create" | "play";

/**
 * Minimal URL-synced router (no extra dependency).
 *
 * Listens for back/forward via `popstate` and exposes a `navigate(to, replace?)`
 * helper that mirrors the call to `history.pushState` / `replaceState`. We only
 * care about `location.pathname`; search/hash are left untouched.
 */
function useRoute() {
  const [path, setPath] = useState<string>(() =>
    typeof window === "undefined" ? "/" : window.location.pathname || "/"
  );

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || "/");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string, replace = false) => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === to) return;
    if (replace) {
      window.history.replaceState(null, "", to);
    } else {
      window.history.pushState(null, "", to);
    }
    setPath(to);
  }, []);

  return { path, navigate };
}

function DirButton({ dir, label, className }: { dir: MoveDirection; label: string; className?: string }) {
  const press = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    inputController.setPressed(dir, true);
  };
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    inputController.setPressed(dir, false);
  };

  return (
    <button
      className={["dir-btn", className].filter(Boolean).join(" ")}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  /** Shown on the title screen when Load Save fails (event log is not visible there). */
  const [titleNotice, setTitleNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [transferPaste, setTransferPaste] = useState("");
  const [journalOpen, setJournalOpen] = useState(false);
  const [petsOpen, setPetsOpen] = useState(false);
  const [selectedShopItem, setSelectedShopItem] = useState<ItemKey | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const snapshot = useGameStore();
  const desktopInventory = useDesktopInventoryBar();
  const overlays = useStoryOverlays();
  const { path, navigate } = useRoute();

  // The UGC Studio is rendered when the URL is `/ugc`.
  // Gating: character created *and* two Void Titan wins (second realm's boss).
  // If either condition fails, silently redirect back to `/` so a direct visit
  // to /ugc never shows a half-state view.
  const ugcRequested = path === "/ugc";
  const ugcAllowed =
    snapshot.player.hasCreatedCharacter &&
    snapshot.player.voidTitansDefeated >= UGC_STUDIO_VOID_TITANS_REQUIRED;
  const ugcOpen = ugcRequested && ugcAllowed;

  useEffect(() => {
    if (ugcRequested && !ugcAllowed) {
      navigate("/", true);
    }
  }, [ugcRequested, ugcAllowed, navigate]);

  useEffect(() => {
    if (snapshot.battle.inBattle || !snapshot.world.canShop) {
      setSelectedShopItem(null);
    }
  }, [snapshot.battle.inBattle, snapshot.world.canShop]);

  // Open the UGC URL directly should bypass the title screen — if the player
  // already has a character, render the play backdrop beneath the studio
  // overlay on the very first frame (no flash of title screen).
  const effectiveScreen: Screen =
    ugcOpen && snapshot.player.hasCreatedCharacter ? "play" : screen;

  useEffect(() => {
    document.documentElement.setAttribute("data-app-screen", effectiveScreen);
    return () => document.documentElement.removeAttribute("data-app-screen");
  }, [effectiveScreen]);

  const openUgc = useCallback(() => navigate("/ugc"), [navigate]);
  const closeUgc = useCallback(() => navigate("/"), [navigate]);

  useEffect(() => {
    if (screen !== "play") {
      return;
    }
    if (USE_3D_OVERWORLD) {
      return;
    }
    if (!mountRef.current) {
      return;
    }
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mountRef.current,
      width: 640,
      height: 448,
      backgroundColor: "#1b2330",
      scene: [GameScene]
    });
    gameRef.current = game;
    return () => {
      inputController.clear();
      game.destroy(true);
      gameRef.current = null;
    };
  }, [screen]);

  const handlePlay = () => {
    setTitleNotice(null);
    if (snapshot.player.hasCreatedCharacter) {
      setScreen("play");
    } else {
      setScreen("create");
    }
  };

  const handleLoad = async () => {
    setTitleNotice(null);
    const loaded = await gameStore.load();
    if (loaded) {
      setScreen("play");
    } else {
      setTitleNotice({
        text: "No save found in this browser. Start with New hero, or paste a transfer line from another device.",
        error: true
      });
    }
  };

  const handleTitleExportTransfer = async () => {
    setTitleNotice(null);
    const ok = await gameStore.exportTransferCode();
    setTitleNotice({
      text: ok
        ? "Copied one transfer line to the clipboard. On the other device, paste that entire line below and tap Import transfer. (A 10-digit key appears in the line for your notes.)"
        : "Could not copy — allow clipboard access for this site, or use Copy transfer from inside the game.",
      error: !ok
    });
  };

  const handleTitleImportTransfer = async () => {
    setTitleNotice(null);
    const r = await gameStore.importTransferCode(transferPaste);
    if (r.ok) {
      setTransferPaste("");
      setScreen("play");
    } else {
      setTitleNotice({ text: r.error, error: true });
    }
  };

  if (effectiveScreen === "title") {
    const hasChar = snapshot.player.hasCreatedCharacter;
    return (
      <div className="title-screen" role="document" aria-label="Monster Slayer — sign in or start">
        <div className="title-screen-inner">
          <div className="title-screen-top-actions">
            <MobileFullscreenButton />
          </div>
          <h1 className="title-screen-logo">Monster Slayer</h1>
          <p className="title-screen-version" aria-label={`Release ${GAME_VERSION_LABEL}`}>
            {GAME_VERSION_LABEL}
          </p>
          <p className="title-screen-tagline">Roam the wilds, brave towns, and cut down what lurks beyond the road.</p>
          <p className="title-screen-campaign-goal" title={CAMPAIGN_TAGLINE}>
            {CAMPAIGN_TAGLINE}
          </p>

          <div className="title-screen-gate" role="group" aria-label="Start or restore a game">
            <section className="title-screen-panel" aria-labelledby="title-login-heading">
              <h2 id="title-login-heading" className="title-screen-panel-title">
                Log in
              </h2>
              <p className="title-screen-panel-hint">Restore progress saved in this browser.</p>
              <button type="button" className="title-screen-secondary title-screen-panel-btn" onClick={handleLoad}>
                Load save
              </button>
              {hasChar && (
                <>
                  <p className="title-screen-transfer-inline-hint">
                    <strong>Another device:</strong> copies one line with a random <strong>10-digit</strong> key plus your
                    full save — paste that line on the other machine below.
                  </p>
                  <button
                    type="button"
                    className="title-screen-secondary title-screen-panel-btn title-screen-transfer-copy"
                    onClick={() => void handleTitleExportTransfer()}
                  >
                    Copy transfer line
                  </button>
                </>
              )}
            </section>
            <div className="title-screen-gate-divider" aria-hidden="true">
              <span>or</span>
            </div>
            <section className="title-screen-panel" aria-labelledby="title-signup-heading">
              <h2 id="title-signup-heading" className="title-screen-panel-title">
                {hasChar ? "Continue" : "Sign up"}
              </h2>
              <p className="title-screen-panel-hint">
                {hasChar
                  ? "Resume your hero where you left off."
                  : "Create a new hero — looks, name, then into the wilds."}
              </p>
              <button type="button" className="title-screen-play title-screen-panel-btn" onClick={handlePlay}>
                {hasChar ? "Continue adventure" : "New hero"}
              </button>
            </section>
          </div>

          <section className="title-screen-panel title-screen-transfer" aria-labelledby="title-transfer-heading">
            <h2 id="title-transfer-heading" className="title-screen-panel-title">
              Import from another device
            </h2>
            <p className="title-screen-panel-hint">
              Paste the <strong>entire</strong> line you copied (it begins with <code className="title-screen-code">MS1|</code> and
              includes a 10-digit key and the save). Then import — this also writes the save in this browser.
            </p>
            <textarea
              className="title-transfer-textarea"
              rows={4}
              value={transferPaste}
              onChange={(e) => setTransferPaste(e.target.value)}
              placeholder="MS1|0123456789|…"
              spellCheck={false}
              autoComplete="off"
              aria-label="Paste transfer line from another device"
            />
            <button type="button" className="title-screen-play title-screen-panel-btn" onClick={() => void handleTitleImportTransfer()}>
              Import transfer
            </button>
          </section>

          {titleNotice && (
            <p
              className={`title-screen-feedback ${titleNotice.error ? "title-screen-feedback--err" : "title-screen-feedback--ok"}`}
              role="status"
            >
              {titleNotice.text}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (effectiveScreen === "create") {
    return (
      <CharacterCreation
        onDone={() => {
          setTitleNotice(null);
          setScreen("play");
        }}
        onBack={() => {
          setTitleNotice(null);
          setScreen("title");
        }}
      />
    );
  }

  const showStoryOverlays = effectiveScreen === "play";

  return (
    <div className="app">
      {ugcOpen && <UgcStudio onClose={closeUgc} />}
      {journalOpen && <Journal onClose={() => setJournalOpen(false)} />}
      {petsOpen && <PetsPanel onClose={() => setPetsOpen(false)} />}
      {showStoryOverlays && overlays.showPrologue && (
        <StoryIntroModal onDismiss={() => gameStore.dismissPrologue()} />
      )}
      {showStoryOverlays && overlays.showEpilogue && (
        <StoryEpilogueModal onDismiss={() => gameStore.dismissEpilogue()} />
      )}
      {showStoryOverlays && overlays.toastStage && (
        <ChapterToast stage={overlays.toastStage} onDone={overlays.dismissToast} />
      )}
      <div className="main-column">
        <div className="game-wrap">
          <div className="app-mobile-fs-bar">
            <MobileFullscreenButton />
          </div>
          <div className="game-viewport">
            {USE_3D_OVERWORLD ? (
              <Overworld3D />
            ) : (
              <div ref={mountRef} className="phaser-mount" />
            )}
          </div>
          <div className="playfield-right-stack" aria-label="Map overlays">
            <TownCompass />
            {!snapshot.battle.inBattle && <WorldStatusOverlay />}
            <div className="touch-overlay">
              <div className="touch-pad touch-pad-arrow" aria-label="Movement">
                <DirButton dir="up" label="↑" className="dir-btn-up" />
                <DirButton dir="left" label="←" className="dir-btn-left" />
                <DirButton dir="down" label="↓" className="dir-btn-down" />
                <DirButton dir="right" label="→" className="dir-btn-right" />
              </div>
            </div>
          </div>
          <PlayfieldActionOverlays
            onOpenJournal={() => setJournalOpen(true)}
            onOpenUgc={openUgc}
            onOpenPets={() => setPetsOpen(true)}
            selectedShopItem={selectedShopItem}
            onSelectShopItem={setSelectedShopItem}
          />
          {snapshot.battle.inBattle && <BattleOverlay />}
        </div>
        {effectiveScreen === "play" && (
          <div className={desktopInventory ? "inventory-bar-desktop" : "inventory-bar-compact"}>
            <InventoryBar
              hotkeysBlocked={
                journalOpen ||
                petsOpen ||
                ugcOpen ||
                overlays.showPrologue ||
                overlays.showEpilogue ||
                Boolean(overlays.toastStage)
              }
            />
          </div>
        )}
      </div>

      <div className="right-column panel">
        <div className="box log">
          <strong>Event Log</strong>
          {snapshot.eventLog.map((line, idx) => (
            <p key={`event-${idx}`}>{line}</p>
          ))}
        </div>
        {!snapshot.battle.inBattle && (
          <div className="box log">
            <strong>Battle Log</strong>
            {snapshot.battle.log.map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
        )}
        {!snapshot.battle.inBattle &&
          snapshot.world.canShop &&
          selectedShopItem != null && (
            <ShopItemDetailPanel
              itemKey={selectedShopItem}
              gold={snapshot.player.gold}
              revivalDebtLock={(snapshot.player.revivalDebtMonstersRemaining ?? 0) > 0}
            />
          )}
      </div>
    </div>
  );
}
