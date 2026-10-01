import type { GameState } from '../state';
import type { Mandate, MandatePosition, MandateProfile, Stock } from './types';
import type { ProHire } from '../pros/types';
import { ActionResult, OK, FAIL } from '../result';
import { Cents, usd, roundCents, clamp } from '../money';
import { fmtMoney, fmtPct } from '../format';
import { bookBuy, bookSell, revalueInvestments } from './portfolio';
import { fairValue, spreadOf, isTradingDay } from './stocks';
import { canPayFromChecking } from '../finance/payments';
import { hashNormal } from '../rng';
import { dateOf, isLastDayOfMonth } from '../time/calendar';
import { stockMarketDrift } from '../economy/economy';
import { practice } from '../skills/skills';

/**
 * GESTOR DE INVERSIONES (mandato de gestión).
 *
 * El jugador contrata a un gestor y le entrega dinero. El gestor lo invierte
 * en los MISMOS instrumentos del juego (acciones y fondos) y el valor de la
 * cuenta sale de los precios reales del mercado: no hay rendimientos
 * inventados. La calidad del gestor (que sube con experiencia y capacitación)
 * cambia de verdad sus decisiones:
 *  - Estima el valor justo de cada acción con un error de
 *    ±60 % × (1 − habilidad/110), mínimo ±6 %. Como el precio de cada acción
 *    tiende a su valor justo, estimar mejor significa elegir mejor.
 *  - Detecta mejor a las empresas débiles (evita quiebras).
 *  - Los buenos gestores reducen acciones en recesión; los malos venden en el
 *    pánico y compran en la euforia.
 * Cobra una comisión anual de gestión (sobre el valor) y una comisión de éxito
 * (sobre la ganancia por encima del máximo anterior). Ningún gestor garantiza
 * ganancias: el mercado puede caer para todos.
 *
 * Para el jugador funciona como un fondo privado: tiene "unidades" con un valor
 * por unidad. Las comisiones se descuentan del valor y la ganancia tributa al
 * retirar (como en cualquier fondo).
 */
export const NAV_START = 10000;
export const MIN_MANDATE_USD = 2500;
const TRADING_COMMISSION = 0.001;
const CASH_BUFFER = 0.01;

export const PROFILE_INFO: Record<MandateProfile, { name: string; stocks: number; bonds: number; money: number; description: string }> = {
  conservador: { name: 'Conservador', stocks: 0.25, bonds: 0.55, money: 0.2, description: 'Prioriza no perder: mayoría en bonos y liquidez. Crece poco y cae poco.' },
  moderado: { name: 'Moderado', stocks: 0.6, bonds: 0.3, money: 0.1, description: 'Equilibrio entre crecimiento y estabilidad.' },
  agresivo: { name: 'Agresivo', stocks: 0.9, bonds: 0.05, money: 0.05, description: 'Casi todo en acciones: más ganancia esperada y caídas más fuertes.' },
};

const BOND_FUND = 'F-BON';
const MONEY_FUND = 'F-MON';
const INDEX_FUND = 'F-IDX';

// ------------------------------------------------------------ Consultas

export function mandates(state: GameState): Mandate[] {
  return state.managed?.mandates ?? [];
}

export function activeMandates(state: GameState): Mandate[] {
  return mandates(state).filter((m) => m.status === 'activo');
}

export function mandateById(state: GameState, id: string): Mandate | undefined {
  return mandates(state).find((m) => m.id === id);
}

export function mandateForHire(state: GameState, hireId: number): Mandate | undefined {
  return activeMandates(state).find((m) => m.hireId === hireId);
}

function hireOfMandate(state: GameState, m: Mandate): ProHire | undefined {
  return state.pros.hires.find((h) => h.id === m.hireId);
}

/** Habilidad efectiva del gestor: calidad + experiencia (hasta 30 años cuentan). */
export function managerSkill(h: ProHire | undefined): number {
  if (!h) return 20;
  return clamp(Math.round(h.pro.quality * 0.85 + Math.min(30, h.pro.experience) * 0.5), 5, 98);
}

