import { ReactNode, useMemo } from 'react';
import { useGame, useUI, store } from '../store';
import { navStore } from '../nav';
import { computeMetrics } from '../../engine/reports/metrics';
import { analyze } from '../../engine/advisor/advisor';
import { cashFlowStatement, incomeStatement } from '../../engine/reports/statements';
import { startOfMonth, formatMonth, formatDate } from '../../engine/time/calendar';
import { STAGES, professionalLevel } from '../../engine/progression/progression';
import { nextMission, CHAPTERS, missionProgress } from '../../engine/progression/tutorial';
import { Icon, IconName } from '../icons';
import { imageScore, imageLabel } from '../../engine/lifestyle/effects';
import { unreadNews, TOPIC_NAMES } from '../../engine/world/news';
import { cardTier } from '../../engine/finance/cardRewards';
import { PoachCard } from './more/Rivals';
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
  const { done: tutDone, total: tutTotal } = missionProgress(s);
  const nextStep = nextMission(s);
  const img = imageScore(s);
  const unread = unreadNews(s);
  const openNews = s.world.news.filter((n) => n.status === 'abierta').slice(-2).reverse();
  const poach = s.world.poach.filter((p) => p.status === 'abierta');
  const rivalOffers = s.companies.filter((c) => c.saleOffer && c.saleOffer.expires >= s.day && c.saleOffer.from);

  const ph = phaseInfo(s);
  const nwLabels = [...hist.map((h) => formatMonth(h.day)), 'Hoy'];
  const openCos = s.companies.filter((c) => c.status === 'active' || c.status === 'insolvent');
  const invValue = m.securities + (s.ledger.balances.term_deposits ?? 0);
  const areas: Array<{ icon: IconName; title: string; value: ReactNode; sub: string; go: () => void; term: string; badge?: number }> = [
    { icon: 'career', title: 'Trabajo', value: job ? <Money c={m.monthlyGross} /> : 'Sin empleo', sub: job ? `${job.title} · nivel ${prof.level}` : 'Buscá empleo en Carrera', go: () => navStore.go('career'), term: 'salario_bruto' },
    { icon: 'invest', title: 'Inversiones', value: <Money c={invValue} />, sub: invValue > 0 ? 'Tocá para ver y operar todo' : 'Empezá con un fondo índice', go: () => navStore.go('invest', 'portfolio'), term: 'mis_inversiones' },
    { icon: 'realestate', title: 'Inmuebles', value: <Money c={m.realEstate - m.mortgages} />, sub: m.realEstate ? `Alquileres ${fmtMoney(m.rentIncome, { decimals: false })}/mes` : 'Cocheras y estudios desde poco', go: () => navStore.go('invest', 'realestate'), term: 'inmueble' },
    { icon: 'business', title: 'Negocios', value: openCos.length ? `${openCos.length} empresa${openCos.length > 1 ? 's' : ''}` : 'Ninguno', sub: openCos.length ? `Tu parte ${fmtMoney(s.ledger.balances.business_equity, { decimals: false })}` : 'Proyectá y fundá tu primera', go: () => navStore.go('business'), term: 'metodo_participacion' },
    { icon: 'card', title: `Crédito · ${cardTier(s).name}`, value: String(s.credit.score), sub: m.debt ? `Deudas ${fmtMoney(m.debt, { decimals: false })}` : 'Sin deudas', go: () => navStore.go('finance', 'card'), term: 'puntaje_crediticio' },
    { icon: 'wardrobe', title: 'Tu imagen', value: `${img} · ${imageLabel(img)}`, sub: 'Vestidor, bienes y tiendas', go: () => navStore.go('more', 'wardrobe'), term: 'imagen_personal' },
    { icon: 'news', title: 'Noticias', value: unread ? `${unread} nueva${unread > 1 ? 's' : ''}` : 'Al día', sub: 'Rumores que podés analizar', go: () => navStore.go('more', 'news'), term: 'noticias_rumores', badge: unread },
    { icon: 'progress', title: 'Progreso', value: `Etapa ${s.progression.stage}/12`, sub: stage.name, go: () => navStore.open({ kind: 'progress' }), term: 'nivel_magnate' },
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
          <span className="tiny muted">Liquidez <InfoButton term="liquidez" /></span>
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

      {(poach.length > 0 || rivalOffers.length > 0) && (
        <div className="stack" style={{ gap: 8 }}>
          {poach.slice(0, 2).map((p) => <PoachCard key={p.id} p={p} />)}
          {rivalOffers.map((c) => (
            <button key={c.id} className="alert opportunity" style={{ textAlign: 'left' }} onClick={() => navStore.go('business', `co:${c.id}:manage`)}>
              <span className="stripe" />
              <div className="small" style={{ flex: 1 }}><strong>{c.saleOffer!.from} ofrece {fmtMoney(c.saleOffer!.price, { decimals: false })} por {c.name}.</strong> Vence el {formatDate(c.saleOffer!.expires)}.</div>
            </button>
          ))}
        </div>
      )}

      {tutorialOpen && nextStep && (
        <div className="card next-step">
          <div className="card-head">
            <span className="eyebrow" style={{ flex: 1 }}><Icon name="missions" size={13} /> Misiones {tutDone}/{tutTotal} <InfoButton term="misiones" /></span>
            <button className="btn sm ghost" onClick={() => navStore.open({ kind: 'tutorial' })}>Ver todas</button>
            <button className="btn sm ghost" aria-label="Ocultar misiones" onClick={() => store.run((st) => { st.tutorial.dismissed = true; }, { toast: false })}><Icon name="close" size={15} /></button>
          </div>
          <Bar value={tutDone / tutTotal} />
          <span className="tiny muted">{CHAPTERS[nextStep.chapter - 1].icon} {CHAPTERS[nextStep.chapter - 1].name}</span>
          <strong>{nextStep.title}</strong>
          <p className="small muted">{nextStep.body}</p>
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <button className="btn sm dark" onClick={() => navStore.go(nextStep.tab, nextStep.sub)}>Hacerlo ahora</button>
            {nextStep.reward && <span className="tiny muted">Recompensa: +{nextStep.reward.xp} XP</span>}
          </div>
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
            <span className="area-top"><span className="area-icon" aria-hidden><Icon name={a.icon} size={16} /></span><span className="tiny muted">{a.title}</span>{a.badge ? <span className="count-badge">{a.badge}</span> : <InfoButton term={a.term} />}</span>
            <strong className="area-value">{a.value}</strong>
            <span className="tiny faint">{a.sub}</span>
          </button>
        ))}
      </div>

      {openNews.length > 0 && (
        <>
          <div className="section-title">
            <h2>Rumores abiertos</h2>
            <button className="btn sm ghost" onClick={() => navStore.go('more', 'news')}>Ver todos</button>
          </div>
          {openNews.map((n) => (
            <button key={n.id} className="news-mini" onClick={() => navStore.go('more', 'news')}>
              <span className="news-icon" aria-hidden>{n.icon}</span>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <strong className="small">{n.title}</strong>
                <span className="tiny muted" style={{ display: 'block' }}>{TOPIC_NAMES[n.topic]} · {n.source}{n.analysis ? ` · tu estimación ~${Math.round(n.analysis.estimate * 100)} %` : ' · sin analizar'}</span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </>
      )}

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
