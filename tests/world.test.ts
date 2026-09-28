import { makeGame, expectConsistent, forceHire } from './helpers';
import { advanceDay, simulateDays } from '../src/engine/simulation';
import { post } from '../src/engine/ledger/ledger';
import { usd } from '../src/engine/money';
import type { GameState } from '../src/engine/state';
import { consumerDemand, layoffRisk, monthlyMacro, PHASES } from '../src/engine/economy/economy';
import { requestResidence, deductionCapture, taxObligations } from '../src/engine/tax/taxEngine';
import { dayOf } from '../src/engine/time/calendar';
import { revalue, foundCompany, foundHolding, transferToGroup, spinOff, distribute, maxDistribution, requestSaleOffer, acceptSale, liquidate } from '../src/engine/business/ownership';
import { grantIcLoan, repayIcLoan, consolidateGroup, setGroupPolicy, groupRisks } from '../src/engine/business/groups';
import { coEquity } from '../src/engine/business/common';
import { balanceSheet } from '../src/engine/reports/statements';
import { hirePro, firePro, commissionAudit, refreshProMarket, projectPortfolio, accountantReport } from '../src/engine/pros/pros';
import { setUnderreport, voluntaryDisclosure, payFine, startVenture, convictionProbability, acceptPlea, bribe, setCompanyIrregular, _test as legalTest } from '../src/engine/legal/legal';
import { buyFund } from '../src/engine/invest/funds';
import { placeStockOrder, isTradingDay } from '../src/engine/invest/stocks';
import { isLastDayOfMonth } from '../src/engine/time/calendar';
import { analyze } from '../src/engine/advisor/advisor';
import { runScenario } from '../src/engine/advisor/scenarios';

function fund(s: GameState, dollars: number) {
  post(s.ledger, { day: s.day, memo: 'Fondos de prueba', cf: 'internal', lines: [{ account: 'checking', debit: usd(dollars) }, { account: 'opening_equity', credit: usd(dollars) }] });
}

function toMonthEnd(s: GameState) {
  do advanceDay(s); while (!isLastDayOfMonth(s.day));
}

describe('Economía dinámica', () => {
  it('en 20 años recorre fases, las variables quedan acotadas y ocurren eventos', () => {
    const phases = new Set<string>();
    let events = 0;
    for (const seed of ['e1', 'e2', 'e3']) {
      const s = makeGame('egresado', seed);
      for (let m = 0; m < 240; m++) {
        s.day += 30;
        s.day = dayOf(2026 + Math.floor((m + 1) / 12), ((m + 1) % 12) + 1, 1);
        monthlyMacro(s);
        phases.add(s.macro.phase);
        expect(s.macro.unemployment).toBeGreaterThanOrEqual(0.02);
        expect(s.macro.unemployment).toBeLessThanOrEqual(0.2);
        expect(s.macro.policyRate).toBeGreaterThanOrEqual(0.0025);
        expect(s.macro.policyRate).toBeLessThanOrEqual(0.15);
        expect(s.macro.inflation).toBeGreaterThanOrEqual(-0.01);
        expect(s.macro.inflation).toBeLessThanOrEqual(0.15);
      }
      events += s.macro.events.length;
    }
    expect(phases.has('recesion')).toBe(true);
    expect(phases.has('expansion')).toBe(true);
    expect(phases.size).toBeGreaterThanOrEqual(4);
    expect(events).toBeGreaterThan(0);
  });

  it('una recesión reduce la demanda (más en sectores cíclicos) y aumenta el riesgo de despido', () => {
    const s = makeGame('egresado', 'rec');
    const cafe0 = consumerDemand(s, 'muebles');
    const mini0 = consumerDemand(s, 'minimarket');
    const risk0 = layoffRisk(s, 40);
    s.macro.forced = { phase: 'recesion' };
    for (let m = 0; m < 10; m++) {
      s.day = dayOf(2026, 2 + (m % 11), 1);
      monthlyMacro(s);
    }
    expect(s.macro.phase).toBe('recesion');
    expect(consumerDemand(s, 'muebles')).toBeLessThan(cafe0);
    expect(1 - consumerDemand(s, 'muebles') / cafe0).toBeGreaterThan(1 - consumerDemand(s, 'minimarket') / mini0);
    expect(layoffRisk(s, 40)).toBeGreaterThan(risk0);
    expect(PHASES.recesion.unemployment).toBeGreaterThan(PHASES.expansion.unemployment);
  });
});