export function managerError(skill: number): number {
  return clamp(0.6 * (1 - skill / 110), 0.06, 0.6);
}

export function feeRates(h: ProHire | undefined): { mgmt: number; perf: number } {
  return { mgmt: h?.pro.mgmtFee ?? 0.015, perf: h?.pro.perfFee ?? 0.15 };
}

function unitPrice(state: GameState, p: MandatePosition): number {
  if (p.kind === 'stock') {
    const s = state.stocks.stocks.find((x) => x.id === p.id);
    return s ? s.price : 0;
  }
  return state.funds.funds.find((f) => f.id === p.id)?.nav ?? 0;
}

export function positionValue(state: GameState, p: MandatePosition): number {
  return p.units * unitPrice(state, p);
}

export function mandateValue(state: GameState, m: Mandate): number {
  return m.cash + m.positions.reduce((s, p) => s + positionValue(state, p), 0);
}

function refreshNav(state: GameState, m: Mandate): void {
  if (m.units <= 0) return;
  m.nav = Math.max(0.0001, mandateValue(state, m) / m.units);
}

function benchNow(state: GameState): number {
  return state.funds.funds.find((f) => f.id === INDEX_FUND)?.nav ?? 1;
}

export function mandateReturn(state: GameState, m: Mandate): { total: number; bench: number } {
  return { total: m.navStart > 0 ? m.nav / m.navStart - 1 : 0, bench: m.benchStart > 0 ? benchNow(state) / m.benchStart - 1 : 0 };
}

function note(m: Mandate, day: number, text: string): void {
  m.notes.push({ d: day, text });
  if (m.notes.length > 24) m.notes.shift();
}

// ------------------------------------------------------------ Operaciones internas del gestor

function tradeCost(state: GameState, p: MandatePosition, value: number): number {
  if (p.kind === 'fund') return 0;
  const s = state.stocks.stocks.find((x) => x.id === p.id);
  return value * ((s ? spreadOf(s) / 2 : 0.005) + TRADING_COMMISSION);
}

/** Vende una fracción de una posición y devuelve la caja neta obtenida. */
function sellPart(state: GameState, m: Mandate, p: MandatePosition, units: number): number {
  const u = Math.min(p.units, units);
  if (u <= 0) return 0;
  const gross = u * unitPrice(state, p);
  const cost = tradeCost(state, p, gross);
  p.units -= u;
  m.cash += gross - cost;
  m.tradingCosts += cost;
  return gross - cost;
}

function buyValue(state: GameState, m: Mandate, kind: 'stock' | 'fund', id: string, value: number): void {
  const price = kind === 'stock' ? state.stocks.stocks.find((x) => x.id === id)?.price ?? 0 : state.funds.funds.find((f) => f.id === id)?.nav ?? 0;
  if (price <= 0 || value <= 0) return;
  let p = m.positions.find((x) => x.kind === kind && x.id === id);
  const probe: MandatePosition = p ?? { kind, id, units: 0 };
  const costRate = kind === 'stock' ? (tradeCost(state, probe, 10000) / 10000) : 0;
  const spend = Math.min(value, m.cash);
  let units = (spend / (1 + costRate)) / price;
  if (kind === 'stock') units = Math.floor(units);
  if (units <= 0) return;
  const gross = units * price;
  const cost = gross * costRate;
  if (!p) {
    p = probe;
    m.positions.push(p);
  }
  p.units += units;
  m.cash -= gross + cost;
  m.tradingCosts += cost;
}

/** Consigue caja vendiendo primero el fondo monetario y luego a prorrata. */
function raiseCash(state: GameState, m: Mandate, amount: number): void {
  if (m.cash >= amount) return;
  const money = m.positions.find((p) => p.kind === 'fund' && p.id === MONEY_FUND);
  if (money) {
    const price = unitPrice(state, money);
    if (price > 0) sellPart(state, m, money, Math.min(money.units, (amount - m.cash) / price));
  }
  if (m.cash >= amount) return;
  const rest = m.positions.reduce((s, p) => s + positionValue(state, p), 0);
  if (rest <= 0) return;
  const frac = Math.min(1, ((amount - m.cash) * 1.01) / rest);
  for (const p of m.positions) sellPart(state, m, p, p.kind === 'stock' ? Math.ceil(p.units * frac) : p.units * frac);
}

