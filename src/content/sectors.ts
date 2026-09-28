/**
 * Sectores empresariales. Todos usan el MISMO motor (inventario, compras,
 * producción, personal, marketing, demanda, finanzas), pero cada uno tiene
 * una economía propia definida por estos datos: márgenes, perecibilidad,
 * intensidad de capital, crédito a clientes, estacionalidad, sensibilidad a
 * las tasas de interés y modelo de ingresos.
 *
 * Todos los importes están en USD a precios del año inicial; el motor los
 * multiplica por el índice de precios (inflación acumulada).
 */
export type BusinessModel = 'food_service' | 'retail' | 'manufacturing' | 'subscription' | 'services' | 'holding';
export type BizSectorId = 'cafeteria' | 'minimarket' | 'muebles' | 'saas' | 'consultora' | 'holding';
export type DeptId = 'direccion' | 'finanzas' | 'operaciones' | 'ventas' | 'marketing' | 'rrhh' | 'tecnologia' | 'logistica' | 'atencion' | 'id';

export const DEPT_NAMES: Record<DeptId, string> = {
  direccion: 'Dirección', finanzas: 'Finanzas', operaciones: 'Operaciones', ventas: 'Ventas', marketing: 'Marketing',
  rrhh: 'Recursos humanos', tecnologia: 'Tecnología', logistica: 'Logística', atencion: 'Atención al cliente', id: 'Investigación y desarrollo',
};

export interface ItemDef {
  id: string;
  name: string;
  unit: string;
  /** Días hasta vencer (sin refrigeración). Sin valor = no perecedero. */
  shelfLifeDays?: number;
  /** Costo de almacenamiento por unidad y mes (USD). */
  storageCost: number;
}

export interface SupplierDef {
  id: string;
  name: string;
  itemId: string;
  unitCost: number;
  /** Calidad del insumo 0–100: afecta la calidad del producto final. */
  quality: number;
  leadDays: number;
  /** Probabilidad de entregar a tiempo y completo. */
  reliability: number;
  minOrder: number;
  /** 0 = pago al contado al pedir; >0 = crédito a N días desde la entrega. */
  paymentDays: number;
  deliveryFee: number;
  /** Red de contactos mínima para acceder a este proveedor. */
  networkRequired?: number;
}

export interface ProductDef {
  id: string;
  name: string;
  unit: string;
  refPrice: number;
  /** Insumos por unidad vendida/producida. Venta directa (retail): el propio artículo. */
  recipe: Array<{ item: string; qty: number }>;
  /** Unidades de capacidad productiva que consume cada unidad. */
  laborUnits: number;
  /** Demanda diaria de TODO el mercado (unidades, clientes, altas u horas). */
  marketDaily: number;
  /** Sensibilidad de la demanda al precio. */
  elasticity: number;
}

export type CapacityKind = 'production' | 'service' | 'hours' | 'users';

export interface RoleDef {
  id: string;
  name: string;
  dept: DeptId;
  baseWage: number;
  capacity?: { kind: CapacityKind; perDay: number };
  description: string;
}

export interface EquipmentDef {
  id: string;
  name: string;
  cost: number;
  lifeMonths: number;
  /** Aumento de la capacidad productiva/de servicio (0.2 = +20 %). */
  capacityBonus: number;
  qualityBonus: number;
  maintenance: number;
  /** Multiplica la vida útil de los perecederos (refrigeración). */
  shelfLifeMult?: number;
  /** Reduce el costo logístico por unidad (0.6 = −60 %). */
  logisticsCut?: number;
  /** Reduce las mermas por robo/error (0.5 = −50 %). */
  shrinkageCut?: number;
  description: string;
}

export interface CompetitorSeed {
  name: string;
  priceMult: number;
  quality: number;
  reputation: number;
  awareness: number;
}

export interface SectorDef {
  id: BizSectorId;
  name: string;
  icon: string;
  tagline: string;
  model: BusinessModel;
  economics: string[];
  rent: number;
  depositMonths: number;
  license: number;
  utilities: number;
  /** Costo variable por unidad vendida (empaque, flete, servidores…). */
  variableCost: number;
  variableCostLabel: string;
  /** Comisión sobre ventas (procesamiento de pagos). */
  salesFeeRate: number;
  receivableDays: number;
  /** Mermas diarias sobre lo vendido (robo, errores). */
  shrinkage: number;
  /** Cancelaciones mensuales base (suscripción). */
  baseChurn?: number;
  items: ItemDef[];
  suppliers: SupplierDef[];
  products: ProductDef[];
  roles: RoleDef[];
  equipment: EquipmentDef[];
  starterEquipment: string[];
  starterStaff: Record<string, number>;
  weekday: number[];
  monthly: number[];
  /** Sensibilidad de la demanda a la tasa de interés (bienes durables > consumo diario). */
  rateSensitivity: number;
  competitors: CompetitorSeed[];
  recommendedCapital: number;
  benchmarks: { grossMargin: number; wageShare: number };
  requirements?: { label: string; check: 'accounting10' };
}

