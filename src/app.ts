// The whole game screen: header, mode tabs, the board, the action buttons and
// the keyboard, plus the help / stats / results windows. The header, tabs and
// keyboard are built once; everything else is redrawn from state on change.

import { Config, type Difficulty } from "./game/config.ts";
import { dailyNumber, msToNextDay, puzzleFor, today } from "./game/daily.ts";
import { getGraph } from "./game/graph.ts";
import { nextWord } from "./game/hint.ts";
import { fromWords, pick, type Puzzle } from "./game/puzzle.ts";
import { unseeded } from "./game/random.ts";
import * as R from "./game/round.ts";
import { changedIndex, Messages } from "./game/rules.ts";
import { shareText } from "./game/share.ts";
import { onGiveUp, onSolve, shown } from "./game/streak.ts";
import { load, store, type Mode } from "./storage.ts";
import { clear, h } from "./ui/dom.ts";
import { Icons } from "./ui/icons.ts";
import { closeModal, isModalOpen, openModal } from "./ui/modal.ts";
import { pathRows, tile, wordRow } from "./ui/tiles.ts";

const save = load();

const S = {
  mode: save.mode,
  day: today(),
  round: null as R.Round | null,
  typed: "",
  hint: null as string | null, // the hinted next word for the current step
  message: "",
  error: false, // the typed word was refused: tiles go red until the next key
  pop: -1, // the input tile that just got a letter
  added: false, // a word was just added: its row pops in
};

const el = {
  dailyTab: h("button", { class: "tab daily", onclick: () => setMode("daily") }),
  practiceTab: h("button", { class: "tab practice", onclick: () => setMode("practice") }),
  sub: h("div", { class: "sub" }),
  info: h("div", { class: "info" }),
  ladder: h("div", { class: "ladder" }),
  message: h("div", { class: "message", "aria-live": "polite" }),
  target: h("div", { class: "target" }),
  actions: h("div", { class: "actions" }),
  keyboard: h("div", { class: "keyboard" }),
  keys: new Map<string, HTMLButtonElement>(),
  toast: h("div", { class: "toast", "aria-live": "polite" }),
};

// --- starting rounds --------------------------------------------------------

function startDaily(): void {
  S.day = today();
  const puzzle = puzzleFor(S.day);
  if (!puzzle) {
    S.round = null;
    return;
  }
  const d = save.daily;
  if (d.last?.day === S.day) {
    S.round = R.newRound(puzzle, d.last.path);
    if (!d.last.solved) R.giveUp(S.round);
  } else {
    S.round = R.newRound(puzzle, d.attempt?.day === S.day ? d.attempt.path : undefined);
  }
  resetInput();
}

function startPractice(fresh: boolean): void {
  const p = save.practice;
  let puzzle: Puzzle | null = null;
  if (!fresh && p.attempt) puzzle = fromWords(getGraph(), p.attempt.start, p.attempt.target);
  if (puzzle && p.attempt) {
    S.round = R.newRound(puzzle, p.attempt.path);
  } else {
    puzzle = pick(getGraph(), unseeded, Config.difficulties[p.difficulty]);
    S.round = puzzle && R.newRound(puzzle);
  }
  persist();
  resetInput();
}

function resetInput(): void {
  S.typed = "";
  S.hint = null;
  S.message = "";
  S.error = false;
  S.pop = -1;
}

function setMode(mode: Mode): void {
  if (mode === S.mode && S.round) return;
  S.mode = save.mode = mode;
  store(save);
  if (mode === "daily") startDaily();
  else startPractice(false);
  render();
}

function setDifficulty(difficulty: Difficulty): void {
  save.practice.difficulty = difficulty;
  startPractice(true);
  render();
}

// Saves the attempt in progress so a reload resumes it.
function persist(): void {
  const r = S.round;
  if (!r) return;
  if (S.mode === "daily") {
    if (r.status === "active") save.daily.attempt = { day: S.day, path: [...r.path] };
  } else if (r.status === "active") {
    save.practice.attempt = { start: r.puzzle.start, target: r.puzzle.target, path: [...r.path] };
  } else {
    delete save.practice.attempt;
  }
  store(save);
}

// --- playing ----------------------------------------------------------------

function active(): R.Round | null {
  return S.round?.status === "active" && !isModalOpen() ? S.round : null;
}

function typeLetter(letter: string): void {
  if (!active() || S.typed.length >= Config.length) return;
  if (S.error) S.typed = "";
  S.typed += letter;
  S.error = false;
  S.message = "";
  S.pop = S.typed.length - 1;
  render();
}

function backspace(): void {
  if (!active() || S.typed.length === 0) return;
  S.typed = S.error ? "" : S.typed.slice(0, -1);
  S.error = false;
  S.message = "";
  render();
}

