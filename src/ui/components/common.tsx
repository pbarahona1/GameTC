import { ReactNode, useEffect, useMemo, useState } from 'react';
import type { Cents } from '../../engine/money';
import { fmtMoney, fmtCompact } from '../../engine/format';
import { GLOSSARY_BY_ID } from '../../content/glossary';
import { navStore } from '../nav';
import { store, useUI } from '../store';

export function Money({ c, compact, sign, colored, className = '' }: { c: Cents; compact?: boolean; sign?: boolean; colored?: boolean; className?: string }) {
  const cls = colored ? (c > 0 ? 'gain' : c < 0 ? 'loss' : '') : '';
  const arrow = colored && c !== 0 ? (c > 0 ? '▲ ' : '▼ ') : '';
  return <span className={`num ${cls} ${className}`}>{arrow}{compact ? fmtCompact(c) : fmtMoney(c, { sign })}</span>;
}

export function InfoButton({ term, label }: { term: string; label?: string }) {
  const ui = useUI();
  const seen = ui.state?.meta.seenTerms.includes(term);
  if (!GLOSSARY_BY_ID[term]) return null;
  return (
    <button
      type="button"
      className={`info-btn ${seen ? '' : 'new'}`}
      aria-label={`Qué significa ${label ?? GLOSSARY_BY_ID[term].term}`}
      onClick={(e) => {
        e.stopPropagation();
        navStore.open({ kind: 'term', id: term });
      }}
    >
      i
    </button>
  );
}

/** Explicación breve en línea visible con el modo aprendizaje activado. */
export function Learn({ term }: { term: string }) {
  const ui = useUI();
  const g = GLOSSARY_BY_ID[term];
  if (!ui.settings.learningMode || !g) return null;
  return <p className="learn">{g.short}</p>;
}

export function Stat({ label, term, value, sub, learn }: { label: string; term?: string; value: ReactNode; sub?: ReactNode; learn?: boolean }) {
  return (
    <div className="stat">
      <div className="label">
        <span>{label}</span>
        {term && <InfoButton term={term} label={label} />}
      </div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
      {learn && term && <Learn term={term} />}
    </div>
  );
}

