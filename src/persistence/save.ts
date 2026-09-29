import type { GameState } from '../engine/state';
import { SAVE_VERSION } from '../engine/state';
import { checkInvariants } from '../engine/invariants';
import { migrate, validateShape } from './migrations';

/**
 * Guardado robusto:
 *  - Sobre con formato, versión, fecha real, día de juego y checksum FNV-1a del contenido.
 *  - Escritura en dos pasos: primero a una ranura temporal, luego a la principal.
 *    Si la app se cierra a mitad de guardado, la temporal o la anterior siguen intactas.
 *  - 3 copias de seguridad rotativas, separadas por al menos 30 días de juego.
 *  - Al cargar: checksum → migración → forma → invariantes contables.
 *    Si algo falla se prueba la siguiente copia.
 *  - Nunca se guarda un estado que viole los invariantes contables.
 */
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const KEYS = {
  primary: 'urt.save.primary',
  temp: 'urt.save.tmp',
  backups: ['urt.save.bak1', 'urt.save.bak2', 'urt.save.bak3'],
  /** Copia hecha justo antes de instalar una actualización (por si hay que volver atrás). */
  preupdate: 'urt.save.preupdate',
};

export const BACKUP_SPACING_DAYS = 30;

export interface Envelope {
  format: 'urt-save';
  version: number;
  savedAt: number;
  day: number;
  name: string;
  /** Suma de verificación del JSON del estado SIN comprimir. */
  checksum: string;
  payload: string;
  /** 'gzip-b64': el payload es el JSON comprimido con gzip y codificado en base64. */
  encoding?: 'gzip-b64';
}

// ------------------------------------------------------------ Compresión (gzip nativo, sin dependencias)

export function canCompress(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function gzipText(text: string): Promise<string> {
  return bytesToB64(await pipe(new TextEncoder().encode(text), new CompressionStream('gzip')));
}

export async function gunzipText(b64: string): Promise<string> {
  return new TextDecoder().decode(await pipe(b64ToBytes(b64), new DecompressionStream('gzip')));
}

/** Guardado comprimido (si la plataforma lo permite). El checksum se calcula sobre el JSON original. */
export async function serializeCompact(state: GameState, now: number): Promise<string> {
  if (!canCompress()) return serialize(state, now);
  const payload = JSON.stringify(state);
  const env: Envelope = { format: 'urt-save', version: SAVE_VERSION, savedAt: now, day: state.day, name: state.player.name, checksum: fnv1a(payload), payload: await gzipText(payload), encoding: 'gzip-b64' };
  return JSON.stringify(env);
}

/** Abre un sobre comprimido o plano y lo devuelve como texto plano verificable por `deserialize`. */
export async function deserializeAny(text: string | null): Promise<LoadResult> {
  if (!text) return { ok: false, error: 'Sin datos.' };
  let env: Envelope;
  try {
    env = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo está dañado (JSON inválido).' };
  }
  if (env?.encoding === 'gzip-b64') {
    if (!canCompress()) return { ok: false, error: 'Esta plataforma no puede descomprimir la partida.' };
    try {
      env = { ...env, payload: await gunzipText(env.payload), encoding: undefined };
    } catch {
      return { ok: false, error: 'Los datos comprimidos están dañados.' };
    }
    return deserializeEnvelope(env);
  }
  return deserialize(text);
}

export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + ':' + text.length.toString(36);
}

export function serialize(state: GameState, now: number): string {
  const payload = JSON.stringify(state);
  const env: Envelope = { format: 'urt-save', version: SAVE_VERSION, savedAt: now, day: state.day, name: state.player.name, checksum: fnv1a(payload), payload };
  return JSON.stringify(env);
}

export type LoadResult = { ok: true; state: GameState; envelope: Envelope; migratedFrom: number | null } | { ok: false; error: string };

export function deserialize(text: string | null): LoadResult {
  if (!text) return { ok: false, error: 'Sin datos.' };
  let env: Envelope;
  try {
    env = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo está dañado (JSON inválido).' };
  }
  if (env?.encoding) return { ok: false, error: 'La partida está comprimida: usá la carga asíncrona.' };
  return deserializeEnvelope(env);
}

function deserializeEnvelope(env: Envelope): LoadResult {
  if (!env || env.format !== 'urt-save' || typeof env.payload !== 'string') return { ok: false, error: 'No es una partida de Ultimate Realistic Tycoon.' };
  if (fnv1a(env.payload) !== env.checksum) return { ok: false, error: 'La suma de verificación no coincide: la partida fue alterada o está dañada.' };
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(env.payload);
  } catch {
    return { ok: false, error: 'Contenido dañado.' };
  }
  const shape = validateShape(raw);
  if (shape.length) return { ok: false, error: shape.join(' ') };
  let migrated;
  try {
    migrated = migrate(raw);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const inv = checkInvariants(migrated.state);
  if (inv.length) return { ok: false, error: 'Contabilidad inconsistente: ' + inv.slice(0, 3).join(' ') };
  return { ok: true, state: migrated.state, envelope: env, migratedFrom: migrated.migratedFrom };
}

/**
 * Escribe con reintento: si el almacenamiento está lleno, libera primero las
 * copias de seguridad MÁS VIEJAS (nunca la principal) y vuelve a intentar.
 */
async function setWithRoom(kv: KV, key: string, text: string): Promise<string | null> {
  const victims = [...KEYS.backups].reverse();
  for (let attempt = 0; ; attempt++) {
    try {
      await kv.set(key, text);
      return null;
    } catch (e) {
      const victim = victims[attempt];
      if (!victim) return (e as Error)?.name === 'QuotaExceededError' ? 'El almacenamiento del dispositivo está lleno.' : `Error de escritura: ${(e as Error)?.message ?? e}`;
      try {
        await kv.remove(victim);
      } catch {
        /* seguimos intentando */
      }
    }
  }
}