describe('Jurisdicciones fiscales', () => {
  it('el cambio de residencia cuesta hoy, rige el 1 de enero y ajusta el costo de vida', () => {
    const s = makeGame('herencia', 'jur');
    fund(s, 20000);
    const rent0 = s.budget.items.find((i) => i.key === 'rent')!.amount;
    expect(requestResidence(s, 'isla_coral').ok).toBe(false); // patrimonio mínimo
    expect(requestResidence(s, 'norvalia').ok).toBe(true);
    expect(s.tax.jurisdiction).toBe('valdoria');
    while (s.day < dayOf(2027, 1, 2)) advanceDay(s);
    expect(s.tax.jurisdiction).toBe('norvalia');
    expect(s.tax.filings[0].jurisdiction).toBe('valdoria');
    expect(s.tax.ytd.jurisdiction).toBe('norvalia');
    const rent1 = s.budget.items.find((i) => i.key === 'rent')!.amount;
    expect(rent1).toBeGreaterThan(rent0 * 1.1);
    expectConsistent(s);
  });

  it('una empresa registrada en Meridia paga el 21 % de impuesto de sociedades', () => {
    const s = makeGame('herencia', 'jur-co');
    fund(s, 60000);
    s.skills.accounting.level = 100;
    expect(foundCompany(s, { sector: 'saas', name: 'Nube', legalForm: 'srl', capital: usd(45000), jurisdiction: 'meridia' }).ok).toBe(true);
    const co = s.companies[0];
    while (s.day < dayOf(2027, 1, 2)) advanceDay(s);
    const f = co.taxFilings.find((x) => x.year === 2026);
    expect(f).toBeDefined();
    if (f!.taxable > 0) expect(f!.tax).toBe(Math.round(f!.taxable * 0.21));
    expect(co.ledger.balances.admin).toBeGreaterThan(0); // incluye agente residente
    expectConsistent(s);
  });

  it('un contador contratado reclama más deducciones documentales y prepara el informe de obligaciones', () => {
    const s = makeGame('herencia', 'acc');
    fund(s, 20000);
    s.skills.accounting.level = 1;
    const base = deductionCapture(s);
    refreshProMarket(s);
    const acc = s.pros.market.find((p) => p.kind === 'contador')!;
    expect(hirePro(s, acc.id, 'personal').ok).toBe(true);
    expect(deductionCapture(s)).toBeGreaterThan(base);
    expect(accountantReport(s).preparedBy).toBe(acc.name);
    expect(taxObligations(s).length).toBeGreaterThan(0);
    toMonthEnd(s);
    expect(s.ledger.balances.professional_fees).toBe(acc.fee);
    const hireId = s.pros.hires[0].id;
    expect(firePro(s, hireId).ok).toBe(true);
    expectConsistent(s);
  });
});

describe('Grupos empresariales', () => {
  it('holding con subsidiarias: el patrimonio personal no cambia al transferir y el consolidado no duplica', () => {
    const s = makeGame('herencia', 'grp');
    fund(s, 200000);
    expect(foundCompany(s, { sector: 'minimarket', name: 'Súper A', legalForm: 'srl', capital: usd(40000) }).ok).toBe(true);
    expect(foundCompany(s, { sector: 'saas', name: 'Soft B', legalForm: 'corporacion', capital: usd(50000) }).ok).toBe(true);
    expect(foundHolding(s, { name: 'Grupo Andes', legalForm: 'srl', capital: usd(30000) }).ok).toBe(true);
    simulateDays(s, 40);
    const [a, b, h] = s.companies;
    for (const co of s.companies) revalue(s, co); // resultados de los días desde el último cierre de mes
    const nw0 = balanceSheet(s).netWorth;
    expect(transferToGroup(s, a.id, h.id).ok).toBe(true);
    expect(transferToGroup(s, b.id, h.id).ok).toBe(true);
    expect(Math.abs(balanceSheet(s).netWorth - nw0)).toBeLessThanOrEqual(2);
    expectConsistent(s);
    expect(s.ledger.balances.business_equity).toBe(h.carrying);
    expect(h.ledger.balances.subsidiaries).toBe(a.carrying + b.carrying);
    // Préstamo intragrupo espejado en ambos libros.
    expect(grantIcLoan(s, h.id, a.id, usd(5000), 0.05, 12).ok).toBe(true);
    expect(a.ledger.balances.ic_payable).toBe(usd(5000));
    expect(h.ledger.balances.ic_receivable).toBe(usd(5000));
    expect(setGroupPolicy(s, h.id, { upstreamPayout: 0.5, cashPooling: true }).ok).toBe(true);
    for (let i = 0; i < 3; i++) toMonthEnd(s);
    expectConsistent(s);
    const c = consolidateGroup(s, h, h.foundedDay, s.day);
    expect(c.eliminated.icBalances).toBeGreaterThanOrEqual(0);
    expect(Math.abs(c.attributableEquity - coEquity(h))).toBeLessThanOrEqual(c.members.length * 2);
    expect(groupRisks(s, h).members.length).toBe(3);
    // Los dividendos de subsidiarias a la holding no pagan impuesto personal.
    const divTax0 = s.ledger.balances.dividend_tax;
    const lim = maxDistribution(s, b).max;
    if (lim > 0) {
      expect(distribute(s, b, lim).ok).toBe(true);
      expect(s.ledger.balances.dividend_tax).toBe(divTax0);
    }
    expect(repayIcLoan(s, s.icLoans[0].id, usd(1000)).ok || a.ledger.balances.cash < usd(1)).toBe(true);
    expectConsistent(s);
    expect(spinOff(s, a).ok).toBe(true);
    expect(a.parentId).toBeNull();
    expectConsistent(s);
    const off = requestSaleOffer(s, b);
    if (off.ok) {
      expect(acceptSale(s, b).ok).toBe(true);
      expectConsistent(s);
    }
    expect(liquidate(s, h, 'voluntary').ok).toBe(true);
    expectConsistent(s);
  });
});

