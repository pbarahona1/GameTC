import { useGame, useUI, store } from '../store';
import type { GameState } from '../../engine/state';
import { InfoButton } from './common';
import { Icon } from '../icons';

export function toggleIllegal(x: GameState) {
  x.options.illegalEnabled = !x.options.illegalEnabled;
  if (!x.options.illegalEnabled) {
    x.tax.underreport = 0;
    for (const c of x.companies) c.irregular = { inflatedBooks: 0, underreport: 0 };
  }
  return { ok: true as const, message: x.options.illegalEnabled ? 'Actividades ilegales ficticias activadas.' : 'Actividades ilegales desactivadas. Lo que hiciste antes puede seguir investigándose.' };
}

/** Interruptor grande y explicado de las actividades ilegales ficticias. */
export function IllegalToggle({ compact }: { compact?: boolean }) {
  const s = useGame();
  useUI();
  const on = s.options.illegalEnabled;
  return (
    <div className={`card illegal-toggle ${on ? 'on' : ''}`}>
      <div className="card-head">
        <span className="it-icon" aria-hidden><Icon name="danger" size={20} /></span>
        <h2>Actividades ilegales (ficticias)</h2>
        <InfoButton term="sospecha" />
      </div>
      <button className={`switch-row ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => store.run(toggleIllegal)}>
        <span className="switch" aria-hidden><span /></span>
        <span className="small"><strong>{on ? 'Activadas' : 'Desactivadas'}</strong> · {on ? 'podés evadir impuestos, sobornar, lavar dinero o abrir negocios ilegales, con riesgo de investigaciones, multas y prisión.' : 'el juego no te ofrece ninguna acción ilegal.'}</span>
      </button>
      {!compact && <p className="tiny muted">Todo es ficticio y probabilístico. Al desactivarlas se anulan las irregularidades en curso, pero lo hecho antes puede seguir descubriéndose. Las opciones ilegales aparecen en Legal, Impuestos y en cada empresa.</p>}
    </div>
  );
}
