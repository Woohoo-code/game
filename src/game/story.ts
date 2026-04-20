import type { BiomeKind, StoryStage, StoryState } from "./types";

/**
 * Static storyline definitions for Monster Slayer.
 *
 * The story is structured as a linear chain of chapters from "prologue" to
 * "epilogue". Each chapter declares its narrative text, the gameplay objective
 * that must be met to advance, and an optional reward paid out on completion.
 *
 * Progression is entirely data-driven: {@link isStageComplete} checks the live
 * {@link StoryState} against {@link STORY_CHAPTERS} to decide when to advance.
 * No game-logic hooks live here — {@link GameStore} calls `storyNote*` helpers
 * that merely update counters, then re-evaluates the chapter.
 */

/** One-line stakes — shown on the title screen and overworld HUD. */
export const CAMPAIGN_TAGLINE = "Seal the breach — slay the Void Titan.";

/** Slightly longer premise for tooltips and the Journal header area. */
export const CAMPAIGN_PREMISE =
  "The veil over Aetheria is torn. Hunt the wilds, pass the Guild's trials, and end the Void Titan before the world unravels.";

export interface ChapterReward {
  gold?: number;
  xp?: number;
  /** Message shown in the event log when the reward pays out. */
  message: string;
}

/**
 * Chapter completion thresholds — kept as named constants so UI labels,
 * migration code, and `isStageComplete` can never drift apart. Tuned for a
 * ~30-60 min playthrough to the first boss: early chapters feel like a brisk
 * tutorial, mid chapters force real exploration and combat variety, and the
 * level gate ensures you're not paper-thin when the Titan's voice arrives.
 */
export const STORY_CH1_MONSTERS_TO_SLAY = 10;
export const STORY_CH3_BIOMES_TO_VISIT = 4;
export const STORY_CH4_LEVEL_REQUIRED = 8;
export const STORY_CH5_SPECIES_TO_DEFEAT = 10;

export interface ChapterDefinition {
  /** Short, displayable title — "Chapter 1: First Blood". */
  title: string;
  /** Plain-language objective shown in the Journal. */
  objective: string;
  /** 1–3 paragraph narrative blurb shown in the story modal. */
  flavor: string;
  /** Which stage to advance to on completion. Omitted for epilogue. */
  next?: StoryStage;
  /** Optional gold/XP reward paid out when the chapter advances. */
  reward?: ChapterReward;
}

