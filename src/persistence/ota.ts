import { APP_VERSION, WEB_BUILD } from '../version';

/**
 * Actualizaciones por internet (sin reinstalar la APK).
 *
 * El juego es una sola página web empaquetada dentro de la app. Cada versión nueva
 * de esa página se publica en el repositorio (carpeta ota/) con un manifiesto que
 * indica número de versión, tamaño y huella SHA-256. La app:
 *   1. descarga el manifiesto y, si hay una versión mayor compatible con la APK
 *      instalada, se la ofrece al jugador;
 *   2. descarga la página, comprueba tamaño y huella, y la guarda en los archivos
 *      privados de la app;
 *   3. guarda la partida y una copia "antes de actualizar";
 *   4. abre la versión nueva SIN hacerla permanente todavía;
 *   5. la versión nueva, cuando carga la partida y funciona unos segundos sin
 *      errores, se confirma a sí misma (queda como la versión de arranque).
 * Si la versión nueva falla antes de confirmarse, vuelve a la anterior; si se
 * cuelga, al cerrar y abrir la app arranca la anterior y la marca como fallida.
 * La partida vive fuera de la página (archivos de la app), así que no se pierde.
 */

export const OTA_REPO = 'pbarahona1/gametc';
export const OTA_BRANCH = 'main';
export const OTA_BASE = `https://raw.githubusercontent.com/${OTA_REPO}/${OTA_BRANCH}/ota/`;
const PREF_KEY = 'urt.ota';
const CONFIRM_AFTER_MS = 6000;

export interface OtaManifest {
  format: 'urt-ota';
  version: string;
  build: number;
  /** versionCode mínimo de la APK (si cambia algo nativo, hace falta una APK nueva). */
  minNativeCode: number;
  /** Nombre del archivo dentro de ota/. */
  file: string;
  sha256: string;
  size: number;
  date: string;
  notes: string[];
}

interface OtaPrefs {
  pending?: { build: number; version: string; path: string; prevPath: string; fromVersion: string; at: number; notes: string[] };
  failed: number[];
  current?: number;
  justUpdated?: { from: string; to: string; notes: string[] };
  rolledBack?: { version: string; reason: string };
  lastCheck?: number;
}

export type OtaCheck =
  | { kind: 'web' }
  | { kind: 'none'; latest: string }
  | { kind: 'available'; manifest: OtaManifest }
  | { kind: 'needs-apk'; manifest: OtaManifest; nativeCode: number }
  | { kind: 'failed-before'; manifest: OtaManifest }
  | { kind: 'error'; message: string };

/** ¿El manifiesto ofrece algo instalable para esta app? (lógica pura, probada en tests). */
export function evaluateManifest(m: unknown, ctx: { webBuild: number; nativeCode: number; failed: number[]; manual: boolean }): OtaCheck {
  const man = m as OtaManifest;
  if (!man || man.format !== 'urt-ota' || typeof man.build !== 'number' || typeof man.file !== 'string' || !/^[\w.-]+\.html$/.test(man.file) || !/^[0-9a-f]{64}$/.test(man.sha256 ?? '')) {
    return { kind: 'error', message: 'El manifiesto de actualización no es válido.' };
  }
  if (man.build <= ctx.webBuild) return { kind: 'none', latest: man.version };
  if (ctx.nativeCode < (man.minNativeCode ?? 0)) return { kind: 'needs-apk', manifest: man, nativeCode: ctx.nativeCode };
  if (ctx.failed.includes(man.build) && !ctx.manual) return { kind: 'failed-before', manifest: man };
  return { kind: 'available', manifest: man };
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------ plataforma

async function native(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function readPrefs(): Promise<OtaPrefs> {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const r = await Preferences.get({ key: PREF_KEY });
    const p = r.value ? (JSON.parse(r.value) as OtaPrefs) : null;
    return { failed: [], ...(p ?? {}) };
  } catch {
    return { failed: [] };
  }
}

async function writePrefs(p: OtaPrefs): Promise<void> {
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key: PREF_KEY, value: JSON.stringify(p) });
}

