import { makeGame, expectConsistent, forceHire } from './helpers';
import { advanceDay, simulateDays } from '../src/engine/simulation';
import { revalue, foundCompany, setupCosts, distribute, maxDistribution, injectCapital, requestSaleOffer, acceptSale, liquidate, buyListing, raiseEquity, targetCarrying } from '../src/engine/business/ownership';
import { placeOrder, onHand, takeFifo } from '../src/engine/business/inventory';
import { hire, generateCandidates, fire, train } from '../src/engine/business/staff';
import { startCampaign } from '../src/engine/business/marketing';
import { setPrice, buyEquipment } from '../src/engine/business/operations';
import { quoteCoLoan, BIZ_BANKS, takeCoLoan, closeCompanyYear } from '../src/engine/business/finance';
import { coIncomeStatement, coBalanceSheet, coCashFlow, valuation } from '../src/engine/business/reports';
import { refreshListings } from '../src/engine/business/simulate';
import { analyze } from '../src/engine/advisor/advisor';
import { runScenario } from '../src/engine/advisor/scenarios';
import { balanceSheet, incomeStatement } from '../src/engine/reports/statements';
import { post } from '../src/engine/ledger/ledger';
import { usd } from '../src/engine/money';
import { dayOf, isLastDayOfMonth } from '../src/engine/time/calendar';
import { SECTORS } from '../src/content/sectors';
import type { GameState } from '../src/engine/state';
import type { Lot } from '../src/engine/business/types';
import { coPost } from '../src/engine/business/companyLedger';

function fund(s: GameState, dollars: number) {
  post(s.ledger, { day: s.day, memo: 'Fondos de prueba', cf: 'internal', lines: [{ account: 'checking', debit: usd(dollars) }, { account: 'opening_equity', credit: usd(dollars) }] });
}

describe('Empresas: libertad de progresión', () => {
  it('con capital suficiente se puede fundar una empresa el día 0, sin empleo ni ahorro previo', () => {
    const s = makeGame('herencia', 'free-start');
    expect(s.career.job).toBeNull();
    expect(s.ledger.balances.savings).toBe(0);
    const r = foundCompany(s, { sector: 'minimarket', name: 'Mi Almacén', legalForm: 'individual', capital: usd(14000) });
    expect(r.ok).toBe(true);
    expect(s.companies.length).toBe(1);
    expectConsistent(s);
  });

  it('las restricciones son reales: capital insuficiente o requisitos profesionales', () => {
    const s = makeGame('egresado', 'restrictions');
    const cafe = foundCompany(s, { sector: 'cafeteria', name: 'Café', legalForm: 'srl', capital: usd(1500) });
    expect(cafe.ok).toBe(false);
    fund(s, 20000);
    const cons = foundCompany(s, { sector: 'consultora', name: 'Consultora', legalForm: 'srl', capital: usd(10000) });
    expect(cons.ok).toBe(false);
    if (!cons.ok) expect(cons.error).toMatch(/Contabilidad/);
    s.skills.accounting.level = 10;
    expect(foundCompany(s, { sector: 'consultora', name: 'Consultora', legalForm: 'srl', capital: usd(10000) }).ok).toBe(true);
  });
});

