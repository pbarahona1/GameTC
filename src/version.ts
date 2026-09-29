/**
 * Versión de la parte web del juego. Vite la inyecta desde package.json al compilar
 * (en las pruebas se usa el valor de respaldo).
 *  - APP_VERSION: "1.2.0"
 *  - WEB_BUILD: número comparable (1.2.0 → 10200). Las actualizaciones por internet
 *    solo se aplican si el número publicado es mayor que el de la versión instalada.
 */
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';

export function buildNumber(version: string): number {
  const [a, b, c] = version.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  return a * 10000 + b * 100 + c;
}

export const WEB_BUILD = buildNumber(APP_VERSION);
