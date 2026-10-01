// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameStore, BOOT_TIMEOUTS, AUTOSAVE } from '../src/ui/store';
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

  it('con todas las copias ilegibles: muestra el error, no borra nada y la partida nueva va a otra ranura', async () => {
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
    expect(await st.startNewGame(NEW)).toBe(true);
    await st.save();
    // La partida dañada sigue intacta en su ranura y la nueva tiene la suya.
    expect(localStorage.getItem(KEYS.primary)).toBe(broken);
    expect(localStorage.getItem(KEYS.backups[0])).toBe(broken + ' ');
    const slots = st.getSnapshot().slots;
    expect(slots.length).toBe(2);
    expect(st.getSnapshot().activeSlot).not.toBe('main');
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

describe('Fase 3 · partidas y guardado automático', () => {
  it('dos partidas en dos ranuras: se cambia entre ellas sin perder ninguna', async () => {
    const st = make();
    await st.boot();
    await st.startNewGame({ ...NEW, name: 'Ana', seed: 'ana' });
    st.step(10);
    await st.save();
    const anaSlot = st.getSnapshot().activeSlot!;
    await st.requestNewGame();
    expect(st.getSnapshot().state).toBeNull();
    expect(st.getSnapshot().returnSlot).toBe(anaSlot);
    await st.startNewGame({ ...NEW, name: 'Beto', seed: 'beto' });
    st.step(3);
    await st.save();
    expect(st.getSnapshot().slots.map((x) => x.name)).toEqual(['Ana', 'Beto']);
    expect(await st.openSlot(anaSlot)).toBe(true);
    expect(st.getSnapshot().state?.player.name).toBe('Ana');
    expect(st.getSnapshot().state?.day).toBe(10);
    // La partida abierta no se puede borrar; la otra sí, sin tocar a Ana.
    expect(await st.deleteSlotById(anaSlot)).toBe(false);
    const beto = st.getSnapshot().slots.find((x) => x.name === 'Beto')!.id;
    expect(await st.deleteSlotById(beto)).toBe(true);
    expect(st.getSnapshot().slots.map((x) => x.name)).toEqual(['Ana']);
    expect(st.getSnapshot().state?.day).toBe(10);
  });

  it('con el máximo de partidas no se crea otra (y no se pisa ninguna)', async () => {
    const st = make();
    await st.boot();
    for (const n of ['A', 'B', 'C']) {
      expect(await st.startNewGame({ ...NEW, name: n, seed: n })).toBe(true);
      await st.requestNewGame();
    }
    expect(await st.startNewGame({ ...NEW, name: 'D', seed: 'D' })).toBe(false);
    expect(st.getSnapshot().slots.map((x) => x.name)).toEqual(['A', 'B', 'C']);
  });

  it('importar abre la partida importada en otra ranura y conserva la actual', async () => {
    const st = make();
    await st.boot();
    await st.startNewGame({ ...NEW, name: 'Actual', seed: 'act' });
    st.step(5);
    const other = makeGame('herencia', 'import-me');
    const r = await st.importText(serialize(other, 1));
    expect(r.ok).toBe(true);
    const ui = st.getSnapshot();
    expect(ui.state?.player.name).toBe('Tester');
    expect(ui.slots.map((x) => x.name)).toEqual(['Actual', 'Tester']);
    const actual = ui.slots.find((x) => x.name === 'Actual')!;
    expect(actual.day).toBe(5);
  });

  it('nunca hay dos guardados a la vez: los pedidos simultáneos se agrupan', async () => {
    let writing = 0;
    let maxWriting = 0;
    let primaryWrites = 0;
    const slow = {
      get: async (k: string) => localStorage.getItem(k),
      set: async (k: string, v: string) => {
        writing++;
        maxWriting = Math.max(maxWriting, writing);
        await new Promise((res) => setTimeout(res, 15));
        if (k.endsWith('.primary') || k === KEYS.primary) primaryWrites++;
        localStorage.setItem(k, v);
        writing--;
      },
      remove: async (k: string) => localStorage.removeItem(k),
    };
    vi.mocked(createStorage).mockResolvedValueOnce({ kind: 'local', kv: slow });
    const st = make();
    await st.boot();
    await st.startNewGame(NEW);
    primaryWrites = 0;
    const results = await Promise.all([st.save(), st.save(), st.save(), st.save(), st.save()]);
    expect(results.every(Boolean)).toBe(true);
    expect(maxWriting).toBe(1);
    expect(primaryWrites).toBeLessThanOrEqual(2);
  });

  it('se guarda solo al pausar y poco después de una decisión', async () => {
    const prev = AUTOSAVE.afterActionMs;
    AUTOSAVE.afterActionMs = 20;
    try {
      const st = make();
      await st.boot();
      await st.startNewGame(NEW);
      const t0 = st.getSnapshot().lastSaved;
      st.setSpeed(2);
      st.step(3);
      st.setSpeed(0);
      await new Promise((r) => setTimeout(r, 50));
      const t1 = st.getSnapshot().lastSaved;
      expect(t1).not.toBeNull();
      expect(t1! >= (t0 ?? 0)).toBe(true);
      expect(st.isDirty()).toBe(false);
      st.run((s) => { s.meta.seenTerms.push('prueba'); return { ok: true }; }, { toast: false });
      expect(st.isDirty()).toBe(true);
      await new Promise((r) => setTimeout(r, 120));
      expect(st.isDirty()).toBe(false);
    } finally {
      AUTOSAVE.afterActionMs = prev;
    }
  });
});