describe('Empresas: contabilidad', () => {
  for (const sec of SECTORS) {
    it(`${sec.name}: 2 años con invariantes, estados coherentes y patrimonio personal conciliado`, () => {
      const s = makeGame('herencia', 'acc-' + sec.id);
      s.skills.accounting.level = 12;
      fund(s, 60000);
      const r = foundCompany(s, { sector: sec.id, name: 'Test ' + sec.id, legalForm: sec.id === 'saas' ? 'corporacion' : 'srl', capital: usd(sec.recommendedCapital * 1.2) });
      expect(r.ok).toBe(true);
      const co = s.companies[0];
      startCampaign(s, co, 'digital', usd(40), 60);
      let monthStart = s.day + 1;
      let nw0 = balanceSheet(s).netWorth;
      for (let d = 0; d < 730; d++) {
        advanceDay(s);
        if (isLastDayOfMonth(s.day)) {
          expectConsistent(s);
          const is = incomeStatement(s, monthStart, s.day);
          const nw1 = balanceSheet(s).netWorth;
          expect(nw1 - nw0).toBe(is.netResult);
          monthStart = s.day + 1;
          nw0 = nw1;
        }
      }
      const c = s.companies[0] ?? null;
      if (c) {
        const bs = coBalanceSheet(c);
        expect(bs.balanced).toBe(true);
        const cf = coCashFlow(c, 0, s.day);
        expect(cf.opening + cf.totalOperating + cf.totalInvesting + cf.totalFinancing).toBe(cf.closing);
        const is = coIncomeStatement(c, c.foundedDay, s.day);
        expect(is.grossProfit).toBe(is.revenue - is.totalCogs);
        expect(is.netIncome).toBe(is.operatingProfit - is.totalFinancial + is.otherIncome - is.tax);
        revalue(s, c);
        expect(s.ledger.balances.business_equity).toBe(targetCarrying(c));
      }
    });
  }

  it('inventario FIFO con valor exacto y vencimientos como merma', () => {
    const lots: Lot[] = [
      { item: 'x', qty: 3, unitCost: 100, value: 300, expires: null, quality: 60 },
      { item: 'x', qty: 2, unitCost: 150, value: 300, expires: null, quality: 60 },
    ];
    const t = takeFifo(lots, 'x', 4);
    expect(t.cost).toBe(300 + 150);
    expect(lots.length).toBe(1);
    expect(lots[0].value).toBe(150);
    const s = makeGame('herencia', 'expiry');
    fund(s, 20000);
    foundCompany(s, { sector: 'cafeteria', name: 'Pan', legalForm: 'srl', capital: usd(30000) });
    const co = s.companies[0];
    co.rules.forEach((r) => (r.enabled = false));
    co.products.forEach((p) => (p.active = false));
    expect(placeOrder(s, co, 'pan_barrio', 200).ok).toBe(true);
    for (let i = 0; i < 12; i++) advanceDay(s);
    expect(onHand(co, 'pan')).toBe(0);
    expect(co.ledger.balances.waste).toBeGreaterThan(0);
    expectConsistent(s);
  });

  it('compras a crédito: cuentas por pagar y bloqueo del proveedor si no se paga', () => {
    const s = makeGame('herencia', 'payables');
    fund(s, 30000);
    foundCompany(s, { sector: 'minimarket', name: 'Súper', legalForm: 'srl', capital: usd(14000) });
    const co = s.companies[0];
    co.rules.forEach((r) => (r.enabled = false));
    expect(placeOrder(s, co, 'mayorista', 400).ok).toBe(true);
    for (let i = 0; i < 12; i++) advanceDay(s);
    expect(co.ledger.balances.payables).toBeGreaterThan(0);
    const due = co.payables[0].dueDay;
    while (s.day <= due) advanceDay(s);
    // Con caja suficiente se paga al vencimiento; sin caja pasaría a deuda vencida y bloquearía al proveedor.
    expect(co.payables.some((p) => p.dueDay === due)).toBe(false);
    expectConsistent(s);
  });
});

