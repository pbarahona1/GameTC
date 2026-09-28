import type { GameState } from '../state';
import type { Company } from '../business/types';
import { gCompact, type Chart } from './core';
import { ACCOUNTS, type AccountId } from './accounts';
import { CO_CHART } from '../business/companyLedger';
import { cashDelta, labelFor } from '../reports/statements';
import { cfLabel } from '../business/reports';
import { gEntryDelta } from './core';
import { dateOf, dayOf, addMonths, startOfMonth } from '../time/calendar';

/**
 * Compactación del libro mayor (Fase 5: rendimiento, memoria y tamaño del guardado).
 *
 * Los asientos antiguos se resumen en baldes mensuales que conservan EXACTAMENTE
 * los saldos, el movimiento de cada cuenta por mes y el flujo de efectivo por
 * clase y concepto. Los informes de cualquier período siguen funcionando: los
 * meses completos son exactos y un mes cortado por la consulta se prorratea.
 *
 * Retención de asientos detallados:
 *  - Libro personal: año en curso + año anterior completo (declaraciones y comparativos).
 *  - Empresas del jugador: últimos 13 meses completos (valoración a 12 meses).
 *  - Empresas simuladas de terceros (Mogul, empresas en venta): últimos 2 meses.
 */
export const PERSONAL_KEEP_YEARS = 1;
export const COMPANY_KEEP_MONTHS = 13;
export const NPC_KEEP_MONTHS = 2;

const monthKey = (day: number) => {
  const g = dateOf(day);
  return g.y * 12 + (g.m - 1);
};

const PERSONAL = ACCOUNTS as unknown as Chart<AccountId>;

export function compactPersonal(state: GameState): number {
  const y = dateOf(state.day).y;
  const before = dayOf(y - PERSONAL_KEEP_YEARS, 1, 1);
  return gCompact(PERSONAL, state.ledger, before, monthKey, (e) => ({ delta: cashDelta(e), label: labelFor(e) }));
}

export function compactCompany(state: GameState, co: Company, keepMonths: number): number {
  const before = addMonths(startOfMonth(state.day), -keepMonths);
  return gCompact(CO_CHART, co.ledger, before, monthKey, (e) => ({ delta: gEntryDelta(CO_CHART, e, 'cash'), label: cfLabel(e.tag, e.memo) }));
}

/** Se llama a fin de mes (y el 1 de enero para el libro personal). */
export function compactLedgers(state: GameState): number {
  let n = 0;
  if (dateOf(state.day + 1).m === 1 && dateOf(state.day + 1).d === 1) n += compactPersonal(state);
  for (const co of state.companies) n += compactCompany(state, co, COMPANY_KEEP_MONTHS);
  for (const a of state.mogul?.assets ?? []) if (a.company) n += compactCompany(state, a.company, NPC_KEEP_MONTHS);
  for (const l of state.listings ?? []) n += compactCompany(state, l.company, NPC_KEEP_MONTHS);
  return n;
}
