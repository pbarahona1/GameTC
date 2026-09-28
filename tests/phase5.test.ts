import { describe, it, expect } from 'vitest';
import { makeGame, expectConsistent } from './helpers';
import { advanceDay } from '../src/engine/simulation';
import { post } from '../src/engine/ledger/ledger';
import { usd } from '../src/engine/money';
import type { GameState } from '../src/engine/state';
import { dayOf, dateOf, isLastDayOfMonth, startOfMonth } from '../src/engine/time/calendar';
import { balanceSheet, incomeStatement, cashFlowStatement, periodTotals, cashDelta, labelFor } from '../src/engine/reports/statements';
import { gCompact, type Chart } from '../src/engine/ledger/core';
import { ACCOUNTS, type AccountId } from '../src/engine/ledger/accounts';
import { compactPersonal, compactCompany } from '../src/engine/ledger/compaction';
import { coIncomeStatement, coCashFlow } from '../src/engine/business/reports';
import { coPeriodTotals } from '../src/engine/business/companyLedger';
import { foundCompany } from '../src/engine/business/ownership';
import { placeStockOrder } from '../src/engine/invest/stocks';
import { buyFund } from '../src/engine/invest/funds';
import { buyProperty } from '../src/engine/realestate/realestate';
import { saveGame, loadGame, serialize, serializeCompact, deserializeAny, deserialize, MemoryKV, KEYS, KV } from '../src/persistence/save';
import { forceHire } from './helpers';

function richGame(seed: string, years: number): GameState {
  const s = makeGame('herencia', seed);
  post(s.ledger, { day: 0, memo: 'Capital de prueba', cf: 'internal', lines: [{ account: 'checking', debit: usd(600000) }, { account: 'opening_equity', credit: usd(600000) }] });
  s.credit.score = 740;
  forceHire(s, 'ventas_asistente');
  foundCompany(s, { sector: 'minimarket', name: 'Mercado Prueba', legalForm: 'srl', capital: usd(60000) });
  placeStockOrder(s, { stockId: s.stocks.stocks[0].id, side: 'compra', type: 'mercado', qty: 100 });
  buyFund(s, 'F-IDX', usd(5000));
  const l = s.realEstate.listings.find((x) => x.property.type === 'vivienda') ?? s.realEstate.listings[0];
  buyProperty(s, l.id, { owner: { kind: 'personal' } });
  while (s.day < years * 365) advanceDay(s);
  return s;
}

/** Meses calendario completos entre dos días. */
function months(from: number, to: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let d = startOfMonth(from) < from ? startOfMonth(from + 31) : from;
  while (d <= to) {
    let e = d;
    while (!isLastDayOfMonth(e)) e++;
    if (e <= to) out.push([d, e]);
    d = e + 1;
  }
  return out;
}

describe('Fase 5 · compactación del libro mayor', () => {
  const base = richGame('fase5-compact', 3);

  it('la compactación automática ya actuó y la contabilidad sigue cuadrando', () => {
    expect(base.ledger.archive?.entries ?? 0).toBeGreaterThan(0);
    expect(base.companies[0].ledger.archive?.entries ?? 0).toBeGreaterThan(0);
    expectConsistent(base);
  });

  it('compactar TODO el libro personal no cambia saldos ni informes de meses completos', () => {
    const a = structuredClone(base);
    const b = structuredClone(base);
    // Compactación agresiva: todo lo anterior al mes en curso.
    gCompact(ACCOUNTS as unknown as Chart<AccountId>, b.ledger, startOfMonth(b.day), (d) => { const g = dateOf(d); return g.y * 12 + g.m; }, (e) => ({ delta: cashDelta(e), label: labelFor(e) }));
    expect(b.ledger.entries.length).toBeLessThan(a.ledger.entries.length);
    expect(b.ledger.balances).toEqual(a.ledger.balances);
    expectConsistent(b);
    const first = Math.max(1, (a.ledger.archive?.buckets[0]?.from ?? 1));
    for (const [f, t] of months(first, b.day)) {
      expect(periodTotals(b, f, t)).toEqual(periodTotals(a, f, t));
      expect(incomeStatement(b, f, t).netResult).toBe(incomeStatement(a, f, t).netResult);
      const ca = cashFlowStatement(a, f, t);
      const cb = cashFlowStatement(b, f, t);
      expect([cb.opening, cb.closing, cb.totalOperating, cb.totalInvesting, cb.totalFinancing, cb.cashIn, cb.cashOut]).toEqual([ca.opening, ca.closing, ca.totalOperating, ca.totalInvesting, ca.totalFinancing, ca.cashIn, ca.cashOut]);
    }
    // Año completo y "todo"
    const y = dateOf(b.day).y - 1;
    expect(incomeStatement(b, dayOf(y, 1, 1), dayOf(y, 12, 31)).netResult).toBe(incomeStatement(a, dayOf(y, 1, 1), dayOf(y, 12, 31)).netResult);
    expect(cashFlowStatement(b, 0, b.day).closing).toBe(cashFlowStatement(a, 0, a.day).closing);
  });

  it('compactar el libro de una empresa conserva saldos, resultados y flujo por mes', () => {
    const a = structuredClone(base);
    const b = structuredClone(base);
    const ca = a.companies[0];
    const cb = b.companies[0];
    compactCompany(b, cb, 0);
    expect(cb.ledger.entries.length).toBeLessThan(ca.ledger.entries.length);
    expect(cb.ledger.balances).toEqual(ca.ledger.balances);
    expectConsistent(b);
    for (const [f, t] of months(Math.max(ca.foundedDay + 1, 1), b.day)) {
      expect(coPeriodTotals(cb.ledger, f, t)).toEqual(coPeriodTotals(ca.ledger, f, t));
      expect(coIncomeStatement(cb, f, t).netIncome).toBe(coIncomeStatement(ca, f, t).netIncome);
      const fa = coCashFlow(ca, f, t);
      const fb = coCashFlow(cb, f, t);
      expect([fb.opening, fb.closing, fb.totalOperating]).toEqual([fa.opening, fa.closing, fa.totalOperating]);
    }
  });

  it('el patrimonio neto y el balance no cambian por compactar', () => {
    const b = structuredClone(base);
    compactPersonal(b);
    for (const co of b.companies) compactCompany(b, co, 0);
    expect(balanceSheet(b).netWorth).toBe(balanceSheet(base).netWorth);
  });
});

