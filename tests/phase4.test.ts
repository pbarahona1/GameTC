import { describe, it, expect } from 'vitest';
import { makeGame, forceHire, expectConsistent } from './helpers';
import { post } from '../src/engine/ledger/ledger';
import { usd } from '../src/engine/money';
import { TUTORIAL, isMissionDone, missionProgress } from '../src/engine/progression/tutorial';
import { imageScore } from '../src/engine/lifestyle/effects';
import { ITEMS } from '../src/content/shops';
import type { ShopCategory } from '../src/content/shops';
import { planPropertyPurchase, announceMacroEvent } from '../src/engine/world/rivals';
import { analyzeNews, publish } from '../src/engine/world/news';
import { liquidity, spendable, canPayFromChecking } from '../src/engine/finance/payments';
import { ownerCash, buyProperty, realEstateDay } from '../src/engine/realestate/realestate';
import { payArrears } from '../src/engine/finance/budget';
import { placeStockOrder, stocksDay } from '../src/engine/invest/stocks';
import { addLog, logCategory } from '../src/engine/log';
import { pauseCategory } from '../src/ui/store';
import { updateProgression } from '../src/engine/progression/progression';
import type { GameState } from '../src/engine/state';
import { JOBS } from '../src/content/jobs';
import type { EconEvent } from '../src/engine/economy/economy';
import { EVENT_CATALOG } from '../src/engine/economy/economy';

function rich(seed: string, amount = 500000): GameState {
  const s = makeGame('herencia', seed);
  post(s.ledger, { day: 0, memo: 'Capital de prueba', cf: 'internal', lines: [{ account: 'checking', debit: usd(amount) }, { account: 'opening_equity', credit: usd(amount) }] });
  s.credit.score = 760;
  return s;
}

const mission = (id: string) => TUTORIAL.find((t) => t.id === id)!;
const itemOf = (category: ShopCategory) => ITEMS.find((i) => i.category === category)!;
function own(s: GameState, category: ShopCategory) {
  s.possessions.items.push({ uid: s.meta.nextId++, itemId: itemOf(category).id, boughtDay: s.day, price: usd(100), carrying: 0, condition: 100 });
}

describe('Fase 4 · misiones', () => {
  it('una misión registrada queda cumplida aunque después deje de cumplirse (imagen 40)', () => {
    const s = makeGame();
    expect(imageScore(s)).toBeLessThan(40);
    expect(isMissionDone(s, mission('image40'))).toBe(false);
    const before = missionProgress(s).done;
    s.tutorial.completed.push('image40');
    expect(isMissionDone(s, mission('image40'))).toBe(true);
    expect(missionProgress(s).done).toBe(before + 1);
  });

  it('«Vestite para progresar» exige comprar ropa (no cualquier cosa)', () => {
    const s = makeGame();
    const dress = mission('dress');
    expect(dress.done(s)).toBe(false); // la ropa inicial no cuenta
    own(s, 'tecnologia');
    expect(dress.done(s)).toBe(false);
    own(s, 'ropa');
    expect(dress.done(s)).toBe(true);
  });

  it('«Comprá un vehículo» se cumple por la categoría, no por el nombre del artículo', () => {
    const s = makeGame();
    const v = mission('vehicle');
    own(s, 'lujo');
    expect(v.done(s)).toBe(false);
    own(s, 'vehiculos');
    expect(v.done(s)).toBe(true);
  });

  it('inmueble y alquiler cuentan solo inmuebles tuyos o de tus empresas (no Mogul Exchange)', () => {
    const s = makeGame();
    const prop = structuredClone(s.realEstate.listings[0].property);
    prop.owner = { kind: 'mogul', id: 'x' };
    prop.totals.rent = usd(500);
    s.realEstate.properties.push(prop);
    expect(mission('property').done(s)).toBe(false);
    expect(mission('rent').done(s)).toBe(false);
    prop.owner = { kind: 'personal' };
    expect(mission('property').done(s)).toBe(true);
    expect(mission('rent').done(s)).toBe(true);
    prop.totals.rent = 0;
    expect(mission('rent').done(s)).toBe(false);
  });
});

