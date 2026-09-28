import type { GameState } from '../state';
import type { ProKind, Professional } from './types';

/** Profesional contratado de un tipo para un ámbito (personal o una empresa). */
export function hiredPro(state: GameState, kind: ProKind, scope: 'personal' | number): Professional | null {
  const h = state.pros?.hires.find((x) => x.pro.kind === kind && x.scope === scope);
  return h ? h.pro : null;
}

/** Contratación completa (incluye id y caso asignado). */
export function hireOf(state: GameState, kind: ProKind, scope: 'personal' | number) {
  return state.pros?.hires.find((x) => x.pro.kind === kind && x.scope === scope) ?? null;
}
