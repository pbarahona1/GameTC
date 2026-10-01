import { store, useUI, errorReport } from '../store';
import { formatDate } from '../../engine/time/calendar';
import { APP_VERSION } from '../../version';
import { Sheet } from '../components/common';
import { TechDetails } from '../components/ErrorBoundary';
import { Icon } from '../icons';

/** Pantalla cuando la partida no se pudo abrir: nunca se queda en "Cargando…" ni borra copias. */
export function BootErrorScreen() {
  const ui = useUI();
  const e = ui.bootError;
  if (!e) return null;
  return (
    <div className="onboard recovery" role="alert">
      <div className="recovery-head">
        <span className="recovery-icon" aria-hidden><Icon name="alert" size={22} /></span>
        <h1 className="brand" style={{ fontSize: 26 }}>No pudimos abrir tu partida</h1>
      </div>
      <p>{e.message}</p>
      <p className="small muted">Tus copias siguen guardadas en este dispositivo: no se borró nada. Podés reintentar, exportarlas a un archivo (para recuperarlas después o enviarlas a soporte) o empezar una partida nueva, que las conserva aparte.</p>
      <div className="stack" style={{ gap: 10 }}>
        <button className="btn primary block" onClick={() => void store.retryBoot()}><Icon name="refresh" size={16} /> Reintentar</button>
        <button className="btn block" onClick={() => void store.exportRawCopies()}><Icon name="save" size={16} /> Exportar copias</button>
        <button className="btn ghost block" onClick={() => store.startOverAfterBootError()}>Empezar una partida nueva</button>
      </div>
      <TechDetails text={[`Versión ${APP_VERSION}`, `Tipo: ${e.kind}`, ...e.details].join('\n')} />
    </div>
  );
}

/** Un día de simulación falló: la partida volvió al día anterior y el tiempo está en pausa. */
export function SimErrorSheet() {
  const ui = useUI();
  const e = ui.simError;
  const s = ui.state;
  if (!e || !s) return null;
  const repeated = e.attempts >= 2;
  return (
    <Sheet title="La simulación se detuvo" onClose={() => store.dismissSimError()}>
      <div className="recovery-head">
        <span className="recovery-icon" aria-hidden><Icon name="alert" size={22} /></span>
        <p className="small" style={{ margin: 0 }}>
          El <strong>{formatDate(e.day)}</strong> no se pudo simular. Tu partida volvió al {formatDate(e.day - 1)} y el tiempo está en pausa: no se perdió nada.
        </p>
      </div>
      {e.kind === 'invariants' && <p className="small warn">Al cerrar el mes se detectó una inconsistencia contable. Para no seguir con datos dañados, el día no se aplicó.</p>}
      {repeated
        ? <p className="small warn">El error se repitió {e.attempts} veces: probablemente vuelva a pasar. Exportá la partida y probá cambiar algo antes de seguir (por ejemplo, la empresa o la inversión que aparece en los detalles).</p>
        : <p className="small muted">Suele deberse a una situación poco común del juego. Reintentar es seguro: si vuelve a fallar, la partida queda igual.</p>}
      <div className="stack" style={{ gap: 10 }}>
        <button className="btn primary block" onClick={() => store.retrySimDay()}>Reintentar el día</button>
        <button className="btn block" onClick={() => void store.exportFile()}>Exportar partida</button>
        <button className="btn ghost block" onClick={() => store.dismissSimError()}>Volver</button>
      </div>
      <TechDetails text={errorReport(e, { versión: APP_VERSION, día: e.day, contexto: e.context, intentos: e.attempts, semilla: s.seed })} />
    </Sheet>
  );
}