function cleanPositions(m: Mandate): void {
  m.positions = m.positions.filter((p) => p.units > 1e-9);
}

/** Estimación del gestor sobre una acción (determinista por mes: no "reintenta" hasta acertar). */
function managerView(state: GameState, m: Mandate, s: Stock, skill: number): { expected: number; health: number } {
  const err = managerError(skill);
  const month = Math.floor(state.day / 30);
  const z = clamp(hashNormal(`${state.seed}|gestor|${m.id}|${s.id}|${month}`), -2.5, 2.5);
  const z2 = clamp(hashNormal(`${state.seed}|gestor-h|${m.id}|${s.id}|${month}`), -2.5, 2.5);
  const fv = fairValue(state, s) * (1 + z * err);
  const drift = stockMarketDrift(state).drift * s.beta * 0.25;
  const expected = Math.log(Math.max(1, fv) / Math.max(1, s.price)) * 0.1 + drift;
  return { expected, health: s.health + z2 * (100 - skill) * 0.4 };
}

function targetWeights(state: GameState, m: Mandate, skill: number): { stocks: number; bonds: number; money: number } {
  const base = PROFILE_INFO[m.profile];
  let stocks = base.stocks;
  const phase = state.macro.phase;
  if (skill >= 60) {
    if (phase === 'recesion' || phase === 'desaceleracion') stocks -= 0.15;
    if (phase === 'recuperacion') stocks += 0.05;
  } else if (skill < 35) {
    // Errores de conducta típicos: euforia en el auge, pánico en la recesión.
    if (phase === 'auge') stocks += 0.1;
    if (phase === 'recesion') stocks -= 0.2;
  }
  stocks = clamp(stocks, 0.05, 0.95);
  const shift = stocks - base.stocks;
  const bonds = clamp(base.bonds - shift, 0, 0.9);
  const money = Math.max(0, 1 - stocks - bonds);
  return { stocks, bonds, money };
}

/** Rebalanceo mensual: el gestor elige acciones y reparte según el perfil. */
export function rebalance(state: GameState, m: Mandate): void {
  const h = hireOfMandate(state, m);
  const skill = managerSkill(h);
  const V = mandateValue(state, m);
  if (V <= 0) return;
  const w = targetWeights(state, m, skill);
  const picksN = V < usd(10000) ? 4 : V < usd(50000) ? 6 : 8;
  const views = state.stocks.stocks
    .filter((s) => s.status === 'activa')
    .map((s) => ({ s, ...managerView(state, m, s, skill) }))
    .filter((x) => x.health >= 25)
    .sort((a, b) => b.expected - a.expected);
  const picks = views.filter((x) => x.expected > -0.02).slice(0, picksN);
  const target = new Map<string, { kind: 'stock' | 'fund'; value: number }>();
  const stockValue = V * w.stocks;
  const perPick = picks.length ? (stockValue * (picks.length / picksN)) / picks.length : 0;
  for (const p of picks) target.set(`stock:${p.s.id}`, { kind: 'stock', value: perPick });
  const leftover = stockValue - perPick * picks.length;
  if (leftover > 1) target.set(`fund:${INDEX_FUND}`, { kind: 'fund', value: leftover });
  target.set(`fund:${BOND_FUND}`, { kind: 'fund', value: V * w.bonds });
  target.set(`fund:${MONEY_FUND}`, { kind: 'fund', value: Math.max(0, V * (w.money - CASH_BUFFER)) });
  const tolerance = V * 0.02;
  const sold: string[] = [];
  const bought: string[] = [];
  // 1. Ventas (lo que ya no quiere o le sobra)
  for (const p of m.positions) {
    const t = target.get(`${p.kind}:${p.id}`);
    const cur = positionValue(state, p);
    const want = t?.value ?? 0;
    if (cur - want > tolerance || (!t && cur > 0)) {
      const price = unitPrice(state, p);
      if (price <= 0) continue;
      const units = t ? (cur - want) / price : p.units;
      sellPart(state, m, p, p.kind === 'stock' ? Math.min(p.units, Math.ceil(units)) : units);
      if (p.kind === 'stock') sold.push(p.id);
    }
  }
  cleanPositions(m);
  // 2. Compras
  for (const [key, t] of target) {
    const id = key.split(':')[1];
    const cur = m.positions.find((p) => p.kind === t.kind && p.id === id);
    const curV = cur ? positionValue(state, cur) : 0;
    if (t.value - curV > tolerance) {
      buyValue(state, m, t.kind, id, t.value - curV);
      if (t.kind === 'stock') bought.push(id);
    }
  }
  cleanPositions(m);
  m.lastRebalance = state.day;
  refreshNav(state, m);
  if (bought.length || sold.length) note(m, state.day, `Rebalanceo: ${bought.length ? `compró ${bought.join(', ')}` : ''}${bought.length && sold.length ? '; ' : ''}${sold.length ? `vendió ${sold.join(', ')}` : ''}. Acciones ${fmtPct(w.stocks, 0)}, bonos ${fmtPct(w.bonds, 0)}, liquidez ${fmtPct(w.money, 0)}.`);
}

