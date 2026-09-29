import { describe, it, expect } from 'vitest';
import { makeGame, expectConsistent } from './helpers';
import { advanceDay, simulateDays } from '../src/engine/simulation';
import { post } from '../src/engine/ledger/ledger';
import { usd } from '../src/engine/money';
import type { GameState } from '../src/engine/state';
import { deepClone } from '../src/engine/clone';
import { isLastDayOfMonth } from '../src/engine/time/calendar';
import { forecastBusiness, forecastRuns, forecastError, forecastSkill, attachForecast, type BusinessForecast } from '../src/engine/advisor/businessForecast';
import { foundCompany } from '../src/engine/business/ownership';
import { openMandate, depositMandate, withdrawMandate, setMandateProfile, activeMandates, mandateSummary, mandateValue, managerSkill, managerError } from '../src/engine/invest/managed';
import { hirePro, firePro, trainPro, trainingCost } from '../src/engine/pros/pros';
import { quoteMarket, _test as stockTest } from '../src/engine/invest/stocks';
import { serialize, deserialize, MemoryKV, KEYS, saveGame, loadGame } from '../src/persistence/save';
import { NativeKV } from '../src/persistence/platformStorage';
import { SAVE_VERSION } from '../src/engine/state';
import { refreshPropertyListings } from '../src/engine/realestate/realestate';

function funded(seed: string, amount = 200000): GameState {
  const s = makeGame('herencia', seed);
  post(s.ledger, { day: 0, memo: 'Capital de prueba', cf: 'internal', lines: [{ account: 'checking', debit: usd(amount) }, { account: 'opening_equity', credit: usd(amount) }] });
  return s;
}

function addGestor(s: GameState, quality: number, experience: number): number {
  const id = s.meta.nextId++;
  s.pros.hires.push({ id, since: s.day, scope: 'personal', pro: { id: s.meta.nextId++, name: `Gestor ${quality}`, kind: 'gestor', specialty: 'Carteras balanceadas', experience, fee: 0, reputation: 60, quality, mgmtFee: 0.012, perfFee: 0.15 } });
  return id;
}

describe('Proyección de negocios', () => {
  it('no es un oráculo: no modifica la partida y devuelve rangos con incertidumbre', () => {
    const s = funded('fc-a');
    for (let i = 0; i < 5; i++) advanceDay(s);
    const before = JSON.stringify(s);
    const f = forecastBusiness(s, { kind: 'nueva', sector: 'cafeteria', legalForm: 'srl', capital: usd(40000) }) as BusinessForecast;
    expect('error' in f).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
    expect(f.months).toBe(12);
    expect(f.revenue).toHaveLength(12);
    for (const b of [...f.revenue, ...f.net, ...f.cash]) expect(b.p10).toBeLessThanOrEqual(b.p90);
    expect(f.revenue[11].p90).toBeGreaterThan(f.revenue[11].p10);
    expect(f.survival).toBeGreaterThan(0);
    expect(f.survival).toBeLessThan(1);
    expect(f.insights.length).toBeGreaterThan(1);
  });

  it('la habilidad aumenta los futuros simulados y reduce el sesgo, sin llegar nunca a cero', () => {
    const s = makeGame('herencia', 'fc-b');
    const low = { runs: forecastRuns(s), err: forecastError(forecastSkill(s)) };
    s.skills.forecasting.level = 100;
    s.skills.management.level = 100;
    s.skills.accounting.level = 100;
    const high = { runs: forecastRuns(s), err: forecastError(forecastSkill(s)) };
    expect(high.runs).toBeGreaterThan(low.runs);
    expect(high.err).toBeLessThan(low.err);
    expect(high.err).toBeGreaterThanOrEqual(0.05);
  });

  it('con nivel alto, lo que realmente pasa suele caer dentro del rango proyectado', () => {
    let inside = 0;
    const seeds = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
    for (const seed of seeds) {
      const s = funded('fc-real-' + seed);
      s.skills.forecasting.level = 90;
      const target = { kind: 'nueva' as const, sector: 'minimarket' as const, legalForm: 'srl' as const, capital: usd(35000) };
      const f = forecastBusiness(s, target, 6, 12) as BusinessForecast;
      const r = foundCompany(s, { ...target, name: 'Real' });
      expect(r.ok).toBe(true);
      const co = s.companies[s.companies.length - 1];
      let m = 0;
      while (m < 6) {
        advanceDay(s);
        if (isLastDayOfMonth(s.day)) m++;
      }
      const real = co.history.slice(-6).reduce((a, h) => a + h.revenue, 0);
      const lo = f.revenue.reduce((a, b) => a + b.p10, 0);
      const hi = f.revenue.reduce((a, b) => a + b.p90, 0);
      if (real >= lo * 0.97 && real <= hi * 1.03) inside++;
    }
    expect(inside).toBeGreaterThanOrEqual(4);
  }, 120000);

  it('la proyección guardada se compara con la realidad y da experiencia', () => {
    const s = funded('fc-c');
    const target = { kind: 'nueva' as const, sector: 'cafeteria' as const, legalForm: 'srl' as const, capital: usd(30000) };
    const f = forecastBusiness(s, target, 6, 5) as BusinessForecast;
    expect(foundCompany(s, { ...target, name: 'Café X' }).ok).toBe(true);
    const co = s.companies[s.companies.length - 1];
    attachForecast(s, co.id, f);
    const xp0 = s.skills.forecasting.level * 1e6 + s.skills.forecasting.xp;
    simulateDays(s, 100);
    expect(co.forecast?.checked).toBeGreaterThanOrEqual(3);
    expect(s.log.some((l) => l.icon === '🔮')).toBe(true);
    expect(s.skills.forecasting.level * 1e6 + s.skills.forecasting.xp).toBeGreaterThan(xp0);
    expectConsistent(s);
  });
});

