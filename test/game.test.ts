import { describe, expect, it } from "vitest";

import { Config } from "../src/game/config.ts";
import { dailyNumber, msToNextDay, puzzleFor, scheduledPair, today } from "../src/game/daily.ts";
import { getDict, isValid } from "../src/game/dictionary.ts";
import { bfs, getGraph } from "../src/game/graph.ts";
import { nextWord } from "../src/game/hint.ts";
import { fromWords, pick } from "../src/game/puzzle.ts";
import { seeded } from "../src/game/random.ts";
import { extra, giveUp, newRound, steps, submit, undo } from "../src/game/round.ts";
import { changedIndex, classifyAttempt, diffCount, matchMask, normalize } from "../src/game/rules.ts";
import { firstDay } from "../src/game/schedule.ts";
import { shareText } from "../src/game/share.ts";
import { onGiveUp, onSolve, shown, type StreakState } from "../src/game/streak.ts";

describe("rules", () => {
  it("normalizes and compares words", () => {
    expect(normalize(" co-ld ")).toBe("COLD");
    expect(diffCount("COLD", "CORD")).toBe(1);
    expect(diffCount("COLD", "COLDS")).toBe(Infinity);
    expect(changedIndex("COLD", "CORD")).toBe(2);
    expect(changedIndex("COLD", "WARM")).toBe(-1);
    expect(matchMask("CORD", "WARM")).toEqual([false, false, true, false]);
  });

  it("classifies attempts in the Roblox order", () => {
    const seen = new Set(["COLD"]);
    expect(classifyAttempt("COL", "COLD", isValid, seen)).toBe("length");
    expect(classifyAttempt("ZZZZ", "COLD", isValid, seen)).toBe("notword");
    expect(classifyAttempt("COLD", "COLD", isValid, seen)).toBe("repeat");
    expect(classifyAttempt("WARM", "COLD", isValid, seen)).toBe("onediff");
    expect(classifyAttempt("CORD", "COLD", isValid, seen)).toBe("ok");
  });
});

describe("words and graph", () => {
  it("loads the screened list", () => {
    const dict = getDict();
    expect(dict.validList.length).toBe(3808);
    expect(dict.commonList.length).toBe(1707);
    for (const w of dict.commonList) expect(dict.valid.has(w)).toBe(true);
  });

  it("finds COLD -> WARM in 4 steps through common words", () => {
    const p = fromWords(getGraph(), "COLD", "WARM")!;
    expect(p.par).toBe(4);
    expect(p.parPath[0]).toBe("COLD");
    expect(p.parPath.at(-1)).toBe("WARM");
    for (const w of p.parPath) expect(getDict().common.has(w)).toBe(true);
  });

  it("picks puzzles inside the requested range", () => {
    const graph = getGraph();
    const rng = seeded(42);
    for (const d of Config.difficultyOrder) {
      const range = Config.difficulties[d];
      for (let i = 0; i < 10; i++) {
        const p = pick(graph, rng, range)!;
        expect(p.par).toBeGreaterThanOrEqual(range.minPar);
        expect(p.par).toBeLessThanOrEqual(range.maxPar);
        expect(p.parPath.length).toBe(p.par + 1);
        // The shortest path over ALL valid words is no shorter.
        expect(bfs(graph, graph.ids.get(p.start)!).dist[graph.ids.get(p.target)!]).toBe(p.par);
      }
    }
  });
});

