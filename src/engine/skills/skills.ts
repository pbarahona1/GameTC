import { SKILL_BY_ID, SKILL_MAX_LEVEL, SkillId, xpToNext } from '../../content/skills';
import type { GameState } from '../state';
import { addLog } from '../log';

/**
 * Progresión de habilidades por experiencia.
 * - La XP solo proviene de estudio, trabajo y práctica relacionada.
 * - Práctica: rendimientos decrecientes dentro del mismo día de juego
 *   (100 %, 50 %, 25 % y luego 0) para impedir subir niveles repitiendo
 *   acciones triviales.
 */
export function addXp(state: GameState, skill: SkillId, amount: number): number {
  const def = SKILL_BY_ID[skill];
  if (!def.trainable || amount <= 0) return 0;
  const p = state.skills[skill];
  if (p.level >= SKILL_MAX_LEVEL) return 0;
  p.xp += Math.round(amount);
  let gained = 0;
  while (p.level < SKILL_MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    gained++;
  }
  if (p.level >= SKILL_MAX_LEVEL) p.xp = 0;
  if (gained > 0 && !state.meta.projection) {
    addLog(state, 'success', def.icon, `${def.name} subió a nivel ${p.level}.`);
  }
  return gained;
}

/** Multiplicador de XP de estudio por disciplina: +0,3 % por nivel (hasta +30 %). */
export function studyMultiplier(state: GameState): number {
  return 1 + Math.min(100, state.skills.discipline.level) * 0.003;
}

const PRACTICE_FACTORS = [1, 0.5, 0.25];

/** XP por práctica con rendimientos decrecientes en el mismo día. Devuelve la XP otorgada. */
export function practice(state: GameState, activity: string, skill: SkillId, xp: number): number {
  const rec = state.meta.practice[activity];
  let count = 0;
  if (rec && rec.day === state.day) count = rec.count;
  const factor = PRACTICE_FACTORS[count] ?? 0;
  state.meta.practice[activity] = { day: state.day, count: count + 1 };
  const amount = Math.round(xp * factor);
  if (amount > 0) addXp(state, skill, amount);
  return amount;
}

export function level(state: GameState, skill: SkillId): number {
  return state.skills[skill].level;
}

/** Desviación de la suerte respecto al centro (50): entre −0.03 y +0.03. */
export function luckBias(state: GameState): number {
  return ((state.skills.luck.level - 50) / 20) * 0.03;
}
