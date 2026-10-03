/**
 * Dinero del juego.
 *
 * REGLA: todo importe monetario es un número ENTERO de centavos (`Cents`).
 * Nunca se guardan fracciones de centavo: cada cálculo que produce decimales
 * (intereses, porcentajes, prorrateos) se redondea en un único punto con
 * `roundCents`, y el resultado redondeado es el que se contabiliza.
 * Así las cifras de pantalla coinciden siempre con el libro mayor.
 */
export type Cents = number;


/** Convierte dólares (puede tener decimales) a centavos enteros. */
export function usd(dollars: number): Cents {
  return Math.round(dollars * 100);
}

/** Redondeo único y consistente (half away from zero). */
export function roundCents(value: number): Cents {
  return value >= 0 ? Math.round(value) : -Math.round(-value);
}

/** amount × rate, redondeado a centavos. `rate` es una fracción (0.05 = 5 %). */
export function applyRate(amount: Cents, rate: number): Cents {
  return roundCents(amount * rate);
}

export function isValidCents(v: unknown): v is Cents {
  return typeof v === 'number' && Number.isSafeInteger(v);
}

export function sum(values: Cents[]): Cents {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