describe("round", () => {
  it("plays, undoes, solves", () => {
    const r = newRound(fromWords(getGraph(), "COLD", "WARM")!);
    expect(submit(r, "cord").ok).toBe(true);
    expect(submit(r, "COLD").err).toBe("repeat");
    expect(undo(r)).toBe(true);
    for (const w of ["CORD", "WORD", "WARD"]) expect(submit(r, w).ok).toBe(true);
    expect(submit(r, "WARM").solved).toBe(true);
    expect(steps(r)).toBe(4);
    expect(extra(r)).toBe(0);
    expect(submit(r, "WART").err).toBe("over");
  });

  it("has no step limit", () => {
    const graph = getGraph();
    const r = newRound(fromWords(graph, "COLD", "WARM")!);
    // Wander 60 steps without repeating a word or reaching the target.
    for (let i = 0; i < 60; i++) {
      const here = graph.ids.get(r.path.at(-1)!)!;
      const next = graph.adj[here].map((n) => graph.words[n]).find((w) => !r.seen.has(w) && w !== "WARM")!;
      expect(submit(r, next).ok).toBe(true);
    }
    expect(steps(r)).toBe(60);
    expect(r.status).toBe("active");
  });

  it("replays a saved path and stops at an illegal step", () => {
    const p = fromWords(getGraph(), "COLD", "WARM")!;
    const r = newRound(p, ["COLD", "CORD", "ZZZZ", "WORD"]);
    expect(r.path).toEqual(["COLD", "CORD"]);
    giveUp(r);
    expect(r.status).toBe("gaveup");
  });
});

describe("hints", () => {
  it("walks a shortest path without repeats", () => {
    const p = fromWords(getGraph(), "COLD", "WARM")!;
    const r = newRound(p);
    while (r.status === "active") {
      const w = nextWord(r.path.at(-1)!, p.target, r.seen)!;
      expect(submit(r, w).ok).toBe(true);
    }
    expect(steps(r)).toBe(p.par);
  });
});

describe("streak", () => {
  it("follows the Roblox rules without freezes", () => {
    const s: StreakState = { streak: 0, bestStreak: 0, lastSolvedDay: -1 };
    onSolve(s, 100);
    onSolve(s, 101);
    onSolve(s, 101);
    expect(s.streak).toBe(2);
    expect(shown(s, 102)).toBe(2);
    expect(shown(s, 103)).toBe(0); // missed day 102
    onSolve(s, 104);
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(2);
    onGiveUp(s);
    expect(shown(s, 105)).toBe(0);
  });
});

describe("daily", () => {
  it("uses the local calendar date", () => {
    const morning = new Date(2026, 9, 26, 0, 1).getTime();
    const night = new Date(2026, 9, 26, 23, 59).getTime();
    expect(today(night)).toBe(today(morning));
    expect(today(new Date(2026, 9, 27, 0, 0).getTime())).toBe(today(morning) + 1);
    expect(today(morning)).toBe(Date.UTC(2026, 9, 26) / 86_400_000);
    expect(msToNextDay(new Date(2026, 9, 26, 23, 0).getTime())).toBe(3_600_000);
    expect(dailyNumber(firstDay)).toBe(1);
  });

  it("has a valid scheduled puzzle every day", () => {
    const range = Config.daily.range;
    for (let day = firstDay; scheduledPair(day); day++) {
      const [s, t] = scheduledPair(day)!;
      const p = puzzleFor(day)!;
      expect([p.start, p.target]).toEqual([s, t]);
      expect(p.par).toBeGreaterThanOrEqual(range.minPar);
      expect(p.par).toBeLessThanOrEqual(range.maxPar);
    }
  });

  it("computes the same puzzle after the schedule ends", () => {
    let day = firstDay;
    while (scheduledPair(day)) day++;
    const a = puzzleFor(day + 5)!;
    expect(a).not.toBeNull();
    expect(a.par).toBeGreaterThanOrEqual(Config.daily.range.minPar);
  });
});

describe("share", () => {
  it("never contains the words", () => {
    const text = shareText({ number: 3, path: ["COLD", "CORD", "WORD", "WARD", "WARM"], target: "WARM", par: 4, solved: true });
    expect(text).toBe("Laddle #3  4 steps ⭐\n⬜⬜⬜⬜\n⬜⬜🟦⬜\n🟦⬜🟦⬜\n🟦🟦🟦⬜\n🟦🟦🟦🟦");
    expect(text).not.toMatch(/COLD|WARM/);
  });
});