export const STORY_CHAPTERS: Record<StoryStage, ChapterDefinition> = {
  prologue: {
    title: "Prologue — The Cracked Veil",
    objective: "Step into the world and begin your hunt.",
    flavor:
      "Long ago, the realm of Aetheria slept under a shimmering veil that held the void at bay. But deep beneath the world, the Void Titan stirred — and in one dreadful night, it tore the veil wide open.\n\nFrom the wound poured monsters of every kind: slimes and wolves in the meadows, scorpions in the deserts, spiders in the forests, wraiths in the frozen north. Only two towns survived the first dark months, and their elders turned to the Monster Slayers' Guild for salvation.\n\nYou are the Guild's newest recruit. Your sword is simple, your armor plain, but your will is sharp. Step outside, Slayer. Aetheria is watching.",
    next: "ch1_firstHunts"
  },

  ch1_firstHunts: {
    title: "Chapter 1 — First Blood",
    objective: `Defeat ${STORY_CH1_MONSTERS_TO_SLAY} monsters anywhere in the wilds.`,
    flavor:
      "The Guild Master wants proof you can hold a blade. Beyond the town gates the wilds are restless — slimes in the meadow, bats darting overhead, goblins crouched in the brush. Hunt them down. Ten kills is the old Guild tradition. Bring back the stories.",
    next: "ch2_gearUp",
    reward: {
      gold: 40,
      message: "The Guild pays 40 gold for your first kills."
    }
  },

  ch2_gearUp: {
    title: "Chapter 2 — Steel in Hand",
    objective: "Buy an Iron Sword (or better) from any Shop.",
    flavor:
      "A practice sword will not fell a drake. Walk into a town, visit the Shop, and arm yourself with real steel. The smith will not haggle — she knows what is coming.",
    next: "ch3_wanderer",
    reward: {
      xp: 40,
      message: "The smith trades battlefield tales — you learn from them (+40 XP)."
    }
  },

  ch3_wanderer: {
    title: "Chapter 3 — Lands Unknown",
    objective: `Set foot in ${STORY_CH3_BIOMES_TO_VISIT} different biomes.`,
    flavor:
      "The veil did not crack only above the meadows. It tore open every land — desert dunes, swamp hollows, forested valleys, frozen wastes. See them for yourself. Walk their soil. Carry the truth home. The chronicler wants four lands on your boots before she'll write your name.",
    next: "ch4_whispers",
    reward: {
      gold: 80,
      message: "A wandering chronicler pays 80 gold for your first-hand report of distant lands."
    }
  },

  ch4_whispers: {
    title: "Chapter 4 — Whispers of the Titan",
    objective: `Reach Level ${STORY_CH4_LEVEL_REQUIRED}.`,
    flavor:
      "You hear it in your dreams now — a voice rolling like thunder through ribs of stone. The Titan knows your name. Temper yourself. Grow stronger. The Guild Master will not send a child to face the end of the world, and the Titan's servants grow fiercer with every moon.",
    next: "ch5_trials",
    reward: {
      xp: 140,
      message: "Surviving the Titan's gaze leaves you changed (+140 XP)."
    }
  },

  ch5_trials: {
    title: "Chapter 5 — Trial of Many",
    objective: `Defeat ${STORY_CH5_SPECIES_TO_DEFEAT} different species of monster.`,
    flavor:
      "Every beast of the void fights differently. A scorpion waits; a wraith vanishes; a drake burns. You must learn the shape of each of them before the Titan tests you. Seek the edges of every biome. Find what lives there. End it — ten distinct kinds, or the Guild will not send you through.",
    next: "ch6_titanAwaits",
    reward: {
      gold: 180,
      message: "The Guild Master presses a purse of 180 gold into your hand. 'You are ready.'"
    }
  },

  ch6_titanAwaits: {
    title: "Chapter 6 — The Final Path",
    objective: "Travel to the Boss Arena and defeat the Void Titan.",
    flavor:
      "The veil thins where the Titan waits. Follow the black road until the earth turns violet beneath your boots, until the stars themselves seem to hush. Then draw your sword. The last hunt begins.",
    next: "epilogue"
  },

  epilogue: {
    title: "Epilogue — The Veil Restored",
    objective: "Your name is written on the Slayers' Pillar forever.",
    flavor:
      "With a last shuddering roar, the Void Titan collapsed. Its body crumbled into motes of light that rose like starlings to re-seal the veil overhead.\n\nSilence swept the arena. Then — dawn broke somewhere high above Aetheria. Far away, townsfolk cheered in the streets. Inns poured free ale. The Guild's hall rang all night with song.\n\nAnd your name was carved, in careful letters, onto the Slayers' Pillar beside every hero who came before. The Guild Master handed you one last gift: a key to the Forge, where new tales of Aetheria can now be written by your hand.\n\nThank you, Slayer."
  }
};

/** Initial, fresh story state for a new character. */
export function initialStory(): StoryState {
  return {
    stage: "prologue",
    prologueSeen: false,
    epilogueSeen: false,
    monstersSlain: 0,
    biomesVisited: [],
    uniqueSpeciesDefeated: [],
    boughtBetterGear: false,
    reachedBossArena: false,
    completed: [],
    pendingChapterToast: null
  };
}

