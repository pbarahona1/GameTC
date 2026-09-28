import { newGame, GameState } from '../src/engine/state';
import { acceptOffer, jobSalary } from '../src/engine/career/career';
import { JOB_BY_ID } from '../src/content/jobs';
import { checkInvariants } from '../src/engine/invariants';
import type { BackgroundId } from '../src/content/backgrounds';

export function makeGame(background: BackgroundId = 'egresado', seed = 'test-seed'): GameState {
  return newGame({ name: 'Tester', background, style: 'libre', seed, nowReal: 1 });
}

/** Contrata directamente (salta el azar de la postulación) para pruebas deterministas. */
export function forceHire(state: GameState, jobId: string, salaryUsd?: number): void {
  const job = JOB_BY_ID[jobId];
  const id = state.meta.nextId++;
  state.career.applications.push({
    id, jobId, appliedDay: state.day, resolveDay: state.day, status: 'offer', chance: 1,
    offerSalary: salaryUsd !== undefined ? salaryUsd * 100 : jobSalary(state, job), offerExpiresDay: state.day + 7, negotiated: false,
  });
  const r = acceptOffer(state, id);
  if (!r.ok) throw new Error(r.error);
}

export function expectConsistent(state: GameState): void {
  const errs = checkInvariants(state);
  if (errs.length) throw new Error('Invariantes rotos:\n' + errs.join('\n'));
}
