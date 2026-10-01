import { lazy, Suspense, useEffect, useMemo } from 'react';
import { store, useUI, Speed } from './store';
import { navStore, useNav, Tab } from './nav';
import { formatDateShort } from '../engine/time/calendar';
import { analyze } from '../engine/advisor/advisor';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { SheetHost, useOta } from './sheets';
import { Icon, IconName } from './icons';
import { Avatar, avatarOf } from './components/Avatar';
import { unreadNews } from '../engine/world/news';
const More = lazy(() => import('./screens/More').then((m) => ({ default: m.More })));
const Invest = lazy(() => import('./screens/Invest').then((m) => ({ default: m.Invest })));
const Reports = lazy(() => import('./screens/Reports').then((m) => ({ default: m.Reports })));
const Business = lazy(() => import('./screens/Business').then((m) => ({ default: m.Business })));
const Finance = lazy(() => import('./screens/Finance').then((m) => ({ default: m.Finance })));
const Career = lazy(() => import('./screens/Career').then((m) => ({ default: m.Career })));
import { Money, Sheet, InfoButton } from './components/common';
import { fmtMoney } from '../engine/format';
import { spendable } from '../engine/finance/payments';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BootErrorScreen, SimErrorSheet } from './screens/Recovery';

const TABS: Array<{ id: Tab; label: string; icon: IconName }> = [
  { id: 'home', label: 'Inicio', icon: 'home' },
  { id: 'career', label: 'Carrera', icon: 'career' },
  { id: 'finance', label: 'Finanzas', icon: 'finance' },
  { id: 'invest', label: 'Invertir', icon: 'invest' },
  { id: 'business', label: 'Negocios', icon: 'business' },
  { id: 'more', label: 'Más', icon: 'more' },
];

const SPEEDS: Array<{ s: Speed; label: string; aria: string }> = [
  { s: 0, label: 'pause', aria: 'Pausa' },
  { s: 1, label: '1×', aria: 'Velocidad normal' },
  { s: 2, label: '2×', aria: 'Velocidad doble' },
  { s: 4, label: '4×', aria: 'Velocidad 4x' },
  { s: 8, label: '8×', aria: 'Velocidad 8x' },
];

