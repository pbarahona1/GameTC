import { post } from '../ledger/ledger';
import { Cents, roundCents, usd } from '../money';
import type { GameState } from '../state';
import { dateOf } from '../time/calendar';
import { addLog } from '../log';
import { ActionResult, FAIL, OK } from '../result';
import { fmtMoney, fmtPct } from '../format';
import { recordInquiry, recordLate, recordOnTime, refreshCreditScore } from './credit';
import { canPayFromChecking } from './payments';
import { practice } from '../skills/skills';
import { monthlyGrossIncome } from '../career/career';

/**
 * Tarjeta de crédito con ciclo real:
 * - Corte el día 25: se emite el resumen (saldo del resumen y pago mínimo).
 * - Vencimiento 20 días después del corte.
 * - Si el resumen anterior se pagó COMPLETO, no se cobran intereses (período de gracia).
 * - Si no, se cobra interés sobre el saldo promedio diario del ciclo.
 * - No pagar el mínimo: recargo por mora + reporte negativo al puntaje.
 */
export const STATEMENT_DAY = 25;
export const GRACE_DAYS = 20;
export const LATE_FEE = usd(29);
export const MIN_PAYMENT_FLOOR = usd(25);
export const MIN_PAYMENT_RATE = 0.02;

export function cardBalance(state: GameState): Cents {
  return state.ledger.balances.credit_card;
}

export function cardAvailable(state: GameState): Cents {
  const c = state.bank.card;
  return c.active ? Math.max(0, c.limit - cardBalance(state)) : 0;
}

export function accrueCardDaily(state: GameState): void {
  state.bank.card.cycleBalanceDays += cardBalance(state);
}

/** Pendiente del resumen actual (lo que falta para pagarlo completo). */
export function statementRemaining(state: GameState): Cents {
  const c = state.bank.card;
  return Math.max(0, Math.min(c.statementBalance - c.paidSinceStatement, cardBalance(state)));
}

export function minRemaining(state: GameState): Cents {
  const c = state.bank.card;
  return Math.max(0, Math.min(c.minPayment - c.paidSinceStatement, cardBalance(state)));
}

export function payCard(state: GameState, amount: Cents, silent = false): ActionResult {
  const bal = cardBalance(state);
  if (bal <= 0) return FAIL('La tarjeta no tiene saldo.');
  const pay = Math.min(amount, bal);
  if (pay <= 0) return FAIL('Ingresá un monto mayor a cero.');
  if (!canPayFromChecking(state, pay)) return FAIL('Fondos insuficientes en la cuenta corriente.');
  post(state.ledger, {
    day: state.day,
    memo: 'Pago de tarjeta de crédito',
    cf: 'financing',
    tag: 'card:payment',
    lines: [
      { account: 'credit_card', debit: pay },
      { account: 'checking', credit: pay },
    ],
  });
  state.bank.card.paidSinceStatement += pay;
  if (!silent) addLog(state, 'info', '💳', 'Pago de tarjeta registrado.', pay);
  if (state.bank.card.dueDay >= 0 && statementRemaining(state) === 0) practice(state, 'card_full', 'finEdu', 60);
  refreshCreditScore(state);
  return OK('Pago realizado.');
}

function cutStatement(state: GameState): void {
  const c = state.bank.card;
  if (c.revolving && c.cycleBalanceDays > 0) {
    const interest = roundCents((c.cycleBalanceDays * c.apr) / 365);
    if (interest > 0) {
      post(state.ledger, {
        day: state.day,
        memo: `Intereses de tarjeta (${fmtPct(c.apr, 1)} anual)`,
        cf: 'operating',
        tag: 'interest:card',
        lines: [
          { account: 'interest_expense', debit: interest },
          { account: 'credit_card', credit: interest },
        ],
      });
      addLog(state, 'expense', '💳', 'La tarjeta cobró intereses porque el resumen anterior no se pagó completo.', interest);
    }
  }
  const bal = cardBalance(state);
  c.statementBalance = bal;
  c.minPayment = bal <= 0 ? 0 : Math.min(bal, Math.max(MIN_PAYMENT_FLOOR, roundCents(bal * MIN_PAYMENT_RATE)));
  c.paidSinceStatement = 0;
  c.dueDay = bal > 0 ? state.day + GRACE_DAYS : -1;
  c.cycleBalanceDays = 0;
  c.cycleStartDay = state.day;
  if (bal > 0) addLog(state, 'info', '🧾', `Resumen de tarjeta: saldo ${fmtMoney(bal)}, pago mínimo ${fmtMoney(c.minPayment)}. Vence en ${GRACE_DAYS} días.`);
}