/** Roles comunes a todos los sectores (departamentos de apoyo). */
export const COMMON_ROLES: RoleDef[] = [
  { id: 'gerente', name: 'Gerente general', dept: 'direccion', baseWage: 2400, description: 'Permite delegar la operación: reposición, precios y personal. Su habilidad determina la calidad de sus decisiones.' },
  { id: 'contador', name: 'Contador', dept: 'finanzas', baseWage: 1500, description: 'Cobra más rápido a clientes, reduce mermas por errores y comisiones bancarias.' },
  { id: 'vendedor', name: 'Ejecutivo de ventas', dept: 'ventas', baseWage: 1150, description: 'Aumenta el atractivo comercial (+8 % por persona, máx. +24 %).' },
  { id: 'marketing', name: 'Especialista en marketing', dept: 'marketing', baseWage: 1400, description: 'Hace más eficientes las campañas (+25 % por persona, máx. +50 %).' },
  { id: 'rrhh', name: 'Analista de RR. HH.', dept: 'rrhh', baseWage: 1300, description: 'Mejora la moral y reduce la rotación del personal.' },
  { id: 'soporte', name: 'Atención al cliente', dept: 'atencion', baseWage: 950, description: 'Mejora la reputación y reduce las cancelaciones de clientes.' },
  { id: 'logistica', name: 'Coordinador logístico', dept: 'logistica', baseWage: 1100, description: 'Reduce 1 día los plazos de entrega de proveedores y 30 % los fletes.' },
  { id: 'investigador', name: 'Investigación y desarrollo', dept: 'id', baseWage: 2000, description: 'Mejora la calidad del producto con el tiempo (hasta +15 puntos).' },
];

const W_FOOD = [0.8, 1.0, 1.0, 1.0, 1.05, 1.2, 1.1];

