/**
 * Generador pseudoaleatorio determinista (mulberry32).
 *
 * El estado del generador vive DENTRO de la partida (`state.rng`), así que
 * cargar la misma partida y hacer las mismas acciones produce exactamente el
 * mismo resultado. El motor nunca usa Math.random().
 */
export interface RngHolder {
  rng: number;
}

export function nextRandom(h: RngHolder): number {
  let t = (h.rng = (h.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Entero uniforme en [min, max]. */
export function randInt(h: RngHolder, min: number, max: number): number {
  return min + Math.floor(nextRandom(h) * (max - min + 1));
}

/** Uniforme en [min, max). */
export function randRange(h: RngHolder, min: number, max: number): number {
  return min + nextRandom(h) * (max - min);
}

export function chance(h: RngHolder, p: number): boolean {
  return nextRandom(h) < p;
}

export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

/** Normal estándar (Box-Muller) con el generador de la partida. */
export function randNormal(h: RngHolder): number {
  const u = Math.max(1e-12, nextRandom(h));
  const v = nextRandom(h);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Normal determinista a partir de una clave (no consume el generador de la
 * partida). Sirve para estimaciones que deben ser estables al volver a mirarlas
 * (p. ej. la opinión del analista sobre una acción durante una semana).
 */
export function hashNormal(key: string): number {
  const h1 = { rng: seedFromString(key) };
  return randNormal(h1);
}
