import type { GameState, LogKind } from './state';
import type { Cents } from './money';

const MAX_LOG = 400;

export function addLog(state: GameState, kind: LogKind, icon: string, text: string, amount?: Cents): void {
  state.log.push({ id: state.meta.nextId++, day: state.day, kind, icon, text, amount });
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}
