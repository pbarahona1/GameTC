import { useMemo } from 'react';
import { useGame, useUI } from '../../store';
import { navStore } from '../../nav';
import { Money, Stat, InfoButton, CardHead, Learn, Pill, Empty } from '../../components/common';
import { Donut, CHART_COLORS } from '../../components/charts';
import { positions, investmentsValue, InvestClass } from '../../../engine/invest/portfolio';
import { projectPortfolio } from '../../../engine/pros/pros';
import { fmtMoney, fmtPct } from '../../../engine/format';
import { formatDate } from '../../../engine/time/calendar';
import { FUND_BY_ID } from '../../../content/funds';
import { annualVol, beta, maxDrawdown, valueAtRisk, herfindahl } from '../../../engine/invest/indicators';
import type { GameState } from '../../../engine/state';

const CLASS_NAMES: Record<InvestClass, string> = { stocks: 'Acciones', bonds: 'Bonos', funds: 'Fondos', mogul: 'Mogul Exchange' };

function assetName(s: GameState, cls: InvestClass, id: string): string {
  if (cls === 'stocks') return `${id} · ${s.stocks.stocks.find((x) => x.id === id)?.name ?? ''}`;
  if (cls === 'bonds') return s.bonds.issues.find((x) => x.id === id)?.name ?? id;
  if (cls === 'funds') return FUND_BY_ID[id]?.name ?? id;
  return s.mogul.assets.find((x) => x.id === id)?.name ?? id;
}

/** Riesgo de la cartera de acciones con los precios reales (últimos 120 días hábiles). */
export function portfolioRisk(s: GameState) {
  const ps = positions(s, 'stocks');
  const total = ps.reduce((a, p) => a + p.value, 0);
  if (total <= 0) return null;
  const len = Math.min(120, ...ps.map((p) => s.stocks.stocks.find((x) => x.id === p.id)?.history.length ?? 0));
  if (len < 20) return null;
  const series: number[] = [];
  for (let i = 0; i < len; i++) {
    let v = 0;
    for (const p of ps) {
      const h = s.stocks.stocks.find((x) => x.id === p.id)!.history;
      v += p.qty * h[h.length - len + i].c;
    }
    series.push(v);
  }
  const idx = s.stocks.index.history.slice(-len).map((x) => x.v);
  const vol = annualVol(series);
  return { vol, beta: beta(series, idx), var21: valueAtRisk(vol) * total, drawdown: maxDrawdown(series), hhi: herfindahl(ps.map((p) => p.value)), total };
}