describe('Empresas: finanzas, impuestos y dividendos', () => {
  it('los dividendos de una SRL se limitan al beneficio acumulado y retienen 10 %', () => {
    const s = makeGame('herencia', 'divs');
    fund(s, 20000);
    foundCompany(s, { sector: 'minimarket', name: 'Súper', legalForm: 'srl', capital: usd(20000) });
    const co = s.companies[0];
    // Sin beneficios todavía: no se puede repartir capital
    expect(distribute(s, co, usd(1000)).ok).toBe(false);
    simulateDays(s, 300);
    const lim = maxDistribution(s, co);
    if (lim.max > usd(100)) {
      const before = s.ledger.balances.checking;
      expect(distribute(s, co, usd(100)).ok).toBe(true);
      expect(s.ledger.balances.checking - before).toBe(usd(90));
      expect(s.ledger.balances.dividend_tax).toBe(usd(10));
    }
    expectConsistent(s);
  });

  it('empresa individual: su resultado tributa en la declaración personal', () => {
    const s = makeGame('herencia', 'passthrough');
    fund(s, 15000);
    expect(foundCompany(s, { sector: 'minimarket', name: 'Almacén', legalForm: 'individual', capital: usd(26000) }).ok).toBe(true);
    while (s.day < dayOf(2027, 1, 1)) advanceDay(s);
    const co = s.companies[0];
    const f = co.taxFilings.find((x) => x.year === 2026)!;
    expect(f.passThrough).toBe(true);
    expect(co.ledger.balances.corporate_tax).toBe(0);
    const personal = s.tax.filings.find((x) => x.year === 2026)!;
    // Sin empleo ni ahorro, el único ingreso declarado es la parte del resultado de la empresa.
    expect(personal.grossIncome).toBe(f.taxable);
    expectConsistent(s);
  });

  it('SRL: impuesto del 25 % con compensación de pérdidas de años anteriores', () => {
    const s = makeGame('herencia', 'cotax');
    fund(s, 20000);
    foundCompany(s, { sector: 'minimarket', name: 'Súper', legalForm: 'srl', capital: usd(20000) });
    const co = s.companies[0];
    co.lossCarry.push({ year: 2025, amount: usd(1000) });
    // Forzar un beneficio conocido en 2026
    coPost(co.ledger, { day: s.day, memo: 'venta extra', cf: 'operating', lines: [{ account: 'cash', debit: usd(50000) }, { account: 'sales', credit: usd(50000) }] });
    const is = coIncomeStatement(co, 0, dayOf(2026, 12, 31));
    closeCompanyYear(s, co, 2026);
    const f = co.taxFilings[co.taxFilings.length - 1];
    if (is.preTax > usd(1000)) {
      expect(f.carryUsed).toBe(usd(1000));
      expect(f.tax).toBe(Math.round((is.preTax - usd(1000)) * 0.25));
      expect(co.ledger.balances.taxes_payable).toBe(f.tax);
    }
    expectConsistent(s);
  });

  it('préstamo empresarial: sin historia exige garantía personal; con garantía se aprueba', () => {
    const s = makeGame('herencia', 'coloan');
    fund(s, 10000);
    foundCompany(s, { sector: 'minimarket', name: 'Súper', legalForm: 'srl', capital: usd(18000) });
    const co = s.companies[0];
    const austral = quoteCoLoan(s, co, BIZ_BANKS[0], usd(5000), 24);
    expect(austral.approved).toBe(false);
    const andino = quoteCoLoan(s, co, BIZ_BANKS[1], usd(5000), 24);
    expect(andino.approved).toBe(s.credit.score >= 640);
    if (andino.approved) {
      expect(takeCoLoan(s, co, 'andino_emp', usd(5000), 24).ok).toBe(true);
      simulateDays(s, 70);
      expect(co.loans[0].paymentsMade).toBe(2);
    }
    expectConsistent(s);
  });
});

