// One ladder attempt, the same in every mode (ported from Round.luau). The
// path starts at the start word; each accepted word is appended. Undo is free
// because the score is the final path length, not the number of guesses.

import { isValid } from "./dictionary.ts";
import type { Puzzle } from "./puzzle.ts";
import { classifyAttempt, normalize, type Verdict } from "./rules.ts";

export type Status = "active" | "solved" | "gaveup";

export type Round = {
  puzzle: Puzzle;
  path: string[];
  seen: Set<string>;
  status: Status;
  hinted: boolean;
};

export type SubmitResult = {
  ok: boolean;
  err?: Exclude<Verdict, "ok"> | "over";
  solved?: boolean;
};

// `path` resumes a saved attempt: it is replayed through the rules, so a
// stale or edited save can never put an illegal step on the path.
export function newRound(puzzle: Puzzle, path?: readonly string[]): Round {
  const round: Round = {
    puzzle,
    path: [puzzle.start],
    seen: new Set([puzzle.start]),
    status: "active",
    hinted: false,
  };
  if (path) {
    for (const word of path.slice(1)) if (!submit(round, word).ok) break;
  }
  return round;
}

export function current(round: Round): string {
  return round.path[round.path.length - 1];
}

// Steps taken so far (the start word is not a step).
export function steps(round: Round): number {
  return round.path.length - 1;
}

export function extra(round: Round): number {
  return steps(round) - round.puzzle.par;
}

export function submit(round: Round, raw: string): SubmitResult {
  if (round.status !== "active") return { ok: false, err: "over" };
  const word = normalize(raw);
  const verdict = classifyAttempt(word, current(round), isValid, round.seen);
  if (verdict !== "ok") return { ok: false, err: verdict };
  round.path.push(word);
  round.seen.add(word);
  if (word === round.puzzle.target) round.status = "solved";
  return { ok: true, solved: round.status === "solved" };
}

export function undo(round: Round): boolean {
  if (round.status !== "active" || round.path.length <= 1) return false;
  round.seen.delete(round.path.pop()!);
  return true;
}

export function giveUp(round: Round): void {
  if (round.status === "active") round.status = "gaveup";
}
