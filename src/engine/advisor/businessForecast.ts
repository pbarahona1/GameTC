import type { GameState } from '../state';
import type { Company } from '../business/types';
import type { BizSectorId, LegalForm } from '../../content/sectors';
import { SECTOR_BY_ID } from '../../content/sectors';
import type { JurisdictionId } from '../../content/jurisdictions';
import { deepClone } from '../clone';
import { advanceDay } from '../simulation';
import { foundCompany, buyListing } from '../business/ownership';
import { post } from '../ledger/ledger';
import { seedFromString, hashNormal } from '../rng';
import { isLastDayOfMonth } from '../time/calendar';
import { fmtMoney, fmtPct } from '../format';
import { Cents, roundCents, clamp } from '../money';
import { addXp, practice } from '../skills/skills';
import { addLog } from '../log';
import { phaseInfo } from '../economy/economy';

/**
 * PROYECCIÓN DE NEGOCIOS (habilidad "Proyección de negocios").
 *
 * No es un oráculo: cada proyección simula VARIOS futuros posibles sobre una
 * copia de la partida (misma economía, mismas reglas, distinto azar) y resume
 * la distribución de resultados (escenario malo 10 %, central 50 %, bueno 90 %).
 *
 * La habilidad cambia dos cosas, ambas reales:
 *  1. Cuántos futuros se simulan (5 + nivel/10, hasta 15): con pocos, los
 *     extremos se estiman mal.
 *  2. El sesgo de tu lectura: hasta ±75 % de ±45 % × (1 − nivel/110) sobre la
 *     demanda (mínimo ±5 %). Un principiante sobre- o subestima las ventas de forma consistente
 *     (el sesgo es el mismo durante una semana: repetir no "lo arregla").
 * Aun con nivel máximo, el resultado real depende del azar y de tus decisiones.
 */

export type ForecastTarget =
  | { kind: 'nueva'; sector: BizSectorId; legalForm: LegalForm; capital: Cents; jurisdiction?: JurisdictionId }
  | { kind: 'empresa'; companyId: number }
  | { kind: 'compra'; listingId: number };

export interface ForecastSample {
  revenue: number[];
  net: number[];
  cash: number[];
  alive: boolean[];
}

export interface Band {
  p10: number;
  p50: number;
  p90: number;
}

export interface BusinessForecast {
  label: string;
  sector: BizSectorId;
  months: number;
  runs: number;
  skill: number;
  errorPct: number;
  confidence: 'baja' | 'media' | 'alta';
  revenue: Band[];
  net: Band[];
  cash: Band[];
  /** Probabilidad estimada de seguir abierta al final del horizonte. */
  survival: number;
  /** Probabilidad de que los últimos 3 meses den ganancia. */
  profitProb: number;
  /** Primer mes en que el escenario central gana dinero (null si no ocurre). */
  breakEvenMonth: number | null;
  /** Resultado acumulado del período. */
  total: Band;
  /** Caja más baja del escenario malo (si es negativa, faltaría capital). */
  worstCash: number;
  insights: string[];
  note: string;
  day: number;
}

export const FORECAST_MONTHS = 12;

/** Nivel efectivo: Proyección + 15 % de Administración + 10 % de Contabilidad. */
export function forecastSkill(state: GameState): number {
  const sk = state.skills;
  return clamp(Math.round((sk.forecasting?.level ?? 1) + (sk.management?.level ?? 1) * 0.15 + (sk.accounting?.level ?? 1) * 0.1), 1, 100);
}

export function forecastRuns(state: GameState): number {
  return clamp(5 + Math.floor(forecastSkill(state) / 10), 5, 15);
}

export function forecastError(skill: number): number {
  return clamp(0.45 * (1 - skill / 110), 0.05, 0.45);
}

function targetSector(state: GameState, t: ForecastTarget): BizSectorId | null {
  if (t.kind === 'nueva') return t.sector;
  if (t.kind === 'empresa') return state.companies.find((c) => c.id === t.companyId)?.sector ?? null;
  return state.listings.find((l) => l.id === t.listingId)?.company.sector ?? null;
}

