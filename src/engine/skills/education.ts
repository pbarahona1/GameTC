import { COURSE_BY_ID, CourseDef } from '../../content/courses';
import { EDUCATION_RANK, EDUCATION_NAMES, FIELD_NAMES } from '../../content/jobs';
import { SKILL_BY_ID, SkillId } from '../../content/skills';
import { Cents, usd } from '../money';
import type { GameState } from '../state';
import { addLog } from '../log';
import { ActionResult, FAIL, OK } from '../result';
import { fmtMoney } from '../format';
import { addXp, studyMultiplier } from './skills';
import { payExpense } from '../finance/payments';

export const MAX_ACTIVE_COURSES = 2;
export const TUITION_PERIOD_DAYS = 30;

export function coursePrice(state: GameState, c: CourseDef): Cents {
  return usd((c.cost ?? 0) * state.macro.priceIndex);
}

export function tuition(state: GameState, c: CourseDef): Cents {
  return usd((c.monthlyTuition ?? 0) * state.macro.priceIndex);
}

/** Costo total estimado (a precios de hoy). */
export function courseTotalCost(state: GameState, c: CourseDef): Cents {
  if (c.monthlyTuition) return tuition(state, c) * Math.ceil(c.durationDays / TUITION_PERIOD_DAYS);
  return coursePrice(state, c);
}

export function studyHoursPerWeek(state: GameState): number {
  return state.education.active.reduce((s, a) => s + (COURSE_BY_ID[a.courseId]?.hoursPerWeek ?? 0), 0);
}

export function courseRequirements(state: GameState, c: CourseDef): Array<{ label: string; met: boolean }> {
  const items: Array<{ label: string; met: boolean }> = [];
  if (c.requires?.education) {
    items.push({ label: `Educación: ${EDUCATION_NAMES[c.requires.education]}`, met: EDUCATION_RANK[state.education.level] >= EDUCATION_RANK[c.requires.education] });
  }
  for (const [sk, lvl] of Object.entries(c.requires?.skills ?? {})) {
    const have = state.skills[sk as SkillId].level;
    items.push({ label: `${SKILL_BY_ID[sk as SkillId].name} nivel ${lvl} (tenés ${have})`, met: have >= (lvl as number) });
  }
  return items;
}

export function timesCompleted(state: GameState, courseId: string): number {
  return state.education.completed.filter((c) => c.courseId === courseId).length;
}

function recordEducationSpend(state: GameState, amount: Cents): void {
  state.tax.ytd.educationSpent += amount;
}

export function enroll(state: GameState, courseId: string): ActionResult {
  const c = COURSE_BY_ID[courseId];
  if (!c) return FAIL('Curso inexistente.');
  if (state.education.active.some((a) => a.courseId === courseId)) return FAIL('Ya estás cursando esto.');
  if (state.education.active.length >= MAX_ACTIVE_COURSES) return FAIL(`Podés cursar como máximo ${MAX_ACTIVE_COURSES} estudios a la vez.`);
  if (c.kind === 'titulo' && timesCompleted(state, c.id) > 0) return FAIL('Ya obtuviste este título.');
  const unmet = courseRequirements(state, c).filter((r) => !r.met);
  if (unmet.length) return FAIL('Requisitos: ' + unmet.map((r) => r.label).join('; '));
  const first = c.monthlyTuition ? tuition(state, c) : coursePrice(state, c);
  const res = payExpense(state, 'education', first, { memo: c.monthlyTuition ? `Matrícula: ${c.name}` : c.name, tag: 'education', method: 'checking', allowArrears: false });
  if (!res.ok) return FAIL(`No tenés fondos para pagar ${fmtMoney(first)}.`);
  recordEducationSpend(state, first);
  state.education.active.push({ courseId, startDay: state.day, endDay: state.day + c.durationDays, granted: {} });
  addLog(state, 'info', '🎓', `Comenzaste: ${c.name}. Termina en ${c.durationDays} días (${c.hoursPerWeek} h/semana).`, first);
  return OK('Inscripción realizada.');
}

export function dropCourse(state: GameState, courseId: string): ActionResult {
  const i = state.education.active.findIndex((a) => a.courseId === courseId);
  if (i < 0) return FAIL('No estás cursando eso.');
  state.education.active.splice(i, 1);
  addLog(state, 'warning', '🎓', `Abandonaste ${COURSE_BY_ID[courseId].name}. Conservás la XP ya obtenida; lo pagado no se reembolsa.`);
  return OK('Curso abandonado.');
}

/** Progreso diario: reparte la XP exacta, cobra matrículas y otorga credenciales. */
export function processEducation(state: GameState): void {
  const mult = studyMultiplier(state);
  for (const a of [...state.education.active]) {
    const c = COURSE_BY_ID[a.courseId];
    const elapsed = Math.min(c.durationDays, state.day - a.startDay);
    // Repetir un curso ya completado rinde solo el 20 % (no se puede farmear).
    const repeatFactor = timesCompleted(state, c.id) > 0 ? 0.2 : 1;
    for (const [sk, total] of Object.entries(c.xp)) {
      const target = Math.floor(((total as number) * mult * repeatFactor * elapsed) / c.durationDays);
      const done = a.granted[sk as SkillId] ?? 0;
      if (target > done) {
        addXp(state, sk as SkillId, target - done);
        a.granted[sk as SkillId] = target;
      }
    }
    if (c.monthlyTuition && elapsed > 0 && elapsed < c.durationDays && elapsed % TUITION_PERIOD_DAYS === 0) {
      const t = tuition(state, c);
      const res = payExpense(state, 'education', t, { memo: `Matrícula: ${c.name}`, tag: 'education', method: 'checking', allowArrears: false });
      if (res.ok) recordEducationSpend(state, t);
      else {
        state.education.active = state.education.active.filter((x) => x !== a);
        addLog(state, 'danger', '🎓', `No pudiste pagar la matrícula de ${c.name}: quedaste dado de baja.`);
        continue;
      }
    }
    if (state.day >= a.endDay) complete(state, c);
  }
}

function complete(state: GameState, c: CourseDef): void {
  state.education.active = state.education.active.filter((x) => x.courseId !== c.id);
  state.education.completed.push({ courseId: c.id, day: state.day });
  const g = c.grants;
  const parts: string[] = [];
  if (g?.education && EDUCATION_RANK[g.education] > EDUCATION_RANK[state.education.level]) {
    state.education.level = g.education;
    parts.push(`nivel educativo ${EDUCATION_NAMES[g.education]}`);
  }
  if (g?.field && !state.education.fields.includes(g.field)) {
    state.education.fields.push(g.field);
    parts.push(`título en ${FIELD_NAMES[g.field]}`);
  }
  if (g?.certificate && !state.education.certificates.includes(g.certificate)) {
    state.education.certificates.push(g.certificate);
    parts.push(`certificado "${g.certificate}"`);
  }
  if (g?.network) state.player.attributes.network = Math.min(100, state.player.attributes.network + g.network);
  addXp(state, 'discipline', c.kind === 'titulo' ? 3000 : c.kind === 'libro' ? 150 : 400);
  addLog(state, 'success', '🎓', `Completaste ${c.name}${parts.length ? ': obtuviste ' + parts.join(', ') : ''}.`);
}