function enter(): void {
  const r = active();
  if (!r) return;
  if (S.typed.length < Config.length) {
    refuse(Messages.length);
    return;
  }
  const result = R.submit(r, S.typed);
  if (!result.ok) {
    refuse(Messages[result.err as keyof typeof Messages]);
    return;
  }
  resetInput();
  S.added = true;
  persist();
  if (result.solved) finish();
  render();
}

function refuse(text: string): void {
  S.message = text;
  S.error = true;
  S.pop = -1;
  render();
}

function undoStep(): void {
  const r = active();
  if (!r || !R.undo(r)) return;
  resetInput();
  persist();
  render();
}

function showHint(): void {
  const r = active();
  if (!r) return;
  S.hint = nextWord(R.current(r), r.puzzle.target, r.seen);
  if (S.hint) {
    r.hinted = true;
    if (S.typed && !S.hint.startsWith(S.typed)) S.typed = "";
  }
  S.error = false;
  render();
}

// The round just ended (solved or given up): record it, then show results.
function finish(): void {
  const r = S.round!;
  const solved = r.status === "solved";
  if (S.mode === "daily") {
    const d = save.daily;
    d.played++;
    if (solved) {
      d.solved++;
      d.dist[Math.min(R.extra(r), Config.distBuckets - 1)]++;
      onSolve(d, S.day);
    } else {
      onGiveUp(d);
    }
    d.last = { day: S.day, path: [...r.path], solved };
    delete d.attempt;
  } else if (solved) {
    save.practice.solved++;
  }
  persist();
  setTimeout(showResults, solved ? 900 : 200);
}

// --- drawing ----------------------------------------------------------------

function render(): void {
  renderTabs();
  renderSub();
  renderBoard();
  renderActions();
  renderKeys();
  S.added = false;
  S.pop = -1;
}

function renderTabs(): void {
  const streak = shown(save.daily, S.day);
  clear(
    el.dailyTab,
    "Daily",
    streak > 0 && h("span", { class: "pill flame", title: "Daily streak" }, h("i", { html: Icons.flame }), streak),
  );
  clear(el.practiceTab, "Practice");
  el.dailyTab.classList.toggle("on", S.mode === "daily");
  el.practiceTab.classList.toggle("on", S.mode === "practice");
  el.dailyTab.setAttribute("aria-pressed", String(S.mode === "daily"));
  el.practiceTab.setAttribute("aria-pressed", String(S.mode === "practice"));
}

