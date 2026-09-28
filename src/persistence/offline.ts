/**
 * Progreso sin conexión.
 * Mientras la app está cerrada, el tiempo de juego avanza a un ritmo reducido
 * y con tope, aplicando EXACTAMENTE las mismas reglas que el juego en vivo
 * (no hay atajos que generen dinero). Si el reloj del sistema retrocede,
 * no se otorga progreso.
 */
export interface OfflineConfig {
  /** Milisegundos reales por día de juego mientras la app está cerrada. */
  realMsPerDay: number;
  /** Tope de días simulados por ausencia. 0 = desactivado. */
  maxDays: number;
}

export const DEFAULT_OFFLINE: OfflineConfig = { realMsPerDay: 10 * 60 * 1000, maxDays: 30 };

export function offlineDays(lastRealTime: number, now: number, cfg: OfflineConfig): number {
  if (!lastRealTime || cfg.maxDays <= 0) return 0;
  const elapsed = now - lastRealTime;
  if (elapsed <= 0) return 0;
  return Math.min(cfg.maxDays, Math.floor(elapsed / cfg.realMsPerDay));
}
