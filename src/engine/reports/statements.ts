import { ACCOUNTS, AccountId, ASSET_ACCOUNTS, CASH_ACCOUNTS, EXPENSE_ACCOUNTS, INCOME_ACCOUNTS, LIABILITY_ACCOUNTS } from '../ledger/accounts';
import { entryDelta, JournalEntry, CashFlowClass } from '../ledger/ledger';
import type { Cents } from '../money';
import type { GameState } from '../state';
import { gPeriodTotals, gBucketShare, type Chart } from '../ledger/core';

/** Movimiento neto por cuenta entre dos días (inclusive), incluidos los meses compactados. */
export function periodTotals(state: GameState, from: number, to: number): Record<AccountId, Cents> {
  return gPeriodTotals(ACCOUNTS as unknown as Chart<AccountId>, state.ledger, from, to);
}

export interface Line {
  account: AccountId;
  name: string;
  amount: Cents;
}

export interface IncomeStatement {
  from: number;
  to: number;
  income: Line[];
  grossIncome: Cents;
  living: Line[];
  financial: Line[];
  education: Line[];
  property: Line[];
  legal: Line[];
  other: Line[];
  totalExpensesBeforeTax: Cents;
  /** Parte de los ingresos que es revalorización no realizada (no es dinero cobrado). */
  unrealized: Cents;
  resultBeforeTax: Cents;
  taxes: Line[];
  totalTaxes: Cents;
  netResult: Cents;
  /** Tasa de ahorro contable: resultado neto / ingresos brutos. */
  savingsRate: number;
}

function lines(t: Record<AccountId, Cents>, ids: AccountId[]): Line[] {
  return ids.map((id) => ({ account: id, name: ACCOUNTS[id].name, amount: t[id] })).filter((l) => l.amount !== 0);
}

const sumLines = (ls: Line[]) => ls.reduce((s, l) => s + l.amount, 0);

/**
 * Estado de resultados personal (base devengado):
 *   Ingresos brutos − gastos (vida, financieros, educación) = Resultado antes de impuestos
 *   − impuestos y seguridad social = Resultado neto (lo que realmente aumentó tu patrimonio).
 */
export function incomeStatement(state: GameState, from: number, to: number): IncomeStatement {
  const t = periodTotals(state, from, to);
  const byGroup = (g: string) => EXPENSE_ACCOUNTS.filter((id) => (ACCOUNTS[id] as { group?: string }).group === g);
  const income = lines(t, INCOME_ACCOUNTS);
  const living = lines(t, byGroup('living'));
  const financial = lines(t, byGroup('financial'));
  const education = lines(t, byGroup('education'));
  const property = lines(t, byGroup('property'));
  const legal = lines(t, byGroup('legal'));
  const other = lines(t, byGroup('other'));
  const taxes = lines(t, byGroup('tax'));
  const grossIncome = sumLines(income);
  const totalExpensesBeforeTax = sumLines(living) + sumLines(financial) + sumLines(education) + sumLines(property) + sumLines(legal) + sumLines(other);
  const resultBeforeTax = grossIncome - totalExpensesBeforeTax;
  const totalTaxes = sumLines(taxes);
  const netResult = resultBeforeTax - totalTaxes;
  return {
    from, to, income, grossIncome, living, financial, education, property, legal, other, totalExpensesBeforeTax, resultBeforeTax, taxes, totalTaxes, netResult,
    unrealized: t.unrealized_gains,
    savingsRate: grossIncome > 0 ? netResult / grossIncome : 0,
  };
}

export interface BalanceSheet {
  day: number;
  assets: Line[];
  liabilities: Line[];
  totalAssets: Cents;
  totalLiabilities: Cents;
  netWorth: Cents;
  liquid: Cents;
  /** Comprobación contable: activo = pasivo + patrimonio (inicial + resultados acumulados). */
  equityCheck: { openingEquity: Cents; accumulatedResult: Cents; balanced: boolean };
}

