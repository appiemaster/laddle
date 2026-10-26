// All gameplay tunables in one place (ported from the Roblox Config.luau).
// Internally the shortest path is "par"; players never see that word.

export type Range = { minPar: number; maxPar: number };
export type Difficulty = "easy" | "normal" | "hard";

export const Config = {
  length: 4,

  // Practice difficulties, by shortest path (inclusive), as in Roblox Solo.
  difficulties: {
    easy: { minPar: 3, maxPar: 4 },
    normal: { minPar: 5, maxPar: 6 },
    hard: { minPar: 7, maxPar: 9 },
  } satisfies Record<Difficulty, Range>,
  difficultyOrder: ["easy", "normal", "hard"] as Difficulty[],

  daily: {
    range: { minPar: 5, maxPar: 7 } as Range,
    // Seeds the computed fallback once the generated schedule runs out. Bump it
    // to give every day after the schedule a fresh sequence.
    salt: "LADDLE-1",
    // Days the schedule script generates ahead of the last scheduled day.
    scheduleDays: 3 * 366,
    // A start or target word is not reused within this many days.
    noRepeatDays: 365,
  },

  // Stats keep a spread of extra steps 0..distBuckets-2; the last bucket is
  // "that many or more".
  distBuckets: 7,
} as const;