function TopBar() {
  const ui = useUI();
  const s = ui.state!;
  const alerts = useMemo(() => analyze(s).filter((i) => (i.severity === 'critical' || i.severity === 'warning') && ui.settings.alertCategories.includes(i.category)).length, [ui.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const unread = unreadNews(s);
  return (
    <header className="topbar">
      <div className="topbar-row">
        <button className="avatar-btn" aria-label="Tu personaje" onClick={() => navStore.go('more', 'wardrobe')}>
          <Avatar data={avatarOf(s)} size={40} bust />
        </button>
        <div className="date-block">
          <div className="d">{formatDateShort(s.day)}</div>
          <div className="tiny muted">
            Disponible <Money c={spendable(s)} />
          </div>
        </div>
        <button className="icon-btn" aria-label={`Noticias${unread ? ` (${unread} nuevas)` : ''}`} onClick={() => navStore.go('more', 'news')}>
          <Icon name="news" />{unread > 0 && <span className="badge info">{unread > 9 ? '9+' : unread}</span>}
        </button>
        <button className="icon-btn" aria-label="Asesor IA" onClick={() => navStore.open({ kind: 'advisor' })}>
          <Icon name="advisor" />{alerts > 0 && <span className="badge">{alerts}</span>}
        </button>
        <button className="icon-btn" aria-label="Ajustes y guardado" onClick={() => navStore.open({ kind: 'settings' })}><Icon name="settings" /></button>
      </div>
      <div className="speed" role="group" aria-label="Control del tiempo">
        {SPEEDS.map((x) => (
          <button key={x.s} aria-label={x.aria} className={ui.speed === x.s ? 'on' : ''} onClick={() => store.setSpeed(x.s)}>{x.label === 'pause' ? <Icon name="pause" size={15} /> : x.label}</button>
        ))}
        <span className="sep" />
        <button aria-label="Avanzar un día" onClick={() => store.step(1)}>+1d</button>
        <button aria-label="Avanzar una semana" onClick={() => store.step(7)}>+7d</button>
        <button aria-label="Avanzar un mes" onClick={() => store.step(30)}>+30d</button>
        <InfoButton term="accion_velocidad" />
      </div>
    </header>
  );
}

/** Aviso de versión nueva (solo en la app de Android). */
function UpdateBanner() {
  const ota = useOta();
  if (ota.check?.kind !== 'available') return null;
  return (
    <div style={{ padding: '10px 16px 0' }}>
      <button className="update-banner" onClick={() => navStore.open({ kind: 'update' })}>
        <Icon name="update" size={18} />
        <span style={{ flex: 1, textAlign: 'left' }}><strong>Versión {ota.check.manifest.version} disponible.</strong> <span className="tiny">Se actualiza en segundos y conserva tu partida.</span></span>
        <span className="btn sm primary">Ver</span>
      </button>
    </div>
  );
}

function BottomNav() {
  const nav = useNav();
  return (
    <nav className="bottomnav" aria-label="Secciones">
      <div className="inner">
        {TABS.map((t) => {
          const on = nav.tab === t.id || (t.id === 'more' && nav.tab === 'reports');
          return (
          <button key={t.id} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} onClick={() => (t.id === 'more' && nav.tab === 'more' ? navStore.setSub('more', 'menu') : navStore.go(t.id))}>
            <span className="ic" aria-hidden><Icon name={t.icon} size={21} stroke={on ? 2.3 : 1.9} /></span>
            {t.label}
          </button>
          );
        })}
      </div>
    </nav>
  );
}

function Toasts() {
  const ui = useUI();
  return (
    <div className="toasts" aria-live="polite">
      {ui.toasts.map((t) => (
        <button key={t.id} className={`toast ${t.tone}`} onClick={() => store.dismissToast(t.id)} aria-label={`${t.text} (tocar para cerrar)`}>{t.text}</button>
      ))}
    </div>
  );
}

function AbsenceReport() {
  const ui = useUI();
  const r = ui.absence;
  if (!r) return null;
  const days = r.toDay - r.fromDay;
  const important = r.logs.filter((l) => l.kind !== 'info').slice(-12).reverse();
  return (
    <Sheet title="Mientras no estabas" onClose={() => store.dismissAbsence()}>
      <p className="muted small">Pasaron {days} días de juego con las mismas reglas económicas que en vivo (máximo configurable en Ajustes).</p>
      <dl className="kv">
        <dt>Patrimonio neto</dt>
        <dd>{fmtMoney(r.netWorthBefore)} → {fmtMoney(r.netWorthAfter)}</dd>
        <dt>Variación</dt>
        <dd><Money c={r.netWorthAfter - r.netWorthBefore} colored sign /></dd>
        <dt>Liquidez</dt>
        <dd>{fmtMoney(r.liquidBefore)} → {fmtMoney(r.liquidAfter)}</dd>
      </dl>
      <div className="rows">
        {important.length === 0 && <p className="muted small">Sin novedades importantes.</p>}
        {important.map((l) => (
          <div className="row" key={l.id}>
            <span aria-hidden>{l.icon}</span>
            <div className="grow small">{l.text}</div>
            {l.amount !== undefined && <span className="amt small">{fmtMoney(l.amount)}</span>}
          </div>
        ))}
      </div>
      <button className="btn primary block" onClick={() => store.dismissAbsence()}>Continuar</button>
    </Sheet>
  );
}

export function App() {
  const ui = useUI();
  const nav = useNav();
  const ota = useOta();
  const hasNews = !!(ota.justUpdated || ota.rolledBack);
  useEffect(() => {
    if (hasNews && ui.ready && !navStore.get().sheets.some((x) => x.kind === 'whatsnew')) navStore.open({ kind: 'whatsnew' });
  }, [hasNews, ui.ready]);
  if (!ui.ready) {
    return (
      <div className="onboard" aria-busy="true">
        <div className="boot-mark" aria-hidden><Icon name="invest" size={34} /></div>
        <div className="brand">Ultimate <em>Realistic</em> Tycoon</div>
        <p className="muted">Cargando tu partida y verificando la contabilidad…</p>
      </div>
    );
  }
  if (!ui.state && ui.bootError) return <><BootErrorScreen /><Toasts /></>;
  if (!ui.state) return <><Onboarding /><SheetHost /><Toasts /></>;
  return (
    <div className="app">
      <TopBar />
      <UpdateBanner />
      {ui.loadNotice && (
        <div style={{ padding: '10px 16px 0' }}>
          <div className="alert warning">
            <span className="stripe" />
            <div className="grow small" style={{ flex: 1 }}>{ui.loadNotice}</div>
            <button className="btn sm" onClick={() => store.dismissNotice()}>OK</button>
          </div>
        </div>
      )}
      <main className="screen">
        <ErrorBoundary key={nav.tab} scope="section">
        <Suspense fallback={<p className="small muted">Cargando…</p>}>
        {nav.tab === 'home' && <Home />}
        {nav.tab === 'career' && <Career />}
        {nav.tab === 'finance' && <Finance />}
        {nav.tab === 'invest' && <Invest />}
        {nav.tab === 'business' && <Business />}
        {nav.tab === 'more' && <More />}
        {nav.tab === 'reports' && (
          <>
            <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => navStore.go('more')}>← Más</button>
            <Reports />
          </>
        )}
        </Suspense>
        </ErrorBoundary>
      </main>
      <BottomNav />
      <ErrorBoundary key={nav.sheets.length} scope="section">
        <SheetHost />
      </ErrorBoundary>
      <AbsenceReport />
      <SimErrorSheet />
      <Toasts />
    </div>
  );
}