export async function saveGame(kv: KV, state: GameState, now: number): Promise<{ ok: true; bytes: number } | { ok: false; error: string }> {
  const inv = checkInvariants(state);
  if (inv.length) return { ok: false, error: 'No se guardó: se detectó una inconsistencia contable. ' + inv[0] };
  state.meta.lastRealTime = now;
  const text = await serializeCompact(state, now);
  // 1. Ranura temporal: si falla, la principal y las copias quedan intactas.
  const e1 = await setWithRoom(kv, KEYS.temp, text);
  if (e1) return { ok: false, error: `No se guardó (${e1}). Tu partida anterior sigue intacta; exportala a un archivo desde Ajustes.` };
  // 2. Rotación de copias de seguridad (solo copia textos ya verificados).
  try {
    const primary = await kv.get(KEYS.primary);
    if (primary) {
      const bak1 = deserializeHeader(await kv.get(KEYS.backups[0]));
      const prim = deserializeHeader(primary);
      if (prim && (!bak1 || prim.day - bak1.day >= BACKUP_SPACING_DAYS || prim.name !== bak1.name)) {
        for (let i = KEYS.backups.length - 1; i > 0; i--) {
          const prev = await kv.get(KEYS.backups[i - 1]);
          if (prev) await kv.set(KEYS.backups[i], prev);
        }
        await kv.set(KEYS.backups[0], primary);
      }
    }
  } catch {
    /* sin espacio para rotar copias: se conserva lo que ya había */
  }
  // 3. Principal. Si falla, la temporal (más nueva) se usa al cargar.
  const e2 = await setWithRoom(kv, KEYS.primary, text);
  if (e2) return { ok: false, error: `Guardado parcial (${e2}): la partida quedó en la ranura temporal y se recuperará al abrir.` };
  try {
    await kv.remove(KEYS.temp);
  } catch {
    /* no crítico */
  }
  return { ok: true, bytes: text.length };
}

export function deserializeHeader(text: string | null): Pick<Envelope, 'savedAt' | 'day' | 'name' | 'version'> | null {
  if (!text) return null;
  try {
    const e = JSON.parse(text) as Envelope;
    return e.format === 'urt-save' ? { savedAt: e.savedAt, day: e.day, name: e.name, version: e.version } : null;
  } catch {
    return null;
  }
}

export interface LoadReport {
  state: GameState | null;
  source: string | null;
  recovered: boolean;
  problems: string[];
  migratedFrom: number | null;
}

/**
 * Carga la copia válida MÁS RECIENTE entre la principal y la temporal; si
 * ninguna sirve, prueba las copias de seguridad de la más nueva a la más vieja.
 * Una copia dañada nunca borra a las demás.
 */
export async function loadGame(kv: KV): Promise<LoadReport> {
  const problems: string[] = [];
  const first: Array<{ key: string; r: LoadResult & { ok: true } }> = [];
  // La copia previa a una actualización compite por fecha: solo gana si la principal
  // no se puede leer (por ejemplo, tras volver a una versión anterior del juego).
  for (const key of [KEYS.primary, KEYS.temp, KEYS.preupdate]) {
    const text = await kv.get(key);
    if (!text) continue;
    const r = await deserializeAny(text);
    if (r.ok) first.push({ key, r });
    else problems.push(`${key}: ${r.error}`);
  }
  if (first.length) {
    first.sort((a, b) => b.r.envelope.savedAt - a.r.envelope.savedAt);
    const best = first[0];
    return { state: best.r.state, source: best.key, recovered: best.key !== KEYS.primary && (problems.length > 0 || best.key === KEYS.preupdate), problems, migratedFrom: best.r.migratedFrom };
  }
  for (const key of KEYS.backups) {
    const text = await kv.get(key);
    if (!text) continue;
    const r = await deserializeAny(text);
    if (r.ok) return { state: r.state, source: key, recovered: true, problems, migratedFrom: r.migratedFrom };
    problems.push(`${key}: ${r.error}`);
  }
  return { state: null, source: null, recovered: false, problems, migratedFrom: null };
}

export async function listBackups(kv: KV) {
  const out: Array<{ key: string; header: ReturnType<typeof deserializeHeader> }> = [];
  for (const key of [KEYS.primary, ...KEYS.backups]) out.push({ key, header: deserializeHeader(await kv.get(key)) });
  return out;
}

export async function restoreBackup(kv: KV, key: string): Promise<LoadResult> {
  const r = await deserializeAny(await kv.get(key));
  if (r.ok) await kv.set(KEYS.primary, await kv.get(key) as string);
  return r;
}

export async function deleteAll(kv: KV): Promise<void> {
  for (const k of [KEYS.primary, KEYS.temp, KEYS.preupdate, ...KEYS.backups]) await kv.remove(k);
}

/** Copia la partida principal (ya verificada) a la ranura "antes de actualizar". */
export async function snapshotBeforeUpdate(kv: KV): Promise<boolean> {
  const primary = await kv.get(KEYS.primary);
  if (!primary) return false;
  const r = await deserializeAny(primary);
  if (!r.ok) return false;
  await kv.set(KEYS.preupdate, primary);
  return (await kv.get(KEYS.preupdate)) === primary;
}

/** Memoria (pruebas y entornos sin almacenamiento persistente). */
export class MemoryKV implements KV {
  map = new Map<string, string>();
  async get(k: string) {
    return this.map.get(k) ?? null;
  }
  async set(k: string, v: string) {
    this.map.set(k, v);
  }
  async remove(k: string) {
    this.map.delete(k);
  }
}
