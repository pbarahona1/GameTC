import { makeGame, expectConsistent } from './helpers';
import { payExpense } from '../src/engine/finance/payments';
import { payCard, LATE_FEE, statementRemaining } from '../src/engine/finance/creditCard';
import { simulateDays, advanceDay } from '../src/engine/simulation';
import { dateOf, dayOf } from '../src/engine/time/calendar';
import { usd } from '../src/engine/money';

function advanceTo(s: ReturnType<typeof makeGame>, day: number) {
  while (s.day < day) advanceDay(s);
}

describe('Tarjeta de crédito', () => {
  it('pagar el resumen completo no genera intereses (período de gracia)', () => {
    const s = makeGame();
    payExpense(s, 'leisure', usd(200), { memo: 'compra', method: 'card' });
    advanceTo(s, dayOf(2026, 1, 25)); // corte
    expect(s.bank.card.statementBalance).toBe(usd(200));
    payCard(s, statementRemaining(s));
    advanceTo(s, dayOf(2026, 3, 1));
    expect(s.ledger.balances.interest_expense).toBe(0);
    expect(s.bank.card.revolving).toBe(false);
    expectConsistent(s);
  });

  it('pagar solo el mínimo genera intereses en el siguiente corte', () => {
    const s = makeGame();
    payExpense(s, 'leisure', usd(400), { memo: 'compra', method: 'card' });
    advanceTo(s, dayOf(2026, 1, 25));
    payCard(s, s.bank.card.minPayment);
    advanceTo(s, dayOf(2026, 2, 25));
    expect(s.bank.card.revolving).toBe(true);
    expect(s.ledger.balances.interest_expense).toBeGreaterThan(0);
    expectConsistent(s);
  });

  it('no pagar el mínimo cobra recargo y deja un pago atrasado en el historial', () => {
    const s = makeGame();
    payExpense(s, 'leisure', usd(300), { memo: 'compra', method: 'card' });
    const before = s.credit.score;
    advanceTo(s, dayOf(2026, 2, 15)); // vencimiento = 25 ene + 20 días = 14 feb
    expect(s.ledger.balances.late_fees).toBeGreaterThanOrEqual(LATE_FEE);
    expect(s.credit.latePayments.length).toBe(1);
    expect(s.credit.score).toBeLessThan(before);
    expectConsistent(s);
  });

  it('el débito automático paga el total al vencimiento', () => {
    const s = makeGame();
    s.bank.card.autopay = 'full';
    payExpense(s, 'leisure', usd(150), { memo: 'compra', method: 'card' });
    simulateDays(s, 60);
    expect(s.credit.latePayments.length).toBe(0);
    expect(s.ledger.balances.interest_expense).toBe(0);
    expect(dateOf(s.day).m).toBe(3);
    expectConsistent(s);
  });
});