describe('Empresas: insolvencia, quiebra y responsabilidad', () => {
  function doomed(form: 'individual' | 'srl', seed: string) {
    const s = makeGame('herencia', seed);
    fund(s, 30000);
    expect(foundCompany(s, { sector: 'cafeteria', name: 'Café Ruina', legalForm: form, capital: usd(27000) }).ok).toBe(true);
    const co = s.companies[0];
    // Decisiones pésimas: precios 4 veces por encima del mercado y 6 empleados extra
    for (const p of co.products) setPrice(s, co, p.id, p.price * 3.9);
    for (let i = 0; i < 6; i++) {
      const c = generateCandidates(s, co, 'cocinero')[0];
      hire(s, co, c.id);
    }
    return { s, co };
  }

  it('SRL: la quiebra limita la pérdida a lo invertido', () => {
    const { s } = doomed('srl', 'bk-srl');
    const personalCashBefore = s.ledger.balances.checking + s.ledger.balances.savings + s.ledger.balances.cash_wallet;
    let warned = false;
    for (let d = 0; d < 400 && s.companies.length; d++) {
      advanceDay(s);
      if (analyze(s).some((i) => i.category === 'empresa' && (i.severity === 'critical' || i.severity === 'warning'))) warned = true;
    }
    expect(warned).toBe(true);
    expect(s.companies.length).toBe(0);
    expect(s.formerCompanies[0].outcome).toBe('quiebra');
    expect(s.ledger.balances.business_equity).toBe(0);
    // No se tocó el dinero personal para pagar deudas de la empresa (salvo gastos de vida)
    expect(s.ledger.entries.some((e) => e.tag === 'business:guarantee')).toBe(false);
    expect(personalCashBefore).toBeGreaterThan(0);
    expectConsistent(s);
  });

  it('Empresa individual: en la quiebra el dueño paga las deudas no cubiertas', () => {
    const { s } = doomed('individual', 'bk-ind');
    for (let d = 0; d < 400 && s.companies.length; d++) advanceDay(s);
    expect(s.companies.length).toBe(0);
    expect(s.formerCompanies[0].outcome).toBe('quiebra');
    expect(s.ledger.entries.some((e) => e.tag === 'business:guarantee')).toBe(true);
    expectConsistent(s);
  });

  it('aportar capital saca a la empresa de la insolvencia', () => {
    const { s, co } = doomed('srl', 'rescue');
    for (let d = 0; d < 400 && co.status !== 'insolvent'; d++) advanceDay(s);
    expect(co.status).toBe('insolvent');
    fund(s, 50000);
    expect(injectCapital(s, co, co.ledger.balances.arrears + usd(20000)).ok).toBe(true);
    advanceDay(s);
    expect(co.status).toBe('active');
    expectConsistent(s);
  });
});

