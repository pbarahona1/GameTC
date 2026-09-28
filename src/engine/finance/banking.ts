import type { AccountId } from '../ledger/accounts';
import { post, tryPost } from '../ledger/ledger';
import { Cents, clamp, roundCents, usd } from '../money';
import type { GameState, TermDeposit } from '../state';
import { nextId } from '../state';
import { addMonths, dateOf, daysInMonth } from '../time/calendar';
import { addLog } from '../log';
import { ActionResult, FAIL, OK } from '../result';
import { fmtMoney, fmtPct } from '../format';
import { practice } from '../skills/skills';

export const CHECKING_FEE = usd(4);
export const CHECKING_FEE_WAIVER_AVG = usd(1000);
export const MIN_DEPOSIT = usd(500);
export const DEPOSIT_TERMS = [3, 6, 12, 24] as const;
export const EARLY_BREAK_FEE_RATE = 0.005;

/** Tasa anual de la cuenta de ahorro: política monetaria − 2 pp (mínimo 0,25 %). */
export function savingsRate(state: GameState): number {
  return Math.max(0.0025, state.macro.policyRate - 0.02);
}

/** Tasa anual de un depósito a plazo según su duración. */
export function depositRate(state: GameState, termMonths: number): number {
  const premium: Record<number, number> = { 3: 0, 6: 0.004, 12: 0.008, 24: 0.012 };
  return Math.max(0.005, state.macro.policyRate - 0.01 + (premium[termMonths] ?? 0));
}

export function depositInterest(d: Pick<TermDeposit, 'principal' | 'rate' | 'startDay' | 'maturityDay'>): Cents {
  return roundCents((d.principal * d.rate * (d.maturityDay - d.startDay)) / 365);
}

const TRANSFERABLE: AccountId[] = ['cash_wallet', 'checking', 'savings'];

export function transfer(state: GameState, from: AccountId, to: AccountId, amount: Cents): ActionResult {
  if (!TRANSFERABLE.includes(from) || !TRANSFERABLE.includes(to)) return FAIL('Cuenta no válida para transferencias.');
  if (from === to) return FAIL('Elegí cuentas distintas.');
  if (!Number.isSafeInteger(amount) || amount <= 0) return FAIL('Ingresá un monto mayor a cero.');
  const r = tryPost(state.ledger, {
    day: state.day,
    memo: 'Transferencia entre cuentas propias',
    cf: 'internal',
    tag: 'transfer',
    lines: [
      { account: to, debit: amount },
      { account: from, credit: amount },
    ],
  });
  if (!r.ok) return FAIL(r.error);
  if (to === 'savings') practice(state, 'save', 'finEdu', 25);
  return OK('Transferencia realizada.');
}

/** Acumula saldos diarios para calcular intereses y comisiones sobre el saldo promedio. */
export function accrueDaily(state: GameState): void {
  state.bank.savingsBalanceDays += state.ledger.balances.savings;
  state.bank.checkingBalanceDays += state.ledger.balances.checking;
}

/** Cierre mensual de cuentas: intereses del ahorro y comisión de mantenimiento. */
export function monthEndBanking(state: GameState): void {
  const g = dateOf(state.day);
  const days = daysInMonth(g.y, g.m);
  const rate = savingsRate(state);
  const interest = roundCents((state.bank.savingsBalanceDays * rate) / 365);
  if (interest > 0) {
    post(state.ledger, {
      day: state.day,
      memo: `Intereses de ahorro (${fmtPct(rate, 2)} anual)`,
      cf: 'operating',
      tag: 'interest:savings',
      lines: [
        { account: 'savings', debit: interest },
        { account: 'interest_income', credit: interest },
      ],
    });
    state.tax.ytd.interest += interest;
    addLog(state, 'income', '🏦', 'Intereses de la cuenta de ahorro acreditados.', interest);
  }
  const avgChecking = state.bank.checkingBalanceDays / days;
  if (avgChecking < CHECKING_FEE_WAIVER_AVG && state.ledger.balances.checking >= CHECKING_FEE) {
    post(state.ledger, {
      day: state.day,
      memo: 'Comisión de mantenimiento de cuenta corriente',
      cf: 'operating',
      tag: 'fee:checking',
      lines: [
        { account: 'bank_fees', debit: CHECKING_FEE },
        { account: 'checking', credit: CHECKING_FEE },
      ],
    });
  }
  state.bank.savingsBalanceDays = 0;
  state.bank.checkingBalanceDays = 0;
}