export function Bar({ value, tone }: { value: number; tone?: 'gain' | 'loss' | 'warn' }) {
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`bar ${tone ?? ''}`} role="progressbar" aria-valuenow={Math.round(w)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${w}%` }} />
    </div>
  );
}

export function Pill({ tone, children }: { tone: 'gain' | 'loss' | 'warn' | 'info' | 'neutral' | 'accent'; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Tabs<T extends string>({ items, value, onChange }: { items: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={value === it.id} className={value === it.id ? 'on' : ''} onClick={() => onChange(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Seg<T extends string | number>({ items, value, onChange }: { items: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {items.map((it) => (
        <button key={String(it.id)} className={value === it.id ? 'on' : ''} onClick={() => onChange(it.id)} type="button">
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ title, children, onClose }: { title: ReactNode; children: ReactNode; onClose?: () => void }) {
  const close = onClose ?? (() => navStore.close());
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close} aria-label="Cerrar">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** Entrada de montos en dólares; devuelve centavos. */
export function AmountInput({ id, value, onChange, max, placeholder }: { id: string; value: Cents; onChange: (c: Cents) => void; max?: Cents; placeholder?: string }) {
  const [text, setText] = useState(value ? (value / 100).toFixed(2) : '');
  useEffect(() => {
    const cur = Math.round(parseFloat(text.replace(',', '.')) * 100) || 0;
    if (cur !== value) setText(value ? (value / 100).toFixed(2) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <input
        id={id}
        className="input money"
        inputMode="decimal"
        placeholder={placeholder ?? '0.00'}
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9.,]/g, '');
          setText(t);
          onChange(Math.max(0, Math.round((parseFloat(t.replace(',', '.')) || 0) * 100)));
        }}
      />
      {max !== undefined && max > 0 && (
        <div className="chips">
          {[0.25, 0.5, 1].map((f) => (
            <button key={f} type="button" onClick={() => onChange(Math.floor((max * f) / 100) * 100 || max)}>
              {f === 1 ? 'Todo' : `${f * 100} %`} · {fmtMoney(Math.floor((max * f) / 100) * 100 || max, { decimals: false })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Empty({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="ic" aria-hidden>{icon}</div>
      <div>{children}</div>
    </div>
  );
}

/** Confirmación inline para operaciones importantes (sin diálogos del navegador). */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'btn', detail, disabled, help }: { label: string; confirmLabel?: string; onConfirm: () => void; className?: string; detail?: ReactNode; disabled?: boolean; help?: string }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    const btn = <button className={className} disabled={disabled} onClick={() => setArmed(true)}>{label}</button>;
    return help ? <span className="act">{btn}<InfoButton term={help} /></span> : btn;
  }
  return (
    <div className="card flat" style={{ padding: 12, gap: 8 }}>
      {detail && <div className="small">{detail}</div>}
      <div className="btn-row">
        <button className="btn sm ghost" onClick={() => setArmed(false)}>Cancelar</button>
        <button className="btn sm dark" onClick={() => { setArmed(false); onConfirm(); }}>{confirmLabel ?? 'Confirmar'}</button>
      </div>
    </div>
  );
}

export interface Series {
  name: string;
  values: number[];
  color: string;
  dashed?: boolean;
}

/** Gráfico de líneas SVG propio (liviano, sin dependencias). */
export function LineChart({ series, labels, height = 150, format = (v: number) => fmtCompact(v) }: { series: Series[]; labels?: string[]; height?: number; format?: (v: number) => string }) {
  const W = 340;
  const H = height;
  const padL = 46, padR = 8, padT = 10, padB = labels ? 20 : 8;
  const all = series.flatMap((s) => s.values);
  const { min, max, ticks } = useMemo(() => {
    let lo = Math.min(0, ...all);
    let hi = Math.max(...all, 1);
    if (hi === lo) hi = lo + 1;
    const span = hi - lo;
    if (lo < 0) lo -= span * 0.05;
    hi += span * 0.08;
    const t = [0, 0.5, 1].map((f) => lo + (hi - lo) * f);
    return { min: lo, max: hi, ticks: t };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(all)]);
  const n = Math.max(...series.map((s) => s.values.length));
  if (n < 2) return <Empty icon="📈">El gráfico aparece después del primer cierre de mes.</Empty>;
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.name).join(', ')}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line className="grid" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end">{format(t)}</text>
        </g>
      ))}
      {min < 0 && max > 0 && <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} style={{ stroke: 'var(--muted)' }} strokeWidth={1} strokeDasharray="3 3" />}
      {series.map((s) => {
        const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
        const last = s.values.length - 1;
        return (
          <g key={s.name}>
            {!s.dashed && series.length === 1 && (
              <polygon points={`${x(0)},${y(Math.max(min, 0))} ${pts} ${x(last)},${y(Math.max(min, 0))}`} style={{ fill: s.color }} opacity={0.1} />
            )}
            <polyline points={pts} fill="none" style={{ stroke: s.color }} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" />
            <circle cx={x(last)} cy={y(s.values[last])} r={3.5} style={{ fill: s.color }} />
          </g>
        );
      })}
      {labels && (
        <>
          <text x={padL} y={H - 4}>{labels[0]}</text>
          <text x={W - padR} y={H - 4} textAnchor="end">{labels[labels.length - 1]}</text>
        </>
      )}
    </svg>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="chips tiny">
      {series.map((s) => (
        <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 3, background: s.color, borderRadius: 2, display: 'inline-block' }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

export function useRun() {
  return store.run.bind(store);
}

/** Botón de acción con su explicación accesible (ⓘ). */
export function Act({ label, help, onClick, className = 'btn', disabled }: { label: ReactNode; help: string; onClick: () => void; className?: string; disabled?: boolean }) {
  return (
    <span className="act">
      <button className={className} disabled={disabled} onClick={onClick}>{label}</button>
      <InfoButton term={help} />
    </span>
  );
}

export function CardHead({ title, term, right }: { title: ReactNode; term?: string; right?: ReactNode }) {
  return (
    <div className="card-head">
      <h2>{title}</h2>
      {right}
      {term && <InfoButton term={term} />}
    </div>
  );
}

/** Entrada numérica simple (cantidades, días). */
export function NumInput({ id, value, onChange, min = 0, step = 1, suffix }: { id: string; value: number; onChange: (n: number) => void; min?: number; step?: number; suffix?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input
        id={id}
        className="input num"
        style={{ width: 96, minHeight: 38 }}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(',', '.'));
          if (Number.isFinite(n) && n >= min) onChange(step >= 1 ? Math.round(n) : n);
        }}
      />
      {suffix && <span className="tiny muted">{suffix}</span>}
    </span>
  );
}
