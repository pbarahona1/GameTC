import { emptyLedger, post, tryPost, recomputeBalances, LedgerError } from '../src/engine/ledger/ledger';
import { makeGame, expectConsistent } from './helpers';
import { usd } from '../src/engine/money';

describe('Libro mayor de partida doble', () => {
  it('acepta asientos cuadrados y actualiza saldos con su naturaleza', () => {
    const L = emptyLedger();
    post(L, { day: 0, memo: 'apertura', cf: 'internal', lines: [{ account: 'checking', debit: 1000 }, { account: 'opening_equity', credit: 1000 }] });
    post(L, { day: 1, memo: 'gasto', cf: 'operating', lines: [{ account: 'food', debit: 300 }, { account: 'checking', credit: 300 }] });
    expect(L.balances.checking).toBe(700);
    expect(L.balances.food).toBe(300);
    expect(L.balances.opening_equity).toBe(1000);
    expect(recomputeBalances(L.entries)).toEqual(L.balances);
  });

  it('rechaza asientos descuadrados sin modificar nada', () => {
    const L = emptyLedger();
    expect(() => post(L, { day: 0, memo: 'x', cf: 'internal', lines: [{ account: 'checking', debit: 100 }, { account: 'opening_equity', credit: 99 }] })).toThrow(LedgerError);
    expect(L.entries.length).toBe(0);
    expect(L.balances.checking).toBe(0);
  });

  it('impide gastar dinero que no existe (cuentas sin saldo negativo)', () => {
    const L = emptyLedger();
    const r = tryPost(L, { day: 0, memo: 'x', cf: 'operating', lines: [{ account: 'food', debit: 100 }, { account: 'checking', credit: 100 }] });
    expect(r.ok).toBe(false);
    expect(L.balances.checking).toBe(0);
  });

  it('rechaza importes no enteros (fracciones de centavo)', () => {
    const L = emptyLedger();
    const r = tryPost(L, { day: 0, memo: 'x', cf: 'internal', lines: [{ account: 'checking', debit: 10.5 }, { account: 'opening_equity', credit: 10.5 }] });
    expect(r.ok).toBe(false);
  });

  it('una partida nueva cumple la ecuación contable', () => {
    const s = makeGame();
    expectConsistent(s);
    expect(s.ledger.balances.checking + s.ledger.balances.cash_wallet).toBe(usd(2000));
  });
});
