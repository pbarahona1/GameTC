import type { ReactNode } from 'react';
import { useGame, useUI, store } from '../store';
import { navStore } from '../nav';
import { gateActive, openGate } from '../../engine/progression/unlocks';
import { stageName } from '../../engine/progression/progression';
import { Act } from './common';
import { Icon } from '../icons';

/**
 * Recomendación por etapa (no bloquea): la primera vez que entrás antes de tiempo
 * a una sección avanzada, explica por qué conviene esperar y ofrece abrirla igual.
 */
export function SoftGate({ id, children }: { id: string; children: ReactNode }) {
  const s = useGame();
  const ui = useUI();
  const g = gateActive(s, id, ui.settings.showAllSections);
  if (!g) return <>{children}</>;
  return (
    <div className="card gate">
      <div className="gate-badge"><Icon name="idea" size={16} /> Recomendado desde la etapa {g.stage} · {stageName(g.stage)}</div>
      <h2 className="gate-title">{g.name}</h2>
      <p className="small">{g.why}</p>
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">Antes conviene</span>
        {g.before.map((b) => <div key={b} className="gate-item small"><Icon name="chevron" size={14} /> {b}</div>)}
      </div>
      <p className="tiny muted">Estás en la etapa {s.progression.stage} ({stageName(s.progression.stage)}). Nada está bloqueado: podés entrar ahora si querés.</p>
      <div className="btn-row">
        <Act label="Abrir igual" help="accion_abrir_igual" className="btn primary" onClick={() => store.run((x) => { openGate(x, id); }, { toast: false })} />
        <button className="btn ghost" onClick={() => navStore.open({ kind: 'tutorial' })}><Icon name="missions" size={16} /> Ver misiones</button>
      </div>
    </div>
  );
}
