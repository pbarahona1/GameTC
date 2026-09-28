/**
 * Bancos ficticios. Cada banco tiene un perfil de riesgo distinto: los más
 * exigentes prestan más barato; el prestamista de último recurso presta a casi
 * cualquiera pero muy caro y por montos pequeños.
 */
export interface BankDef {
  id: string;
  name: string;
  tagline: string;
  /** Diferencial sobre la tasa de política monetaria (puntos porcentuales). */
  spread: number;
  minScore: number;
  /** Ratio máximo de pagos de deuda / ingreso bruto mensual tras el nuevo préstamo. */
  maxDti: number;
  /** Monto máximo como múltiplo del ingreso bruto mensual. */
  maxIncomeMultiple: number;
  /** Monto máximo absoluto sin ingresos (USD). 0 = exige ingresos. */
  maxWithoutIncome: number;
  originationFee: number;
  maxTermMonths: number;
}

export const BANKS: BankDef[] = [
  { id: 'austral', name: 'Banco Austral', tagline: 'Tasas bajas, requisitos estrictos', spread: 4, minScore: 690, maxDti: 0.36, maxIncomeMultiple: 8, maxWithoutIncome: 0, originationFee: 0.01, maxTermMonths: 60 },
  { id: 'andino', name: 'Crédito Andino', tagline: 'Equilibrio entre costo y acceso', spread: 8, minScore: 620, maxDti: 0.43, maxIncomeMultiple: 5, maxWithoutIncome: 0, originationFee: 0.02, maxTermMonths: 48 },
  { id: 'finarapido', name: 'FinaRápido', tagline: 'Aprobación fácil, costo alto', spread: 28, minScore: 450, maxDti: 0.5, maxIncomeMultiple: 2, maxWithoutIncome: 600, originationFee: 0.05, maxTermMonths: 24 },
];

export const BANK_BY_ID: Record<string, BankDef> = Object.fromEntries(BANKS.map((b) => [b.id, b]));

/** Diferencial de la tarjeta de crédito sobre la tasa de política. */
export const CARD_SPREAD = 22;
