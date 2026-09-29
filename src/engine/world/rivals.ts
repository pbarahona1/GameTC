import type { GameState } from '../state';
import type { RivalGroup, RivalIntent, IntentKind, PoachOffer } from './types';
import { SECTORS, SECTOR_BY_ID, BizSectorId } from '../../content/sectors';
import { EVENT_CATALOG, EconEvent, stockSectorDrift } from '../economy/economy';
import { chance, nextRandom, randInt, randNormal, randRange, seedFromString } from '../rng';
import { clamp, Cents, roundCents, usd } from '../money';
import { addLog } from '../log';
import { fmtMoney, fmtPct } from '../format';
import { formatDate } from '../time/calendar';
import { publish, publishCandidate, resolveNews, expireNews, wrng } from './news';
import { difficultyOf } from '../economy/difficulty';
import { ActionResult, FAIL, OK } from '../result';
import { isOpen } from '../business/common';
import { valuation } from '../business/reports';
import type { Company, CompetitorState } from '../business/types';
import type { Stock } from '../invest/types';

/**
 * MERCADO CON VIDA: grupos rivales controlados por la IA.
 *
 * Cada mes, cada grupo evalúa: comprar empresas en venta, comprar inmuebles
 * baratos, abrir un competidor en un sector donde operás, cerrar exclusividades
 * con proveedores (sube el precio para los demás), ofertar por tus empresas
 * rentables y tentar a tus mejores empleados con más sueldo.
 * Casi todo se ANTICIPA con rumores calibrados (ver news.ts): leer y analizar
 * noticias da ventaja real (comprar antes, cambiar de proveedor, subir sueldos).
 * El azar del mundo usa su propio generador, así no altera el resto de la economía.
 */

const RIVAL_DEFS: Array<Omit<RivalGroup, 'capital' | 'moves' | 'holdings'> & { capital: number }> = [
  { id: 'altamira', name: 'Grupo Altamira', icon: '🦅', style: 'agresivo', sectors: ['cafeteria', 'minimarket'], capital: 2_500_000,
    description: 'Cadena gastronómica y de comercios de cercanía. Compra rápido y compite con precios bajos.' },
  { id: 'ferran', name: 'Inversiones Ferrán', icon: '🦊', style: 'oportunista', sectors: ['cafeteria', 'minimarket', 'muebles', 'saas', 'consultora'], capital: 4_000_000,
    description: 'Fondo familiar que busca gangas: empresas baratas e inmuebles por debajo de su valor.' },
  { id: 'nexo', name: 'Corporación Nexo', icon: '🔷', style: 'paciente', sectors: ['saas', 'consultora'], capital: 6_000_000,
    description: 'Conglomerado tecnológico. Paga bien por talento y por empresas con clientes recurrentes.' },
  { id: 'duarte', name: 'Familia Duarte', icon: '🏛️', style: 'paciente', sectors: ['muebles', 'minimarket'], capital: 3_000_000,
    description: 'Industriales tradicionales con muchos inmuebles. Negocian exclusividades con proveedores.' },
];

export function initWorldLife(state: GameState): void {
  const w = state.world;
  w.rng = seedFromString(`${state.seed}|mundo`);
  w.rivals = RIVAL_DEFS.map((d) => ({ ...d, sectors: [...d.sectors], capital: usd(d.capital), moves: [], holdings: [] }));
}

export function rivalById(state: GameState, id: string): RivalGroup | undefined {
  return state.world.rivals.find((r) => r.id === id);
}

function move(state: GameState, r: RivalGroup, text: string, price?: Cents): void {
  r.moves.push({ day: state.day, text, price });
  if (r.moves.length > 20) r.moves.shift();
}

const playerSectors = (state: GameState) => new Set(state.companies.filter((c) => isOpen(c) && c.sector !== 'holding').map((c) => c.sector));

// ------------------------------------------------------------------ economía: anticipos de eventos

