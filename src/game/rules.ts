// The rules of a ladder step, pure (ported from WordRules.luau). Words are
// compared in normalized form (uppercase A-Z).

// Why a guess was refused (or "ok"). Checked in this order, so a non-word
// that also changes two letters reports "notword".
export type Verdict = "ok" | "length" | "notword" | "repeat" | "onediff";

export const Messages: Record<Exclude<Verdict, "ok">, string> = {
  length: "Use exactly 4 letters",
  notword: "Not in the word list",
  repeat: "Already used",
  onediff: "Change exactly one letter",
};

export function normalize(text: string): string {
  return text.toUpperCase().replace(/[^A-Z]/g, "");
}

// Positions that differ between two words of the same length.
export function diffCount(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

export function isOneStep(a: string, b: string): boolean {
  return diffCount(a, b) === 1;
}

// One boolean per position: does `word` already have the target's letter there?
export function matchMask(word: string, target: string): boolean[] {
  return [...target].map((ch, i) => word[i] === ch);
}

export function matchCount(word: string, target: string): number {
  return matchMask(word, target).filter(Boolean).length;
}

// The position that changed between two consecutive steps (-1 if not one step).
export function changedIndex(previous: string, word: string): number {
  if (!isOneStep(previous, word)) return -1;
  for (let i = 0; i < word.length; i++) if (previous[i] !== word[i]) return i;
  return -1;
}

// `word` must already be normalized. `seen` holds every word already on the
// path (including the current one).
export function classifyAttempt(
  word: string,
  current: string,
  isValid: (w: string) => boolean,
  seen: ReadonlySet<string>,
): Verdict {
  if (word.length !== current.length) return "length";
  if (!isValid(word)) return "notword";
  if (seen.has(word)) return "repeat";
  if (!isOneStep(current, word)) return "onediff";
  return "ok";
}