export function openDeposit(state: GameState, amount: Cents, termMonths: number, source: AccountId = 'checking'): ActionResult {
  if (!DEPOSIT_TERMS.includes(termMonths as 3)) return FAIL('Plazo no disponible.');
  if (amount < MIN_DEPOSIT) return FAIL(`El depósito mínimo es ${fmtMoney(MIN_DEPOSIT)}.`);
  if (source !== 'checking' && source !== 'savings') return FAIL('Origen no válido.');
  if (state.ledger.balances[source] < amount) return FAIL('Saldo insuficiente.');
  const rate = depositRate(state, termMonths);
  const d: TermDeposit = { id: nextId(state), principal: amount, rate, termMonths, startDay: state.day, maturityDay: addMonths(state.day, termMonths) };
  post(state.ledger, {
    day: state.day,
    memo: `Depósito a plazo ${termMonths} meses al ${fmtPct(rate, 2)}`,
    cf: 'investing',
    tag: 'deposit:open',
    lines: [
      { account: 'term_deposits', debit: amount },
      { account: source, credit: amount },
    ],
  });
  state.bank.deposits.push(d);
  addLog(state, 'info', '🔒', `Abriste un depósito a ${termMonths} meses. Interés estimado al vencimiento: ${fmtMoney(depositInterest(d))}.`, amount);
  practice(state, 'deposit', 'finEdu', 120);
  return OK('Depósito abierto.');
}

function closeDeposit(state: GameState, d: TermDeposit, interest: Cents, fee: Cents, memo: string): void {
  post(state.ledger, {
    day: state.day,
    memo: `${memo}: devolución de capital`,
    cf: 'investing',
    tag: 'deposit:close',
    lines: [
      { account: 'checking', debit: d.principal - fee },
      ...(fee > 0 ? [{ account: 'bank_fees' as const, debit: fee }] : []),
      { account: 'term_deposits', credit: d.principal },
    ],
  });
  if (interest > 0) {
    post(state.ledger, {
      day: state.day,
      memo: `${memo}: intereses`,
      cf: 'operating',
      tag: 'interest:deposit',
      lines: [
        { account: 'checking', debit: interest },
        { account: 'interest_income', credit: interest },
      ],
    });
    state.tax.ytd.interest += interest;
  }
  state.bank.deposits = state.bank.deposits.filter((x) => x.id !== d.id);
}

export function processDeposits(state: GameState): void {
  for (const d of [...state.bank.deposits]) {
    if (d.maturityDay === state.day) {
      const interest = depositInterest(d);
      closeDeposit(state, d, interest, 0, 'Vencimiento de depósito a plazo');
      if (state.progression.achievements.first_deposit_matured === undefined && !state.meta.projection) {
        state.progression.achievements.first_deposit_matured = state.day;
        addLog(state, 'success', '🌾', 'Logro desbloqueado: Cosecha.');
      }
      addLog(state, 'income', '🔓', `Venció tu depósito de ${fmtMoney(d.principal)}. Ganaste ${fmtMoney(interest)} de intereses.`, d.principal + interest);
    }
  }
}

/** Cancelación anticipada: se pierden los intereses y se cobra una comisión del 0,5 %. */
export function earlyBreakCost(d: TermDeposit): Cents {
  return roundCents(d.principal * EARLY_BREAK_FEE_RATE);
}

export function breakDeposit(state: GameState, id: number): ActionResult {
  const d = state.bank.deposits.find((x) => x.id === id);
  if (!d) return FAIL('Depósito inexistente.');
  const fee = earlyBreakCost(d);
  closeDeposit(state, d, 0, fee, 'Cancelación anticipada de depósito');
  addLog(state, 'warning', '🔓', `Cancelaste un depósito antes de tiempo: perdiste los intereses y pagaste ${fmtMoney(fee)} de comisión.`, d.principal - fee);
  return OK('Depósito cancelado.');
}

export function setPensionRate(state: GameState, rate: number): ActionResult {
  state.bank.pensionRate = clamp(Math.round(rate * 100) / 100, 0, 0.15);
  return OK(`Aporte a jubilación: ${fmtPct(state.bank.pensionRate, 0)} del salario bruto.`);
}