/** Programa un evento económico con anticipación y (a veces) lo anticipa en las noticias. */
export function announceMacroEvent(state: GameState, ev: EconEvent): void {
  const lead = ev.startDay - state.day;
  const n = publishCandidate(state, true, () => ({
    kind: 'anticipo', topic: 'economia', icon: ev.icon, title: `Se anticipa: ${ev.name.toLowerCase()}`,
    body: `${ev.description} Podría empezar en unas ${Math.max(1, Math.round(lead / 7))} semanas.`, reliability: 0, truth: true,
    resolveDay: ev.startDay, ref: { eventKind: ev.kind },
  }));
  void n;
  // Candidato falso equivalente: un evento que NO va a ocurrir.
  const pool = EVENT_CATALOG.filter((e) => e.kind !== ev.kind);
  const fake = pool[Math.floor(nextRandom(wrng(state)) * pool.length)];
  const fakeLead = randInt(wrng(state), 20, 50);
  publishCandidate(state, false, () => ({
    kind: 'rumor', topic: 'economia', icon: fake.icon, title: `Se anticipa: ${fake.name.toLowerCase()}`,
    body: `${fake.description} Podría empezar en unas ${Math.round(fakeLead / 7)} semanas.`, reliability: 0, truth: false,
    resolveDay: state.day + fakeLead, ref: { eventKind: fake.kind },
  }));
}

/** Día de inicio de un evento programado: aviso en el registro y cierre de sus anticipos. */
function startEvents(state: GameState): void {
  for (const e of state.macro.events) {
    if (e.startDay !== state.day) continue;
    const months = Math.round((e.endDay - e.startDay) / 30);
    addLog(state, 'warning', e.icon, `${e.name}: ${e.description} (duración estimada: ${months} meses)`);
    for (const n of state.world.news) if (n.status === 'abierta' && n.ref?.eventKind === e.kind) resolveNews(state, n, n.truth, 'Se confirmó.');
    publish(state, { kind: 'hecho', topic: 'economia', icon: e.icon, title: `Comenzó: ${e.name.toLowerCase()}`, body: `${e.description} Duración estimada: ${months} meses.`, reliability: 1, truth: true, resolveDay: null, source: 'Comunicado oficial', sourceTypical: 0.97, ref: { eventKind: e.kind } });
  }
}

// ------------------------------------------------------------------ bolsa: pistas sobre resultados

/**
 * 14 días antes de un balance trimestral, a veces aparece una pista. El componente
 * aleatorio del resultado se sortea en ese momento y se guarda: la pista y el
 * resultado usan el mismo número (la pista acierta la dirección con probabilidad r).
 */
function earningsHints(state: GameState): void {
  for (const s of state.stocks.stocks) {
    if (s.status !== 'activa' || s.nextEarnings - state.day !== 14 || s.earningsNoise !== undefined) continue;
    if (!chance(wrng(state), 0.45)) continue;
    s.earningsNoise = Math.round(randNormal(wrng(state)) * 10000) / 10000;
    const predicted = predictedSurprise(state, s);
    const sign: 1 | -1 = predicted >= 0 ? 1 : -1;
    const r = Math.round(randRange(wrng(state), 0.35, 0.9) * 100) / 100;
    const truth = chance(wrng(state), r);
    const direction = (truth ? sign : -sign) as 1 | -1;
    publish(state, {
      kind: 'rumor', topic: 'bolsa', icon: direction > 0 ? '📈' : '📉',
      title: `${s.id}: se esperan resultados ${direction > 0 ? 'mejores' : 'peores'} de lo previsto`,
      body: `${s.name} presenta su balance trimestral el ${formatDate(s.nextEarnings)}. ${direction > 0 ? 'Fuentes cercanas hablan de ventas firmes y costos controlados.' : 'Se comenta que las ventas se enfriaron y los márgenes cayeron.'}`,
      reliability: r, truth, resolveDay: s.nextEarnings + 1, ref: { stockId: s.id, direction },
    });
  }
}

/** Sorpresa que resultaría hoy con el ruido ya sorteado (misma fórmula que stocks.ts). */
export function predictedSurprise(state: GameState, s: Stock): number {
  const macroEff = (state.macro.gdpGrowth - 0.025) * 2 * s.beta + stockSectorDrift(state, s.sector) / 4;
  return clamp((s.earningsNoise ?? 0) * 0.07 + macroEff * 0.3 + (s.health - 60) / 1500, -0.6, 0.6);
}