// ------------------------------------------------------------ Acciones del jugador

function nextMandateId(state: GameState): string {
  return `M-${state.meta.nextId++}`;
}

export function minMandate(state: GameState): Cents {
  return usd(MIN_MANDATE_USD * state.macro.priceIndex);
}

export function openMandate(state: GameState, hireId: number, amount: Cents, profile: MandateProfile): ActionResult {
  const h = state.pros.hires.find((x) => x.id === hireId && x.pro.kind === 'gestor');
  if (!h) return FAIL('Primero contratá un gestor de inversiones.');
  if (mandateForHire(state, hireId)) return depositMandate(state, mandateForHire(state, hireId)!.id, amount);
  if (state.legal?.prison) return FAIL('Desde prisión no podés invertir.');
  const min = minMandate(state);
  if (!(amount >= min)) return FAIL(`El mínimo para abrir una cuenta gestionada es ${fmtMoney(min)}.`);
  if (!canPayFromChecking(state, amount)) return FAIL(`Necesitás ${fmtMoney(amount)} en la cuenta corriente.`);
  const m: Mandate = {
    id: nextMandateId(state), hireId, managerName: h.pro.name, profile, status: 'activo', cash: 0, positions: [], units: 0, nav: NAV_START, hwm: NAV_START,
    startDay: state.day, lastRebalance: -9999, contributed: 0, withdrawn: 0, mgmtFeesPaid: 0, perfFeesPaid: 0, tradingCosts: 0,
    benchStart: benchNow(state), navStart: NAV_START, history: [{ d: state.day, nav: NAV_START, bench: benchNow(state) }], notes: [],
  };
  state.managed.mandates.push(m);
  const r = depositMandate(state, m.id, amount);
  if (!r.ok) {
    state.managed.mandates = state.managed.mandates.filter((x) => x !== m);
    return r;
  }
  return OK(`${h.pro.name} ya administra ${fmtMoney(amount)} con perfil ${PROFILE_INFO[profile].name.toLowerCase()}. Invierte en el mercado real; el resultado no está garantizado.`);
}

