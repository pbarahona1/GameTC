import type { GameState } from '../state';
import type { Company, Channel, Campaign, Audience } from './types';
import { px, coLog, coPay, countRole, sectorOf } from './common';
import { clamp, Cents } from '../money';
import { ActionResult, FAIL, OK } from '../result';
import { fmtMoney } from '../format';
import { randRange } from '../rng';

export interface ChannelDef {
  id: Channel;
  name: string;
  description: string;
  efficiency: number;
  volatility: number;
  /** Personas alcanzadas por dólar (referencia para alcance). */
  reachPerDollar: number;
  reputationPerDay?: number;
  minDaily: number;
}

export const CHANNELS: ChannelDef[] = [
  { id: 'digital', name: 'Publicidad digital', description: 'Anuncios segmentados. Buena conversión y resultados estables.', efficiency: 1.0, volatility: 0.1, reachPerDollar: 40, minDaily: 10 },
  { id: 'redes', name: 'Redes sociales', description: 'Barata y de alto alcance, pero con resultados muy variables. Con mala calidad puede volverse en contra.', efficiency: 0.9, volatility: 0.6, reachPerDollar: 80, minDaily: 5 },
  { id: 'tradicional', name: 'Campaña tradicional', description: 'Radio, carteles, volantes. Alcance amplio, conversión menor.', efficiency: 0.6, volatility: 0.15, reachPerDollar: 60, minDaily: 30 },
  { id: 'patrocinio', name: 'Patrocinio', description: 'Eventos y equipos locales. Poco conocimiento directo, pero mejora la reputación.', efficiency: 0.35, volatility: 0.1, reachPerDollar: 15, reputationPerDay: 0.06, minDaily: 30 },
  { id: 'contenido', name: 'Marketing de contenidos', description: 'Artículos, videos y guías. Lento pero reduce el olvido de la marca mientras dura.', efficiency: 0.5, volatility: 0.1, reachPerDollar: 25, minDaily: 10 },
  { id: 'promocion', name: 'Promociones', description: 'Descuento del 10 % en todos los precios: +15 % de atractivo, pero menos margen.', efficiency: 0.3, volatility: 0.1, reachPerDollar: 10, minDaily: 0 },
  { id: 'fidelizacion', name: 'Programa de fidelización', description: 'Puntos y beneficios para clientes: +5 % de atractivo y −30 % de cancelaciones.', efficiency: 0.2, volatility: 0.05, reachPerDollar: 5, minDaily: 5 },
];

export const CHANNEL_BY_ID: Record<Channel, ChannelDef> = Object.fromEntries(CHANNELS.map((c) => [c.id, c])) as Record<Channel, ChannelDef>;

export const AUDIENCES: Array<{ id: Audience; name: string }> = [
  { id: 'general', name: 'Público general' },
  { id: 'jovenes', name: 'Jóvenes' },
  { id: 'empresas', name: 'Empresas' },
];

/** Afinidad del público con el sector (multiplica la eficiencia). */
export function audienceFit(co: Company, a: Audience): number {
  const m = sectorOf(co).model;
  const b2b = m === 'manufacturing' || m === 'services' || m === 'subscription';
  if (a === 'empresas') return b2b ? 1.3 : 0.6;
  if (a === 'jovenes') return m === 'food_service' || m === 'subscription' ? 1.15 : 0.85;
  return b2b ? 0.8 : 1.2;
}

export const RESEARCH_COST = 600;
export const RESEARCH_DAYS = 90;

export function activeCampaigns(state: GameState, co: Company): Campaign[] {
  return co.campaigns.filter((c) => c.startDay <= state.day && c.endDay >= state.day);
}

export function promoActive(state: GameState, co: Company): boolean {
  return activeCampaigns(state, co).some((c) => c.channel === 'promocion');
}

export function loyaltyActive(state: GameState, co: Company): boolean {
  return activeCampaigns(state, co).some((c) => c.channel === 'fidelizacion');
}