/**
 * Returns true if the given stage's objective is met by the current state.
 * Prologue/epilogue are handled by their own UI (`prologueSeen`/`epilogueSeen`)
 * and always return false here.
 *
 * `playerLevel` is used by Chapter 4 (the only stage gated on an external
 * value rather than `StoryState` itself). Callers that can't supply it — e.g.
 * cold reads that don't have the full game state — may omit it; the chapter
 * will then remain "incomplete" until a caller with the level re-evaluates.
 */
export function isStageComplete(stage: StoryStage, s: StoryState, playerLevel = 0): boolean {
  switch (stage) {
    case "prologue":
      return s.prologueSeen;
    case "ch1_firstHunts":
      return s.monstersSlain >= STORY_CH1_MONSTERS_TO_SLAY;
    case "ch2_gearUp":
      return s.boughtBetterGear;
    case "ch3_wanderer":
      return s.biomesVisited.length >= STORY_CH3_BIOMES_TO_VISIT;
    case "ch4_whispers":
      return playerLevel >= STORY_CH4_LEVEL_REQUIRED;
    case "ch5_trials":
      return s.uniqueSpeciesDefeated.length >= STORY_CH5_SPECIES_TO_DEFEAT;
    case "ch6_titanAwaits":
      return s.reachedBossArena; // Advanced when the player steps on the boss arena or defeats it
    case "epilogue":
      return false;
  }
}

/**
 * Shortcut that describes chapter progress for the UI (e.g. "3 / 5 monsters slain").
 */
export function progressLabelFor(
  stage: StoryStage,
  s: StoryState,
  playerLevel: number,
  extras?: { bossDefeated?: boolean }
): string | null {
  switch (stage) {
    case "prologue":
      return s.prologueSeen ? null : "Journal — dismiss the briefing, then hunt";
    case "ch1_firstHunts":
      return `${Math.min(s.monstersSlain, STORY_CH1_MONSTERS_TO_SLAY)} / ${STORY_CH1_MONSTERS_TO_SLAY} monsters slain`;
    case "ch2_gearUp":
      return s.boughtBetterGear ? "complete" : "awaiting purchase";
    case "ch3_wanderer":
      return `${Math.min(s.biomesVisited.length, STORY_CH3_BIOMES_TO_VISIT)} / ${STORY_CH3_BIOMES_TO_VISIT} biomes explored`;
    case "ch4_whispers":
      return `Level ${playerLevel} / ${STORY_CH4_LEVEL_REQUIRED}`;
    case "ch5_trials":
      return `${Math.min(s.uniqueSpeciesDefeated.length, STORY_CH5_SPECIES_TO_DEFEAT)} / ${STORY_CH5_SPECIES_TO_DEFEAT} species defeated`;
    case "ch6_titanAwaits":
      if (extras?.bossDefeated) return "Void Titan defeated";
      return s.reachedBossArena ? "At the arena — confront the Titan" : "Seek the Boss Arena in the wilds";
    case "epilogue":
      return s.epilogueSeen ? "Chronicle closed — thank you, Slayer" : "Journal — read the epilogue when ready";
    default:
      return null;
  }
}

/** HUD block: tagline + active chapter + objective + numeric progress. */
export function hudCampaignGoal(
  stage: StoryStage,
  story: StoryState,
  playerLevel: number,
  bossDefeated: boolean
): { tagline: string; chapterTitle: string; objective: string; progress: string | null } {
  const def = STORY_CHAPTERS[stage];
  const progress = progressLabelFor(stage, story, playerLevel, { bossDefeated });
  return {
    tagline: CAMPAIGN_TAGLINE,
    chapterTitle: def.title,
    objective: def.objective,
    progress
  };
}

/** Biomes not yet visited — used by the journal hint row. */
export function missingBiomes(visited: BiomeKind[]): BiomeKind[] {
  const all: BiomeKind[] = ["meadow", "forest", "desert", "swamp", "tundra"];
  return all.filter((b) => !visited.includes(b));
}