function topUp(s: GameState, need: Cents): void {
  const lack = need - s.ledger.balances.checking;
  if (lack > 0) post(s.ledger, { day: s.day, memo: 'Supuesto de la proyección: capital disponible', cf: 'internal', lines: [{ account: 'checking', debit: lack }, { account: 'opening_equity', credit: lack }] });
}

/**
 * Un futuro posible: copia la partida, cambia la semilla del azar, crea (o
 * toma) la empresa y la simula mes a mes. Nada de esto toca la partida real.
 */
export function forecastSample(state: GameState, target: ForecastTarget, months: number, run: number): ForecastSample | { error: string } {
  const s: GameState = deepClone(state);
  s.meta.projection = true;
  s.rng = seedFromString(`${state.seed}|${state.day}|pronostico|${run}`);
  let coId: number;
  if (target.kind === 'nueva') {
    topUp(s, target.capital + 100);
    const r = foundCompany(s, { sector: target.sector, legalForm: target.legalForm, capital: target.capital, name: `Proyección ${run}`, jurisdiction: target.jurisdiction });
    if (!r.ok) return { error: r.error };
    coId = s.companies[s.companies.length - 1].id;
  } else if (target.kind === 'compra') {
    const l = s.listings.find((x) => x.id === target.listingId);
    if (!l) return { error: 'La empresa ya no está en venta.' };
    topUp(s, Math.round(l.askPrice * 1.05) + 100);
    coId = l.company.id;
    const r = buyListing(s, l.id, l.askPrice);
    if (!r.ok) return { error: r.error };
  } else {
    coId = target.companyId;
    if (!s.companies.some((c) => c.id === coId)) return { error: 'Empresa inexistente.' };
  }
  const out: ForecastSample = { revenue: [], net: [], cash: [], alive: [] };
  let m = 0;
  let guard = 0;
  while (m < months && guard++ < 40 * months) {
    advanceDay(s);
    if (!isLastDayOfMonth(s.day)) continue;
    m++;
    const co = s.companies.find((c) => c.id === coId);
    const open = !!co && (co.status === 'active' || co.status === 'insolvent');
    const h = co?.history[co.history.length - 1];
    const fresh = h && h.day === s.day;
    out.revenue.push(open && fresh ? h.revenue : 0);
    out.net.push(open && fresh ? h.netIncome : 0);
    out.cash.push(open && co ? co.ledger.balances.cash : 0);
    out.alive.push(open && co!.status === 'active');
  }
  return out;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function band(values: number[]): Band {
  const v = [...values].sort((a, b) => a - b);
  return { p10: quantile(v, 0.1), p50: quantile(v, 0.5), p90: quantile(v, 0.9) };
}

/** Resume las muestras y aplica el sesgo de lectura según la habilidad. */
export function summarizeForecast(state: GameState, target: ForecastTarget, samples: ForecastSample[]): BusinessForecast {
  const sector = targetSector(state, target) ?? 'minimarket';
  const months = Math.max(0, ...samples.map((x) => x.revenue.length));
  const skill = forecastSkill(state);
  const err = forecastError(skill);
  const week = Math.floor(state.day / 7);
  const key = target.kind === 'nueva' ? target.sector : target.kind === 'empresa' ? `co${target.companyId}` : `l${target.listingId}`;
  const z1 = clamp(hashNormal(`${state.seed}|fc|${key}|${week}`), -2, 2);
  const z2 = clamp(hashNormal(`${state.seed}|fc2|${key}|${week}`), -2, 2);
  // Sesgo de lectura sobre la demanda (típico ±err/3, máximo ±0,75·err); la ganancia se mueve con el margen de contribución (~30 %).
  const bias = 1 + clamp(z1, -1.5, 1.5) * err * 0.5;
  const at = (arr: number[], i: number) => arr[i] ?? 0;
  const revenue: Band[] = [];
  const net: Band[] = [];
  const cash: Band[] = [];
  let cumAdj = 0;
  for (let i = 0; i < months; i++) {
    const r = band(samples.map((x) => at(x.revenue, i)));
    const n = band(samples.map((x) => at(x.net, i)));
    const c = band(samples.map((x) => at(x.cash, i)));
    const adj = (bias - 1) * r.p50 * 0.3;
    cumAdj += adj;
    const widen = (b: Band) => {
      const w = err * 0.5 * Math.abs(b.p50);
      return { p10: Math.round(b.p10 - w), p50: Math.round(b.p50), p90: Math.round(b.p90 + w) };
    };
    revenue.push(widen({ p10: Math.max(0, r.p10 * bias), p50: r.p50 * bias, p90: r.p90 * bias }));
    net.push(widen({ p10: n.p10 + adj, p50: n.p50 + adj, p90: n.p90 + adj }));
    cash.push(widen({ p10: c.p10 + cumAdj, p50: c.p50 + cumAdj, p90: c.p90 + cumAdj }));
  }
  // Coherencia con tu lectura: si con tu sesgo la caja de un futuro se vuelve negativa, lo contás como fracaso.
  const cumAdjAt: number[] = [];
  {
    let acc = 0;
    for (let i = 0; i < months; i++) {
      acc += (bias - 1) * revenue[i].p50 / bias * 0.3;
      cumAdjAt.push(acc);
    }
  }
  const aliveEnd = samples.filter((x) => x.alive[x.alive.length - 1] && x.cash.every((c, i) => c + (cumAdjAt[i] ?? 0) >= 0)).length / Math.max(1, samples.length);
  const survival = clamp(aliveEnd + clamp(z2, -1.5, 1.5) * err * 0.3, 0.01, 0.99);
  const last3 = samples.map((x) => x.net.slice(-3).reduce((a, b) => a + b, 0));
  const profitProb = clamp(last3.filter((v) => v > 0).length / Math.max(1, samples.length) + clamp(z2, -1.5, 1.5) * err * 0.2, 0.01, 0.99);
  const totals = samples.map((x) => x.net.reduce((a, b) => a + b, 0));
  const tb = band(totals);
  const totalAdj = cumAdj;
  const total: Band = { p10: Math.round(tb.p10 + totalAdj - err * 0.5 * Math.abs(tb.p50)), p50: Math.round(tb.p50 + totalAdj), p90: Math.round(tb.p90 + totalAdj + err * 0.5 * Math.abs(tb.p50)) };
  const be = net.findIndex((b) => b.p50 > 0);
  const breakEvenMonth = be >= 0 ? be + 1 : null;
  const worstCash = Math.min(0, ...cash.map((c) => c.p10)) < 0 ? Math.min(...cash.map((c) => c.p10)) : Math.min(...cash.map((c) => c.p10));
  const confidence = err < 0.15 ? 'alta' : err < 0.3 ? 'media' : 'baja';
  const insights: string[] = [];
  const surv10 = Math.round(survival * 10);
  insights.push(`En ${surv10} de cada 10 futuros simulados la empresa sigue operando sin atrasos al mes ${months}.`);
  if (breakEvenMonth) insights.push(`En el escenario central empieza a ganar dinero en el mes ${breakEvenMonth}.`);
  else insights.push(`En el escenario central no llega a ganar dinero en ${months} meses: revisá precios, costos fijos o capital.`);
  if (worstCash < 0) insights.push(`En el escenario malo la caja quedaría en ${fmtMoney(worstCash)}: harían falta unos ${fmtMoney(-worstCash)} más de capital para no atrasarse.`);
  else insights.push(`Incluso en el escenario malo la caja no baja de ${fmtMoney(worstCash)}.`);
  if (survival < 0.6) insights.push('Riesgo alto: considerá más capital, una forma legal con responsabilidad limitada o un sector con menos costos fijos.');
  const ph = phaseInfo(state);
  if (state.macro.phase === 'recesion' || state.macro.phase === 'desaceleracion') insights.push(`La economía está en ${ph.name.toLowerCase()}: la demanda es más baja que lo normal y puede cambiar durante el año.`);
  const sec = SECTOR_BY_ID[sector];
  const label = target.kind === 'nueva' ? `Nueva ${sec.name.toLowerCase()}` : target.kind === 'empresa' ? state.companies.find((c) => c.id === target.companyId)?.name ?? 'Empresa' : state.listings.find((l) => l.id === target.listingId)?.company.name ?? 'Empresa en venta';
  return {
    label, sector, months, runs: samples.length, skill, errorPct: err, confidence, revenue, net, cash, survival, profitProb, breakEvenMonth, total, worstCash, insights, day: state.day,
    note: `Basado en ${samples.length} futuros simulados con las reglas reales del juego (economía, demanda, competencia, costos). Tu nivel efectivo de Proyección de negocios es ${skill}: tu lectura puede desviarse ±${Math.round(err * 100)} %. Supone que manejás la empresa como hoy (o con su gerente); no es una promesa.`,
  };
}

/** Versión síncrona (pruebas y cálculos cortos). */
export function forecastBusiness(state: GameState, target: ForecastTarget, months = FORECAST_MONTHS, runs = forecastRuns(state)): BusinessForecast | { error: string } {
  const samples: ForecastSample[] = [];
  for (let r = 0; r < runs; r++) {
    const x = forecastSample(state, target, months, r);
    if ('error' in x) return x;
    samples.push(x);
  }
  return summarizeForecast(state, target, samples);
}

/** Práctica: cada proyección enseña (con rendimientos decrecientes en el día). */
export function recordForecastPractice(state: GameState, f: BusinessForecast): void {
  practice(state, `forecast:${f.sector}`, 'forecasting', 60);
}

/** Guarda la proyección en la empresa para compararla después con la realidad. */
export function attachForecast(state: GameState, companyId: number, f: BusinessForecast): void {
  const co = state.companies.find((c) => c.id === companyId);
  if (!co) return;
  co.forecast = {
    day: state.day, months: f.months, skill: f.skill, survival: f.survival,
    revenue: f.revenue.map((b) => [b.p10, b.p50, b.p90].map(roundCents) as [number, number, number]),
    net: f.net.map((b) => [b.p10, b.p50, b.p90].map(roundCents) as [number, number, number]),
    checked: 0,
  };
}

/**
 * Cierre de mes de una empresa del jugador: aprender dirigiendo, y comparar la
 * proyección guardada con lo que pasó (más XP cuanto más se aprende del error).
 */
export function forecastMonthEnd(state: GameState, co: Company): void {
  if (co.npc || state.meta.projection) return;
  addXp(state, 'forecasting', 12);
  const f = co.forecast;
  if (!f) return;
  const idx = co.history.filter((h) => h.day > f.day).length - 1;
  if (idx < 0 || idx >= f.months || idx < f.checked) return;
  f.checked = idx + 1;
  if (idx + 1 !== 3 && idx + 1 !== 6 && idx + 1 !== f.months) return;
  const real = co.history.filter((h) => h.day > f.day).slice(0, idx + 1).reduce((s, h) => s + h.revenue, 0);
  const est = f.revenue.slice(0, idx + 1).reduce((s, b) => s + b[1], 0);
  const lo = f.revenue.slice(0, idx + 1).reduce((s, b) => s + b[0], 0);
  const hi = f.revenue.slice(0, idx + 1).reduce((s, b) => s + b[2], 0);
  const errPct = est > 0 ? real / est - 1 : 0;
  const inRange = real >= lo && real <= hi;
  addXp(state, 'forecasting', 80 + Math.round(Math.min(1, Math.abs(errPct)) * 120));
  addLog(state, inRange ? 'success' : 'info', '🔮', `${co.name}: a ${idx + 1} meses vendiste ${fmtMoney(real)}; tu proyección central era ${fmtMoney(est)} (${errPct >= 0 ? '+' : ''}${fmtPct(errPct, 0)}). ${inRange ? 'Quedó dentro del rango proyectado.' : 'Quedó fuera del rango: el futuro sorprendió.'} Comparar enseña: +XP en Proyección de negocios.`);
}
