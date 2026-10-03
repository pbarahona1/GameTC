import { Component, type ErrorInfo, type ReactNode } from 'react';
import { store, errorReport } from '../store';
import { navStore } from '../nav';
import { APP_VERSION } from '../../version';
import { Icon } from '../icons';

interface Props {
  /** `app`: toda la aplicación; `section`: una pestaña u hoja (el resto sigue usable). */
  scope: 'app' | 'section';
  children: ReactNode;
}

interface State {
  error: Error | null;
  details: string;
}

/**
 * Atrapa errores de dibujo de React. Nunca deja la pantalla en blanco ni el
 * reloj corriendo: pausa el tiempo y ofrece exportar la partida, reintentar o
 * volver a Inicio. La partida no se toca (un error al dibujar no cambia el estado).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, details: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    store.pauseForError(error);
    const s = store.getSnapshot().state;
    const stack = [error.stack ?? '', info.componentStack ?? ''].filter(Boolean).join('\n').split('\n').slice(0, 16).join('\n');
    this.setState({ details: errorReport({ name: error.name, message: error.message, stack }, { versión: APP_VERSION, día: s?.day, alcance: this.props.scope }) });
  }

  private reset = () => this.setState({ error: null, details: '' });

  private home = () => {
    navStore.go('home');
    this.reset();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const hasGame = !!store.getSnapshot().state;
    return (
      <div className={this.props.scope === 'app' ? 'onboard recovery' : 'card recovery'} role="alert">
        <div className="recovery-head">
          <span className="recovery-icon" aria-hidden><Icon name="alert" size={22} /></span>
          <h2>{this.props.scope === 'app' ? 'La aplicación encontró un error' : 'Esta pantalla no se pudo mostrar'}</h2>
        </div>
        <p className="small">{hasGame ? 'Tu partida está a salvo y el tiempo quedó en pausa.' : 'No se perdió ningún dato.'} Podés reintentar, volver a Inicio o exportar una copia de la partida por las dudas.</p>
        <div className="btn-row">
          <button className="btn primary" onClick={this.reset}>Reintentar</button>
          {hasGame && <button className="btn" onClick={this.home}>Volver a Inicio</button>}
          {hasGame && <button className="btn ghost" onClick={() => void store.exportFile()}>Exportar partida</button>}
        </div>
        <TechDetails text={this.state.details} />
      </div>
    );
  }
}

/** Detalles para soporte, plegados: el jugador no los necesita para seguir. */
export function TechDetails({ text }: { text: string }) {
  if (!text) return null;
  return (
    <details className="tech-details">
      <summary className="tiny muted">Detalles técnicos</summary>
      <pre className="tiny">{text}</pre>
      <button className="btn sm ghost" onClick={() => void navigator.clipboard?.writeText(text).then(() => store.toast('Detalles copiados.', 'ok'), () => store.toast('No se pudo copiar.', 'error'))}>Copiar detalles</button>
    </details>
  );
}
