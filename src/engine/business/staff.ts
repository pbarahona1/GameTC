import type { GameState } from '../state';
import type { Company, Employee, Candidate } from './types';
import { sectorOf, px, coLog, coPay, countRole } from './common';
import { roleDef, EMPLOYER_PAYROLL_RATE, allRoles } from '../../content/sectors';
import { Cents, clamp, roundCents } from '../money';
import { ActionResult, FAIL, OK } from '../result';
import { fmtMoney } from '../format';
import { chance, randInt, randRange, nextRandom } from '../rng';
import { dateOf, daysInMonth } from '../time/calendar';
import { practice } from '../skills/skills';

const FIRST = ['Ana', 'Luis', 'María', 'José', 'Carla', 'Diego', 'Sofía', 'Mateo', 'Valeria', 'Andrés', 'Lucía', 'Pablo', 'Elena', 'Jorge', 'Paula', 'Ricardo', 'Camila', 'Tomás', 'Isabel', 'Martín', 'Gabriela', 'Hugo', 'Daniela', 'Óscar'];
const LAST = ['Rivas', 'Méndez', 'Castro', 'Flores', 'Ortega', 'Navarro', 'Quintero', 'Salazar', 'Vega', 'Paredes', 'Ruiz', 'Campos', 'Herrera', 'Molina', 'Aguilar', 'Rosales'];

export const HIRING_FEE_RATE = 0.25;
export const TRAINING_COST = 300;
export const TRAINING_DAYS = 10;

function randomName(state: GameState): string {
  return `${FIRST[Math.floor(nextRandom(state) * FIRST.length)]} ${LAST[Math.floor(nextRandom(state) * LAST.length)]}`;
}

/** Salario de mercado para un rol y nivel de habilidad. */
export function marketWage(state: GameState, co: Company, role: string, skill: number): Cents {
  const r = roleDef(sectorOf(co), role);
  return Math.round((px(state, r.baseWage) * (0.8 + (skill / 100) * 0.5)) / 1000) * 1000;
}

export function generateCandidates(state: GameState, co: Company, role: string): Candidate[] {
  const out: Candidate[] = [];
  const network = state.player.attributes.network;
  for (let i = 0; i < 3; i++) {
    // Mejor red de contactos y reputación atraen mejores candidatos.
    const skill = Math.round(clamp(randRange(state, 20, 75) + network * 0.15 + co.reputation * 0.1, 10, 95));
    const wage = Math.round((marketWage(state, co, role, skill) * randRange(state, 0.95, 1.1)) / 1000) * 1000;
    out.push({ id: state.meta.nextId++, name: randomName(state), role, skill, wage });
  }
  co.candidates = [...co.candidates.filter((c) => c.role !== role), ...out];
  return out;
}

export function hiringFee(_state: GameState, co: Company, wage: Cents): Cents {
  return roundCents(wage * HIRING_FEE_RATE * (countRole(co, 'rrhh') > 0 ? 0.5 : 1));
}

export function hire(state: GameState, co: Company, candidateId: number, silent = false): ActionResult {
  const c = co.candidates.find((x) => x.id === candidateId);
  if (!c) return FAIL('El candidato ya no está disponible.');
  const fee = hiringFee(state, co, c.wage);
  if (co.ledger.balances.cash < fee) return FAIL(`Se necesitan ${fmtMoney(fee)} en caja para el proceso de selección.`);
  coPay(state, co, 'training', fee, { memo: `Reclutamiento de ${c.name}`, tag: 'hiring', allowArrears: false });
  const e: Employee = { id: c.id, name: c.name, role: c.role, wage: c.wage, skill: c.skill, morale: 70, hiredDay: state.day, absentUntil: state.day - 1, trainingUntil: state.day - 1 };
  co.employees.push(e);
  co.candidates = co.candidates.filter((x) => x.id !== candidateId);
  if (!silent) practice(state, 'hire', 'management', 60);
  if (!silent) coLog(state, co, 'info', '🧑‍💼', `contrató a ${c.name} (${roleDef(sectorOf(co), c.role).name}) por ${fmtMoney(c.wage)}/mes.`);
  return OK(`${c.name} contratado. Costo de selección: ${fmtMoney(fee)}.`);
}

/** Indemnización: medio sueldo mínimo; un sueldo por año trabajado. */
export function severance(state: GameState, e: Employee): Cents {
  const years = (state.day - e.hiredDay) / 365;
  return roundCents(e.wage * Math.max(0.5, years));
}

export function fire(state: GameState, co: Company, empId: number, silent = false): ActionResult {
  const e = co.employees.find((x) => x.id === empId);
  if (!e) return FAIL('Empleado inexistente.');
  const sev = severance(state, e);
  // Sueldo devengado del mes + indemnización.
  const g = dateOf(state.day);
  const dim = daysInMonth(g.y, g.m);
  const start = Math.max(e.hiredDay, state.day - g.d + 1);
  const accrued = roundCents((e.wage * (state.day - start + 1)) / dim);
  coPay(state, co, 'wages', accrued + sev, { memo: `Liquidación final de ${e.name}`, tag: 'severance', kind: 'sueldos' });
  co.employees = co.employees.filter((x) => x.id !== empId);
  for (const o of co.employees) o.morale = clamp(o.morale - 4, 0, 100);
  if (!silent) coLog(state, co, 'warning', '📦', `despidió a ${e.name}. Indemnización ${fmtMoney(sev)}.`, accrued + sev);
  return OK(`Despido registrado. Se pagaron ${fmtMoney(accrued + sev)} (días trabajados e indemnización).`);
}

