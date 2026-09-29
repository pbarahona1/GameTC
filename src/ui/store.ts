import { useSyncExternalStore } from 'react';
import type { GameState, LogItem } from '../engine/state';
import { newGame, NewGameOptions } from '../engine/state';
import type { ActionResult } from '../engine/result';
import { advanceDay, simulateDays, SimReport } from '../engine/simulation';
import { refreshListings } from '../engine/business/simulate';
import { updateProgression } from '../engine/progression/progression';
import { checkInvariants } from '../engine/invariants';
import { takeSnapshot } from '../engine/snapshot';
import { loadGame, saveGame, KV, serialize, deserializeAny, listBackups, restoreBackup, deleteAll, snapshotBeforeUpdate } from '../persistence/save';
import { offlineDays, DEFAULT_OFFLINE } from '../persistence/offline';
import { createStorage, exportToFile } from '../persistence/platformStorage';

export type Speed = 0 | 1 | 2 | 4 | 8;
export type ThemeChoice = 'system' | 'light' | 'dark';

export type PauseCategory = 'peligro' | 'ofertas' | 'logros' | 'legal' | 'inversiones';

export interface Settings {
  theme: ThemeChoice;
  learningMode: boolean;
  autoPause: boolean;
  offlineMaxDays: number;
  alertCategories: string[];
  /** Velocidad base: milisegundos reales por día de juego a 1×. */
  msPerDay: number;
  /** Qué eventos pausan el tiempo (si la pausa automática está activa). */
  pauseOn: PauseCategory[];
  /** Mostrar avisos de confirmación de acciones exitosas. */
  successToasts: boolean;
  /** Accesibilidad y personalización de la interfaz. */
  fontScale: number;
  highContrast: boolean;
  reduceMotion: boolean;
  colorblind: boolean;
  density: 'comoda' | 'compacta';
  /** Mostrar todas las secciones sin recomendaciones por etapa (1.2). */
  showAllSections: boolean;
  /** Buscar actualizaciones al abrir la app (1.2). */
  autoUpdate: boolean;
}

const SETTINGS_KEY = 'urt.settings';
const HOST_THEME = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;
const DEFAULT_SETTINGS: Settings = {
  theme: 'system', learningMode: true, autoPause: true, offlineMaxDays: 30,
  alertCategories: ['liquidez', 'deuda', 'credito', 'ahorro', 'impuestos', 'carrera', 'bienestar', 'empresa', 'inversiones', 'inmuebles', 'legal', 'economia'],
  msPerDay: 2000, pauseOn: ['peligro', 'ofertas', 'logros', 'legal'], successToasts: true,
  fontScale: 1, highContrast: false, reduceMotion: false, colorblind: false, density: 'comoda', showAllSections: false, autoUpdate: true,
};

/** Milisegundos reales por día de juego a velocidad 1× (valor por defecto). */
export const MS_PER_DAY_1X = 2000;
const AUTOSAVE_EVERY_DAYS = 30;

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error' | 'info';
}

export interface UIState {
  version: number;
  ready: boolean;
  state: GameState | null;
  speed: Speed;
  settings: Settings;
  toasts: Toast[];
  absence: SimReport | null;
  loadNotice: string | null;
  storageKind: string;
  lastSaved: number | null;
  saveError: string | null;
  saveBytes: number | null;
}

type Listener = () => void;

/** Categoría de pausa de un evento del registro (null = no pausa). */
export function pauseCategory(l: LogItem): PauseCategory | null {
  if (['⚖️', '🔒', '🚨', '⛓️', '🚔', '🕵️', '🔨', '📋'].includes(l.icon) && l.kind !== 'success' && l.kind !== 'info') return 'legal';
  if (l.kind === 'danger') return 'peligro';
  if (l.icon === '📩' || l.icon === '🧲' || l.icon === '💼') return 'ofertas';
  if (l.icon === '🏆' || l.icon === '🚀') return 'logros';
  if (['📉', '💥', '🏚️'].includes(l.icon) && l.kind === 'warning') return 'inversiones';
  return null;
}

