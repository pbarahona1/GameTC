import { makeGame, forceHire } from './helpers';
import { MemoryKV, saveGame, loadGame, KEYS, serialize, deserialize } from '../src/persistence/save';
import { simulateDays } from '../src/engine/simulation';
import { offlineDays, DEFAULT_OFFLINE } from '../src/persistence/offline';
import { migrate } from '../src/persistence/migrations';

describe('Guardado y recuperación', () => {
  it('guardar y cargar produce exactamente el mismo estado', async () => {
    const kv = new MemoryKV();
    const s = makeGame();
    forceHire(s, 'ventas_asistente');
    simulateDays(s, 100);
    await saveGame(kv, s, 1000);
    const r = await loadGame(kv);
    expect(r.state).toEqual(s);
    expect(r.recovered).toBe(false);
  });

  it('detecta partidas alteradas mediante checksum', () => {
    const s = makeGame();
    const text = serialize(s, 1);
    const env = JSON.parse(text);
    env.payload = env.payload.replace('"checking":180000', '"checking":99999999');
    const tampered = JSON.stringify(env);
    expect(tampered).not.toBe(text);
    const r = deserialize(tampered);
    expect(r.ok).toBe(false);
  });

  it('si la principal está dañada, recupera la copia de seguridad', async () => {
    const kv = new MemoryKV();
    const s = makeGame();
    await saveGame(kv, s, 1);
    simulateDays(s, 40);
    await saveGame(kv, s, 2); // rota la anterior a bak1
    await kv.set(KEYS.primary, '{"format":"urt-save", roto');
    const r = await loadGame(kv);
    expect(r.state).not.toBeNull();
    expect(r.recovered).toBe(true);
    expect(r.source).toBe(KEYS.backups[0]);
    expect(r.problems.length).toBe(1);
  });

  it('rechaza estados con contabilidad imposible (no se puede duplicar dinero)', async () => {
    const kv = new MemoryKV();
    const s = makeGame();
    s.ledger.balances.checking += 1_000_000; // dinero sin asiento
    const res = await saveGame(kv, s, 1);
    expect(res.ok).toBe(false);
    expect(await kv.get(KEYS.primary)).toBeNull();
  });

  it('migra partidas de la versión 0', () => {
    const s = JSON.parse(JSON.stringify(makeGame()));
    s.version = 0;
    delete s.credit.arrearsEvents;
    delete s.bank.rateNegotiations;
    const { state, migratedFrom } = migrate(s);
    expect(migratedFrom).toBe(0);
    expect(state.credit.arrearsEvents).toBe(0);
    expect(state.bank.rateNegotiations).toEqual({});
  });

  it('el progreso sin conexión tiene tope y no premia relojes que retroceden', () => {
    const h = 60 * 60 * 1000;
    expect(offlineDays(1, 1 + 5 * h, DEFAULT_OFFLINE)).toBe(30);
    expect(offlineDays(1, 1 + 25 * 60 * 1000, DEFAULT_OFFLINE)).toBe(2);
    expect(offlineDays(10_000, 5_000, DEFAULT_OFFLINE)).toBe(0);
    expect(offlineDays(1, 1 + 500 * h, { ...DEFAULT_OFFLINE, maxDays: 0 })).toBe(0);
  });
});
