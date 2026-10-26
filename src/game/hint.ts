// Hints (ported from HintService.luau): the next word on a shortest path from
// where the player is now. One step closer, never a word already on the path
// (that would be a repeat), common words first.

import { bfs, getGraph } from "./graph.ts";

// The graph is undirected, so one search from the target gives every word's
// distance to it; the last one is cached.
let cached: { target: string; dist: Int16Array } | undefined;

export function nextWord(current: string, target: string, seen: ReadonlySet<string>): string | null {
  const graph = getGraph();
  const t = graph.ids.get(target);
  const here = graph.ids.get(current);
  if (t === undefined || here === undefined || here === t) return null;
  if (cached?.target !== target) cached = { target, dist: bfs(graph, t).dist };
  const dist = cached.dist;
  if (dist[here] < 0) return null;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const n of graph.adj[here]) {
    const word = graph.words[n];
    const d = dist[n];
    if (d >= 0 && !seen.has(word)) {
      // Closer first; among equals, common words first.
      const score = d * 2 + (graph.isCommon[n] ? 0 : 1);
      if (score < bestScore) {
        best = word;
        bestScore = score;
      }
    }
  }
  return best;
}