class GameStore {
  private listeners = new Set<Listener>();
  private kv: KV | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private accumulator = 0;
  private daysSinceSave = 0;
  private dirty = false;
  private toastId = 1;
  ui: UIState = {
    version: 0, ready: false, state: null, speed: 0, settings: DEFAULT_SETTINGS, toasts: [], absence: null, loadNotice: null, storageKind: '', lastSaved: null, saveError: null, saveBytes: null,
  };

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.ui;

  private emit() {
    this.ui = { ...this.ui, version: this.ui.version + 1 };
    for (const l of this.listeners) l();
  }

  // ---------- Arranque ----------
  async boot() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        this.ui.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        // Categorías nuevas se activan por defecto al actualizar.
        for (const c of ['empresa', 'inversiones', 'inmuebles', 'legal', 'economia']) if (!this.ui.settings.alertCategories.includes(c)) this.ui.settings.alertCategories.push(c);
      }
    } catch {
      /* ajustes por defecto */
    }
    const storage = await createStorage();
    this.kv = storage.kv;
    this.ui.storageKind = storage.kind;
    const report = await loadGame(storage.kv);
    if (report.state) {
      this.ui.state = report.state;
      if (!report.state.listings.length) refreshListings(report.state);
      const notices: string[] = [];
      if (report.recovered && report.source === 'urt.save.preupdate') notices.push('Se cargó la copia guardada justo antes de la última actualización.');
      else if (report.recovered) notices.push(`La partida principal no se pudo leer; se recuperó una copia de seguridad (${report.source}).`);
      if (report.migratedFrom !== null) notices.push(`Partida actualizada desde la versión ${report.migratedFrom}.`);
      this.ui.loadNotice = notices.join(' ') || null;
      const days = offlineDays(report.state.meta.lastRealTime, Date.now(), { ...DEFAULT_OFFLINE, maxDays: this.ui.settings.offlineMaxDays });
      if (days > 0) {
        this.ui.absence = simulateDays(report.state, days);
        await this.save();
      }
    } else if (report.problems.length) {
      this.ui.loadNotice = 'No se pudo recuperar ninguna partida: ' + report.problems.join(' | ');
    }
    this.ui.ready = true;
    this.applyTheme();
    this.emit();
    this.startClock();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.save();
    });
    window.addEventListener('pagehide', () => void this.save());
  }

  // ---------- Partida ----------
  startNewGame(opts: NewGameOptions) {
    this.ui.state = newGame({ ...opts, nowReal: Date.now(), seed: opts.seed || `${opts.name}-${Date.now()}` });
    refreshListings(this.ui.state);
    this.ui.absence = null;
    this.ui.speed = 0;
    updateProgression(this.ui.state);
    this.dirty = true;
    void this.save();
    this.emit();
  }

  async abandonGame() {
    if (this.kv) await deleteAll(this.kv);
    this.ui.state = null;
    this.ui.speed = 0;
    this.emit();
  }

  /**
   * Ejecuta una acción del jugador de forma atómica: si falla con una
   * excepción, el estado vuelve exactamente a como estaba.
   */
  run(fn: (s: GameState) => ActionResult | void, opts: { toast?: boolean } = {}): ActionResult {
    const s = this.ui.state;
    if (!s) return { ok: false, error: 'No hay partida.' };
    const snap = takeSnapshot(s);
    let r: ActionResult;
    try {
      r = fn(s) ?? { ok: true };
      updateProgression(s);
    } catch (e) {
      this.ui.state = snap.restore();
      r = { ok: false, error: `No se pudo completar la operación: ${(e as Error).message}` };
    }
    if (opts.toast !== false) {
      if (!r.ok) this.toast(r.error, 'error');
      else if (r.message && this.ui.settings.successToasts) this.toast(r.message, 'ok');
    }
    this.dirty = true;
    this.emit();
    return r;
  }

  markSeen(term: string) {
    const s = this.ui.state;
    if (!s || s.meta.seenTerms.includes(term)) return;
    s.meta.seenTerms.push(term);
    this.dirty = true;
    this.emit();
  }

  private isImportant(l: LogItem): boolean {
    const c = pauseCategory(l);
    return c !== null && this.ui.settings.pauseOn.includes(c);
  }

  // ---------- Tiempo ----------
  setSpeed(speed: Speed) {
    this.ui.speed = speed;
    this.accumulator = 0;
    this.lastTick = performance.now();
    this.emit();
  }

  step(days: number) {
    const s = this.ui.state;
    if (!s) return;
    const lastId = s.log.length ? s.log[s.log.length - 1].id : 0;
    let done = 0;
    for (let i = 0; i < days; i++) {
      const before = s.log.length ? s.log[s.log.length - 1].id : 0;
      advanceDay(s);
      done++;
      // Los saltos se detienen ante un evento importante para que no se pierdan ofertas ni alertas.
      if (this.ui.settings.autoPause && i < days - 1) {
        const hit = s.log.find((l) => l.id > before && this.isImportant(l));
        if (hit) {
          this.toast(`Salto detenido: ${hit.text}`, hit.kind === 'danger' ? 'error' : 'info');
          break;
        }
      }
    }
    this.afterAdvance(done, lastId);
  }

  private startClock() {
    if (this.timer) return;
    this.lastTick = performance.now();
    this.timer = setInterval(() => this.tick(), 100);
  }

  private tick() {
    const now = performance.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    const s = this.ui.state;
    if (!s || this.ui.speed === 0) return;
    this.accumulator += dt * this.ui.speed;
    const ms = this.ui.settings.msPerDay || MS_PER_DAY_1X;
    let days = Math.floor(this.accumulator / ms);
    if (days <= 0) return;
    this.accumulator -= days * ms;
    days = Math.min(days, 8);
    const lastId = s.log.length ? s.log[s.log.length - 1].id : 0;
    for (let i = 0; i < days; i++) advanceDay(s);
    this.afterAdvance(days, lastId);
  }

  private afterAdvance(days: number, lastLogId: number) {
    const s = this.ui.state!;
    this.dirty = true;
    this.daysSinceSave += days;
    if (this.ui.settings.autoPause && this.ui.speed !== 0) {
      const fresh = s.log.filter((l) => l.id > lastLogId);
      const important = fresh.find((l) => this.isImportant(l));
      if (important) {
        this.ui.speed = 0;
        this.toast(`Pausa automática: ${important.text}`, important.kind === 'danger' ? 'error' : 'info');
      }
    }
    if (this.daysSinceSave >= AUTOSAVE_EVERY_DAYS) void this.save();
    this.emit();
  }

  // ---------- Guardado ----------
  async save(): Promise<boolean> {
    const s = this.ui.state;
    if (!s || !this.kv) return false;
    let r: Awaited<ReturnType<typeof saveGame>>;
    try {
      r = await saveGame(this.kv, s, Date.now());
    } catch (e) {
      r = { ok: false, error: `No se pudo guardar: ${(e as Error).message}` };
    }
    this.daysSinceSave = 0;
    if (r.ok) {
      this.dirty = false;
      this.ui.lastSaved = Date.now();
      this.ui.saveBytes = r.bytes;
      this.ui.saveError = null;
    } else {
      this.ui.saveError = r.error;
      this.toast(r.error, 'error');
    }
    this.emit();
    return r.ok;
  }

  isDirty() {
    return this.dirty;
  }

  /** Antes de cambiar de versión: pausa, guarda y deja una copia verificada "antes de actualizar". */
  async saveForUpdate(): Promise<boolean> {
    this.setSpeed(0);
    if (!this.kv) return false;
    if (!this.ui.state) return true;
    if (!(await this.save())) return false;
    try {
      return await snapshotBeforeUpdate(this.kv);
    } catch {
      return false;
    }
  }

  exportText(): string | null {
    return this.ui.state ? serialize(this.ui.state, Date.now()) : null;
  }

  async exportFile(): Promise<void> {
    const text = this.exportText();
    if (!text || !this.ui.state) return;
    const safe = this.ui.state.player.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'partida';
    const r = await exportToFile(text, `urt-${safe}-dia-${this.ui.state.day}.json`);
    this.toast(r.message, r.ok ? 'ok' : 'error');
  }

  async importText(text: string): Promise<ActionResult> {
    const r = await deserializeAny(text.trim());
    if (!r.ok) {
      this.toast(`No se pudo importar: ${r.error}`, 'error');
      return { ok: false, error: r.error };
    }
    this.toast('Partida importada y verificada.', 'ok');
    this.ui.state = r.state;
    this.ui.speed = 0;
    void this.save();
    this.emit();
    return { ok: true, message: 'Partida importada.' };
  }

  async backups() {
    return this.kv ? listBackups(this.kv) : [];
  }

  async restore(key: string): Promise<ActionResult> {
    if (!this.kv) return { ok: false, error: 'Sin almacenamiento.' };
    const r = await restoreBackup(this.kv, key);
    if (!r.ok) return { ok: false, error: r.error };
    this.ui.state = r.state;
    this.ui.speed = 0;
    void this.save();
    this.emit();
    return { ok: true, message: 'Copia restaurada.' };
  }

  audit(): string[] {
    return this.ui.state ? checkInvariants(this.ui.state) : [];
  }

  // ---------- Interfaz ----------
  updateSettings(patch: Partial<Settings>) {
    this.ui.settings = { ...this.ui.settings, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.ui.settings));
    } catch {
      /* sin almacenamiento */
    }
    this.applyTheme();
    this.emit();
  }

  private applyTheme() {
    const st = this.ui.settings;
    const t = st.theme;
    const root = document.documentElement;
    // "Sistema" respeta el tema que haya fijado el entorno anfitrión (si lo hay).
    if (t === 'system') {
      if (HOST_THEME) root.setAttribute('data-theme', HOST_THEME);
      else root.removeAttribute('data-theme');
    } else root.setAttribute('data-theme', t);
    const flag = (name: string, on: boolean, value = '1') => (on ? root.setAttribute(name, value) : root.removeAttribute(name));
    flag('data-contrast', st.highContrast, 'high');
    flag('data-cb', st.colorblind);
    flag('data-motion', st.reduceMotion, 'reduce');
    flag('data-density', st.density === 'compacta', 'compact');
    root.style.setProperty('--ui-zoom', String(st.fontScale || 1));
  }

  toast(text: string, tone: Toast['tone'] = 'info') {
    if (this.ui.toasts.some((t) => t.text === text)) return;
    const id = this.toastId++;
    this.ui.toasts = [...this.ui.toasts.slice(-1), { id, text, tone }];
    this.emit();
    setTimeout(() => {
      this.ui.toasts = this.ui.toasts.filter((t) => t.id !== id);
      this.emit();
    }, tone === 'error' ? 5000 : 3200);
  }

  dismissToast(id: number) {
    this.ui.toasts = this.ui.toasts.filter((t) => t.id !== id);
    this.emit();
  }

  dismissAbsence() {
    this.ui.absence = null;
    this.emit();
  }

  dismissNotice() {
    this.ui.loadNotice = null;
    this.emit();
  }
}

export const store = new GameStore();

export function useUI(): UIState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/** Estado de juego garantizado (usar solo dentro de pantallas con partida activa). */
export function useGame(): GameState {
  return useUI().state as GameState;
}
