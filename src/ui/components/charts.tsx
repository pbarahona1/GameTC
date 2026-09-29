import { useMemo, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Candle } from '../../engine/invest/types';
import { fmtCompact, fmtMoney } from '../../engine/format';
import { formatDate } from '../../engine/time/calendar';

/**
 * Gráficos financieros en SVG propio (sin dependencias): velas japonesas con
 * volumen y superposiciones, paneles de RSI y MACD, líneas mínimas y anillos.
 * Los colores salen del tema (claro/oscuro/daltonismo).
 */
export interface Overlay {
  name: string;
  values: Array<number | null>;
  color: string;
  dashed?: boolean;
}

const W = 340;

function scale(min: number, max: number, top: number, bottom: number) {
  const span = max - min || 1;
  return (v: number) => top + (1 - (v - min) / span) * (bottom - top);
}

/** Velas + volumen + superposiciones (medias, Bollinger). Precios en centavos. */
export function CandleChart({ candles, overlays = [], height = 220, markers = [] }: { candles: Candle[]; overlays?: Overlay[]; height?: number; markers?: Array<{ price: number; label: string; color: string }> }) {
  const n = candles.length;
  const [hover, setHover] = useState<number | null>(null);
  const { lo, hi, vmax } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    let vmax = 0;
    for (const c of candles) {
      lo = Math.min(lo, c.l);
      hi = Math.max(hi, c.h);
      vmax = Math.max(vmax, c.v);
    }
    for (const o of overlays) for (const v of o.values) if (v !== null) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    for (const m of markers) {
      lo = Math.min(lo, m.price);
      hi = Math.max(hi, m.price);
    }
    const pad = (hi - lo) * 0.06 || hi * 0.05;
    return { lo: lo - pad, hi: hi + pad, vmax };
  }, [candles, overlays, markers]);
  if (n < 2) return <p className="small muted">Todavía no hay suficiente historial de precios.</p>;
  const padL = 44;
  const padR = 6;
  const priceBottom = height - 46;
  const volTop = height - 40;
  const volBottom = height - 16;
  const y = scale(lo, hi, 8, priceBottom);
  const step = (W - padL - padR) / n;
  const x = (i: number) => padL + step * (i + 0.5);
  const bw = Math.max(1, step * 0.62);
  const ticks = [lo, (lo + hi) / 2, hi];
  const pick = (e: RPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.floor((px - padL) / step))));
  };
  const hc = hover !== null ? candles[hover] : null;
  const tipW = 170;
  const tipX = hover !== null ? Math.min(W - tipW - 2, Math.max(padL, x(hover) - tipW / 2)) : 0;
  return (
    <svg className="chart touch" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Gráfico de velas con volumen" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line className="grid" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
          <text x={padL - 4} y={y(t) + 3} textAnchor="end">{fmtCompact(t)}</text>
        </g>
      ))}
      {candles.map((c, i) => {
        const up = c.c >= c.o;
        const col = up ? 'var(--gain)' : 'var(--loss)';
        const top = y(Math.max(c.o, c.c));
        const bot = y(Math.min(c.o, c.c));
        return (
          <g key={c.d}>
            <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} style={{ stroke: col }} strokeWidth={1} />
            <rect x={x(i) - bw / 2} y={top} width={bw} height={Math.max(1, bot - top)} style={{ fill: up ? 'var(--surface)' : col, stroke: col }} strokeWidth={1} />
            <rect x={x(i) - bw / 2} y={volBottom - ((volBottom - volTop) * c.v) / (vmax || 1)} width={bw} height={((volBottom - volTop) * c.v) / (vmax || 1)} style={{ fill: col }} opacity={0.35} />
          </g>
        );
      })}
      {overlays.map((o) => {
        const pts = o.values.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ');
        return pts ? <polyline key={o.name} points={pts} fill="none" style={{ stroke: o.color }} strokeWidth={1.4} strokeDasharray={o.dashed ? '4 3' : undefined} /> : null;
      })}
      {markers.map((m) => (
        <g key={m.label + m.price}>
          <line x1={padL} x2={W - padR} y1={y(m.price)} y2={y(m.price)} style={{ stroke: m.color }} strokeDasharray="3 3" strokeWidth={1} />
          <text x={W - padR} y={y(m.price) - 3} textAnchor="end" style={{ fill: m.color }}>{m.label}</text>
        </g>
      ))}
      <text x={padL} y={height - 3}>{formatDate(candles[0].d)}</text>
      <text x={W - padR} y={height - 3} textAnchor="end">{formatDate(candles[n - 1].d)}</text>
      {hc && hover !== null && (
        <g pointerEvents="none">
          <line x1={x(hover)} x2={x(hover)} y1={8} y2={volBottom} style={{ stroke: 'var(--muted)' }} strokeDasharray="2 3" />
          <rect x={tipX} y={8} width={tipW} height={43} rx={6} className="tip-box" />
          <text x={tipX + 8} y={20} className="tip-title">{formatDate(hc.d)} · {hc.c >= hc.o ? '▲' : '▼'} {(((hc.c / hc.o) - 1) * 100).toFixed(1)} %</text>
          <text x={tipX + 8} y={33} className="tip-row" style={{ fill: 'var(--text)' }}>Apertura {fmtMoney(hc.o)} · Cierre {fmtMoney(hc.c)}</text>
          <text x={tipX + 8} y={46} className="tip-row" style={{ fill: 'var(--muted)' }}>Máx {fmtMoney(hc.h)} · Mín {fmtMoney(hc.l)}</text>
        </g>
      )}
    </svg>
  );
}

