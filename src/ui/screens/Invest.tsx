import { useNav, navStore } from '../nav';
import { useUI } from '../store';
import { Tabs } from '../components/common';
import { Portfolio } from './invest/Portfolio';
import { StocksLite } from './invest/StocksLite';
import { TradingPro } from './invest/TradingPro';
import { BondsScreen } from './invest/Bonds';
import { FundsScreen } from './invest/Funds';
import { MogulScreen } from './invest/Mogul';
import { RealEstateScreen } from './invest/RealEstate';

type Sub = 'portfolio' | 'lite' | 'pro' | 'bonds' | 'funds' | 'mogul' | 'realestate';

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
      <Tabs<Sub>
        items={[
          { id: 'portfolio', label: 'Cartera' },
          { id: 'lite', label: 'Bolsa Lite' },
          { id: 'pro', label: 'Trading Pro' },
          { id: 'bonds', label: 'Bonos' },
          { id: 'funds', label: 'Fondos' },
          { id: 'mogul', label: 'Mogul' },
          { id: 'realestate', label: 'Inmuebles' },
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
      {sub === 'mogul' && <MogulScreen />}
      {sub === 'realestate' && <RealEstateScreen param={param} />}
    </>
  );
}
