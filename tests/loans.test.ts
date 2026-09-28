import { amortizationSchedule, amortizedPayment, quoteAll, takeLoan, prepayLoan } from '../src/engine/finance/loans';
import { usd } from '../src/engine/money';
import { makeGame, forceHire, expectConsistent } from './helpers';
import { simulateDays } from '../src/engine/simulation';

describe('Préstamos', () => {
  it('la tabla de amortización devuelve exactamente el principal', () => {
    const rows = amortizationSchedule(usd(10000), 0.12, 24);
    expect(rows.length).toBe(24);
    expect(rows.reduce((s, r) => s + r.principal, 0)).toBe(usd(10000));
    expect(rows[rows.length - 1].balance).toBe(0);
    expect(amortizedPayment(usd(10000), 0.12, 24)).toBe(47074); // 470.74
  });

  it('sin ingresos solo FinaRápido presta, y poco', () => {
    const s = makeGame();
    const offers = quoteAll(s, usd(5000), 12);
    expect(offers.every((o) => !o.approved)).toBe(true);
    const small = quoteAll(s, usd(500), 12).filter((o) => o.approved);
    expect(small.map((o) => o.bank.id)).toEqual(['finarapido']);
  });

  it('no es una fuente infinita de dinero: sin ingresos no hay segundo préstamo', () => {
    const s = makeGame();
    expect(takeLoan(s, 'finarapido', usd(500), 12).ok).toBe(true);
    expect(takeLoan(s, 'finarapido', usd(500), 12).ok).toBe(false);
    expectConsistent(s);
  });

  it('el límite deuda/ingreso bloquea sobreendeudamiento', () => {
    const s = makeGame('herencia');
    forceHire(s, 'ventas_asistente', 1100);
    s.credit.score = 700;
    const approvedAmounts = [];
    for (let i = 0; i < 6; i++) {
      const r = takeLoan(s, 'andino', usd(4000), 24);
      if (r.ok) approvedAmounts.push(i);
    }
    expect(approvedAmounts.length).toBeLessThan(3);
    expectConsistent(s);
  });

  it('cuotas, intereses y amortización anticipada cuadran con el libro', () => {
    const s = makeGame('herencia');
    forceHire(s, 'fin_cajero', 1150);
    s.credit.score = 700;
    const r = takeLoan(s, 'andino', usd(3000), 12);
    expect(r.ok).toBe(true);
    simulateDays(s, 95);
    expectConsistent(s);
    const loan = s.bank.loans[0];
    expect(loan.paymentsMade).toBe(3);
    expect(prepayLoan(s, loan.id, loan.balance).ok).toBe(true);
    expect(s.bank.loans[0].status).toBe('paid');
    expect(s.ledger.balances.personal_loans).toBe(0);
    expectConsistent(s);
  });
});
