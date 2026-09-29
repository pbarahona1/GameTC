import { useNav, navStore } from '../nav';
import { useGame, useUI } from '../store';
import { ScreenIntro } from '../components/common';
import { EconomyScreen } from './more/Economy';
import { TaxesScreen } from './more/Taxes';
import { ProsScreen } from './more/Pros';
import { LegalScreen } from './more/Legal';
import { phaseInfo } from '../../engine/economy/economy';
import { residence } from '../../engine/tax/taxEngine';
import { legalRiskSummary, heatLabel } from '../../engine/legal/legal';

type Sub = 'menu' | 'economy' | 'tax' | 'pros' | 'legal';

const TITLES: Record<Exclude<Sub, 'menu'>, string> = { economy: 'Economía', tax: 'Impuestos y residencia', pros: 'Profesionales', legal: 'Legal' };

/** Sección "Más": informes, economía, impuestos, profesionales, legal y herramientas. */
export function More() {
  const nav = useNav();
  const s = useGame();
  useUI();
  const sub = ((nav.sub.more ?? 'menu').split(':')[0] as Sub) || 'menu';
  if (sub !== 'menu') {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn sm ghost" onClick={() => navStore.setSub('more', 'menu')} aria-label="Volver a Más">← Más</button>
          <h1 style={{ fontSize: 18, margin: 0 }}>{TITLES[sub]}</h1>
        </div>
        {sub === 'economy' && <EconomyScreen />}
        {sub === 'tax' && <TaxesScreen />}
        {sub === 'pros' && <ProsScreen />}
        {sub === 'legal' && <LegalScreen />}
      </>
    );
  }
  const ph = phaseInfo(s);
  const j = residence(s);
  const lr = legalRiskSummary(s);
  const tiles: Array<{ icon: string; title: string; sub: string; onClick: () => void; alert?: boolean }> = [
    { icon: '📊', title: 'Informes financieros', sub: 'Resultados, balance, flujo de caja, impuestos y libro mayor', onClick: () => navStore.go('reports') },
    { icon: ph.icon, title: 'Economía', sub: `${ph.name} · inflación ${(s.macro.inflation * 100).toFixed(1)} % · tasa ${(s.macro.policyRate * 100).toFixed(2)} %`, onClick: () => navStore.setSub('more', 'economy') },
    { icon: j.flag, title: 'Impuestos y residencia', sub: `${j.name}${s.tax.pendingJurisdiction ? ' · mudanza pendiente' : ''} · obligaciones y comparación`, onClick: () => navStore.setSub('more', 'tax') },
    { icon: '🤝', title: 'Profesionales', sub: `${s.pros.hires.length} contratado(s) · contadores, asesores, abogados, auditores, gerentes`, onClick: () => navStore.setSub('more', 'pros') },
    { icon: '⚖️', title: 'Legal', sub: `Sospecha ${heatLabel(lr.heat).toLowerCase()} · ${lr.openCases} proceso(s) · multas y inspecciones`, onClick: () => navStore.setSub('more', 'legal'), alert: lr.openCases > 0 || lr.pendingFines > 0 || !!lr.prison },
    { icon: '🏆', title: 'Progreso y habilidades', sub: 'Nivel, logros y habilidades que mejoran con estudio y práctica', onClick: () => navStore.open({ kind: 'progress' }) },
    { icon: '📜', title: 'Registro de actividad', sub: 'Todo lo que pasó en tu partida', onClick: () => navStore.open({ kind: 'log' }) },
    { icon: '📖', title: 'Glosario', sub: 'Cada concepto explicado con ejemplos', onClick: () => navStore.open({ kind: 'glossary' }) },
    { icon: '⚙️', title: 'Ajustes y guardado', sub: 'Dificultad, accesibilidad, notificaciones, copias de seguridad', onClick: () => navStore.open({ kind: 'settings' }) },
  ];
  return (
    <>
    <ScreenIntro icon="☰" title="Más" text="Informes, economía, impuestos, profesionales, temas legales, progreso y ajustes." />
    <div className="card" style={{ paddingBlock: 4 }}>
      <div className="rows">
        {tiles.map((t) => (
          <button key={t.title} className="row clickable" style={{ border: 0, borderBottom: '1px solid var(--line)', background: 'none', textAlign: 'left', width: '100%' }} onClick={t.onClick}>
            <span aria-hidden style={{ fontSize: 22 }}>{t.icon}</span>
            <div className="grow">
              <div className="title">{t.title} {t.alert && <span className="badge-dot" aria-label="requiere atención">●</span>}</div>
              <div className="meta">{t.sub}</div>
            </div>
            <span aria-hidden className="faint">›</span>
          </button>
        ))}
      </div>
    </div>
    </>
  );
}