/** Al publicarse el balance: la pista se confirma o se desmiente según la sorpresa real. */
export function resolveEarningsHints(state: GameState, stockId: string, surprise: number): void {
  for (const n of state.world.news) {
    if (n.status !== 'abierta' || n.ref?.stockId !== stockId || !n.ref.direction) continue;
    const happened = (surprise >= 0 ? 1 : -1) === n.ref.direction;
    n.truth = happened;
    resolveNews(state, n, happened, happened ? 'Se confirmó en el balance.' : 'El balance mostró lo contrario.');
  }
}

// ------------------------------------------------------------------ intenciones de los rivales

function newIntent(state: GameState, r: RivalGroup, kind: IntentKind, days: [number, number], extra: Partial<RivalIntent>): RivalIntent {
  const it: RivalIntent = { id: state.meta.nextId++, rivalId: r.id, kind, executeDay: state.day + randInt(wrng(state), days[0], days[1]), newsId: null, ...extra };
  state.world.intents.push(it);
  return it;
}

function rivalFor(state: GameState, sector: BizSectorId | null, styles?: RivalGroup['style'][]): RivalGroup | undefined {
  const pool = state.world.rivals.filter((r) => (!sector || r.sectors.includes(sector)) && (!styles || styles.includes(r.style)));
  return pool.length ? pool[Math.floor(nextRandom(wrng(state)) * pool.length)] : undefined;
}

function planBusinessPurchase(state: GameState): void {
  const free = state.listings.filter((l) => !state.world.intents.some((i) => i.listingId === l.id) && l.expiresDay > state.day + 12);
  if (!free.length) return;
  const l = free[Math.floor(nextRandom(wrng(state)) * free.length)];
  const r = rivalFor(state, l.company.sector);
  if (!r || l.askPrice > r.capital * 0.25) return;
  const it = newIntent(state, r, 'comprar_empresa', [10, Math.min(28, l.expiresDay - state.day - 2)], { listingId: l.id });
  const n = publishCandidate(state, true, () => ({
    kind: 'rumor', topic: 'empresas', icon: r.icon, title: `${r.name} negocia comprar ${l.company.name}`,
    body: `Fuentes del sector dicen que ${r.name} ofrecería cerca de ${fmtMoney(l.askPrice, { decimals: false })} por ${l.company.name}. Si te interesa, tendrías que moverte antes.`,
    reliability: 0, truth: true, resolveDay: it.executeDay + 1, ref: { listingId: l.id, rivalId: r.id, sector: l.company.sector },
  }));
  it.newsId = n?.id ?? null;
  // Candidato falso: otra empresa en venta que nadie planea comprar.
  const other = free.filter((x) => x !== l);
  if (other.length) {
    const f = other[Math.floor(nextRandom(wrng(state)) * other.length)];
    const fr = rivalFor(state, f.company.sector) ?? r;
    publishCandidate(state, false, () => ({
      kind: 'rumor', topic: 'empresas', icon: fr.icon, title: `${fr.name} negocia comprar ${f.company.name}`,
      body: `Fuentes del sector dicen que ${fr.name} estaría interesado en ${f.company.name}.`, reliability: 0, truth: false,
      resolveDay: state.day + randInt(wrng(state), 15, 30), ref: { listingId: f.id, rivalId: fr.id, sector: f.company.sector },
    }));
  }
}

function planPropertyPurchase(state: GameState): void {
  const cheap = state.realEstate.listings.filter((l) => l.askPrice <= l.property.appraisal * 0.97 && !state.world.intents.some((i) => i.propertyListingId === l.id) && l.expiresDay > state.day + 10);
  if (!cheap.length) return;
  const l = cheap[Math.floor(nextRandom(wrng(state)) * cheap.length)];
  const r = rivalFor(state, null, ['oportunista', 'paciente']);
  if (!r) return;
  const it = newIntent(state, r, 'comprar_inmueble', [7, Math.min(21, l.expiresDay - state.day - 2)], { propertyListingId: l.id });
  const n = publishCandidate(state, true, () => ({
    kind: 'rumor', topic: 'inmuebles', icon: '🏠', title: `${r.name} quiere comprar ${l.property.name}`,
    body: `Se publica por ${fmtMoney(l.askPrice, { decimals: false })}, por debajo de su tasación. ${r.name} ya lo habría visitado.`,
    reliability: 0, truth: true, resolveDay: it.executeDay + 1, ref: { propertyListingId: l.id, rivalId: r.id },
  }));
  it.newsId = n?.id ?? null;
}

