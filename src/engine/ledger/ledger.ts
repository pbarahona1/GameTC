import { ACCOUNTS, AccountId } from './accounts';
import type { Cents } from '../money';
import {
  CashFlowClass as CF, Chart, GEntry, GLedger, GLine, GPostInput, LedgerError as LE,
  emptyGLedger, gEntryDelta, gPost, gRecompute, gValidate, gArchiveOpening,
} from './core';

/**
 * Libro mayor PERSONAL: el núcleo genérico (core.ts) atado al plan de cuentas
 * personal. `post` es el único lugar donde cambian los saldos personales.
 */
export type CashFlowClass = CF;
export type JournalLine = GLine<AccountId>;
export type JournalEntry = GEntry<AccountId>;
export type LedgerState = GLedger<AccountId>;
export type PostInput = GPostInput<AccountId>;
export const LedgerError = LE;

const CHART = ACCOUNTS as unknown as Chart<AccountId>;

export function emptyLedger(): LedgerState {
  return emptyGLedger(CHART);
}

export function validateEntry(ledger: LedgerState, input: PostInput): string | null {
  return gValidate(CHART, ledger, input);
}

export function post(ledger: LedgerState, input: PostInput): JournalEntry {
  return gPost(CHART, ledger, input);
}

export function tryPost(ledger: LedgerState, input: PostInput): { ok: true; entry: JournalEntry } | { ok: false; error: string } {
  const err = validateEntry(ledger, input);
  if (err) return { ok: false, error: err };
  return { ok: true, entry: post(ledger, input) };
}

export function balance(ledger: LedgerState, account: AccountId): Cents {
  return ledger.balances[account];
}

export function recomputeBalances(entries: JournalEntry[]): Record<AccountId, Cents> {
  return gRecompute(CHART, entries);
}

/** Saldos recalculados desde cero: baldes compactados + asientos vigentes. */
export function recomputeLedger(ledger: LedgerState): Record<AccountId, Cents> {
  const r = gRecompute(CHART, ledger.entries);
  const o = gArchiveOpening(CHART, ledger);
  for (const k of Object.keys(r) as AccountId[]) r[k] += o[k];
  return r;
}

export function entryDelta(e: JournalEntry, account: AccountId): Cents {
  return gEntryDelta(CHART, e, account);
}

