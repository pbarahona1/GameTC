import { describe, it, expect } from 'vitest';
import { parseMoney, parseQuantity, parseUnits, fmtMoney, fmtAmountInput, fmtNumber } from '../src/engine/format';

const cents = (t: string) => {
  const r = parseMoney(t);
  return r.ok ? r.cents : `ERROR: ${r.error}`;
};

describe('Fase 2 · lector único de montos', () => {
  it('los ejemplos del pedido tienen un resultado definido', () => {
    expect(cents('150')).toBe(15000);
    expect(cents('1,500')).toBe(150000);
    expect(cents('15,000')).toBe(1500000);
    expect(cents('150,000')).toBe(15000000);
    expect(cents('150.000')).toBe(15000000);
    expect(cents('150000')).toBe(15000000);
  });

  it('acepta el formato que muestra la app, con "$", espacios y decimales', () => {
    expect(cents('$150,000.00')).toBe(15000000);
    expect(cents(' $ 1,234,567.89 ')).toBe(123456789);
    expect(cents(fmtMoney(987654321).replace('$', ''))).toBe(987654321);
    expect(cents('1,500.5')).toBe(150050);
    expect(cents('0.29')).toBe(29);
    expect(cents('.5')).toBe(50);
  });

  it('acepta el formato con punto de miles y coma decimal cuando no es ambiguo', () => {
    expect(cents('1.500,50')).toBe(150050);
    expect(cents('1.500.000')).toBe(150000000);
    expect(cents('12,5')).toBe(1250);
    expect(cents('12,50')).toBe(1250);
  });

  it('mientras se escribe, un separador final no rompe el valor', () => {
    expect(cents('150.')).toBe(15000);
    expect(cents('1,500.')).toBe(150000);
  });

  it('vacío no es cero: es "sin valor"', () => {
    expect(cents('')).toBeNull();
    expect(cents('   ')).toBeNull();
  });

  it('rechaza formatos inválidos o ambiguos con una explicación', () => {
    for (const bad of ['1,500,50', '1.5.6', '10.1234', '1,50,000', '12,34,567', '1.500,000', '150.0001', '1,5000', 'abc', '15o', '-5', '1e5', '1,500.123']) {
      const r = parseMoney(bad);
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(10);
    }
  });

  it('no pierde centavos con montos grandes (aritmética entera)', () => {
    expect(cents('90,071,992,547,409.91')).toBe(Number.MAX_SAFE_INTEGER);
    expect(cents('1,234,567,890.12')).toBe(123456789012);
    const r = parseMoney('90,071,992,547,409.92');
    expect(r.ok).toBe(false);
  });

  it('lo que muestra el campo se vuelve a leer igual', () => {
    for (const c of [0, 1, 99, 100, 150050, 15000000, 123456789]) {
      const t = fmtAmountInput(c);
      expect(cents(t) ?? 0).toBe(c);
    }
  });
});

describe('Fase 2 · cantidades', () => {
  it('enteros con separador de miles', () => {
    expect(parseQuantity('1,500')).toEqual({ ok: true, value: 1500 });
    expect(parseQuantity('12')).toEqual({ ok: true, value: 12 });
    expect(parseQuantity('1.5').ok).toBe(false);
  });

  it('decimales cuando el campo los admite', () => {
    expect(parseQuantity('2.5', 1)).toEqual({ ok: true, value: 2.5 });
    expect(parseQuantity('2,5', 1)).toEqual({ ok: true, value: 2.5 });
    expect(parseQuantity('0.75', 2)).toEqual({ ok: true, value: 0.75 });
    // Un separador con 3 dígitos detrás es de miles, y "0" no puede ser un grupo de miles: es un error, no 755.
    expect(parseQuantity('0.755', 2).ok).toBe(false);
    expect(parseMoney('0,500').ok).toBe(false);
    expect(parseQuantity('0.7555', 2).ok).toBe(false);
  });

  it('parseUnits devuelve enteros exactos', () => {
    expect(parseUnits('1,234.56', 2)).toEqual({ ok: true, units: 123456 });
  });
});

describe('Fase 2 · formato de números único', () => {
  it('dinero y números usan el mismo separador de miles', () => {
    expect(fmtMoney(15000000)).toBe('$150,000.00');
    expect(fmtMoney(-15000050)).toBe('−$150,000.50');
    expect(fmtNumber(1234567)).toBe('1,234,567');
    expect(fmtNumber(1234.5, 1)).toBe('1,234.5');
    expect(fmtNumber(-3)).toBe('−3');
  });
});

describe('Fase 2 · validaciones del motor para montos', async () => {
  const { makeGame, forceHire } = await import('./helpers');
  const { buyProperty, quickSalePrice, buyerWeeklyChance, tenantWeeklyChance, rentNoFasterBelow, QUICK_SALE_RATIO } = await import('../src/engine/realestate/realestate');
  const { takeLoan } = await import('../src/engine/finance/loans');

  it('una oferta de 0 no compra al precio publicado: se rechaza', () => {
    const s = makeGame('herencia', 'zero-offer');
    const l = s.realEstate.listings[0];
    const before = s.realEstate.properties.length;
    const r = buyProperty(s, l.id, { owner: { kind: 'personal' }, offer: 0 });
    expect(r.ok).toBe(false);
    expect(s.realEstate.properties.length).toBe(before);
  });

  it('un préstamo de 0 se rechaza sin registrar una consulta de crédito', () => {
    const s = makeGame('herencia', 'zero-loan');
    forceHire(s, 'ventas_asistente');
    const inquiries = JSON.stringify(s.credit);
    expect(takeLoan(s, 'andino', 0, 12).ok).toBe(false);
    expect(JSON.stringify(s.credit)).toBe(inquiries);
  });

  it('la venta rápida y las probabilidades salen de una sola fórmula del motor', () => {
    const s = makeGame('herencia', 'sale-curve');
    const l = s.realEstate.listings[0];
    const p = l.property;
    expect(quickSalePrice(p)).toBe(Math.round(p.appraisal * QUICK_SALE_RATIO));
    const atPrice = buyerWeeklyChance(s, p.appraisal, p.appraisal);
    expect(buyerWeeklyChance(s, Math.round(p.appraisal * 1.2), p.appraisal)).toBeLessThan(atPrice);
    expect(buyerWeeklyChance(s, Math.round(p.appraisal * 0.5), p.appraisal)).toBe(0.7);
  });

  it('por debajo del alquiler umbral, pedir menos ya no acelera el inquilino', () => {
    const s = makeGame('herencia', 'rent-curve');
    const p = s.realEstate.listings.find((x) => x.property.type === 'vivienda')!.property;
    const floor = rentNoFasterBelow(s, p);
    expect(floor).toBeGreaterThan(0);
    expect(tenantWeeklyChance(s, p, Math.round(floor * 0.98))).toBeCloseTo(0.9, 6);
    expect(tenantWeeklyChance(s, p, Math.round(floor * 1.05))).toBeLessThan(0.9);
  });
});
