import { makeGame, forceHire, expectConsistent } from './helpers';
import { simulateDays, advanceDay } from '../src/engine/simulation';
import { incomeStatement, balanceSheet, cashFlowStatement } from '../src/engine/reports/statements';
import { transfer, openDeposit } from '../src/engine/finance/banking';
import { quitJob, apply } from '../src/engine/career/career';
import { enroll } from '../src/engine/skills/education';
import { usd } from '../src/engine/money';
import { dayOf } from '../src/engine/time/calendar';
import { runScenario } from '../src/engine/advisor/scenarios';
import { analyze } from '../src/engine/advisor/advisor';
import { SKILL_MAX_LEVEL } from '../src/content/skills';
import { practice } from '../src/engine/skills/skills';

describe('Simulación integrada', () => {
  it('el primer sueldo se prorratea por los días trabajados', () => {
    const s = makeGame();
    while (s.day < dayOf(2026, 1, 16)) advanceDay(s);
    forceHire(s, 'ventas_asistente', 1100); // empieza el 16 de enero
    while (s.day < dayOf(2026, 1, 31)) advanceDay(s);
    // 16 días de 31
    expect(s.ledger.balances.salary_income).toBe(Math.round((110000 * 16) / 31));
    expectConsistent(s);
  });

  it('renunciar a mitad de mes paga solo los días trabajados', () => {
    const s = makeGame();
    forceHire(s, 'adm_recepcion', 1000); // día 0 = 1 ene; empieza el 1
    while (s.day < dayOf(2026, 2, 10)) advanceDay(s);
    quitJob(s);
    // enero completo + 10 días de febrero (28 días)
    expect(s.ledger.balances.salary_income).toBe(100000 + Math.round((100000 * 10) / 28));
    expect(s.career.job).toBeNull();
  });

  it('5 años con empleo, ahorro, depósitos y estudios: la contabilidad cuadra cada mes', () => {
    const s = makeGame('tecnico', 'long-run');
    forceHire(s, 'ventas_ejecutivo');
    enroll(s, 'book_finanzas');
    for (let month = 0; month < 60; month++) {
      for (let d = 0; d < 30; d++) advanceDay(s);
      if (s.ledger.balances.checking > usd(3000)) transfer(s, 'checking', 'savings', usd(500));
      if (s.ledger.balances.savings > usd(4000) && s.bank.deposits.length < 3) openDeposit(s, usd(1500), 6, 'savings');
      if (month % 6 === 0) expectConsistent(s);
    }
    expectConsistent(s);
    expect(s.tax.filings.length).toBeGreaterThanOrEqual(4);
    expect(s.history.length).toBeGreaterThanOrEqual(59);
    expect(balanceSheet(s).equityCheck.balanced).toBe(true);
  });

  it('el dinero no aparece mágicamente: Δ patrimonio = resultado neto del período', () => {
    const s = makeGame('herencia', 'conservation');
    forceHire(s, 'log_operario');
    const nw0 = balanceSheet(s).netWorth;
    const from = s.day + 1;
    simulateDays(s, 400);
    const is = incomeStatement(s, from, s.day);
    expect(balanceSheet(s).netWorth - nw0).toBe(is.netResult);
  });

  it('el flujo de caja concilia saldo inicial + variación = saldo final', () => {
    const s = makeGame('egresado', 'cash');
    forceHire(s, 'ind_operario');
    simulateDays(s, 200);
    const cf = cashFlowStatement(s, 30, s.day);
    expect(cf.opening + cf.totalOperating + cf.totalInvesting + cf.totalFinancing).toBe(cf.closing);
    expect(cf.closing).toBe(balanceSheet(s).liquid);
  });

  it('es determinista: misma semilla y mismas acciones → mismo estado', () => {
    const run = () => {
      const s = makeGame('egresado', 'same');
      apply(s, 'ventas_asistente');
      apply(s, 'log_operario');
      simulateDays(s, 30);
      const offer = s.career.applications.find((a) => a.status === 'offer');
      if (offer) forceHire(s, offer.jobId);
      simulateDays(s, 300);
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });

  it('sin ingresos, el efectivo se agota y los impagos generan atrasos (sin dinero inventado)', () => {
    const s = makeGame('egresado', 'broke');
    simulateDays(s, 150);
    expect(s.ledger.balances.checking + s.ledger.balances.savings).toBeGreaterThanOrEqual(0);
    expect(s.ledger.balances.arrears).toBeGreaterThan(0);
    expect(s.credit.arrearsEvents).toBeGreaterThan(0);
    expectConsistent(s);
    const insights = analyze(s);
    expect(insights.some((i) => i.id === 'arrears' && i.severity === 'critical')).toBe(true);
  });

  it('el asesor calcula la pista de efectivo con datos reales', () => {
    const s = makeGame();
    const ins = analyze(s).find((i) => i.id === 'runway');
    expect(ins).toBeDefined();
    expect(ins!.data.some((d) => d.kind === 'hecho')).toBe(true);
    expect(ins!.data.some((d) => d.kind === 'estimación')).toBe(true);
  });

  it('los escenarios hipotéticos no modifican la partida real', () => {
    const s = makeGame('herencia');
    forceHire(s, 'fin_cajero');
    const before = JSON.stringify(s);
    const r = runScenario(s, { kind: 'quit_job' }, 6);
    expect(JSON.stringify(s)).toBe(before);
    expect(r.scenario.length).toBe(7);
    expect(r.scenario[6].liquid).toBeLessThan(r.baseline[6].liquid);
  });

  it('la práctica repetida el mismo día rinde cada vez menos (anti-grinding)', () => {
    const s = makeGame();
    const g = [1, 2, 3, 4].map(() => practice(s, 'x', 'finEdu', 100));
    expect(g).toEqual([100, 50, 25, 0]);
    expect(SKILL_MAX_LEVEL).toBe(100);
  });

  it('la inflación REALIZADA del año (acumulada mes a mes) indexa los gastos y se declara el impuesto', () => {
    const s = makeGame('herencia', 'infl');
    forceHire(s, 'fin_cajero');
    const rent0 = s.budget.items.find((i) => i.key === 'rent')!.amount;
    const p0 = s.macro.priceIndex;
    while (s.day < dayOf(2026, 12, 31)) advanceDay(s);
    const pDec = s.macro.priceIndex; // el paso de enero de 2027 pertenece al año nuevo
    advanceDay(s);
    const rent1 = s.budget.items.find((i) => i.key === 'rent')!.amount;
    const realized = s.macro.history[s.macro.history.length - 1].inflation;
    expect(realized).toBeCloseTo(pDec / p0 - 1, 3);
    expect(realized).toBeGreaterThan(-0.02);
    expect(realized).toBeLessThan(0.15);
    expect(rent1).toBe(Math.round(rent0 * (1 + realized)));
    expect(s.tax.filings[0].year).toBe(2026);
    expectConsistent(s);
  });
});
