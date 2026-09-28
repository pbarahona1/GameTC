import { makeGame, expectConsistent, forceHire } from './helpers';
import { advanceDay, simulateDays } from '../src/engine/simulation';
import { post } from '../src/engine/ledger/ledger';
import { usd } from '../src/engine/money';
import type { GameState } from '../src/engine/state';
import { placeStockOrder, placeBracket, cancelOrder, stockById, analystView, isTradingDay, quoteMarket, fairValue } from '../src/engine/invest/stocks';
import { buyBond, sellBond, bondPrice, duration, BOND_FACE } from '../src/engine/invest/bonds';
import { buyFund, sellFund } from '../src/engine/invest/funds';
import { buyMogul, sellMogul, mogulValuation } from '../src/engine/invest/mogul';
import { positions, investmentsValue, revalueInvestments } from '../src/engine/invest/portfolio';
import { balanceSheet, incomeStatement } from '../src/engine/reports/statements';
import { computeAnnualTax } from '../src/engine/tax/incomeTax';
import { VALDORIA, MERIDIA } from '../src/content/jurisdictions';
import { emptyYtd } from '../src/engine/tax/incomeTax';

function fund(s: GameState, dollars: number) {
  post(s.ledger, { day: s.day, memo: 'Fondos de prueba', cf: 'internal', lines: [{ account: 'checking', debit: usd(dollars) }, { account: 'opening_equity', credit: usd(dollars) }] });
}

function toTradingDay(s: GameState) {
  while (!isTradingDay(s.day)) advanceDay(s);
}

