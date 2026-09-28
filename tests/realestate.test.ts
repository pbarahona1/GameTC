import { makeGame, expectConsistent, forceHire } from './helpers';
import { simulateDays, advanceDay } from '../src/engine/simulation';
import { post } from '../src/engine/ledger/ledger';
import { usd } from '../src/engine/money';
import type { GameState } from '../src/engine/state';
import { buyProperty, sellProperty, setRent, setUse, renovate, developLand, prepayMortgage, quoteMortgage, propertyReport, inspectListing, marketRent, appraise, refreshPropertyListings, closingCosts } from '../src/engine/realestate/realestate';
import { foundCompany } from '../src/engine/business/ownership';
import { balanceSheet } from '../src/engine/reports/statements';
import type { PropertyListing } from '../src/engine/realestate/types';
import { amortizedPayment } from '../src/engine/finance/loans';

function fund(s: GameState, dollars: number) {
  post(s.ledger, { day: s.day, memo: 'Fondos de prueba', cf: 'internal', lines: [{ account: 'checking', debit: usd(dollars) }, { account: 'opening_equity', credit: usd(dollars) }] });
}

function pick(s: GameState, pred: (l: PropertyListing) => boolean): PropertyListing {
  for (let i = 0; i < 30; i++) {
    const l = s.realEstate.listings.find(pred);
    if (l) return l;
    s.realEstate.listings = [];
    refreshPropertyListings(s);
  }
  throw new Error('No se encontró un inmueble con esas características');
}

