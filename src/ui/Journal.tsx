import { useEffect, useMemo, useState } from "react";
import { gameStore } from "../game/state";
import { CAMPAIGN_PREMISE, STORY_CHAPTERS, missingBiomes, progressLabelFor } from "../game/story";
import type { StoryStage } from "../game/types";
import { useGameStore } from "../game/useGameStore";
import { biomeDisplayName } from "../game/worldMap";

/**
 * Big, dramatic modal for the Prologue and Epilogue — each chapter's flavor
 * text is long-form and broken into paragraphs. Called out via a "seal"
 * header; the call-to-action dismisses the modal.
 */
export function StoryIntroModal({ onDismiss }: { onDismiss: () => void }) {
  const snapshot = useGameStore();
  const name = snapshot.player.name || "Slayer";
  const chapter = STORY_CHAPTERS.prologue;
  const body = chapter.flavor.replace(/\{name\}/g, name);
  return (
    <div className="story-modal-backdrop">
      <div className="story-modal prologue" role="dialog" aria-modal="true">
        <div className="story-modal-seal" aria-hidden>
          <span>★</span>
        </div>
        <h2 className="story-modal-title">{chapter.title}</h2>
        <div className="story-modal-body">
          {body.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <p className="story-modal-directive">
          Your first task, <strong>{name}</strong>: step into the wilds and prove yourself.
        </p>
        <div className="story-modal-actions">
          <button className="primary" onClick={onDismiss}>
            Take up your sword
          </button>
        </div>
      </div>
    </div>
  );
}

export function StoryEpilogueModal({ onDismiss }: { onDismiss: () => void }) {
  const snapshot = useGameStore();
  const name = snapshot.player.name || "Slayer";
  const chapter = STORY_CHAPTERS.epilogue;
  const body = chapter.flavor.replace(/\{name\}/g, name);
  return (
    <div className="story-modal-backdrop">
      <div className="story-modal epilogue" role="dialog" aria-modal="true">
        <div className="story-modal-seal gold" aria-hidden>
          <span>☀</span>
        </div>
        <h2 className="story-modal-title">{chapter.title}</h2>
        <div className="story-modal-body">
          {body.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <p className="story-modal-directive">
          — {name}, first among the Slayers of Aetheria.
        </p>
        <div className="story-modal-actions">
          <button className="primary" onClick={onDismiss}>
            Rest at last
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small toast that slides in when a new chapter begins. Auto-dismisses. */
export function ChapterToast({ stage, onDone }: { stage: StoryStage; onDone: () => void }) {
  const def = STORY_CHAPTERS[stage];
  const nextDef = def.next ? STORY_CHAPTERS[def.next] : null;

  useEffect(() => {
    const t = setTimeout(onDone, 5200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="chapter-toast" role="status" aria-live="polite">
      <div className="chapter-toast-header">
        <span className="chapter-toast-tag">Chapter complete</span>
        <button className="chapter-toast-close" onClick={onDone} aria-label="Dismiss">
          ×
        </button>
      </div>
      <div className="chapter-toast-title">{def.title}</div>
      {nextDef ? (
        <div className="chapter-toast-next">
          <span>Next — </span>
          <strong>{nextDef.title}</strong>
          <div className="chapter-toast-objective">{nextDef.objective}</div>
        </div>
      ) : null}
    </div>
  );
}

/** Full-screen Journal modal — active chapter + completed chapter log. */
export function Journal({ onClose }: { onClose: () => void }) {
  const snapshot = useGameStore();
  const story = snapshot.story;
  const level = snapshot.player.level;
  const active = STORY_CHAPTERS[story.stage];
  const nextStage = active.next;

  const unseen = useMemo(() => missingBiomes(story.biomesVisited), [story.biomesVisited]);
  const completed = [...story.completed].reverse();

  const progress = progressLabelFor(story.stage, story, level, {
    bossDefeated: snapshot.player.bossDefeated
  });

  return (
    <div className="journal-backdrop" onClick={onClose}>
      <div className="journal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="journal-header">
          <div>
            <div className="journal-eyebrow">Slayer's Journal</div>
            <p className="journal-campaign-premise">{CAMPAIGN_PREMISE}</p>
            <h2>{active.title}</h2>
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Close journal">
            ×
          </button>
        </header>

        <section className="journal-active">
          <div className="journal-objective">
            <span className="journal-label">Objective</span>
            <p>{active.objective}</p>
            {progress ? <p className="journal-progress">{progress}</p> : null}
          </div>

          <div className="journal-flavor">
            {active.flavor.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {story.stage === "ch3_wanderer" && unseen.length > 0 ? (
            <div className="journal-hint">
              <span className="journal-label">Unseen lands</span>
              <div className="journal-biomes">
                {unseen.map((b) => (
                  <span key={b} className={`biome-pill biome-${b}`}>
                    {biomeDisplayName(b, snapshot.world.realmTier ?? 1)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {story.stage === "ch5_trials" ? (
            <div className="journal-hint">
              <span className="journal-label">Species defeated</span>
              <p className="journal-progress">
                {story.uniqueSpeciesDefeated.length === 0
                  ? "None yet — begin hunting."
                  : story.uniqueSpeciesDefeated.join(", ")}
              </p>
            </div>
          ) : null}

          {nextStage ? (
            <div className="journal-next">
              <span className="journal-label">Next chapter</span>
              <p>{STORY_CHAPTERS[nextStage].title}</p>
            </div>
          ) : null}
        </section>

        {completed.length > 0 ? (
          <section className="journal-completed">
            <h3>Chronicle</h3>
            <ul>
              {completed.map((c) => (
                <li key={c.stage}>
                  <div className="journal-completed-title">{c.title}</div>
                  <div className="journal-completed-date">
                    {new Date(c.completedAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="journal-completed empty">
            <p>Your chronicle is empty. Complete chapters to fill these pages.</p>
          </section>
        )}

        <footer className="journal-footer">
          {story.stage === "prologue" && !story.prologueSeen ? (
            <button className="primary" onClick={() => gameStore.dismissPrologue()}>
              Begin your adventure
            </button>
          ) : null}
          {story.stage === "epilogue" && !story.epilogueSeen ? (
            <button className="primary" onClick={() => gameStore.dismissEpilogue()}>
              Finish the tale
            </button>
          ) : null}
          <button className="secondary" onClick={onClose}>
            Close journal
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Hook: drive all story auto-popups (prologue, chapter toast, epilogue). */
export function useStoryOverlays() {
  const snapshot = useGameStore();
  const story = snapshot.story;
  const [toastStage, setToastStage] = useState<StoryStage | null>(null);

  useEffect(() => {
    if (story.pendingChapterToast && story.pendingChapterToast !== toastStage) {
      setToastStage(story.pendingChapterToast);
    }
  }, [story.pendingChapterToast, toastStage]);

  const dismissToast = () => {
    setToastStage(null);
    gameStore.consumeChapterToast();
  };

  return {
    showPrologue: story.stage === "prologue" && !story.prologueSeen,
    showEpilogue: story.stage === "epilogue" && !story.epilogueSeen,
    toastStage,
    dismissToast
  };
}
