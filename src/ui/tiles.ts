// Letter tiles, shared by the board, the results and the help (like the Roblox
// TilePaint): lime when the letter already matches the target, a blue outline
// (and cyan fill unless it matches) on the letter the step changed.

import { changedIndex, matchMask } from "../game/rules.ts";
import { h } from "./dom.ts";

export type TileLook = {
  letter?: string;
  match?: boolean;
  changed?: boolean;
  ghost?: boolean;
  error?: boolean;
  pop?: boolean;
};

export function tile(look: TileLook): HTMLElement {
  const cls = ["tile"];
  if (look.match) cls.push("match");
  if (look.changed) cls.push("changed");
  if (look.ghost) cls.push("ghost");
  if (look.error) cls.push("error");
  if (look.pop) cls.push("pop");
  if (!look.letter) cls.push("empty");
  return h("span", { class: cls.join(" ") }, look.letter ?? "");
}

// A word painted against the target; `previous` marks the changed letter.
export function wordRow(word: string, target: string, previous?: string, extraClass = ""): HTMLElement {
  const mask = matchMask(word, target);
  const changed = previous ? changedIndex(previous, word) : -1;
  return h(
    "div",
    { class: `row ${extraClass}`.trim() },
    ...[...word].map((letter, i) => tile({ letter, match: mask[i], changed: i === changed })),
  );
}

// A whole path as small rows (results, help).
export function pathRows(path: readonly string[], target: string): HTMLElement {
  return h("div", { class: "mini-path" }, ...path.map((w, i) => wordRow(w, target, path[i - 1], "mini")));
}
