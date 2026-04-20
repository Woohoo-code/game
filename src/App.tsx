import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, lazy, Suspense } from "react";
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
import { AudioMuteButton } from "./ui/AudioMuteButton";
import { MusicToggleButton } from "./ui/MusicToggleButton";
import { BackgroundMusicMount } from "./game/music";
import { FullInventoryScreen } from "./ui/FullInventoryScreen";
import { InventoryBar } from "./ui/InventoryBar";
import { LevelUpCelebration } from "./ui/LevelUpCelebration";
import { SleepSplash } from "./ui/SleepSplash";
import { DOWNLOAD_ROUTE } from "./routes";
import { ShopItemDetailPanel } from "./ui/ShopItemDetailPanel";
import { DevCheatConsole } from "./ui/DevCheatConsole";
import { SkillTreeModal } from "./ui/SkillTreeModal";
import type { ItemKey } from "./game/types";

// Lazy-load the download page so it gets its own small JS chunk (~15 KB instead of
// being bundled with the 2.8 MB main game). This makes the title screen and
// main game load much faster; the download page only loads when visited.
const LazyDownloadPage = lazy(() => import("./ui/DownloadPage"));

/**
 * Feature flag for the 3D prototype overworld.
 * Set to `false` to fall back to the Phaser 2D overworld that lives on the 2d-baseline branch/tag.
 */
const USE_3D_OVERWORLD = true;

/** Viewport wide enough for the larger hotbar layout (compact bar still shows below this). */
const DESKTOP_INVENTORY_MQ = "(min-width: 1024px)";
const UI_SCALE_STORAGE_KEY = "msty-ui-scale";
const UI_SCALE_MIN = 0.8;
const UI_SCALE_MAX = 1.4;
const UI_SCALE_STEP = 0.1;

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function loadUiScalePreference(): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(UI_SCALE_STORAGE_KEY);
    if (raw == null) return 1;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 1;
    return clamp(Math.round(parsed * 10) / 10, UI_SCALE_MIN, UI_SCALE_MAX);
  } catch {
    return 1;
  }
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

function TouchJoystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const resetDirections = useCallback(() => {
    for (const d of ["up", "down", "left", "right"] as MoveDirection[]) {
      inputController.setPressed(d, false);
    }
  }, []);

  const applyFromClientPoint = useCallback((clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const maxR = 32;
    const mag = Math.hypot(dx, dy);
    if (mag > maxR && mag > 0.001) {
      const s = maxR / mag;
      dx *= s;
      dy *= s;
    }
    setKnob({ x: dx, y: dy });

    const dead = 10;
    inputController.setPressed("left", dx < -dead);
    inputController.setPressed("right", dx > dead);
    inputController.setPressed("up", dy < -dead);
    inputController.setPressed("down", dy > dead);
  }, []);

  const finishDrag = useCallback(() => {
    pointerIdRef.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    resetDirections();
  }, [resetDirections]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      pointerIdRef.current = event.pointerId;
      setActive(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      applyFromClientPoint(event.clientX, event.clientY);
    },
    [applyFromClientPoint]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId) return;
      event.preventDefault();
      applyFromClientPoint(event.clientX, event.clientY);
    },
    [applyFromClientPoint]
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId) return;
      event.preventDefault();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      finishDrag();
    },
    [finishDrag]
  );

  useEffect(() => {
    return () => {
      resetDirections();
    };
  }, [resetDirections]);

  const knobStyle: CSSProperties = {
    transform: `translate(${knob.x}px, ${knob.y}px)`
  };

  return (
    <div
      className={`touch-joystick${active ? " touch-joystick--active" : ""}`}
      ref={baseRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
      onContextMenu={(event) => event.preventDefault()}
      aria-label="Movement joystick"
      role="application"
    >
      <div className="touch-joystick-base" />
      <div className="touch-joystick-knob" style={knobStyle} />
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  /** Shown on the title screen when Load Save fails (event log is not visible there). */
  const [titleNotice, setTitleNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [transferPaste, setTransferPaste] = useState("");
  const [journalOpen, setJournalOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [petsOpen, setPetsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [eventLogCollapsed, setEventLogCollapsed] = useState(false);
  const [battleLogCollapsed, setBattleLogCollapsed] = useState(false);
  const [overlayBattleLogCollapsed, setOverlayBattleLogCollapsed] = useState(false);
  const [uiScale, setUiScale] = useState<number>(() => loadUiScalePreference());
  const [selectedShopItem, setSelectedShopItem] = useState<ItemKey | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const snapshot = useGameStore();
  const desktopInventory = useDesktopInventoryBar();
  const overlays = useStoryOverlays();
  const { path, navigate } = useRoute();

  useEffect(() => {
    document.documentElement.style.setProperty("--ui-scale", uiScale.toFixed(2));
    try {
      window.localStorage.setItem(UI_SCALE_STORAGE_KEY, String(uiScale));
    } catch {
      // Ignore storage failures (privacy mode / blocked storage).
    }
  }, [uiScale]);

  if (path === DOWNLOAD_ROUTE) {
    return (
      <Suspense
        fallback={
          <div className="download-page" style={{ background: "#0c1018", color: "#e4eaf4", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh" }}>
            <div style={{ textAlign: "center" }}>
              <div className="download-spinner" />
              <div style={{ fontSize: "1.2rem", marginBottom: "16px", fontWeight: 600 }}>LOADING...</div>
              <div style={{ fontSize: "0.9rem", opacity: 0.7, maxWidth: "260px" }}>
                The download page is being fetched the first time you visit it.
                <br />
                This should be very fast.
              </div>
            </div>
          </div>
        }
      >
        <LazyDownloadPage onBack={() => navigate("/", true)} />
      </Suspense>
    );
  }

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

  useEffect(() => {
    if (snapshot.battle.inBattle && inventoryOpen) {
      setInventoryOpen(false);
    }
  }, [snapshot.battle.inBattle, inventoryOpen]);

  useEffect(() => {
    if (snapshot.battle.inBattle && skillsOpen) {
      setSkillsOpen(false);
    }
  }, [snapshot.battle.inBattle, skillsOpen]);

  // Ctrl/⌘+S → save game. Overrides the browser's "Save Page As…" and the WASD
  // "S" movement binding. Active on the play screen only.
  useEffect(() => {
    if (effectiveScreen !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.altKey || e.shiftKey) return;
      if (e.code !== "KeyS" && e.key !== "s" && e.key !== "S") return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        if (t.isContentEditable || t.closest("input, textarea, select")) return;
      }
      e.preventDefault();
      e.stopPropagation();
      void gameStore.save().catch(() => {
        /* save errors are already logged inside gameStore */
      });
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as AddEventListenerOptions);
  }, [effectiveScreen]);

  useEffect(() => {
    if (effectiveScreen !== "play" || inventoryOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        if (t.isContentEditable || t.closest("input, textarea, select")) return;
      }
      if (e.key !== "i" && e.key !== "I") return;
      const s = gameStore.getSnapshot();
      if (s.battle.inBattle) return;
      if (journalOpen || petsOpen || ugcOpen || skillsOpen) return;
      if (overlays.showPrologue || overlays.showEpilogue || overlays.toastStage) return;
      e.preventDefault();
      setInventoryOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    effectiveScreen,
    inventoryOpen,
    journalOpen,
    petsOpen,
    ugcOpen,
    overlays.showPrologue,
    overlays.showEpilogue,
    overlays.toastStage,
    skillsOpen
  ]);

  useEffect(() => {
    if (effectiveScreen !== "play" || skillsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        if (t.isContentEditable || t.closest("input, textarea, select")) return;
      }
      if (e.key !== "t" && e.key !== "T") return;
      const s = gameStore.getSnapshot();
      if (s.battle.inBattle) return;
      if (journalOpen || petsOpen || ugcOpen || inventoryOpen) return;
      if (overlays.showPrologue || overlays.showEpilogue || overlays.toastStage) return;
      if (s.pendingLevelUpCelebration) return;
      e.preventDefault();
      setSkillsOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    effectiveScreen,
    skillsOpen,
    inventoryOpen,
    journalOpen,
    petsOpen,
    ugcOpen,
    overlays.showPrologue,
    overlays.showEpilogue,
    overlays.toastStage,
    snapshot.pendingLevelUpCelebration
  ]);

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
      // Use functional update so we only navigate if the user is still on the
      // title screen.  If they have already clicked "New hero" (screen="create")
      // while the async load was in flight, we leave them where they are.
      setScreen((prev) => (prev === "title" ? "play" : prev));
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
        <BackgroundMusicMount />
        <div className="title-screen-inner">
          <div className="title-screen-top-actions">
            <MusicToggleButton />
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

          <p className="title-screen-download-line">
            <button
              type="button"
              className="title-screen-download-link"
              onClick={() => navigate(DOWNLOAD_ROUTE)}
            >
              Windows portable app (.exe)
            </button>
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
      <>
        <BackgroundMusicMount />
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
      </>
    );
  }

  const showStoryOverlays = effectiveScreen === "play";

  return (
    <div className="app">
      <BackgroundMusicMount />
      {ugcOpen && <UgcStudio onClose={closeUgc} />}
      {journalOpen && <Journal onClose={() => setJournalOpen(false)} />}
      <FullInventoryScreen
        open={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        coopGuestLocked={false}
      />
      {petsOpen && <PetsPanel onClose={() => setPetsOpen(false)} />}
      {skillsOpen && <SkillTreeModal onClose={() => setSkillsOpen(false)} />}
      {settingsOpen && (
        <div className="story-modal-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}>
          <div
            className="playfield-help-modal settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="playfield-help-modal-head">
              <h2 id="settings-modal-title">Settings</h2>
              <button
                type="button"
                className="playfield-help-modal-close"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                ×
              </button>
            </div>
            <div className="playfield-help-modal-body settings-modal-body">
              <div className="settings-ui-scale-row">
                <div>
                  <strong>UI scale</strong>
                  <p className="settings-ui-scale-hint">Scales HUD, logs, and toolbars.</p>
                </div>
                <div className="settings-ui-scale-controls">
                  <button
                    type="button"
                    onClick={() =>
                      setUiScale((prev) =>
                        clamp(Math.round((prev - UI_SCALE_STEP) * 10) / 10, UI_SCALE_MIN, UI_SCALE_MAX)
                      )
                    }
                    disabled={uiScale <= UI_SCALE_MIN}
                    aria-label="Decrease UI scale"
                  >
                    −
                  </button>
                  <span className="settings-ui-scale-value">{Math.round(uiScale * 100)}%</span>
                  <button
                    type="button"
                    onClick={() =>
                      setUiScale((prev) =>
                        clamp(Math.round((prev + UI_SCALE_STEP) * 10) / 10, UI_SCALE_MIN, UI_SCALE_MAX)
                      )
                    }
                    disabled={uiScale >= UI_SCALE_MAX}
                    aria-label="Increase UI scale"
                  >
                    +
                  </button>
                  <button type="button" className="secondary" onClick={() => setUiScale(1)}>
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <DevCheatConsole />
      {effectiveScreen === "play" && snapshot.pendingLevelUpCelebration && (
        <LevelUpCelebration payload={snapshot.pendingLevelUpCelebration} />
      )}
      {effectiveScreen === "play" && snapshot.sleeping && <SleepSplash />}
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
              <TouchJoystick />
            </div>
          </div>
          <PlayfieldActionOverlays
            onOpenJournal={() => setJournalOpen(true)}
            onOpenInventory={() => setInventoryOpen(true)}
            onOpenSkills={() => setSkillsOpen(true)}
            onOpenUgc={openUgc}
            onOpenPets={() => setPetsOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            selectedShopItem={selectedShopItem}
            onSelectShopItem={setSelectedShopItem}
          />
          {snapshot.battle.inBattle && (
            <BattleOverlay
              battleLogCollapsed={overlayBattleLogCollapsed}
              onToggleBattleLogCollapse={() => setOverlayBattleLogCollapsed((v) => !v)}
            />
          )}
          {effectiveScreen === "play" && (
            <div className="playfield-fullscreen-corner" aria-label="Display options">
              <MusicToggleButton />
              <AudioMuteButton />
              <MobileFullscreenButton />
            </div>
          )}
        </div>
        {effectiveScreen === "play" && (
          <div className={desktopInventory ? "inventory-bar-desktop" : "inventory-bar-compact"}>
            <InventoryBar
              hotkeysBlocked={
                journalOpen ||
                inventoryOpen ||
                skillsOpen ||
                petsOpen ||
                ugcOpen ||
                overlays.showPrologue ||
                overlays.showEpilogue ||
                Boolean(overlays.toastStage) ||
                Boolean(snapshot.pendingLevelUpCelebration)
              }
            />
          </div>
        )}
      </div>

      <div
        className={`right-column panel${
          eventLogCollapsed &&
          battleLogCollapsed &&
          (!snapshot.world.canShop || selectedShopItem == null || snapshot.battle.inBattle)
            ? " right-column--compact"
            : ""
        }`}
      >
        {eventLogCollapsed ? (
          <button
            type="button"
            className="log-collapsed-chip"
            onClick={() => setEventLogCollapsed(false)}
            aria-label="Expand event log"
          >
            Event Log
          </button>
        ) : (
          <div className="box log">
            <div className="log-collapsible-head">
              <strong>Event Log</strong>
              <button
                type="button"
                className="log-collapse-btn"
                onClick={() => setEventLogCollapsed(true)}
                aria-label="Collapse event log"
                title="Collapse"
              >
                —
              </button>
            </div>
            {snapshot.eventLog.map((line, idx) => (
              <p key={`event-${idx}`}>{line}</p>
            ))}
          </div>
        )}
        {!snapshot.battle.inBattle &&
          (battleLogCollapsed ? (
            <button
              type="button"
              className="log-collapsed-chip"
              onClick={() => setBattleLogCollapsed(false)}
              aria-label="Expand battle log"
            >
              Battle Log
            </button>
          ) : (
            <div className="box log">
              <div className="log-collapsible-head">
                <strong>Battle Log</strong>
                <button
                  type="button"
                  className="log-collapse-btn"
                  onClick={() => setBattleLogCollapsed(true)}
                  aria-label="Collapse battle log"
                  title="Collapse"
                >
                  —
                </button>
              </div>
              {snapshot.battle.log.map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          ))}
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
