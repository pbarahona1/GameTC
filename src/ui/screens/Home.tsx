import { ReactNode, useMemo } from 'react';
import { useGame, useUI, store } from '../store';
import { navStore } from '../nav';
import { computeMetrics } from '../../engine/reports/metrics';
import { analyze } from '../../engine/advisor/advisor';
import { cashFlowStatement, incomeStatement } from '../../engine/reports/statements';
import { startOfMonth, formatMonth, formatDate } from '../../engine/time/calendar';
import { STAGES, professionalLevel } from '../../engine/progression/progression';
import { TUTORIAL } from '../../engine/progression/tutorial';
import { Money, InfoButton, Learn, LineChart, Bar } from '../components/common';
import { JOB_BY_ID } from '../../content/jobs';
import { fmtMoney } from '../../engine/format';
import type { LogItem } from '../../engine/state';
import { phaseInfo } from '../../engine/economy/economy';
import { fmtPct } from '../../engine/format';

export function LogRow({ l }: { l: LogItem }) {
  return (
    <div className="row">
      <span aria-hidden style={{ width: 22, textAlign: 'center' }}>{l.icon}</span>
      <div className="grow">
        <div className="small">{l.text}</div>
        <div className="tiny faint">{formatDate(l.day)}</div>
      </div>
      {l.amount !== undefined && (
        <span className={`amt small ${l.kind === 'income' ? 'gain' : l.kind === 'expense' || l.kind === 'danger' ? 'loss' : ''}`}>{fmtMoney(l.amount)}</span>
      )}
    </div>
  );
}

