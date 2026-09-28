import type { Cents } from './money';

/** Formato monetario consistente en todo el juego: $1,234.56 (negativos: −$1,234.56). */
export function fmtMoney(c: Cents, opts: { decimals?: boolean; sign?: boolean } = {}): string {
  const decimals = opts.decimals ?? true;
  c = Math.round(c);
  const neg = c < 0;
  const abs = Math.abs(c);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = decimals ? `${w}.${cents.toString().padStart(2, '0')}` : w;
  const sign = neg ? '−' : opts.sign && c > 0 ? '+' : '';
  return `${sign}$${body}`;
}

/** Formato compacto para cifras grandes: $12.4K, $3.20M, $1.05B. */
export function fmtCompact(c: Cents): string {
  const v = c / 100;
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${s}$${(a / 1e3).toFixed(1)}K`;
  return fmtMoney(c, { decimals: a < 1000 });
}

export function fmtPct(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits).replace(/\.0+$/, '')} %`;
}
