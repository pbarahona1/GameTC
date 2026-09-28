import { makeGame, expectConsistent } from './helpers';
import { advanceDay } from '../src/engine/simulation';
import { isLastDayOfMonth, dayOf, dateOf } from '../src/engine/time/calendar';
import { incomeStatement, balanceSheet, cashFlowStatement, periodTotals } from '../src/engine/reports/statements';
import { transfer, openDeposit, breakDeposit, setPensionRate } from '../src/engine/finance/banking';
import { payCard, setAutopay } from '../src/engine/finance/creditCard';
import { takeLoan, prepayLoan } from '../src/engine/finance/loans';
import { payExpense } from '../src/engine/finance/payments';
import { changeLifestyle, setPaymentMethod, payArrears, setPrivateInsurance } from '../src/engine/finance/budget';
import { apply, acceptOffer, negotiateOffer, quitJob, declineOffer } from '../src/engine/career/career';
import { enroll } from '../src/engine/skills/education';
import { COURSES } from '../src/content/courses';
import { JOBS } from '../src/content/jobs';
import { LIFESTYLES } from '../src/content/lifestyle';
import { usd } from '../src/engine/money';
import { nextRandom } from '../src/engine/rng';
import { computeAnnualTax, VALDORIA } from '../src/engine/tax/incomeTax';
import type { GameState } from '../src/engine/state';
import { analyze } from '../src/engine/advisor/advisor';
import { computeMetrics } from '../src/engine/reports/metrics';

/** Bot que ejecuta acciones aleatorias válidas e inválidas para buscar estados imposibles. */
function randomAction(s: GameState, r: { rng: number }) {
  const pick = <T,>(a: T[]) => a[Math.floor(nextRandom(r) * a.length)];
  const amt = () => usd(Math.floor(nextRandom(r) * 3000));
  const k = Math.floor(nextRandom(r) * 18);
  switch (k) {
    case 0: return transfer(s, pick(['checking', 'savings', 'cash_wallet'] as const), pick(['checking', 'savings', 'cash_wallet'] as const), amt());
    case 1: return openDeposit(s, amt(), pick([3, 6, 12, 24]), pick(['checking', 'savings'] as const));
    case 2: return s.bank.deposits[0] ? breakDeposit(s, s.bank.deposits[0].id) : null;
    case 3: return payCard(s, amt());
    case 4: return setAutopay(s, pick(['none', 'min', 'full'] as const));
    case 5: return takeLoan(s, pick(['austral', 'andino', 'finarapido']), amt(), pick([6, 12, 24]));
    case 6: return s.bank.loans[0] ? prepayLoan(s, s.bank.loans[0].id, amt()) : null;
    case 7: return payExpense(s, 'leisure', usd(Math.floor(nextRandom(r) * 200)), { memo: 'compra', method: pick(['card', 'checking', 'cash'] as const) });
    case 8: return changeLifestyle(s, pick(LIFESTYLES).id);
    case 9: return setPaymentMethod(s, pick(s.budget.items).key, pick(['checking', 'card', 'cash'] as const));
    case 10: return payArrears(s, amt());
    case 11: return apply(s, pick(JOBS).id);
    case 12: { const o = s.career.applications.find((a) => a.status === 'offer'); return o ? acceptOffer(s, o.id) : null; }
    case 13: { const o = s.career.applications.find((a) => a.status === 'offer'); return o ? negotiateOffer(s, o.id, pick([0.05, 0.1, 0.15, 0.2])) : null; }
    case 14: return nextRandom(r) < 0.1 ? quitJob(s) : null;
    case 15: return enroll(s, pick(COURSES).id);
    case 16: return setPensionRate(s, pick([0, 0.05, 0.1, 0.15]));
    case 17: { const o = s.career.applications.find((a) => a.status === 'offer'); return o ? declineOffer(s, o.id) : setPrivateInsurance(s, nextRandom(r) < 0.5); }
  }
  return null;
}

