import { Cents, applyRate, roundCents, usd } from '../money';
import type { Jurisdiction, JurisdictionId } from '../../content/jurisdictions';

/**
 * Sistema tributario de la jurisdicción ficticia "República de Valdoria".
 * Las reglas están escritas como datos para poder agregar más jurisdicciones
 * en la Fase 4 (cada una con ventajas y desventajas distintas).
 *
 * CONCEPTOS QUE EL JUEGO DISTINGUE:
 * - Deducción: reduce la BASE imponible (el ingreso sobre el que se calcula el impuesto).
 *   Su valor real depende de tu tasa marginal.
 * - Crédito fiscal: reduce el IMPUESTO calculado, dólar por dólar. Aquí es no
 *   reembolsable: nunca puede volver el impuesto negativo ni generar dinero.
 * - Retención: impuesto adelantado que el empleador descuenta de cada nómina.
 */
export type { Bracket, Jurisdiction, JurisdictionId } from '../../content/jurisdictions';
export { VALDORIA, JURISDICTIONS, JURISDICTION_BY_ID, jurisdictionById } from '../../content/jurisdictions';

export interface BracketSlice {
  from: number;
  to: number | null;
  rate: number;
  taxedAmount: Cents;
  tax: Cents;
}

/** Impuesto progresivo anual sobre una base imponible en centavos, con desglose. */
export function progressiveTax(j: Jurisdiction, taxable: Cents): { tax: Cents; slices: BracketSlice[] } {
  let remaining = Math.max(0, taxable);
  let lower = 0;
  let tax = 0;
  const slices: BracketSlice[] = [];
  for (const b of j.incomeBrackets) {
    const upper = b.upTo === null ? Infinity : usd(b.upTo);
    const width = upper - lower;
    const inBracket = Math.min(remaining, width);
    if (inBracket <= 0) break;
    const t = roundCents(inBracket * b.rate);
    slices.push({ from: lower, to: b.upTo === null ? null : upper, rate: b.rate, taxedAmount: inBracket, tax: t });
    tax += t;
    remaining -= inBracket;
    lower = upper;
  }
  return { tax, slices };
}

export function marginalRate(j: Jurisdiction, taxable: Cents): number {
  for (const b of j.incomeBrackets) {
    const upper = b.upTo === null ? Infinity : usd(b.upTo);
    if (taxable < upper) return b.rate;
  }
  return j.incomeBrackets[j.incomeBrackets.length - 1].rate;
}

export interface PayrollBreakdown {
  gross: Cents;
  pensionEmployee: Cents;
  socialSecurity: Cents;
  taxableMonthly: Cents;
  incomeTaxWithheld: Cents;
  net: Cents;
}

/**
 * Nómina mensual: bruto → neto.
 * La retención se calcula anualizando el salario del mes (método de retención
 * uniforme) y dividiendo el impuesto anual entre 12.
 */
export function payroll(j: Jurisdiction, gross: Cents, pensionRate: number): PayrollBreakdown {
  const pensionEmployee = applyRate(gross, pensionRate);
  const ssBase = Math.min(gross, usd(j.socialSecurityMonthlyCap));
  const socialSecurity = applyRate(ssBase, j.socialSecurityRate);
  const deductiblePension = Math.min(pensionEmployee, applyRate(gross, j.maxPensionDeductionRate));
  const taxableMonthly = gross - deductiblePension;
  const annualTax = progressiveTax(j, taxableMonthly * 12).tax;
  const incomeTaxWithheld = roundCents(annualTax / 12);
  const net = gross - pensionEmployee - socialSecurity - incomeTaxWithheld;
  return { gross, pensionEmployee, socialSecurity, taxableMonthly, incomeTaxWithheld, net };
}