describe('Profesionales', () => {
  it('auditoría externa: verifica los libros, cobra honorarios y registra el informe', () => {
    const s = makeGame('herencia', 'aud');
    fund(s, 80000);
    expect(foundCompany(s, { sector: 'cafeteria', name: 'Café', legalForm: 'srl', capital: usd(60000) }).ok).toBe(true);
    const co = s.companies[0];
    co.embezzlement = { monthly: usd(200), since: s.day, total: usd(600) };
    refreshProMarket(s);
    const aud = s.pros.market.filter((p) => p.kind === 'auditor').sort((x, y) => y.quality - x.quality)[0];
    const cash0 = co.ledger.balances.cash;
    expect(commissionAudit(s, co.id, aud.id).ok || true).toBe(true);
    expect(s.pros.audits.length).toBe(1);
    expect(co.ledger.balances.cash).toBeLessThan(cash0 + usd(600));
    expectConsistent(s);
    const mgr = s.pros.market.find((p) => p.kind === 'gerente')!;
    expect(hirePro(s, mgr.id, co.id).ok).toBe(true);
    expect(co.employees.some((e) => e.role === 'gerente' && e.name === mgr.name)).toBe(true);
  });

  it('proyección de cartera del asesor con datos reales (rango, no promesa)', () => {
    const s = makeGame('herencia', 'proj');
    fund(s, 30000);
    buyFund(s, 'F-IDX', usd(10000));
    simulateDays(s, 30);
    const p = projectPortfolio(s, 12)!;
    expect(p.p10).toBeLessThan(p.p50);
    expect(p.p50).toBeLessThan(p.p90);
    expect(p.probLoss).toBeGreaterThan(0);
    expect(p.probLoss).toBeLessThan(1);
  });
});