export const SECTORS: SectorDef[] = [
  {
    id: 'cafeteria', name: 'Cafetería y cocina', icon: '☕', tagline: 'Perecederos, mucho personal, clientes diarios', model: 'food_service',
    economics: [
      'Se cocina a pedido: cada venta consume insumos y capacidad de cocina y de servicio.',
      'Insumos perecederos (pan 3 días, leche 10 días): comprar de más genera mermas.',
      'Margen bruto alto (≈ 65 %), pero sueldos y alquiler pesan mucho.',
      'Fines de semana y diciembre venden más.',
    ],
    rent: 2600, depositMonths: 2, license: 600, utilities: 1200, variableCost: 0.25, variableCostLabel: 'Empaques y descartables', salesFeeRate: 0.015, receivableDays: 0, shrinkage: 0.005,
    items: [
      { id: 'cafe', name: 'Café en grano', unit: 'kg', shelfLifeDays: 120, storageCost: 0.2 },
      { id: 'leche', name: 'Leche', unit: 'litro', shelfLifeDays: 10, storageCost: 0.1 },
      { id: 'pan', name: 'Pan y masas', unit: 'unidad', shelfLifeDays: 3, storageCost: 0.05 },
      { id: 'insumos', name: 'Insumos de cocina', unit: 'kg', shelfLifeDays: 6, storageCost: 0.15 },
    ],
    suppliers: [
      { id: 'cafe_std', name: 'Tostadora Central', itemId: 'cafe', unitCost: 12, quality: 60, leadDays: 3, reliability: 0.95, minOrder: 5, paymentDays: 0, deliveryFee: 8 },
      { id: 'cafe_esp', name: 'Finca Las Nubes (especialidad)', itemId: 'cafe', unitCost: 19, quality: 90, leadDays: 6, reliability: 0.85, minOrder: 5, paymentDays: 0, deliveryFee: 15, networkRequired: 15 },
      { id: 'leche_coop', name: 'Cooperativa Lechera', itemId: 'leche', unitCost: 1.1, quality: 65, leadDays: 1, reliability: 0.97, minOrder: 20, paymentDays: 0, deliveryFee: 5 },
      { id: 'pan_barrio', name: 'Panadería San José', itemId: 'pan', unitCost: 0.45, quality: 60, leadDays: 1, reliability: 0.95, minOrder: 30, paymentDays: 0, deliveryFee: 3 },
      { id: 'pan_artesanal', name: 'Masa Madre Artesanal', itemId: 'pan', unitCost: 0.7, quality: 88, leadDays: 1, reliability: 0.9, minOrder: 30, paymentDays: 0, deliveryFee: 5 },
      { id: 'mercado', name: 'Mercado Mayorista', itemId: 'insumos', unitCost: 5.5, quality: 55, leadDays: 1, reliability: 0.93, minOrder: 10, paymentDays: 0, deliveryFee: 6 },
      { id: 'distrib_gourmet', name: 'Distribuidora Gourmet', itemId: 'insumos', unitCost: 7.2, quality: 85, leadDays: 2, reliability: 0.96, minOrder: 10, paymentDays: 15, deliveryFee: 10, networkRequired: 10 },
    ],
    products: [
      { id: 'cafe', name: 'Café', unit: 'taza', refPrice: 2.5, recipe: [{ item: 'cafe', qty: 0.02 }, { item: 'leche', qty: 0.15 }], laborUnits: 0.3, marketDaily: 900, elasticity: 1.8 },
      { id: 'desayuno', name: 'Desayuno / sándwich', unit: 'plato', refPrice: 6.5, recipe: [{ item: 'pan', qty: 1 }, { item: 'insumos', qty: 0.25 }], laborUnits: 1, marketDaily: 350, elasticity: 1.8 },
      { id: 'almuerzo', name: 'Almuerzo del día', unit: 'plato', refPrice: 9.5, recipe: [{ item: 'insumos', qty: 0.5 }, { item: 'pan', qty: 1 }], laborUnits: 1.5, marketDaily: 300, elasticity: 1.7 },
    ],
    roles: [
      { id: 'cocinero', name: 'Cocinero / barista', dept: 'operaciones', baseWage: 1100, capacity: { kind: 'production', perDay: 60 }, description: 'Prepara los pedidos: 60 unidades de trabajo por día (un café = 0,3; un almuerzo = 1,5).' },
      { id: 'mesero', name: 'Mesero / cajero', dept: 'atencion', baseWage: 950, capacity: { kind: 'service', perDay: 120 }, description: 'Atiende hasta 120 clientes por día.' },
    ],
    equipment: [
      { id: 'espresso', name: 'Máquina de espresso', cost: 4500, lifeMonths: 60, capacityBonus: 0.15, qualityBonus: 8, maintenance: 60, description: 'Más velocidad y mejor café.' },
      { id: 'cocina', name: 'Cocina industrial', cost: 6000, lifeMonths: 84, capacityBonus: 0.15, qualityBonus: 4, maintenance: 60, description: 'Base de la producción.' },
      { id: 'refri', name: 'Cámara de refrigeración', cost: 2500, lifeMonths: 84, capacityBonus: 0, qualityBonus: 2, maintenance: 30, shelfLifeMult: 1.6, description: 'Los perecederos duran 60 % más.' },
      { id: 'mobiliario', name: 'Mobiliario y ambientación', cost: 3000, lifeMonths: 60, capacityBonus: 0.1, qualityBonus: 5, maintenance: 20, description: 'Más mesas y mejor experiencia.' },
      { id: 'horno', name: 'Horno de panadería propio', cost: 7000, lifeMonths: 96, capacityBonus: 0.2, qualityBonus: 6, maintenance: 70, description: 'Más capacidad y calidad en platos.' },
    ],
    starterEquipment: ['espresso', 'cocina', 'refri', 'mobiliario'],
    starterStaff: { cocinero: 2, mesero: 2 },
    weekday: W_FOOD,
    monthly: [0.9, 0.95, 1, 1, 1, 0.97, 1, 1, 1, 1, 1.05, 1.15],
    rateSensitivity: 0.5,
    competitors: [
      { name: 'Café Aurora', priceMult: 1.0, quality: 62, reputation: 65, awareness: 70 },
      { name: 'Panadería Don Julio', priceMult: 0.88, quality: 55, reputation: 60, awareness: 60 },
      { name: 'Bistró Central', priceMult: 1.22, quality: 76, reputation: 70, awareness: 55 },
    ],
    recommendedCapital: 28000,
    benchmarks: { grossMargin: 0.65, wageShare: 0.3 },
  },
  {
    id: 'minimarket', name: 'Minimercado de barrio', icon: '🛒', tagline: 'Márgenes bajos, alto volumen, mermas', model: 'retail',
    economics: [
      'Se revende mercadería: no hay producción, el costo es el precio del proveedor.',
      'Margen bruto bajo (≈ 25–35 %): la rentabilidad depende del volumen.',
      'Clientes muy sensibles al precio (elasticidad alta).',
      'Robo y errores de caja generan mermas: cámaras y un contador las reducen.',
    ],
    rent: 2000, depositMonths: 2, license: 400, utilities: 900, variableCost: 0.03, variableCostLabel: 'Bolsas y etiquetas', salesFeeRate: 0.012, receivableDays: 0, shrinkage: 0.012,
    items: [
      { id: 'abarrotes', name: 'Abarrotes', unit: 'unidad', storageCost: 0.03 },
      { id: 'frescos', name: 'Frutas y verduras', unit: 'kg', shelfLifeDays: 7, storageCost: 0.05 },
      { id: 'bebidas', name: 'Bebidas', unit: 'unidad', shelfLifeDays: 365, storageCost: 0.02 },
      { id: 'limpieza', name: 'Limpieza e higiene', unit: 'unidad', storageCost: 0.03 },
    ],
    suppliers: [
      { id: 'mayorista', name: 'Mayorista El Puerto', itemId: 'abarrotes', unitCost: 2.4, quality: 60, leadDays: 3, reliability: 0.94, minOrder: 200, paymentDays: 30, deliveryFee: 25 },
      { id: 'directo', name: 'Fábrica directa (volumen)', itemId: 'abarrotes', unitCost: 2.15, quality: 60, leadDays: 7, reliability: 0.88, minOrder: 800, paymentDays: 0, deliveryFee: 40, networkRequired: 20 },
      { id: 'huerta', name: 'Huertas del Norte', itemId: 'frescos', unitCost: 1.3, quality: 70, leadDays: 1, reliability: 0.9, minOrder: 50, paymentDays: 0, deliveryFee: 10 },
      { id: 'agro', name: 'Agroexportadora (segunda)', itemId: 'frescos', unitCost: 0.95, quality: 45, leadDays: 2, reliability: 0.85, minOrder: 100, paymentDays: 0, deliveryFee: 10 },
      { id: 'embotelladora', name: 'Embotelladora Nacional', itemId: 'bebidas', unitCost: 0.7, quality: 65, leadDays: 2, reliability: 0.98, minOrder: 240, paymentDays: 30, deliveryFee: 20 },
      { id: 'quimicos', name: 'Distribuidora Brillo', itemId: 'limpieza', unitCost: 2.0, quality: 60, leadDays: 4, reliability: 0.95, minOrder: 100, paymentDays: 30, deliveryFee: 15 },
    ],
    products: [
      { id: 'abarrotes', name: 'Abarrotes', unit: 'unidad', refPrice: 3.0, recipe: [{ item: 'abarrotes', qty: 1 }], laborUnits: 0, marketDaily: 1400, elasticity: 3 },
      { id: 'frescos', name: 'Frutas y verduras', unit: 'kg', refPrice: 1.85, recipe: [{ item: 'frescos', qty: 1 }], laborUnits: 0, marketDaily: 900, elasticity: 2.6 },
      { id: 'bebidas', name: 'Bebidas', unit: 'unidad', refPrice: 1.02, recipe: [{ item: 'bebidas', qty: 1 }], laborUnits: 0, marketDaily: 1600, elasticity: 3.2 },
      { id: 'limpieza', name: 'Limpieza e higiene', unit: 'unidad', refPrice: 2.65, recipe: [{ item: 'limpieza', qty: 1 }], laborUnits: 0, marketDaily: 500, elasticity: 2.8 },
    ],
    roles: [
      { id: 'cajero', name: 'Cajero', dept: 'ventas', baseWage: 900, capacity: { kind: 'service', perDay: 320 }, description: 'Atiende hasta 320 artículos por día.' },
      { id: 'reponedor', name: 'Reponedor', dept: 'logistica', baseWage: 850, capacity: { kind: 'service', perDay: 200 }, description: 'Mantiene las góndolas llenas: +200 artículos por día de capacidad.' },
    ],
    equipment: [
      { id: 'gondolas', name: 'Góndolas y estanterías', cost: 3000, lifeMonths: 84, capacityBonus: 0.1, qualityBonus: 3, maintenance: 15, description: 'Más exhibición.' },
      { id: 'heladeras', name: 'Heladeras exhibidoras', cost: 4000, lifeMonths: 84, capacityBonus: 0, qualityBonus: 5, maintenance: 40, shelfLifeMult: 1.8, description: 'Los frescos duran 80 % más.' },
      { id: 'pos', name: 'Sistema de caja (POS)', cost: 1200, lifeMonths: 48, capacityBonus: 0.2, qualityBonus: 2, maintenance: 20, shrinkageCut: 0.25, description: 'Caja más rápida y menos errores.' },
      { id: 'camaras', name: 'Cámaras de seguridad', cost: 900, lifeMonths: 60, capacityBonus: 0, qualityBonus: 0, maintenance: 10, shrinkageCut: 0.5, description: 'Reduce el robo a la mitad.' },
    ],
    starterEquipment: ['gondolas', 'heladeras', 'pos'],
    starterStaff: { cajero: 2, reponedor: 1 },
    weekday: [1.15, 0.95, 0.95, 0.95, 1.0, 1.1, 1.25],
    monthly: [0.95, 0.95, 1, 1, 1, 1, 1, 1, 1, 1, 1.05, 1.25],
    rateSensitivity: 0.3,
    competitors: [
      { name: 'SuperAhorro (cadena)', priceMult: 0.92, quality: 55, reputation: 60, awareness: 80 },
      { name: 'Tienda La Esquina', priceMult: 1.05, quality: 50, reputation: 55, awareness: 45 },
      { name: 'FrescoMarket', priceMult: 1.1, quality: 70, reputation: 65, awareness: 50 },
    ],
    recommendedCapital: 22000,
    benchmarks: { grossMargin: 0.27, wageShare: 0.15 },
  },
  {
    id: 'muebles', name: 'Fábrica de muebles', icon: '🪑', tagline: 'Producción, maquinaria y venta a crédito', model: 'manufacturing',
    economics: [
      'Se fabrica para stock según tu plan de producción y se vende a distribuidores.',
      'Los clientes pagan a 30 días (cuentas por cobrar) y varios proveedores dan 30 días (cuentas por pagar): el capital de trabajo es clave.',
      'Intensiva en maquinaria: depreciación, mantenimiento y riesgo de averías.',
      'Muy sensible a las tasas de interés: con crédito caro se venden menos muebles.',
    ],
    rent: 2800, depositMonths: 2, license: 800, utilities: 1400, variableCost: 3.5, variableCostLabel: 'Flete a clientes', salesFeeRate: 0, receivableDays: 30, shrinkage: 0.002,
    items: [
      { id: 'madera', name: 'Madera (tablón)', unit: 'tablón', storageCost: 0.3 },
      { id: 'herrajes', name: 'Kit de herrajes', unit: 'kit', storageCost: 0.05 },
      { id: 'barniz', name: 'Barniz', unit: 'litro', shelfLifeDays: 365, storageCost: 0.1 },
    ],
    suppliers: [
      { id: 'aserradero', name: 'Aserradero Los Pinos', itemId: 'madera', unitCost: 9, quality: 60, leadDays: 5, reliability: 0.9, minOrder: 50, paymentDays: 30, deliveryFee: 60 },
      { id: 'maderas_finas', name: 'Maderas Finas del Sur', itemId: 'madera', unitCost: 12.5, quality: 88, leadDays: 8, reliability: 0.93, minOrder: 50, paymentDays: 30, deliveryFee: 80, networkRequired: 15 },
      { id: 'ferreteria', name: 'Ferretería Industrial', itemId: 'herrajes', unitCost: 3.5, quality: 65, leadDays: 3, reliability: 0.96, minOrder: 50, paymentDays: 30, deliveryFee: 15 },
      { id: 'importados', name: 'Herrajes Importados', itemId: 'herrajes', unitCost: 2.6, quality: 50, leadDays: 20, reliability: 0.8, minOrder: 300, paymentDays: 0, deliveryFee: 90 },
      { id: 'pinturas', name: 'Pinturas Andinas', itemId: 'barniz', unitCost: 7, quality: 65, leadDays: 3, reliability: 0.95, minOrder: 10, paymentDays: 30, deliveryFee: 12 },
    ],
    products: [
      { id: 'silla', name: 'Silla', unit: 'unidad', refPrice: 62, recipe: [{ item: 'madera', qty: 2 }, { item: 'herrajes', qty: 1 }, { item: 'barniz', qty: 0.2 }], laborUnits: 1, marketDaily: 70, elasticity: 1.4 },
      { id: 'mesa', name: 'Mesa', unit: 'unidad', refPrice: 190, recipe: [{ item: 'madera', qty: 6 }, { item: 'herrajes', qty: 2 }, { item: 'barniz', qty: 0.6 }], laborUnits: 3, marketDaily: 18, elasticity: 1.4 },
      { id: 'estante', name: 'Estante', unit: 'unidad', refPrice: 115, recipe: [{ item: 'madera', qty: 4 }, { item: 'herrajes', qty: 1 }, { item: 'barniz', qty: 0.4 }], laborUnits: 2, marketDaily: 25, elasticity: 1.4 },
    ],
    roles: [
      { id: 'carpintero', name: 'Carpintero', dept: 'operaciones', baseWage: 1400, capacity: { kind: 'production', perDay: 5 }, description: 'Fabrica 5 unidades de trabajo por día (silla = 1, estante = 2, mesa = 3).' },
      { id: 'ayudante', name: 'Ayudante de taller', dept: 'operaciones', baseWage: 900, capacity: { kind: 'production', perDay: 2.5 }, description: '2,5 unidades de trabajo por día.' },
    ],
    equipment: [
      { id: 'sierra', name: 'Sierra de mesa', cost: 5000, lifeMonths: 84, capacityBonus: 0.2, qualityBonus: 3, maintenance: 50, description: '+20 % de capacidad.' },
      { id: 'compresor', name: 'Cabina de pintura', cost: 3500, lifeMonths: 72, capacityBonus: 0, qualityBonus: 6, maintenance: 30, description: 'Mejor terminación.' },
      { id: 'cnc', name: 'Router CNC', cost: 28000, lifeMonths: 96, capacityBonus: 0.6, qualityBonus: 10, maintenance: 220, description: '+60 % de capacidad y precisión. Inversión grande.' },
      { id: 'camioneta', name: 'Camioneta de reparto', cost: 18000, lifeMonths: 60, capacityBonus: 0, qualityBonus: 0, maintenance: 150, logisticsCut: 0.6, description: 'Fletes 60 % más baratos.' },
    ],
    starterEquipment: ['sierra', 'compresor'],
    starterStaff: { carpintero: 2, ayudante: 1 },
    weekday: [0, 1.15, 1.15, 1.15, 1.15, 1.15, 0.3],
    monthly: [0.85, 0.9, 1, 1, 1, 1, 0.95, 1, 1, 1.05, 1.15, 1.2],
    rateSensitivity: 3,
    competitors: [
      { name: 'Muebles del Valle', priceMult: 1.0, quality: 60, reputation: 62, awareness: 60 },
      { name: 'Industrias Roble', priceMult: 0.9, quality: 55, reputation: 65, awareness: 70 },
      { name: 'Diseño Nórdico', priceMult: 1.35, quality: 82, reputation: 70, awareness: 45 },
    ],
    recommendedCapital: 35000,
    benchmarks: { grossMargin: 0.6, wageShare: 0.25 },
  },
  {
    id: 'saas', name: 'Software por suscripción', icon: '💻', tagline: 'Ingresos recurrentes, sueldos altos, curva J', model: 'subscription',
    economics: [
      'Sin inventario: se venden suscripciones mensuales que se acumulan.',
      'Cada mes una parte de los clientes cancela (churn); la calidad y la atención lo reducen.',
      'Al principio se pierde dinero (sueldos de desarrollo) hasta tener suficientes suscriptores.',
      'Costo variable bajo: servidores por suscriptor y comisión de cobro.',
    ],
    rent: 1200, depositMonths: 1, license: 300, utilities: 300, variableCost: 0.9, variableCostLabel: 'Servidores (por suscriptor al mes)', salesFeeRate: 0.03, receivableDays: 0, shrinkage: 0, baseChurn: 0.06,
    items: [],
    suppliers: [],
    products: [
      { id: 'plan', name: 'Plan mensual', unit: 'suscripción', refPrice: 29, recipe: [], laborUnits: 0, marketDaily: 25, elasticity: 1.2 },
    ],
    roles: [
      { id: 'desarrollador', name: 'Desarrollador', dept: 'tecnologia', baseWage: 2600, capacity: { kind: 'users', perDay: 500 }, description: 'Cada desarrollador sostiene 500 suscriptores; por encima, la calidad cae y aumentan las cancelaciones.' },
    ],
    equipment: [
      { id: 'laptops', name: 'Equipos de desarrollo', cost: 4500, lifeMonths: 36, capacityBonus: 0.1, qualityBonus: 3, maintenance: 20, description: '+10 % de capacidad.' },
      { id: 'herramientas', name: 'Licencias y herramientas', cost: 2000, lifeMonths: 36, capacityBonus: 0, qualityBonus: 5, maintenance: 40, description: 'Mejor calidad del producto.' },
      { id: 'infra', name: 'Infraestructura redundante', cost: 9000, lifeMonths: 48, capacityBonus: 0.4, qualityBonus: 6, maintenance: 150, description: '+40 % de capacidad y menos caídas.' },
    ],
    starterEquipment: ['laptops', 'herramientas'],
    starterStaff: { desarrollador: 2 },
    weekday: [0.6, 1.1, 1.1, 1.1, 1.1, 1.0, 0.6],
    monthly: [1.05, 1, 1, 1, 1, 0.95, 0.9, 0.95, 1.05, 1.05, 1, 0.9],
    rateSensitivity: 0.8,
    competitors: [
      { name: 'GestioPro', priceMult: 1.0, quality: 66, reputation: 65, awareness: 65 },
      { name: 'Nubo', priceMult: 0.78, quality: 55, reputation: 55, awareness: 60 },
      { name: 'EnterpriseX', priceMult: 1.6, quality: 82, reputation: 75, awareness: 50 },
    ],
    recommendedCapital: 45000,
    benchmarks: { grossMargin: 0.85, wageShare: 0.5 },
  },
  {
    id: 'consultora', name: 'Consultora contable', icon: '📑', tagline: 'Poco capital, se vende tiempo experto', model: 'services',
    economics: [
      'Se venden horas de consultoría: la capacidad son las horas de tus consultores.',
      'Casi sin costos variables ni inventario: la ruta de menor capital inicial.',
      'Los clientes pagan a 30 días: al principio falta caja aunque haya ventas.',
      'La habilidad de los consultores define la calidad y la reputación.',
    ],
    rent: 900, depositMonths: 1, license: 250, utilities: 250, variableCost: 0, variableCostLabel: '—', salesFeeRate: 0, receivableDays: 30, shrinkage: 0,
    items: [],
    suppliers: [],
    products: [
      { id: 'hora', name: 'Hora de consultoría', unit: 'hora', refPrice: 35, recipe: [], laborUnits: 0, marketDaily: 200, elasticity: 1.0 },
    ],
    roles: [
      { id: 'consultor', name: 'Consultor', dept: 'operaciones', baseWage: 2100, capacity: { kind: 'hours', perDay: 6 }, description: '6 horas facturables por día hábil. Su habilidad define la calidad.' },
    ],
    equipment: [
      { id: 'oficina', name: 'Oficina equipada', cost: 2500, lifeMonths: 60, capacityBonus: 0.05, qualityBonus: 4, maintenance: 15, description: 'Imagen profesional.' },
      { id: 'software_contable', name: 'Software contable profesional', cost: 1800, lifeMonths: 36, capacityBonus: 0.15, qualityBonus: 5, maintenance: 30, description: '+15 % de horas productivas.' },
    ],
    starterEquipment: ['oficina'],
    starterStaff: { consultor: 1 },
    weekday: [0, 1.2, 1.2, 1.2, 1.2, 1.2, 0],
    monthly: [1.1, 1.15, 1.2, 1.25, 0.95, 0.9, 0.85, 0.9, 0.95, 1, 1, 0.85],
    rateSensitivity: 0.4,
    competitors: [
      { name: 'Estudio Pérez & Asoc.', priceMult: 1.0, quality: 65, reputation: 70, awareness: 60 },
      { name: 'ContaFácil', priceMult: 0.8, quality: 50, reputation: 50, awareness: 65 },
      { name: 'Big Audit Partners', priceMult: 1.7, quality: 85, reputation: 85, awareness: 70 },
    ],
    recommendedCapital: 12000,
    benchmarks: { grossMargin: 0.95, wageShare: 0.55 },
    requirements: { label: 'Matrícula profesional: Contabilidad nivel 10 o el certificado "Contable básico"', check: 'accounting10' },
  },
];