function planCompetitor(state: GameState, sector: BizSectorId): void {
  const r = rivalFor(state, sector, ['agresivo', 'oportunista', 'paciente']);
  if (!r || state.world.intents.some((i) => i.kind === 'abrir_competidor' && i.sector === sector)) return;
  if ((state.markets[sector]?.competitors.filter((c) => c.active).length ?? 0) >= 6) return;
  const it = newIntent(state, r, 'abrir_competidor', [30, 50], { sector });
  const sec = SECTOR_BY_ID[sector];
  const n = publishCandidate(state, true, () => ({
    kind: 'rumor', topic: 'empresas', icon: '🆕', title: `${r.name} planea entrar fuerte en ${sec.name.toLowerCase()}`,
    body: `Estaría por abrir un local grande con precios agresivos. Si pasa, vas a perder clientes: reforzá calidad, marketing o fidelización antes.`,
    reliability: 0, truth: true, resolveDay: it.executeDay + 1, ref: { sector, rivalId: r.id },
  }));
  it.newsId = n?.id ?? null;
  // Candidato falso para otro sector.
  const others = SECTORS.filter((s) => s.id !== sector);
  const fs = others[Math.floor(nextRandom(wrng(state)) * others.length)];
  const fr = rivalFor(state, fs.id) ?? r;
  publishCandidate(state, false, () => ({
    kind: 'rumor', topic: 'empresas', icon: '🆕', title: `${fr.name} planea entrar fuerte en ${fs.name.toLowerCase()}`,
    body: 'Estaría por abrir un local grande con precios agresivos.', reliability: 0, truth: false, resolveDay: state.day + randInt(wrng(state), 30, 50), ref: { sector: fs.id, rivalId: fr.id },
  }));
}

function planExclusivity(state: GameState, sector: BizSectorId): void {
  const sec = SECTOR_BY_ID[sector];
  if (!sec.suppliers.length) return;
  const sup = sec.suppliers[Math.floor(nextRandom(wrng(state)) * sec.suppliers.length)];
  if (state.world.supplierShocks.some((x) => x.supplierId === sup.id && x.untilDay >= state.day) || state.world.intents.some((i) => i.supplierId === sup.id)) return;
  const r = rivalFor(state, sector);
  if (!r) return;
  const it = newIntent(state, r, 'exclusividad', [14, 30], { sector, supplierId: sup.id });
  const n = publishCandidate(state, true, () => ({
    kind: 'rumor', topic: 'proveedores', icon: '📦', title: `${r.name} busca exclusividad con ${sup.name}`,
    body: `Si lo logra, ${sup.name} le daría prioridad y subiría sus precios al resto por varios meses. Podés adelantar compras (si el producto no vence) o probar otro proveedor.`,
    reliability: 0, truth: true, resolveDay: it.executeDay + 1, ref: { sector, rivalId: r.id },
  }));
  it.newsId = n?.id ?? null;
  const others = sec.suppliers.filter((s) => s.id !== sup.id);
  if (others.length) {
    const f = others[Math.floor(nextRandom(wrng(state)) * others.length)];
    publishCandidate(state, false, () => ({
      kind: 'rumor', topic: 'proveedores', icon: '📦', title: `${r.name} busca exclusividad con ${f.name}`,
      body: `Si lo logra, ${f.name} subiría sus precios al resto por varios meses.`, reliability: 0, truth: false, resolveDay: state.day + randInt(wrng(state), 15, 30), ref: { sector, rivalId: r.id },
    }));
  }
}

// ------------------------------------------------------------------ ejecución

