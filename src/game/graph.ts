// The ladder graph (ported from WordGraph.luau): words are nodes, an edge
// joins two words that differ in exactly one letter. Built from wildcard
// buckets ("_ING", "T_NY", ...) so it costs O(words * length), not O(words^2).

import { getDict } from "./dictionary.ts";

export type Graph = {
  length: number;
  words: string[]; // id -> word
  ids: Map<string, number>; // word -> id
  adj: number[][]; // id -> neighbour ids
  isCommon: boolean[]; // id -> in the common tier
  comp: number[]; // id -> component number
  giant: number; // component number of the largest component
};

// dist[id] = steps from the source (-1 = unreachable); prev[id] = the id it
// was reached from, for rebuilding a shortest path.
export type Search = { dist: Int16Array; prev: Int32Array; src: number };

function build(): Graph {
  const dict = getDict();
  const words = dict.validList;
  const length = dict.length;
  const ids = new Map<string, number>();
  words.forEach((w, id) => ids.set(w, id));
  const isCommon = words.map((w) => dict.common.has(w));

  const buckets = new Map<string, number[]>();
  words.forEach((word, id) => {
    for (let i = 0; i < length; i++) {
      const key = word.slice(0, i) + "_" + word.slice(i + 1);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(id);
      else buckets.set(key, [id]);
    }
  });

  const adj: number[][] = words.map(() => []);
  for (const bucket of buckets.values()) {
    for (const a of bucket) for (const b of bucket) if (a !== b) adj[a].push(b);
  }

  const comp = new Array<number>(words.length).fill(-1);
  const sizes: number[] = [];
  for (let id = 0; id < words.length; id++) {
    if (comp[id] !== -1) continue;
    const c = sizes.length;
    const queue = [id];
    comp[id] = c;
    for (let head = 0; head < queue.length; head++) {
      for (const n of adj[queue[head]]) {
        if (comp[n] === -1) {
          comp[n] = c;
          queue.push(n);
        }
      }
    }
    sizes.push(queue.length);
  }
  let giant = 0;
  sizes.forEach((size, c) => {
    if (size > sizes[giant]) giant = c;
  });

  return { length, words, ids, adj, isCommon, comp, giant };
}

let cache: Graph | undefined;

export function getGraph(): Graph {
  return (cache ??= build());
}

// Breadth-first search from `src`. With commonOnly, the path may only pass
// through common words (the source itself may be anything).
export function bfs(graph: Graph, src: number, commonOnly = false): Search {
  const n = graph.words.length;
  const dist = new Int16Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  dist[src] = 0;
  const queue = [src];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const d = dist[cur] + 1;
    for (const next of graph.adj[cur]) {
      if (dist[next] === -1 && (!commonOnly || graph.isCommon[next])) {
        dist[next] = d;
        prev[next] = cur;
        queue.push(next);
      }
    }
  }
  return { dist, prev, src };
}

// The words from the search's source to `target`, both included. Null when
// the target was not reached.
export function pathTo(graph: Graph, search: Search, target: number): string[] | null {
  if (search.dist[target] < 0) return null;
  const path: string[] = [];
  for (let cur = target; ; cur = search.prev[cur]) {
    path.unshift(graph.words[cur]);
    if (cur === search.src) break;
  }
  return path;
}