export function startCampaign(state: GameState, co: Company, channel: Channel, dailyBudget: Cents, days: number, audience: Audience = 'general'): ActionResult {
  const ch = CHANNEL_BY_ID[channel];
  if (!ch) return FAIL('Canal inexistente.');
  if (!(days >= 7 && days <= 180)) return FAIL('La duración debe estar entre 7 y 180 días.');
  if (dailyBudget < px(state, ch.minDaily)) return FAIL(`Presupuesto diario mínimo para ${ch.name}: ${fmtMoney(px(state, ch.minDaily))}.`);
  if (activeCampaigns(state, co).some((c) => c.channel === channel)) return FAIL('Ya hay una campaña activa en ese canal.');
  if (co.ledger.balances.cash < dailyBudget * 7) return FAIL(`La empresa necesita al menos una semana de presupuesto en caja (${fmtMoney(dailyBudget * 7)}).`);
  co.campaigns.push({ id: state.meta.nextId++, channel, audience, reach: 0, dailyBudget, startDay: state.day + 1, endDay: state.day + days, spent: 0, awarenessGained: 0 });
  co.campaigns = co.campaigns.slice(-30);
  return OK(`Campaña "${ch.name}" programada por ${days} días (${fmtMoney(dailyBudget)}/día).`);
}

export function stopCampaign(state: GameState, co: Company, id: number): ActionResult {
  const c = co.campaigns.find((x) => x.id === id);
  if (!c || c.endDay < state.day) return FAIL('La campaña no está activa.');
  c.endDay = state.day;
  return OK('Campaña detenida.');
}

export function buyResearch(state: GameState, co: Company): ActionResult {
  const cost = px(state, RESEARCH_COST);
  if (co.ledger.balances.cash < cost) return FAIL(`El estudio cuesta ${fmtMoney(cost)} y la empresa no tiene esa caja.`);
  coPay(state, co, 'marketing', cost, { memo: 'Estudio de mercado', tag: 'research', allowArrears: false });
  co.research = { day: state.day, validUntil: state.day + RESEARCH_DAYS };
  return OK(`Estudio de mercado disponible por ${RESEARCH_DAYS} días: demanda, elasticidad y datos exactos de la competencia.`);
}

export function hasResearch(state: GameState, co: Company): boolean {
  return !!co.research && co.research.validUntil >= state.day;
}

/**
 * Conocimiento de marca (0–100):
 *  - Se olvida un 1 % por día (0,5 % con marketing de contenidos activo).
 *  - Crece orgánicamente con la reputación (boca a boca).
 *  - Cada campaña suma: eficiencia × afinidad × (gasto/100)^0,6 × (1 − conocimiento/100).
 *    El último factor es la saturación: cuanto más te conocen, menos rinde cada dólar.
 */
export function dailyMarketing(state: GameState, co: Company): void {
  const active = activeCampaigns(state, co);
  const content = active.some((c) => c.channel === 'contenido');
  co.awareness *= content ? 0.995 : 0.99;
  co.awareness += 0.12 * (co.reputation / 100);
  const specialist = 1 + Math.min(0.5, countRole(co, 'marketing') * 0.25);
  for (const c of active) {
    const ch = CHANNEL_BY_ID[c.channel];
    const paid = coPay(state, co, 'marketing', c.dailyBudget, { memo: `Campaña: ${ch.name}`, tag: 'marketing', allowArrears: false });
    if (!paid) {
      c.endDay = state.day - 1;
      coLog(state, co, 'warning', '📣', `la campaña "${ch.name}" se suspendió por falta de caja.`);
      continue;
    }
    c.spent += c.dailyBudget;
    const realDollars = c.dailyBudget / 100 / state.macro.priceIndex;
    c.reach += Math.round(realDollars * ch.reachPerDollar);
    let noise = 1 + randRange(state, -ch.volatility, ch.volatility);
    if (c.channel === 'redes' && co.quality < 40) noise -= 0.5;
    const gain = Math.max(0, ch.efficiency * audienceFit(co, c.audience) * specialist * Math.pow(realDollars / 100, 0.6) * (1 - co.awareness / 100) * noise);
    co.awareness += gain;
    c.awarenessGained += gain;
    if (ch.reputationPerDay) co.reputation = clamp(co.reputation + ch.reputationPerDay, 0, 100);
    if (c.channel === 'redes' && co.quality < 40 && noise < 0.6) co.reputation = clamp(co.reputation - 0.1, 0, 100);
  }
  co.awareness = clamp(co.awareness, 0, 100);
}
