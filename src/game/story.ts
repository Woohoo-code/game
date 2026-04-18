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

export interface ChapterReward {
  gold?: number;
  xp?: number;
  /** Message shown in the event log when the reward pays out. */
  message: string;
}

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
    objective: "Defeat 5 monsters anywhere in the wilds.",
    flavor:
      "The Guild Master wants proof you can hold a blade. Beyond the town gates the wilds are restless — slimes in the meadow, bats darting overhead, goblins crouched in the brush. Hunt them down. Five kills will do. Bring back the stories.",
    next: "ch2_gearUp",
    reward: {
      gold: 25,
      message: "The Guild pays 25 gold for your first kills."
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
    objective: "Set foot in 3 different biomes.",
    flavor:
      "The veil did not crack only above the meadows. It tore open every land — desert dunes, swamp hollows, forested valleys, frozen wastes. See them for yourself. Walk their soil. Carry the truth home.",
    next: "ch4_whispers",
    reward: {
      gold: 60,
      message: "A wandering chronicler pays 60 gold for your first-hand report of distant lands."
    }
  },

  ch4_whispers: {
    title: "Chapter 4 — Whispers of the Titan",
    objective: "Reach Level 5.",
    flavor:
      "You hear it in your dreams now — a voice rolling like thunder through ribs of stone. The Titan knows your name. Temper yourself. Grow stronger. The Guild Master will not send a child to face the end of the world.",
    next: "ch5_trials",
    reward: {
      xp: 80,
      message: "Surviving the Titan's gaze leaves you changed (+80 XP)."
    }
  },

  ch5_trials: {
    title: "Chapter 5 — Trial of Many",
    objective: "Defeat 6 different species of monster.",
    flavor:
      "Every beast of the void fights differently. A scorpion waits; a wraith vanishes; a drake burns. You must learn the shape of each of them before the Titan tests you. Seek the edges of every biome. Find what lives there. End it.",
    next: "ch6_titanAwaits",
    reward: {
      gold: 120,
      message: "The Guild Master presses a purse of 120 gold into your hand. 'You are ready.'"
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
 */
export function isStageComplete(stage: StoryStage, s: StoryState): boolean {
  switch (stage) {
    case "prologue":
      return s.prologueSeen;
    case "ch1_firstHunts":
      return s.monstersSlain >= 5;
    case "ch2_gearUp":
      return s.boughtBetterGear;
    case "ch3_wanderer":
      return s.biomesVisited.length >= 3;
    case "ch4_whispers":
      return false; // Advanced externally via storyNoteLevel(level)
    case "ch5_trials":
      return s.uniqueSpeciesDefeated.length >= 6;
    case "ch6_titanAwaits":
      return s.reachedBossArena; // Advanced when the player steps on the boss arena or defeats it
    case "epilogue":
      return false;
  }
}

/**
 * Shortcut that describes chapter progress for the UI (e.g. "3 / 5 monsters slain").
 */
export function progressLabelFor(stage: StoryStage, s: StoryState, playerLevel: number): string | null {
  switch (stage) {
    case "ch1_firstHunts":
      return `${Math.min(s.monstersSlain, 5)} / 5 monsters slain`;
    case "ch2_gearUp":
      return s.boughtBetterGear ? "complete" : "awaiting purchase";
    case "ch3_wanderer":
      return `${Math.min(s.biomesVisited.length, 3)} / 3 biomes explored`;
    case "ch4_whispers":
      return `Level ${playerLevel} / 5`;
    case "ch5_trials":
      return `${Math.min(s.uniqueSpeciesDefeated.length, 6)} / 6 species defeated`;
    case "ch6_titanAwaits":
      return s.reachedBossArena ? "At the arena — confront the Titan" : "Seek the Void Titan";
    default:
      return null;
  }
}

/** Biomes not yet visited — used by the journal hint row. */
export function missingBiomes(visited: BiomeKind[]): BiomeKind[] {
  const all: BiomeKind[] = ["meadow", "forest", "desert", "swamp", "tundra"];
  return all.filter((b) => !visited.includes(b));
}
