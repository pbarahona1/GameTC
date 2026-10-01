import type { GameState } from '../state';
import { clamp } from '../money';

/**
 * Puntaje crediticio (300–850), recalculado a partir de datos del historial.
 * Modelo inspirado en los puntajes reales, con pesos documentados:
 *
 * | Componente           | Puntos máx. | Qué mide                                           |
 * |----------------------|------------:|----------------------------------------------------|
 * | Historial de pagos   | 192         | Pagos a tiempo vs atrasos (últimos 24 meses) e impagos |
 * | Utilización          | 165         | Saldo de tarjeta / límite                           |
 * | Antigüedad           | 82          | Meses desde tu primera cuenta de crédito             |
 * | Mezcla de crédito    | 55          | Tener tarjeta y préstamo a plazos bien pagados       |
 * | Consultas recientes  | 55          | Solicitudes de crédito en los últimos 12 meses       |
 */
export interface ScoreBreakdown {
  score: number;
  paymentHistory: number;
  utilization: number;
  utilizationRatio: number;
  age: number;
  mix: number;
  inquiries: number;
  notes: string[];
}

function utilizationFactor(u: number): number {
  const pts: Array<[number, number]> = [[0, 1], [0.1, 1], [0.3, 0.8], [0.5, 0.55], [0.75, 0.3], [0.9, 0.15], [1, 0.05]];
  if (u >= 1) return 0.05;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x0, y0] = pts[i - 1];
    if (u <= x1) return y0 + ((u - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 0.05;
}

export function computeCreditScore(state: GameState): ScoreBreakdown {
  const c = state.credit;
  const notes: string[] = [];
  const recentLates = c.latePayments.filter((d) => state.day - d <= 730).length;
  const thin = c.onTimePayments < 6;
  let phFactor = thin ? 0.55 + c.onTimePayments * 0.05 : 1;
  phFactor -= recentLates * 0.15 + c.defaults * 0.5;
  phFactor = clamp(phFactor, 0, 1);
  if (thin) notes.push('Historial corto: menos de 6 pagos a tiempo registrados.');
  if (recentLates > 0) notes.push(`${recentLates} pago(s) atrasado(s) en los últimos 24 meses.`);
  if (c.defaults > 0) notes.push(`${c.defaults} préstamo(s) en impago.`);

  const card = state.bank.card;
  const bal = state.ledger.balances.credit_card;
  const util = card.active && card.limit > 0 ? bal / card.limit : 0;
  const uFactor = utilizationFactor(util);
  if (util > 0.3) notes.push(`Utilización de tarjeta alta (${Math.round(util * 100)} %). Lo ideal es menos del 30 %.`);

  const ageMonths = (state.day - c.firstAccountDay) / 30.4;
  const ageFactor = clamp(0.3 + ageMonths / 120, 0.3, 1);

  const hasCard = card.active;
  const hasGoodLoan = state.bank.loans.some((l) => l.paymentsMade >= 3 && l.status !== 'default');
  const mixFactor = (hasCard ? 0.5 : 0) + (hasGoodLoan ? 0.5 : 0);

  const recentInq = c.inquiries.filter((d) => state.day - d <= 365).length;
  const inqFactor = clamp(1 - recentInq * 0.2, 0, 1);
  if (recentInq >= 2) notes.push(`${recentInq} solicitudes de crédito en 12 meses.`);

  const paymentHistory = Math.round(192 * phFactor);
  const utilization = Math.round(165 * uFactor);
  const age = Math.round(82 * ageFactor);
  const mix = Math.round(55 * mixFactor);
  const inquiries = Math.round(55 * inqFactor);
  const score = clamp(300 + paymentHistory + utilization + age + mix + inquiries, 300, 850);
  return { score, paymentHistory, utilization, utilizationRatio: util, age, mix, inquiries, notes };
}

export function refreshCreditScore(state: GameState): number {
  const s = computeCreditScore(state).score;
  state.credit.score = s;
  const last = state.credit.history[state.credit.history.length - 1];
  if (!last || last.score !== s || state.day - last.day >= 28) {
    state.credit.history.push({ day: state.day, score: s });
    if (state.credit.history.length > 240) state.credit.history.shift();
  }
  return s;
}

export function recordOnTime(state: GameState): void {
  state.credit.onTimePayments++;
}

export function recordLate(state: GameState): void {
  state.credit.latePayments.push(state.day);
  refreshCreditScore(state);
}

export function recordInquiry(state: GameState): void {
  state.credit.inquiries.push(state.day);
  state.credit.inquiries = state.credit.inquiries.filter((d) => state.day - d <= 730);
  refreshCreditScore(state);
}

export function scoreBand(score: number): { label: string; tone: 'bad' | 'warn' | 'ok' | 'good' } {
  if (score < 580) return { label: 'Deficiente', tone: 'bad' };
  if (score < 670) return { label: 'Regular', tone: 'warn' };
  if (score < 740) return { label: 'Bueno', tone: 'ok' };
  return { label: 'Excelente', tone: 'good' };
}

