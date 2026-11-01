export function normalizeSeed(seed: number): number {
  const value = seed >>> 0;
  return value === 0 ? 0x9e3779b9 : value;
}

export function nextRandom(state: number): { value: number; state: number } {
  let x = normalizeSeed(state);
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return { value: x / 0x100000000, state: x };
}

export function randomRange(
  state: number,
  min: number,
  max: number,
): { value: number; state: number } {
  const next = nextRandom(state);
  return { value: min + (max - min) * next.value, state: next.state };
}

export function pickIndex(state: number, length: number): { value: number; state: number } {
  if (length <= 1) return { value: 0, state };
  const next = nextRandom(state);
  return { value: Math.min(length - 1, Math.floor(next.value * length)), state: next.state };
}