/**
 * Sociedad holding: no vende productos. Es dueña de otras empresas (subsidiarias),
 * centraliza caja, presta dentro del grupo y cobra honorarios de gestión.
 */
export const HOLDING_SECTOR: SectorDef = {
  id: 'holding', name: 'Sociedad holding', icon: '🏛️', tagline: 'Controla y administra un grupo de empresas', model: 'holding',
  economics: [
    'No tiene operaciones propias: sus ingresos son dividendos, intereses y honorarios de sus subsidiarias.',
    'Registra sus subsidiarias por el método de participación (sin contar dos veces sus activos).',
    'Los dividendos entre empresas del grupo no pagan impuesto (exención por participación); solo tributa lo que reparte a su dueño.',
  ],
  rent: 600, depositMonths: 1, license: 300, utilities: 120, variableCost: 0, variableCostLabel: '', salesFeeRate: 0, receivableDays: 0, shrinkage: 0,
  items: [], suppliers: [], products: [], roles: [], equipment: [], starterEquipment: [], starterStaff: {},
  weekday: [1, 1, 1, 1, 1, 1, 1], monthly: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], rateSensitivity: 0, competitors: [], recommendedCapital: 6000,
  benchmarks: { grossMargin: 0, wageShare: 0 },
};

export const SECTOR_BY_ID: Record<BizSectorId, SectorDef> = Object.fromEntries([...SECTORS, HOLDING_SECTOR].map((s) => [s.id, s])) as Record<BizSectorId, SectorDef>;

