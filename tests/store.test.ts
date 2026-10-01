// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameStore, BOOT_TIMEOUTS } from '../src/ui/store';
import { KEYS, saveGame, serialize, rescueBundle } from '../src/persistence/save';
import { advanceDay } from '../src/engine/simulation';
import { createStorage } from '../src/persistence/platformStorage';
import { makeGame } from './helpers';
import type { GameState } from '../src/engine/state';

vi.mock('../src/persistence/platformStorage', async (orig) => {
  const actual = await orig<typeof import('../src/persistence/platformStorage')>();
  return { ...actual, createStorage: vi.fn(actual.createStorage) };
});

const NEW = { name: 'Prueba', background: 'egresado' as const, style: 'libre' as const, seed: 'store-seed' };
const stores: GameStore[] = [];
function make(step?: (s: GameState) => void) {
  const st = new GameStore(step ? { step } : {});
  stores.push(st);
  return st;
}

class LocalKV {
  async get(k: string) { return localStorage.getItem(k); }
  async set(k: string, v: string) { localStorage.setItem(k, v); }
  async remove(k: string) { localStorage.removeItem(k); }
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  while (stores.length) stores.pop()!.stopClock();
  vi.restoreAllMocks();
});

describe('Fase 1 · arranque', () => {
  it('sin partida guardada: queda listo, sin error y sin partida', async () => {
    const st = make();
    await st.boot();
    const ui = st.getSnapshot();
    expect(ui.ready).toBe(true);
    expect(ui.state).toBeNull();
    expect(ui.bootError).toBeNull();
  });

  it('con una partida sana: la abre', async () => {
    const g = makeGame('egresado', 'boot-ok');
    for (let d = 0; d < 5; d++) advanceDay(g);
    await saveGame(new LocalKV(), g, Date.now());
    const st = make();
    await st.boot();
    expect(st.getSnapshot().state?.day).toBe(5);
    expect(st.getSnapshot().bootError).toBeNull();
  });

  it('con todas las copias ilegibles: muestra el error, no borra nada y la partida nueva las conserva aparte', async () => {
    const broken = '{"format":"urt-save","payload":"x","checksum":"0"}';
    localStorage.setItem(KEYS.primary, broken);
    localStorage.setItem(KEYS.backups[0], broken + ' ');
    const st = make();
    await st.boot();
    const ui = st.getSnapshot();
    expect(ui.ready).toBe(true);
    expect(ui.state).toBeNull();
    expect(ui.bootError?.kind).toBe('unreadable');
    expect(ui.bootError?.details.length).toBeGreaterThan(0);
    expect(localStorage.getItem(KEYS.primary)).toBe(broken);
    st.startOverAfterBootError();
    await st.startNewGame(NEW);
    await st.save();
    const kept = Object.keys(localStorage).filter((k) => k.startsWith('urt.keep.'));
    expect(kept.length).toBe(2);
    expect(kept.some((k) => localStorage.getItem(k) === broken)).toBe(true);
    expect(st.getSnapshot().state?.player.name).toBe('Prueba');
  });

  it('si el almacenamiento no responde, termina en un error de tiempo y no en una carga infinita', async () => {
    vi.mocked(createStorage).mockImplementationOnce(() => new Promise(() => {}));
    const prev = BOOT_TIMEOUTS.storage;
    BOOT_TIMEOUTS.storage = 30;
    try {
      const st = make();
      await st.boot();
      expect(st.getSnapshot().ready).toBe(true);
      expect(st.getSnapshot().bootError?.kind).toBe('timeout');
    } finally {
      BOOT_TIMEOUTS.storage = prev;
    }
  });

  it('si leer el almacenamiento lanza un error, se informa en lugar de colgarse', async () => {
    vi.mocked(createStorage).mockResolvedValueOnce({ kind: 'local', kv: { get: async () => { throw new Error('disco ilegible'); }, set: async () => {}, remove: async () => {} } });
    const st = make();
    await st.boot();
    expect(st.getSnapshot().bootError?.kind).toBe('unexpected');
    expect(st.getSnapshot().bootError?.details.join(' ')).toContain('disco ilegible');
  });

  it('si un día simulado mientras la app estaba cerrada falla, se conserva lo anterior y se avisa', async () => {
    const g = makeGame('egresado', 'boot-offline');
    // Guardada hace ~10 días de juego sin conexión (10 min reales por día).
    await saveGame(new LocalKV(), g, Date.now() - 10 * 10 * 60 * 1000 - 1000);
    const st = make((s) => {
      advanceDay(s);
      if (s.day === 4) throw new Error('falla offline');
    });
    await st.boot();
    const ui = st.getSnapshot();
    expect(ui.state?.day).toBe(3);
    expect(ui.simError?.context).toBe('offline');
    expect(ui.simError?.day).toBe(4);
    expect(ui.absence?.toDay).toBe(3);
  });
});

describe('Fase 1 · días que fallan en el juego', () => {
  it('la partida vuelve al día anterior, el tiempo se pausa y se puede reintentar', async () => {
    let broken = true;
    const st = make((s) => {
      advanceDay(s);
      if (broken && s.day === 5) throw new Error('falla del motor');
    });
    await st.boot();
    await st.startNewGame(NEW);
    st.setSpeed(4);
    st.step(10);
    let ui = st.getSnapshot();
    expect(ui.state?.day).toBe(4);
    expect(ui.speed).toBe(0);
    expect(ui.simError).toMatchObject({ day: 5, context: 'step', attempts: 1, message: 'falla del motor' });
    // Con el error visible no se avanza.
    st.step(3);
    expect(st.getSnapshot().state?.day).toBe(4);
    // Reintentar con el mismo problema: sigue en el día 4 y cuenta el intento.
    st.retrySimDay();
    ui = st.getSnapshot();
    expect(ui.state?.day).toBe(4);
    expect(ui.simError?.attempts).toBe(2);
    // Resuelto el problema, reintentar avanza y limpia el error.
    broken = false;
    st.retrySimDay();
    ui = st.getSnapshot();
    expect(ui.state?.day).toBe(5);
    expect(ui.simError).toBeNull();
  });

  it('importar un archivo de rescate usa la copia válida más nueva', async () => {
    const old = makeGame('egresado', 'rescue');
    const fresh = structuredClone(old);
    for (let d = 0; d < 9; d++) advanceDay(fresh);
    const file = rescueBundle({ [KEYS.primary]: 'basura', [KEYS.backups[0]]: serialize(old, 100), [KEYS.temp]: serialize(fresh, 200) }, 300, 'test');
    const st = make();
    await st.boot();
    const r = await st.importText(file);
    expect(r.ok).toBe(true);
    expect(st.getSnapshot().state?.day).toBe(9);
  });
});
