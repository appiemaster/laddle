// Everything the game remembers, in this browser only (localStorage). Reads
// and writes never throw: a private window or blocked storage just means
// nothing is remembered.

import { Config, type Difficulty } from "./game/config.ts";
import type { StreakState } from "./game/streak.ts";

export type Mode = "daily" | "practice";

export type DailySave = StreakState & {
  played: number;
  solved: number;
  // Solved dailies by extra steps over the shortest: 0..distBuckets-2, then "or more".
  dist: number[];
  attempt?: { day: number; path: string[] }; // today's, in progress
  last?: { day: number; path: string[]; solved: boolean }; // the last finished one
};

export type PracticeSave = {
  difficulty: Difficulty;
  solved: number;
  attempt?: { start: string; target: string; path: string[] };
};

export type Save = {
  mode: Mode;
  helpSeen: boolean;
  daily: DailySave;
  practice: PracticeSave;
};

const KEY = "laddle:v1";

function defaults(): Save {
  return {
    mode: "daily",
    helpSeen: false,
    daily: {
      streak: 0,
      bestStreak: 0,
      lastSolvedDay: -1,
      played: 0,
      solved: 0,
      dist: new Array<number>(Config.distBuckets).fill(0),
    },
    practice: { difficulty: "easy", solved: 0 },
  };
}

export function load(): Save {
  const save = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<Save>;
      Object.assign(save, data, {
        daily: { ...save.daily, ...data.daily },
        practice: { ...save.practice, ...data.practice },
      });
    }
  } catch {
    // Unreadable or blocked: start fresh.
  }
  return save;
}

export function store(save: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Blocked or full: the game still works, it just won't remember.
  }
}
