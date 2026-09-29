import { Fragment, useEffect, useMemo, useState } from 'react';
import { navStore, useNav, SheetSpec } from './nav';
import { store, useUI, useGame } from './store';
import { GLOSSARY, GLOSSARY_BY_ID, GlossaryEntry } from '../content/glossary';
import { analyze, CATEGORY_NAMES, Insight, AdvisorCategory } from '../engine/advisor/advisor';
import { DIFFICULTIES, DIFFICULTY_BY_ID } from '../engine/economy/difficulty';
import type { PauseCategory } from './store';
import { runScenario, ScenarioInput, ScenarioResult } from '../engine/advisor/scenarios';
import { STAGES, ACHIEVEMENTS, evaluateStage } from '../engine/progression/progression';
import { TUTORIAL } from '../engine/progression/tutorial';
import { LIFESTYLES } from '../content/lifestyle';
import { BANKS } from '../content/banks';
import { fmtMoney } from '../engine/format';
import { usd } from '../engine/money';
import { formatDate } from '../engine/time/calendar';
import { Sheet, Pill, Seg, Bar, LineChart, Legend, AmountInput, ConfirmButton, Empty, InfoButton } from './components/common';
import { LogRow } from './screens/Home';

function TermView({ id }: { id: string }) {
  const g = GLOSSARY_BY_ID[id];
  useEffect(() => store.markSeen(id), [id]);
  if (!g) return <Sheet title="Término">No encontrado.</Sheet>;
  const Block = ({ t, v }: { t: string; v?: string }) => (v ? <div className="stack" style={{ gap: 2 }}><span className="eyebrow">{t}</span><p className="small">{v}</p></div> : null);
  return (
    <Sheet title={g.term}>
      <Pill tone="neutral">{g.category}</Pill>
      <p style={{ fontSize: 16, fontWeight: 600 }}>{g.short}</p>
      <Block t="Para qué sirve" v={g.purpose} />
      {g.formula && <div className="stack" style={{ gap: 2 }}><span className="eyebrow">Cómo se calcula</span><p className="num small" style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 10 }}>{g.formula}</p></div>}
      <Block t="Ejemplo" v={g.example} />
      <Block t="Cómo te afecta" v={g.impact} />
      <Block t="Riesgos" v={g.risks} />
      <Block t="Errores comunes" v={g.mistakes} />
      <Block t="Diferencia con conceptos parecidos" v={g.versus} />
      <Block t="Consejo" v={g.tip} />
      <button className="btn ghost" onClick={() => navStore.open({ kind: 'glossary' })}>Abrir el glosario completo</button>
    </Sheet>
  );
}

