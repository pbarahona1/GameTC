// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { GameStore } from '../src/ui/store';
import { exportToFile } from '../src/persistence/platformStorage';
import { needsExportReminder, EXPORT_REMINDER, type SlotMeta } from '../src/persistence/slots';
import { listingGrossYield, listingRent, marketRent } from '../src/engine/realestate/realestate';
import { makeGame, expectConsistent } from './helpers';
import { voluntaryDisclosure, finePlan } from '../src/engine/legal/legal';
import { usd } from '../src/engine/money';

vi.mock('../src/persistence/platformStorage', async (orig) => {
  const actual = await orig<typeof import('../src/persistence/platformStorage')>();
  return { ...actual, exportToFile: vi.fn(async () => ({ ok: true, message: 'Exportada.' })) };
});

const DAY = 24 * 60 * 60 * 1000;
beforeEach(() => localStorage.clear());

describe('Fase 8 · recordatorio de exportar', () => {
  const meta = (over: Partial<SlotMeta> = {}): SlotMeta => ({ id: 'main', name: 'Ana', day: 10, netWorth: null, savedAt: 0, createdAt: 0, ...over });

  it('no molesta en la primera semana, recuerda si nunca se exportó y respeta «Más tarde»', () => {
    expect(needsExportReminder(meta(), 6 * DAY, 0)).toBe(false);
    expect(needsExportReminder(meta(), 8 * DAY, 0)).toBe(true);
    expect(needsExportReminder(meta({ exportedAt: 2 * DAY }), 20 * DAY, 0)).toBe(false);
    expect(needsExportReminder(meta({ exportedAt: 2 * DAY }), 2 * DAY + EXPORT_REMINDER.everyMs, 0)).toBe(true);
    expect(needsExportReminder(meta(), 8 * DAY, 9 * DAY)).toBe(false);
    expect(needsExportReminder(undefined, 100 * DAY, 0)).toBe(false);
  });

  it('exportar registra la fecha en la partida y los guardados siguientes la conservan', async () => {
    const st = new GameStore();
    await st.boot();
    await st.startNewGame({ name: 'Ana', background: 'egresado', style: 'libre', seed: 'exp' });
    expect(st.activeSlotMeta()?.exportedAt).toBeUndefined();
    const before = Date.now();
    await st.exportFile();
    expect(vi.mocked(exportToFile)).toHaveBeenCalled();
    const at = st.activeSlotMeta()?.exportedAt;
    expect(at).toBeGreaterThanOrEqual(before);
    st.step(3);
    await st.save();
    expect(st.activeSlotMeta()?.exportedAt).toBe(at);
    expect(st.activeSlotMeta()?.day).toBe(3);
    st.stopClock();
  });

  it('una exportación cancelada o fallida no cuenta', async () => {
    vi.mocked(exportToFile).mockResolvedValueOnce({ ok: false, message: 'Cancelada.' });
    const st = new GameStore();
    await st.boot();
    await st.startNewGame({ name: 'Beto', background: 'egresado', style: 'libre', seed: 'exp2' });
    await st.exportFile();
    expect(st.activeSlotMeta()?.exportedAt).toBeUndefined();
    st.stopClock();
  });
});

describe('Fase 8 · mercado de inmuebles ordenable por rendimiento', () => {
  it('el rendimiento bruto usa el alquiler del contrato o el de mercado, y los terrenos no rentan', () => {
    const s = makeGame('herencia', 'yield');
    for (const l of s.realEstate.listings) {
      const p = l.property;
      const rent = listingRent(s, l);
      if (p.lease) expect(rent).toBe(p.lease.rent);
      else if (p.type === 'terreno') expect(rent).toBe(0);
      else expect(rent).toBe(marketRent(s, p));
      expect(listingGrossYield(s, l)).toBeCloseTo((rent * 12) / l.askPrice, 12);
    }
  });
});

describe('Fase 8 · Android: copia de seguridad y archivos compartidos mínimos', () => {
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  it('la copia automática de Android incluye solo las partidas (no las actualizaciones descargadas)', () => {
    expect(manifest).toMatch(/android:fullBackupContent="@xml\/backup_rules"/);
    expect(manifest).toMatch(/android:dataExtractionRules="@xml\/data_extraction_rules"/);
    const full = readFileSync('android/app/src/main/res/xml/backup_rules.xml', 'utf8');
    const extraction = readFileSync('android/app/src/main/res/xml/data_extraction_rules.xml', 'utf8');
    for (const xml of [full, extraction]) {
      const includes = [...xml.matchAll(/<include domain="(\w+)" path="([^"]*)"/g)].map((m) => `${m[1]}:${m[2]}`);
      expect(new Set(includes)).toEqual(new Set(['file:saves/']));
    }
  });

  it('el FileProvider solo expone la caché (donde se escribe el archivo exportado)', () => {
    const paths = readFileSync('android/app/src/main/res/xml/file_paths.xml', 'utf8');
    expect(paths).not.toMatch(/external-path|files-path|root-path/);
    expect(paths).toMatch(/<cache-path /);
  });
});

describe('Fase 8 · hallazgos de la prueba de caos (50 semillas × 20 años)', () => {
  it('regularizar una evasión cuyo impuesto omitido es cero no crea un asiento vacío ni una deuda', () => {
    const s = makeGame('herencia', 'zero-evasion');
    s.options.illegalEnabled = true;
    s.legal.acts.push({ id: s.meta.nextId++, kind: 'evasion', day: s.day, label: 'Declaración sin diferencia', benefit: 0, amount: usd(10), evidence: 20, severity: 1, witnesses: 0, jurisdiction: s.tax.jurisdiction, statuteDay: s.day + 2000, status: 'oculto' });
    const act = s.legal.acts[s.legal.acts.length - 1];
    const fines = s.legal.fines.length;
    const r = voluntaryDisclosure(s, act.id);
    expect(r.ok).toBe(true);
    expect(act.status).toBe('regularizado');
    expect(s.legal.fines.length).toBe(fines);
    expectConsistent(s);
  });

  it('un plan de pagos sobre una multa de pocos centavos no registra un recargo de cero', () => {
    const s = makeGame('herencia', 'tiny-fine');
    s.legal.fines.push({ id: s.meta.nextId++, caseId: null, label: 'Saldo mínimo', balance: 3, original: 3, dueDay: s.day + 30, installment: null, garnishing: false });
    const f = s.legal.fines[s.legal.fines.length - 1];
    const r = finePlan(s, f.id);
    expect(r.ok).toBe(true);
    expect(f.installment).toBeGreaterThanOrEqual(1);
    expect(f.balance).toBe(3);
  });
});
