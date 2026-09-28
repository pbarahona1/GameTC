import { useMemo } from 'react';
import { useGame, useUI, store } from '../store';
import { navStore } from '../nav';
import { computeMetrics } from '../../engine/reports/metrics';
import { analyze } from '../../engine/advisor/advisor';
import { cashFlowStatement, incomeStatement } from '../../engine/reports/statements';
import { startOfMonth, formatMonth, formatDate } from '../../engine/time/calendar';
import { STAGES, professionalLevel } from '../../engine/progression/progression';
import { TUTORIAL } from '../../engine/progression/tutorial';
import { Money, Stat, InfoButton, Learn, LineChart, Bar } from '../components/common';
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
          {prev && <span className="small" title={`Comparado con el cierre de ${formatMonth(prev.day)}`}><Money c={change} colored sign /> <span className="faint">este mes</span></span>}
        </div>
        <div className="big">{fmtMoney(m.netWorth)}</div>
        <Learn term="patrimonio_neto" />
        <LineChart series={[{ name: 'Patrimonio neto', values: nwSeries, color: 'var(--accent)' }]} height={110} />
        <div className="tiny faint">Activos {fmtMoney(m.totalAssets)} − Pasivos {fmtMoney(m.totalLiabilities)}</div>
      </section>

      {tutorialOpen && nextStep && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="card-head">
            <span className="eyebrow" style={{ flex: 1 }}>Guía de inicio · {tutDone}/{tutTotal} <InfoButton term="guia_inicio" /></span>
            <button className="btn sm ghost" onClick={() => navStore.open({ kind: 'tutorial' })}>Ver todo</button>
            <button className="btn sm ghost" onClick={() => store.run((st) => { st.tutorial.dismissed = true; }, { toast: false })}>Omitir</button>
          </div>
          <Bar value={tutDone / tutTotal} />
          <strong>{nextStep.title}</strong>
          <p className="small muted">{nextStep.body}</p>
          <button className="btn sm dark" onClick={() => navStore.go(nextStep.tab)}>Ir</button>
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

      <div className="grid2">
        <Stat label="Liquidez disponible" term="liquidez" value={<Money c={m.liquid} />} sub={m.runwayMonths !== null ? `Alcanza ~${m.runwayMonths.toFixed(1)} meses` : 'Superávit mensual'} learn />
        <Stat label="Flujo de caja del mes" term="flujo_caja" value={<Money c={month.cf.netChange} colored sign />} sub={`Entradas ${fmtMoney(month.cf.cashIn, { decimals: false })} · Salidas ${fmtMoney(month.cf.cashOut, { decimals: false })}`} learn />
        <Stat label="Ingresos del mes" term="salario_bruto" value={<Money c={month.is.grossIncome} />} sub={m.monthlyGross ? `Sueldo bruto ${fmtMoney(m.monthlyGross, { decimals: false })}/mes` : 'Sin empleo'} />
        <Stat label="Gastos del mes" term="presupuesto" value={<Money c={month.is.totalExpensesBeforeTax + month.is.totalTaxes} />} sub={`Fijos presupuestados ${fmtMoney(m.recurringMonthly, { decimals: false })}/mes`} />
      </div>

      <div className="grid2">
        <button className="stat" style={{ textAlign: 'left' }} onClick={() => navStore.open({ kind: 'progress' })}>
          <div className="label">Nivel de magnate <InfoButton term="nivel_magnate" /></div>
          <div className="value">{s.progression.stage}/12</div>
          <div className="sub">{stage.name}</div>
        </button>
        <button className="stat" style={{ textAlign: 'left' }} onClick={() => navStore.go('career')}>
          <div className="label">Nivel profesional <InfoButton term="nivel_profesional" /></div>
          <div className="value">{prof.level}</div>
          <Bar value={prof.progress} />
          <div className="sub">{job ? `${job.title}` : 'Sin empleo'}</div>
        </button>
        <button className="stat" style={{ textAlign: 'left' }} onClick={() => navStore.go('invest', 'portfolio')}>
          <div className="label">Inversiones financieras <InfoButton term="diversificacion" /></div>
          <div className="value"><Money c={m.securities} /></div>
          <div className="sub">Acciones, bonos, fondos y Mogul · depósitos {fmtMoney(s.ledger.balances.term_deposits, { decimals: false })}</div>
        </button>
        <button className="stat" style={{ textAlign: 'left' }} onClick={() => navStore.go('invest', 'realestate')}>
          <div className="label">Inmuebles <InfoButton term="inmueble" /></div>
          <div className="value"><Money c={m.realEstate - m.mortgages} /></div>
          <div className="sub">Tasación {fmtMoney(m.realEstate, { decimals: false })} · hipotecas {fmtMoney(m.mortgages, { decimals: false })}</div>
        </button>
        <button className="stat" style={{ textAlign: 'left' }} onClick={() => navStore.go('business')}>
          <div className="label">Negocios activos <InfoButton term="metodo_participacion" /></div>
          <div className="value">{s.companies.filter((c) => c.status === 'active' || c.status === 'insolvent').length}</div>
          <div className="sub">{s.companies.length ? `Participaciones ${fmtMoney(s.ledger.balances.business_equity, { decimals: false })}` : 'Fundá o comprá una empresa'}</div>
        </button>
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
