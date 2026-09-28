import type { GameState } from '../state';
import { stocksDay } from './stocks';
import { bondsDay } from './bonds';
import { fundsDay } from './funds';
import { mogulDay } from './mogul';
import { revalueInvestments } from './portfolio';

/**
 * Día de los mercados financieros. Orden: acciones → bonos → fondos (que
 * dependen de ambos) → Mogul Exchange → valuación a mercado de la cartera
 * personal (un solo asiento por día, solo si hubo cambios).
 */
export function investmentsDay(state: GameState): void {
  stocksDay(state);
  bondsDay(state);
  fundsDay(state);
  mogulDay(state);
  revalueInvestments(state);
}
