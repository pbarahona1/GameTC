import { useState } from 'react';
import { BACKGROUNDS, BackgroundId, PLAY_STYLES, PlayStyle } from '../../content/backgrounds';
import { EDUCATION_NAMES } from '../../content/jobs';
import { LIFESTYLE_BY_ID } from '../../content/lifestyle';
import { store } from '../store';
import { fmtMoney } from '../../engine/format';
import { usd } from '../../engine/money';
import { DIFFICULTIES, type Difficulty } from '../../engine/economy/difficulty';

const COLORS = ['#d2a94f', '#4cc093', '#7fb2e0', '#ee7a66', '#b59be0', '#e6d27a'];

export function Onboarding() {
  const [name, setName] = useState('');
  const [bg, setBg] = useState<BackgroundId>('egresado');
  const [style, setStyle] = useState<PlayStyle>('libre');
  const [color, setColor] = useState(COLORS[0]);
  const [seed, setSeed] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [illegal, setIllegal] = useState(true);

  return (
    <div className="onboard">
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Simulador financiero y empresarial</span>
        <h1 className="brand">Ultimate <em>Realistic</em> Tycoon</h1>
        <p className="muted">Empezás con poco dinero. Cada peso entra y sale por un libro contable real: nada aparece por arte de magia. Tu fortuna depende de tus decisiones.</p>
      </div>

      <div className="card">
        <div className="field">
          <label htmlFor="pname">Nombre del personaje</label>
          <input id="pname" className="input" value={name} maxLength={24} placeholder="Ej.: Adriana Paz" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Color de perfil</label>
          <div className="chips">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setColor(c)} style={{ width: 34, height: 34, borderRadius: 10, background: c, border: color === c ? '3px solid var(--text)' : '1px solid var(--line)' }} />
            ))}
          </div>
        </div>
      </div>

      <div className="section-title"><h2>Tu punto de partida</h2></div>
      <div className="stack">
        {BACKGROUNDS.map((b) => (
          <button key={b.id} type="button" className={`choice ${bg === b.id ? 'on' : ''}`} onClick={() => setBg(b.id)} aria-pressed={bg === b.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>{b.name}</strong>
              <span className="num">{fmtMoney(usd(b.startingCash + b.startingChecking), { decimals: false })}</span>
            </div>
            <span className="small muted">{b.summary}</span>
            <span className="tiny"><span className="gain">+ {b.pros}</span> · <span className="loss">− {b.cons}</span></span>
            <span className="tiny faint">Educación: {EDUCATION_NAMES[b.education]} · Estilo de vida: {LIFESTYLE_BY_ID[b.lifestyle].name} · Límite de tarjeta {fmtMoney(usd(b.cardLimit), { decimals: false })}</span>
          </button>
        ))}
      </div>

      <div className="section-title"><h2>Objetivo sugerido (opcional)</h2></div>
      <p className="small muted">No bloquea nada: podés combinar todas las rutas cuando quieras. Solo orienta las sugerencias.</p>
      <div className="chips">
        {PLAY_STYLES.map((p) => (
          <button key={p.id} type="button" onClick={() => setStyle(p.id)} style={style === p.id ? { background: 'var(--text)', color: 'var(--bg)' } : undefined}>{p.name}</button>
        ))}
      </div>
      <p className="small">{PLAY_STYLES.find((p) => p.id === style)!.hint}</p>

      <div className="section-title"><h2>Dificultad económica</h2></div>
      <div className="stack">
        {DIFFICULTIES.map((d) => (
          <button key={d.id} type="button" className={`choice ${difficulty === d.id ? 'on' : ''}`} onClick={() => setDifficulty(d.id)} aria-pressed={difficulty === d.id}>
            <strong>{d.name}</strong>
            <span className="small muted">{d.description}</span>
          </button>
        ))}
      </div>
      <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={illegal} onChange={(e) => setIllegal(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Habilitar actividades ilegales ficticias (sobornos, evasión, negocios clandestinos). Son opcionales, tienen riesgos probabilísticos (investigaciones, multas, prisión) y se pueden desactivar después en Ajustes.</span>
      </label>

      <details>
        <summary className="small muted">Opciones avanzadas</summary>
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="seed">Semilla del mundo (misma semilla = mismos acontecimientos)</label>
          <input id="seed" className="input" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Aleatoria" />
        </div>
      </details>

      <button className="btn primary block" style={{ minHeight: 52, fontSize: 16 }} onClick={() => store.startNewGame({ name: name || 'Jugador', background: bg, style, color, seed: seed || undefined, difficulty, illegalEnabled: illegal })}>
        Comenzar partida
      </button>

      <button className="btn ghost block" onClick={() => setShowImport((v) => !v)}>Importar una partida guardada</button>
      {showImport && (
        <div className="card">
          <label className="small muted" htmlFor="imp">Pegá el texto exportado desde Ajustes → Exportar</label>
          <textarea id="imp" className="input" style={{ minHeight: 120, padding: 10 }} value={importText} onChange={(e) => setImportText(e.target.value)} />
          <button className="btn dark" onClick={() => store.importText(importText)}>Importar y verificar</button>
        </div>
      )}
    </div>
  );
}
