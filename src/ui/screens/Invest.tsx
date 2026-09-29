import { useNav, navStore } from '../nav';
import { useUI } from '../store';
import { Tabs, ScreenIntro } from '../components/common';
import { Portfolio } from './invest/Portfolio';
import { StocksLite } from './invest/StocksLite';
import { TradingPro } from './invest/TradingPro';
import { BondsScreen } from './invest/Bonds';
import { FundsScreen } from './invest/Funds';
import { MogulScreen } from './invest/Mogul';
import { RealEstateScreen } from './invest/RealEstate';
import { GestorScreen } from './invest/Gestor';

type Sub = 'portfolio' | 'lite' | 'pro' | 'bonds' | 'funds' | 'gestor' | 'mogul' | 'realestate';

/**
 * Inversiones: cartera, bolsa (Lite y Pro sobre el MISMO mercado y la MISMA
 * contabilidad), bonos, fondos, Mogul Exchange y bienes raíces.
 * La subsección puede traer un parámetro: "pro:NBLA", "realestate:prop:12".
 */
export function Invest() {
  const nav = useNav();
  useUI();
  const raw = nav.sub.invest ?? 'portfolio';
  const [sub, ...rest] = raw.split(':') as [Sub, ...string[]];
  const param = rest.join(':');
  return (
    <>
      <ScreenIntro icon="📈" title="Invertir" text="Hacé crecer tu dinero: acciones, fondos, bonos, inmuebles o un gestor que invierta por vos. Ninguna ganancia está garantizada." term="diversificacion" />
      <Tabs<Sub>
        items={[
          { id: 'portfolio', label: '💼 Mis inversiones' },
          { id: 'lite', label: '📈 Bolsa' },
          { id: 'pro', label: '📊 Trading Pro' },
          { id: 'funds', label: '🧺 Fondos' },
          { id: 'gestor', label: '🧑‍💼 Gestor' },
          { id: 'bonds', label: '🏛️ Bonos' },
          { id: 'realestate', label: '🏠 Inmuebles' },
          { id: 'mogul', label: '🧩 Mogul' },
        ]}
        value={sub}
        onChange={(v) => {
          navStore.setSub('invest', v);
          window.scrollTo({ top: 0 });
        }}
      />
      {sub === 'portfolio' && <Portfolio />}
      {sub === 'lite' && <StocksLite selected={param || null} />}
      {sub === 'pro' && <TradingPro selected={param || null} />}
      {sub === 'bonds' && <BondsScreen />}
      {sub === 'funds' && <FundsScreen />}
      {sub === 'gestor' && <GestorScreen />}
      {sub === 'mogul' && <MogulScreen />}
      {sub === 'realestate' && <RealEstateScreen param={param} />}
    </>
  );
}
