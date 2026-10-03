import type { GameState } from './state';
import { post } from './ledger/ledger';
import { roundCents, usd } from './money';
import { ActionResult, FAIL, OK } from './result';
import { fmtMoney } from './format';
import { addLog } from './log';
import { COURSE_BY_ID } from '../content/courses';
import { tuition, TUITION_PERIOD_DAYS, recordEducationSpend } from './skills/education';
import { payExpense } from './finance/payments';

/**
 * RECOMPENSAS POR VER UN ANUNCIO (opcional, nunca obligatorio).
 *
 * Son ayudas chicas que no rompen la economía: todo pasa por el libro mayor como
 * cualquier otro movimiento. El límite es por DÍA REAL (lo pasa la interfaz como
 * "AAAA-MM-DD"), así el motor sigue siendo determinista y comprobable con pruebas.
 *  - cash:  un bonus igual a una semana de sueldo bruto (o $100 ajustados por
 *           inflación sin empleo). Tributa como "Otros ingresos".
 *  - news:  el próximo análisis de una noticia tiene la mitad de error.
 *  - study: adelanta hasta 3 meses un curso en curso; las matrículas de esos meses
 *           se pagan igual.
 *  - debt:  con 3 anuncios se reduce a la mitad el saldo de un préstamo personal
 *           (tope ajustado por inflación, una sola vez por préstamo). La cuota no
 *           cambia: el préstamo termina antes.
 */
export type AdRewardKind = 'cash' | 'news' | 'study' | 'debt';

export const AD_REWARDS: Record<AdRewardKind, { perDay: number; title: string }> = {
  cash: { perDay: 3, title: 'Bonus de una semana de sueldo' },
  news: { perDay: 3, title: 'Análisis de noticias más preciso' },
  study: { perDay: 1, title: 'Adelantar 3 meses de estudio' },
  debt: { perDay: 3, title: 'Reducir a la mitad un préstamo (3 anuncios)' },
};
export const DEBT_ADS_NEEDED = 3;
/** Tope de la reducción, en dólares a precios iniciales (se ajusta por inflación). */
export const DEBT_CUT_CAP_USD = 10_000;
export const STUDY_SKIP_DAYS = 90;

export interface AdRewardsState {
  date: string;
  used: Partial<Record<AdRewardKind, number>>;
  /** El próximo análisis de noticia usa la mitad del error. */
  newsBoost: boolean;
  /** Anuncios vistos para reducir un préstamo (se acumulan entre días). */
  debtProgress?: { loanId: number; watched: number };
  /** Préstamos que ya se redujeron con anuncios (una vez por préstamo). */
  debtCut?: number[];
}

/** Préstamos personales activos que todavía se pueden reducir con anuncios. */
export function reducibleLoans(state: GameState) {
  const done = state.meta.ads?.debtCut ?? [];
  return state.bank.loans.filter((l) => l.status === 'active' && l.balance > 0 && !done.includes(l.id));
}

/** Cuánto se reduciría el saldo de un préstamo: la mitad, con tope. */
export function debtCutAmount(state: GameState, balance: number): number {
  return Math.min(roundCents(balance / 2), usd(DEBT_CUT_CAP_USD * state.macro.priceIndex));
}

function ads(state: GameState): AdRewardsState {
  state.meta.ads ??= { date: '', used: {}, newsBoost: false };
  return state.meta.ads;
}

export function adRewardsLeft(state: GameState, kind: AdRewardKind, today: string): number {
  const a = state.meta.ads;
  const used = a && a.date === today ? a.used[kind] ?? 0 : 0;
  return Math.max(0, AD_REWARDS[kind].perDay - used);
}

/** Monto del bonus: una semana de sueldo bruto, o $100 (a precios actuales) sin empleo. */
export function cashRewardAmount(state: GameState): number {
  const job = state.career.job;
  return job ? roundCents((job.salary * 12) / 52) : usd(100 * state.macro.priceIndex);
}

/** Cursos que se pueden adelantar (en curso y con más de un día restante). */
export function skippableCourses(state: GameState) {
  return state.education.active.filter((a) => a.endDay - state.day > 1);
}

/**
 * Aplica la recompensa de un anuncio ya visto. Se llama SOLO cuando el SDK de
 * anuncios confirma la recompensa.
 */
