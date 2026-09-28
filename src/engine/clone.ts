/**
 * Copia profunda del estado. `structuredClone` existe desde Chrome 98; los
 * WebView de Android más viejos (minSdk 22) usan la copia vía JSON, válida
 * porque el estado del juego es JSON puro (sin fechas, funciones ni ciclos).
 */
export function deepClone<T>(x: T): T {
  return typeof structuredClone === 'function' ? structuredClone(x) : (JSON.parse(JSON.stringify(x)) as T);
}
