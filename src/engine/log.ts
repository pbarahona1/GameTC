import type { GameState, LogCategory, LogItem, LogKind } from './state';
import type { Cents } from './money';

const MAX_LOG = 400;

/**
 * Agrega un evento al registro. `cat` es la categoría explícita que usa la pausa
 * automática (Ajustes → pausar ante…); los eventos sin categoría solo pausan si
 * son de tipo 'danger' (ver logCategory).
 */
export function addLog(state: GameState, kind: LogKind, icon: string, text: string, amount?: Cents, cat?: LogCategory): void {
  const item: LogItem = { id: state.meta.nextId++, day: state.day, kind, icon, text, amount };
  if (cat) item.cat = cat;
  state.log.push(item);
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

/** Categoría efectiva de un evento para la pausa automática (null = no pausa). */
export function logCategory(l: LogItem): LogCategory | null {
  return l.cat ?? (l.kind === 'danger' ? 'peligro' : null);
}