export function Portfolio() {
  const s = useGame();
  const ui = useUI();
  const v = ui.version;
  const data = useMemo(() => {
    const b = s.ledger.balances;
    const byClass = (['stocks', 'bonds', 'funds', 'mogul'] as InvestClass[]).map((cls) => ({ cls, list: positions(s, cls) }));
    const cost = byClass.reduce((a, c) => a + c.list.reduce((x, p) => x + p.cost, 0), 0);
    const value = investmentsValue(s);
    const personalProps = s.realEstate.properties.filter((p) => p.owner.kind === 'personal');
    const reEquity = b.real_estate - b.mortgages;
    return { byClass, cost, value, reEquity, props: personalProps.length, risk: portfolioRisk(s), proj: projectPortfolio(s, 12) };
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = s.ledger.balances;
  const y = s.tax.ytd;
  return (
    <>
      <section className="hero">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="eyebrow">Cartera financiera</span>
          <InfoButton term="ganancia_no_realizada" />
        </div>
        <div className="big">{fmtMoney(data.value)}</div>
        <div className="small">
          Resultado no realizado <Money c={data.value - data.cost} colored sign /> {data.cost > 0 && <span className="faint">({fmtPct(data.value / data.cost - 1, 1)})</span>}
        </div>
        <Learn term="ganancia_no_realizada" />
      </section>
      <div className="card">
        <CardHead title="Composición de tus inversiones" term="diversificacion" />
        <Donut parts={[
          { label: 'Acciones', value: b.stocks, color: CHART_COLORS[0] },
          { label: 'Bonos', value: b.bonds, color: CHART_COLORS[1] },
          { label: 'Fondos', value: b.funds, color: CHART_COLORS[2] },
          { label: 'Mogul Exchange', value: b.mogul, color: CHART_COLORS[5] },
          { label: 'Inmuebles (neto de hipotecas)', value: Math.max(0, data.reEquity), color: CHART_COLORS[3] },
          { label: 'Depósitos a plazo', value: b.term_deposits, color: CHART_COLORS[6] },
        ]} />
      </div>
      <div className="grid2">
        <Stat label="Ganancias realizadas (año)" term="ganancia_capital" value={<Money c={(y.gainsShort ?? 0) + (y.gainsLong ?? 0)} colored sign />} sub={`Comisiones ${fmtMoney(y.investFees ?? 0, { decimals: false })}`} />
        <Stat label="Dividendos y rentas (año)" term="dividend_yield" value={<Money c={(y.dividends ?? 0) + (y.bondInterest ?? 0)} />} sub="Dividendos + cupones + repartos" />
        <Stat label="Inmuebles propios" term="inmueble" value={<Money c={b.real_estate} />} sub={`${data.props} inmueble(s) · hipotecas ${fmtMoney(b.mortgages, { decimals: false })}`} />
        <Stat label="Índice bursátil" term="indice_bursatil" value={<span className="num">{s.stocks.index.level.toFixed(1)}</span>} sub="Base 1.000 al comenzar" />
      </div>

      {data.risk && (
        <div className="card">
          <CardHead title="Riesgo de tus acciones" term="volatilidad" />
          <div className="kv">
            <dt>Volatilidad anual <InfoButton term="volatilidad" /></dt><dd>{fmtPct(data.risk.vol, 1)}</dd>
            <dt>Beta frente al índice <InfoButton term="beta" /></dt><dd>{data.risk.beta !== null ? data.risk.beta.toFixed(2) : '—'}</dd>
            <dt>VaR 95 % a 1 mes <InfoButton term="var" /></dt><dd>{fmtMoney(Math.round(data.risk.var21))}</dd>
            <dt>Caída máxima (120 días) <InfoButton term="drawdown" /></dt><dd>{fmtPct(data.risk.drawdown, 1)}</dd>
            <dt>Concentración (Herfindahl) <InfoButton term="diversificacion" /></dt><dd>{data.risk.hhi.toFixed(2)}</dd>
          </div>
          <p className="tiny muted">Calculado con los precios reales de tus acciones en los últimos meses. El pasado no garantiza el futuro.</p>
        </div>
      )}

      {data.proj && (
        <div className="card">
          <CardHead title="Proyección de la cartera a 12 meses" term="asesor_financiero" />
          <div className="kv">
            <dt>Escenario pesimista (10 %)</dt><dd>{fmtMoney(data.proj.p10)}</dd>
            <dt>Escenario central (50 %)</dt><dd>{fmtMoney(data.proj.p50)}</dd>
            <dt>Escenario optimista (90 %)</dt><dd>{fmtMoney(data.proj.p90)}</dd>
            <dt>Probabilidad de terminar con pérdida</dt><dd>{fmtPct(data.proj.probLoss, 0)}</dd>
          </div>
          <p className="tiny muted">{data.proj.note}</p>
        </div>
      )}

      {data.byClass.map(({ cls, list }) => list.length > 0 && (
        <div className="card" key={cls}>
          <CardHead title={CLASS_NAMES[cls]} right={<button className="btn sm ghost" onClick={() => navStore.setSub('invest', cls === 'stocks' ? 'lite' : cls)}>Operar</button>} />
          <div className="rows">
            {list.map((p) => (
              <div className="row" key={p.id}>
                <div className="grow">
                  <div className="title small">{assetName(s, cls, p.id)}</div>
                  <div className="meta">{cls === 'stocks' || cls === 'bonds' ? `${p.qty} u.` : `${p.qty.toFixed(2)} part.`} · costo prom. {fmtMoney(Math.round(p.avgCost))}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="amt">{fmtMoney(p.value)}</div>
                  <div className="tiny"><Money c={p.unrealized} colored sign /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {data.value === 0 && data.props === 0 && (
        <Empty icon="📈">Todavía no invertiste. Podés empezar con poco en un fondo índice, comprar acciones, bonos o participaciones en Mogul Exchange, o un inmueble.</Empty>
      )}

      <div className="card">
        <CardHead title="Últimas operaciones" term="costo_fifo" />
        {s.stocks.trades.length === 0 && <p className="small muted">Sin operaciones.</p>}
        <div className="rows">
          {s.stocks.trades.slice(-8).reverse().map((t) => (
            <div className="row" key={t.id}>
              <div className="grow">
                <div className="small"><Pill tone={t.side === 'compra' ? 'info' : 'accent'}>{t.side}</Pill> {t.market} · {t.assetId}</div>
                <div className="tiny faint">{formatDate(t.day)} · {Number.isInteger(t.qty) ? t.qty : t.qty.toFixed(2)} × {fmtMoney(t.price)} · comisión {fmtMoney(t.fee)}</div>
              </div>
              {t.realized !== undefined && <span className="tiny"><Money c={t.realized} colored sign /></span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
