import { useSyncExternalStore } from 'react';
import { otaStore } from '../persistence/ota';

/** Estado de las actualizaciones por internet (búsqueda, descarga, versión nueva). */
export function useOta() {
  return useSyncExternalStore(otaStore.subscribe, otaStore.get);
}