function executeIntent(state: GameState, it: RivalIntent): void {
  const r = rivalById(state, it.rivalId);
  const news = it.newsId !== null ? state.world.news.find((n) => n.id === it.newsId) : undefined;
  const finish = (happened: boolean, note: string) => { if (news) { news.truth = happened; resolveNews(state, news, happened, note); } };
  if (!r) return finish(false, '');
  if (it.kind === 'comprar_empresa') {
    const l = state.listings.find((x) => x.id === it.listingId);
    if (!l) return finish(false, 'La empresa ya no estaba en venta.');
    state.listings = state.listings.filter((x) => x !== l);
    r.capital -= l.askPrice;
    r.holdings.push(l.company.name);
    move(state, r, `Compró ${l.company.name}`, l.askPrice);
    const m = state.markets[l.company.sector];
    if (m && m.competitors.filter((c) => c.active).length < 6) {
      const c: CompetitorState = { id: state.meta.nextId++, name: `${l.company.name} (${r.name})`, priceMult: clamp(0.97 - (r.style === 'agresivo' ? 0.05 : 0), 0.7, 1.8), quality: clamp(l.company.quality, 35, 90), reputation: clamp(l.company.reputation, 30, 90), awareness: clamp(l.company.awareness + 10, 20, 90), active: true, enteredDay: state.day };
      m.competitors.push(c);
    }
    publish(state, { kind: 'hecho', topic: 'empresas', icon: r.icon, title: `${r.name} compró ${l.company.name}`, body: `Pagó ${fmtMoney(l.askPrice, { decimals: false })}. Ahora compite en ${SECTOR_BY_ID[l.company.sector].name.toLowerCase()}.`, reliability: 1, truth: true, resolveDay: null, source: 'Diario Económico de Valdoria', sourceTypical: 0.85, ref: { rivalId: r.id, sector: l.company.sector } });
    if (playerSectors(state).has(l.company.sector)) addLog(state, 'warning', r.icon, `${r.name} compró ${l.company.name} y ahora compite con tu empresa en ${SECTOR_BY_ID[l.company.sector].name}.`);
    return finish(true, 'Se concretó.');
  }
  if (it.kind === 'comprar_inmueble') {
    const l = state.realEstate.listings.find((x) => x.id === it.propertyListingId);
    if (!l) return finish(false, 'El inmueble ya no estaba en venta.');
    state.realEstate.listings = state.realEstate.listings.filter((x) => x !== l);
    r.capital -= l.askPrice;
    r.holdings.push(l.property.name);
    move(state, r, `Compró ${l.property.name}`, l.askPrice);
    publish(state, { kind: 'hecho', topic: 'inmuebles', icon: '🏠', title: `${r.name} compró ${l.property.name}`, body: `Por ${fmtMoney(l.askPrice, { decimals: false })}.`, reliability: 1, truth: true, resolveDay: null, source: 'Registro de la propiedad', sourceTypical: 0.97, ref: { rivalId: r.id } });
    return finish(true, 'Se concretó.');
  }
  if (it.kind === 'abrir_competidor' && it.sector) {
    const m = state.markets[it.sector];
    const sec = SECTOR_BY_ID[it.sector];
    if (!m) return finish(false, '');
    const brand = `${sec.name.split(' ')[0]} ${r.name.split(' ').pop()}`;
    // Entra con precios bajos pero todavía poco conocido: su efecto crece mes a mes.
    const c: CompetitorState = { id: state.meta.nextId++, name: brand, priceMult: r.style === 'agresivo' ? 0.9 : 0.96, quality: randRange(wrng(state), 58, 75), reputation: 50, awareness: 35, active: true, enteredDay: state.day };
    m.competitors.push(c);
    r.capital -= usd(150000);
    r.holdings.push(brand);
    move(state, r, `Abrió ${brand}`);
    publish(state, { kind: 'hecho', topic: 'empresas', icon: '🆕', title: `Abrió ${brand}`, body: `${r.name} entró en ${sec.name.toLowerCase()} con precios ${r.style === 'agresivo' ? 'muy bajos' : 'competitivos'} y una fuerte campaña.`, reliability: 1, truth: true, resolveDay: null, source: 'Diario Económico de Valdoria', sourceTypical: 0.85, ref: { rivalId: r.id, sector: it.sector } });
    if (playerSectors(state).has(it.sector)) addLog(state, 'warning', '🆕', `${r.name} abrió ${brand}: nuevo competidor fuerte en ${sec.name}.`);
    return finish(true, 'Se concretó.');
  }
  if (it.kind === 'exclusividad' && it.sector && it.supplierId) {
    const sup = SECTOR_BY_ID[it.sector].suppliers.find((s) => s.id === it.supplierId);
    if (!sup) return finish(false, '');
    const mult = Math.round(randRange(wrng(state), 1.15, 1.35) * 100) / 100;
    const until = state.day + randInt(wrng(state), 90, 180);
    state.world.supplierShocks.push({ id: state.meta.nextId++, rivalId: r.id, sector: it.sector, supplierId: sup.id, mult, fromDay: state.day, untilDay: until });
    move(state, r, `Exclusividad con ${sup.name}`);
    publish(state, { kind: 'hecho', topic: 'proveedores', icon: '📦', title: `${sup.name} firmó exclusividad con ${r.name}`, body: `Sube sus precios ${fmtPct(mult - 1, 0)} para el resto hasta el ${formatDate(until)}.`, reliability: 1, truth: true, resolveDay: null, source: 'Comunicado de la empresa', sourceTypical: 0.97, ref: { rivalId: r.id, sector: it.sector } });
    if (playerSectors(state).has(it.sector)) addLog(state, 'warning', '📦', `${sup.name} ahora prioriza a ${r.name}: sus precios suben ${fmtPct(mult - 1, 0)} hasta el ${formatDate(until)}.`);
    return finish(true, 'Se concretó.');
  }
}

