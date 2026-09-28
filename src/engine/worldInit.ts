import type { GameState } from './state';
import { initStocks } from './invest/stocks';
import { initBonds } from './invest/bonds';
import { initFunds } from './invest/funds';
import { initMogul } from './invest/mogul';
import { initRealEstate } from './realestate/realestate';
import { initPros } from './pros/pros';
import { compactCompany, NPC_KEEP_MONTHS } from './ledger/compaction';

/**
 * Crea los mercados de las Fases 3–4 con el estado actual de la economía:
 * bolsa (con historial previo simulado), bonos, inmuebles, fondos, Mogul
 * Exchange y profesionales. Se usa en partidas nuevas y al migrar partidas v2.
 * El orden importa: los bonos corporativos dependen de las acciones, los fondos
 * de bonos e inmuebles, y Mogul de las zonas inmobiliarias y del motor empresarial.
 */
export function initWorldV3(state: GameState): void {
  const projection = state.meta.projection;
  state.meta.projection = true;
  try {
    initStocks(state);
    initBonds(state);
    initRealEstate(state);
    initFunds(state);
    initMogul(state);
    initPros(state);
    for (const a of state.mogul.assets) if (a.company) compactCompany(state, a.company, NPC_KEEP_MONTHS);
  } finally {
    state.meta.projection = projection;
  }
}
