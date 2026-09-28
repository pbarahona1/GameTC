import { useSyncExternalStore } from 'react';

export type Tab = 'home' | 'career' | 'finance' | 'invest' | 'business' | 'more' | 'reports';

export type SheetSpec =
  | { kind: 'term'; id: string }
  | { kind: 'glossary' }
  | { kind: 'advisor' }
  | { kind: 'settings' }
  | { kind: 'progress' }
  | { kind: 'log' }
  | { kind: 'tutorial' };

interface NavState {
  tab: Tab;
  sub: Partial<Record<Tab, string>>;
  sheets: SheetSpec[];
}

let nav: NavState = { tab: 'home', sub: {}, sheets: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const navStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => nav,
  go(tab: Tab, sub?: string) {
    nav = { ...nav, tab, sub: sub ? { ...nav.sub, [tab]: sub } : nav.sub, sheets: [] };
    emit();
    window.scrollTo({ top: 0 });
  },
  setSub(tab: Tab, sub: string) {
    nav = { ...nav, sub: { ...nav.sub, [tab]: sub } };
    emit();
  },
  open(s: SheetSpec) {
    nav = { ...nav, sheets: [...nav.sheets, s] };
    emit();
  },
  close() {
    nav = { ...nav, sheets: nav.sheets.slice(0, -1) };
    emit();
  },
  closeAll() {
    nav = { ...nav, sheets: [] };
    emit();
  },
};

export function useNav(): NavState {
  return useSyncExternalStore(navStore.subscribe, navStore.get);
}
