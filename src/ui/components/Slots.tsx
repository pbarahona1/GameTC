import { useEffect, useState } from 'react';
import { store, useUI } from '../store';
import { navStore } from '../nav';
import { MAX_SLOTS } from '../../persistence/slots';
import { formatDate } from '../../engine/time/calendar';
import { fmtMoney } from '../../engine/format';
import { ConfirmButton } from './common';
import { Icon } from '../icons';

/** "hace 23 segundos", "hace 4 min"… */
export function agoText(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 10) return 'hace un momento';
  if (s < 60) return `hace ${s} segundos`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

/** Cuándo se guardó la partida por última vez (se actualiza solo). */
export function SavedAgo({ className = 'tiny muted' }: { className?: string }) {
  const ui = useUI();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);
  const at = ui.lastSaved;
  return <span className={className} aria-live="off">{ui.saveError ? 'No se pudo guardar' : at ? `Guardado ${agoText(Math.max(now, at) - at)}` : 'Sin guardar todavía'}</span>;
}

/**
 * Las partidas guardadas en el dispositivo: abrir, exportar sus copias o
 * borrarlas. La partida abierta no se puede borrar desde acá.
 */
export function SlotList({ onOpened }: { onOpened?: () => void }) {
  const ui = useUI();
  if (!ui.slots.length) return null;
  const openId = ui.state ? ui.activeSlot : null;
  return (
    <div className="rows slot-list">
      {ui.slots.map((sl, i) => {
        const isOpen = sl.id === openId;
        return (
          <div className={`row slot ${isOpen ? 'on' : ''}`} key={sl.id}>
            <div className="grow">
              <div className="title small">Partida {i + 1} · {sl.name} {isOpen && <span className="pill accent">Abierta</span>}</div>
              <div className="meta">
                {formatDate(sl.day)}{sl.netWorth !== null ? ` · patrimonio ${fmtMoney(sl.netWorth, { decimals: false })}` : ''} · {sl.savedAt ? `guardada ${agoText(Date.now() - sl.savedAt)}` : 'sin guardar'}
              </div>
            </div>
            <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
              {!isOpen && <button className="btn sm" onClick={async () => { if (await store.openSlot(sl.id)) { navStore.closeAll(); onOpened?.(); } }}>Abrir</button>}
              <button className="btn sm ghost" aria-label={`Exportar copias de ${sl.name}`} onClick={() => void store.exportSlotCopies(sl.id)}><Icon name="upload" size={15} /></button>
              {!isOpen && (
                <ConfirmButton label="Borrar" className="btn sm ghost danger" confirmLabel="Borrar partida" detail={<>Se borran «{sl.name}» y todas sus copias de este dispositivo. No se puede deshacer: exportala antes si querés conservarla.</>} onConfirm={() => void store.deleteSlotById(sl.id)} />
              )}
            </div>
          </div>
        );
      })}
      <p className="tiny muted">{ui.slots.length} de {MAX_SLOTS} partidas. Cada una tiene su guardado automático y sus propias copias de seguridad.</p>
    </div>
  );
}
