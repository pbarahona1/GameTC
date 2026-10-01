import { describe, it, expect } from 'vitest';
import { isDeepStrictEqual } from 'node:util';
import { makeGame, forceHire, expectConsistent } from './helpers';
import { advanceDay, advanceDaySafe, simulateDaysSafe } from '../src/engine/simulation';
import { takeSnapshot } from '../src/engine/snapshot';
import { post } from '../src/engine/ledger/ledger';
import { usd } from '../src/engine/money';
import { foundCompany } from '../src/engine/business/ownership';
import { placeStockOrder } from '../src/engine/invest/stocks';
import { buyFund } from '../src/engine/invest/funds';
import { buyProperty } from '../src/engine/realestate/realestate';
import { isLastDayOfMonth } from '../src/engine/time/calendar';
import type { GameState } from '../src/engine/state';

/** Partida con empresa, acciones, fondo e inmueble: toca casi todos los sistemas del día. */
function busyGame(seed: string): GameState {
  const s = makeGame('herencia', seed);
  post(s.ledger, { day: 0, memo: 'Capital de prueba', cf: 'internal', lines: [{ account: 'checking', debit: usd(600000) }, { account: 'opening_equity', credit: usd(600000) }] });
  s.credit.score = 740;
  forceHire(s, 'ventas_asistente');
  foundCompany(s, { sector: 'minimarket', name: 'Mercado', legalForm: 'srl', capital: usd(150000) });
  placeStockOrder(s, { stockId: s.stocks.stocks[0].id, side: 'compra', type: 'mercado', qty: 100 });
  buyFund(s, 'F-IDX', usd(5000));
  const l = s.realEstate.listings.find((x) => x.property.type === 'vivienda') ?? s.realEstate.listings[0];
  buyProperty(s, l.id, { owner: { kind: 'personal' } });
  return s;
}

describe('Fase 1 · día de simulación atómico', () => {
  it('un día sano se aplica completo sobre el mismo objeto', () => {
    const s = makeGame('egresado', 'safe-ok');
    const r = advanceDaySafe(s);
    expect(r.ok).toBe(true);
    expect(r.state).toBe(s);
    expect(s.day).toBe(1);
  });

  it('si el día falla a mitad de camino, el estado vuelve EXACTAMENTE al día anterior', () => {
    const s = busyGame('safe-rollback');
    for (let d = 0; d < 120; d++) advanceDay(s);
    const before = structuredClone(s);
    // Falla después de simular casi todo el día y de escribir un asiento.
    const r = advanceDaySafe(s, (st) => {
      advanceDay(st);
      post(st.ledger, { day: st.day, memo: 'a medias', cf: 'internal', lines: [{ account: 'checking', debit: 100 }, { account: 'opening_equity', credit: 100 }] });
      throw new Error('falla simulada del motor');
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure.day).toBe(before.day + 1);
    expect(r.failure.message).toBe('falla simulada del motor');
    expect(r.failure.kind).toBe('exception');
    expect(r.state.day).toBe(before.day);
    expect(isDeepStrictEqual(r.state, before)).toBe(true);
    expectConsistent(r.state);
    // Y se puede seguir jugando normalmente.
    const next = advanceDaySafe(r.state);
    expect(next.ok).toBe(true);
    expect(r.state.day).toBe(before.day + 1);
  });

  it('la instantánea restaura bien después de un día completo durante dos años (listas que el motor recorta)', () => {
    const s = busyGame('safe-property');
    let checked = 0;
    let cur = s;
    while (cur.day < 730) {
      if (cur.day % 11 === 0) {
        const before = structuredClone(cur);
        const snap = takeSnapshot(cur);
        advanceDay(cur);
        const back = snap.restore();
        expect(isDeepStrictEqual(back, before)).toBe(true);
        checked++;
        cur = back;
      }
      advanceDay(cur);
    }
    expect(checked).toBeGreaterThan(60);
    expectConsistent(cur);
  });

  it('una inconsistencia contable al cerrar el mes se trata como falla y no avanza', () => {
    const s = makeGame('egresado', 'safe-inv');
    while (!isLastDayOfMonth(s.day + 1)) advanceDay(s);
    const before = structuredClone(s);
    const r = advanceDaySafe(s, (st) => {
      advanceDay(st);
      st.ledger.balances.checking += 1; // saldo que no surge de ningún asiento
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure.kind).toBe('invariants');
    expect(isDeepStrictEqual(r.state, before)).toBe(true);
  });

  it('simular varios días se detiene en el primero que falla y conserva los anteriores', () => {
    const s = makeGame('egresado', 'safe-multi');
    const failOn = 10;
    const run = simulateDaysSafe(s, 30, (st) => {
      advanceDay(st);
      if (st.day === failOn) throw new Error('día roto');
    });
    expect(run.daysDone).toBe(failOn - 1);
    expect(run.failure?.day).toBe(failOn);
    expect(run.state.day).toBe(failOn - 1);
    expect(run.report.fromDay).toBe(0);
    expect(run.report.toDay).toBe(failOn - 1);
    expectConsistent(run.state);
  });

  it('determinismo: simular con días atómicos da el mismo resultado que sin ellos', () => {
    const a = busyGame('safe-det');
    const b = structuredClone(a);
    for (let d = 0; d < 200; d++) advanceDay(a);
    const run = simulateDaysSafe(b, 200);
    expect(run.failure).toBeNull();
    expect(isDeepStrictEqual(run.state, a)).toBe(true);
  });
});