describe('Gestor de inversiones', () => {
  it('abrir, aportar, cambiar perfil, retirar y cerrar: la contabilidad siempre cuadra', () => {
    const s = funded('mg-a');
    for (let i = 0; i < 3; i++) advanceDay(s);
    const hid = addGestor(s, 70, 12);
    const cash0 = s.ledger.balances.checking;
    expect(openMandate(s, hid, usd(1000), 'moderado').ok).toBe(false); // mínimo
    const r = openMandate(s, hid, usd(40000), 'moderado');
    expect(r.ok).toBe(true);
    expect(s.ledger.balances.checking).toBe(cash0 - usd(40000));
    expect(s.ledger.balances.managed).toBe(usd(40000));
    expectConsistent(s);
    const m = activeMandates(s)[0];
    for (let d = 0; d < 400; d++) {
      advanceDay(s);
      if (d === 60) expect(depositMandate(s, m.id, usd(10000)).ok).toBe(true);
      if (d === 150) expect(setMandateProfile(s, m.id, 'agresivo').ok).toBe(true);
      if (d === 200) expect(withdrawMandate(s, m.id, usd(5000)).ok).toBe(true);
      if (isLastDayOfMonth(s.day)) expectConsistent(s);
    }
    expect(m.positions.some((p) => p.kind === 'stock')).toBe(true);
    expect(m.mgmtFeesPaid).toBeGreaterThan(0);
    const sum = mandateSummary(s, m);
    expect(Math.abs(sum.value - s.ledger.balances.managed)).toBeLessThanOrEqual(2);
    const before = s.ledger.balances.checking;
    const gains0 = (s.tax.ytd.gainsShort ?? 0) + (s.tax.ytd.gainsLong ?? 0);
    const v = Math.round(mandateValue(s, m));
    expect(withdrawMandate(s, m.id, 'todo').ok).toBe(true);
    expect(m.status).toBe('cerrado');
    expect(s.ledger.balances.managed).toBe(0);
    expect(s.ledger.balances.checking - before).toBeGreaterThan(v * 0.97);
    expect((s.tax.ytd.gainsShort ?? 0) + (s.tax.ytd.gainsLong ?? 0)).not.toBe(gains0);
    expectConsistent(s);
  });

  it('despedir al gestor liquida la cuenta y devuelve el dinero', () => {
    const s = funded('mg-b');
    const p = s.pros.market.find((x) => x.kind === 'gestor')!;
    expect(hirePro(s, p.id, 'personal').ok).toBe(true);
    const h = s.pros.hires.find((x) => x.pro.kind === 'gestor')!;
    expect(openMandate(s, h.id, usd(20000), 'conservador').ok).toBe(true);
    simulateDays(s, 90);
    const before = s.ledger.balances.checking;
    const r = firePro(s, h.id);
    expect(r.ok).toBe(true);
    expect(s.ledger.balances.checking).toBeGreaterThan(before);
    expect(activeMandates(s)).toHaveLength(0);
    expect(s.ledger.balances.managed).toBe(0);
    expectConsistent(s);
  });

  it('mejor capacitado y con más experiencia elige mejor (en promedio), pero no gana siempre', () => {
    const seeds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
    let good = 0;
    let bad = 0;
    let wins = 0;
    for (const seed of seeds) {
      const base = funded('mg-skill-' + seed);
      for (let i = 0; i < 3; i++) advanceDay(base);
      const res: number[] = [];
      for (const [q, e] of [[95, 25], [15, 1]] as const) {
        const s = deepClone(base);
        const hid = addGestor(s, q, e);
        openMandate(s, hid, usd(100000), 'agresivo');
        for (let d = 0; d < 365 * 2; d++) advanceDay(s);
        res.push(mandateSummary(s, activeMandates(s)[0]).totalReturn);
      }
      good += res[0];
      bad += res[1];
      if (res[0] > res[1]) wins++;
    }
    expect(good / seeds.length).toBeGreaterThan(bad / seeds.length);
    expect(wins).toBeGreaterThanOrEqual(4);
    expect(managerError(98)).toBeGreaterThan(0.05);
  }, 180000);

  it('capacitar sube la calidad real, cuesta dinero, tiene espera y cada vez es más cara', () => {
    const s = funded('mg-c');
    const hid = addGestor(s, 40, 5);
    const h = s.pros.hires.find((x) => x.id === hid)!;
    const c1 = trainingCost(s, h);
    const cash = s.ledger.balances.checking;
    const skill0 = managerSkill(h);
    expect(trainPro(s, hid).ok).toBe(true);
    expect(h.pro.quality).toBeGreaterThan(40);
    expect(managerSkill(h)).toBeGreaterThan(skill0);
    expect(s.ledger.balances.checking).toBe(cash - c1);
    expect(trainPro(s, hid).ok).toBe(false);
    simulateDays(s, 91);
    expect(trainingCost(s, h)).toBeGreaterThan(c1);
    expect(trainPro(s, hid).ok).toBe(true);
    expectConsistent(s);
  });

  it('splits y dividendos de las acciones del gestor se reflejan en la cuenta', () => {
    const s = funded('mg-d');
    for (let i = 0; i < 3; i++) advanceDay(s);
    const hid = addGestor(s, 80, 10);
    openMandate(s, hid, usd(50000), 'agresivo');
    advanceDay(s);
    advanceDay(s);
    const m = activeMandates(s)[0];
    const pos = m.positions.find((p) => p.kind === 'stock')!;
    const st = s.stocks.stocks.find((x) => x.id === pos.id)!;
    const v0 = mandateValue(s, m);
    const u0 = pos.units;
    stockTest.split(s, st, 2);
    expect(pos.units).toBe(u0 * 2);
    expect(Math.abs(mandateValue(s, m) - v0)).toBeLessThan(v0 * 0.01);
    expectConsistent(s);
  });
});

