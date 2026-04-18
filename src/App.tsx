import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import Phaser from "phaser";
import { GameScene } from "./game/GameScene";
import { inputController, type MoveDirection } from "./game/inputController";
import { gameStore } from "./game/state";
import { useGameStore } from "./game/useGameStore";
import { Overworld3D } from "./game3d/Overworld3D";
import { CharacterCreation } from "./ui/CharacterCreation";
import { TownCompass } from "./ui/TownCompass";
import { UgcStudio } from "./ui/UgcStudio";
import { BattleOverlay } from "./ui/BattleOverlay";
import { PlayfieldActionOverlays } from "./ui/PlayfieldActionOverlays";
import { WorldStatusOverlay } from "./ui/WorldStatusOverlay";
import {
  ChapterToast,
  Journal,
  StoryEpilogueModal,
  StoryIntroModal,
  useStoryOverlays
} from "./ui/Journal";

/**
 * Feature flag for the 3D prototype overworld.
 * Set to `false` to fall back to the Phaser 2D overworld that lives on the 2d-baseline branch/tag.
 */
const USE_3D_OVERWORLD = true;

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
  const [journalOpen, setJournalOpen] = useState(false);
  const gameRef = useRef<Phaser.Game | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const snapshot = useGameStore();
  const overlays = useStoryOverlays();
  const { path, navigate } = useRoute();

  // The UGC Studio is rendered when the URL is `/ugc`.
  // Gating: the player must have created a character *and* defeated the boss.
  // If either condition fails, silently redirect back to `/` so a direct visit
  // to /ugc never shows a half-state view.
  const ugcRequested = path === "/ugc";
  const ugcAllowed =
    snapshot.player.hasCreatedCharacter && snapshot.player.bossDefeated;
  const ugcOpen = ugcRequested && ugcAllowed;

  useEffect(() => {
    if (ugcRequested && !ugcAllowed) {
      navigate("/", true);
    }
  }, [ugcRequested, ugcAllowed, navigate]);

  // Open the UGC URL directly should bypass the title screen — if the player
  // already has a character, render the play backdrop beneath the studio
  // overlay on the very first frame (no flash of title screen).
  const effectiveScreen: Screen =
    ugcOpen && snapshot.player.hasCreatedCharacter ? "play" : screen;

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
    if (snapshot.player.hasCreatedCharacter) {
      setScreen("play");
    } else {
      setScreen("create");
    }
  };

  const handleLoad = async () => {
    const loaded = await gameStore.load();
    if (loaded) {
      setScreen("play");
    }
  };

  if (effectiveScreen === "title") {
    return (
      <div className="title-screen">
        <div className="title-screen-inner">
          <h1 className="title-screen-logo">Monster Slayer</h1>
          <p className="title-screen-tagline">Roam the wilds, brave towns, and cut down what lurks beyond the road.</p>
          <div className="title-screen-actions">
            <button type="button" className="title-screen-play" onClick={handlePlay}>
              {snapshot.player.hasCreatedCharacter ? "Continue" : "New Game"}
            </button>
            <button type="button" className="title-screen-secondary" onClick={handleLoad}>
              Load Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (effectiveScreen === "create") {
    return <CharacterCreation onDone={() => setScreen("play")} onBack={() => setScreen("title")} />;
  }

  const showStoryOverlays = effectiveScreen === "play";

  return (
    <div className="app">
      {ugcOpen && <UgcStudio onClose={closeUgc} />}
      {journalOpen && <Journal onClose={() => setJournalOpen(false)} />}
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
              <div className="touch-pad touch-pad-arrow" aria-label="Movement">
                <DirButton dir="up" label="↑" className="dir-btn-up" />
                <DirButton dir="left" label="←" className="dir-btn-left" />
                <DirButton dir="down" label="↓" className="dir-btn-down" />
                <DirButton dir="right" label="→" className="dir-btn-right" />
              </div>
            </div>
          </div>
          <PlayfieldActionOverlays onOpenJournal={() => setJournalOpen(true)} onOpenUgc={openUgc} />
          {snapshot.battle.inBattle && <BattleOverlay />}
        </div>
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
      </div>
    </div>
  );
}
