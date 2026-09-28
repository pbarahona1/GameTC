import { deepClone } from '../clone';
import type { LifestyleId } from '../../content/lifestyle';
import type { GameState } from '../state';
import { advanceDay } from '../simulation';
import { isLastDayOfMonth } from '../time/calendar';
import { balanceSheet } from '../reports/statements';
import { quitJob } from '../career/career';
import { changeLifestyle } from '../finance/budget';
import { takeLoan } from '../finance/loans';
import { openDeposit, setPensionRate, transfer } from '../finance/banking';
import type { Cents } from '../money';
import type { BizSectorId, LegalForm } from '../../content/sectors';
import { foundCompany } from '../business/ownership';
import { buyProperty, allMortgageQuotes, marketRent, setRent, revaluePersonalProperties } from '../realestate/realestate';
import { placeStockOrder } from '../invest/stocks';
import { sellFund } from '../invest/funds';
import { sellBond } from '../invest/bonds';
import { revalueInvestments } from '../invest/portfolio';

/** Caída instantánea de mercados: acciones −X, fondos de acciones −0,85·X, Mogul −0,5·X, inmuebles −0,3·X. */
export function applyCrash(s: GameState, drop: number): void {
  for (const st of s.stocks.stocks) {
    st.price = Math.max(1, Math.round(st.price * (1 - drop)));
    st.momentum = -0.02;
  }
  for (const f of s.funds.funds) if (['F-IDX', 'F-TEC', 'F-DIV'].includes(f.id)) f.nav *= 1 - drop * 0.85;
  for (const a of s.mogul.assets) a.nav *= 1 - drop * 0.5;
  for (const z of s.realEstate.zones) z.index *= 1 - drop * 0.3;
  for (const p of s.realEstate.properties) p.appraisal = Math.round(p.appraisal * (1 - drop * 0.3));
  revalueInvestments(s);
  revaluePersonalProperties(s);
}

/**
 * Escenarios hipotéticos ("¿qué pasaría si...?").
 * Se simula una COPIA de la partida con eventos aleatorios desactivados.
 * Nada de lo que ocurre aquí afecta a la partida real.
 */
export type ScenarioInput =
  | { kind: 'baseline' }
  | { kind: 'quit_job' }
  | { kind: 'lifestyle'; lifestyle: LifestyleId }
  | { kind: 'loan'; bankId: string; amount: Cents; termMonths: number }
  | { kind: 'deposit'; amount: Cents; termMonths: number }
  | { kind: 'save_monthly'; amount: Cents }
  | { kind: 'pension'; rate: number }
  | { kind: 'found_company'; sector: BizSectorId; legalForm: LegalForm; capital: Cents }
  | { kind: 'recession'; months: number }
  | { kind: 'rate_shock'; delta: number }
  | { kind: 'market_crash'; drop: number }
  | { kind: 'buy_property'; listingId: number; ltv: number; years: number; rateType: 'fija' | 'variable' }
  | { kind: 'sell_portfolio' };

export interface ScenarioPoint {
  month: number;
  liquid: Cents;
  netWorth: Cents;
  debt: Cents;
}

export interface ScenarioResult {
  baseline: ScenarioPoint[];
  scenario: ScenarioPoint[];
  error?: string;
  note: string;
}

function project(src: GameState, months: number, setup?: (s: GameState) => string | null, monthly?: (s: GameState) => void): { points: ScenarioPoint[]; error?: string } {
  const s: GameState = deepClone(src);
  s.meta.projection = true;
  if (setup) {
    const err = setup(s);
    if (err) return { points: [], error: err };
  }
  const points: ScenarioPoint[] = [];
  const snap = (month: number) => {
    const bs = balanceSheet(s);
    points.push({ month, liquid: bs.liquid, netWorth: bs.netWorth, debt: bs.totalLiabilities });
  };
  snap(0);
  let m = 0;
  let guard = 0;
  while (m < months && guard < 400 * months) {
    advanceDay(s);
    guard++;
    if (isLastDayOfMonth(s.day)) {
      m++;
      monthly?.(s);
      snap(m);
    }
  }
  return { points };
}