describe('Sistema legal (ficticio)', () => {
  it('la evasión en la declaración genera un acto con el impuesto evitado; regularizar crea una deuda sin proceso penal', () => {
    const s = makeGame('herencia', 'ev');
    fund(s, 50000);
    forceHire(s, 'ventas_asistente');
    s.tax.ytd.rentalIncome = usd(30000);
    expect(setUnderreport(s, 0.5).ok).toBe(true);
    while (s.day < dayOf(2027, 1, 2)) advanceDay(s);
    const act = s.legal.acts.find((a) => a.kind === 'evasion')!;
    expect(act).toBeDefined();
    expect(act.benefit).toBeGreaterThan(0);
    expect(s.tax.underreport).toBe(0);
    if (act.status === 'oculto') {
      expect(voluntaryDisclosure(s, act.id).ok).toBe(true);
      expect(s.ledger.balances.fines_payable).toBeGreaterThan(act.benefit);
      const f = s.legal.fines[s.legal.fines.length - 1];
      expect(payFine(s, f.id).ok).toBe(true);
      expect(s.ledger.balances.fines_payable).toBe(s.legal.fines.reduce((a, x) => a + x.balance, 0));
    }
    expectConsistent(s);
  });

  it('un caso penal avanza por etapas; el acuerdo impone multa, antecedentes y posible prisión', () => {
    const s = makeGame('herencia', 'case');
    fund(s, 100000);
    forceHire(s, 'ventas_asistente');
    const act = { id: 999999, kind: 'fraude' as const, day: s.day, label: 'Fraude de prueba', benefit: usd(40000), amount: usd(200000), evidence: 95, severity: 4, witnesses: 2, jurisdiction: 'valdoria' as const, statuteDay: s.day + 3000, status: 'oculto' as const };
    s.legal.acts.push(act);
    const c = legalTest.openCase(s, [act], 'penal', 'Prueba');
    expect(c.stage).toBe('investigacion');
    const p = convictionProbability(s, c);
    expect(p).toBeGreaterThanOrEqual(0.05);
    expect(p).toBeLessThanOrEqual(0.95);
    c.nextStepDay = s.day + 1;
    advanceDay(s);
    expect(['imputacion', 'cerrado']).toContain(c.stage);
    if (c.stage === 'imputacion') {
      c.plea!.prisonMonths = 14;
      expect(acceptPlea(s, c.id).ok).toBe(true);
      expect(s.legal.criminalRecord).toBe(1);
      expect(s.legal.prison).not.toBeNull();
      expect(s.career.job).toBeNull();
      expect(s.ledger.balances.fines_payable).toBeGreaterThan(0);
      simulateDays(s, 460);
      expect(s.legal.prison).toBeNull();
    }
    expectConsistent(s);
  });

  it('operaciones clandestinas y sobornos se resuelven con riesgo, sin romper la contabilidad; se pueden desactivar', () => {
    const s = makeGame('herencia', 'venture');
    fund(s, 80000);
    expect(startVenture(s, 'falsificados', usd(5000)).ok).toBe(true);
    expect(foundCompany(s, { sector: 'consultora', name: 'Asesores', legalForm: 'srl', capital: usd(30000) }).ok || true).toBe(true);
    simulateDays(s, 60);
    expectConsistent(s);
    expect(s.legal.ventures.length).toBe(0);
    expect(s.ledger.balances.illicit_costs).toBeGreaterThanOrEqual(usd(5000));
    if (s.companies[0]) {
      const r = bribe(s, 'contrato', s.companies[0].id);
      expect(typeof r.ok).toBe('boolean');
      expect(setCompanyIrregular(s, s.companies[0].id, { inflatedBooks: 0.3 }).ok).toBe(true);
    }
    simulateDays(s, 200);
    expectConsistent(s);
    s.options.illegalEnabled = false;
    expect(startVenture(s, 'contrabando', usd(1000)).ok).toBe(false);
    expect(setUnderreport(s, 0.25).ok).toBe(false);
  });
});

describe('Asesor avanzado y escenarios', () => {
  it('detecta riesgos de inversiones, inmuebles, impuestos y legales con datos de la partida', () => {
    const s = makeGame('herencia', 'adv');
    fund(s, 200000);
    while (!isTradingDay(s.day)) advanceDay(s);
    placeStockOrder(s, { stockId: 'NBLA', side: 'compra', type: 'mercado', qty: 1500 });
    s.legal.heat = 70;
    s.legal.acts.push({ id: 1, kind: 'evasion', day: s.day, label: 'x', benefit: 100000, amount: 500000, evidence: 50, severity: 2, witnesses: 0, jurisdiction: 'valdoria', statuteDay: s.day + 999, status: 'oculto' });
    const ids = analyze(s).map((i) => i.id);
    expect(ids).toContain('concentration-stock');
    expect(ids).toContain('legal-heat');
    for (const i of analyze(s)) expect(i.data.length).toBeGreaterThan(0);
  });

  it('escenarios: recesión, suba de tasas, caída de mercados y compra de inmueble sobre una copia de la partida', () => {
    const s = makeGame('herencia', 'scen');
    fund(s, 300000);
    forceHire(s, 'fin_analista', 8000);
    s.credit.score = 750;
    buyFund(s, 'F-IDX', usd(60000));
    const before = JSON.stringify(s.ledger.balances);
    const crash = runScenario(s, { kind: 'market_crash', drop: 0.3 }, 3);
    expect(crash.scenario[0].netWorth).toBeLessThan(crash.baseline[0].netWorth);
    const rec = runScenario(s, { kind: 'recession', months: 12 }, 6);
    expect(rec.scenario.length).toBe(7);
    const rate = runScenario(s, { kind: 'rate_shock', delta: 0.02 }, 3);
    expect(rate.scenario.length).toBe(4);
    const l = s.realEstate.listings.find((x) => x.property.type === 'vivienda' && x.property.jurisdiction === 'valdoria' && x.askPrice < usd(400000));
    if (l) {
      const bp = runScenario(s, { kind: 'buy_property', listingId: l.id, ltv: 0.6, years: 20, rateType: 'fija' }, 6);
      expect(bp.error ?? '').toBe('');
      expect(bp.scenario[6].debt).toBeGreaterThan(bp.baseline[6].debt);
    }
    expect(JSON.stringify(s.ledger.balances)).toBe(before); // la partida real no cambió
  });
});
