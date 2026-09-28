import type { GameState } from '../state';
import type { Cents } from '../money';
import type { JurisdictionId } from '../../content/jurisdictions';
import { jurisdictionById } from '../../content/jurisdictions';
import { dayOf } from '../time/calendar';
import { clamp } from '../money';
import type { Company } from '../business/types';

/**
 * Registra una evasión fiscal personal (declaración con ingresos ocultos).
 * La prueba depende de cuánto se ocultó y de si los ingresos dejan rastro
 * (alquileres, ventas de títulos y cupones siempre dejan rastro bancario).
 */
export function recordEvasion(state: GameState, year: number, taxAvoided: Cents, hidden: Cents, jurisdiction: JurisdictionId): void {
  if (taxAvoided <= 0 || !state.legal) return;
  const j = jurisdictionById(jurisdiction);
  const evidence = clamp(35 + Math.log10(Math.max(1, hidden / 100)) * 8, 20, 90);
  const severity = taxAvoided > 5_000_000 ? 4 : taxAvoided > 1_000_000 ? 3 : taxAvoided > 200_000 ? 2 : 1;
  state.legal.acts.push({
    id: state.meta.nextId++, kind: 'evasion', day: state.day, label: `Declaración ${year} con ingresos ocultos`, benefit: taxAvoided, amount: hidden,
    evidence, severity, witnesses: 0, jurisdiction, statuteDay: dayOf(year + 6, 1, 1), status: 'oculto', taxYear: year,
  });
  state.legal.heat = clamp(state.legal.heat + 4 + severity * 2 * j.enforcement, 0, 100);
}

/** Evasión empresarial: beneficio no declarado en la declaración de sociedades. */
export function recordCompanyEvasion(state: GameState, co: Company, year: number, taxAvoided: Cents, hidden: Cents): void {
  if (taxAvoided <= 0 || !state.legal) return;
  const severity = taxAvoided > 5_000_000 ? 4 : taxAvoided > 1_000_000 ? 3 : taxAvoided > 200_000 ? 2 : 1;
  const witnesses = Math.min(5, co.employees.filter((e) => e.role === 'contador' || e.role === 'gerente').length + 1);
  state.legal.acts.push({
    id: state.meta.nextId++, kind: 'evasion_empresa', day: state.day, label: `${co.name}: beneficio ${year} no declarado`, benefit: taxAvoided, amount: hidden,
    evidence: clamp(40 + Math.log10(Math.max(1, hidden / 100)) * 6, 25, 90), severity, witnesses, jurisdiction: co.jurisdiction, companyId: co.id,
    statuteDay: dayOf(year + 6, 1, 1), status: 'oculto', taxYear: year,
  });
  state.legal.heat = clamp(state.legal.heat + 3 + severity * 2 * jurisdictionById(co.jurisdiction).enforcement, 0, 100);
}

/** Fraude al banco: préstamo obtenido con estados contables inflados. */
export function recordLoanFraud(state: GameState, co: Company, amount: Cents): void {
  if (!state.legal) return;
  const severity = amount > 10_000_000 ? 4 : amount > 2_000_000 ? 3 : 2;
  state.legal.acts.push({
    id: state.meta.nextId++, kind: 'fraude', day: state.day, label: `${co.name}: préstamo con estados inflados`, benefit: Math.round(amount * 0.1), amount,
    evidence: 55, severity, witnesses: Math.min(4, co.employees.filter((e) => e.role === 'contador' || e.role === 'gerente').length + 1),
    jurisdiction: co.jurisdiction, companyId: co.id, statuteDay: state.day + 365 * 8, status: 'oculto',
  });
  state.legal.heat = clamp(state.legal.heat + 8, 0, 100);
}
