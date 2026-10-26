// Picks a start/target pair with a shortest path in the requested range
// (ported from Puzzle.luau).
//
//   * start: a common word in the giant component with at least two neighbours
//     (a dead-end start is a frustrating first move)
//   * target: a common word whose shortest path is in range AND can be walked
//     through common words alone, so the shortest path shown at the end never
//     contains an obscure word and an ordinary vocabulary can always hit it.

import type { Range } from "./config.ts";
import { bfs, pathTo, type Graph } from "./graph.ts";
import type { Rng } from "./random.ts";

export type Puzzle = {
  start: string;
  target: string;
  par: number;
  parPath: string[]; // start .. target, common words only
};

const MAX_TRIES = 40;

let pool: number[] | undefined;

function startPool(graph: Graph): number[] {
  if (!pool) {
    pool = [];
    for (let id = 0; id < graph.words.length; id++) {
      if (graph.isCommon[id] && graph.comp[id] === graph.giant && graph.adj[id].length >= 2) pool.push(id);
    }
  }
  return pool;
}

// The puzzle for a fixed start/target pair (the daily schedule). Null when the
// target is not reachable through common words at its shortest length.
export function fromWords(graph: Graph, start: string, target: string): Puzzle | null {
  const s = graph.ids.get(start);
  const t = graph.ids.get(target);
  if (s === undefined || t === undefined || s === t) return null;
  const any = bfs(graph, s, false);
  const common = bfs(graph, s, true);
  const par = any.dist[t];
  if (par < 0 || common.dist[t] !== par) return null;
  const path = pathTo(graph, common, t);
  return path && { start, target, par, parPath: path };
}

// `accept` can turn down a pair (the schedule uses it to avoid repeats).
// Null only if MAX_TRIES random starts all failed.
export function pick(
  graph: Graph,
  rng: Rng,
  range: Range,
  accept: (start: string, target: string) => boolean = () => true,
  tries = MAX_TRIES,
): Puzzle | null {
  const starts = startPool(graph);
  for (let i = 0; i < tries; i++) {
    const s = starts[rng.int(0, starts.length - 1)];
    const any = bfs(graph, s, false);
    const common = bfs(graph, s, true);
    const candidates: number[] = [];
    for (let t = 0; t < graph.words.length; t++) {
      const d = common.dist[t];
      if (
        d >= range.minPar &&
        d <= range.maxPar &&
        graph.isCommon[t] &&
        any.dist[t] === d &&
        accept(graph.words[s], graph.words[t])
      ) {
        candidates.push(t);
      }
    }
    if (candidates.length > 0) {
      const t = candidates[rng.int(0, candidates.length - 1)];
      return {
        start: graph.words[s],
        target: graph.words[t],
        par: common.dist[t],
        parPath: pathTo(graph, common, t)!,
      };
    }
  }
  return null;
}
