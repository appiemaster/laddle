// The Wordle-style result to paste: letter-match squares per word, never the
// words themselves.

import { matchMask } from "./rules.ts";

const MAX_ROWS = 12;

export type ShareInput = {
  number: number;
  path: readonly string[];
  target: string;
  par: number;
  solved: boolean;
  url?: string;
};

export function shareText({ number, path, target, par, solved, url }: ShareInput): string {
  const steps = path.length - 1;
  let head = `Laddle #${number}  `;
  if (!solved) head += "✖";
  else if (steps === par) head += `${steps} steps ⭐`;
  else head += `${steps} steps (+${steps - par})`;
  const rows = path.map((w) => matchMask(w, target).map((hit) => (hit ? "🟦" : "⬜")).join(""));
  const shown =
    rows.length > MAX_ROWS ? [...rows.slice(0, MAX_ROWS - 2), "⋮", rows[rows.length - 1]] : rows;
  return [head, ...shown, ...(url ? [url] : [])].join("\n");
}
