import { deepClone } from './clone';
import type { GameState } from './state';

/**
 * Instantánea liviana para deshacer una acción del jugador o un día de
 * simulación que falló.
 *
 * Copiar el estado completo cuesta ~25 ms en partidas largas. Casi todo el peso
 * está en listas grandes (asientos contables, historiales de precios, registro
 * de actividad, estadísticas diarias). Esas listas NO se copian en profundidad:
 * se guarda una copia superficial (las mismas referencias en un arreglo nuevo),
 * que es barata y sobrevive a que el motor las recorte por delante (`shift`,
 * `splice`) o les agregue elementos al final. Los últimos elementos sí se copian
 * en profundidad, por si el motor actualiza el más reciente en el lugar.
 *
 * Supuesto verificado por pruebas (tests/safety.test.ts): el motor no modifica
 * en el lugar los elementos viejos de estas listas, solo agrega, recorta o
 * reemplaza la lista completa.
 */
type Owner = Record<string, unknown>;
interface Slot {
  path: (root: GameState) => Owner | undefined;
  key: string;
  /** La lista viva (se devuelve al estado original después de copiar el resto). */
  live: unknown[];
  /** Copia superficial de la lista sin su cola. */
  head: unknown[];
  /** Copia profunda de los últimos elementos. */
  tail: unknown[];
}

const MIN = 16;
const TAIL = 2;

function collect(s: GameState): Slot[] {
  const out: Slot[] = [];
  const add = (path: (r: GameState) => unknown, key: string) => {
    const o = path(s) as Owner | undefined;
    const arr = o?.[key];
    if (Array.isArray(arr) && arr.length > MIN) {
      const cut = arr.length - TAIL;
      out.push({ path: path as (r: GameState) => Owner | undefined, key, live: arr, head: arr.slice(0, cut), tail: deepClone(arr.slice(cut)) });
    }
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
  /** Devuelve el estado tal como estaba al tomar la instantánea (un objeto nuevo). */
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
    slots.forEach((sl, i) => (owners[i][sl.key] = sl.live));
  }
  return {
    restore() {
      for (const sl of slots) {
        const target = sl.path(copy);
        if (!target) continue;
        target[sl.key] = sl.head.concat(deepClone(sl.tail));
      }
      return copy;
    },
  };
}
