import { describe, it, expect } from 'vitest';
import { makeGame } from './helpers';
import { advanceDay } from '../src/engine/simulation';
import { MemoryKV, saveGame, loadGame, slotKeys, allKeys, restoreBackup, deleteSlot, clearPreupdate, deserializeHeader, serializeCompact, snapshotBeforeUpdate, listBackups, LEGACY_SLOT, KEYS } from '../src/persistence/save';
import { readRegistry, writeRegistry, newSlotId, upsertSlot, removeSlot } from '../src/persistence/slots';

const MIN = 60 * 1000;
const H = 60 * MIN;
const D = 24 * H;

describe('Fase 3 · recuperación de la copia válida más reciente', () => {
  it('una principal más vieja que una copia de seguridad no le gana', async () => {
    const kv = new MemoryKV();
    const g = makeGame('egresado', 'p-newest');
    const old = await serializeCompact(g, 1000);
    for (let d = 0; d < 20; d++) advanceDay(g);
    await saveGame(kv, g, 1000 + D);
    // La principal quedó con una copia vieja (por ejemplo, una escritura a medias de otra versión).
    kv.map.set(KEYS.backups[0], await serializeCompact(g, 1000 + 2 * D));
    kv.map.set(KEYS.primary, old);
    const r = await loadGame(kv);
    expect(r.source).toBe(KEYS.backups[0]);
    expect(r.state?.day).toBe(20);
  });

  it('la copia «antes de actualizar» vieja no gana a copias de seguridad recientes', async () => {
    const kv = new MemoryKV();
    const g = makeGame('egresado', 'p-preupdate');
    await saveGame(kv, g, 1000);
    await snapshotBeforeUpdate(kv);
    for (let i = 1; i <= 4; i++) {
      for (let d = 0; d < 30; d++) advanceDay(g);
      await saveGame(kv, g, 1000 + i * 2 * D);
    }
    kv.map.set(KEYS.primary, '{"format":"urt-save", rota');
    const r = await loadGame(kv);
    expect(r.source).not.toBe(KEYS.preupdate);
    expect(r.source).toBe(KEYS.backups[0]);
    expect(r.state!.day).toBeGreaterThan(30);
    expect(r.problems.length).toBeGreaterThan(0);
  });

  it('confirmar la actualización borra la copia «antes de actualizar»', async () => {
    const kv = new MemoryKV();
    await saveGame(kv, makeGame(), 1000);
    expect(await snapshotBeforeUpdate(kv)).toBe(true);
    await clearPreupdate(kv);
    expect(kv.map.has(KEYS.preupdate)).toBe(false);
  });
});

describe('Fase 3 · copias de seguridad por tiempo real', () => {
  it('jugando durante horas, las copias escalonan 10 minutos, 1 hora y 1 día', async () => {
    const kv = new MemoryKV();
    const g = makeGame('egresado', 'p-tiers');
    const t0 = 1_000_000;
    // Un guardado cada 5 minutos reales durante 30 horas.
    for (let m = 0; m <= 30 * 60; m += 5) {
      if (m % 60 === 0) advanceDay(g);
      await saveGame(kv, g, t0 + m * MIN);
    }
    const now = t0 + 30 * 60 * MIN;
    const at = (k: string) => deserializeHeader(kv.map.get(k) ?? null)!.savedAt;
    const [b1, b2, b3] = KEYS.backups.map(at);
    // Copia 1: como mucho ~10 minutos; copia 2: entre 10 y 70 minutos; copia 3: más de 1 hora.
    expect(now - b1).toBeLessThanOrEqual(15 * MIN);
    expect(now - b2).toBeGreaterThanOrEqual(10 * MIN);
    expect(now - b2).toBeLessThanOrEqual(75 * MIN);
    expect(now - b3).toBeGreaterThanOrEqual(H);
    expect(now - b3).toBeLessThanOrEqual(D + 75 * MIN);
  }, 120000);

  it('guardados seguidos (segundos) no empujan las copias fuera', async () => {
    const kv = new MemoryKV();
    const g = makeGame('egresado', 'p-burst');
    await saveGame(kv, g, 1000);
    await saveGame(kv, g, 2000);
    const first = kv.map.get(KEYS.backups[0]);
    for (let i = 0; i < 50; i++) await saveGame(kv, g, 3000 + i * 1000);
    expect(kv.map.get(KEYS.backups[0])).toBe(first);
    expect(kv.map.has(KEYS.backups[1])).toBe(false);
  });
});

describe('Fase 3 · restaurar se puede deshacer', () => {
  it('restaurar guarda la partida actual en «antes de restaurar» y restaurarla la recupera', async () => {
    const kv = new MemoryKV();
    const g = makeGame('egresado', 'p-restore');
    await saveGame(kv, g, 1000);
    for (let d = 0; d < 50; d++) advanceDay(g);
    await saveGame(kv, g, 1000 + D);
    expect(deserializeHeader(kv.map.get(KEYS.backups[0])!)!.day).toBe(0);
    const r = await restoreBackup(kv, KEYS.backups[0]);
    expect(r.ok && r.state.day).toBe(0);
    expect(deserializeHeader(kv.map.get(slotKeys().prerestore)!)!.day).toBe(50);
    const back = await restoreBackup(kv, slotKeys().prerestore);
    expect(back.ok && back.state.day).toBe(50);
    const kinds = (await listBackups(kv)).map((b) => b.kind);
    expect(kinds).toContain('antes de restaurar');
  });
});

describe('Fase 3 · varias partidas', () => {
  it('cada ranura usa claves propias y la primera es la histórica (compatible con versiones anteriores)', () => {
    expect(slotKeys(LEGACY_SLOT).primary).toBe(KEYS.primary);
    const a = allKeys(slotKeys('abc123'));
    const b = allKeys(slotKeys('xyz789'));
    expect(a.some((k) => b.includes(k))).toBe(false);
    expect(a.some((k) => allKeys(slotKeys()).includes(k))).toBe(false);
  });

  it('el índice se arma desde una instalación anterior y sobrevive a que una copia se dañe', async () => {
    const kv = new MemoryKV();
    expect((await readRegistry(kv)).slots).toEqual([]);
    const g = makeGame('egresado', 'p-reg');
    await saveGame(kv, g, 5000);
    const reg = await readRegistry(kv);
    expect(reg.active).toBe(LEGACY_SLOT);
    expect(reg.slots[0].name).toBe('Tester');
    const id = newSlotId(reg, 123456789);
    expect(id).not.toBe(LEGACY_SLOT);
    const r2 = upsertSlot({ ...reg, active: id }, { id, name: 'Otra', day: 0, netWorth: null, savedAt: 1, createdAt: 9999 });
    await writeRegistry(kv, r2);
    kv.map.set('urt.slots', '{roto');
    const again = await readRegistry(kv);
    expect(again.slots.map((s) => s.id)).toEqual([LEGACY_SLOT, id]);
    expect(removeSlot(again, id).slots.length).toBe(1);
  });

  it('borrar una partida no toca las copias de otra', async () => {
    const kv = new MemoryKV();
    const a = makeGame('egresado', 'p-a');
    const b = makeGame('herencia', 'p-b');
    await saveGame(kv, a, 1000, slotKeys('aaa'));
    await saveGame(kv, b, 1000, slotKeys('bbb'));
    await deleteSlot(kv, slotKeys('aaa'));
    expect((await loadGame(kv, slotKeys('aaa'))).state).toBeNull();
    expect((await loadGame(kv, slotKeys('bbb'))).state?.seed).toBe(b.seed);
  });
});