function renderSub(): void {
  if (S.mode === "daily") {
    const date = new Date(S.day * 86_400_000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    clear(el.sub, h("span", { class: "daily-no" }, `#${dailyNumber(S.day)}`), h("span", { class: "date" }, date));
    return;
  }
  clear(
    el.sub,
    ...Config.difficultyOrder.map((d) => {
      const range = Config.difficulties[d];
      return h(
        "button",
        {
          class: `diff ${d}${save.practice.difficulty === d ? " on" : ""}`,
          "aria-pressed": String(save.practice.difficulty === d),
          title: `Shortest: ${range.minPar}-${range.maxPar} steps`,
          onclick: () => setDifficulty(d),
        },
        d[0].toUpperCase() + d.slice(1),
      );
    }),
  );
}

function renderBoard(): void {
  const r = S.round;
  if (!r) {
    clear(el.info);
    clear(el.ladder);
    clear(el.target);
    el.message.textContent = "No puzzle today. Try Practice";
    return;
  }
  const p = r.puzzle;
  const over = r.status !== "active";
  clear(
    el.info,
    h("span", {}, "Steps: ", h("b", {}, R.steps(r))),
    over && h("span", {}, "Shortest: ", h("b", {}, p.par)),
  );

  const rows: Node[] = r.path.map((w, i) =>
    wordRow(w, p.target, r.path[i - 1], i === r.path.length - 1 && S.added && i > 0 ? "pop-in" : ""),
  );
  if (!over) rows.push(inputRow(r));
  clear(el.ladder, ...rows);
  clear(el.target, h("div", { class: "label" }, "TARGET"), wordRow(p.target, p.target));
  el.message.textContent = S.message;
  el.message.classList.toggle("error", S.error);
  // Keep the newest word in view.
  requestAnimationFrame(() => (el.ladder.scrollTop = el.ladder.scrollHeight));
}

function inputRow(r: R.Round): HTMLElement {
  const ghost = S.hint;
  const changed = ghost ? changedIndex(R.current(r), ghost) : -1;
  const tiles = [];
  for (let i = 0; i < Config.length; i++) {
    const letter = S.typed[i];
    tiles.push(
      tile({
        letter: letter ?? ghost?.[i],
        ghost: !letter && !!ghost,
        changed: !!ghost && i === changed,
        error: S.error,
        pop: i === S.pop,
      }),
    );
  }
  return h("div", { class: `row input-row${S.error ? " shake" : ""}` }, ...tiles);
}

function renderActions(): void {
  const r = S.round;
  if (!r) {
    clear(el.actions);
    return;
  }
  const over = r.status !== "active";
  if (S.mode === "practice") {
    clear(
      el.actions,
      ...(over
        ? [actionBtn("Next puzzle", Icons.next, "primary", () => (startPractice(true), render()))]
        : [
            actionBtn("Undo", Icons.undo, "", undoStep, r.path.length <= 1),
            actionBtn("Hint", Icons.bulb, "", showHint),
            actionBtn("New", Icons.next, "", () => (startPractice(true), render())),
          ]),
    );
    return;
  }
  clear(
    el.actions,
    ...(over
      ? [
          actionBtn("Results", Icons.stats, "", showResults),
          h("div", { class: "next-in" }, "Next puzzle in ", h("b", { "data-countdown": "" }, countdown())),
        ]
      : []),
  );
}

function actionBtn(label: string, icon: string, cls: string, onclick: () => void, disabled = false): HTMLElement {
  return h(
    "button",
    { class: `btn ${cls}`, onclick, disabled },
    h("i", { html: icon }),
    h("span", {}, label),
  );
}

// The key to press next while a hint is showing: the hint's next letter, or
// ENTER once it's typed, or backspace when the typing went another way.
function glowKey(): string | null {
  const r = S.round;
  if (!S.hint || !r || r.status !== "active") return null;
  if (S.error || !S.hint.startsWith(S.typed)) return "BACK";
  return S.typed.length < Config.length ? S.hint[S.typed.length] : "ENTER";
}

function renderKeys(): void {
  const glow = glowKey();
  for (const [name, key] of el.keys) key.classList.toggle("glow", name === glow);
  el.keyboard.classList.toggle("off", S.round?.status !== "active");
}

function buildKeyboard(): void {
  for (const row of ["QWERTYUIOP", "ASDFGHJKL", "+ZXCVBNM-"]) {
    const rowEl = h("div", { class: "krow" });
    for (const ch of row) {
      let key: HTMLButtonElement;
      if (ch === "+") {
        key = h("button", { class: "key wide enter", onclick: enter }, "ENTER");
        el.keys.set("ENTER", key);
      } else if (ch === "-") {
        key = h("button", { class: "key wide", "aria-label": "Backspace", html: Icons.back, onclick: backspace });
        el.keys.set("BACK", key);
      } else {
        key = h("button", { class: "key", onclick: () => typeLetter(ch) }, ch);
        el.keys.set(ch, key);
      }
      rowEl.append(key);
    }
    el.keyboard.append(rowEl);
  }
}

// --- windows ----------------------------------------------------------------

function countdown(): string {
  const s = Math.floor(msToNextDay() / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

function statBoxes(): HTMLElement {
  const d = save.daily;
  const box = (value: number | string, label: string) =>
    h("div", { class: "stat" }, h("b", {}, value), h("span", {}, label));
  return h(
    "div",
    { class: "stats" },
    box(d.played, "Played"),
    box(d.played ? Math.round((d.solved / d.played) * 100) + "%" : "–", "Solved"),
    box(shown(d, S.day), "Streak"),
    box(d.bestStreak, "Best"),
  );
}

function distribution(highlight: number): HTMLElement {
  const dist = save.daily.dist;
  const max = Math.max(1, ...dist);
  return h(
    "div",
    { class: "dist" },
    ...dist.map((n, i) =>
      h(
        "div",
        { class: `bar-row${i === highlight ? " now" : ""}` },
        h(
          "span",
          { class: "bar-label" },
          i === 0 ? h("i", { class: "star", html: Icons.star, title: "Shortest" }) : `+${i}${i === dist.length - 1 ? "+" : ""}`,
        ),
        h("span", { class: "bar", style: `width:${Math.max(8, (n / max) * 100)}%` }, h("b", {}, n)),
      ),
    ),
  );
}

function showStats(): void {
  const last = save.daily.last;
  const r = S.round;
  const highlight =
    last?.day === S.day && last.solved && r ? Math.min(last.path.length - 1 - r.puzzle.par, Config.distBuckets - 1) : -1;
  openModal("Stats", [
    statBoxes(),
    h("h3", {}, "Steps over the shortest"),
    distribution(S.mode === "daily" ? highlight : -1),
    h("p", { class: "small" }, `Practice puzzles solved: ${save.practice.solved}`),
  ]);
}

function showResults(): void {
  const r = S.round;
  if (!r || r.status === "active") return;
  const p = r.puzzle;
  const solved = r.status === "solved";
  const steps = R.steps(r);
  const extra = R.extra(r);
  const title = !solved ? "Shortest path" : extra === 0 ? "Perfect" : "Solved";
  const verdict = !solved
    ? `Shortest: ${p.par}`
    : extra === 0
      ? `${steps} steps · the shortest way`
      : `${steps} steps · ${extra} more than the shortest`;

  const body: Node[] = [
    h(
      "div",
      { class: `verdict${extra === 0 && solved ? " perfect" : ""}` },
      solved && extra === 0 && h("i", { class: "star big", html: Icons.star }),
      h("span", {}, verdict),
    ),
    h(
      "div",
      { class: "paths" },
      solved && h("div", { class: "col" }, h("h3", {}, "You"), pathRows(r.path, p.target)),
      h("div", { class: "col" }, h("h3", {}, "Shortest"), pathRows(p.parPath, p.target)),
    ),
  ];
  if (S.mode === "daily") {
    body.push(
      statBoxes(),
      h(
        "div",
        { class: "btn-row" },
        h("div", { class: "next-in" }, "Next puzzle", h("b", { "data-countdown": "" }, countdown())),
        h("button", { class: "btn primary share", onclick: share }, h("span", {}, "Share"), h("i", { html: Icons.share })),
      ),
    );
  } else {
    body.push(
      h(
        "div",
        { class: "btn-row" },
        h(
          "button",
          { class: "btn primary", onclick: () => (closeModal(), startPractice(true), render()) },
          h("i", { html: Icons.next }),
          h("span", {}, "Next puzzle"),
        ),
      ),
    );
  }
  openModal(title, body, { className: "results" });
}

async function share(): Promise<void> {
  const r = S.round;
  if (!r) return;
  const text = shareText({
    number: dailyNumber(S.day),
    path: r.path,
    target: r.puzzle.target,
    par: r.puzzle.par,
    solved: r.status === "solved",
    url: location.origin + location.pathname,
  });
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied. Paste it anywhere");
  } catch {
    toast("Couldn't copy");
  }
}

function toast(text: string): void {
  el.toast.textContent = text;
  el.toast.classList.add("show");
  setTimeout(() => el.toast.classList.remove("show"), 1800);
}

function showHelp(): void {
  const legend = (t: HTMLElement, text: string) => h("div", { class: "legend" }, t, h("span", {}, text));
  openModal(
    "How to play",
    [
      h("p", { class: "lead" }, "Change one letter at a time to reach the target."),
      h("div", { class: "help-demo" }, pathRows(["COLD", "CORD", "WORD", "WARD", "WARM"], "WARM")),
      h(
        "div",
        { class: "legends" },
        legend(tile({ letter: "W", match: true }), "matches the target"),
        legend(tile({ letter: "R", changed: true }), "the letter you changed"),
        legend(h("i", { class: "star", html: Icons.star }), "the shortest way"),
      ),
      h(
        "div",
        { class: "btn-row" },
        h("button", { class: "btn primary", onclick: closeModal }, "Play"),
      ),
      h(
        "p",
        { class: "credits" },
        "A new daily puzzle every day at midnight. Words: ENABLE word list and 12dicts by Alan Beale (both public domain).",
      ),
    ],
    {
      onClose: () => {
        save.helpSeen = true;
        store(save);
      },
    },
  );
}

// --- wiring -----------------------------------------------------------------

function onKeyDown(e: KeyboardEvent): void {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (isModalOpen()) {
    if (e.key === "Escape") closeModal();
    return;
  }
  if (e.key === "Enter") {
    // Don't also "click" a focused button.
    e.preventDefault();
    enter();
  } else if (e.key === "Backspace") {
    e.preventDefault();
    backspace();
  } else if (/^[a-zA-Z]$/.test(e.key)) {
    typeLetter(e.key.toUpperCase());
  }
}

// A new day (local midnight) while the page is open: the daily moves on.
function tick(): void {
  for (const node of document.querySelectorAll("[data-countdown]")) node.textContent = countdown();
  if (today() !== S.day) {
    S.day = today();
    if (S.mode === "daily") {
      if (isModalOpen()) closeModal();
      startDaily();
    }
    render();
  }
}

export function mount(root: HTMLElement): void {
  buildKeyboard();
  clear(
    root,
    h(
      "header",
      { class: "top" },
      h("button", { class: "icon-btn", "aria-label": "How to play", html: Icons.help, onclick: showHelp }),
      h("h1", { class: "title" }, "Laddle"),
      h("button", { class: "icon-btn", "aria-label": "Stats", html: Icons.stats, onclick: showStats }),
    ),
    h("nav", { class: "tabs" }, el.dailyTab, el.practiceTab),
    el.sub,
    h("main", { class: "board" }, el.info, el.ladder, el.message),
    el.target,
    el.actions,
    el.keyboard,
  );
  document.body.append(el.toast);
  window.addEventListener("keydown", onKeyDown);
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", tick);

  if (S.mode === "daily") startDaily();
  else startPractice(false);
  render();
  if (!save.helpSeen) showHelp();
}
