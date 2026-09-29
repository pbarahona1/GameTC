/**
 * Niveles de tarjeta de crédito (emisor ficticio: Banco de Valoria).
 * Cada nivel tiene requisitos, costo anual y beneficios que funcionan en el juego:
 *  - reintegro (cashback) sobre TODO lo que pagás con la tarjeta, acreditado en cada resumen;
 *  - límite según tus ingresos (o patrimonio);
 *  - cuotas sin interés en tiendas adheridas;
 *  - bonificación de imagen en tiendas (te reconocen como cliente de alto nivel);
 *  - rebaja de la tasa de interés.
 */
export type CardTier = 'clasica' | 'oro' | 'platino' | 'black';

export interface CardTierDef {
  id: CardTier;
  name: string;
  /** Degradé para dibujar la tarjeta. */
  colors: [string, string];
  ink: string;
  annualFee: number;
  cashback: number;
  minScore: number;
  /** Ingreso bruto mensual mínimo (USD) … */
  minIncome: number;
  /** … o, alternativamente, patrimonio neto mínimo (USD). */
  minNetWorth: number;
  /** Antigüedad crediticia mínima (días desde tu primera cuenta). */
  minHistoryDays: number;
  /** Límite = ingreso mensual × multiplicador (con tope). */
  limitMult: number;
  limitCap: number;
  /** Límite mínimo del nivel (USD). */
  limitFloor: number;
  /** Cuotas sin interés máximas en tiendas adheridas. */
  freeInstallments: number;
  /** Puntos de imagen extra en tiendas. */
  storeImage: number;
  /** Rebaja de tasa anual (fracción). */
  aprDiscount: number;
  perks: string[];
}

export const CARD_TIERS: CardTierDef[] = [
  { id: 'clasica', name: 'Clásica', colors: ['#5d6b7a', '#3b4652'], ink: '#f2f4f7', annualFee: 0, cashback: 0, minScore: 0, minIncome: 0, minNetWorth: 0, minHistoryDays: 0,
    limitMult: 1, limitCap: 5000, limitFloor: 400, freeInstallments: 0, storeImage: 0, aprDiscount: 0,
    perks: ['Sin costo anual', 'Cuotas con interés en cualquier tienda'] },
  { id: 'oro', name: 'Oro', colors: ['#d8b24c', '#9c7a23'], ink: '#231a05', annualFee: 95, cashback: 0.01, minScore: 680, minIncome: 2500, minNetWorth: 40000, minHistoryDays: 180,
    limitMult: 2, limitCap: 15000, limitFloor: 2500, freeInstallments: 3, storeImage: 3, aprDiscount: 0.01,
    perks: ['1 % de reintegro en todas tus compras', 'Hasta 3 cuotas sin interés en tiendas adheridas', 'Tasa 1 punto más baja'] },
  { id: 'platino', name: 'Platino', colors: ['#dfe3ea', '#8e98a8'], ink: '#1a1f27', annualFee: 395, cashback: 0.015, minScore: 730, minIncome: 6000, minNetWorth: 150000, minHistoryDays: 365,
    limitMult: 3, limitCap: 50000, limitFloor: 8000, freeInstallments: 6, storeImage: 8, aprDiscount: 0.02,
    perks: ['1,5 % de reintegro', 'Hasta 6 cuotas sin interés', 'Te reconocen en tiendas premium (+8 de imagen)', 'Tasa 2 puntos más baja'] },
  { id: 'black', name: 'Black', colors: ['#2a2a2e', '#0b0b0d'], ink: '#e9d9a8', annualFee: 1200, cashback: 0.02, minScore: 780, minIncome: 20000, minNetWorth: 1000000, minHistoryDays: 730,
    limitMult: 5, limitCap: 250000, limitFloor: 30000, freeInstallments: 12, storeImage: 15, aprDiscount: 0.03,
    perks: ['2 % de reintegro', 'Hasta 12 cuotas sin interés', 'Acceso preferente en tiendas de lujo (+15 de imagen)', 'Tasa 3 puntos más baja'] },
];

export const CARD_TIER_BY_ID: Record<CardTier, CardTierDef> = Object.fromEntries(CARD_TIERS.map((t) => [t.id, t])) as Record<CardTier, CardTierDef>;
export const CARD_TIER_ORDER: CardTier[] = ['clasica', 'oro', 'platino', 'black'];