/** Almacenamiento con cupo (simula el límite de localStorage). */
class QuotaKV implements KV {
  map = new Map<string, string>();
  constructor(public limit: number) {}
  used() {
    let n = 0;
    for (const v of this.map.values()) n += v.length;
    return n;
  }
  async get(k: string) {
    return this.map.get(k) ?? null;
  }
  async set(k: string, v: string) {
    const prev = this.map.get(k)?.length ?? 0;
    if (this.used() - prev + v.length > this.limit) {
      const e = new Error('cupo excedido');
      e.name = 'QuotaExceededError';
      throw e;
    }
    this.map.set(k, v);
  }
  async remove(k: string) {
    this.map.delete(k);
  }
}

describe('Fase 5 · guardado comprimido y seguro', () => {
  const s = richGame('fase5-save', 2);

  it('el guardado comprimido es mucho más chico y restaura exactamente el mismo estado', async () => {
    const plain = serialize(s, 1);
    const packed = await serializeCompact(s, 1);
    expect(packed.length).toBeLessThan(plain.length / 4);
    const r = await deserializeAny(packed);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state).toEqual(JSON.parse(JSON.stringify(s)));
    // El texto plano (exportación) también se sigue leyendo.
    const r2 = await deserializeAny(plain);
    expect(r2.ok).toBe(true);
  });

  it('un guardado comprimido alterado se rechaza', async () => {
    const packed = JSON.parse(await serializeCompact(s, 1));
    packed.payload = packed.payload.slice(0, 200) + (packed.payload[200] === 'A' ? 'B' : 'A') + packed.payload.slice(201);
    const r = await deserializeAny(JSON.stringify(packed));
    expect(r.ok).toBe(false);
    const sync = deserialize(JSON.stringify(packed));
    expect(sync.ok).toBe(false);
  });

  it('una copia dañada no destruye las demás: se carga la mejor copia válida', async () => {
    const kv = new MemoryKV();
    const g = structuredClone(s);
    for (let i = 0; i < 4; i++) {
      for (let d = 0; d < 31; d++) advanceDay(g);
      await saveGame(kv, g, 1000 + i);
    }
    expect(kv.map.get(KEYS.backups[0])).toBeTruthy();
    // Se daña la principal
    kv.map.set(KEYS.primary, kv.map.get(KEYS.primary)!.slice(0, 500));
    const r = await loadGame(kv);
    expect(r.state).not.toBeNull();
    expect(r.recovered).toBe(true);
    expect(r.problems.length).toBeGreaterThan(0);
    // Las copias siguen ahí
    expect(kv.map.get(KEYS.backups[0])).toBeTruthy();
    // Se dañan la principal y la primera copia: se usa la siguiente
    kv.map.set(KEYS.backups[0], '{"format":"urt-save","payload":"x","checksum":"0"}');
    const r2 = await loadGame(kv);
    expect(r2.state).not.toBeNull();
    expect(r2.source).toBe(KEYS.backups[1]);
  });

  it('si la escritura se interrumpe, la ranura temporal más nueva se recupera', async () => {
    const kv = new MemoryKV();
    const g = structuredClone(s);
    await saveGame(kv, g, 1);
    for (let d = 0; d < 10; d++) advanceDay(g);
    // Simula un cierre entre la escritura temporal y la principal.
    kv.map.set(KEYS.temp, await serializeCompact(g, 2));
    const r = await loadGame(kv);
    expect(r.state?.day).toBe(g.day);
  });

  it('con el almacenamiento lleno libera copias viejas, nunca la principal, y no rompe nada', async () => {
    const one = (await serializeCompact(s, 1)).length;
    const kv = new QuotaKV(Math.round(one * 3.6));
    const g = structuredClone(s);
    let lastOk = 0;
    for (let i = 0; i < 6; i++) {
      for (let d = 0; d < 31; d++) advanceDay(g);
      const r = await saveGame(kv, g, 10 + i);
      if (r.ok) lastOk = g.day;
    }
    expect(lastOk).toBe(g.day);
    const r = await loadGame(kv);
    expect(r.state?.day).toBe(g.day);
    // Cupo mínimo: ni siquiera entra un guardado → error claro y la partida anterior intacta.
    const tiny = new QuotaKV(one + 10);
    await saveGame(tiny, s, 1);
    const big = structuredClone(g);
    for (let d = 0; d < 400; d++) advanceDay(big);
    const bad = await saveGame(tiny, big, 2);
    if (!bad.ok) {
      expect(bad.error).toMatch(/intacta|parcial/);
      const back = await loadGame(tiny);
      expect(back.state).not.toBeNull();
    }
  });
});