export function balanceSheet(state: GameState): BalanceSheet {
  const b = state.ledger.balances;
  const assets = ASSET_ACCOUNTS.map((id) => ({ account: id, name: ACCOUNTS[id].name, amount: b[id] })).filter((l) => l.amount !== 0);
  const liabilities = LIABILITY_ACCOUNTS.map((id) => ({ account: id, name: ACCOUNTS[id].name, amount: b[id] })).filter((l) => l.amount !== 0);
  const totalAssets = sumLines(assets);
  const totalLiabilities = sumLines(liabilities);
  const accumulatedResult = INCOME_ACCOUNTS.reduce((s, id) => s + b[id], 0) - EXPENSE_ACCOUNTS.reduce((s, id) => s + b[id], 0);
  const openingEquity = b.opening_equity;
  return {
    day: state.day, assets, liabilities, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities,
    liquid: CASH_ACCOUNTS.reduce((s, id) => s + b[id], 0),
    equityCheck: { openingEquity, accumulatedResult, balanced: totalAssets === totalLiabilities + openingEquity + accumulatedResult },
  };
}

export interface CashFlowGroup {
  label: string;
  amount: Cents;
}

export interface CashFlowStatement {
  from: number;
  to: number;
  opening: Cents;
  closing: Cents;
  operating: CashFlowGroup[];
  investing: CashFlowGroup[];
  financing: CashFlowGroup[];
  totalOperating: Cents;
  totalInvesting: Cents;
  totalFinancing: Cents;
  netChange: Cents;
  /** Flujo de caja libre personal = operativo − inversiones en activos productivos (sin activos fijos en Fase 1). */
  freeCashFlow: Cents;
  cashIn: Cents;
  cashOut: Cents;
}

const TAG_LABELS: Array<[string, string]> = [
  ['payroll', 'Salario neto cobrado'],
  ['recurring:rent', 'Alquiler'],
  ['recurring', 'Gastos de vida'],
  ['insurance', 'Seguro médico'],
  ['medical', 'Atención médica'],
  ['moving', 'Mudanzas'],
  ['education', 'Educación'],
  ['interest', 'Intereses cobrados'],
  ['fee', 'Comisiones bancarias'],
  ['arrears', 'Pago de atrasos'],
  ['tax:payment', 'Pago de impuestos'],
  ['tax:refund', 'Devolución de impuestos'],
  ['deposit:open', 'Depósitos a plazo constituidos'],
  ['deposit:close', 'Depósitos a plazo recuperados'],
  ['loan:disburse', 'Préstamos recibidos'],
  ['loan:payment', 'Cuotas de préstamos'],
  ['loan:prepay', 'Amortización anticipada'],
  ['loan:garnish', 'Embargos salariales'],
  ['card:payment', 'Pagos de tarjeta'],
  ['invest:stocks:buy', 'Compra de acciones'],
  ['invest:stocks:sell', 'Venta de acciones'],
  ['invest:bonds:buy', 'Compra de bonos'],
  ['invest:bonds:sell', 'Venta y vencimiento de bonos'],
  ['invest:funds:buy', 'Suscripción de fondos'],
  ['invest:funds:sell', 'Rescate de fondos'],
  ['invest:mogul:buy', 'Compra en Mogul Exchange'],
  ['invest:mogul:sell', 'Venta en Mogul Exchange'],
  ['invest:dividend', 'Dividendos cobrados'],
  ['invest:coupon', 'Cupones cobrados'],
  ['invest:fund_dist', 'Repartos de fondos'],
  ['invest:mogul_dist', 'Distribuciones de Mogul'],
  ['property:rent', 'Alquileres cobrados'],
  ['property:buy', 'Compra de inmuebles'],
  ['property:sell', 'Venta de inmuebles'],
  ['property:capex', 'Obras en inmuebles'],
  ['property:tax', 'Impuesto inmobiliario'],
  ['property', 'Gastos de inmuebles'],
  ['mortgage:payment', 'Cuotas de hipoteca'],
  ['mortgage:prepay', 'Amortización de hipoteca'],
  ['mortgage:foreclosure', 'Ejecución hipotecaria'],
  ['pros', 'Honorarios profesionales'],
  ['legal', 'Multas y costos legales'],
  ['illicit', 'Pagos no documentados'],
  ['business:capital', 'Aportes a empresas'],
  ['business:dividend', 'Dividendos de empresas'],
  ['business:sale', 'Venta de empresas'],
  ['business:purchase', 'Compra de empresas'],
];

