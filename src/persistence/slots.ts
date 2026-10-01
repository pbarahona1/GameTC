import type { KV } from './save';
import { LEGACY_SLOT, slotKeys, deserializeHeader } from './save';

/**
 * Varias partidas en el mismo dispositivo.
 *
 * Cada partida (ranura) tiene sus propias claves (`slotKeys`). La primera usa
 * las claves históricas ("main"), así una versión anterior del juego —por
 * ejemplo, si una actualización vuelve atrás— sigue encontrando la partida.
 * El índice de partidas se guarda en dos claves para sobrevivir a que una se dañe.
 */
export const MAX_SLOTS = 3;
const REGISTRY_KEYS = ['urt.slots', 'urt.slots.bak'];

export interface SlotMeta {
  id: string;
  /** Nombre del personaje. */
  name: string;
  /** Día de juego del último guardado. */
  day: number;
  /** Patrimonio neto en centavos del último guardado (si se conoce). */
  netWorth: number | null;
  /** Fecha real del último guardado (ms). */
  savedAt: number;
  createdAt: number;
}

export interface SlotRegistry {
  version: 1;
  active: string | null;
  slots: SlotMeta[];
}

function valid(x: unknown): x is SlotRegistry {
  const r = x as SlotRegistry;
  return !!r && r.version === 1 && Array.isArray(r.slots) && r.slots.every((s) => s && typeof s.id === 'string' && /^[a-z0-9]{1,24}$/.test(s.id)) && (r.active === null || typeof r.active === 'string');
}

/** Lee el índice; si no existe (instalación anterior a 1.3), lo arma a partir de la partida histórica. */
export async function readRegistry(kv: KV): Promise<SlotRegistry> {
  // Un error del almacenamiento (no poder leer) se propaga: no es lo mismo que "no hay partidas".
  for (const key of REGISTRY_KEYS) {
    const raw = await kv.get(key);
    if (!raw) continue;
    try {
      const r = JSON.parse(raw) as unknown;
      if (valid(r)) return r;
    } catch {
      /* índice dañado: se prueba la otra copia */
    }
  }
  const legacy = slotKeys(LEGACY_SLOT);
  let header: ReturnType<typeof deserializeHeader> = null;
  let any = false;
  for (const key of [legacy.primary, legacy.temp, ...legacy.backups, legacy.preupdate]) {
    const raw = await kv.get(key);
    if (!raw) continue;
    any = true;
    const h = deserializeHeader(raw);
    if (h && (!header || h.savedAt > header.savedAt)) header = h;
  }
  if (!any) return { version: 1, active: null, slots: [] };
  return {
    version: 1,
    active: LEGACY_SLOT,
    slots: [{ id: LEGACY_SLOT, name: header?.name ?? 'Partida', day: header?.day ?? 0, netWorth: header?.netWorth ?? null, savedAt: header?.savedAt ?? 0, createdAt: header?.savedAt ?? 0 }],
  };
}

export async function writeRegistry(kv: KV, r: SlotRegistry): Promise<void> {
  const text = JSON.stringify(r);
  for (const key of REGISTRY_KEYS) await kv.set(key, text);
}

/** Id para una partida nueva: la histórica si está libre, si no uno corto y único. */
export function newSlotId(r: SlotRegistry, now: number): string {
  if (!r.slots.some((s) => s.id === LEGACY_SLOT)) return LEGACY_SLOT;
  let id = now.toString(36).slice(-8);
  while (r.slots.some((s) => s.id === id)) id = (parseInt(id, 36) + 1).toString(36);
  return id;
}

export function upsertSlot(r: SlotRegistry, meta: SlotMeta): SlotRegistry {
  const others = r.slots.filter((s) => s.id !== meta.id);
  return { ...r, slots: [...others, meta].sort((a, b) => a.createdAt - b.createdAt) };
}

export function removeSlot(r: SlotRegistry, id: string): SlotRegistry {
  return { ...r, active: r.active === id ? null : r.active, slots: r.slots.filter((s) => s.id !== id) };
}
