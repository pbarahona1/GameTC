import { LIFESTYLE_BY_ID, LifestyleId, PRIVATE_HEALTH_INSURANCE } from '../../content/lifestyle';
import { JOB_BY_ID } from '../../content/jobs';
import { post } from '../ledger/ledger';
import { Cents, usd, applyRate } from '../money';
import type { GameState, PaymentMethod, RecurringItem } from '../state';
import { dateOf } from '../time/calendar';
import { addLog } from '../log';
import { payExpense, canPayFromChecking } from './payments';
import { ActionResult, FAIL, OK } from '../result';
import { fmtMoney } from '../format';
import { jurisdictionById } from '../../content/jurisdictions';

export function buildLifestyleItems(id: LifestyleId, priceIndex: number): RecurringItem[] {
  return LIFESTYLE_BY_ID[id].items.map((it) => ({
    key: it.key,
    name: it.name,
    account: it.account,
    amount: usd(it.amount * priceIndex),
    day: it.day,
    essential: it.essential,
    method: 'checking' as PaymentMethod,
  }));
}

export function hasEmployerInsurance(state: GameState): boolean {
  const job = state.career.job;
  return !!job && JOB_BY_ID[job.jobId].healthInsurance;
}

export function insuranceCost(state: GameState): Cents {
  return usd(PRIVATE_HEALTH_INSURANCE * livingIndex(state));
}

/** Total mensual de gastos recurrentes (presupuesto). */
export function monthlyRecurring(state: GameState, essentialOnly = false): Cents {
  let t = 0;
  for (const it of state.budget.items) if (!essentialOnly || it.essential) t += it.amount;
  if (state.budget.privateInsurance) t += insuranceCost(state);
  return t;
}

/** Procesa los gastos recurrentes que vencen hoy. */
export function processRecurring(state: GameState): void {
  const g = dateOf(state.day);
  for (const it of state.budget.items) {
    if (it.day !== g.d) continue;
    const res = payExpense(state, it.account, it.amount, { memo: it.name, tag: `recurring:${it.key}`, method: it.method });
    if (!res.ok && it.key === 'rent') {
      state.player.attributes.stress = Math.min(100, state.player.attributes.stress + 8);
      state.player.attributes.reputation = Math.max(0, state.player.attributes.reputation - 1);
    }
  }
  if (state.budget.privateInsurance && g.d === 20) {
    payExpense(state, 'health', insuranceCost(state), { memo: 'Seguro médico privado', tag: 'insurance', method: 'checking' });
  }
  // Desalojo: si los atrasos superan dos alquileres, se fuerza el estilo austero.
  const rent = state.budget.items.find((i) => i.key === 'rent');
  if (g.d === 2 && rent && state.ledger.balances.arrears > rent.amount * 2 && state.budget.lifestyle !== 'austero') {
    applyLifestyle(state, 'austero');
    addLog(state, 'danger', '🏚️', 'Desalojo: por acumular atrasos mayores a dos alquileres tuviste que mudarte a una habitación compartida.');
    state.player.attributes.stress = Math.min(100, state.player.attributes.stress + 15);
    state.player.attributes.reputation = Math.max(0, state.player.attributes.reputation - 5);
  }
}

/** Índice de precios de vida: inflación acumulada × costo de vida de la residencia fiscal. */
export function livingIndex(state: GameState): number {
  return state.macro.priceIndex * jurisdictionById(state.tax.jurisdiction).costOfLiving;
}

/** ¿El jugador vive en una vivienda propia? (no paga alquiler). */
export function livesInOwnHome(state: GameState): boolean {
  return (state.realEstate?.properties ?? []).some((p) => p.usedBy === 'jugador');
}

function applyLifestyle(state: GameState, id: LifestyleId): void {
  const methods = new Map(state.budget.items.map((i) => [i.key, i.method]));
  state.budget.lifestyle = id;
  state.budget.items = buildLifestyleItems(id, livingIndex(state)).map((i) => ({ ...i, method: methods.get(i.key) ?? i.method }));
  applyHomeRent(state);
}