export function labelFor(e: JournalEntry): string {
  const tag = e.tag ?? '';
  for (const [prefix, label] of TAG_LABELS) if (tag === prefix || tag.startsWith(prefix)) return label;
  return e.memo;
}

export function cashDelta(e: JournalEntry): Cents {
  let d = 0;
  for (const acc of CASH_ACCOUNTS) d += entryDelta(e, acc);
  return d;
}

/** Estado de flujo de efectivo (método directo). Solo cuenta movimientos de efectivo real. */
export function cashFlowStatement(state: GameState, from: number, to: number): CashFlowStatement {
  const groups: Record<Exclude<CashFlowClass, 'internal'>, Map<string, Cents>> = { operating: new Map(), investing: new Map(), financing: new Map() };
  let opening = 0;
  let closing = 0;
  let cashIn = 0;
  let cashOut = 0;
  for (const b of state.ledger.archive?.buckets ?? []) {
    const sh = gBucketShare(b, from, to);
    const net = Object.values(b.cash).reduce((s, g) => s + Object.values(g ?? {}).reduce((x, v) => x + v, 0), 0);
    opening += Math.round(net * sh.before);
    closing += Math.round(net * (sh.before + sh.inside));
    if (sh.inside <= 0) continue;
    for (const cf of ['operating', 'investing', 'financing'] as const) {
      for (const [label, v] of Object.entries(b.cash[cf] ?? {})) groups[cf].set(label, (groups[cf].get(label) ?? 0) + Math.round(v * sh.inside));
    }
    cashIn += Math.round(b.cashIn * sh.inside);
    cashOut += Math.round(b.cashOut * sh.inside);
  }
  for (const e of state.ledger.entries) {
    if (e.day > to) break;
    const d = cashDelta(e);
    if (e.day < from) {
      opening += d;
      closing += d;
      continue;
    }
    closing += d;
    if (d === 0 || e.cf === 'internal') continue;
    const g = groups[e.cf];
    const label = labelFor(e);
    g.set(label, (g.get(label) ?? 0) + d);
    if (d > 0) cashIn += d;
    else cashOut -= d;
  }
  const toArr = (m: Map<string, Cents>) => [...m.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  const operating = toArr(groups.operating);
  const investing = toArr(groups.investing);
  const financing = toArr(groups.financing);
  const tot = (a: CashFlowGroup[]) => a.reduce((s, x) => s + x.amount, 0);
  const totalOperating = tot(operating);
  return {
    from, to, opening, closing, operating, investing, financing, totalOperating,
    totalInvesting: tot(investing), totalFinancing: tot(financing), netChange: closing - opening,
    freeCashFlow: totalOperating, cashIn, cashOut,
  };
}

export function transactions(state: GameState, opts: { from?: number; to?: number; account?: AccountId; search?: string; limit?: number } = {}): JournalEntry[] {
  const out: JournalEntry[] = [];
  const q = opts.search?.toLowerCase();
  for (let i = state.ledger.entries.length - 1; i >= 0; i--) {
    const e = state.ledger.entries[i];
    if (opts.to !== undefined && e.day > opts.to) continue;
    if (opts.from !== undefined && e.day < opts.from) break;
    if (opts.account && !e.lines.some((l) => l.account === opts.account)) continue;
    if (q && !e.memo.toLowerCase().includes(q)) continue;
    out.push(e);
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}

export function ledgerCsv(entries: JournalEntry[]): string {
  const rows = ['asiento,dia,concepto,cuenta,debe,haber,clase_flujo'];
  for (const e of entries) {
    for (const l of e.lines) {
      rows.push([e.id, e.day, JSON.stringify(e.memo), JSON.stringify(ACCOUNTS[l.account].name), (l.debit / 100).toFixed(2), (l.credit / 100).toFixed(2), e.cf].join(','));
    }
  }
  return rows.join('\n');
}
