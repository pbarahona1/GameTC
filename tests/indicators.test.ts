import { sma, ema, rsi, macd, bollinger, maxDrawdown, valueAtRisk, herfindahl, beta, correlation, annualVol } from '../src/engine/invest/indicators';

describe('Indicadores técnicos y de riesgo', () => {
  it('medias móviles, RSI, MACD y Bollinger con valores conocidos', () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(sma(v, 3)).toEqual([null, null, 2, 3, 4, 5, 6, 7, 8, 9]);
    const e = ema(v, 3);
    expect(e[2]).toBe(2);
    expect(e[3]).toBeCloseTo(3, 10);
    const up = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(rsi(up)[29]).toBe(100);
    const down = Array.from({ length: 30 }, (_, i) => 100 - i);
    expect(rsi(down)[29]).toBeCloseTo(0, 5);
    const m = macd(Array.from({ length: 60 }, (_, i) => 100 + i));
    expect(m.macd[59]).toBeGreaterThan(0);
    expect(m.signal[59]).not.toBeNull();
    const b = bollinger(Array.from({ length: 25 }, () => 50));
    expect(b.upper[24]).toBe(50);
    expect(b.lower[24]).toBe(50);
  });

  it('riesgo: caída máxima, VaR, concentración, beta y correlación', () => {
    expect(maxDrawdown([100, 120, 90, 130, 65])).toBeCloseTo(0.5, 10);
    expect(valueAtRisk(0.2, 252)).toBeCloseTo(0.33, 10);
    expect(herfindahl([1, 1, 1, 1])).toBeCloseTo(0.25, 10);
    expect(herfindahl([5])).toBe(1);
    const mkt = Array.from({ length: 60 }, (_, i) => 100 * Math.exp(0.01 * Math.sin(i) + i * 0.001));
    const lev = mkt.map((x, i) => 50 * Math.pow(x / mkt[0], 2) * (1 + 0 * i));
    expect(beta(lev, mkt)!).toBeCloseTo(2, 5);
    expect(correlation(lev, mkt)!).toBeCloseTo(1, 5);
    expect(annualVol([100, 100, 100])).toBe(0);
  });
});