function GlossaryView() {
  const [q, setQ] = useState('');
  const ui = useUI();
  const seen = ui.state?.meta.seenTerms ?? [];
  const list = GLOSSARY.filter((g) => !q || (g.term + ' ' + g.short).toLowerCase().includes(q.toLowerCase()));
  const groups = new Map<string, GlossaryEntry[]>();
  for (const g of list) groups.set(g.category, [...(groups.get(g.category) ?? []), g]);
  return (
    <Sheet title="Glosario financiero">
      <input className="input" id="glossary-q" placeholder="Buscar término (ej.: liquidez, deducción)" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <p className="tiny muted">{GLOSSARY.length} términos · {seen.length} consultados</p>
      {[...groups.entries()].map(([cat, items]) => (
        <div key={cat} className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">{cat}</span>
          <div className="card" style={{ paddingBlock: 4 }}>
            <div className="rows">
              {items.map((g) => (
                <button key={g.id} className="row clickable" style={{ border: 0, borderBottom: '1px solid var(--line)', background: 'none', textAlign: 'left' }} onClick={() => navStore.open({ kind: 'term', id: g.id })}>
                  <div className="grow"><div className="title small">{g.term} {!seen.includes(g.id) && <Pill tone="accent">nuevo</Pill>}</div><div className="meta">{g.short}</div></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      {list.length === 0 && <Empty icon="🔎">Sin resultados para “{q}”.</Empty>}
    </Sheet>
  );
}

function InsightCard({ i, open, onToggle }: { i: Insight; open: boolean; onToggle: () => void }) {
  const tone = i.severity === 'critical' ? 'loss' : i.severity === 'warning' ? 'warn' : i.severity === 'opportunity' ? 'gain' : 'info';
  const label = { critical: 'Crítico', warning: 'Advertencia', opportunity: 'Oportunidad', info: 'Información' }[i.severity];
  return (
    <div className={`alert ${i.severity}`} style={{ flexDirection: 'column', gap: 8 }}>
      <button onClick={onToggle} style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }} aria-expanded={open}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Pill tone={tone}>{label}</Pill><span className="tiny muted">{CATEGORY_NAMES[i.category]}</span></span>
        <strong>{i.title}</strong>
        <span className="small">{i.what}</span>
      </button>
      {open && (
        <div className="stack small" style={{ gap: 8 }}>
          <div><span className="eyebrow">Por qué ocurre</span><p>{i.why}</p></div>
          <div>
            <span className="eyebrow">Datos</span>
            <div className="kv" style={{ marginTop: 4 }}>
              {i.data.map((d) => (
                <Fragment key={d.label}><dt>{d.label} <Pill tone={d.kind === 'hecho' ? 'neutral' : 'info'}>{d.kind}</Pill></dt><dd>{d.value}</dd></Fragment>
              ))}
            </div>
          </div>
          <div><span className="eyebrow">Consecuencias</span><p>{i.consequence}</p></div>
          {i.timeframe && <div><span className="eyebrow">Plazo estimado</span><p>{i.timeframe}</p></div>}
          {i.uncertainty && <p className="tiny muted">{i.uncertainty}</p>}
          <div className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">Opciones (recomendaciones)</span>
            {i.options.map((o) => (
              <div key={o.label} className="card flat" style={{ padding: 10, gap: 4 }}>
                <strong>{o.label}</strong>
                <span className="gain">+ {o.pros}</span>
                <span className="loss">− {o.cons}</span>
                {o.tab && <button className="btn sm" onClick={() => navStore.go(o.tab!, o.sub)}>Ir</button>}
              </div>
            ))}
          </div>
          <div><span className="eyebrow">Si no hacés nada</span><p>{i.ifNothing}</p></div>
          {i.term && <span className="tiny">Concepto relacionado <InfoButton term={i.term} /></span>}
        </div>
      )}
    </div>
  );
}

type ScenKind = 'save_monthly' | 'lifestyle' | 'loan' | 'deposit' | 'quit_job' | 'pension' | 'recession' | 'rate_shock' | 'market_crash' | 'buy_property' | 'sell_portfolio';

function Scenarios() {
  const s = useGame();
  const [kind, setKind] = useState<ScenKind>('save_monthly');
  const [amount, setAmount] = useState(usd(200));
  const [lifestyle, setLifestyle] = useState(LIFESTYLES[0].id);
  const [bank, setBank] = useState(BANKS[1].id);
  const [months, setMonths] = useState(12);
  const [res, setRes] = useState<ScenarioResult | null>(null);
  const [pct, setPct] = useState(30);
  const [listing, setListing] = useState<number | null>(s.realEstate.listings[0]?.id ?? null);
  const run = () => {
    let input: ScenarioInput;
    switch (kind) {
      case 'save_monthly': input = { kind, amount }; break;
      case 'lifestyle': input = { kind, lifestyle }; break;
      case 'loan': input = { kind, bankId: bank, amount, termMonths: 24 }; break;
      case 'deposit': input = { kind, amount, termMonths: 12 }; break;
      case 'pension': input = { kind, rate: 0.1 }; break;
      case 'recession': input = { kind, months: Math.max(6, months) }; break;
      case 'rate_shock': input = { kind, delta: pct / 1000 }; break;
      case 'market_crash': input = { kind, drop: pct / 100 }; break;
      case 'buy_property': input = { kind, listingId: listing ?? -1, ltv: 0.6, years: 25, rateType: 'fija' }; break;
      case 'sell_portfolio': input = { kind }; break;
      default: input = { kind: 'quit_job' };
    }
    setRes(runScenario(s, input, months));
  };
  const last = res && !res.error ? res.scenario[res.scenario.length - 1] : null;
  const base = res ? res.baseline[res.baseline.length - 1] : null;
  return (
    <div className="stack">
      <p className="small muted">Simula una copia de tu partida. Nada de esto cambia tu juego real.</p>
      <select className="input" aria-label="Escenario" value={kind} onChange={(e) => { const k = e.target.value as ScenKind; setKind(k); setRes(null); if (k === 'rate_shock') setPct(20); if (k === 'market_crash') setPct(30); }}>
        <option value="save_monthly">Ahorrar un monto fijo cada mes</option>
        <option value="lifestyle">Cambiar de estilo de vida</option>
        <option value="loan">Tomar un préstamo a 24 meses</option>
        <option value="deposit">Abrir un depósito a 12 meses</option>
        <option value="pension">Aportar 10 % a jubilación</option>
        <option value="quit_job">Renunciar a mi empleo</option>
        <option value="recession">Una recesión empieza ahora</option>
        <option value="rate_shock">Suben (o bajan) las tasas de interés</option>
        <option value="market_crash">Caída de la bolsa</option>
        <option value="buy_property">Comprar un inmueble con hipoteca (60 %)</option>
        <option value="sell_portfolio">Vender toda mi cartera financiera hoy</option>
      </select>
      {kind === 'rate_shock' && <Seg items={[{ id: -20, label: '−2 pp' }, { id: 10, label: '+1 pp' }, { id: 20, label: '+2 pp' }, { id: 40, label: '+4 pp' }]} value={pct} onChange={setPct} />}
      {kind === 'market_crash' && <Seg items={[{ id: 15, label: '−15 %' }, { id: 30, label: '−30 %' }, { id: 50, label: '−50 %' }]} value={pct} onChange={setPct} />}
      {kind === 'buy_property' && (s.realEstate.listings.length === 0 ? <p className="small muted">No hay inmuebles publicados ahora.</p> : (
        <select className="input" aria-label="Inmueble" value={listing ?? ''} onChange={(e) => setListing(Number(e.target.value))}>
          {s.realEstate.listings.map((l) => <option key={l.id} value={l.id}>{l.property.name} · {fmtMoney(l.askPrice, { decimals: false })}</option>)}
        </select>
      ))}
      {(kind === 'save_monthly' || kind === 'loan' || kind === 'deposit') && <AmountInput id="scen-amt" value={amount} onChange={setAmount} />}
      {kind === 'lifestyle' && <Seg items={LIFESTYLES.map((l) => ({ id: l.id, label: l.name }))} value={lifestyle} onChange={setLifestyle} />}
      {kind === 'loan' && <Seg items={BANKS.map((b) => ({ id: b.id, label: b.name }))} value={bank} onChange={setBank} />}
      <Seg items={[{ id: 6, label: '6 meses' }, { id: 12, label: '12 meses' }, { id: 24, label: '24 meses' }]} value={months} onChange={setMonths} />
      <span className="act"><button className="btn dark" onClick={run}>Simular</button><InfoButton term="accion_escenarios" /></span>
      {res?.error && <p className="small loss">No se puede simular: {res.error}</p>}
      {res && !res.error && last && base && (
        <div className="card">
          <LineChart
            series={[
              { name: 'Liquidez actual', values: res.baseline.map((p) => p.liquid), color: 'var(--faint)', dashed: true },
              { name: 'Liquidez escenario', values: res.scenario.map((p) => p.liquid), color: 'var(--info)' },
              { name: 'Patrimonio escenario', values: res.scenario.map((p) => p.netWorth), color: 'var(--accent)' },
            ]}
            labels={['hoy', `+${months} m`]}
          />
          <Legend series={[{ name: 'Liquidez si no cambiás nada', values: [], color: 'var(--faint)' }, { name: 'Liquidez escenario', values: [], color: 'var(--info)' }, { name: 'Patrimonio escenario', values: [], color: 'var(--accent)' }]} />
          <div className="kv">
            <dt>Patrimonio en {months} meses</dt><dd>{fmtMoney(last.netWorth)} <span className={last.netWorth >= base.netWorth ? 'gain' : 'loss'}>({fmtMoney(last.netWorth - base.netWorth, { sign: true })})</span></dd>
            <dt>Liquidez en {months} meses</dt><dd>{fmtMoney(last.liquid)} <span className={last.liquid >= base.liquid ? 'gain' : 'loss'}>({fmtMoney(last.liquid - base.liquid, { sign: true })})</span></dd>
            <dt>Deudas en {months} meses</dt><dd>{fmtMoney(last.debt)}</dd>
          </div>
          <p className="tiny muted">{res.note}</p>
        </div>
      )}
    </div>
  );
}

function AdvisorView() {
  const ui = useUI();
  const s = useGame();
  const [tab, setTab] = useState<'alerts' | 'scen' | 'prefs'>('alerts');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => store.markSeen('asesor'), []);
  const all = useMemo(() => analyze(s), [ui.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = all.filter((i) => ui.settings.alertCategories.includes(i.category));
  return (
    <Sheet title="🧭 Asesor IA">
      <Seg items={[{ id: 'alerts', label: `Alertas (${list.length})` }, { id: 'scen', label: '¿Qué pasaría si…?' }, { id: 'prefs', label: 'Categorías' }]} value={tab} onChange={setTab} />
      {tab === 'alerts' && (
        <>
          <p className="tiny muted">Análisis con los datos reales de tu partida al {formatDate(s.day)}. Los <Pill tone="neutral">hechos</Pill> salen del libro mayor; las <Pill tone="info">estimaciones</Pill> son proyecciones con supuestos explícitos. El asesor nunca toca tu dinero.</p>
          {list.length === 0 && <Empty icon="✅">No detecto problemas ni oportunidades claras en las categorías activas. Seguí así.</Empty>}
          {list.map((i) => <InsightCard key={i.id} i={i} open={open === i.id} onToggle={() => setOpen(open === i.id ? null : i.id)} />)}
        </>
      )}
      {tab === 'scen' && <Scenarios />}
      {tab === 'prefs' && (
        <div className="stack">
          <p className="small muted">Elegí qué categorías de alertas ver en Inicio y en el contador del asesor.</p>
          {(Object.keys(CATEGORY_NAMES) as AdvisorCategory[]).map((c) => {
            const on = ui.settings.alertCategories.includes(c);
            return (
              <label key={c} className="row" style={{ gap: 10 }}>
                <input type="checkbox" checked={on} onChange={() => store.updateSettings({ alertCategories: on ? ui.settings.alertCategories.filter((x) => x !== c) : [...ui.settings.alertCategories, c] })} />
                <span className="grow">{CATEGORY_NAMES[c]}</span>
              </label>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

function GameOptionsCard() {
  const s = useGame();
  useUI();
  return (
    <div className="card">
      <div className="card-head"><h2>Partida</h2><InfoButton term="accion_dificultad" /></div>
      <span className="small">Dificultad económica (se aplica desde ahora)</span>
      <Seg items={DIFFICULTIES.map((d) => ({ id: d.id, label: d.name }))} value={s.options.difficulty} onChange={(v) => store.run((x) => { x.options.difficulty = v; return { ok: true, message: `Dificultad: ${DIFFICULTY_BY_ID[v].name}.` }; })} />
      <p className="tiny muted">{DIFFICULTY_BY_ID[s.options.difficulty].description}</p>
      <label className="row"><input type="checkbox" checked={s.options.illegalEnabled} onChange={() => store.run((x) => { x.options.illegalEnabled = !x.options.illegalEnabled; if (!x.options.illegalEnabled) { x.tax.underreport = 0; for (const c of x.companies) c.irregular = { inflatedBooks: 0, underreport: 0 }; } return { ok: true, message: x.options.illegalEnabled ? 'Actividades ilegales ficticias habilitadas.' : 'Actividades ilegales desactivadas. Los actos pasados pueden seguir descubriéndose.' }; })} /><span className="grow">Actividades ilegales ficticias <span className="tiny muted">(al desactivarlas, lo hecho antes puede seguir investigándose)</span></span></label>
    </div>
  );
}

function SettingsView() {
  const ui = useUI();
  const [exportText, setExportText] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [backups, setBackups] = useState<Awaited<ReturnType<typeof store.backups>>>([]);
  const [audit, setAudit] = useState<string[] | null>(null);
  useEffect(() => { void store.backups().then(setBackups); }, [ui.lastSaved]);
  const st = ui.settings;
  return (
    <Sheet title="Ajustes">
      <div className="card">
        <div className="card-head"><h2>Apariencia</h2></div>
        <Seg items={[{ id: 'system', label: 'Sistema' }, { id: 'light', label: 'Claro' }, { id: 'dark', label: 'Oscuro' }]} value={st.theme} onChange={(v) => store.updateSettings({ theme: v })} />
        <label className="row"><input type="checkbox" checked={st.learningMode} onChange={() => store.updateSettings({ learningMode: !st.learningMode })} /><span className="grow">Modo aprendizaje <span className="tiny muted">(explicaciones en pantalla)</span></span></label>
        <label className="row"><input type="checkbox" checked={st.autoPause} onChange={() => store.updateSettings({ autoPause: !st.autoPause })} /><span className="grow">Pausa automática ante eventos importantes</span></label>
      </div>
      <div className="card">
        <div className="card-head"><h2>Accesibilidad</h2><InfoButton term="accion_accesibilidad" /></div>
        <span className="small">Tamaño del texto</span>
        <Seg items={[{ id: 0.9, label: 'A−' }, { id: 1, label: 'A' }, { id: 1.15, label: 'A+' }, { id: 1.3, label: 'A++' }]} value={st.fontScale} onChange={(v) => store.updateSettings({ fontScale: v })} />
        <span className="small">Densidad</span>
        <Seg items={[{ id: 'comoda', label: 'Cómoda' }, { id: 'compacta', label: 'Compacta' }]} value={st.density} onChange={(v) => store.updateSettings({ density: v })} />
        <label className="row"><input type="checkbox" checked={st.highContrast} onChange={() => store.updateSettings({ highContrast: !st.highContrast })} /><span className="grow">Alto contraste</span></label>
        <label className="row"><input type="checkbox" checked={st.colorblind} onChange={() => store.updateSettings({ colorblind: !st.colorblind })} /><span className="grow">Colores para daltonismo <span className="tiny muted">(ganancias en azul, pérdidas en naranja)</span></span></label>
        <label className="row"><input type="checkbox" checked={st.reduceMotion} onChange={() => store.updateSettings({ reduceMotion: !st.reduceMotion })} /><span className="grow">Reducir animaciones</span></label>
      </div>
      {ui.state && <GameOptionsCard />}
      <div className="card">
        <div className="card-head"><h2>Tiempo y notificaciones</h2><InfoButton term="accion_velocidad" /></div>
        <span className="small">Velocidad base (a 1×)</span>
        <Seg items={[{ id: 4000, label: 'Lenta · 4 s/día' }, { id: 2000, label: 'Normal · 2 s/día' }, { id: 1000, label: 'Rápida · 1 s/día' }]} value={st.msPerDay} onChange={(v) => store.updateSettings({ msPerDay: v })} />
        <span className="small">Pausar automáticamente cuando ocurra…</span>
        {([['peligro', 'Peligros (impagos, quiebras, embargos)'], ['ofertas', 'Ofertas de empleo'], ['logros', 'Logros y nuevas etapas'], ['legal', 'Investigaciones, juicios e inspecciones'], ['inversiones', 'Caídas fuertes de inversiones']] as Array<[PauseCategory, string]>).map(([id, label]) => (
          <label className="row" key={id}><input type="checkbox" checked={st.pauseOn.includes(id)} onChange={() => store.updateSettings({ pauseOn: st.pauseOn.includes(id) ? st.pauseOn.filter((x) => x !== id) : [...st.pauseOn, id] })} /><span className="grow small">{label}</span></label>
        ))}
        <label className="row"><input type="checkbox" checked={st.successToasts} onChange={() => store.updateSettings({ successToasts: !st.successToasts })} /><span className="grow">Mostrar confirmaciones de acciones exitosas <span className="tiny muted">(los errores siempre se muestran)</span></span></label>
        <p className="tiny muted">Las categorías de alertas del Asesor IA se eligen en el Asesor → Preferencias.</p>
      </div>
      <div className="card">
        <div className="card-head"><h2>Progreso sin conexión</h2></div>
        <p className="small muted">Con la app cerrada pasa 1 día de juego cada 10 minutos reales, con las mismas reglas económicas. Tope:</p>
        <Seg items={[{ id: 0, label: 'Nada' }, { id: 7, label: '7 días' }, { id: 30, label: '30 días' }, { id: 90, label: '90 días' }]} value={st.offlineMaxDays} onChange={(v) => store.updateSettings({ offlineMaxDays: v })} />
      </div>
      <div className="card">
        <div className="card-head"><h2>Guardado</h2></div>
        <p className="small muted">
          Guardado automático cada 30 días de juego y al salir. Almacenamiento: {ui.storageKind === 'native' ? 'nativo de Android (archivos privados de la app + segunda copia de la partida principal en las preferencias del sistema)' : ui.storageKind === 'local' ? 'almacenamiento del navegador (exportá un archivo como respaldo)' : 'solo memoria: exportá para no perder la partida'}.
          {ui.lastSaved && ` Último guardado: ${new Date(ui.lastSaved).toLocaleTimeString()}.`}
          {ui.saveBytes && ` Tamaño: ${(ui.saveBytes / 1024).toFixed(0)} KB (comprimido).`}
          {ui.state?.ledger.archive && ` Libro mayor: ${ui.state.ledger.entries.length} asientos detallados + ${ui.state.ledger.archive.entries} resumidos en ${ui.state.ledger.archive.buckets.length} meses.`}
        </p>
        {ui.saveError && <p className="small loss">{ui.saveError}</p>}
        <div className="btn-row">
          <span className="act"><button className="btn sm dark" onClick={async () => { if (await store.save()) store.toast('Partida guardada.', 'ok'); }}>Guardar ahora</button><InfoButton term="accion_guardar" /></span>
          <span className="act"><button className="btn sm" onClick={() => setAudit(store.audit())}>Auditar contabilidad</button><InfoButton term="accion_auditar" /></span>
        </div>
        {audit && (audit.length === 0 ? <p className="small gain">✓ {ui.state?.ledger.entries.length} asientos verificados: todo cuadra.</p> : <ul className="small loss">{audit.map((a) => <li key={a}>{a}</li>)}</ul>)}
        <span className="eyebrow">Copias de seguridad</span>
        <div className="rows">
          {backups.filter((b) => b.header).map((b) => (
            <div className="row" key={b.key}>
              <div className="grow small">{b.key.endsWith('primary') ? 'Principal' : `Copia ${b.key.slice(-1)}`} · {b.header!.name} · {formatDate(b.header!.day)}</div>
              {!b.key.endsWith('primary') && <ConfirmButton label="Restaurar" className="btn sm ghost" help="accion_restaurar" confirmLabel="Restaurar" detail="Reemplaza la partida actual por esta copia." onConfirm={async () => { const r = await store.restore(b.key); store.toast(r.ok ? r.message ?? 'OK' : r.error, r.ok ? 'ok' : 'error'); }} />}
            </div>
          ))}
        </div>
        <div className="btn-row">
          <span className="act"><button className="btn sm dark" onClick={() => void store.exportFile()}>Exportar a archivo</button><InfoButton term="accion_exportar" /></span>
          <button className="btn sm" onClick={() => setExportText(store.exportText())}>Mostrar como texto</button>
        </div>
        {exportText && (
          <>
            <textarea className="input" readOnly value={exportText} style={{ minHeight: 90, padding: 8, fontSize: 11 }} onFocus={(e) => e.target.select()} />
            <button className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(exportText); store.toast('Copiado.', 'ok'); } catch { store.toast('Seleccioná el texto y copialo manualmente.', 'error'); } }}>Copiar</button>
          </>
        )}
        <label className="small" htmlFor="import-file">Importar desde archivo .json</label>
        <input id="import-file" type="file" accept=".json,application/json,text/plain" className="small" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const r = await store.importText(await f.text()); if (r.ok) navStore.closeAll(); e.target.value = ''; }} />
        <textarea className="input" placeholder="…o pegá aquí el texto de una partida exportada" value={importText} onChange={(e) => setImportText(e.target.value)} style={{ minHeight: 60, padding: 8, fontSize: 12 }} />
        <span className="act"><button className="btn sm" disabled={!importText.trim()} onClick={async () => { const r = await store.importText(importText); if (r.ok) { setImportText(''); navStore.closeAll(); } }}>Importar y verificar</button><InfoButton term="accion_exportar" /></span>
      </div>
      <div className="card">
        <div className="card-head"><h2>Guía y partida</h2></div>
        <span className="act"><button className="btn sm" onClick={() => { store.run((s) => { s.tutorial.dismissed = false; }, { toast: false }); navStore.open({ kind: 'tutorial' }); }}>Ver la guía de inicio</button><InfoButton term="guia_inicio" /></span>
        <ConfirmButton label="Empezar una partida nueva" className="btn sm danger" confirmLabel="Borrar y empezar de nuevo" detail="Se eliminarán la partida y sus copias de este dispositivo. Exportala antes si querés conservarla." onConfirm={() => { navStore.closeAll(); void store.abandonGame(); }} />
      </div>
      <p className="tiny faint">Ultimate Realistic Tycoon · versión 1.1 · sin anuncios ni compras.</p>
    </Sheet>
  );
}

function ProgressView() {
  const ui = useUI();
  const s = useGame();
  const ev = useMemo(() => evaluateStage(s), [ui.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = s.player.attributes;
  const attrs: Array<[string, number, string, string?]> = [
    ['Estrés', a.stress, 'Más de 60 reduce el desempeño; más de 50 desgasta la salud.', 'estres'],
    ['Salud', a.health, 'Por debajo de 60 aumenta la probabilidad de imprevistos médicos.'],
    ['Reputación', a.reputation, 'Mejora la probabilidad de recibir ofertas. Sube con el nivel de tu puesto y certificados.'],
    ['Red de contactos', a.network, 'Mejora la probabilidad de ofertas. Sube con estudios formales y puestos de nivel alto.'],
  ];
  return (
    <Sheet title="Progreso">
      <div className="card">
        <div className="card-head"><h2>Atributos personales</h2></div>
        {attrs.map(([n, v, d, t]) => (
          <div className="stack" key={n} style={{ gap: 4 }}>
            <span className="small" style={{ display: 'flex', gap: 6 }}><strong style={{ flex: 1 }}>{n} {t && <InfoButton term={t} />}</strong><span className="num">{Math.round(v)}/100</span></span>
            <Bar value={v / 100} tone={n === 'Estrés' ? (v > 60 ? 'loss' : v > 45 ? 'warn' : 'gain') : v < 40 ? 'warn' : 'gain'} />
            <span className="tiny muted">{d}</span>
          </div>
        ))}
      </div>
      <span className="eyebrow">Etapas de magnate</span>
      <p className="tiny muted">Ninguna exige una ruta concreta. La etapa alcanzada no retrocede.</p>
      {ev.details.map((d) => {
        const reached = s.progression.stage >= d.stage.n;
        return (
          <div key={d.stage.n} className="card" style={{ gap: 6, opacity: reached || d.stage.n === s.progression.stage + 1 ? 1 : 0.7 }}>
            <div className="card-head">
              <span className="num faint">{d.stage.n}</span>
              <h2>{d.stage.name}</h2>
              {reached ? <Pill tone="gain">Alcanzada</Pill> : d.stage.n === s.progression.stage + 1 ? <Pill tone="accent">Siguiente</Pill> : null}
            </div>
            <p className="small muted">{d.stage.description} Desbloquea: {d.stage.unlocks}</p>
            {d.criteria.length > 0 && (
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {d.criteria.map((c) => <li key={c.label} className={c.met ? 'gain' : ''}>{c.met ? '✓' : '○'} {c.label}{c.future && <span className="faint"> ({c.future})</span>}</li>)}
              </ul>
            )}
          </div>
        );
      })}
      <span className="eyebrow">Logros ({Object.keys(s.progression.achievements).length}/{ACHIEVEMENTS.length})</span>
      <div className="grid2">
        {ACHIEVEMENTS.map((x) => {
          const day = s.progression.achievements[x.id];
          return (
            <div key={x.id} className="stat" style={{ opacity: day === undefined ? 0.55 : 1 }}>
              <div className="label"><span aria-hidden>{x.icon}</span> {x.name}</div>
              <div className="tiny muted">{x.description}</div>
              {day !== undefined && <div className="tiny gain">{formatDate(day)}</div>}
            </div>
          );
        })}
      </div>
      <p className="tiny faint">{STAGES.length} etapas en total.</p>
    </Sheet>
  );
}

function LogView() {
  const s = useGame();
  const [kind, setKind] = useState<'all' | 'money' | 'alerts'>('all');
  const list = s.log.filter((l) => kind === 'all' || (kind === 'money' ? l.kind === 'income' || l.kind === 'expense' : l.kind === 'danger' || l.kind === 'warning')).slice().reverse();
  return (
    <Sheet title="Actividad">
      <Seg items={[{ id: 'all', label: 'Todo' }, { id: 'money', label: 'Dinero' }, { id: 'alerts', label: 'Alertas' }]} value={kind} onChange={setKind} />
      <div className="rows">{list.map((l) => <LogRow key={l.id} l={l} />)}</div>
      {list.length === 0 && <Empty icon="🗒️">Sin actividad.</Empty>}
    </Sheet>
  );
}

function TutorialView() {
  const s = useGame();
  useUI();
  return (
    <Sheet title="Guía de inicio">
      <p className="small muted">Opcional. Cada paso se marca solo cuando lo hacés de verdad. Ninguno bloquea nada.</p>
      {TUTORIAL.map((t, i) => {
        const done = !t.future && t.done(s);
        return (
          <div key={t.id} className="card" style={{ gap: 6, opacity: t.future ? 0.6 : 1 }}>
            <div className="card-head">
              <span className="num faint">{i + 1}</span>
              <h2>{t.title}</h2>
              {done ? <Pill tone="gain">Hecho</Pill> : t.future ? <Pill tone="neutral">{t.future}</Pill> : null}
            </div>
            <p className="small muted">{t.body}</p>
            {!t.future && !done && <button className="btn sm" onClick={() => navStore.go(t.tab, t.sub)}>Ir</button>}
          </div>
        );
      })}
      <button className="btn ghost" onClick={() => { store.run((st) => { st.tutorial.dismissed = true; }, { toast: false }); navStore.close(); }}>Ocultar la guía</button>
    </Sheet>
  );
}

function render(spec: SheetSpec) {
  switch (spec.kind) {
    case 'term': return <TermView key={spec.id} id={spec.id} />;
    case 'glossary': return <GlossaryView />;
    case 'advisor': return <AdvisorView />;
    case 'settings': return <SettingsView />;
    case 'progress': return <ProgressView />;
    case 'log': return <LogView />;
    case 'tutorial': return <TutorialView />;
  }
}

export function SheetHost() {
  const nav = useNav();
  const top = nav.sheets[nav.sheets.length - 1];
  return top ? render(top) : null;
}
