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
import { SoftGate } from '../components/Gate';

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
      <ScreenIntro icon="invest" title="Invertir" text="Hacé crecer tu dinero: acciones, fondos, bonos, inmuebles o un gestor que invierta por vos. Ninguna ganancia está garantizada." term="diversificacion" />
      <Tabs<Sub>
        items={[
          { id: 'portfolio', label: 'Mis inversiones', icon: 'wallet' },
          { id: 'lite', label: 'Bolsa', icon: 'invest' },
          { id: 'pro', label: 'Trading Pro', icon: 'stocks' },
          { id: 'funds', label: 'Fondos', icon: 'funds' },
          { id: 'gestor', label: 'Gestor', icon: 'gestor' },
          { id: 'bonds', label: 'Bonos', icon: 'bonds' },
          { id: 'realestate', label: 'Inmuebles', icon: 'realestate' },
          { id: 'mogul', label: 'Mogul', icon: 'luxury' },
        ]}
        value={sub}
        onChange={(v) => {
          navStore.setSub('invest', v);
          window.scrollTo({ top: 0 });
        }}
      />
      {sub === 'portfolio' && <Portfolio />}
      {sub === 'lite' && <StocksLite selected={param || null} />}
      {sub === 'pro' && <SoftGate id="trading"><TradingPro selected={param || null} /></SoftGate>}
      {sub === 'bonds' && <BondsScreen />}
      {sub === 'funds' && <FundsScreen />}
      {sub === 'gestor' && <SoftGate id="gestor"><GestorScreen /></SoftGate>}
      {sub === 'mogul' && <SoftGate id="mogul"><MogulScreen /></SoftGate>}
      {sub === 'realestate' && <SoftGate id="realestate"><RealEstateScreen param={param} /></SoftGate>}
    </>
  );
}
