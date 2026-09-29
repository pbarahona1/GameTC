import type { GameState } from '../state';
import { STAGES } from './progression';

/**
 * Secciones recomendadas por etapa (1.2). NO bloquean: la primera vez que entrás a
 * una sección avanzada antes de tiempo, el juego te explica por qué conviene esperar
 * y qué hacer antes; podés abrirla igual con un toque (y queda abierta), o mostrar
 * todo desde Ajustes.
 */
export interface SectionGate {
  id: string;
  name: string;
  stage: number;
  why: string;
  before: string[];
}

export const GATES: SectionGate[] = [
  { id: 'business', name: 'Negocios', stage: 3, why: 'Una empresa necesita capital, reservas para varios meses de pérdidas y tiempo para administrarla. Sin un colchón propio, un mal mes te deja sin nada.',
    before: ['Tener un ingreso estable (etapa 2)', 'Un fondo de emergencia de al menos un mes (etapa 3)', 'Proyectar el negocio antes de fundarlo'] },
  { id: 'realestate', name: 'Inmuebles', stage: 3, why: 'Un inmueble inmoviliza mucho dinero y tiene gastos aunque no esté alquilado. Las cocheras y estudios son la puerta de entrada más barata.',
    before: ['Un fondo de emergencia (etapa 3)', 'Comparar el alquiler anual con el precio (rendimiento)'] },
  { id: 'trading', name: 'Trading Pro', stage: 4, why: 'Las órdenes avanzadas y los gráficos técnicos sirven cuando ya entendés la bolsa. Empezar por un fondo índice es más simple y casi siempre mejor.',
    before: ['Haber invertido en un fondo o en acciones (etapa 4)', 'Leer el análisis de una acción en Bolsa'] },
  { id: 'mogul', name: 'Mogul Exchange', stage: 5, why: 'Son participaciones en activos poco líquidos y de riesgo alto: conviene tener antes una base sólida.', before: ['Patrimonio de $50.000 y 3 meses de reserva (etapa 5)'] },
  { id: 'gestor', name: 'Gestor de inversiones', stage: 4, why: 'Un gestor cobra comisiones todos los años: tiene sentido cuando tenés un capital que valga la pena delegar.', before: ['Primeras inversiones (etapa 4)'] },
  { id: 'holding', name: 'Holding y grupos', stage: 6, why: 'Una holding cuesta dinero todos los meses y solo aporta cuando tenés varias empresas (SRL o corporaciones) para agrupar.', before: ['Al menos una empresa rentable', 'Ingresos pasivos (etapa 6)'] },
];

export const GATE_BY_ID: Record<string, SectionGate> = Object.fromEntries(GATES.map((g) => [g.id, g]));

/** ¿Hay que mostrar la recomendación antes de abrir esta sección? */
export function gateActive(state: GameState, id: string, showAll: boolean): SectionGate | null {
  const g = GATE_BY_ID[id];
  if (!g || showAll) return null;
  if (state.progression.stage >= g.stage) return null;
  if ((state.meta.gatesOpened ?? []).includes(id)) return null;
  return g;
}

export function openGate(state: GameState, id: string): void {
  state.meta.gatesOpened = state.meta.gatesOpened ?? [];
  if (!state.meta.gatesOpened.includes(id)) state.meta.gatesOpened.push(id);
}

export function stageName(n: number): string {
  return STAGES[n - 1]?.name ?? '';
}