/** Panel de indicador (RSI con bandas 30/70, o MACD con histograma). */
export function IndicatorPanel({ lines, hist, bands, height = 90, label }: { lines: Overlay[]; hist?: Array<number | null>; bands?: [number, number]; height?: number; label: string }) {
  const all = [...lines.flatMap((l) => l.values), ...(hist ?? [])].filter((v): v is number => v !== null);
  if (all.length < 2) return <p className="tiny muted">{label}: faltan datos.</p>;
  let lo = Math.min(...all, bands ? bands[0] : Infinity);
  let hi = Math.max(...all, bands ? bands[1] : -Infinity);
  if (bands) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 100);
  }
  const padL = 44;
  const padR = 6;
  const y = scale(lo, hi, 6, height - 6);
  const n = Math.max(...lines.map((l) => l.values.length), hist?.length ?? 0);
  const step = (W - padL - padR) / n;
  const x = (i: number) => padL + step * (i + 0.5);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
      <text x={4} y={12}>{label}</text>
      {bands && bands.map((b) => <line key={b} className="grid" x1={padL} x2={W - padR} y1={y(b)} y2={y(b)} strokeDasharray="3 3" />)}
      {!bands && lo < 0 && hi > 0 && <line className="grid" x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} />}
      {hist?.map((v, i) => (v === null ? null : <rect key={i} x={x(i) - step * 0.3} y={Math.min(y(0), y(v))} width={step * 0.6} height={Math.abs(y(v) - y(0))} style={{ fill: v >= 0 ? 'var(--gain)' : 'var(--loss)' }} opacity={0.5} />))}
      {lines.map((o) => {
        const pts = o.values.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ');
        return pts ? <polyline key={o.name} points={pts} fill="none" style={{ stroke: o.color }} strokeWidth={1.4} strokeDasharray={o.dashed ? '4 3' : undefined} /> : null;
      })}
      <text x={padL - 4} y={y(hi) + 8} textAnchor="end">{hi.toFixed(bands ? 0 : 2)}</text>
      <text x={padL - 4} y={y(lo)} textAnchor="end">{lo.toFixed(bands ? 0 : 2)}</text>
    </svg>
  );
}

/** Línea mínima (tendencia) para listas. */
export function Sparkline({ values, width = 70, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span style={{ width }} />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const y = scale(lo, hi, 2, height - 2);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${y(v)}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts} fill="none" style={{ stroke: up ? 'var(--gain)' : 'var(--loss)' }} strokeWidth={1.5} />
    </svg>
  );
}