describe('Bolsa de valores', () => {
  it('comprar y vender registra costo, comisión, ganancia realizada y no realizada coherentes con el libro mayor', () => {
    const s = makeGame('herencia', 'stocks-1');
    fund(s, 50000);
    toTradingDay(s);
    const nw0 = balanceSheet(s).netWorth;
    const st = stockById(s, 'MRKT')!;
    const q = quoteMarket(s, st, 'compra', 100);
    const r = placeStockOrder(s, { stockId: 'MRKT', side: 'compra', type: 'mercado', qty: 100 });
    expect(r.ok).toBe(true);
    const h = s.stocks.holdings.MRKT;
    expect(h.qty).toBe(100);
    expect(h.cost).toBe(q.gross);
    // Justo después de comprar, el patrimonio baja solo en la comisión y el diferencial frente al precio de mercado.
    revalueInvestments(s);
    const nw1 = balanceSheet(s).netWorth;
    expect(nw0 - nw1).toBeLessThanOrEqual(q.fee + Math.ceil(q.gross * 0.02));
    expectConsistent(s);
    simulateDays(s, 40);
    toTradingDay(s);
    const before = s.ledger.balances.checking;
    const sell = placeStockOrder(s, { stockId: 'MRKT', side: 'venta', type: 'mercado', qty: 100 });
    expect(sell.ok).toBe(true);
    expect(s.stocks.holdings.MRKT).toBeUndefined();
    expect(s.ledger.balances.stocks).toBe(0);
    const t = s.stocks.trades[s.stocks.trades.length - 1];
    expect(s.ledger.balances.checking - before).toBe(t.gross - t.fee);
    // La ganancia realizada del libro = bruto − costo; la ganancia no realizada se revirtió por completo.
    expect(t.realized).toBe(t.gross - q.gross);
    expect(s.ledger.balances.realized_gains).toBe(t.realized);
    expect(s.tax.ytd.gainsShort! + s.tax.ytd.gainsLong!).toBe(t.realized);
    expect(s.ledger.balances.unrealized_gains).toBe(0);
    expectConsistent(s);
  });

  it('las órdenes límite, stop y OCO se ejecutan contra el rango del día y la OCO cancela a su pareja', () => {
    const s = makeGame('herencia', 'stocks-2');
    fund(s, 80000);
    toTradingDay(s);
    const st = stockById(s, 'NBLA')!;
    placeStockOrder(s, { stockId: 'NBLA', side: 'compra', type: 'mercado', qty: 200 });
    const oco = placeBracket(s, 'NBLA', 200, Math.round(st.price * 0.97), Math.round(st.price * 1.03), 90);
    expect(oco.ok).toBe(true);
    const lim = placeStockOrder(s, { stockId: 'VITL', side: 'compra', type: 'limite', qty: 10, limit: Math.round(stockById(s, 'VITL')!.price * 0.99), days: 60 });
    expect(lim.ok).toBe(true);
    let guard = 0;
    while (s.stocks.orders.some((o) => o.status === 'abierta' && o.stockId === 'NBLA') && guard++ < 120) advanceDay(s);
    const pair = s.stocks.orders.filter((o) => o.stockId === 'NBLA' && o.oco);
    const filled = pair.filter((o) => o.status === 'ejecutada');
    expect(filled.length).toBe(1);
    expect(pair.filter((o) => o.status === 'cancelada').length).toBe(1);
    const f = filled[0];
    if (f.type === 'take_profit') expect(f.filledPrice!).toBeGreaterThanOrEqual(f.limit!);
    else expect(f.filledPrice!).toBeLessThanOrEqual(f.stop!);
    expect(s.stocks.holdings.NBLA).toBeUndefined();
    expectConsistent(s);
    const c = cancelOrder(s, lim.ok ? s.stocks.orders.find((o) => o.stockId === 'VITL')!.id : 0);
    expect(typeof c.ok).toBe('boolean');
  });

  it('no permite vender más acciones de las que tenés ni comprar sin fondos', () => {
    const s = makeGame('egresado', 'stocks-3');
    toTradingDay(s);
    expect(placeStockOrder(s, { stockId: 'TELV', side: 'venta', type: 'mercado', qty: 1 }).ok).toBe(false);
    expect(placeStockOrder(s, { stockId: 'VITL', side: 'compra', type: 'mercado', qty: 100000 }).ok).toBe(false);
    expect(placeStockOrder(s, { stockId: 'VITL', side: 'compra', type: 'mercado', qty: 1.5 }).ok).toBe(false);
    expectConsistent(s);
  });

  it('cobra dividendos con retención y los precios se mantienen positivos durante 3 años de mercado', () => {
    const s = makeGame('herencia', 'stocks-4');
    fund(s, 60000);
    forceHire(s, 'ventas_asistente');
    toTradingDay(s);
    for (const id of ['TELV', 'PLZA', 'PTRS']) placeStockOrder(s, { stockId: id, side: 'compra', type: 'mercado', qty: 200 });
    for (let m = 0; m < 36; m++) {
      simulateDays(s, 30);
      for (const st of s.stocks.stocks) {
        expect(st.price).toBeGreaterThan(0);
        expect(st.low).toBeLessThanOrEqual(st.high);
      }
      expectConsistent(s);
    }
    expect(s.stocks.dividendsReceived).toBeGreaterThan(0);
    expect(s.ledger.balances.dividend_income).toBeGreaterThan(0);
    expect(s.ledger.balances.dividend_tax).toBeGreaterThan(0);
    expect(s.stocks.index.history.length).toBeGreaterThan(500);
  });

  it('la estimación del analista mejora con la habilidad pero nunca es exacta', () => {
    const s = makeGame('herencia', 'stocks-5');
    const st = stockById(s, 'CIRQ')!;
    s.skills.prediction.level = 1;
    const low = analystView(s, st);
    s.skills.prediction.level = 100;
    const high = analystView(s, st);
    expect(high.errorPct).toBeLessThan(low.errorPct);
    expect(high.errorPct).toBeGreaterThanOrEqual(0.06);
    expect(high.low).toBeLessThan(high.high);
    expect(fairValue(s, st)).toBeGreaterThan(0);
  });
});

