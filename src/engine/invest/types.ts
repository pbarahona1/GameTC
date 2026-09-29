import type { Cents } from '../money';
import type { Company } from '../business/types';
import type { Property } from '../realestate/types';

export type StockSector = 'tecnologia' | 'banca' | 'energia' | 'consumo' | 'industria' | 'salud' | 'telecom' | 'inmobiliaria';

/** Vela diaria (o semanal en el historial compactado). Precios en centavos, volumen en acciones. */
export interface Candle {
  d: number;
  o: Cents;
  h: Cents;
  l: Cents;
  c: Cents;
  v: number;
}

export interface NewsItem {
  day: number;
  text: string;
  impact: number; // variación porcentual atribuida
}

export interface Stock {
  id: string; // ticker
  name: string;
  sector: StockSector;
  description: string;
  shares: number;
  price: Cents;
  prevClose: Cents;
  open: Cents;
  high: Cents;
  low: Cents;
  volume: number;
  avgVolume: number;
  /** Beneficio por acción de los últimos 12 meses (centavos). */
  eps: Cents;
  /** Crecimiento anual esperado de beneficios. */
  growth: number;
  payout: number;
  beta: number;
  /** Volatilidad anual idiosincrática. */
  vol: number;
  /** Deuda / activos (0–1): riesgo financiero y de sus bonos. */
  debtRatio: number;
  /** Salud financiera 0–100 (afecta impago y valoración). */
  health: number;
  /** P/E "justo" de largo plazo según sector y crecimiento. */
  fairPE: number;
  /** Momento (tendencia reciente de compradores/vendedores). */
  momentum: number;
  nextEarnings: number;
  /** Beneficio trimestral esperado por el mercado (centavos por acción). */
  expectedQEps: Cents;
  lastQEps: Cents;
  /** Dividendo trimestral por acción y fechas. */
  dividend: Cents;
  exDay: number;
  status: 'activa' | 'quebrada';
  listedDay: number;
  history: Candle[];
  weekly: Candle[];
  news: NewsItem[];
  splits: Array<{ day: number; ratio: number }>;
}

export type OrderType = 'mercado' | 'limite' | 'stop' | 'stop_limite' | 'take_profit' | 'trailing';
export type OrderSide = 'compra' | 'venta';

export interface Order {
  id: number;
  stockId: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  limit?: Cents;
  stop?: Cents;
  trailPct?: number;
  /** Mejor precio visto (para el stop dinámico). */
  trailRef?: Cents;
  createdDay: number;
  expiresDay: number;
  status: 'abierta' | 'ejecutada' | 'cancelada' | 'vencida' | 'rechazada';
  filledPrice?: Cents;
  filledDay?: number;
  /** Orden "una cancela la otra" (OCO): si esta se ejecuta, la otra se cancela. */
  oco?: number;
  note?: string;
}

/** Lote FIFO de un título (para costo y plazo de tenencia). */
export interface Lot {
  qty: number;
  cost: Cents;
  day: number;
}

export interface Holding {
  qty: number;
  cost: Cents;
  carrying: Cents;
  lots: Lot[];
}

export interface Trade {
  id: number;
  day: number;
  market: 'bolsa' | 'bonos' | 'fondos' | 'mogul' | 'gestor';
  assetId: string;
  side: OrderSide;
  qty: number;
  price: Cents;
  fee: Cents;
  gross: Cents;
  realized?: Cents;
  orderType?: OrderType;
}

export interface StockMarketState {
  stocks: Stock[];
  index: { level: number; base: number; history: Array<{ d: number; v: number }> };
  orders: Order[];
  holdings: Record<string, Holding>;
  trades: Trade[];
  dividendsReceived: Cents;
}

// --------------------------------------------------------------- Bonos

