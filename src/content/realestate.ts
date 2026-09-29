import type { JurisdictionId } from './jurisdictions';
import type { PropertyType } from '../engine/realestate/types';

/** Zonas inmobiliarias FICTICIAS. Precios y alquileres base en USD por m². */
export interface ZoneDef {
  id: string;
  name: string;
  jurisdiction: JurisdictionId;
  description: string;
  price: Record<PropertyType, number>;
  /** Alquiler mensual por m². */
  rent: Record<PropertyType, number>;
  /** Vacancia natural del mercado por tipo (fracción). */
  vacancy: Record<PropertyType, number>;
  /** Riesgo de inquilinos morosos (0–1, mayor = más riesgo). */
  tenantRisk: number;
  /** Sesgo de revalorización anual propio de la zona. */
  bias: number;
  /** Volatilidad anual de precios. */
  vol: number;
}

export const PROPERTY_TYPE_NAMES: Record<PropertyType, string> = { vivienda: 'Vivienda', local: 'Local comercial', oficina: 'Oficina', terreno: 'Terreno', cochera: 'Cochera' };
export const PROPERTY_TYPE_ICONS: Record<PropertyType, string> = { vivienda: '🏠', local: '🏪', oficina: '🏢', terreno: '🌳', cochera: '🅿️' };

export const ZONES: ZoneDef[] = [
  { id: 'centro', name: 'Valdoria Centro', jurisdiction: 'valdoria', description: 'Centro financiero y comercial. Caro, con demanda estable de oficinas y locales.',
    price: { vivienda: 2600, local: 3200, oficina: 2900, terreno: 900 , cochera: 1500 }, rent: { vivienda: 11, local: 19, oficina: 15, terreno: 0.6 , cochera: 9 },
    vacancy: { vivienda: 0.04, local: 0.07, oficina: 0.09, terreno: 0.5 , cochera: 0.05 }, tenantRisk: 0.2, bias: 0.005, vol: 0.05 },
  { id: 'norte', name: 'Barrio Norte', jurisdiction: 'valdoria', description: 'Residencial de clase media-alta. Viviendas muy demandadas, alquileres seguros.',
    price: { vivienda: 2100, local: 2200, oficina: 1900, terreno: 700 , cochera: 1200 }, rent: { vivienda: 9, local: 13, oficina: 10, terreno: 0.4 , cochera: 7 },
    vacancy: { vivienda: 0.03, local: 0.08, oficina: 0.12, terreno: 0.6 , cochera: 0.06 }, tenantRisk: 0.15, bias: 0.01, vol: 0.045 },
  { id: 'sur', name: 'Zona Sur', jurisdiction: 'valdoria', description: 'Barrios populares: precios bajos y rentabilidad alta, pero más morosidad y vacancia.',
    price: { vivienda: 950, local: 1100, oficina: 900, terreno: 250 , cochera: 450 }, rent: { vivienda: 6, local: 8, oficina: 6, terreno: 0.3 , cochera: 3.2 },
    vacancy: { vivienda: 0.07, local: 0.12, oficina: 0.18, terreno: 0.6 , cochera: 0.12 }, tenantRisk: 0.45, bias: 0.0, vol: 0.06 },
  { id: 'industrial', name: 'Parque Industrial Este', jurisdiction: 'valdoria', description: 'Galpones, locales y terrenos. Muy ligado al ciclo económico.',
    price: { vivienda: 800, local: 1300, oficina: 1100, terreno: 180 , cochera: 400 }, rent: { vivienda: 5, local: 9, oficina: 7, terreno: 0.5 , cochera: 3 },
    vacancy: { vivienda: 0.1, local: 0.1, oficina: 0.14, terreno: 0.4 , cochera: 0.15 }, tenantRisk: 0.3, bias: -0.005, vol: 0.08 },
  { id: 'costa', name: 'Costa Esmeralda (Isla Coral)', jurisdiction: 'isla_coral', description: 'Lujo frente al mar. Valorización fuerte en auges, caídas bruscas en crisis; impuestos bajos.',
    price: { vivienda: 5200, local: 4800, oficina: 4200, terreno: 1600 , cochera: 2200 }, rent: { vivienda: 18, local: 24, oficina: 17, terreno: 0.8 , cochera: 11 },
    vacancy: { vivienda: 0.1, local: 0.12, oficina: 0.15, terreno: 0.6 , cochera: 0.1 }, tenantRisk: 0.15, bias: 0.015, vol: 0.1 },
  { id: 'distrito_real', name: 'Distrito Real (Norvalia)', jurisdiction: 'norvalia', description: 'Capital de Norvalia: mercado maduro, estable y con inquilinos solventes.',
    price: { vivienda: 3400, local: 3600, oficina: 3800, terreno: 1200 , cochera: 1800 }, rent: { vivienda: 12, local: 18, oficina: 17, terreno: 0.5 , cochera: 10 },
    vacancy: { vivienda: 0.03, local: 0.06, oficina: 0.07, terreno: 0.6 , cochera: 0.05 }, tenantRisk: 0.1, bias: 0.005, vol: 0.035 },
  { id: 'puerto_nuevo', name: 'Puerto Nuevo (Meridia)', jurisdiction: 'meridia', description: 'Zona en crecimiento con proyectos nuevos. Buena rentabilidad, impuesto inmobiliario alto.',
    price: { vivienda: 1700, local: 2000, oficina: 1800, terreno: 450 , cochera: 900 }, rent: { vivienda: 9, local: 12, oficina: 11, terreno: 0.4 , cochera: 6 },
    vacancy: { vivienda: 0.05, local: 0.09, oficina: 0.1, terreno: 0.5 , cochera: 0.08 }, tenantRisk: 0.25, bias: 0.02, vol: 0.06 },
];