describe('Fase 4 · rumores', () => {
  const PROPERTY_BODY = /^Se publica por \$[\d,]+, por debajo de su tasación\. .+ ya lo habría visitado\.$/;

  it('las compras de inmuebles de rivales también generan candidatos falsos, con el mismo formato', () => {
    const truths = new Set<boolean>();
    let published = 0;
    for (let i = 0; i < 80; i++) {
      const s = makeGame('egresado', `rumor-${i}`);
      // Dos inmuebles baratos disponibles: uno real y otro para el candidato falso.
      for (const l of s.realEstate.listings.slice(0, 3)) {
        l.askPrice = Math.round(l.property.appraisal * 0.9);
        l.expiresDay = s.day + 60;
      }
      const before = s.world.news.length;
      planPropertyPurchase(s);
      for (const n of s.world.news.slice(before)) {
        published++;
        truths.add(n.truth);
        expect(n.kind).toBe('rumor');
        expect(n.topic).toBe('inmuebles');
        expect(n.body).toMatch(PROPERTY_BODY);
        expect(n.resolveDay).toBeGreaterThan(s.day + 7);
      }
    }
    expect(published).toBeGreaterThan(20);
    expect(truths.has(true)).toBe(true);
    expect(truths.has(false)).toBe(true);
  });

  it('el anticipo falso de un evento económico no se distingue del verdadero por su tipo', () => {
    const kinds = new Set<string>();
    const truths = new Set<boolean>();
    for (let i = 0; i < 60; i++) {
      const s = makeGame('egresado', `macro-${i}`);
      const def = EVENT_CATALOG[0];
      const ev: EconEvent = { id: s.meta.nextId++, kind: def.kind, name: def.name, icon: def.icon, description: def.description, startDay: s.day + 30, endDay: s.day + 120, effects: def.effects };
      s.macro.events.push(ev);
      const before = s.world.news.length;
      announceMacroEvent(s, ev);
      for (const n of s.world.news.slice(before)) {
        kinds.add(n.kind);
        truths.add(n.truth);
        expect(n.body).toMatch(/Podría empezar en unas \d+ semanas\.$/);
        if (!n.truth) expect(n.ref?.eventKind).not.toBe(ev.kind);
      }
    }
    expect([...kinds]).toEqual(['anticipo']);
    expect(truths).toEqual(new Set([true, false]));
  });

  it('analizar una noticia no consume el azar del mundo ni el de la partida, y es reproducible', () => {
    const s = makeGame('egresado', 'analisis');
    const n = publish(s, { kind: 'rumor', topic: 'bolsa', icon: '📈', title: 'Prueba', body: 'Prueba', reliability: 0.6, truth: true, resolveDay: s.day + 30 })!;
    const copy = structuredClone(s);
    const worldRng = (s.world as { rng?: number }).rng;
    const gameRng = s.rng;
    expect(analyzeNews(s, n.id).ok).toBe(true);
    expect((s.world as { rng?: number }).rng).toBe(worldRng);
    expect(s.rng).toBe(gameRng);
    expect(analyzeNews(copy, n.id).ok).toBe(true);
    expect(copy.world.news.find((x) => x.id === n.id)!.analysis).toEqual(s.world.news.find((x) => x.id === n.id)!.analysis);
  });
});

describe('Fase 4 · liquidez única', () => {
  function withMoney(checking: number, savings: number, sweep: boolean) {
    const s = makeGame('egresado', 'liq');
    const b = s.ledger.balances;
    // Dejar la cuenta en un punto conocido.
    post(s.ledger, { day: 0, memo: 'ajuste', cf: 'internal', lines: [{ account: 'opening_equity', debit: b.checking + b.savings }, ...(b.checking ? [{ account: 'checking' as const, credit: b.checking }] : []), ...(b.savings ? [{ account: 'savings' as const, credit: b.savings }] : [])] });
    post(s.ledger, { day: 0, memo: 'saldo', cf: 'internal', lines: [{ account: 'checking', debit: usd(checking) }, { account: 'savings', debit: usd(savings) }, { account: 'opening_equity', credit: usd(checking + savings) }] });
    s.bank.overdraftSweep = sweep;
    return s;
  }

  it('lo disponible incluye el ahorro solo con barrido activo, y es lo que usan las compras', () => {
    const on = withMoney(100, 900, true);
    const off = withMoney(100, 900, false);
    expect(spendable(on)).toBe(usd(1000));
    expect(spendable(off)).toBe(usd(100));
    expect(liquidity(off).total).toBe(usd(1000) + off.ledger.balances.cash_wallet);
    expect(ownerCash(on, { kind: 'personal' })).toBe(spendable(on));
    expect(ownerCash(off, { kind: 'personal' })).toBe(spendable(off));
  });

  it('si no alcanza, verificar no mueve dinero del ahorro', () => {
    const s = withMoney(100, 300, true);
    expect(canPayFromChecking(s, usd(1000))).toBe(false);
    expect(s.ledger.balances.savings).toBe(usd(300));
    expect(canPayFromChecking(s, usd(350))).toBe(true);
    expect(s.ledger.balances.checking).toBeGreaterThanOrEqual(usd(350));
    expectConsistent(s);
  });

  it('una orden límite no se acepta contando un ahorro que no se puede usar', () => {
    const s = withMoney(10, 50000, false);
    const st = s.stocks.stocks.find((x) => x.status === 'activa')!;
    const qty = Math.ceil(usd(1000) / st.price);
    const r = placeStockOrder(s, { stockId: st.id, side: 'compra', type: 'limite', qty, limit: st.price });
    expect(r.ok).toBe(false);
    s.bank.overdraftSweep = true;
    expect(placeStockOrder(s, { stockId: st.id, side: 'compra', type: 'limite', qty, limit: st.price }).ok).toBe(true);
  });

  it('pagar atrasos usa el ahorro con barrido, como cualquier otro pago', () => {
    const s = withMoney(0, 1000, true);
    post(s.ledger, { day: 0, memo: 'atraso', cf: 'internal', lines: [{ account: 'utilities', debit: usd(200) }, { account: 'arrears', credit: usd(200) }] });
    expect(payArrears(s, usd(200)).ok).toBe(true);
    expect(s.ledger.balances.arrears).toBe(0);
    expectConsistent(s);
  });
});