export function grantAdReward(state: GameState, kind: AdRewardKind, today: string, opts: { courseId?: string; loanId?: number } = {}): ActionResult {
  if (adRewardsLeft(state, kind, today) <= 0) return FAIL(`Ya usaste las ${AD_REWARDS[kind].perDay} recompensas de hoy. Volvé mañana.`);
  let message: string;
  if (kind === 'cash') {
    const amount = cashRewardAmount(state);
    post(state.ledger, { day: state.day, memo: 'Bonus por ver un anuncio', cf: 'operating', tag: 'ad:bonus', lines: [{ account: 'checking', debit: amount }, { account: 'other_income', credit: amount }] });
    message = `Recibiste ${fmtMoney(amount)} en tu cuenta corriente.`;
  } else if (kind === 'news') {
    if (ads(state).newsBoost) return FAIL('Ya tenés un análisis preciso pendiente: usalo primero.');
    ads(state).newsBoost = true;
    message = 'Tu próximo análisis de una noticia va a tener la mitad del error habitual.';
  } else if (kind === 'debt') {
    const loans = reducibleLoans(state);
    const st = ads(state);
    const loan = loans.find((l) => l.id === opts.loanId) ?? loans.find((l) => l.id === st.debtProgress?.loanId) ?? loans[0];
    if (!loan) return FAIL('No tenés préstamos personales que se puedan reducir.');
    const watched = (st.debtProgress?.loanId === loan.id ? st.debtProgress.watched : 0) + 1;
    if (watched < DEBT_ADS_NEEDED) {
      st.debtProgress = { loanId: loan.id, watched };
      message = `Anuncio ${watched} de ${DEBT_ADS_NEEDED} para reducir tu préstamo.`;
    } else {
      const cut = debtCutAmount(state, loan.balance);
      post(state.ledger, { day: state.day, memo: 'Reducción de préstamo por anuncios', cf: 'internal', tag: 'ad:debt', lines: [{ account: 'personal_loans', debit: cut }, { account: 'other_income', credit: cut }] });
      loan.balance -= cut;
      if (loan.balance === 0) loan.status = 'paid';
      st.debtProgress = undefined;
      st.debtCut = [...(st.debtCut ?? []), loan.id];
      message = `Tu préstamo bajó ${fmtMoney(cut)}: ahora debés ${fmtMoney(loan.balance)}. La cuota es la misma, así que terminás antes.`;
    }
  } else {
    const a = skippableCourses(state).find((x) => x.courseId === opts.courseId) ?? skippableCourses(state)[0];
    if (!a) return FAIL('No tenés un curso en curso para adelantar.');
    const c = COURSE_BY_ID[a.courseId];
    const remaining = a.endDay - state.day;
    const skip = Math.min(STUDY_SKIP_DAYS, remaining - 1);
    // Matrículas de los meses adelantados (cobros que caerían en los días salteados,
    // ver processEducation): se pagan ahora.
    const before = state.day - a.startDay;
    const after = before + skip;
    const periods = c.monthlyTuition ? Math.floor(after / TUITION_PERIOD_DAYS) - Math.floor(before / TUITION_PERIOD_DAYS) : 0;
    if (periods > 0) {
      const t = tuition(state, c) * periods;
      const res = payExpense(state, 'education', t, { memo: `Matrícula adelantada: ${c.name}`, tag: 'education', method: 'checking', allowArrears: false });
      if (!res.ok) return FAIL(`Adelantar ${Math.round(skip / 30)} meses requiere pagar ${fmtMoney(t)} de matrícula.`);
      recordEducationSpend(state, t);
    }
    a.startDay -= skip;
    a.endDay -= skip;
    message = `Adelantaste ${skip} días de ${c.name}.${periods > 0 ? ` Pagaste ${periods} matrícula(s).` : ''}`;
  }
  const st = ads(state);
  if (st.date !== today) {
    st.date = today;
    st.used = {};
  }
  st.used[kind] = (st.used[kind] ?? 0) + 1;
  addLog(state, 'success', '🎁', `Recompensa por anuncio: ${message}`);
  return OK(message);
}

/** Consume el análisis preciso (lo usa analyzeNews). */
export function takeNewsBoost(state: GameState): boolean {
  if (!state.meta.ads?.newsBoost) return false;
  state.meta.ads.newsBoost = false;
  return true;
}
