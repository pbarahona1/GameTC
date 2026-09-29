import type { Cents } from '../money';
import type { JurisdictionId } from '../../content/jurisdictions';

export type PropertyType = 'vivienda' | 'local' | 'oficina' | 'terreno' | 'cochera';

export type PropertyOwner = { kind: 'personal' } | { kind: 'company'; id: number } | { kind: 'mogul'; id: string };

export interface ZoneState {
  id: string;
  /** Índice de precios de la zona (1 = base). */
  index: number;
  /** Índice de alquileres (1 = base). */
  rentIndex: number;
  history: Array<{ d: number; index: number; rentIndex: number }>;
}

export interface Lease {
  tenant: string;
  rent: Cents;
  startDay: number;
  endDay: number;
  /** Probabilidad mensual de pagar (0–1). */
  reliability: number;
  unpaidMonths: number;
}

export interface PropertyMonth {
  d: number;
  rent: Cents;
  expenses: Cents;
  tax: Cents;
  interest: Cents;
  net: Cents;
  value: Cents;
  occupied: boolean;
}

export interface Property {
  id: number;
  name: string;
  type: PropertyType;
  zoneId: string;
  jurisdiction: JurisdictionId;
  m2: number;
  /** Categoría 1–5 (terminaciones, ubicación dentro de la zona). */
  grade: number;
  /** Estado de conservación 0–100. */
  condition: number;
  /** Porción del valor que corresponde al terreno (no se deprecia). */
  landShare: number;
  owner: PropertyOwner;
  purchasePrice: Cents;
  purchaseDay: number;
  closingCosts: Cents;
  /** Costo fiscal: precio + mejoras (sin gastos de cierre, que se contabilizan como gasto). */
  costBasis: Cents;
  /** Tasación de mercado actual. */
  appraisal: Cents;
  /** Valor en el libro del dueño (personal: tasación; empresa: costo − depreciación). */
  carrying: Cents;
  accumDepreciation: Cents;
  lease: Lease | null;
  askingRent: Cents;
  listedForRent: boolean;
  vacantSince: number | null;
  management: 'propia' | 'agencia';
  /** Uso propio: vivienda del jugador o local de una empresa. */
  usedBy: 'jugador' | number | null;
  forSale: { price: Cents; since: number } | null;
  renovation: { until: number; cost: Cents; conditionGain: number; valueGain: number } | null;
  mortgageId: number | null;
  nextTaxDay: number;
  nextTaxAmount: Cents;
  monthly: PropertyMonth[];
  totals: { rent: Cents; expenses: Cents; tax: Cents; interest: Cents };
  hiddenDefect: { cost: Cents; discovered: boolean } | null;
  evictionUntil: number | null;
  /** Obra en curso sobre un terreno. */
  development: { until: number; cost: Cents; to: PropertyType; m2: number } | null;
}

export interface Mortgage {
  id: number;
  propertyId: number;
  owner: PropertyOwner;
  bankId: string;
  principal: Cents;
  balance: Cents;
  apr: number;
  rateType: 'fija' | 'variable';
  /** Diferencial sobre la tasa de política (hipotecas variables). */
  spread: number;
  termMonths: number;
  payment: Cents;
  startDay: number;
  nextDueDay: number;
  paymentsMade: number;
  missed: number;
  interestPaid: Cents;
  recourse: boolean;
  status: 'activa' | 'pagada' | 'ejecutada';
}

export interface PropertyListing {
  id: number;
  property: Property;
  askPrice: Cents;
  expiresDay: number;
  negotiated: boolean;
  note: string;
}

export interface RealEstateState {
  zones: ZoneState[];
  properties: Property[];
  mortgages: Mortgage[];
  listings: PropertyListing[];
}