describe('Fase 4 · pausa automática por categoría explícita', () => {
  it('la categoría la decide el motor, no el ícono', () => {
    const s = makeGame();
    addLog(s, 'warning', '📋', 'Evaluación anual');
    addLog(s, 'info', '🏆', 'Algo con trofeo');
    addLog(s, 'success', '✨', 'Logro', undefined, 'logros');
    addLog(s, 'danger', '🧾', 'Peligro sin categoría');
    addLog(s, 'danger', '⚖️', 'Juicio', undefined, 'legal');
    const cats = s.log.slice(-5).map(pauseCategory);
    expect(cats).toEqual([null, null, 'logros', 'peligro', 'legal']);
    expect(pauseCategory).toBe(logCategory);
  });

  it('empezar un empleo no es una "oferta", pero el logro del primer sueldo sí es un logro', () => {
    const s = makeGame();
    const before = s.log.length;
    forceHire(s, JOBS[0].id);
    updateProgression(s);
    const fresh = s.log.slice(before);
    const started = fresh.find((l) => l.text.startsWith('Empezaste a trabajar'))!;
    expect(logCategory(started)).toBeNull();
    const ach = fresh.find((l) => l.text.startsWith('Logro desbloqueado: Primer sueldo'))!;
    expect(logCategory(ach)).toBe('logros');
  });

  it('una caída fuerte de una acción que tenés avisa en la categoría "inversiones"', () => {
    const s = rich('caida');
    const st = s.stocks.stocks.find((x) => x.status === 'activa')!;
    s.stocks.holdings[st.id] = { qty: 100, cost: st.price * 100 } as never;
    st.vol = 3; // volatilidad extrema para provocar caídas en pocos días
    let found = null;
    for (let d = 0; d < 60 && !found; d++) {
      s.day++;
      stocksDay(s);
      found = s.log.find((l) => l.text.startsWith('Caída fuerte hoy en tus acciones')) ?? null;
    }
    expect(found).not.toBeNull();
    expect(logCategory(found!)).toBe('inversiones');
  });
});

describe('Fase 4 · hipoteca variable', () => {
  it('cuando la tasa sube, el aviso es una advertencia con la tasa y la cuota anteriores', () => {
    const s = rich('hipo-var', 200000);
    forceHire(s, JOBS[0].id, 6000);
    const l = s.realEstate.listings.filter((x) => x.askPrice > usd(60000) && x.askPrice < usd(150000))[0];
    const r = buyProperty(s, l.id, { owner: { kind: 'personal' }, financing: { bankId: 'bval_hipo', amount: Math.round(l.askPrice * 0.5), years: 20, rateType: 'variable' } });
    expect(r.ok).toBe(true);
    const m = s.realEstate.mortgages[s.realEstate.mortgages.length - 1];
    const oldApr = m.apr;
    const oldPayment = m.payment;
    m.paymentsMade = 12;
    s.macro.policyRate += 0.03;
    s.day = m.nextDueDay;
    const before = s.log.length;
    realEstateDay(s);
    const msg = s.log.slice(before).find((x) => x.text.includes('hipoteca variable'))!;
    expect(m.apr).toBeGreaterThan(oldApr);
    expect(m.payment).toBeGreaterThan(oldPayment);
    expect(msg.kind).toBe('warning');
    expect(msg.text).toContain('subió');
    expectConsistent(s);
  });
});
