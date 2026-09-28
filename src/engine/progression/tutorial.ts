import type { GameState } from '../state';

/**
 * Guía de inicio opcional. Cada paso se completa por el ESTADO real de la
 * partida (no por pulsar "siguiente"), puede omitirse y nunca bloquea nada.
 */
export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  tab: 'home' | 'career' | 'finance' | 'business' | 'reports';
  done: (s: GameState) => boolean;
  future?: string;
}

export const TUTORIAL: TutorialStep[] = [
  { id: 'networth', title: 'Interpretá tu patrimonio neto', body: 'Tocá el ⓘ junto a "Patrimonio neto" en Inicio. Es lo que tenés menos lo que debés: la medida real de tu riqueza.', tab: 'home', done: (s) => s.meta.seenTerms.includes('patrimonio_neto') },
  { id: 'cash', title: 'Administrá tu efectivo', body: 'En Finanzas → Cuentas, mové dinero entre efectivo, cuenta corriente y ahorro. La cuenta corriente paga tus gastos; el ahorro genera intereses.', tab: 'finance', done: (s) => s.ledger.entries.some((e) => e.tag === 'transfer') },
  { id: 'income', title: 'Conseguí ingresos', body: 'En Carrera → Empleos, postulate a un puesto cuyos requisitos cumplas. Postularte a varios a la vez aumenta tus chances.', tab: 'career', done: (s) => s.career.job !== null || s.career.history.length > 0 },
  { id: 'save', title: 'Empezá a ahorrar', body: 'Transferí parte de tu dinero a la cuenta de ahorro. Es la base de tu fondo de emergencia.', tab: 'finance', done: (s) => s.ledger.balances.savings > 0 },
  { id: 'invest', title: 'Hacé tu primera inversión', body: 'Abrí un depósito a plazo en Finanzas → Inversión. Rinde más que el ahorro a cambio de inmovilizar el dinero.', tab: 'finance', done: (s) => s.bank.deposits.length > 0 || s.progression.achievements.first_deposit_matured !== undefined },
  { id: 'company', title: 'Fundá o comprá una empresa', body: 'En Negocios elegí un sector y una forma legal. No necesitás empleo previo: solo capital suficiente (la consultora es la opción más barata).', tab: 'business', done: (s) => s.companies.length > 0 || s.formerCompanies.length > 0 },
  { id: 'inventory', title: 'Comprá inventario', body: 'En tu empresa → Inventario, hacé un pedido a un proveedor o ajustá las reglas de reposición. Mirá los días de cobertura y el riesgo de faltante.', tab: 'business', done: (s) => s.meta.practice.purchase_order !== undefined },
  { id: 'staff', title: 'Administrá empleados', body: 'En tu empresa → Personal, contratá, capacitá o ajustá salarios. La moral depende del salario frente al mercado.', tab: 'business', done: (s) => s.meta.practice.hire !== undefined || s.meta.practice.train !== undefined },
  { id: 'profit', title: 'Calculá tus beneficios', body: 'Abrí Informes → Resultados. Verás la diferencia entre ingresos brutos, resultado antes de impuestos y resultado neto.', tab: 'reports', done: (s) => s.meta.seenTerms.includes('estado_resultados') },
  { id: 'liquidity', title: 'Evitá problemas de liquidez', body: 'Abrí el Asesor IA (🧭 arriba). Calcula con tus datos cuántos meses de efectivo te quedan y qué opciones tenés.', tab: 'home', done: (s) => s.meta.seenTerms.includes('asesor') },
];