export function Home() {
  const ui = useUI();
  const s = useGame();
  const v = ui.version;
  const m = useMemo(() => computeMetrics(s), [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const insights = useMemo(() => analyze(s, m).filter((i) => ui.settings.alertCategories.includes(i.category)), [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const month = useMemo(() => {
    const from = startOfMonth(s.day);
    return { is: incomeStatement(s, from, s.day), cf: cashFlowStatement(s, from, s.day) };
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const hist = s.history.slice(-24);
  const nwSeries = [...hist.map((h) => h.netWorth), m.netWorth];
  const prev = hist[hist.length - 1];
  const change = prev ? m.netWorth - prev.netWorth : 0;
  const stage = STAGES[s.progression.stage - 1];
  const prof = professionalLevel(s);
  const job = s.career.job ? JOB_BY_ID[s.career.job.jobId] : null;
  const tutorialOpen = !s.tutorial.dismissed;
  const tutDone = TUTORIAL.filter((t) => !t.future && t.done(s)).length;
  const tutTotal = TUTORIAL.filter((t) => !t.future).length;
  const nextStep = TUTORIAL.find((t) => !t.future && !t.done(s));

  const ph = phaseInfo(s);
  const nwLabels = [...hist.map((h) => formatMonth(h.day)), 'Hoy'];
  const openCos = s.companies.filter((c) => c.status === 'active' || c.status === 'insolvent');
  const invValue = m.securities + (s.ledger.balances.term_deposits ?? 0);
  const areas: Array<{ icon: string; title: string; value: ReactNode; sub: string; go: () => void; term: string }> = [
    { icon: '💼', title: 'Trabajo', value: job ? <Money c={m.monthlyGross} /> : 'Sin empleo', sub: job ? `${job.title} · nivel ${prof.level}` : 'Buscá empleo en Carrera', go: () => navStore.go('career'), term: 'salario_bruto' },
    { icon: '📈', title: 'Inversiones', value: <Money c={invValue} />, sub: invValue > 0 ? 'Tocá para ver y operar todo' : 'Empezá con un fondo índice', go: () => navStore.go('invest', 'portfolio'), term: 'mis_inversiones' },
    { icon: '🏠', title: 'Inmuebles', value: <Money c={m.realEstate - m.mortgages} />, sub: m.realEstate ? `Alquileres ${fmtMoney(m.rentIncome, { decimals: false })}/mes` : 'Comprá, alquilá o viví en uno', go: () => navStore.go('invest', 'realestate'), term: 'inmueble' },
    { icon: '🏭', title: 'Negocios', value: openCos.length ? `${openCos.length} empresa${openCos.length > 1 ? 's' : ''}` : 'Ninguno', sub: openCos.length ? `Tu parte ${fmtMoney(s.ledger.balances.business_equity, { decimals: false })}` : 'Proyectá y fundá tu primera', go: () => navStore.go('business'), term: 'metodo_participacion' },
    { icon: '💳', title: 'Crédito', value: String(s.credit.score), sub: m.debt ? `Deudas ${fmtMoney(m.debt, { decimals: false })}` : 'Sin deudas', go: () => navStore.go('finance', 'credit'), term: 'puntaje_crediticio' },
    { icon: '🏆', title: 'Progreso', value: `Etapa ${s.progression.stage}/12`, sub: stage.name, go: () => navStore.open({ kind: 'progress' }), term: 'nivel_magnate' },
  ];
  return (
    <>
      {s.legal.prison && (
        <button className="alert critical" style={{ textAlign: 'left' }} onClick={() => navStore.go('more', 'legal')}>
          <span className="stripe" />
          <div className="small" style={{ flex: 1 }}><strong>🔒 Cumplís una condena hasta el {formatDate(s.legal.prison.until)}.</strong> No podés trabajar ni operar; tus empresas, inversiones y deudas siguen su curso.</div>
        </button>
      )}
      <button className="econ-chip" onClick={() => navStore.go('more', 'economy')} aria-label="Ver economía">
        <span aria-hidden>{ph.icon}</span> {ph.name} · inflación {fmtPct(s.macro.inflation, 1)} · tasa {fmtPct(s.macro.policyRate, 2)} · desempleo {fmtPct(s.macro.unemployment, 1)}
        {s.macro.events.some((e) => e.startDay <= s.day && e.endDay >= s.day) && <> · {s.macro.events.filter((e) => e.startDay <= s.day && e.endDay >= s.day).map((e) => e.icon).join('')}</>}
      </button>

      <section className="hero" aria-label="Patrimonio neto">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="eyebrow">Patrimonio neto</span>
          <InfoButton term="patrimonio_neto" />
          <span style={{ flex: 1 }} />
          {prev && <span className="small"><Money c={change} colored sign /> <span className="faint">este mes</span></span>}
        </div>
        <div className="big">{fmtMoney(m.netWorth)}</div>
        <Learn term="patrimonio_neto" />
        <LineChart series={[{ name: 'Patrimonio neto', values: nwSeries, color: 'var(--accent)' }]} pointLabels={nwLabels} height={100} />
        <div className="tiny faint">Lo que tenés {fmtMoney(m.totalAssets, { decimals: false })} − lo que debés {fmtMoney(m.totalLiabilities, { decimals: false })}</div>
      </section>

      <div className="month-strip" role="group" aria-label="Tu mes">
        <button className="ms-cell" onClick={() => navStore.go('finance', 'accounts')}>
          <span className="tiny muted">Disponible <InfoButton term="liquidez" /></span>
          <strong className="num">{fmtMoney(m.liquid, { decimals: false })}</strong>
          <span className="tiny faint">{m.runwayMonths !== null ? `alcanza ~${m.runwayMonths.toFixed(1)} meses` : 'te sobra cada mes'}</span>
        </button>
        <button className="ms-cell" onClick={() => navStore.go('reports', 'cf')}>
          <span className="tiny muted">Entró este mes</span>
          <strong className="num gain">{fmtMoney(month.cf.cashIn, { decimals: false })}</strong>
          <span className="tiny faint">salió {fmtMoney(month.cf.cashOut, { decimals: false })}</span>
        </button>
        <button className="ms-cell" onClick={() => navStore.go('reports', 'cf')}>
          <span className="tiny muted">Balance del mes <InfoButton term="flujo_caja" /></span>
          <strong className={`num ${month.cf.cashIn - month.cf.cashOut >= 0 ? 'gain' : 'loss'}`}>{fmtMoney(month.cf.cashIn - month.cf.cashOut, { decimals: false, sign: true })}</strong>
          <span className="tiny faint">gastos fijos {fmtMoney(m.recurringMonthly, { decimals: false })}/mes</span>
        </button>
      </div>

      {tutorialOpen && nextStep && (
        <div className="card next-step">
          <div className="card-head">
            <span className="eyebrow" style={{ flex: 1 }}>Tu próximo paso · {tutDone}/{tutTotal} <InfoButton term="guia_inicio" /></span>
            <button className="btn sm ghost" onClick={() => navStore.open({ kind: 'tutorial' })}>Ver todos</button>
            <button className="btn sm ghost" onClick={() => store.run((st) => { st.tutorial.dismissed = true; }, { toast: false })}>Ocultar</button>
          </div>
          <Bar value={tutDone / tutTotal} />
          <strong>{nextStep.title}</strong>
          <p className="small muted">{nextStep.body}</p>
          <button className="btn sm dark" onClick={() => navStore.go(nextStep.tab, nextStep.sub)}>Hacerlo ahora</button>
        </div>
      )}

      {insights.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          {insights.slice(0, 2).map((i) => (
            <button key={i.id} className={`alert ${i.severity}`} style={{ textAlign: 'left' }} onClick={() => { store.markSeen('asesor'); navStore.open({ kind: 'advisor' }); }}>
              <span className="stripe" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong className="small">{i.title}</strong>
                <span className="small muted">{i.what}</span>
              </div>
            </button>
          ))}
          {insights.length > 2 && <button className="btn sm ghost" onClick={() => { store.markSeen('asesor'); navStore.open({ kind: 'advisor' }); }}>Ver {insights.length - 2} alertas más en el Asesor IA</button>}
        </div>
      )}

      <div className="section-title"><h2>Tu mundo</h2></div>
      <div className="area-grid">
        {areas.map((a) => (
          <button key={a.title} className="area" onClick={a.go}>
            <span className="area-top"><span className="area-icon" aria-hidden>{a.icon}</span><span className="tiny muted">{a.title}</span><InfoButton term={a.term} /></span>
            <strong className="area-value">{a.value}</strong>
            <span className="tiny faint">{a.sub}</span>
          </button>
        ))}
      </div>

      <div className="section-title">
        <h2>Actividad reciente</h2>
        <button className="btn sm ghost" onClick={() => navStore.open({ kind: 'log' })}>Ver todo</button>
      </div>
      <div className="card" style={{ paddingBlock: 4 }}>
        <div className="rows">
          {s.log.length === 0 && <p className="small muted" style={{ padding: '12px 0' }}>Todavía no pasó nada. Usá los controles de tiempo de arriba para avanzar el calendario.</p>}
          {s.log.slice(-6).reverse().map((l) => <LogRow key={l.id} l={l} />)}
        </div>
      </div>
    </>
  );
}