/** Multiplicador de precio de un proveedor por exclusividades de rivales. */
export function supplierShockMult(state: GameState, supplierId: string): number {
  const w = state.world;
  if (!w) return 1;
  let m = 1;
  for (const x of w.supplierShocks) if (x.supplierId === supplierId && x.fromDay <= state.day && x.untilDay >= state.day) m *= x.mult;
  return m;
}

// ------------------------------------------------------------------ ofertas por tus empresas y por tus empleados

function offerForCompany(state: GameState, co: Company): void {
  if (co.saleOffer && co.saleOffer.expires >= state.day) return;
  const recent = co.history.slice(-3).reduce((s, h) => s + h.netIncome, 0);
  if (co.history.length < 3 || recent <= 0) return;
  const r = rivalFor(state, co.sector);
  if (!r) return;
  const v = valuation(state, co).value;
  if (v <= 0 || v > r.capital * 0.4) return;
  const k = r.style === 'agresivo' ? randRange(wrng(state), 1.05, 1.35) : r.style === 'paciente' ? randRange(wrng(state), 0.95, 1.2) : randRange(wrng(state), 0.85, 1.1);
  const price = roundCents(v * k);
  co.saleOffer = { price, expires: state.day + 15, from: r.name };
  move(state, r, `Ofertó por ${co.name}`, price);
  addLog(state, 'info', '💼', `${r.name} ofrece ${fmtMoney(price)} por ${co.name} (${k >= 1 ? '+' : ''}${fmtPct(k - 1, 0)} frente a su valoración). Válida 15 días: aceptala o dejala vencer en Negocios → ${co.name} → Gestión.`);
  state.log[state.log.length - 1].company = co.id;
}

function poachEmployee(state: GameState, co: Company): void {
  if (state.world.poach.some((p) => p.companyId === co.id && p.status === 'abierta')) return;
  const e = [...co.employees].sort((a, b) => b.skill - a.skill)[0];
  if (!e || e.skill < 55) return;
  const r = rivalFor(state, co.sector) ?? rivalFor(state, null, ['agresivo']);
  if (!r) return;
  const wage = roundCents((e.wage * randRange(wrng(state), 1.12, 1.3)) / 1000) * 1000;
  const offer: PoachOffer = { id: state.meta.nextId++, companyId: co.id, employeeId: e.id, employeeName: e.name, rivalId: r.id, wage, expires: state.day + 10, status: 'abierta' };
  state.world.poach.push(offer);
  move(state, r, `Tentó a ${e.name} (${co.name})`);
  addLog(state, 'warning', '🧲', `${r.name} le ofreció a ${e.name} (${co.name}) un sueldo de ${fmtMoney(wage)}. Tenés 10 días para igualarlo o dejarlo ir.`);
  state.log[state.log.length - 1].company = co.id;
}

