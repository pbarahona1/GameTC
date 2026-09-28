/**
 * Indicadores técnicos y de riesgo (funciones puras). Se calculan SIEMPRE con
 * el historial real de precios de la partida. Devuelven `null` en las
 * posiciones donde todavía no hay datos suficientes.
 */
export function sma(values: number[], n: number): Array<number | null> {
  const out: Array<number | null> = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

export function ema(values: number[], n: number): Array<number | null> {
  const out: Array<number | null> = [];
  const k = 2 / (n + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < n - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) prev = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
    else prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** RSI de Wilder (14 por defecto). */
export function rsi(values: number[], n = 14): Array<number | null> {
  const out: Array<number | null> = [null];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = Math.max(0, d);
    const l = Math.max(0, -d);
    if (i <= n) {
      gain += g / n;
      loss += l / n;
      out.push(i === n ? (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)) : null);
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
      out.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
    }
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9): { macd: Array<number | null>; signal: Array<number | null>; hist: Array<number | null> } {
  const f = ema(values, fast);
  const s = ema(values, slow);
  const m = values.map((_, i) => (f[i] !== null && s[i] !== null ? (f[i] as number) - (s[i] as number) : null));
  const firstIdx = m.findIndex((x) => x !== null);
  const sig: Array<number | null> = values.map(() => null);
  if (firstIdx >= 0) {
    const tail = ema(m.slice(firstIdx) as number[], signal);
    tail.forEach((v, i) => (sig[firstIdx + i] = v));
  }
  const hist = m.map((v, i) => (v !== null && sig[i] !== null ? v - (sig[i] as number) : null));
  return { macd: m, signal: sig, hist };
}

export function bollinger(values: number[], n = 20, k = 2): { mid: Array<number | null>; upper: Array<number | null>; lower: Array<number | null> } {
  const mid = sma(values, n);
  const upper: Array<number | null> = [];
  const lower: Array<number | null> = [];
  for (let i = 0; i < values.length; i++) {
    if (mid[i] === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    const w = values.slice(i - n + 1, i + 1);
    const m = mid[i] as number;
    const sd = Math.sqrt(w.reduce((a, x) => a + (x - m) ** 2, 0) / n);
    upper.push(m + k * sd);
    lower.push(m - k * sd);
  }
  return { mid, upper, lower };
}

/** Retornos logarítmicos diarios. */
export function logReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) if (values[i - 1] > 0 && values[i] > 0) out.push(Math.log(values[i] / values[i - 1]));
  return out;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Volatilidad anualizada a partir de precios diarios de días hábiles. */
export function annualVol(prices: number[]): number {
  return stdev(logReturns(prices)) * Math.sqrt(252);
}

/** Beta de una serie frente a un índice (misma longitud de retornos). */
export function beta(asset: number[], market: number[]): number | null {
  const a = logReturns(asset);
  const m = logReturns(market);
  const n = Math.min(a.length, m.length);
  if (n < 10) return null;
  const aa = a.slice(-n);
  const mm = m.slice(-n);
  const ma = aa.reduce((s, x) => s + x, 0) / n;
  const mk = mm.reduce((s, x) => s + x, 0) / n;
  let cov = 0;
  let varM = 0;
  for (let i = 0; i < n; i++) {
    cov += (aa[i] - ma) * (mm[i] - mk);
    varM += (mm[i] - mk) ** 2;
  }
  return varM > 0 ? cov / varM : null;
}

/** Caída máxima desde un pico (fracción positiva). */
export function maxDrawdown(values: number[]): number {
  let peak = -Infinity;
  let dd = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    if (peak > 0) dd = Math.max(dd, 1 - v / peak);
  }
  return dd;
}

/** Valor en riesgo paramétrico (95 %) a `days` días hábiles, como fracción del valor. */
export function valueAtRisk(annualVolatility: number, days = 21, z = 1.65): number {
  return z * annualVolatility * Math.sqrt(days / 252);
}

/** Índice de concentración Herfindahl (0–1): 1 = todo en un solo activo. */
export function herfindahl(weights: number[]): number {
  const t = weights.reduce((a, b) => a + b, 0);
  if (t <= 0) return 0;
  return weights.reduce((a, w) => a + (w / t) ** 2, 0);
}

/** Correlación de Pearson de los retornos de dos series. */
export function correlation(a: number[], b: number[]): number | null {
  const ra = logReturns(a);
  const rb = logReturns(b);
  const n = Math.min(ra.length, rb.length);
  if (n < 10) return null;
  const x = ra.slice(-n);
  const y = rb.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}