export const ZONE_BY_ID: Record<string, ZoneDef> = Object.fromEntries(ZONES.map((z) => [z.id, z]));

/** Bancos hipotecarios. */
export interface MortgageBank {
  id: string;
  name: string;
  tagline: string;
  maxLtv: number;
  maxLtvLand: number;
  fixedSpread: number;
  variableSpread: number;
  maxYears: number;
  minScore: number;
  maxDti: number;
  fee: number;
  forCompanies: boolean;
}

export const MORTGAGE_BANKS: MortgageBank[] = [
  { id: 'bval_hipo', name: 'Banco de Valoria · Hipotecas', tagline: 'Financia hasta el 80 % con buen puntaje', maxLtv: 0.8, maxLtvLand: 0.5, fixedSpread: 0.025, variableSpread: 0.018, maxYears: 30, minScore: 660, maxDti: 0.43, fee: 0.01, forCompanies: false },
  { id: 'andina_hipo', name: 'Hipotecaria Andina', tagline: 'Más flexible con el puntaje, pero más cara', maxLtv: 0.7, maxLtvLand: 0.4, fixedSpread: 0.036, variableSpread: 0.028, maxYears: 25, minScore: 600, maxDti: 0.5, fee: 0.015, forCompanies: false },
  { id: 'austral_corp', name: 'Banco Austral · Inmuebles corporativos', tagline: 'Hipotecas para empresas con flujo demostrable', maxLtv: 0.65, maxLtvLand: 0.4, fixedSpread: 0.03, variableSpread: 0.024, maxYears: 20, minScore: 0, maxDti: 0, fee: 0.012, forCompanies: true },
];

export const MORTGAGE_BANK_BY_ID: Record<string, MortgageBank> = Object.fromEntries(MORTGAGE_BANKS.map((b) => [b.id, b]));

/** Costo de construcción por m² (USD) al desarrollar un terreno. */
export const BUILD_COST: Record<Exclude<PropertyType, 'terreno'>, number> = { vivienda: 950, local: 850, oficina: 1150, cochera: 420 };

export const TENANT_NAMES = [
  'Familia Paredes', 'Lucía Ortega', 'Estudio Rivas & Asoc.', 'Farmacia San Roque', 'Tomás Herrera', 'Panadería La Espiga', 'Consultora Delta', 'Familia Quintero',
  'Óptica Visión', 'Carla Méndez', 'Academia Idiomas Plus', 'Familia Salazar', 'Estudio Jurídico Vega', 'Ferretería El Tornillo', 'Martín Aguilar', 'Clínica Dental Sonrisa',
];
