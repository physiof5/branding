/** 테스트 재현이 가능한 시드 RNG (mulberry32) */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const defaultRng = (): number => Math.random();

export function pick<T>(list: readonly T[], rng: () => number = defaultRng): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function randRange(min: number, max: number, rng: () => number = defaultRng): number {
  return min + (max - min) * rng();
}