/** Si vive en una vivienda propia, el alquiler del presupuesto queda en cero. */
export function applyHomeRent(state: GameState): void {
  const rent = state.budget.items.find((i) => i.key === 'rent');
  if (!rent) return;
  if (livesInOwnHome(state)) rent.amount = 0;
  else if (rent.amount === 0) {
    const def = LIFESTYLE_BY_ID[state.budget.lifestyle].items.find((i) => i.key === 'rent')!;
    rent.amount = usd(def.amount * livingIndex(state));
  }
}

/** Reescala los gastos de vida al cambiar de residencia (costo de vida distinto). */
export function rebuildLivingCosts(state: GameState, previousCol: number): void {
  const ratio = jurisdictionById(state.tax.jurisdiction).costOfLiving / previousCol;
  for (const it of state.budget.items) it.amount = Math.round(it.amount * ratio);
  applyHomeRent(state);
}

/** Costo de mudanza: medio mes del nuevo alquiler (depósito no recuperable simplificado). */
export function movingCost(state: GameState, id: LifestyleId): Cents {
  const rent = LIFESTYLE_BY_ID[id].items.find((i) => i.key === 'rent')!.amount;
  return applyRate(usd(rent * livingIndex(state)), 0.5);
}

export function changeLifestyle(state: GameState, id: LifestyleId): ActionResult {
  if (id === state.budget.lifestyle) return FAIL('Ya tenés ese estilo de vida.');
  const cost = movingCost(state, id);
  if (!canPayFromChecking(state, cost)) return FAIL(`La mudanza cuesta ${fmtMoney(cost)} y no tenés fondos suficientes en la cuenta corriente.`);
  post(state.ledger, {
    day: state.day,
    memo: `Mudanza a estilo ${LIFESTYLE_BY_ID[id].name}`,
    cf: 'operating',
    tag: 'moving',
    lines: [
      { account: 'housing', debit: cost },
      { account: 'checking', credit: cost },
    ],
  });
  applyLifestyle(state, id);
  addLog(state, 'info', '🏠', `Te mudaste: estilo de vida ${LIFESTYLE_BY_ID[id].name}. Los nuevos importes rigen desde el próximo cobro.`, cost);
  return OK('Estilo de vida actualizado.');
}

export function setPaymentMethod(state: GameState, key: string, method: PaymentMethod): ActionResult {
  const it = state.budget.items.find((i) => i.key === key);
  if (!it) return FAIL('Gasto inexistente.');
  if (key === 'rent' && method === 'card') return FAIL('El alquiler no se puede pagar con tarjeta de crédito.');
  it.method = method;
  return OK();
}

export function setPrivateInsurance(state: GameState, on: boolean): ActionResult {
  if (on && hasEmployerInsurance(state)) return FAIL('Tu empleo ya incluye seguro médico.');
  state.budget.privateInsurance = on;
  return OK(on ? 'Seguro médico contratado.' : 'Seguro médico cancelado.');
}

export function payArrears(state: GameState, amount: Cents): ActionResult {
  const owed = state.ledger.balances.arrears;
  if (owed <= 0) return FAIL('No tenés pagos vencidos.');
  const pay = Math.min(amount, owed);
  if (pay <= 0) return FAIL('Monto inválido.');
  if (state.ledger.balances.checking < pay) return FAIL('Fondos insuficientes en la cuenta corriente.');
  post(state.ledger, {
    day: state.day,
    memo: 'Pago de atrasos',
    cf: 'operating',
    tag: 'arrears',
    lines: [
      { account: 'arrears', debit: pay },
      { account: 'checking', credit: pay },
    ],
  });
  addLog(state, 'success', '✅', 'Pagaste atrasos pendientes.', pay);
  return OK('Atrasos pagados.');
}

/** Indexa los gastos por inflación (se llama cada 1 de enero). */
export function indexBudget(state: GameState, inflation: number): void {
  for (const it of state.budget.items) it.amount = Math.round(it.amount * (1 + inflation));
}
