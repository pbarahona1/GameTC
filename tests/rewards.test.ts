import { describe, it, expect } from 'vitest';
import { makeGame, forceHire, expectConsistent } from './helpers';
import { advanceDay } from '../src/engine/simulation';
import { post } from '../src/engine/ledger/ledger';
import { usd } from '../src/engine/money';
import { grantAdReward, adRewardsLeft, cashRewardAmount, AD_REWARDS, STUDY_SKIP_DAYS } from '../src/engine/rewards';
import { enroll, tuition } from '../src/engine/skills/education';
import { analyzeNews, estimateError } from '../src/engine/world/news';
import { COURSE_BY_ID } from '../src/content/courses';
import { JOBS } from '../src/content/jobs';

const rich = (seed: string) => {
  const s = makeGame('herencia', seed);
  post(s.ledger, { day: 0, memo: 'Capital', cf: 'internal', lines: [{ account: 'checking', debit: usd(50000) }, { account: 'opening_equity', credit: usd(50000) }] });
  return s;
};

describe('Recompensas por anuncio', () => {
  it('el bonus es una semana de sueldo, pasa por el libro mayor y tiene límite por día real', () => {
    const s = rich('ad-cash');
    forceHire(s, JOBS[0].id);
    const before = s.ledger.balances.checking;
    const amount = cashRewardAmount(s);
    expect(amount).toBe(Math.round((s.career.job!.salary * 12) / 52));
    for (let i = 0; i < AD_REWARDS.cash.perDay; i++) expect(grantAdReward(s, 'cash', '2026-10-02').ok).toBe(true);
    expect(s.ledger.balances.checking - before).toBe(amount * AD_REWARDS.cash.perDay);
    expect(adRewardsLeft(s, 'cash', '2026-10-02')).toBe(0);
    expect(grantAdReward(s, 'cash', '2026-10-02').ok).toBe(false);
    // Otro día real: se renueva.
    expect(adRewardsLeft(s, 'cash', '2026-10-03')).toBe(AD_REWARDS.cash.perDay);
    expect(grantAdReward(s, 'cash', '2026-10-03').ok).toBe(true);
    expectConsistent(s);
  });

  it('el análisis preciso reduce a la mitad el error de UN análisis y no se acumula', () => {
    const s = rich('ad-news');
    for (let d = 0; d < 400 && !s.world.news.some((n) => n.status === 'abierta' && n.kind !== 'hecho' && n.kind !== 'oficial'); d++) advanceDay(s);
    const n = s.world.news.find((x) => x.status === 'abierta' && x.kind !== 'hecho' && x.kind !== 'oficial')!;
    expect(n).toBeTruthy();
    expect(grantAdReward(s, 'news', '2026-10-02').ok).toBe(true);
    expect(grantAdReward(s, 'news', '2026-10-02').ok).toBe(false);
    const r = analyzeNews(s, n.id);
    expect(r.ok && r.message).toMatch(/análisis preciso/);
    expect(s.meta.ads?.newsBoost).toBe(false);
    // Con la mitad del error, la estimación cae dentro de ±3 errores típicos reducidos.
    expect(Math.abs(n.analysis!.estimate - n.reliability)).toBeLessThanOrEqual(estimateError(n.analysis!.skill) * 0.5 * 4 + 0.01);
  });

  it('adelantar estudio corre el curso hasta 3 meses y cobra las matrículas de esos meses', () => {
    const s = rich('ad-study');
    s.education.level = 'secundaria';
    const c = COURSE_BY_ID['tec_informatica'];
    const r0 = enroll(s, c.id);
    expect(r0.ok, r0.ok ? '' : r0.error).toBe(true);
    for (let d = 0; d < 10; d++) advanceDay(s);
    const a = s.education.active[0];
    const end = a.endDay;
    const checking = s.ledger.balances.checking + s.ledger.balances.savings;
    expect(grantAdReward(s, 'study', '2026-10-02', { courseId: c.id }).ok).toBe(true);
    expect(a.endDay).toBe(end - STUDY_SKIP_DAYS);
    // Elapsed 10 → 100: matrículas de los días 30, 60 y 90.
    expect(checking - (s.ledger.balances.checking + s.ledger.balances.savings)).toBe(tuition(s, c) * 3);
    expect(grantAdReward(s, 'study', '2026-10-02', { courseId: c.id }).ok).toBe(false); // 1 por día
    advanceDay(s);
    expectConsistent(s);
  });

  it('sin cursos en curso no hay nada que adelantar', () => {
    const s = rich('ad-nostudy');
    expect(grantAdReward(s, 'study', '2026-10-02').ok).toBe(false);
    expect(adRewardsLeft(s, 'study', '2026-10-02')).toBe(1);
  });
});

describe('Recompensa: reducir un préstamo con 3 anuncios', () => {
  it('con el tercer anuncio el saldo baja a la mitad por el libro mayor, una sola vez por préstamo', async () => {
    const { takeLoan } = await import('../src/engine/finance/loans');
    const { BANKS } = await import('../src/content/banks');
    const { reducibleLoans, debtCutAmount, DEBT_ADS_NEEDED } = await import('../src/engine/rewards');
    const s = rich('ad-debt');
    forceHire(s, JOBS[0].id);
    s.credit.score = 760;
    let ok = false;
    for (const b of BANKS) if (!ok) ok = takeLoan(s, b.id, usd(4000), 24).ok;
    expect(ok).toBe(true);
    const loan = s.bank.loans[s.bank.loans.length - 1];
    const before = loan.balance;
    for (let i = 1; i < DEBT_ADS_NEEDED; i++) {
      expect(grantAdReward(s, 'debt', '2026-10-02', { loanId: loan.id }).ok).toBe(true);
      expect(loan.balance).toBe(before);
    }
    const cut = debtCutAmount(s, before);
    expect(grantAdReward(s, 'debt', '2026-10-02', { loanId: loan.id }).ok).toBe(true);
    expect(loan.balance).toBe(before - cut);
    expect(cut).toBe(Math.round(before / 2));
    expect(s.ledger.balances.personal_loans).toBe(s.bank.loans.filter((l) => l.status === 'active').reduce((a, l) => a + l.balance, 0));
    expect(reducibleLoans(s).some((l) => l.id === loan.id)).toBe(false);
    expectConsistent(s);
  });

  it('la reducción tiene tope y se renueva el cupo al otro día real', async () => {
    const { debtCutAmount, DEBT_CUT_CAP_USD } = await import('../src/engine/rewards');
    const s = rich('ad-debt-cap');
    expect(debtCutAmount(s, usd(1_000_000))).toBe(usd(DEBT_CUT_CAP_USD * s.macro.priceIndex));
    expect(adRewardsLeft(s, 'debt', '2026-10-05')).toBe(AD_REWARDS.debt.perDay);
  });
});