function processDue(state: GameState): void {
  const c = state.bank.card;
  // Débito automático.
  if (c.autopay !== 'none') {
    const target = c.autopay === 'full' ? statementRemaining(state) : minRemaining(state);
    if (target > 0) {
      const available = Math.min(target, Math.max(0, state.ledger.balances.checking + (state.bank.overdraftSweep ? state.ledger.balances.savings : 0)));
      if (available > 0) payCard(state, available, true);
    }
  }
  const paidFull = statementRemaining(state) === 0;
  const paidMin = minRemaining(state) === 0;
  if (paidFull) {
    c.revolving = false;
    c.fullPayStreak++;
    recordOnTime(state);
  } else if (paidMin) {
    c.revolving = true;
    c.fullPayStreak = 0;
    recordOnTime(state);
    addLog(state, 'warning', '💳', 'Pagaste solo parte del resumen: el saldo restante generará intereses.');
  } else {
    c.revolving = true;
    c.fullPayStreak = 0;
    post(state.ledger, {
      day: state.day,
      memo: 'Recargo por pago tardío de tarjeta',
      cf: 'operating',
      tag: 'fee:card_late',
      lines: [
        { account: 'late_fees', debit: LATE_FEE },
        { account: 'credit_card', credit: LATE_FEE },
      ],
    });
    recordLate(state);
    state.player.attributes.stress = Math.min(100, state.player.attributes.stress + 5);
    addLog(state, 'danger', '⛔', `No pagaste el mínimo de la tarjeta. Recargo de ${fmtMoney(LATE_FEE)} y reporte negativo en tu puntaje crediticio.`, LATE_FEE);
  }
  c.dueDay = -1;
}

/** Vencimiento del resumen (al inicio del día, antes de nuevos cargos). */
export function processCardDue(state: GameState): void {
  const c = state.bank.card;
  if (c.active && c.dueDay === state.day) processDue(state);
}

/** Cierre del día: acumula saldo para intereses y, si corresponde, emite el resumen. */
export function processCardEndOfDay(state: GameState): void {
  const c = state.bank.card;
  if (!c.active) return;
  accrueCardDaily(state);
  if (dateOf(state.day).d === STATEMENT_DAY) cutStatement(state);
}

export function setAutopay(state: GameState, mode: 'none' | 'min' | 'full'): ActionResult {
  state.bank.card.autopay = mode;
  return OK(mode === 'none' ? 'Débito automático desactivado.' : `Débito automático: ${mode === 'full' ? 'pago total del resumen' : 'pago mínimo'}.`);
}

/** Solicitud de aumento de límite: consulta de crédito (afecta el puntaje) y evaluación. */
export function requestLimitIncrease(state: GameState): ActionResult {
  const c = state.bank.card;
  const income = monthlyGrossIncome(state);
  recordInquiry(state);
  if (state.credit.score < 680) return FAIL(`Rechazado: el banco exige un puntaje de al menos 680 (tenés ${state.credit.score}). La consulta quedó registrada.`);
  if (income <= 0) return FAIL('Rechazado: se requiere un ingreso estable demostrable.');
  const target = Math.min(roundCents(income * 1.5), usd(50000));
  if (target <= c.limit) return FAIL('Rechazado: tu límite ya es acorde a tus ingresos.');
  const newLimit = Math.min(target, c.limit * 2);
  c.limit = newLimit;
  addLog(state, 'success', '💳', `Aprobado: tu nuevo límite es ${fmtMoney(newLimit)}.`);
  refreshCreditScore(state);
  return OK(`Nuevo límite: ${fmtMoney(newLimit)}.`);
}
