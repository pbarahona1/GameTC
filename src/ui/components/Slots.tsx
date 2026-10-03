import { useEffect, useState } from 'react';
import { store, useUI } from '../store';
import { navStore } from '../nav';
import { MAX_SLOTS, EXPORT_REMINDER, needsExportReminder } from '../../persistence/slots';
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

/** Hora actual que se refresca sola cada `everyMs` (para textos como "hace 2 min"). */
export function useNow(everyMs = 10000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/** Cuándo se guardó la partida por última vez (se actualiza solo). */
export function SavedAgo({ className = 'tiny muted' }: { className?: string }) {
  const ui = useUI();
  const now = useNow();
  const at = ui.lastSaved;
  return <span className={className} aria-live="off">{ui.saveError ? 'No se pudo guardar' : at ? `Guardado ${agoText(Math.max(now, at) - at)}` : 'Sin guardar todavía'}</span>;
}

/**
 * Las partidas guardadas en el dispositivo: abrir, exportar sus copias o
 * borrarlas. La partida abierta no se puede borrar desde acá.
 */
export function SlotList({ onOpened }: { onOpened?: () => void }) {
  const ui = useUI();
  const now = useNow();
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
                {formatDate(sl.day)}{sl.netWorth !== null ? ` · patrimonio ${fmtMoney(sl.netWorth, { decimals: false })}` : ''} · {sl.savedAt ? `guardada ${agoText(Math.max(0, now - sl.savedAt))}` : 'sin guardar'}
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

/** Cuándo se exportó por última vez la partida abierta. */
export function LastExport() {
  const ui = useUI();
  const now = useNow(60000);
  const meta = ui.slots.find((x) => x.id === ui.activeSlot);
  if (!meta) return null;
  return <p className="tiny muted">{meta.exportedAt ? `Última exportación a archivo: ${agoText(Math.max(0, now - meta.exportedAt))}.` : 'Todavía no exportaste esta partida a un archivo.'} Guardá el archivo en Drive o en una PC: protege tu partida si cambiás o perdés el teléfono.</p>;
}

/** Recordatorio suave de exportar (una semana de juego real sin copia externa reciente). */
export function ExportReminder() {
  const ui = useUI();
  const now = useNow(60000);
  const meta = ui.slots.find((x) => x.id === ui.activeSlot);
  if (!needsExportReminder(meta, now, ui.settings.exportReminderSnoozedUntil)) return null;
  return (
    <div className="card export-reminder" role="note">
      <div className="card-head">
        <Icon name="disk" size={18} />
        <h2 style={{ flex: 1 }}>{meta!.exportedAt ? 'Hace más de un mes que no exportás tu partida' : 'Tu partida solo está en este dispositivo'}</h2>
      </div>
      <p className="small muted">Un archivo exportado (en Drive, el correo o una PC) te permite recuperarla si cambiás de teléfono o desinstalás la app.</p>
      <div className="btn-row">
        <button className="btn sm dark" onClick={() => void store.exportFile()}><Icon name="upload" size={15} /> Exportar ahora</button>
        <button className="btn sm ghost" onClick={() => store.updateSettings({ exportReminderSnoozedUntil: Date.now() + EXPORT_REMINDER.snoozeMs })}>Más tarde</button>
      </div>
    </div>
  );
}
