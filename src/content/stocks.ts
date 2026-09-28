import type { StockSector } from '../engine/invest/types';

/** Empresas FICTICIAS que cotizan en la Bolsa de Valoria. */
export interface StockDef {
  id: string;
  name: string;
  sector: StockSector;
  description: string;
  price: number; // USD iniciales
  shares: number; // millones de acciones
  pe: number; // P/E inicial
  growth: number;
  payout: number;
  beta: number;
  vol: number;
  debtRatio: number;
  health: number;
}

export const SECTOR_NAMES: Record<StockSector, string> = {
  tecnologia: 'Tecnología', banca: 'Banca', energia: 'Energía', consumo: 'Consumo', industria: 'Industria', salud: 'Salud', telecom: 'Telecomunicaciones', inmobiliaria: 'Inmobiliaria',
};

/** P/E de referencia por sector (empresas de crecimiento medio con tasas normales). */
export const SECTOR_PE: Record<StockSector, number> = {
  tecnologia: 24, banca: 11, energia: 10, consumo: 18, industria: 14, salud: 20, telecom: 13, inmobiliaria: 15,
};

export const STOCK_DEFS: StockDef[] = [
  { id: 'NBLA', name: 'Nébula Software', sector: 'tecnologia', description: 'Software de gestión en la nube para pymes. Crece rápido, no paga dividendos y su precio es muy sensible a las tasas.', price: 84, shares: 120, pe: 32, growth: 0.2, payout: 0, beta: 1.4, vol: 0.32, debtRatio: 0.15, health: 70 },
  { id: 'CIRQ', name: 'Circuito Andino', sector: 'tecnologia', description: 'Fabricante de chips y componentes. Ciclo de demanda marcado.', price: 46, shares: 210, pe: 18, growth: 0.1, payout: 0.2, beta: 1.5, vol: 0.34, debtRatio: 0.35, health: 60 },
  { id: 'BVAL', name: 'Banco de Valoria', sector: 'banca', description: 'El banco más grande del país. Gana más con tasas altas, sufre en crisis bancarias.', price: 38, shares: 540, pe: 10, growth: 0.04, payout: 0.5, beta: 1.1, vol: 0.22, debtRatio: 0.85, health: 72 },
  { id: 'CRDN', name: 'Credinova', sector: 'banca', description: 'Financiera de consumo: créditos rápidos con márgenes altos y morosidad sensible al desempleo.', price: 17, shares: 160, pe: 8, growth: 0.07, payout: 0.35, beta: 1.6, vol: 0.38, debtRatio: 0.8, health: 48 },
  { id: 'PTRS', name: 'Petrosur', sector: 'energia', description: 'Petrolera integrada. Dividendos altos y precio atado a la energía.', price: 52, shares: 380, pe: 9, growth: 0.02, payout: 0.6, beta: 0.9, vol: 0.28, debtRatio: 0.45, health: 66 },
  { id: 'SOLR', name: 'Solaria Renovables', sector: 'energia', description: 'Parques solares y eólicos con contratos a largo plazo. Deuda alta, flujo estable.', price: 29, shares: 150, pe: 22, growth: 0.12, payout: 0.3, beta: 0.8, vol: 0.26, debtRatio: 0.6, health: 58 },
  { id: 'MRKT', name: 'Mercantil del Sur', sector: 'consumo', description: 'Cadena de supermercados. Defensiva: vende lo mismo en crisis y en auges.', price: 61, shares: 260, pe: 17, growth: 0.05, payout: 0.45, beta: 0.6, vol: 0.18, debtRatio: 0.4, health: 78 },
  { id: 'TOST', name: 'Tostadores Unidos', sector: 'consumo', description: 'Café y bebidas con marcas propias. Sensible al consumo discrecional y al precio de los granos.', price: 33, shares: 90, pe: 20, growth: 0.08, payout: 0.35, beta: 1.0, vol: 0.24, debtRatio: 0.3, health: 70 },
  { id: 'ACRV', name: 'Aceros del Valle', sector: 'industria', description: 'Siderúrgica exportadora. Muy cíclica: gana mucho en auges y pierde en recesiones.', price: 24, shares: 300, pe: 11, growth: 0.03, payout: 0.3, beta: 1.3, vol: 0.33, debtRatio: 0.5, health: 55 },
  { id: 'MADN', name: 'Maderas del Norte', sector: 'industria', description: 'Maderas y muebles para el hogar. Depende de la construcción y del consumo.', price: 19, shares: 70, pe: 13, growth: 0.05, payout: 0.25, beta: 1.2, vol: 0.3, debtRatio: 0.4, health: 60 },
  { id: 'VITL', name: 'Vitalis Farma', sector: 'salud', description: 'Laboratorio de medicamentos. Estable, con resultados que dependen de aprobaciones de nuevos productos.', price: 112, shares: 95, pe: 21, growth: 0.08, payout: 0.3, beta: 0.7, vol: 0.24, debtRatio: 0.25, health: 80 },
  { id: 'AURA', name: 'Clínicas Aurora', sector: 'salud', description: 'Red de clínicas privadas. Crece con la población asegurada.', price: 41, shares: 60, pe: 19, growth: 0.09, payout: 0.2, beta: 0.8, vol: 0.25, debtRatio: 0.45, health: 64 },
  { id: 'TELV', name: 'Telvaria', sector: 'telecom', description: 'Operador de telefonía e internet. Dividendo alto y poco crecimiento.', price: 27, shares: 700, pe: 12, growth: 0.02, payout: 0.7, beta: 0.6, vol: 0.18, debtRatio: 0.55, health: 70 },
  { id: 'ONDA', name: 'OndaNet', sector: 'telecom', description: 'Fibra óptica y centros de datos. Invierte mucho para crecer.', price: 14, shares: 180, pe: 26, growth: 0.15, payout: 0, beta: 1.3, vol: 0.36, debtRatio: 0.55, health: 52 },
  { id: 'URBE', name: 'Urbe Desarrollos', sector: 'inmobiliaria', description: 'Constructora de viviendas. Muy sensible a las tasas hipotecarias.', price: 22, shares: 110, pe: 12, growth: 0.06, payout: 0.2, beta: 1.4, vol: 0.34, debtRatio: 0.6, health: 55 },
  { id: 'PLZA', name: 'Plaza Centros Comerciales', sector: 'inmobiliaria', description: 'Dueña de centros comerciales que alquila locales. Reparte casi todo en dividendos.', price: 35, shares: 140, pe: 16, growth: 0.03, payout: 0.85, beta: 0.9, vol: 0.2, debtRatio: 0.5, health: 68 },
];