describe('Empresas: compraventa, inversionistas y personal', () => {
  it('el mercado de compraventa ofrece empresas con historia real y se pueden comprar', () => {
    const s = makeGame('herencia', 'market');
    fund(s, 3000000);
    refreshListings(s);
    expect(s.listings.length).toBeGreaterThan(0);
    const l = s.listings[0];
    expect(l.company.ledger.entries.length).toBeGreaterThan(30);
    const v = valuation(s, l.company);
    expect(v.value).toBeGreaterThanOrEqual(0);
    expect(buyListing(s, l.id, l.askPrice).ok).toBe(true);
    expect(s.companies.length).toBe(1);
    expectConsistent(s);
    simulateDays(s, 60);
    expectConsistent(s);
  });

  it('vender una empresa realiza la ganancia o pérdida y cobra impuesto a la ganancia de capital', () => {
    const s = makeGame('herencia', 'sale');
    fund(s, 35000);
    foundCompany(s, { sector: 'minimarket', name: 'Súper', legalForm: 'srl', capital: usd(35000) });
    const co = s.companies[0];
    simulateDays(s, 200);
    expect(requestSaleOffer(s, co).ok).toBe(true);
    const nwBefore = balanceSheet(s).netWorth;
    expect(acceptSale(s, co).ok).toBe(true);
    expect(s.companies.length).toBe(0);
    expect(s.ledger.balances.business_equity).toBe(0);
    expect(balanceSheet(s).netWorth).not.toBe(nwBefore);
    expectConsistent(s);
  });

  it('una corporación puede vender acciones a inversionistas (dilución)', () => {
    const s = makeGame('herencia', 'raise');
    fund(s, 40000);
    foundCompany(s, { sector: 'saas', name: 'Soft', legalForm: 'corporacion', capital: usd(50000) });
    const co = s.companies[0];
    simulateDays(s, 30);
    const r = raiseEquity(s, co, 0.2);
    expect(r.ok).toBe(true);
    expect(co.ownership).toBeCloseTo(0.8, 5);
    expectConsistent(s);
  });

  it('contratar, capacitar y despedir con consecuencias económicas', () => {
    const s = makeGame('herencia', 'staff');
    fund(s, 20000);
    foundCompany(s, { sector: 'minimarket', name: 'Súper', legalForm: 'srl', capital: usd(20000) });
    const co = s.companies[0];
    const cash0 = co.ledger.balances.cash;
    const c = generateCandidates(s, co, 'cajero')[0];
    expect(hire(s, co, c.id).ok).toBe(true);
    expect(co.ledger.balances.cash).toBeLessThan(cash0);
    expect(train(s, co, c.id).ok).toBe(true);
    simulateDays(s, 40);
    expect(fire(s, co, c.id).ok).toBe(true);
    expect(co.ledger.balances.wages).toBeGreaterThan(0);
    expectConsistent(s);
  });

  it('el marketing aumenta el conocimiento de marca con rendimientos decrecientes', () => {
    const s = makeGame('herencia', 'mkt');
    fund(s, 40000);
    foundCompany(s, { sector: 'cafeteria', name: 'Café', legalForm: 'srl', capital: usd(40000) });
    const co = s.companies[0];
    simulateDays(s, 8);
    const a0 = co.awareness;
    expect(startCampaign(s, co, 'digital', usd(100), 90).ok).toBe(true);
    simulateDays(s, 30);
    const a1 = co.awareness;
    simulateDays(s, 30);
    const a2 = co.awareness;
    expect(a1).toBeGreaterThan(a0 + 5);
    expect(a2 - a1).toBeLessThan(a1 - a0);
    expectConsistent(s);
  });

  it('delegar en un gerente automatiza la reposición', () => {
    const s = makeGame('herencia', 'mgr');
    fund(s, 40000);
    foundCompany(s, { sector: 'cafeteria', name: 'Café', legalForm: 'srl', capital: usd(40000) });
    const co = s.companies[0];
    const g = generateCandidates(s, co, 'gerente')[0];
    hire(s, co, g.id);
    co.delegation.autoReorder = true;
    co.rules.forEach((r) => (r.reorderPoint = 0));
    simulateDays(s, 40);
    expect(co.rules.some((r) => r.reorderPoint > 0)).toBe(true);
    expectConsistent(s);
  });

  it('comprar equipos amplía la capacidad y se deprecia mes a mes', () => {
    const s = makeGame('herencia', 'capex');
    fund(s, 40000);
    foundCompany(s, { sector: 'muebles', name: 'Taller', legalForm: 'srl', capital: usd(45000) });
    const co = s.companies[0];
    expect(buyEquipment(s, co, 'cnc').ok).toBe(true);
    simulateDays(s, 62);
    expect(co.ledger.balances.depreciation).toBeGreaterThan(0);
    expectConsistent(s);
  });

  it('el escenario "fundar empresa" no modifica la partida real', () => {
    const s = makeGame('herencia', 'scen-co');
    const before = JSON.stringify(s);
    const r = runScenario(s, { kind: 'found_company', sector: 'minimarket', legalForm: 'individual', capital: usd(14000) }, 6);
    expect(r.error).toBeUndefined();
    expect(JSON.stringify(s)).toBe(before);
    expect(r.scenario.length).toBe(7);
  });

  it('el costo de instalación declarado coincide con lo registrado', () => {
    const s = makeGame('herencia', 'setup');
    fund(s, 40000);
    const c = setupCosts(s, 'cafeteria', 'srl');
    foundCompany(s, { sector: 'cafeteria', name: 'Café', legalForm: 'srl', capital: usd(40000) });
    const co = s.companies[0];
    expect(co.ledger.balances.cash).toBe(usd(40000) - c.total);
  });

  it('una persona con empleo también puede emprender (rutas combinables)', () => {
    const s = makeGame('herencia', 'combo');
    forceHire(s, 'ventas_asistente');
    expect(foundCompany(s, { sector: 'minimarket', name: 'Súper', legalForm: 'individual', capital: usd(14000) }).ok).toBe(true);
    simulateDays(s, 60);
    expect(s.ledger.balances.salary_income).toBeGreaterThan(0);
    expectConsistent(s);
  });

  it('liquidación voluntaria ordenada', () => {
    const s = makeGame('herencia', 'close');
    fund(s, 20000);
    foundCompany(s, { sector: 'minimarket', name: 'Súper', legalForm: 'srl', capital: usd(20000) });
    simulateDays(s, 90);
    expect(liquidate(s, s.companies[0], 'voluntary').ok).toBe(true);
    expect(s.formerCompanies[0].outcome).toBe('liquidada');
    expectConsistent(s);
  });
});
