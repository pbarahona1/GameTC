import { describe, it, expect } from 'vitest';
import { makeGame, forceHire, expectConsistent } from './helpers';
import { advanceDay } from '../src/engine/simulation';
import { post } from '../src/engine/ledger/ledger';
import { coPost } from '../src/engine/business/companyLedger';
import { usd } from '../src/engine/money';
import { foundCompany, foundHolding, transferToGroup, liquidate, revalueChain } from '../src/engine/business/ownership';
import { buyEquipment, sellEquipment } from '../src/engine/business/operations';
import { SECTOR_BY_ID } from '../src/content/sectors';
import type { GameState } from '../src/engine/state';

function rich(seed: string, amount = 500000): GameState {
  const s = makeGame('herencia', seed);
  post(s.ledger, { day: 0, memo: 'Capital de prueba', cf: 'internal', lines: [{ account: 'checking', debit: usd(amount) }, { account: 'opening_equity', credit: usd(amount) }] });
  s.credit.score = 760;
  return s;
}

describe('Fase 4 · holding con subsidiaria sin valor', () => {
  it('la quiebra de una holding cuya subsidiaria vale 0 no rompe la contabilidad ni lanza errores', () => {
    const s = rich('fix-holding');
    expect(foundCompany(s, { sector: 'cafeteria', name: 'Sub Cero', legalForm: 'srl', capital: usd(80000) }).ok).toBe(true);
    const sub = s.companies[s.companies.length - 1];
    expect(foundHolding(s, { name: 'Grupo Prueba', legalForm: 'srl', capital: usd(30000) }).ok).toBe(true);
    const h = s.companies[s.companies.length - 1];
    expect(transferToGroup(s, sub.id, h.id).ok).toBe(true);
    // La subsidiaria pierde todo: deudas mayores que sus activos (patrimonio negativo, valor 0).
    const cash = sub.ledger.balances.cash;
    coPost(sub.ledger, { day: s.day, memo: 'Pérdida total', cf: 'operating', lines: [{ account: 'admin', debit: cash + usd(50000) }, { account: 'cash', credit: cash }, { account: 'arrears', credit: usd(50000) }] });
    revalueChain(s, sub);
    expect(sub.carrying).toBe(0);
    expect(() => liquidate(s, h, 'bankruptcy')).not.toThrow();
    expect(s.companies.some((c) => c.id === sub.id)).toBe(false);
    expectConsistent(s);
  });
});

describe('Fase 4 · equipos amortizados', () => {
  it('un equipo con valor contable 0 se puede dar de baja sin un asiento inválido', () => {
    const s = rich('fix-equip');
    expect(foundCompany(s, { sector: 'cafeteria', name: 'Café', legalForm: 'srl', capital: usd(80000) }).ok).toBe(true);
    const co = s.companies[0];
    const eq = SECTOR_BY_ID[co.sector].equipment[0];
    expect(buyEquipment(s, co, eq.id).ok).toBe(true);
    const a = co.assets[co.assets.length - 1];
    // Totalmente amortizado.
    coPost(co.ledger, { day: s.day, memo: 'Amortización total', cf: 'internal', lines: [{ account: 'depreciation', debit: a.bookValue }, { account: 'fixed_assets', credit: a.bookValue }] });
    a.bookValue = 0;
    const before = co.assets.length;
    const r = sellEquipment(s, co, a.id);
    expect(r.ok).toBe(true);
    expect(co.assets.length).toBe(before - 1);
    expectConsistent(s);
  });
});