describe('Bonos, fondos y Mogul Exchange', () => {
  it('el precio de un bono cae si suben las tasas (duración) y paga cupones y nominal', () => {
    const s = makeGame('herencia', 'bonds-1');
    fund(s, 40000);
    const b = s.bonds.issues.find((x) => x.issuerKind === 'gobierno' && x.issuer === 'valdoria' && (x.maturityDay - s.day) / 365 > 6)!;
    const p0 = bondPrice(s, b, b.yield);
    const p1 = bondPrice(s, b, b.yield + 0.01);
    expect(p1).toBeLessThan(p0);
    expect(duration(s, b)).toBeGreaterThan(4);
    const short = s.bonds.issues.filter((x) => x.status === 'vigente').sort((a, c) => a.maturityDay - c.maturityDay)[0];
    expect(buyBond(s, short.id, 5).ok).toBe(true);
    expect(buyBond(s, b.id, 3).ok).toBe(true);
    expect(sellBond(s, b.id, 1).ok).toBe(true);
    const days = short.maturityDay - s.day + 2;
    simulateDays(s, days);
    expect(s.bonds.holdings[short.id]).toBeUndefined();
    expect(s.ledger.balances.bond_interest).toBeGreaterThan(0);
    expect(s.tax.ytd.bondInterest! + (s.tax.filings.slice(-1)[0]?.grossIncome ?? 0)).toBeGreaterThan(0);
    // El nominal devuelto se registró (vía venta al nominal).
    expect(s.stocks.trades.some((t) => t.market === 'bonos' && t.side === 'venta' && t.price === BOND_FACE)).toBe(true);
    expectConsistent(s);
  });

  it('fondos: suscripción, rescate y repartos trimestrales cuadran con el libro', () => {
    const s = makeGame('herencia', 'funds-1');
    fund(s, 30000);
    expect(buyFund(s, 'F-IDX', usd(5000)).ok).toBe(true);
    expect(buyFund(s, 'F-BON', usd(5000)).ok).toBe(true);
    expect(buyFund(s, 'F-REIT', usd(3000)).ok).toBe(true);
    expect(s.ledger.balances.brokerage_fees).toBe(usd(30)); // 1 % de entrada del REIT
    expect(buyFund(s, 'F-MON', usd(10)).ok).toBe(false); // mínimo
    simulateDays(s, 200);
    expectConsistent(s);
    expect(s.funds.distributionsReceived).toBeGreaterThan(0);
    const h = s.funds.holdings['F-IDX'];
    expect(sellFund(s, 'F-IDX', h.qty / 2).ok).toBe(true);
    expect(sellFund(s, 'F-IDX', s.funds.holdings['F-IDX'].qty).ok).toBe(true);
    expect(s.funds.holdings['F-IDX']).toBeUndefined();
    expectConsistent(s);
  });

  it('Mogul Exchange: compra fraccionada, distribuciones reales, valoración y venta con diferencial', () => {
    const s = makeGame('herencia', 'mogul-1');
    fund(s, 60000);
    const assets = s.mogul.assets.filter((a) => a.status === 'activo');
    expect(assets.length).toBeGreaterThanOrEqual(4);
    for (const a of assets) {
      expect(a.nav).toBeGreaterThan(0);
      const v = mogulValuation(s, a);
      expect(v.inputs.length).toBeGreaterThan(2);
    }
    const building = assets.find((a) => a.kind === 'inmueble')!;
    const units = Math.floor(usd(8000) / building.nav);
    expect(buyMogul(s, building.id, units).ok).toBe(true);
    expect(buyMogul(s, building.id, building.units).ok).toBe(false); // límite del 49 %
    simulateDays(s, 95);
    expect(s.mogul.distributionsReceived).toBeGreaterThan(0);
    expectConsistent(s);
    expect(sellMogul(s, building.id, units).ok).toBe(true);
    expect(s.mogul.holdings[building.id]).toBeUndefined();
    expectConsistent(s);
  });

  it('valuación a mercado: el patrimonio refleja el valor de la cartera', () => {
    const s = makeGame('herencia', 'mtm');
    fund(s, 40000);
    toTradingDay(s);
    placeStockOrder(s, { stockId: 'ACRV', side: 'compra', type: 'mercado', qty: 300 });
    buyFund(s, 'F-TEC', usd(4000));
    simulateDays(s, 60);
    const value = investmentsValue(s);
    const ledger = s.ledger.balances.stocks + s.ledger.balances.funds + s.ledger.balances.bonds + s.ledger.balances.mogul;
    expect(ledger).toBe(value);
    const cost = [...positions(s, 'stocks'), ...positions(s, 'funds')].reduce((a, p) => a + p.cost, 0);
    expect(s.ledger.balances.unrealized_gains).toBe(value - cost);
    const is = incomeStatement(s, 0, s.day);
    expect(is.income.some((l) => l.account === 'unrealized_gains') || value === cost).toBe(true);
  });
});

describe('Impuestos a las inversiones por jurisdicción', () => {
  it('ganancias de corto y largo plazo, comisiones y arrastre de pérdidas', () => {
    const ytd = { ...emptyYtd(2026), gainsShort: usd(10000), gainsLong: usd(20000), investFees: usd(500) };
    const v = computeAnnualTax(VALDORIA, ytd);
    expect(v.capitalGainsTax).toBe(Math.round((usd(9500) + usd(20000)) * 0.15));
    const m = computeAnnualTax(MERIDIA, ytd);
    expect(m.capitalGainsTax).toBe(Math.round(usd(9500) * 0.22 + usd(20000) * 0.1));
    const withCarry = computeAnnualTax(VALDORIA, ytd, { lossCarry: usd(9500), deductionCapture: 1, underreport: 0 });
    expect(withCarry.lossCarryUsed).toBe(usd(9500));
    expect(withCarry.capitalGainsTax).toBe(Math.round(usd(20000) * 0.15));
    const loss = computeAnnualTax(VALDORIA, { ...emptyYtd(2026), gainsShort: -usd(3000) });
    expect(loss.capitalGainsTax).toBe(0);
    expect(loss.lossCarryCreated).toBe(usd(3000));
  });
});
