import { useState } from 'react';
import { BACKGROUNDS, BackgroundId, PLAY_STYLES, PlayStyle } from '../../content/backgrounds';
import { EDUCATION_NAMES } from '../../content/jobs';
import { LIFESTYLE_BY_ID } from '../../content/lifestyle';
import { store, useUI } from '../store';
import { SlotList } from '../components/Slots';
import { fmtMoney } from '../../engine/format';
import { usd } from '../../engine/money';
import { DIFFICULTIES, type Difficulty } from '../../engine/economy/difficulty';
import { SKIN_TONES, HAIR_COLORS, HAIR_STYLES, HAIR_STYLE_NAMES } from '../../content/shops';
import type { Look } from '../../engine/lifestyle/types';
import { Avatar } from '../components/Avatar';
import { Switch } from '../components/common';
import { Icon } from '../icons';

const COLORS = ['#d2a94f', '#4cc093', '#7fb2e0', '#ee7a66', '#b59be0', '#e6d27a'];

function ImportCard() {
  const [text, setText] = useState('');
  return (
    <div className="card import-card">
      <div className="card-head"><span className="ss-icon" aria-hidden><Icon name="upload" size={18} /></span><h2>¿Ya tenías una partida?</h2></div>
      <p className="small muted">Elegí el archivo .json que exportaste desde Ajustes → Guardado (por ejemplo, desde Descargas o Drive). Se verifica la contabilidad antes de cargarla y se actualiza a esta versión.</p>
      <label className="btn dark block file-btn">
        <Icon name="upload" size={16} /> Elegir archivo de partida
        <input type="file" accept=".json,application/json,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; await store.importText(await f.text()); e.target.value = ''; }} />
      </label>
      <details>
        <summary className="small muted">O pegar el texto exportado</summary>
        <textarea id="imp" className="input" style={{ minHeight: 100, padding: 10, marginTop: 8 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pegá acá el texto de la partida" />
        <button className="btn sm" style={{ marginTop: 8 }} disabled={!text.trim()} onClick={() => void store.importText(text)}>Importar y verificar</button>
      </details>
    </div>
  );
}

/** Partidas ya guardadas en el dispositivo (al volver desde "Nueva partida" o tras un error). */
function SavedGames() {
  const ui = useUI();
  if (!ui.slots.length) return null;
  const back = ui.returnSlot ? ui.slots.find((x) => x.id === ui.returnSlot) : null;
  return (
    <div className="card">
      <div className="card-head"><h2>Tus partidas guardadas</h2></div>
      {back && <button className="btn primary block" onClick={() => void store.openSlot(back.id)}><Icon name="undo" size={16} /> Volver a la partida de {back.name}</button>}
      <SlotList />
    </div>
  );
}

export function Onboarding() {
  const [name, setName] = useState('');
  const [bg, setBg] = useState<BackgroundId>('egresado');
  const [style, setStyle] = useState<PlayStyle>('libre');
  const [color] = useState(COLORS[0]);
  const [look, setLook] = useState<Look>({ skin: 1, hair: 'corto', hairColor: 1 });
  const [seed, setSeed] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [illegal, setIllegal] = useState(true);

  return (
    <div className="onboard">
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Simulador financiero y empresarial</span>
        <h1 className="brand">Ultimate <em>Realistic</em> Tycoon</h1>
        <p className="muted">Empezás con poco dinero. Cada peso entra y sale por un libro contable real: nada aparece por arte de magia. Tu fortuna depende de tus decisiones.</p>
      </div>

      <SavedGames />

      <ImportCard />

      <div className="section-title"><h2>O empezá una partida nueva</h2></div>
      <div className="card onboard-char">
        <div className="oc-avatar"><Avatar data={{ look, items: [], outfit: {} }} size={92} /></div>
        <div className="stack" style={{ flex: 1, minWidth: 0 }}>
          <div className="field">
            <label htmlFor="pname">Nombre del personaje</label>
            <input id="pname" className="input" value={name} maxLength={24} placeholder="Ej.: Adriana Paz" onChange={(e) => setName(e.target.value)} />
          </div>
          <span className="tiny muted">Tono de piel</span>
          <div className="swatches">{SKIN_TONES.map((c, i) => <button key={c} type="button" className={`swatch ${look.skin === i ? 'on' : ''}`} style={{ background: c }} aria-label={`Tono ${i + 1}`} onClick={() => setLook({ ...look, skin: i })} />)}</div>
          <span className="tiny muted">Peinado y color</span>
          <div className="chips">{HAIR_STYLES.map((h) => <button key={h} type="button" className={look.hair === h ? 'on' : ''} onClick={() => setLook({ ...look, hair: h })}>{HAIR_STYLE_NAMES[h]}</button>)}</div>
          <div className="swatches">{HAIR_COLORS.map((c, i) => <button key={c} type="button" className={`swatch ${look.hairColor === i ? 'on' : ''}`} style={{ background: c }} aria-label={`Color de pelo ${i + 1}`} onClick={() => setLook({ ...look, hairColor: i })} />)}</div>
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
      <div className="card">
        <Switch checked={illegal} onChange={() => setIllegal(!illegal)} label={<strong>Actividades ilegales ficticias: {illegal ? 'activadas' : 'desactivadas'}</strong>} sub="Sobornos, evasión y negocios clandestinos, con riesgos probabilísticos (investigaciones, multas, prisión). Se cambian cuando quieras en Ajustes → Partida o en Más → Legal." />
      </div>

      <details>
        <summary className="small muted">Opciones avanzadas</summary>
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="seed">Semilla del mundo (misma semilla = mismos acontecimientos)</label>
          <input id="seed" className="input" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Aleatoria" />
        </div>
      </details>

      <button className="btn primary block" style={{ minHeight: 52, fontSize: 16 }} onClick={() => void store.startNewGame({ name: name || 'Jugador', background: bg, style, color, seed: seed || undefined, difficulty, illegalEnabled: illegal, look })}>
        Comenzar partida
      </button>

    </div>
  );
}