export interface YearToDate {
  year: number;
  /** Jurisdicción de residencia durante ese año fiscal. */
  jurisdiction?: JurisdictionId;
  wages: Cents;
  bonuses: Cents;
  interest: Cents;
  pensionEmployee: Cents;
  socialSecurity: Cents;
  withheld: Cents;
  educationSpent: Cents;
  /** Resultado de empresas transparentes (individual, sociedad): puede ser negativo. */
  business?: Cents;
  /** Cupones de bonos cobrados (renta ordinaria). */
  bondInterest?: Cents;
  /** Alquileres cobrados y gastos deducibles de inmuebles alquilados. */
  rentalIncome?: Cents;
  rentalExpenses?: Cents;
  rentalInterest?: Cents;
  /** Σ (costo del edificio × días en alquiler): base para la depreciación fiscal. */
  rentalBuildingDays?: number;
  /** Ganancias de capital realizadas (precio − costo), según plazo de tenencia. */
  gainsShort?: Cents;
  gainsLong?: Cents;
  /** Comisiones de compraventa de títulos (reducen la ganancia de capital). */
  investFees?: Cents;
  /** Dividendos cobrados (ya retenidos en la fuente; informativo). */
  dividends?: Cents;
}

export function emptyYtd(year: number, jurisdiction: JurisdictionId = 'valdoria'): YearToDate {
  return {
    year, jurisdiction, wages: 0, bonuses: 0, interest: 0, pensionEmployee: 0, socialSecurity: 0, withheld: 0, educationSpent: 0, business: 0,
    bondInterest: 0, rentalIncome: 0, rentalExpenses: 0, rentalInterest: 0, rentalBuildingDays: 0, gainsShort: 0, gainsLong: 0, investFees: 0, dividends: 0,
  };
}

export interface TaxComputation {
  year: number;
  jurisdiction?: JurisdictionId;
  grossIncome: Cents;
  deductions: Cents;
  taxable: Cents;
  taxBeforeCredits: Cents;
  credits: Cents;
  taxAfterCredits: Cents;
  withheld: Cents;
  /** Positivo = a pagar; negativo = devolución. */
  balance: Cents;
  effectiveRate: number;
  marginalRate: number;
  slices: BracketSlice[];
  /** Detalle (Fase 4). */
  rentalNet?: Cents;
  rentalDepreciation?: Cents;
  capitalGainsTaxable?: Cents;
  capitalGainsTax?: Cents;
  lossCarryUsed?: Cents;
  lossCarryCreated?: Cents;
  hiddenIncome?: Cents;
  deductionLines?: Array<{ label: string; amount: Cents }>;
}

export interface TaxContext {
  /** Pérdidas de capital de años anteriores disponibles. */
  lossCarry: Cents;
  /** Fracción de deducciones documentales que se reclaman (contador, habilidad de contabilidad). */
  deductionCapture: number;
  /** Fracción de ingresos no salariales que se ocultan (evasión; 0 = declaración honesta). */
  underreport: number;
}

export const HONEST: TaxContext = { lossCarry: 0, deductionCapture: 1, underreport: 0 };

/** Depreciación fiscal de edificios alquilados en el año. */
export function rentalDepreciation(j: Jurisdiction, ytd: YearToDate): Cents {
  if (!j.rental.depreciationYears) return 0;
  return roundCents((ytd.rentalBuildingDays ?? 0) / 365 / j.rental.depreciationYears);
}

