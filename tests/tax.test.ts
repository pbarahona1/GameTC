import { progressiveTax, VALDORIA, payroll, computeAnnualTax, emptyYtd, marginalRate } from '../src/engine/tax/incomeTax';
import { usd } from '../src/engine/money';

describe('Impuestos progresivos (Valdoria)', () => {
  it('aplica cada tasa solo a la porción de su tramo', () => {
    // 30,000: 0% de 9,600 + 10% de 14,400 + 20% de 6,000 = 1,440 + 1,200 = 2,640
    expect(progressiveTax(VALDORIA, usd(30000)).tax).toBe(usd(2640));
    expect(progressiveTax(VALDORIA, usd(9600)).tax).toBe(0);
    // 200,000: 1,440 + 7,200 + 27,000 + 50,000*0.37=18,500 → 54,140
    expect(progressiveTax(VALDORIA, usd(200000)).tax).toBe(usd(54140));
  });

  it('distingue tasa marginal de tasa efectiva', () => {
    const inc = usd(30000);
    expect(marginalRate(VALDORIA, inc)).toBe(0.2);
    const eff = progressiveTax(VALDORIA, inc).tax / inc;
    expect(eff).toBeCloseTo(0.088, 3);
  });

  it('nómina: bruto → neto con aportes, seguridad social y retención', () => {
    const p = payroll(VALDORIA, usd(2000), 0.05);
    expect(p.pensionEmployee).toBe(usd(100));
    expect(p.socialSecurity).toBe(usd(140));
    // taxable 1900*12 = 22,800 → 10% de 13,200 = 1,320/año = 110/mes
    expect(p.incomeTaxWithheld).toBe(usd(110));
    expect(p.net).toBe(usd(2000 - 100 - 140 - 110));
  });

  it('la deducción reduce la base; el crédito reduce el impuesto y no es reembolsable', () => {
    const y = { ...emptyYtd(2026), wages: usd(30000) };
    const noDed = computeAnnualTax(VALDORIA, y);
    const withDed = computeAnnualTax(VALDORIA, { ...y, pensionEmployee: usd(3000) });
    // Deducir 3,000 en el tramo del 20 % ahorra 600
    expect(noDed.taxBeforeCredits - withDed.taxBeforeCredits).toBe(usd(600));
    const withCredit = computeAnnualTax(VALDORIA, { ...y, educationSpent: usd(2000) });
    // Crédito: 15 % de 2,000 = 300, dólar por dólar
    expect(noDed.taxAfterCredits - withCredit.taxAfterCredits).toBe(usd(300));
    // Sin impuesto, el crédito no genera dinero
    const low = computeAnnualTax(VALDORIA, { ...emptyYtd(2026), wages: usd(5000), educationSpent: usd(100000) });
    expect(low.credits).toBe(0);
    expect(low.taxAfterCredits).toBe(0);
    expect(low.balance).toBe(0);
  });

  it('la deducción de jubilación tiene tope del 15 %', () => {
    const y = { ...emptyYtd(2026), wages: usd(20000), pensionEmployee: usd(10000) };
    expect(computeAnnualTax(VALDORIA, y).deductions).toBe(usd(3000));
  });
});