export interface BondIssue {
  id: string;
  issuerKind: 'gobierno' | 'empresa';
  /** Jurisdicción (gobierno) o ticker (empresa). */
  issuer: string;
  name: string;
  coupon: number;
  /** Valor nominal por bono (centavos). */
  face: Cents;
  issueDay: number;
  maturityDay: number;
  /** Rendimiento exigido por el mercado y precio sucio por bono (centavos). */
  yield: number;
  /** Rendimiento del día anterior (para medir el efecto de tasas en fondos). */
  prevYield?: number;
  price: Cents;
  rating: string;
  status: 'vigente' | 'vencido' | 'impago';
  recovery?: number;
  history: Array<{ d: number; p: Cents; y: number }>;
}

export interface BondsState {
  issues: BondIssue[];
  holdings: Record<string, Holding>;
  couponsReceived: Cents;
}

// --------------------------------------------------------------- Fondos

export interface FundState {
  id: string;
  /** Valor liquidativo por participación (centavos, con decimales). */
  nav: number;
  history: Array<{ d: number; v: number }>;
  lastDistribution: number;
  /** Último valor de referencia del subyacente (índice inmobiliario, etc.). */
  ref?: number;
  /** Rendimiento acumulado pendiente de distribuir por participación. */
  accrued?: number;
}

export interface FundsState {
  funds: FundState[];
  holdings: Record<string, Holding>;
  distributionsReceived: Cents;
}

// --------------------------------------------------------------- Mogul Exchange

export type MogulKind = 'empresa' | 'inmueble' | 'regalias';

export interface MogulAsset {
  id: string;
  kind: MogulKind;
  name: string;
  description: string;
  units: number;
  /** Valor por participación (centavos, con decimales). */
  nav: number;
  risk: number;
  /** Diferencial compra/venta (fracción) según liquidez. */
  spread: number;
  company?: Company;
  property?: Property;
  royalty?: { monthly: Cents; decay: number; vol: number; years: number };
  history: Array<{ d: number; v: number }>;
  distributions: Array<{ d: number; perUnit: number }>;
  status: 'activo' | 'liquidado';
  createdDay: number;
  /** Caja del vehículo pendiente de distribuir (centavos). */
  cash: Cents;
  /** Ocupación del edificio (inmuebles). */
  occupancy?: number;
}

export interface MogulState {
  assets: MogulAsset[];
  holdings: Record<string, Holding>;
  distributionsReceived: Cents;
}

// --------------------------------------------------------------- Gestor de inversiones (mandatos)

export type MandateProfile = 'conservador' | 'moderado' | 'agresivo';

export interface MandatePosition {
  kind: 'stock' | 'fund';
  id: string;
  /** Cantidad (acciones enteras o participaciones con decimales). */
  units: number;
}

/**
 * Cuenta gestionada: el jugador entrega dinero a un gestor contratado, que lo
 * invierte en los MISMOS instrumentos del mercado (acciones y fondos) según su
 * criterio. Para el jugador funciona como un fondo privado: tiene "unidades"
 * con un valor por unidad (NAV). Las comisiones del gestor se descuentan del
 * valor, como en cualquier fondo.
 */
export interface Mandate {
  id: string;
  hireId: number;
  managerName: string;
  profile: MandateProfile;
  status: 'activo' | 'cerrado';
  /** Caja del mandato (centavos, puede tener decimales internos). */
  cash: number;
  positions: MandatePosition[];
  /** Unidades emitidas al jugador y valor por unidad (centavos). */
  units: number;
  nav: number;
  /** Máximo histórico del valor por unidad (la comisión de éxito solo se cobra por encima). */
  hwm: number;
  startDay: number;
  lastRebalance: number;
  /** Aportes y retiros netos del jugador (centavos). */
  contributed: number;
  withdrawn: number;
  mgmtFeesPaid: number;
  perfFeesPaid: number;
  tradingCosts: number;
  /** Índice de referencia (Fondo Índice) para comparar: valor del índice al inicio. */
  benchStart: number;
  navStart: number;
  history: Array<{ d: number; nav: number; bench: number }>;
  notes: Array<{ d: number; text: string }>;
}

export interface ManagedState {
  mandates: Mandate[];
  holdings: Record<string, Holding>;
}
