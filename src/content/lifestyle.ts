import type { AccountId } from '../engine/ledger/accounts';

export type LifestyleId = 'austero' | 'modesto' | 'comodo' | 'acomodado' | 'lujoso';

export interface LifestyleDef {
  id: LifestyleId;
  name: string;
  description: string;
  /** Importes mensuales en USD a precios del año inicial. */
  items: Array<{ key: string; name: string; account: AccountId; amount: number; day: number; essential: boolean }>;
  /** Puntos de estrés por mes (negativo = alivia). */
  stress: number;
  /** Puntos de salud por mes. */
  health: number;
  reputation: number;
}

function items(rent: number, food: number, transport: number, utilities: number, phone: number, leisure: number) {
  return [
    { key: 'rent', name: 'Alquiler', account: 'housing' as const, amount: rent, day: 1, essential: true },
    { key: 'food', name: 'Supermercado y comidas', account: 'food' as const, amount: food, day: 5, essential: true },
    { key: 'transport', name: 'Transporte', account: 'transport' as const, amount: transport, day: 5, essential: true },
    { key: 'utilities', name: 'Luz, agua e internet', account: 'utilities' as const, amount: utilities, day: 10, essential: true },
    { key: 'phone', name: 'Plan de teléfono', account: 'utilities' as const, amount: phone, day: 10, essential: true },
    { key: 'leisure', name: 'Ocio y salidas', account: 'leisure' as const, amount: leisure, day: 15, essential: false },
  ];
}

export const LIFESTYLES: LifestyleDef[] = [
  { id: 'austero', name: 'Austero', description: 'Habitación compartida, cocinar todo, transporte público. Ahorra mucho pero desgasta.', items: items(300, 180, 40, 30, 15, 20), stress: 3, health: -1, reputation: -1 },
  { id: 'modesto', name: 'Modesto', description: 'Estudio pequeño, gastos controlados, alguna salida al mes.', items: items(450, 250, 60, 45, 25, 60), stress: 0, health: 0, reputation: 0 },
  { id: 'comodo', name: 'Cómodo', description: 'Apartamento de una habitación, auto usado, salidas frecuentes.', items: items(900, 400, 180, 90, 45, 200), stress: -3, health: 1, reputation: 1 },
  { id: 'acomodado', name: 'Acomodado', description: 'Apartamento amplio en buena zona, auto nuevo, viajes cortos.', items: items(1800, 650, 450, 150, 60, 500), stress: -5, health: 2, reputation: 2 },
  { id: 'lujoso', name: 'Lujoso', description: 'Casa de lujo, chofer, restaurantes y viajes. Imagen alta, costo altísimo.', items: items(4500, 1200, 1100, 300, 120, 2000), stress: -7, health: 2, reputation: 3 },
];

export const LIFESTYLE_BY_ID: Record<LifestyleId, LifestyleDef> = Object.fromEntries(LIFESTYLES.map((l) => [l.id, l])) as Record<LifestyleId, LifestyleDef>;

/** Seguro médico privado si el empleo no lo incluye (USD/mes). */
export const PRIVATE_HEALTH_INSURANCE = 70;