export async function nativeInfo(): Promise<{ version: string; code: number } | null> {
  if (!(await native())) return null;
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return { version: info.version, code: parseInt(info.build, 10) || 0 };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ estado observable

export type OtaPhase = 'idle' | 'checking' | 'downloading' | 'verifying' | 'installing' | 'error';

export interface OtaView {
  phase: OtaPhase;
  check: OtaCheck | null;
  progress: number;
  message: string | null;
  justUpdated: OtaPrefs['justUpdated'] | null;
  rolledBack: OtaPrefs['rolledBack'] | null;
  native: { version: string; code: number } | null;
  confirmed: boolean;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let view: OtaView = { phase: 'idle', check: null, progress: 0, message: null, justUpdated: null, rolledBack: null, native: null, confirmed: true };

function set(patch: Partial<OtaView>) {
  view = { ...view, ...patch };
  for (const l of listeners) l();
}

export const otaStore = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => view,
};

// ------------------------------------------------------------------ arranque, confirmación y reversión

let bootErrorHandler: ((e: unknown) => void) | null = null;

async function rollback(reason: string): Promise<void> {
  const p = await readPrefs();
  const pend = p.pending;
  if (!pend || pend.build !== WEB_BUILD) return;
  p.failed = [...new Set([...p.failed, pend.build])];
  p.pending = undefined;
  p.rolledBack = { version: pend.version, reason };
  await writePrefs(p);
  const { WebView } = await import('@capacitor/core');
  // Volver a la versión anterior: otra página descargada o la que viene dentro de la APK.
  if (pend.prevPath && pend.prevPath.startsWith('/')) await WebView.setServerBasePath({ path: pend.prevPath });
  else await (WebView as unknown as { setServerAssetPath(o: { path: string }): Promise<void> }).setServerAssetPath({ path: 'public' });
}

/**
 * Se llama al iniciar la app (antes de cargar la partida).
 *  - Si esta página es una actualización pendiente: vigila errores y se confirma sola
 *    cuando `markHealthy()` avisa que la partida cargó y la interfaz funciona.
 *  - Si hay una actualización pendiente pero arrancó OTRA versión, la nueva falló:
 *    se marca como fallida para no ofrecerla de nuevo automáticamente.
 */
export async function otaBoot(): Promise<void> {
  if (!(await native())) return;
  const p = await readPrefs();
  set({ native: await nativeInfo(), justUpdated: p.justUpdated ?? null, rolledBack: p.rolledBack ?? null });
  if (p.pending) {
    if (p.pending.build === WEB_BUILD) {
      set({ confirmed: false });
      bootErrorHandler = () => void rollback('La versión nueva tuvo un error al iniciar.');
      window.addEventListener('error', bootErrorHandler);
      window.addEventListener('unhandledrejection', bootErrorHandler);
      return;
    }
    p.failed = [...new Set([...p.failed, p.pending.build])];
    p.rolledBack = { version: p.pending.version, reason: 'La versión nueva no terminó de iniciar.' };
    p.pending = undefined;
    await writePrefs(p);
    set({ rolledBack: p.rolledBack });
  }
  void cleanupOldBundles(p.current);
}

/** La versión pendiente no pudo cargar la partida: volver a la anterior. */
export function failBoot(reason: string): void {
  if (view.confirmed) return;
  void rollback(reason);
}

/** La partida cargó y la interfaz se dibujó: si esta versión estaba pendiente, se confirma. */
export function markHealthy(onConfirmed?: () => void): void {
  if (view.confirmed) return;
  setTimeout(async () => {
    try {
      const p = await readPrefs();
      if (!p.pending || p.pending.build !== WEB_BUILD) return;
      const { WebView } = await import('@capacitor/core');
      await WebView.persistServerBasePath();
      p.justUpdated = { from: p.pending.fromVersion, to: APP_VERSION, notes: p.pending.notes ?? [] };
      p.current = WEB_BUILD;
      p.pending = undefined;
      p.rolledBack = undefined;
      await writePrefs(p);
      if (bootErrorHandler) {
        window.removeEventListener('error', bootErrorHandler);
        window.removeEventListener('unhandledrejection', bootErrorHandler);
        bootErrorHandler = null;
      }
      set({ confirmed: true, justUpdated: p.justUpdated });
      onConfirmed?.();
    } catch {
      /* se reintenta en el próximo arranque */
    }
  }, CONFIRM_AFTER_MS);
}

export async function dismissUpdateNotes(): Promise<void> {
  if (!(await native())) return;
  const p = await readPrefs();
  p.justUpdated = undefined;
  p.rolledBack = undefined;
  await writePrefs(p);
  set({ justUpdated: null, rolledBack: null });
}

async function cleanupOldBundles(current?: number): Promise<void> {
  try {
    const fs = await import('@capacitor/filesystem');
    const dir = await fs.Filesystem.readdir({ path: 'ota', directory: fs.Directory.Data });
    for (const f of dir.files) {
      if (f.name !== String(current) && f.name !== String(WEB_BUILD)) {
        await fs.Filesystem.rmdir({ path: `ota/${f.name}`, directory: fs.Directory.Data, recursive: true });
      }
    }
  } catch {
    /* no hay carpeta ota todavía */
  }
}

// ------------------------------------------------------------------ buscar e instalar

export async function checkForUpdate(manual: boolean): Promise<OtaCheck> {
  if (!(await native())) {
    const r: OtaCheck = { kind: 'web' };
    set({ check: r });
    return r;
  }
  set({ phase: 'checking', message: null });
  try {
    const res = await fetch(`${OTA_BASE}manifest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`el servidor respondió ${res.status}`);
    const man = await res.json();
    const p = await readPrefs();
    const nat = view.native ?? (await nativeInfo());
    const r = evaluateManifest(man, { webBuild: WEB_BUILD, nativeCode: nat?.code ?? 0, failed: p.failed, manual });
    p.lastCheck = Date.now();
    await writePrefs(p);
    set({ phase: r.kind === 'error' ? 'error' : 'idle', check: r, message: r.kind === 'error' ? r.message : null });
    return r;
  } catch (e) {
    const r: OtaCheck = { kind: 'error', message: `No se pudo buscar actualizaciones (${(e as Error).message}). Revisá la conexión.` };
    set({ phase: 'error', check: r, message: r.message });
    return r;
  }
}

/**
 * Descarga, verifica e instala. `beforeSwitch` debe guardar la partida (y su copia
 * previa) ANTES de cambiar de versión. Devuelve un mensaje de error o null.
 */
export async function applyUpdate(man: OtaManifest, beforeSwitch: () => Promise<boolean>): Promise<string | null> {
  try {
    set({ phase: 'downloading', progress: 0, message: null });
    const res = await fetch(`${OTA_BASE}${man.file}?t=${man.build}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`descarga fallida (${res.status})`);
    const total = man.size || Number(res.headers.get('content-length')) || 0;
    let text: string;
    if (res.body && total) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        set({ progress: Math.min(0.99, got / total) });
      }
      const all = new Uint8Array(got);
      let o = 0;
      for (const c of chunks) {
        all.set(c, o);
        o += c.length;
      }
      text = new TextDecoder().decode(all);
    } else text = await res.text();
    set({ phase: 'verifying', progress: 1 });
    const bytes = new TextEncoder().encode(text).length;
    if (man.size && bytes !== man.size) throw new Error(`tamaño inesperado (${bytes} de ${man.size} bytes)`);
    if ((await sha256Hex(text)) !== man.sha256) throw new Error('la huella SHA-256 no coincide: el archivo llegó incompleto o alterado');
    if (!text.includes('<div id="root">')) throw new Error('el archivo no es una versión del juego');

    set({ phase: 'installing' });
    const fs = await import('@capacitor/filesystem');
    const rel = `ota/${man.build}`;
    try {
      await fs.Filesystem.rmdir({ path: rel, directory: fs.Directory.Data, recursive: true });
    } catch {
      /* no existía */
    }
    await fs.Filesystem.mkdir({ path: rel, directory: fs.Directory.Data, recursive: true });
    await fs.Filesystem.writeFile({ path: `${rel}/index.html`, data: text, directory: fs.Directory.Data, encoding: fs.Encoding.UTF8 });
    const check = await fs.Filesystem.readFile({ path: `${rel}/index.html`, directory: fs.Directory.Data, encoding: fs.Encoding.UTF8 });
    if (typeof check.data !== 'string' || (await sha256Hex(check.data)) !== man.sha256) throw new Error('no se pudo escribir la versión nueva completa');
    const uri = (await fs.Filesystem.getUri({ path: rel, directory: fs.Directory.Data })).uri;
    const path = decodeURIComponent(uri.replace(/^file:\/\//, ''));

    if (!(await beforeSwitch())) throw new Error('no se pudo guardar la partida antes de actualizar; no se cambió nada');

    const { WebView } = await import('@capacitor/core');
    const prev = (await WebView.getServerBasePath()).path ?? '';
    const p = await readPrefs();
    p.pending = { build: man.build, version: man.version, path, prevPath: prev, fromVersion: APP_VERSION, at: Date.now(), notes: (man.notes ?? []).slice(0, 30) };
    p.failed = p.failed.filter((b) => b !== man.build);
    await writePrefs(p);
    await WebView.setServerBasePath({ path });
    return null;
  } catch (e) {
    const msg = `No se instaló la actualización: ${(e as Error).message}. Tu versión actual y tu partida siguen intactas.`;
    set({ phase: 'error', message: msg });
    return msg;
  }
}

/** Búsqueda automática al abrir la app (el manifiesto pesa menos de 1 KB). */
export async function autoCheck(): Promise<void> {
  if (!(await native())) return;
  const p = await readPrefs();
  if (p.pending) return;
  await checkForUpdate(false);
}