describe('Fase 4 · reglas del motor', () => {
  it('el gerente delegado elige el proveedor con mejor relación calidad/precio (a igual calidad, el más barato)', async () => {
    const { weeklyManager } = await import('../src/engine/business/manager');
    const { supplierUnitCost, supplierAccessible } = await import('../src/engine/business/inventory');
    const s = rich('fix-manager');
    expect(foundCompany(s, { sector: 'cafeteria', name: 'Café Delegado', legalForm: 'srl', capital: usd(80000) }).ok).toBe(true);
    const co = s.companies[0];
    const sec = SECTOR_BY_ID[co.sector];
    // Un gerente con delegación de reposición.
    co.delegation.autoReorder = true;
    for (let d = 0; d < 40; d++) advanceDay(s);
    const { hasManager } = await import('../src/engine/business/common');
    if (!hasManager(co)) co.employees.push({ ...co.employees[0], id: s.meta.nextId++, role: 'gerente', skill: 80 });
    expect(hasManager(co)).toBe(true);
    weeklyManager(s, co);
    for (const r of co.rules) {
      const options = sec.suppliers.filter((x) => x.itemId === r.item && supplierAccessible(s, x));
      if (options.length < 2) continue;
      const chosen = options.find((x) => x.id === r.supplierId)!;
      const best = Math.max(...options.map((x) => x.quality / supplierUnitCost(s, x)));
      expect(chosen.quality / supplierUnitCost(s, chosen)).toBeCloseTo(best, 9);
    }
  });

  it('inspeccionar informa el vicio oculto pero no lo borra: si comprás igual, pagás la reparación', async () => {
    const { inspectListing, buyProperty } = await import('../src/engine/realestate/realestate');
    const s = rich('fix-inspect');
    const l = s.realEstate.listings.find((x) => x.askPrice < usd(200000))!;
    l.property.hiddenDefect = { cost: usd(3000), discovered: false };
    expect(inspectListing(s, l.id).ok).toBe(true);
    expect(l.property.hiddenDefect?.discovered).toBe(true);
    const checking = s.ledger.balances.checking;
    const expense = s.ledger.balances.property_expenses ?? 0;
    const r = buyProperty(s, l.id, { owner: { kind: 'personal' } });
    expect(r.ok).toBe(true);
    const p = s.realEstate.properties.find((x) => x.name === l.property.name)!;
    expect(p.hiddenDefect).toBeNull();
    expect((s.ledger.balances.property_expenses ?? 0) - expense).toBeGreaterThanOrEqual(usd(3000));
    expect(checking - s.ledger.balances.checking).toBeGreaterThan(l.askPrice);
    expectConsistent(s);
  });

  it('con abogado, la inspección consigue UNA consecuencia: rebaja equivalente, y la reparación la paga el comprador', async () => {
    const { inspectListing } = await import('../src/engine/realestate/realestate');
    const s = rich('fix-lawyer');
    const l = s.realEstate.listings[0];
    l.property.hiddenDefect = { cost: usd(2500), discovered: false };
    const ask = l.askPrice;
    // Abogado personal contratado.
    s.pros.hires.push({ id: s.meta.nextId++, since: s.day, scope: 'personal', pro: { id: s.meta.nextId++, name: 'Dra. Prueba', kind: 'abogado', specialty: 'Inmobiliario', experience: 10, fee: 0, reputation: 70, quality: 70 } } as never);
    const r = inspectListing(s, l.id);
    expect(r.ok).toBe(true);
    expect(l.askPrice).toBe(ask - usd(2500));
    expect(l.property.hiddenDefect).toEqual({ cost: usd(2500), discovered: true });
  });

  it('viviendo en tu casa, un atraso no provoca un "desalojo"', async () => {
    const { processRecurring, applyHomeRent } = await import('../src/engine/finance/budget');
    const s = rich('fix-home');
    const l = s.realEstate.listings.find((x) => x.property.type === 'vivienda' && !x.property.lease)!;
    const { buyProperty, setUse } = await import('../src/engine/realestate/realestate');
    expect(buyProperty(s, l.id, { owner: { kind: 'personal' } }).ok).toBe(true);
    const p = s.realEstate.properties[s.realEstate.properties.length - 1];
    expect(setUse(s, p.id, 'jugador').ok).toBe(true);
    applyHomeRent(s);
    // Un atraso cualquiera (por ejemplo, la luz).
    post(s.ledger, { day: s.day, memo: 'Atraso de prueba', cf: 'internal', lines: [{ account: 'utilities', debit: usd(50) }, { account: 'arrears', credit: usd(50) }] });
    const lifestyle = s.budget.lifestyle;
    while ((s.day % 31) !== 2 || new Date(Date.UTC(2026, 0, 1 + s.day)).getUTCDate() !== 2) s.day++;
    const logBefore = s.log.length;
    processRecurring(s);
    expect(s.budget.lifestyle).toBe(lifestyle);
    expect(s.log.slice(logBefore).some((x) => x.text.startsWith('Desalojo'))).toBe(false);
  });

  it('desde prisión no se puede postular ni aceptar un empleo', async () => {
    const { apply, acceptOffer } = await import('../src/engine/career/career');
    const s = rich('fix-prison');
    s.legal.prison = { since: s.day, until: s.day + 180, reason: 'prueba' } as never;
    const job = (await import('../src/content/jobs')).JOBS[0];
    const r = apply(s, job.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/prisión/);
    // Una oferta previa tampoco se puede aceptar estando preso.
    const id = s.meta.nextId++;
    s.career.applications.push({ id, jobId: job.id, appliedDay: s.day, resolveDay: s.day, status: 'offer', chance: 1, offerSalary: usd(1000), offerExpiresDay: s.day + 7, negotiated: false });
    const a = acceptOffer(s, id);
    expect(a.ok).toBe(false);
    s.legal.prison = null as never;
    forceHire(s, job.id);
  });
});