describe('Auditoría de la Fase 1 (bots aleatorios)', () => {
  const seeds = ['a', 'b', 'c', 'd', 'e', 'f'];
  for (const seed of seeds) {
    it(`semilla ${seed}: 4 años de acciones aleatorias sin estados imposibles`, () => {
      const s = makeGame(seed === 'c' ? 'herencia' : seed === 'd' ? 'tecnico' : 'egresado', 'audit-' + seed);
      const bot = { rng: seed.charCodeAt(0) * 7919 };
      let monthStart = s.day + 1;
      let nw0 = balanceSheet(s).netWorth;
      const skillFloor: Record<string, number> = {};
      while (s.day < 4 * 365) {
        advanceDay(s);
        if (nextRandom(bot) < 0.25) randomAction(s, bot);
        // Comportamiento humano típico: responder ofertas y buscar empleo cuando no hay.
        const offer = s.career.applications.find((a) => a.status === 'offer');
        if (offer && nextRandom(bot) < 0.5) acceptOffer(s, offer.id);
        if (!s.career.job && nextRandom(bot) < 0.1) apply(s, JOBS[Math.floor(nextRandom(bot) * JOBS.length)].id);
        if (isLastDayOfMonth(s.day)) {
          expectConsistent(s);
          // Conservación: Δ patrimonio = resultado neto del mes
          const is = incomeStatement(s, monthStart, s.day);
          const nw1 = balanceSheet(s).netWorth;
          expect(nw1 - nw0).toBe(is.netResult);
          // Conciliación de caja
          const cf = cashFlowStatement(s, monthStart, s.day);
          expect(cf.opening + cf.totalOperating + cf.totalInvesting + cf.totalFinancing).toBe(cf.closing);
          // Habilidades nunca bajan
          for (const [k, v] of Object.entries(s.skills)) {
            expect(v.level).toBeGreaterThanOrEqual(skillFloor[k] ?? 0);
            skillFloor[k] = v.level;
          }
          // El asesor funciona sobre cualquier estado
          const m = computeMetrics(s);
          for (const i of analyze(s, m)) expect(i.data.length).toBeGreaterThan(0);
          monthStart = s.day + 1;
          nw0 = nw1;
        }
      }
      const tags = new Set(s.ledger.entries.map((e) => (e.tag ?? '').split(':')[0]));
      if (process.env.AUDIT_VERBOSE) console.log(seed, [...tags].join(','), 'jobs', s.career.history.length, 'filings', s.tax.filings.length);
      expect(tags.has('payroll') || tags.has('recurring:rent') || tags.size > 3).toBe(true);
    });
  }

  it('la declaración anual coincide con lo registrado en el libro mayor', () => {
    const s = makeGame('herencia', 'tax-ledger');
    apply(s, 'ventas_asistente');
    for (let i = 0; i < 30; i++) {
      advanceDay(s);
      const o = s.career.applications.find((a) => a.status === 'offer');
      if (o) acceptOffer(s, o.id);
    }
    transfer(s, 'checking', 'savings', usd(8000));
    enroll(s, 'book_finanzas');
    while (s.day < dayOf(2027, 1, 1)) advanceDay(s);
    const f = s.tax.filings.find((x) => x.year === 2026)!;
    const t = periodTotals(s, dayOf(2026, 1, 1), dayOf(2026, 12, 31));
    // Ingreso bruto declarado = salarios + bonos + intereses del libro (el aporte patronal no tributa)
    expect(f.grossIncome).toBe(t.salary_income + t.bonus_income + t.interest_income);
    // Retenciones declaradas = impuesto retenido en nóminas del año
    const withheld = s.ledger.entries
      .filter((e) => e.tag === 'payroll' && dateOf(e.day).y === 2026)
      .reduce((a, e) => a + e.lines.filter((l) => l.account === 'income_tax').reduce((x, l) => x + l.debit, 0), 0);
    expect(f.withheld).toBe(withheld);
    // Recalcular de forma independiente
    const again = computeAnnualTax(VALDORIA, { year: 2026, wages: t.salary_income, bonuses: t.bonus_income, interest: t.interest_income, pensionEmployee: f.deductions, socialSecurity: 0, withheld, educationSpent: t.education });
    expect(again.taxAfterCredits).toBe(f.taxAfterCredits);
    expectConsistent(s);
  });

  it('la tarjeta solo cobra intereses cuando se pierde el período de gracia', () => {
    const s = makeGame('herencia', 'card-audit');
    s.bank.card.autopay = 'full';
    // 300 días: el colchón de la herencia alcanza (sin empleo, a los ~14 meses se agota y ahí sí habría intereses).
    for (let d = 0; d < 300; d++) {
      if (d % 3 === 0) payExpense(s, 'leisure', usd(20), { memo: 'compra', method: 'card' });
      advanceDay(s);
    }
    expect(s.ledger.balances.interest_expense).toBe(0);
    expect(s.credit.latePayments.length).toBe(0);
  });

  it('los préstamos pagados reducen exactamente el principal y registran interés', () => {
    const s = makeGame('herencia', 'loan-audit');
    s.credit.score = 720;
    for (let i = 0; i < 120 && !s.career.job; i++) {
      if (!s.career.applications.some((a) => a.status === 'pending')) for (const j of ['ventas_asistente', 'log_operario', 'adm_recepcion', 'ind_operario']) apply(s, j);
      advanceDay(s);
      const o = s.career.applications.find((a) => a.status === 'offer');
      if (o) acceptOffer(s, o.id);
    }
    expect(s.career.job).not.toBeNull();
    expect(takeLoan(s, 'andino', usd(2400), 12).ok).toBe(true);
    for (let i = 0; i < 400; i++) advanceDay(s);
    const l = s.bank.loans[0];
    expect(l.status).toBe('paid');
    expect(l.paymentsMade).toBe(12);
    const paidPrincipal = s.ledger.entries.filter((e) => e.tag === 'loan:payment').reduce((a, e) => a + e.lines.find((x) => x.account === 'personal_loans')!.debit, 0);
    expect(paidPrincipal).toBe(usd(2400));
    expect(l.interestPaid).toBeGreaterThan(0);
  });
});

describe('Nómina exacta', () => {
  it('pagos parciales dentro del mes suman exactamente el sueldo mensual', async () => {
    const { forceHire } = await import('./helpers');
    const { paySalaryThrough } = await import('../src/engine/career/career');
    const s = makeGame('egresado', 'payroll-exact');
    forceHire(s, 'adm_recepcion', 1003.33);
    while (s.day < dayOf(2026, 3, 1)) advanceDay(s);
    const before = s.ledger.balances.salary_income;
    while (s.day < dayOf(2026, 3, 7)) advanceDay(s);
    paySalaryThrough(s, s.day); // por ejemplo, una evaluación a mitad de mes
    while (s.day < dayOf(2026, 3, 19)) advanceDay(s);
    paySalaryThrough(s, s.day);
    while (s.day < dayOf(2026, 3, 31)) advanceDay(s);
    expect(s.ledger.balances.salary_income - before).toBe(100333);
  });
});
