import type { GameState } from '../state';
import { ITEM_BY_ID, ItemDef, ItemEffects, SLOTS, TIER_IMAGE_REQ, TIER_VIP_DISCOUNT, StoreTier } from '../../content/shops';
import { CARD_TIER_BY_ID } from '../../content/cards';
import type { OwnedItem } from './types';

/**
 * Efectos de lo que tenés y de cómo te vestís. Módulo sin dependencias pesadas:
 * lo usan carrera, educación, atributos, presupuesto y tiendas.
 */

export function ownedItems(state: GameState): OwnedItem[] {
  return state.possessions?.items ?? [];
}

export function itemDef(o: OwnedItem): ItemDef {
  return ITEM_BY_ID[o.itemId];
}

/** Puntos de estilo que aporta una prenda según su estado. */
export function wornStyle(o: OwnedItem): number {
  const d = itemDef(o);
  if (!d) return 0;
  return d.durable ? d.style : o.condition >= 40 ? d.style : d.style * 0.5;
}

export function bestVehicle(state: GameState): OwnedItem | null {
  let best: OwnedItem | null = null;
  for (const o of ownedItems(state)) {
    const d = itemDef(o);
    if (d?.category === 'vehiculos' && (!best || d.style > itemDef(best).style)) best = o;
  }
  return best;
}

export interface ImageBreakdown {
  outfit: number;
  accessories: number;
  vehicle: number;
  reputation: number;
  total: number;
}

/** Imagen personal 0–100: ropa puesta + reloj/accesorio + vehículo + reputación. */
export function imageBreakdown(state: GameState): ImageBreakdown {
  const p = state.possessions;
  let outfit = 0;
  let accessories = 0;
  if (p) {
    for (const slot of SLOTS) {
      const uid = p.outfit[slot];
      const o = uid !== undefined ? p.items.find((x) => x.uid === uid) : undefined;
      if (!o) continue;
      if (slot === 'reloj' || slot === 'accesorio') accessories += wornStyle(o);
      else outfit += wornStyle(o);
    }
  }
  const v = bestVehicle(state);
  const vehicle = v ? itemDef(v).style : 0;
  const reputation = Math.min(8, state.player.attributes.reputation / 12.5);
  const total = Math.max(0, Math.min(100, Math.round(outfit + accessories + vehicle + reputation)));
  return { outfit: Math.round(outfit), accessories: Math.round(accessories), vehicle, reputation: Math.round(reputation), total };
}

export function imageScore(state: GameState): number {
  return imageBreakdown(state).total;
}

export function imageLabel(v: number): string {
  if (v >= 80) return 'Impecable';
  if (v >= 60) return 'Distinguida';
  if (v >= 40) return 'Elegante';
  if (v >= 25) return 'Prolija';
  if (v >= 12) return 'Correcta';
  return 'Descuidada';
}

/** Imagen que se espera en una entrevista según el nivel del puesto (1–5). */
export const JOB_IMAGE_EXPECTED = [0, 5, 15, 25, 38, 50];

/** Cambio de probabilidad en una postulación por tu imagen (±6 puntos). */
export function imageJobBonus(state: GameState, jobLevel: number): number {
  const delta = imageScore(state) - (JOB_IMAGE_EXPECTED[jobLevel] ?? 20);
  return Math.max(-24, Math.min(24, delta)) * 0.0025;
}

/** Cambio de probabilidad al negociar (±3 puntos). */
export function imageNegotiationBonus(state: GameState): number {
  return Math.max(-20, Math.min(30, imageScore(state) - 30)) * 0.001;
}

// ------------------------------------------------------------------ trato en tiendas

export type Treatment = 'preferente' | 'normal' | 'frio';

/** Imagen que ven en la tienda: tu imagen + el reconocimiento de tu tarjeta. */
export function storeImage(state: GameState): number {
  const tier = state.bank.card.tier ?? 'clasica';
  return imageScore(state) + (state.bank.card.active ? CARD_TIER_BY_ID[tier].storeImage : 0);
}

export function treatment(state: GameState, tier: StoreTier): Treatment {
  const img = storeImage(state);
  const req = TIER_IMAGE_REQ[tier];
  if (img >= req + 20) return 'preferente';
  if (img >= req) return 'normal';
  return 'frio';
}

export function storeDiscount(state: GameState, tier: StoreTier): number {
  return treatment(state, tier) === 'preferente' ? TIER_VIP_DISCOUNT[tier] : 0;
}

// ------------------------------------------------------------------ efectos por mes

/** Suma de efectos mensuales de lo que tenés (estrés, salud, red) y mejores efectos no acumulables. */
export function possessionEffects(state: GameState): Required<Pick<ItemEffects, 'stress' | 'health' | 'network' | 'study' | 'food'>> {
  const out = { stress: 0, health: 0, network: 0, study: 0, food: 0 };
  const seen = new Set<string>();
  for (const o of ownedItems(state)) {
    const d = itemDef(o);
    if (!d?.effects || seen.has(d.id)) continue;
    seen.add(d.id);
    const e = d.effects;
    // Solo cuenta el mejor vehículo para estrés y salud (no manejás dos autos a la vez).
    if (d.category === 'vehiculos' && bestVehicle(state)?.uid !== o.uid) continue;
    out.stress += e.stress ?? 0;
    out.health += e.health ?? 0;
    out.network += e.network ?? 0;
    out.study = Math.max(out.study, e.study ?? 0);
    out.food = Math.max(out.food, e.food ?? 0);
  }
  return out;
}

/** Fracción del transporte público que reemplaza tu vehículo y su costo mensual propio (USD base). */
export function vehicleTransport(state: GameState): { share: number; running: number; name: string } | null {
  const v = bestVehicle(state);
  if (!v) return null;
  const d = itemDef(v);
  return { share: d.id === 'bici_urbana' ? 0.5 : 1, running: d.effects?.running ?? 0, name: d.name };
}
