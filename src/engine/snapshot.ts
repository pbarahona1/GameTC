import { deepClone } from './clone';
import type { GameState } from './state';

/**
 * Instantánea liviana para deshacer una acción del jugador si falla (Fase 5).
 *
 * Copiar el estado completo en cada toque costaba decenas de milisegundos en
 * partidas largas. Casi todo el peso está en listas que SOLO crecen por el
 * final (asientos contables, historiales de precios, registro de actividad).
 * Esas listas se separan antes de copiar y se conservan por referencia junto
 * con su largo; si la acción falla, se devuelven a la copia recortadas a su
 * largo original. Las rutas se calculan sobre el estado ANTES de la acción,
 * que es la misma estructura que tiene la copia.
 */
type Owner = Record<string, unknown>;
interface Slot {
  path: (root: GameState) => Owner | undefined;
  key: string;
  arr: unknown[];
  len: number;
}

const MIN = 16;

function collect(s: GameState): Slot[] {
  const out: Slot[] = [];
  const add = (path: (r: GameState) => unknown, key: string) => {
    const o = path(s) as Owner | undefined;
    const arr = o?.[key];
    if (Array.isArray(arr) && arr.length > MIN) out.push({ path: path as (r: GameState) => Owner | undefined, key, arr, len: arr.length });
  };
  add((r) => r.ledger, 'entries');
  add((r) => r, 'log');
  add((r) => r, 'history');
  s.companies.forEach((_, i) => {
    add((r) => r.companies[i]?.ledger, 'entries');
    add((r) => r.companies[i], 'stats');
  });
  (s.listings ?? []).forEach((_, i) => add((r) => r.listings[i]?.company.ledger, 'entries'));
  (s.mogul?.assets ?? []).forEach((a, i) => {
    add((r) => r.mogul.assets[i], 'history');
    if (a.company) add((r) => r.mogul.assets[i]?.company?.ledger, 'entries');
  });
  (s.stocks?.stocks ?? []).forEach((_, i) => {
    add((r) => r.stocks.stocks[i], 'history');
    add((r) => r.stocks.stocks[i], 'weekly');
  });
  add((r) => r.stocks?.index, 'history');
  (s.bonds?.issues ?? []).forEach((_, i) => add((r) => r.bonds.issues[i], 'history'));
  (s.funds?.funds ?? []).forEach((_, i) => add((r) => r.funds.funds[i], 'history'));
  (s.realEstate?.zones ?? []).forEach((_, i) => add((r) => r.realEstate.zones[i], 'history'));
  add((r) => r.macro, 'monthly');
  return out;
}

export interface Snapshot {
  /** Devuelve el estado tal como estaba al tomar la instantánea. */
  restore(): GameState;
}

export function takeSnapshot(s: GameState): Snapshot {
  const slots = collect(s);
  const owners = slots.map((sl) => sl.path(s)!);
  slots.forEach((sl, i) => (owners[i][sl.key] = []));
  let copy: GameState;
  try {
    copy = deepClone(s);
  } finally {
    slots.forEach((sl, i) => (owners[i][sl.key] = sl.arr));
  }
  return {
    restore() {
      for (const sl of slots) {
        const target = sl.path(copy);
        if (!target) continue;
        // Solo se agregaron elementos al final: se recortan al largo original.
        target[sl.key] = sl.arr.slice(0, sl.len);
      }
      return copy;
    },
  };
}