export function answerPoach(state: GameState, id: number, match: boolean): ActionResult {
  const p = state.world.poach.find((x) => x.id === id);
  if (!p || p.status !== 'abierta') return FAIL('La oferta ya no está vigente.');
  const co = state.companies.find((c) => c.id === p.companyId);
  const e = co?.employees.find((x) => x.id === p.employeeId);
  if (!co || !e) {
    p.status = 'se_fue';
    return FAIL('El empleado ya no trabaja en la empresa.');
  }
  if (match) {
    e.wage = Math.max(e.wage, p.wage);
    e.morale = clamp(e.morale + 8, 0, 100);
    p.status = 'igualada';
    return OK(`${e.name} se queda con un sueldo de ${fmtMoney(e.wage)}.`);
  }
  co.employees = co.employees.filter((x) => x !== e);
  p.status = 'se_fue';
  addLog(state, 'info', '👋', `${e.name} dejó ${co.name} para trabajar en ${rivalById(state, p.rivalId)?.name ?? 'la competencia'}.`);
  state.log[state.log.length - 1].company = co.id;
  return OK(`${e.name} se fue a la competencia.`);
}

function expirePoach(state: GameState): void {
  for (const p of state.world.poach) {
    if (p.status !== 'abierta' || p.expires > state.day) continue;
    const co = state.companies.find((c) => c.id === p.companyId);
    const e = co?.employees.find((x) => x.id === p.employeeId);
    if (!co || !e) {
      p.status = 'se_fue';
      continue;
    }
    if (p.wage > e.wage * 1.15) {
      co.employees = co.employees.filter((x) => x !== e);
      p.status = 'se_fue';
      addLog(state, 'warning', '👋', `${e.name} aceptó la oferta de ${rivalById(state, p.rivalId)?.name ?? 'la competencia'} y dejó ${co.name}.`);
    } else {
      e.morale = clamp(e.morale - 8, 0, 100);
      p.status = 'se_quedo';
      addLog(state, 'info', '🙂', `${e.name} rechazó la oferta de la competencia y se quedó en ${co.name}, aunque algo desmotivado.`);
    }
    state.log[state.log.length - 1].company = co.id;
  }
  if (state.world.poach.length > 30) state.world.poach = state.world.poach.filter((p, i, a) => p.status === 'abierta' || i >= a.length - 20);
}

// ------------------------------------------------------------------ ciclo diario y mensual

export function worldDay(state: GameState): void {
  if (state.meta.projection || !state.world) return;
  startEvents(state);
  earningsHints(state);
  const due = state.world.intents.filter((i) => i.executeDay <= state.day);
  if (due.length) {
    state.world.intents = state.world.intents.filter((i) => i.executeDay > state.day);
    for (const it of due) executeIntent(state, it);
  }
  expirePoach(state);
  expireNews(state);
  state.world.supplierShocks = state.world.supplierShocks.filter((x) => x.untilDay >= state.day - 30);
}

export function worldMonth(state: GameState): void {
  if (state.meta.projection || !state.world) return;
  const intensity = difficultyOf(state).events;
  const g = wrng(state);
  for (const r of state.world.rivals) r.capital = roundCents(r.capital * (1.006 + nextRandom(g) * 0.01));
  if (chance(g, 0.35 * intensity)) planBusinessPurchase(state);
  if (chance(g, 0.3 * intensity)) planPropertyPurchase(state);
  const mine = [...playerSectors(state)];
  for (const sector of mine) {
    if (chance(g, 0.025 * intensity)) planCompetitor(state, sector);
    if (chance(g, 0.04 * intensity)) planExclusivity(state, sector);
  }
  for (const co of state.companies) {
    if (!isOpen(co) || co.npc || co.sector === 'holding') continue;
    if (chance(g, 0.05 * intensity)) offerForCompany(state, co);
    if (co.employees.length && chance(g, 0.08 * intensity)) poachEmployee(state, co);
  }
}