/** Declaración anual. Pura: sirve también para simular escenarios fiscales. */
export function computeAnnualTax(j: Jurisdiction, ytd: YearToDate, ctx: TaxContext = HONEST): TaxComputation {
  const lines: Array<{ label: string; amount: Cents }> = [];
  // Alquileres
  const depreciation = roundCents(rentalDepreciation(j, ytd) * ctx.deductionCapture);
  const interestDed = j.rental.mortgageInterestDeductible ? roundCents((ytd.rentalInterest ?? 0) * ctx.deductionCapture) : 0;
  const rentalNet = (ytd.rentalIncome ?? 0) - (ytd.rentalExpenses ?? 0) - interestDed - depreciation;
  const rentalOrdinary = rentalNet >= 0 || j.rental.lossOffsetsOrdinary ? rentalNet : 0;
  if (depreciation) lines.push({ label: 'Depreciación fiscal de inmuebles alquilados', amount: depreciation });
  if (interestDed) lines.push({ label: 'Intereses hipotecarios de inmuebles alquilados', amount: interestDed });
  // Ocultamiento (evasión): solo ingresos no salariales positivos.
  const nonWage = ytd.interest + (ytd.bondInterest ?? 0) + Math.max(0, rentalOrdinary) + Math.max(0, ytd.business ?? 0);
  const hiddenOrdinary = roundCents(nonWage * ctx.underreport);
  // Las pérdidas de empresas transparentes y de alquiler compensan otros ingresos (nunca por debajo de cero).
  const grossIncome = ytd.wages + ytd.bonuses + ytd.interest + (ytd.bondInterest ?? 0) + rentalOrdinary + (ytd.business ?? 0) - hiddenOrdinary;
  const maxPension = applyRate(ytd.wages + ytd.bonuses, j.maxPensionDeductionRate);
  const deductions = Math.min(ytd.pensionEmployee, maxPension);
  if (deductions) lines.push({ label: 'Aportes a jubilación', amount: deductions });
  const taxable = Math.max(0, grossIncome - deductions);
  const { tax, slices } = progressiveTax(j, taxable);
  const creditRaw = Math.min(applyRate(ytd.educationSpent, j.educationCreditRate), usd(j.educationCreditMax));
  const credits = Math.min(creditRaw, tax); // no reembolsable
  const taxAfterCredits = tax - credits;

  // Ganancias de capital: las comisiones y las pérdidas compensan primero la porción de corto plazo.
  let shortG = (ytd.gainsShort ?? 0) - (ytd.investFees ?? 0);
  let longG = ytd.gainsLong ?? 0;
  if (shortG < 0) {
    longG += shortG;
    shortG = 0;
  } else if (longG < 0) {
    shortG += longG;
    longG = 0;
  }
  let lossCarryUsed = 0;
  let lossCarryCreated = 0;
  const net = shortG + longG;
  if (net < 0) {
    lossCarryCreated = j.capitalGains.lossCarryYears > 0 ? -net : 0;
    shortG = 0;
    longG = 0;
  } else if (net > 0 && ctx.lossCarry > 0) {
    lossCarryUsed = Math.min(ctx.lossCarry, net);
    const fromShort = Math.min(shortG, lossCarryUsed);
    shortG -= fromShort;
    longG -= lossCarryUsed - fromShort;
  }
  const hideShort = roundCents(shortG * ctx.underreport);
  const hideLong = roundCents(longG * ctx.underreport);
  shortG -= hideShort;
  longG -= hideLong;
  const capitalGainsTax = roundCents(shortG * j.capitalGains.shortRate + longG * j.capitalGains.longRate);
  const balance = taxAfterCredits + capitalGainsTax - ytd.withheld;
  const totalIncome = grossIncome + shortG + longG;
  return {
    year: ytd.year,
    jurisdiction: j.id,
    grossIncome,
    deductions,
    taxable,
    taxBeforeCredits: tax,
    credits,
    taxAfterCredits,
    withheld: ytd.withheld,
    balance,
    effectiveRate: totalIncome > 0 ? (taxAfterCredits + capitalGainsTax) / totalIncome : 0,
    marginalRate: marginalRate(j, taxable),
    slices,
    rentalNet,
    rentalDepreciation: depreciation,
    capitalGainsTaxable: shortG + longG,
    capitalGainsTax,
    lossCarryUsed,
    lossCarryCreated,
    hiddenIncome: hiddenOrdinary + hideShort + hideLong,
    deductionLines: lines,
  };
}
