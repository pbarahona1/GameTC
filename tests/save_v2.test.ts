import { makeGame } from './helpers';
import { MemoryKV, saveGame, loadGame, serialize, deserialize, KEYS, type KV } from '../src/persistence/save';
import { MirroredKV } from '../src/persistence/platformStorage';
import { simulateDays } from '../src/engine/simulation';
import { foundCompany } from '../src/engine/business/ownership';
import { checkInvariants } from '../src/engine/invariants';
import { post } from '../src/engine/ledger/ledger';
import { SAVE_VERSION } from '../src/engine/state';
import { usd } from '../src/engine/money';

function richGame() {
  const s = makeGame();
  post(s.ledger, { day: s.day, memo: 'Fondos de prueba', cf: 'internal', lines: [{ account: 'checking', debit: usd(40000) }, { account: 'opening_equity', credit: usd(40000) }] });
  return s;
}

class FailingKV implements KV {
  async get(): Promise<string | null> {
    throw new Error('almacén caído');
  }
  async set(): Promise<void> {
    throw new Error('almacén caído');
  }
  async remove(): Promise<void> {
    throw new Error('almacén caído');
  }
}

describe('Guardado v2 (empresas) y almacenamiento espejado', () => {
  it('una partida con empresas se guarda y se recupera idéntica', async () => {
    const s = richGame();
    const r = foundCompany(s, { sector: 'minimarket', name: 'Almacén', legalForm: 'srl', capital: usd(20000) });
    expect(r.ok).toBe(true);
    simulateDays(s, 120);
    expect(s.companies.length).toBe(1);
    const kv = new MemoryKV();
    expect((await saveGame(kv, s, 5)).ok).toBe(true);
    const back = await loadGame(kv);
    expect(back.state).toEqual(s);
    // y sigue simulando coherentemente después de cargar
    simulateDays(back.state!, 60);
    expect(checkInvariants(back.state!)).toEqual([]);
  });

  it('migra una partida v1 (Fase 1, sin empresas) a la versión actual y pasa todas las invariantes', () => {
    const s = makeGame();
    simulateDays(s, 45);
    const v1 = JSON.parse(JSON.stringify(s));
    v1.version = 1;
    delete v1.companies;
    delete v1.listings;
    delete v1.formerCompanies;
    delete v1.markets;
    delete v1.tax.ytd.business;
    for (const a of ['business_equity', 'business_results', 'dividend_tax', 'capital_gains_tax', 'acquisition_costs']) delete v1.ledger.balances[a];
    const text = serialize(v1, 1);
    const res = deserialize(text);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.migratedFrom).toBe(1);
    expect(res.state.version).toBe(SAVE_VERSION);
    expect(res.state.companies).toEqual([]);
    expect(Object.keys(res.state.markets).length).toBeGreaterThan(0);
    expect(res.state.ledger.balances.business_equity).toBe(0);
    expect(checkInvariants(res.state)).toEqual([]);
    simulateDays(res.state, 60);
    expect(checkInvariants(res.state)).toEqual([]);
  });

  it('MirroredKV escribe en ambos almacenes y lee del espejo si el principal está vacío', async () => {
    const a = new MemoryKV();
    const b = new MemoryKV();
    const m = new MirroredKV(a, b);
    const s = makeGame();
    expect((await saveGame(m, s, 1)).ok).toBe(true);
    expect(await a.get(KEYS.primary)).not.toBeNull();
    expect(await b.get(KEYS.primary)).toBe(await a.get(KEYS.primary));
    await a.remove(KEYS.primary); // p. ej. el sistema borró las preferencias
    const r = await loadGame(m);
    expect(r.state).toEqual(s);
  });

  it('MirroredKV sigue funcionando si uno de los almacenes falla', async () => {
    const good = new MemoryKV();
    const m = new MirroredKV(new FailingKV(), good);
    const s = makeGame();
    expect((await saveGame(m, s, 1)).ok).toBe(true);
    const r = await loadGame(m);
    expect(r.state).toEqual(s);
    const both = new MirroredKV(new FailingKV(), new FailingKV());
    await expect(both.set('x', 'y')).rejects.toThrow();
  });
});
