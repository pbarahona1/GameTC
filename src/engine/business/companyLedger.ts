import type { Chart, GLedger, GPostInput, GEntry } from '../ledger/core';
import { emptyGLedger, gPost, gValidate, gPeriodTotals } from '../ledger/core';
import type { Cents } from '../money';

/**
 * Plan de cuentas de cada empresa (libro mayor propio, separado del personal).
 * Grupos del estado de resultados:
 *  cogs   → costo de ventas (insumos, mermas, costos variables directos)
 *  opex   → gastos operativos
 *  dep    → depreciación
 *  fin    → intereses y recargos
 *  tax    → impuesto empresarial
 */
export const CO_ACCOUNTS = {
  cash: { name: 'Caja y bancos', type: 'asset', noNegative: true, cashEquivalent: true, term: 'liquidez' },
  receivables: { name: 'Cuentas por cobrar', type: 'asset', noNegative: true, term: 'cuentas_por_cobrar' },
  inventory: { name: 'Inventario', type: 'asset', noNegative: true, term: 'inventario' },
  in_transit: { name: 'Mercadería pagada en tránsito', type: 'asset', noNegative: true, term: 'inventario' },
  deposits_paid: { name: 'Depósitos en garantía', type: 'asset', noNegative: true },
  fixed_assets: { name: 'Activo fijo (neto)', type: 'asset', noNegative: true, term: 'depreciacion' },
  real_estate: { name: 'Inmuebles (costo neto)', type: 'asset', noNegative: true, term: 'inmueble' },
  subsidiaries: { name: 'Inversiones en subsidiarias', type: 'asset', noNegative: true, term: 'subsidiaria' },
  ic_receivable: { name: 'Préstamos a empresas del grupo', type: 'asset', noNegative: true, term: 'prestamo_intragrupo' },
  payables: { name: 'Cuentas por pagar a proveedores', type: 'liability', noNegative: true, term: 'cuentas_por_pagar' },
  arrears: { name: 'Deudas vencidas', type: 'liability', noNegative: true, term: 'mora' },
  taxes_payable: { name: 'Impuestos por pagar', type: 'liability', noNegative: true, term: 'impuesto_empresarial' },
  loans: { name: 'Préstamos bancarios', type: 'liability', noNegative: true, term: 'prestamo' },
  mortgages: { name: 'Hipotecas', type: 'liability', noNegative: true, term: 'hipoteca' },
  ic_payable: { name: 'Deudas con empresas del grupo', type: 'liability', noNegative: true, term: 'prestamo_intragrupo' },
  capital: { name: 'Capital aportado', type: 'equity', term: 'capital_aportado' },
  distributions: { name: 'Dividendos y retiros', type: 'equity', term: 'dividendos' },
  sales: { name: 'Ventas', type: 'income', term: 'ingresos_vs_beneficio' },
  other_income: { name: 'Otros ingresos', type: 'income' },
  rental_income: { name: 'Ingresos por alquileres', type: 'income', term: 'alquiler' },
  gain_on_sale: { name: 'Resultado por venta de activos', type: 'income' },
  ic_income: { name: 'Ingresos intragrupo (intereses y honorarios)', type: 'income', term: 'prestamo_intragrupo' },
  subsidiary_results: { name: 'Resultado de subsidiarias (exento)', type: 'income', term: 'subsidiaria' },
  cogs: { name: 'Costo de insumos vendidos', type: 'expense', group: 'cogs', term: 'costo_ventas' },
  variable_costs: { name: 'Costos variables directos', type: 'expense', group: 'cogs', term: 'costo_ventas' },
  waste: { name: 'Mermas y vencimientos', type: 'expense', group: 'cogs', term: 'mermas' },
  wages: { name: 'Sueldos', type: 'expense', group: 'opex', term: 'nomina' },
  payroll_taxes: { name: 'Cargas sociales y prestaciones', type: 'expense', group: 'opex', term: 'nomina' },
  rent: { name: 'Alquiler', type: 'expense', group: 'opex' },
  utilities: { name: 'Servicios', type: 'expense', group: 'opex' },
  marketing: { name: 'Marketing', type: 'expense', group: 'opex', term: 'marketing' },
  maintenance: { name: 'Mantenimiento y reparaciones', type: 'expense', group: 'opex' },
  logistics: { name: 'Fletes de compras', type: 'expense', group: 'opex' },
  storage: { name: 'Almacenamiento', type: 'expense', group: 'opex', term: 'inventario' },
  admin: { name: 'Gastos administrativos y legales', type: 'expense', group: 'opex' },
  sales_fees: { name: 'Comisiones de cobro', type: 'expense', group: 'opex', term: 'comision' },
  bad_debts: { name: 'Incobrables', type: 'expense', group: 'opex', term: 'cuentas_por_cobrar' },
  training: { name: 'Capacitación y reclutamiento', type: 'expense', group: 'opex' },
  property_costs: { name: 'Gastos de inmuebles', type: 'expense', group: 'opex', term: 'gastos_inmueble' },
  property_tax: { name: 'Impuesto inmobiliario', type: 'expense', group: 'opex', term: 'impuesto_inmobiliario' },
  professional_fees: { name: 'Honorarios profesionales', type: 'expense', group: 'opex', term: 'profesionales' },
  undocumented: { name: 'Pagos no documentados (ficticio)', type: 'expense', group: 'opex', term: 'soborno' },
  depreciation: { name: 'Depreciación', type: 'expense', group: 'dep', term: 'depreciacion' },
  interest: { name: 'Intereses', type: 'expense', group: 'fin', term: 'interes' },
  penalties: { name: 'Recargos y multas', type: 'expense', group: 'fin', term: 'mora' },
  ic_expense: { name: 'Gastos intragrupo (intereses y honorarios)', type: 'expense', group: 'fin', term: 'prestamo_intragrupo' },
  fines: { name: 'Sanciones legales', type: 'expense', group: 'fin', term: 'multa' },
  liquidation_loss: { name: 'Pérdidas por venta forzada de activos', type: 'expense', group: 'fin', term: 'quiebra' },
  corporate_tax: { name: 'Impuesto empresarial', type: 'expense', group: 'tax', term: 'impuesto_empresarial' },
} as const satisfies Chart<string>;

export type CoAccountId = keyof typeof CO_ACCOUNTS;
export const CO_CHART = CO_ACCOUNTS as unknown as Chart<CoAccountId>;
export const CO_ACCOUNT_IDS = Object.keys(CO_ACCOUNTS) as CoAccountId[];
export type CoLedger = GLedger<CoAccountId>;
export type CoEntry = GEntry<CoAccountId>;
export type CoPostInput = GPostInput<CoAccountId>;

export function emptyCoLedger(): CoLedger {
  return emptyGLedger(CO_CHART);
}

export function coPost(ledger: CoLedger, input: CoPostInput): CoEntry {
  return gPost(CO_CHART, ledger, input);
}

export function coTryPost(ledger: CoLedger, input: CoPostInput): { ok: true; entry: CoEntry } | { ok: false; error: string } {
  const err = gValidate(CO_CHART, ledger, input);
  if (err) return { ok: false, error: err };
  return { ok: true, entry: coPost(ledger, input) };
}

export function coPeriodTotals(ledger: CoLedger, from: number, to: number): Record<CoAccountId, Cents> {
  return gPeriodTotals(CO_CHART, ledger, from, to);
}

export function coGroup(id: CoAccountId): string | undefined {
  return (CO_ACCOUNTS[id] as { group?: string }).group;
}
