import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, IconName } from '../icons';

export interface MenuItem {
  label: string;
  icon: IconName;
  onSelect: () => void;
  /** Texto chico a la derecha (por ejemplo, un contador). */
  badge?: string;
  tone?: 'danger' | 'info';
  /** Separador antes de este elemento. */
  divider?: boolean;
}

/**
 * Menú desplegable accesible: botón con aria-haspopup, lista con role="menu",
 * flechas para moverse, Escape o tocar afuera para cerrar, y el foco vuelve al botón.
 */
export function MenuButton({ label, trigger, items, className = 'icon-btn' }: { label: string; trigger: ReactNode; items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const first = list.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
    const onDown = (e: PointerEvent) => {
      if (!list.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) btn.current?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    const els = [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      els[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      els[els.length - 1]?.focus();
    }
  };

  return (
    <span className="menu-wrap">
      <button ref={btn} className={className} aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div ref={list} id={id} className="menu" role="menu" aria-label={label} onKeyDown={onKey}>
          {items.map((it) => (
            <div key={it.label} role="none">
              {it.divider && <div className="menu-sep" role="separator" />}
              <button role="menuitem" className={`menu-item ${it.tone ?? ''}`} onClick={() => { close(false); it.onSelect(); }}>
                <Icon name={it.icon} size={18} />
                <span className="grow">{it.label}</span>
                {it.badge && <span className={`menu-badge ${it.tone ?? ''}`}>{it.badge}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