export function depositMandate(state: GameState, id: string, amount: Cents): ActionResult {
  const m = mandateById(state, id);
  if (!m || m.status !== 'activo') return FAIL('Cuenta gestionada inexistente.');
  if (state.legal?.prison) return FAIL('Desde prisión no podés invertir.');
  if (!(amount >= usd(100))) return FAIL('El aporte mínimo es $100.');
  if (!canPayFromChecking(state, amount)) return FAIL(`Necesitás ${fmtMoney(amount)} en la cuenta corriente.`);
  refreshNav(state, m);
  revalueInvestments(state, ['managed']);
  const units = amount / m.nav;
  bookBuy(state, 'managed', m.id, units, amount, 0, `Aporte a la cuenta gestionada por ${m.managerName}`);
  m.units += units;
  m.cash += amount;
  m.contributed += amount;
  practice(state, 'mandate', 'finEdu', 30);
  // Invierte el dinero nuevo en el próximo día hábil (o ahora mismo si el mercado está abierto).
  if (isTradingDay(state.day)) rebalance(state, m);
  else m.lastRebalance = -9999;
  refreshNav(state, m);
  revalueInvestments(state, ['managed']);
  return OK(`Aportaste ${fmtMoney(amount)} a la cuenta de ${m.managerName}.`);
}

/**
 * Retiro: el gestor vende a prorrata (con sus costos) y te transfiere el
 * dinero. Si retirás todo, cobra la comisión de éxito pendiente y se cierra.
 */
export function withdrawMandate(state: GameState, id: string, amount: Cents | 'todo', reason = ''): ActionResult {
  const m = mandateById(state, id);
  if (!m || m.status !== 'activo') return FAIL('Cuenta gestionada inexistente.');
  refreshNav(state, m);
  const all = amount === 'todo' || amount >= mandateValue(state, m) - 1;
  if (all) chargePerformanceFee(state, m);
  refreshNav(state, m);
  revalueInvestments(state, ['managed']);
  const V0 = mandateValue(state, m);
  if (V0 <= 0) return FAIL('La cuenta no tiene valor para retirar.');
  const want = all ? V0 : Math.min(V0, amount as number);
  if (!(want > 0)) return FAIL('Monto inválido.');
  const frac = Math.min(1, want / V0);
  const cashShare = m.cash * frac;
  const before = m.cash;
  for (const p of m.positions) sellPart(state, m, p, p.kind === 'stock' ? (frac >= 1 ? p.units : Math.round(p.units * frac)) : p.units * frac);
  const raised = m.cash - before;
  const proceeds = Math.max(0, Math.floor(cashShare + raised));
  m.cash -= proceeds;
  if (m.cash < 0.5) m.cash = Math.max(0, m.cash);
  cleanPositions(m);
  const hold = state.managed.holdings[m.id];
  const unitsOut = all || !hold ? hold?.qty ?? m.units : Math.min(hold.qty, m.units * frac);
  if (hold && unitsOut > 0) bookSell(state, 'managed', m.id, unitsOut, proceeds, 0, `Retiro de la cuenta gestionada por ${m.managerName}${reason ? ` (${reason})` : ''}`);
  m.units -= unitsOut;
  m.withdrawn += proceeds;
  if (all || m.units <= 1e-9) {
    m.status = 'cerrado';
    m.units = 0;
    m.positions = [];
    m.cash = 0;
    note(m, state.day, 'Cuenta cerrada.');
  } else refreshNav(state, m);
  revalueInvestments(state, ['managed']);
  return OK(`Retiraste ${fmtMoney(proceeds)} de la cuenta de ${m.managerName}${all ? ' y se cerró' : ''}.`);
}

export function setMandateProfile(state: GameState, id: string, profile: MandateProfile): ActionResult {
  const m = mandateById(state, id);
  if (!m || m.status !== 'activo') return FAIL('Cuenta gestionada inexistente.');
  m.profile = profile;
  if (isTradingDay(state.day)) rebalance(state, m);
  else m.lastRebalance = -9999;
  revalueInvestments(state, ['managed']);
  return OK(`Perfil cambiado a ${PROFILE_INFO[profile].name.toLowerCase()}: ${PROFILE_INFO[profile].description}`);
}