describe('Fase 5 · rendimiento', () => {
  it('10 años de simulación completa en un tiempo razonable y con guardado acotado', async () => {
    const t0 = Date.now();
    const s = richGame('fase5-perf', 10);
    const ms = Date.now() - t0;
    expectConsistent(s);
    const size = (await serializeCompact(s, 1)).length;
    const raw = JSON.stringify(s).length;
    // Referencia en el entorno de pruebas (Node, un núcleo): holgado para no ser frágil.
    expect(ms).toBeLessThan(120000);
    expect(raw).toBeLessThan(4 * 1024 * 1024);
    expect(size).toBeLessThan(900 * 1024);
    console.log(`10 años: ${(ms / 1000).toFixed(1)} s (${Math.round((3650 / ms) * 1000)} días/s) · estado ${(raw / 1024).toFixed(0)} KB · guardado ${(size / 1024).toFixed(0)} KB · asientos personales ${s.ledger.entries.length} + ${s.ledger.archive?.entries ?? 0} resumidos`);
  }, 180000);
});

describe('Fase 5 · instantánea liviana para deshacer acciones', () => {
  it('restaurar devuelve exactamente el estado previo aunque la acción haya escrito asientos y operado', async () => {
    const { takeSnapshot } = await import('../src/engine/snapshot');
    const s = richGame('fase5-snap', 1);
    const before = structuredClone(s);
    const snap = takeSnapshot(s);
    placeStockOrder(s, { stockId: s.stocks.stocks[1].id, side: 'compra', type: 'mercado', qty: 50 });
    buyFund(s, 'F-BON', usd(3000));
    post(s.ledger, { day: s.day, memo: 'x', cf: 'internal', lines: [{ account: 'checking', debit: 100 }, { account: 'opening_equity', credit: 100 }] });
    for (const co of s.companies) co.ledger.entries.push({ ...co.ledger.entries[0], id: 999999 });
    const restored = snap.restore();
    expect(restored).toEqual(before);
    expectConsistent(restored);
    // Y es bastante más rápida que copiar todo.
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) takeSnapshot(s);
    const light = performance.now() - t0;
    const t1 = performance.now();
    for (let i = 0; i < 10; i++) structuredClone(s);
    const full = performance.now() - t1;
    expect(light).toBeLessThan(full);
  });
});

describe('Fase 5 · insolvencia personal de punta a punta', () => {
  it('sin ingresos y con deudas: el asesor la anticipa, aparecen atrasos, cae el puntaje y la contabilidad sigue cuadrando', async () => {
    const { takeLoan } = await import('../src/engine/finance/loans');
    const { quitJob } = await import('../src/engine/career/career');
    const { analyze } = await import('../src/engine/advisor/advisor');
    const s = makeGame('egresado', 'fase5-insolv');
    s.credit.score = 700;
    forceHire(s, 'ventas_asistente');
    for (let d = 0; d < 40; d++) advanceDay(s);
    const r = takeLoan(s, 'finarapido', usd(1500), 24);
    expect(r.ok).toBe(true);
    // Gasta la liquidez y renuncia: ya no hay ingresos.
    const cash = s.ledger.balances.checking - usd(50);
    if (cash > 0) post(s.ledger, { day: s.day, memo: 'Gasto grande', cf: 'operating', lines: [{ account: 'other_expense', debit: cash }, { account: 'checking', credit: cash }] });
    s.ledger.balances.savings > 0 && post(s.ledger, { day: s.day, memo: 'Gasto grande', cf: 'operating', lines: [{ account: 'other_expense', debit: s.ledger.balances.savings }, { account: 'savings', credit: s.ledger.balances.savings }] });
    quitJob(s);
    const scoreBefore = s.credit.score;
    expect(analyze(s).some((i) => i.id === 'personal-insolvency')).toBe(true);
    for (let d = 0; d < 180; d++) {
      advanceDay(s);
      if (isLastDayOfMonth(s.day)) expectConsistent(s);
    }
    expect(s.ledger.balances.arrears + s.bank.loans.reduce((a, l) => a + l.missedTotal, 0)).toBeGreaterThan(0);
    expect(s.credit.score).toBeLessThan(scoreBefore);
    expectConsistent(s);
  });
});