describe('Bienes raíces', () => {
  it('compra al contado: gastos de escritura, alquiler cobrado, gastos, impuesto trimestral y tasación a mercado', () => {
    const s = makeGame('herencia', 're-1');
    fund(s, 600000);
    const l = pick(s, (x) => x.property.type === 'vivienda' && x.property.zoneId !== 'costa' && !x.property.lease);
    const cc = closingCosts(s, l.askPrice, l.property.jurisdiction);
    const before = s.ledger.balances.checking;
    const r = buyProperty(s, l.id, { owner: { kind: 'personal' } });
    expect(r.ok).toBe(true);
    expect(before - s.ledger.balances.checking).toBe(l.askPrice + cc.total);
    expect(s.ledger.balances.real_estate).toBe(l.askPrice);
    expectConsistent(s);
    const p = s.realEstate.properties[0];
    setRent(s, p.id, Math.round(marketRent(s, p) * 0.9));
    simulateDays(s, 400);
    expectConsistent(s);
    expect(p.totals.rent).toBeGreaterThan(0);
    expect(p.totals.tax).toBeGreaterThan(0);
    expect(s.ledger.balances.rental_income).toBe(p.totals.rent);
    // La tasación en el balance coincide con el valor de mercado del inmueble.
    expect(s.ledger.balances.real_estate).toBe(p.appraisal);
    const rep = propertyReport(s, p);
    expect(rep.grossYield).toBeGreaterThan(0);
    expect(rep.occupancy).toBeGreaterThan(0);
  });

  it('hipoteca: cuota francesa, intereses, amortización anticipada y venta que cancela la deuda', () => {
    const s = makeGame('herencia', 're-2');
    forceHire(s, 'fin_analista', 7000);
    s.credit.score = 740;
    fund(s, 150000);
    const l = pick(s, (x) => x.property.type === 'vivienda' && x.askPrice < usd(400000) && x.property.jurisdiction === 'valdoria');
    const loan = Math.round(l.askPrice * 0.6);
    const q = quoteMortgage(s, 'bval_hipo', { kind: 'personal' }, l.askPrice, loan, 20, 'fija', 'vivienda', marketRent(s, l.property));
    expect(q.approved).toBe(true);
    expect(q.payment).toBe(amortizedPayment(loan, q.apr, 240));
    expect(buyProperty(s, l.id, { owner: { kind: 'personal' }, financing: { bankId: 'bval_hipo', amount: loan, years: 20, rateType: 'fija' } }).ok).toBe(true);
    expect(s.ledger.balances.mortgages).toBe(loan);
    expectConsistent(s);
    simulateDays(s, 200);
    const m = s.realEstate.mortgages[0];
    expect(m.paymentsMade).toBeGreaterThanOrEqual(6);
    expect(m.balance).toBeLessThan(loan);
    expect(m.interestPaid).toBeGreaterThan(0);
    expect(s.ledger.balances.mortgages).toBe(m.balance);
    expect(prepayMortgage(s, m.id, usd(5000)).ok).toBe(true);
    expectConsistent(s);
    const p = s.realEstate.properties[0];
    const nwBefore = balanceSheet(s).netWorth;
    expect(sellProperty(s, p.id, 'rapida').ok).toBe(true);
    expect(s.ledger.balances.mortgages).toBe(0);
    expect(s.ledger.balances.real_estate).toBe(0);
    // Vender al 92 % de la tasación y pagar comisión reduce el patrimonio en ~11 % del valor.
    expect(balanceSheet(s).netWorth).toBeLessThan(nwBefore);
    expectConsistent(s);
  });

  it('impago de hipoteca: 3 cuotas impagas → ejecución (embargo) con recurso', () => {
    const s = makeGame('herencia', 're-3');
    forceHire(s, 'fin_analista', 9000);
    s.credit.score = 760;
    fund(s, 90000);
    const l = pick(s, (x) => x.property.type === 'vivienda' && x.askPrice < usd(260000) && x.property.jurisdiction === 'valdoria');
    const loan = Math.round(l.askPrice * 0.75);
    expect(buyProperty(s, l.id, { owner: { kind: 'personal' }, financing: { bankId: 'bval_hipo', amount: loan, years: 25, rateType: 'variable' } }).ok).toBe(true);
    // Vaciar las cuentas para forzar el impago.
    const cash = s.ledger.balances.checking + s.ledger.balances.savings;
    post(s.ledger, { day: s.day, memo: 'Gasto de prueba', cf: 'operating', lines: [{ account: 'other_expense', debit: s.ledger.balances.checking }, { account: 'checking', credit: s.ledger.balances.checking }] });
    void cash;
    s.career.job = null;
    s.bank.card.limit = 0;
    let guard = 0;
    while (s.realEstate.properties.length && guard++ < 200) advanceDay(s);
    expect(s.realEstate.properties.length).toBe(0);
    expect(s.realEstate.mortgages[0].status).toBe('ejecutada');
    expect(s.credit.defaults).toBeGreaterThan(0);
    expect(s.ledger.balances.mortgages).toBe(0);
    expectConsistent(s);
  });

  it('una empresa compra su local, deja de pagar alquiler y deprecia el edificio en su libro', () => {
    const s = makeGame('herencia', 're-4');
    fund(s, 700000);
    const fr = foundCompany(s, { sector: 'minimarket', name: 'Almacén', legalForm: 'srl', capital: usd(450000) });
    if (!fr.ok) throw new Error(fr.error);
    const co = s.companies[0];
    simulateDays(s, 10);
    const l = pick(s, (x) => x.property.type === 'local' && !x.property.lease && x.askPrice < usd(380000) && x.property.jurisdiction === 'valdoria');
    const br = buyProperty(s, l.id, { owner: { kind: 'company', id: co.id } });
    if (!br.ok) throw new Error(br.error);
    const p = s.realEstate.properties[0];
    expect(co.ledger.balances.real_estate).toBe(p.carrying);
    expect(setUse(s, p.id, co.id).ok).toBe(true);
    const rentBefore = co.ledger.balances.rent;
    simulateDays(s, 95);
    expect(co.ledger.balances.rent).toBe(rentBefore);
    expect(co.ledger.balances.depreciation).toBeGreaterThan(0);
    expect(p.accumDepreciation).toBeGreaterThan(0);
    expect(co.ledger.balances.real_estate).toBe(p.carrying);
    expectConsistent(s);
    expect(sellProperty(s, p.id, 'rapida').ok).toBe(true);
    expect(co.ledger.balances.real_estate).toBe(0);
    expectConsistent(s);
  });

  it('vivir en una vivienda propia elimina el alquiler del presupuesto; renovar y construir suman al costo', () => {
    const s = makeGame('herencia', 're-5');
    fund(s, 1500000);
    const l = pick(s, (x) => x.property.type === 'vivienda' && x.property.jurisdiction === 'valdoria' && !x.property.lease);
    inspectListing(s, l.id);
    expect(buyProperty(s, l.id, { owner: { kind: 'personal' } }).ok).toBe(true);
    const p = s.realEstate.properties[0];
    expect(setUse(s, p.id, 'jugador').ok).toBe(true);
    expect(s.budget.items.find((i) => i.key === 'rent')!.amount).toBe(0);
    expect(setUse(s, p.id, null).ok).toBe(true);
    expect(s.budget.items.find((i) => i.key === 'rent')!.amount).toBeGreaterThan(0);
    const basis = p.costBasis;
    expect(renovate(s, p.id, 'integral').ok).toBe(true);
    expect(p.costBasis).toBeGreaterThan(basis);
    simulateDays(s, 100);
    expect(p.renovation).toBeNull();
    expect(p.condition).toBeGreaterThan(97);
    expectConsistent(s);
    const land = pick(s, (x) => x.property.type === 'terreno' && x.askPrice < usd(600000) && x.property.jurisdiction === 'valdoria');
    expect(buyProperty(s, land.id, { owner: { kind: 'personal' } }).ok).toBe(true);
    const t = s.realEstate.properties.find((x) => x.type === 'terreno')!;
    const r = developLand(s, t.id, 'vivienda');
    if (r.ok) {
      simulateDays(s, 480);
      expect(t.type).toBe('vivienda');
      expect(t.appraisal).toBeGreaterThan(0);
    }
    expectConsistent(s);
  });

  it('la tasación depende del estado y la categoría', () => {
    const s = makeGame('herencia', 're-6');
    const base = { zoneId: 'norte', type: 'vivienda' as const, m2: 80, grade: 3, condition: 80 };
    expect(appraise(s, { ...base, condition: 40 })).toBeLessThan(appraise(s, base));
    expect(appraise(s, { ...base, grade: 5 })).toBeGreaterThan(appraise(s, base));
  });
});
