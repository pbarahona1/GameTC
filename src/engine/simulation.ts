import type { GameState, LogItem } from './state';
import { dateOf, isLastDayOfMonth, startOfMonth } from './time/calendar';
import { accrueDaily, monthEndBanking, processDeposits } from './finance/banking';
import { processCardDue, processCardEndOfDay } from './finance/creditCard';
import { processLoans } from './finance/loans';
import { processRecurring } from './finance/budget';
import { refreshCreditScore } from './finance/credit';
import { monthEndCareer, processApplications, processReview } from './career/career';
import { processEducation } from './skills/education';
import { fileAnnualReturn, processTaxes } from './tax/taxEngine';
import { monthlyAttributes, monthlyRandomEvents, yearStartMacro } from './world';
import { incomeStatement, cashFlowStatement, balanceSheet } from './reports/statements';
import { updateProgression } from './progression/progression';
import { companiesDay, companiesMonthEnd, companiesYearStart, refreshListings } from './business/simulate';
import { monthlyMacro } from './economy/economy';
import { investmentsDay } from './invest';
import { realEstateDay } from './realestate/realestate';
import { legalDay, legalMonth } from './legal/legal';
import { embezzlementMonth, prosMonthEnd } from './pros/pros';

/**
 * Orquestador diario. El ORDEN importa y está documentado en
 * docs/REGLAS_ECONOMICAS.md:
 *  1. Inicio de año (impuestos de empresas, declaración personal, indexación).
 *  2. Día 1 de cada mes: economía (ciclo, inflación, tasas trimestrales, eventos).
 *  3. Vencimientos (tarjeta) y respuestas (postulaciones).
 *  4. Formación, gastos recurrentes, cuotas, depósitos, impuestos, evaluaciones.
 *  5. Eventos del día 15.
 *  6. Empresas, mercados financieros, inmuebles e hipotecas, sistema legal.
 *  7. Cierre del día (acumulaciones de saldo, corte de tarjeta).
 *  8. Cierre de mes (empresas y grupos, profesionales, legal, nómina, intereses,
 *     atributos, puntaje, foto mensual).
 */
import { compactLedgers } from './ledger/compaction';
import { worldDay, worldMonth } from './world/rivals';
import { possessionsMonth } from './lifestyle/shops';

export function advanceDay(state: GameState): void {
  state.day++;
  const g = dateOf(state.day);
  if (g.m === 1 && g.d === 1) {
    companiesYearStart(state); // antes de la declaración personal (empresas transparentes)
    fileAnnualReturn(state);
    yearStartMacro(state);
  }
  if (g.d === 1) {
    monthlyMacro(state);
    worldMonth(state);
  }
  processCardDue(state);
  processApplications(state);
  processEducation(state);
  processRecurring(state);
  processLoans(state);
  processDeposits(state);
  processTaxes(state);
  processReview(state);
  if (g.d === 15) monthlyRandomEvents(state);

  companiesDay(state);
  if (!state.meta.projection && state.day % 60 === 0) refreshListings(state);
  investmentsDay(state);
  realEstateDay(state);
  legalDay(state);
  worldDay(state);

  accrueDaily(state);
  processCardEndOfDay(state);

  if (isLastDayOfMonth(state.day)) {
    embezzlementMonth(state);
    companiesMonthEnd(state);
    prosMonthEnd(state);
    legalMonth(state);
    monthEndCareer(state);
    monthEndBanking(state);
    possessionsMonth(state);
    monthlyAttributes(state);
    refreshCreditScore(state);
    takeSnapshot(state);
    updateProgression(state);
    compactLedgers(state);
  }
}

export function takeSnapshot(state: GameState): void {
  const from = startOfMonth(state.day);
  const is = incomeStatement(state, from, state.day);
  const cf = cashFlowStatement(state, from, state.day);
  const bs = balanceSheet(state);
  state.history.push({
    day: state.day,
    netWorth: bs.netWorth,
    liquid: bs.liquid,
    assets: bs.totalAssets,
    liabilities: bs.totalLiabilities,
    income: is.grossIncome,
    expenses: is.totalExpensesBeforeTax + is.totalTaxes,
    cashIn: cf.cashIn,
    cashOut: cf.cashOut,
    creditScore: state.credit.score,
    stage: state.progression.stage,
  });
}

export interface SimReport {
  fromDay: number;
  toDay: number;
  netWorthBefore: number;
  netWorthAfter: number;
  liquidBefore: number;
  liquidAfter: number;
  logs: LogItem[];
}

export function simulateDays(state: GameState, days: number): SimReport {
  const before = balanceSheet(state);
  const fromDay = state.day;
  const lastLogId = state.log.length ? state.log[state.log.length - 1].id : 0;
  for (let i = 0; i < days; i++) advanceDay(state);
  const after = balanceSheet(state);
  return {
    fromDay,
    toDay: state.day,
    netWorthBefore: before.netWorth,
    netWorthAfter: after.netWorth,
    liquidBefore: before.liquid,
    liquidAfter: after.liquid,
    logs: state.log.filter((l) => l.id > lastLogId),
  };
}