/** Empresas que pueden salir a bolsa más adelante (salidas a bolsa / OPV). */
export const IPO_POOL: StockDef[] = [
  { id: 'ROBO', name: 'Robótica Austral', sector: 'tecnologia', description: 'Automatización industrial. Joven, rentable a medias y muy volátil.', price: 20, shares: 80, pe: 45, growth: 0.3, payout: 0, beta: 1.7, vol: 0.45, debtRatio: 0.2, health: 55 },
  { id: 'VERD', name: 'Verde Alimentos', sector: 'consumo', description: 'Alimentos orgánicos con marca propia.', price: 15, shares: 60, pe: 25, growth: 0.14, payout: 0.1, beta: 0.9, vol: 0.3, debtRatio: 0.3, health: 62 },
  { id: 'NAVI', name: 'Naviera del Pacífico', sector: 'industria', description: 'Transporte marítimo de contenedores. Muy cíclica.', price: 30, shares: 100, pe: 7, growth: 0.02, payout: 0.5, beta: 1.5, vol: 0.4, debtRatio: 0.55, health: 50 },
  { id: 'BIOG', name: 'BioGénesis', sector: 'salud', description: 'Biotecnología: sus resultados dependen de ensayos clínicos.', price: 12, shares: 50, pe: 60, growth: 0.35, payout: 0, beta: 1.2, vol: 0.55, debtRatio: 0.1, health: 45 },
];