export function runScenario(state: GameState, input: ScenarioInput, months = 12): ScenarioResult {
  const base = project(state, months);
  const res = (r: { ok: boolean; error?: string; message?: string }) => (r.ok ? null : (r as { error: string }).error);
  let setup: ((s: GameState) => string | null) | undefined;
  let monthly: ((s: GameState) => void) | undefined;
  switch (input.kind) {
    case 'baseline':
      break;
    case 'quit_job':
      setup = (s) => res(quitJob(s));
      break;
    case 'lifestyle':
      setup = (s) => res(changeLifestyle(s, input.lifestyle));
      break;
    case 'loan':
      setup = (s) => res(takeLoan(s, input.bankId, input.amount, input.termMonths));
      break;
    case 'deposit':
      setup = (s) => res(openDeposit(s, input.amount, input.termMonths));
      break;
    case 'pension':
      setup = (s) => res(setPensionRate(s, input.rate));
      break;
    case 'found_company':
      setup = (s) => res(foundCompany(s, { sector: input.sector, legalForm: input.legalForm, capital: input.capital, name: 'Empresa simulada' }));
      break;
    case 'recession':
      setup = (s) => {
        s.macro.forced = { phase: 'recesion', until: s.day + input.months * 30 };
        return null;
      };
      break;
    case 'rate_shock':
      setup = (s) => {
        s.macro.policyRate = Math.max(0, Math.min(0.2, s.macro.policyRate + input.delta));
        s.bank.card.apr += input.delta;
        return null;
      };
      break;
    case 'market_crash':
      setup = (s) => {
        applyCrash(s, input.drop);
        return null;
      };
      break;
    case 'buy_property':
      setup = (s) => {
        const l = s.realEstate.listings.find((x) => x.id === input.listingId);
        if (!l) return 'El inmueble ya no está publicado.';
        const amount = Math.round(l.askPrice * input.ltv);
        const bank = allMortgageQuotes(s, { kind: 'personal' }, l.askPrice, amount, input.years, input.rateType, l.property.type, marketRent(s, l.property)).find((q) => q.approved);
        if (amount > 0 && !bank) return 'Ningún banco aprobaría esa hipoteca hoy.';
        const r = buyProperty(s, l.id, { owner: { kind: 'personal' }, financing: amount > 0 ? { bankId: bank!.bank.id, amount, years: input.years, rateType: input.rateType } : null });
        if (!r.ok) return r.error;
        const p = s.realEstate.properties[s.realEstate.properties.length - 1];
        if (p && !p.lease && p.type !== 'terreno') setRent(s, p.id, marketRent(s, p));
        return null;
      };
      break;
    case 'sell_portfolio':
      setup = (s) => {
        for (const id of Object.keys(s.stocks.holdings)) placeStockOrder(s, { stockId: id, side: 'venta', type: 'mercado', qty: s.stocks.holdings[id].qty });
        for (const id of Object.keys(s.funds.holdings)) sellFund(s, id, s.funds.holdings[id].qty);
        for (const id of Object.keys(s.bonds.holdings)) sellBond(s, id, s.bonds.holdings[id].qty);
        return null;
      };
      break;
    case 'save_monthly':
      monthly = (s) => {
        const amt = Math.min(input.amount, s.ledger.balances.checking);
        if (amt > 0) transfer(s, 'checking', 'savings', amt);
      };
      break;
  }
  const sc = input.kind === 'baseline' ? base : project(state, months, setup, monthly);
  return {
    baseline: base.points,
    scenario: sc.points,
    error: sc.error,
    note: 'Estimación: simula una copia de tu partida manteniendo tus decisiones actuales, con la economía, los mercados y tus empresas funcionando con las mismas reglas. Excluye imprevistos de salud y eventos económicos nuevos; precios, demanda y postulaciones tienen variación aleatoria, así que otra simulación daría números algo distintos.',
  };
}