/** Anillo de composición (p. ej., cartera por clase de activo). */
export function Donut({ parts, size = 132 }: { parts: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  if (total <= 0) return <p className="small muted">Sin datos.</p>;
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Composición">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--surface-2)' }} strokeWidth={18} />
        {parts.filter((p) => p.value > 0).map((p) => {
          const len = (p.value / total) * c;
          const el = <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: p.color }} strokeWidth={18} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
          acc += len;
          return el;
        })}
      </svg>
      <div className="stack" style={{ gap: 4, flex: 1, minWidth: 140 }}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.label} className="tiny" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flex: 'none' }} />
            <span style={{ flex: 1 }}>{p.label}</span>
            <span className="num">{Math.round((p.value / total) * 100)} %</span>
            <span className="num faint">{fmtMoney(p.value, { decimals: false })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const CHART_COLORS = ['var(--accent)', 'var(--info)', 'var(--gain)', 'var(--warn)', 'var(--loss)', '#9a7fd1', '#5aa9a3'];

export interface BandPoint {
  p10: number;
  p50: number;
  p90: number;
}

/**
 * Abanico de escenarios: área entre el escenario malo (10 %) y el bueno (90 %)
 * con la línea central (50 %). Tocar muestra los tres valores de ese mes.
 */
export function BandChart({ bands, height = 150, color = 'var(--accent)', label, pointLabel = (i: number) => `Mes ${i + 1}`, actual }: { bands: BandPoint[]; height?: number; color?: string; label: string; pointLabel?: (i: number) => string; actual?: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = bands.length;
  if (n < 2) return <p className="small muted">Sin datos suficientes.</p>;
  const padL = 46;
  const padR = 8;
  const padT = 10;
  const padB = 18;
  let lo = Math.min(0, ...bands.map((b) => b.p10), ...(actual ?? []));
  let hi = Math.max(1, ...bands.map((b) => b.p90), ...(actual ?? []));
  const span = hi - lo || 1;
  lo -= span * 0.05;
  hi += span * 0.08;
  const y = scale(lo, hi, padT, height - padB);
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const upper = bands.map((b, i) => `${x(i)},${y(b.p90)}`).join(' ');
  const lower = bands.map((b, i) => `${x(i)},${y(b.p10)}`).reverse().join(' ');
  const mid = bands.map((b, i) => `${x(i)},${y(b.p50)}`).join(' ');
  const pick = (e: RPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - padL) / (W - padL - padR)) * (n - 1)))));
  };
  const ticks = [lo, (lo + hi) / 2, hi];
  const tipW = 156;
  const tipX = hover !== null ? Math.min(W - tipW - 2, Math.max(padL, x(hover) - tipW / 2)) : 0;
  return (
    <svg className="chart touch" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line className="grid" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
          <text x={padL - 4} y={y(t) + 3} textAnchor="end">{fmtCompact(t)}</text>
        </g>
      ))}
      {lo < 0 && hi > 0 && <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} style={{ stroke: 'var(--muted)' }} strokeDasharray="3 3" />}
      <polygon points={`${upper} ${lower}`} style={{ fill: color }} opacity={0.18} />
      <polyline points={mid} fill="none" style={{ stroke: color }} strokeWidth={2.2} strokeLinejoin="round" />
      {actual && actual.length > 1 && <polyline points={actual.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" style={{ stroke: 'var(--text)' }} strokeWidth={2} strokeDasharray="4 3" />}
      <text x={padL} y={height - 3}>{pointLabel(0)}</text>
      <text x={W - padR} y={height - 3} textAnchor="end">{pointLabel(n - 1)}</text>
      {hover !== null && (
        <g pointerEvents="none">
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={height - padB} style={{ stroke: 'var(--muted)' }} strokeDasharray="2 3" />
          <circle cx={x(hover)} cy={y(bands[hover].p50)} r={4} style={{ fill: color }} />
          <rect x={tipX} y={padT} width={tipW} height={actual?.[hover] !== undefined ? 68 : 55} rx={6} className="tip-box" />
          <text x={tipX + 8} y={padT + 12} className="tip-title">{pointLabel(hover)}</text>
          <text x={tipX + 8} y={padT + 25} className="tip-row" style={{ fill: 'var(--gain)' }}>Bueno (90 %): {fmtMoney(bands[hover].p90, { decimals: false })}</text>
          <text x={tipX + 8} y={padT + 38} className="tip-row" style={{ fill: color }}>Central (50 %): {fmtMoney(bands[hover].p50, { decimals: false })}</text>
          <text x={tipX + 8} y={padT + 51} className="tip-row" style={{ fill: 'var(--loss)' }}>Malo (10 %): {fmtMoney(bands[hover].p10, { decimals: false })}</text>
          {actual?.[hover] !== undefined && <text x={tipX + 8} y={padT + 64} className="tip-row" style={{ fill: 'var(--text)' }}>Real: {fmtMoney(actual[hover], { decimals: false })}</text>}
        </g>
      )}
    </svg>
  );
}