describe('Versión 1.1: guardado, mercado y habilidades', () => {
  it('migra una partida v3 a v4 (habilidad nueva, cuentas con gestor) y sigue cuadrando', () => {
    const s = funded('mig-3');
    simulateDays(s, 40);
    const v3 = JSON.parse(JSON.stringify(s));
    v3.version = 3;
    delete v3.managed;
    delete v3.skills.forecasting;
    delete v3.ledger.balances.managed;
    const res = deserialize(serialize(v3, 1));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.migratedFrom).toBe(3);
    expect(res.state.version).toBe(SAVE_VERSION);
    expect(res.state.skills.forecasting.level).toBe(1);
    expect(res.state.managed.mandates).toEqual([]);
    simulateDays(res.state, 60);
    expectConsistent(res.state);
  });

  it('Android: todas las copias van a archivos; en preferencias solo la principal', async () => {
    const files = new MemoryKV();
    const prefs = new MemoryKV();
    prefs.map.set(KEYS.backups[2], 'viejo'); // resto de una versión anterior
    const kv = new NativeKV(files, prefs, [KEYS.primary]);
    const s = funded('kv');
    for (let i = 0; i < 3; i++) {
      simulateDays(s, 31);
      expect((await saveGame(kv, s, 10 + i)).ok).toBe(true);
    }
    expect(files.map.get(KEYS.primary)).toBeTruthy();
    expect(files.map.get(KEYS.backups[0])).toBeTruthy();
    expect(prefs.map.get(KEYS.primary)).toBe(files.map.get(KEYS.primary));
    expect(prefs.map.has(KEYS.backups[0])).toBe(false);
    files.map.delete(KEYS.primary);
    const r = await loadGame(kv);
    expect(r.state?.day).toBe(s.day);
  });

  it('el mercado inmobiliario siempre ofrece opciones de entrada accesibles', () => {
    const s = makeGame('herencia', 're-entry');
    for (let i = 0; i < 4; i++) {
      s.realEstate.listings = [];
      refreshPropertyListings(s);
      expect(s.realEstate.listings.filter((l) => l.askPrice <= usd(90000 * s.macro.priceIndex)).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('la experiencia en bolsa mejora la ejecución (menor costo), sin eliminarlo', () => {
    const s = makeGame('herencia', 'exec');
    const st = s.stocks.stocks[0];
    const q1 = quoteMarket(s, st, 'compra', 500);
    s.skills.stocks.level = 100;
    const q2 = quoteMarket(s, st, 'compra', 500);
    expect(q2.price).toBeLessThan(q1.price);
    expect(q2.price).toBeGreaterThan(st.price);
  });
});
