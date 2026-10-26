// The daily ladder: one puzzle per calendar day in the player's own timezone
// (like Wordle), so it changes at local midnight. Everyone on the same date
// gets the same puzzle.
//
//   * Days come from the generated schedule (schedule.ts, `npm run daily`), so
//     a later word-list change never moves a day that is already scheduled.
//   * Past the end of the schedule, the day's puzzle is computed from a seed
//     (FNV-1a of salt + day), which is the same in every browser too.

import { Config } from "./config.ts";
import { getGraph } from "./graph.ts";
import { fromWords, pick, type Puzzle } from "./puzzle.ts";
import { fnv1a, seeded } from "./random.ts";
import { firstDay, pairs } from "./schedule.ts";

const DAY_MS = 86_400_000;

// Today's local calendar date as a day number (days from 1970-01-01).
export function today(now = Date.now()): number {
  const d = new Date(now);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

// Until local midnight (setDate handles daylight-saving days).
export function msToNextDay(now = Date.now()): number {
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 1);
  return next.getTime() - now;
}

// The puzzle number players see ("Laddle #12"); day 1 is the schedule's first.
export function dailyNumber(day: number): number {
  return day - firstDay + 1;
}

export function computed(day: number): Puzzle | null {
  const rng = seeded(fnv1a(`${Config.daily.salt}L${Config.length}-${day}`));
  return pick(getGraph(), rng, Config.daily.range);
}

export function scheduledPair(day: number): [string, string] | null {
  const i = (day - firstDay) * 8;
  if (i < 0 || i + 8 > pairs.length) return null;
  return [pairs.slice(i, i + 4), pairs.slice(i + 4, i + 8)];
}

const cache = new Map<number, Puzzle | null>();

export function puzzleFor(day: number): Puzzle | null {
  if (!cache.has(day)) {
    const pair = scheduledPair(day);
    cache.set(day, (pair && fromWords(getGraph(), pair[0], pair[1])) ?? computed(day));
  }
  return cache.get(day)!;
}