function chargePerformanceFee(state: GameState, m: Mandate): void {
  refreshNav(state, m);
  if (m.nav <= m.hwm || m.units <= 0) return;
  const { perf } = feeRates(hireOfMandate(state, m));
  const fee = (m.nav - m.hwm) * m.units * perf;
  if (fee <= 0) return;
  raiseCash(state, m, fee);
  m.cash -= Math.min(m.cash, fee);
  m.perfFeesPaid += fee;
  refreshNav(state, m);
  m.hwm = m.nav;
  note(m, state.day, `Comisión de éxito: ${fmtMoney(Math.round(fee))} (${fmtPct(perf, 0)} de la ganancia sobre el máximo anterior).`);
}

// ------------------------------------------------------------ Simulación diaria

export function managedDay(state: GameState): void {
  if (!state.managed) return;
  const g = dateOf(state.day);
  for (const m of activeMandates(state)) {
    // Acciones que dejaron de cotizar: se pierden (el gestor pudo haberlas evitado).
    for (const p of m.positions) if (p.kind === 'stock' && !state.stocks.stocks.some((s) => s.id === p.id)) {
      note(m, state.day, `${p.id} dejó de cotizar: la posición se perdió.`);
      p.units = 0;
    }
    cleanPositions(m);
    if (isTradingDay(state.day) && state.day - m.lastRebalance >= 30) rebalance(state, m);
    if (isLastDayOfMonth(state.day)) {
      const { mgmt } = feeRates(hireOfMandate(state, m));
      const fee = mandateValue(state, m) * (mgmt / 12);
      if (fee > 0) {
        raiseCash(state, m, fee);
        m.cash -= Math.min(m.cash, fee);
        m.mgmtFeesPaid += fee;
      }
      if (g.m === 12) chargePerformanceFee(state, m);
    }
    refreshNav(state, m);
    if (g.weekday === 5 || state.day - (m.history[m.history.length - 1]?.d ?? 0) >= 7) {
      m.history.push({ d: state.day, nav: Math.round(m.nav * 100) / 100, bench: Math.round(benchNow(state) * 100) / 100 });
      if (m.history.length > 520) m.history.shift();
    }
  }
}

// ------------------------------------------------------------ Ganchos del mercado

export function mandatesOnDividend(state: GameState, stockId: string, perShare: number): void {
  for (const m of activeMandates(state)) for (const p of m.positions) if (p.kind === 'stock' && p.id === stockId) m.cash += p.units * perShare;
}

export function mandatesOnDistribution(state: GameState, fundId: string, perUnit: number): void {
  for (const m of activeMandates(state)) for (const p of m.positions) if (p.kind === 'fund' && p.id === fundId) m.cash += p.units * perUnit;
}

export function mandatesOnSplit(state: GameState, stockId: string, ratio: number): void {
  for (const m of activeMandates(state)) for (const p of m.positions) if (p.kind === 'stock' && p.id === stockId) p.units *= ratio;
}

/** Cierra la cuenta al despedir al gestor (se vende todo y vuelve a la cuenta corriente). */
export function closeMandatesOfHire(state: GameState, hireId: number, reason: string): Cents {
  let total = 0;
  for (const m of activeMandates(state)) {
    if (m.hireId !== hireId) continue;
    const before = state.ledger.balances.checking;
    withdrawMandate(state, m.id, 'todo', reason);
    total += state.ledger.balances.checking - before;
  }
  return total;
}

/** Resumen para la interfaz y el asesor. */
export function mandateSummary(state: GameState, m: Mandate) {
  const h = hireOfMandate(state, m);
  const skill = managerSkill(h);
  const value = roundCents(mandateValue(state, m));
  const r = mandateReturn(state, m);
  const hold = state.managed.holdings[m.id];
  return {
    value, skill, error: managerError(skill), fees: feeRates(h), hire: h,
    cost: hold?.cost ?? 0, gain: value - (hold?.cost ?? 0),
    totalReturn: r.total, benchReturn: r.bench,
    positions: m.positions.map((p) => ({ ...p, value: roundCents(positionValue(state, p)), weight: value > 0 ? positionValue(state, p) / value : 0 })),
    cashWeight: value > 0 ? m.cash / value : 0,
  };
}

