// The bundled word list (words4.ts, generated from the Roblox game's list),
// unpacked once on first use.
//
//   valid   every accepted move
//   common  start/target words (a subset of valid), never obscure ones

import * as words4 from "./words4.ts";

export type Dict = {
  length: number;
  version: string;
  valid: Set<string>;
  validList: string[]; // sorted
  common: Set<string>;
  commonList: string[]; // sorted
};

function unpack(packed: string, length: number): string[] {
  const list: string[] = [];
  for (let i = 0; i < packed.length; i += length) list.push(packed.slice(i, i + length));
  return list;
}

let cache: Dict | undefined;

export function getDict(): Dict {
  if (!cache) {
    const validList = unpack(words4.valid, 4);
    const commonList = unpack(words4.common, 4);
    cache = {
      length: 4,
      version: words4.version,
      valid: new Set(validList),
      validList,
      common: new Set(commonList),
      commonList,
    };
  }
  return cache;
}

export function isValid(word: string): boolean {
  return getDict().valid.has(word);
}