export function roleDef(sector: SectorDef, roleId: string): RoleDef {
  return sector.roles.find((r) => r.id === roleId) ?? COMMON_ROLES.find((r) => r.id === roleId)!;
}

export function allRoles(sector: SectorDef): RoleDef[] {
  return [...sector.roles, ...COMMON_ROLES];
}

/** Formas legales con diferencias mecánicas reales. */
export type LegalForm = 'individual' | 'sociedad' | 'srl' | 'corporacion';

export interface LegalFormDef {
  id: LegalForm;
  name: string;
  setupCost: number;
  monthlyAdmin: number;
  limitedLiability: boolean;
  /** true = los resultados tributan en la declaración personal del dueño. */
  passThrough: boolean;
  corporateTaxRate: number;
  dividendTaxRate: number;
  /** Porcentaje del capital que aporta un socio (y su participación). */
  partnerShare: number;
  canRaiseEquity: boolean;
  pros: string;
  cons: string;
}

export const LEGAL_FORMS: LegalFormDef[] = [
  { id: 'individual', name: 'Empresa individual', setupCost: 50, monthlyAdmin: 0, limitedLiability: false, passThrough: true, corporateTaxRate: 0, dividendTaxRate: 0, partnerShare: 0, canRaiseEquity: false,
    pros: 'Barata y simple. Sin impuesto empresarial: el resultado se suma a tu declaración personal (las pérdidas la reducen).', cons: 'Responsabilidad ilimitada: si quiebra, pagás sus deudas con tu patrimonio personal.' },
  { id: 'sociedad', name: 'Sociedad colectiva', setupCost: 250, monthlyAdmin: 20, limitedLiability: false, passThrough: true, corporateTaxRate: 0, dividendTaxRate: 0, partnerShare: 0.4, canRaiseEquity: false,
    pros: 'Un socio aporta el 40 % del capital inicial.', cons: 'Compartís el 40 % de los resultados y la responsabilidad sigue siendo ilimitada.' },
  { id: 'srl', name: 'Sociedad de responsabilidad limitada', setupCost: 400, monthlyAdmin: 35, limitedLiability: true, passThrough: false, corporateTaxRate: 0.25, dividendTaxRate: 0.1, partnerShare: 0, canRaiseEquity: false,
    pros: 'Tu riesgo se limita a lo aportado. Las pérdidas quedan en la empresa.', cons: 'Impuesto empresarial del 25 % y 10 % adicional sobre los dividendos que retires.' },
  { id: 'corporacion', name: 'Corporación (S.A.)', setupCost: 2000, monthlyAdmin: 150, limitedLiability: true, passThrough: false, corporateTaxRate: 0.25, dividendTaxRate: 0.1, partnerShare: 0, canRaiseEquity: true,
    pros: 'Responsabilidad limitada y puede vender acciones a inversionistas para conseguir capital.', cons: 'Costos de constitución y cumplimiento altos; doble imposición.' },
];

export const LEGAL_FORM_BY_ID: Record<LegalForm, LegalFormDef> = Object.fromEntries(LEGAL_FORMS.map((l) => [l.id, l])) as Record<LegalForm, LegalFormDef>;

export const EMPLOYER_PAYROLL_RATE = 0.12;
export const CORPORATE_LOSS_CARRY_YEARS = 5;
