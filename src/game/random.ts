// Small seeded randomness, the same in every browser and in Node.

// 32-bit FNV-1a: a stable seed from a string (as in the Roblox DailyService).
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export type Rng = { int(min: number, max: number): number };

// mulberry32. int(min, max) is inclusive on both ends.
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (min, max) => min + Math.floor(next() * (max - min + 1)) };
}

export const unseeded: Rng = {
  int: (min, max) => min + Math.floor(Math.random() * (max - min + 1)),
};