export function train(state: GameState, co: Company, empId: number): ActionResult {
  const e = co.employees.find((x) => x.id === empId);
  if (!e) return FAIL('Empleado inexistente.');
  if (e.trainingUntil > state.day) return FAIL('Ya está en capacitación.');
  if (e.skill >= 95) return FAIL('Ya alcanzó el máximo nivel de habilidad.');
  const cost = px(state, TRAINING_COST);
  if (co.ledger.balances.cash < cost) return FAIL(`Se necesitan ${fmtMoney(cost)} en caja.`);
  coPay(state, co, 'training', cost, { memo: `Capacitación de ${e.name}`, tag: 'training', allowArrears: false });
  e.trainingUntil = state.day + TRAINING_DAYS;
  practice(state, 'train', 'management', 40);
  e.skill = Math.min(95, e.skill + 8);
  e.morale = Math.min(100, e.morale + 5);
  return OK(`${e.name} estará ${TRAINING_DAYS} días en capacitación (no produce) y sube 8 puntos de habilidad.`);
}

export function setWage(state: GameState, co: Company, empId: number, wage: Cents): ActionResult {
  const e = co.employees.find((x) => x.id === empId);
  if (!e) return FAIL('Empleado inexistente.');
  if (wage < px(state, 400)) return FAIL('El salario no puede ser menor al mínimo legal ($400).');
  const change = wage / e.wage - 1;
  e.morale = clamp(e.morale + (change > 0 ? change * 150 : change * 250), 0, 100);
  e.wage = wage;
  return OK(`Nuevo salario de ${e.name}: ${fmtMoney(wage)}.`);
}

export function dailyStaff(state: GameState, co: Company): void {
  for (const e of co.employees) {
    if (e.absentUntil <= state.day && e.trainingUntil <= state.day) {
      const p = 0.015 + Math.max(0, 60 - e.morale) * 0.0006;
      if (chance(state, p)) e.absentUntil = state.day + 1;
    }
  }
}

/** Nómina mensual: sueldos prorrateados por días + cargas sociales del empleador (12 %). */
export function runPayroll(state: GameState, co: Company): boolean {
  const g = dateOf(state.day);
  const dim = daysInMonth(g.y, g.m);
  const monthStart = state.day - g.d + 1;
  let wages = 0;
  for (const e of co.employees) {
    const start = Math.max(e.hiredDay, monthStart);
    const days = state.day - start + 1;
    wages += days >= dim ? e.wage : roundCents((e.wage * days) / dim);
  }
  if (wages <= 0) return true;
  const taxes = roundCents(wages * EMPLOYER_PAYROLL_RATE);
  if (co.ledger.balances.cash >= wages + taxes) {
    coPay(state, co, 'wages', wages, { memo: 'Nómina mensual', tag: 'payroll' });
    coPay(state, co, 'payroll_taxes', taxes, { memo: 'Cargas sociales del empleador (12 %)', tag: 'payroll' });
    return true;
  }
  coPay(state, co, 'wages', wages, { memo: 'Nómina mensual', tag: 'payroll', kind: 'sueldos' });
  coPay(state, co, 'payroll_taxes', taxes, { memo: 'Cargas sociales del empleador (12 %)', tag: 'payroll', kind: 'sueldos' });
  for (const e of co.employees) e.morale = clamp(e.morale - 35, 0, 100);
  coLog(state, co, 'danger', '💸', 'no pudo pagar los sueldos completos. La moral del equipo se desplomó.');
  return false;
}

/** Moral, experiencia y rotación (mensual). */
export function monthlyStaff(state: GameState, co: Company, utilization: number): void {
  const rrhh = countRole(co, 'rrhh');
  const unpaid = co.arrears.some((a) => a.kind === 'sueldos');
  for (const e of [...co.employees]) {
    const mw = marketWage(state, co, e.role, e.skill);
    const target = clamp(62 + (e.wage / mw - 1) * 100 + rrhh * 5 - (utilization > 0.95 ? 10 : 0) - (unpaid ? 40 : 0), 0, 100);
    e.morale = clamp(Math.round(e.morale + (target - e.morale) * 0.3), 0, 100);
    e.skill = Math.min(95, e.skill + 0.5);
    const quitP = e.morale < 40 ? (40 - e.morale) / 100 : 0.01 * (rrhh ? 0.5 : 1);
    if (chance(state, quitP)) {
      co.employees = co.employees.filter((x) => x.id !== e.id);
      coLog(state, co, 'warning', '🚶', `${e.name} (${roleDef(sectorOf(co), e.role).name}) renunció${e.morale < 40 ? ' por baja moral' : ''}.`);
    }
  }
}

export function averageMorale(co: Company): number {
  return co.employees.length ? co.employees.reduce((s, e) => s + e.morale, 0) / co.employees.length : 0;
}

export function rolesFor(co: Company) {
  return allRoles(sectorOf(co));
}

export function randomSkill(state: GameState): number {
  return randInt(state, 35, 70);
}
