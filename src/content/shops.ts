/**
 * Centro comercial (ficticio). Precios base en USD (se ajustan por inflación).
 *
 * Cada artículo tiene efectos reales en la partida:
 *  - Ropa y accesorios: puntos de ESTILO → Imagen personal (postulaciones,
 *    negociaciones, trato en tiendas y reputación).
 *  - Vehículos: imagen, reemplazan el transporte público por costos propios,
 *    menos estrés; se deprecian y se pueden revender.
 *  - Tecnología: estudio más rápido o más red de contactos.
 *  - Hogar: salud, estrés y ahorro en comida.
 *  - Lujo: mucha imagen; algunos conservan su valor.
 */
export type ShopCategory = 'ropa' | 'vehiculos' | 'tecnologia' | 'hogar' | 'lujo';
export type Slot = 'torso' | 'piernas' | 'calzado' | 'abrigo' | 'reloj' | 'accesorio';
export type StoreTier = 1 | 2 | 3 | 4;

export const SLOTS: Slot[] = ['torso', 'piernas', 'calzado', 'abrigo', 'reloj', 'accesorio'];
export const SLOT_NAMES: Record<Slot, string> = { torso: 'Parte de arriba', piernas: 'Pantalón o falda', calzado: 'Calzado', abrigo: 'Abrigo', reloj: 'Reloj', accesorio: 'Accesorio' };

export const CATEGORY_INFO: Record<ShopCategory, { name: string; icon: string; what: string }> = {
  ropa: { name: 'Ropa', icon: '👕', what: 'Tu forma de vestir cambia cómo te tratan en entrevistas, negociaciones y tiendas.' },
  vehiculos: { name: 'Vehículos', icon: '🚗', what: 'Reemplazan el transporte público: más imagen y menos estrés, pero combustible, seguro y depreciación.' },
  tecnologia: { name: 'Tecnología', icon: '💻', what: 'Estudiar más rápido o ampliar tu red de contactos.' },
  hogar: { name: 'Hogar', icon: '🛋️', what: 'Mejoran tu salud y tu estrés cada mes, o te ahorran dinero en comida.' },
  lujo: { name: 'Lujo', icon: '💎', what: 'Mucha imagen. Relojes y joyas conservan buena parte de su valor.' },
};

export const TIER_NAMES: Record<StoreTier, string> = { 1: 'Popular', 2: 'Media', 3: 'Premium', 4: 'Lujo' };
/** Imagen mínima para que te atiendan bien en cada categoría de tienda. */
export const TIER_IMAGE_REQ: Record<StoreTier, number> = { 1: 0, 2: 10, 3: 25, 4: 45 };
/** Descuento de "cliente preferente" (imagen ≥ requisito + 20). */
export const TIER_VIP_DISCOUNT: Record<StoreTier, number> = { 1: 0.03, 2: 0.05, 3: 0.07, 4: 0.1 };

export interface StoreDef {
  id: string;
  name: string;
  category: ShopCategory;
  tier: StoreTier;
  icon: string;
  tagline: string;
  /** Cuotas sin interés que ofrece con tarjeta Oro o superior (0 = no ofrece). */
  freeInstallments: number;
}

export interface ItemEffects {
  /** Puntos de estrés por mes (negativo = baja el estrés). */
  stress?: number;
  /** Puntos de salud por mes. */
  health?: number;
  /** Red de contactos por mes (hasta 60). */
  network?: number;
  /** Estudio más rápido (fracción; no se acumulan: cuenta el mejor). */
  study?: number;
  /** Ahorro en alimentación (fracción; cuenta el mejor). */
  food?: number;
  /** Costo mensual propio del vehículo (combustible, seguro, mantenimiento), USD. */
  running?: number;
}

export interface ItemDef {
  id: string;
  storeId: string;
  name: string;
  category: ShopCategory;
  slot?: Slot;
  price: number;
  /** Puntos de estilo (ropa/accesorios puestos y vehículo). */
  style: number;
  /** Bien durable: se registra como activo, se deprecia y se puede vender. */
  durable: boolean;
  /** Depreciación anual (fracción del valor actual). */
  depreciation?: number;
  /** Fracción del valor actual que te pagan al venderlo. */
  resale?: number;
  effects?: ItemEffects;
  /** Colores para dibujar el personaje [principal, detalle]. */
  colors?: [string, string];
  /** Forma para el dibujo (p. ej. 'remera', 'camisa', 'blazer'). */
  shape?: string;
  /** Colección exclusiva: solo se muestra si te atienden bien en la tienda. */
  exclusive?: boolean;
  description: string;
}

export const STORES: StoreDef[] = [
  { id: 'feria', name: 'Feria Textil del Sur', category: 'ropa', tier: 1, icon: '🧺', tagline: 'Básicos baratos. Duran poco.', freeInstallments: 0 },
  { id: 'urbana', name: 'Urbana Moda', category: 'ropa', tier: 2, icon: '🧥', tagline: 'Ropa de oficina y de calle a buen precio.', freeInstallments: 3 },
  { id: 'sastreria', name: 'Sastrería Belgrano', category: 'ropa', tier: 3, icon: '👔', tagline: 'Trajes a medida y calzado de cuero.', freeInstallments: 6 },
  { id: 'maison', name: 'Maison Aurèle', category: 'ropa', tier: 4, icon: '✨', tagline: 'Alta costura. Te atienden con cita.', freeInstallments: 6 },
  { id: 'rodados', name: 'Rodados Martín', category: 'vehiculos', tier: 1, icon: '🚲', tagline: 'Bicicletas y motos usadas revisadas.', freeInstallments: 0 },
  { id: 'usados', name: 'Autos Usados del Oeste', category: 'vehiculos', tier: 2, icon: '🚙', tagline: 'Usados con garantía de 3 meses.', freeInstallments: 0 },
  { id: 'concesionaria', name: 'Concesionaria Andes Motors', category: 'vehiculos', tier: 3, icon: '🚗', tagline: 'Autos 0 km con financiación.', freeInstallments: 12 },
  { id: 'prestige', name: 'Prestige Motors', category: 'vehiculos', tier: 4, icon: '🏎️', tagline: 'Deportivos y sedanes de lujo.', freeInstallments: 12 },
  { id: 'electro', name: 'ElectroCity', category: 'tecnologia', tier: 2, icon: '📱', tagline: 'Celulares, notebooks y tablets.', freeInstallments: 6 },
  { id: 'techpro', name: 'TechPro Store', category: 'tecnologia', tier: 3, icon: '💻', tagline: 'Equipos profesionales de gama alta.', freeInstallments: 12 },
  { id: 'hogarmas', name: 'HogarMás', category: 'hogar', tier: 2, icon: '🛋️', tagline: 'Muebles, colchones y electrodomésticos.', freeInstallments: 6 },
  { id: 'joyeria', name: 'Joyería Valmont', category: 'lujo', tier: 4, icon: '💍', tagline: 'Relojes, joyas y marroquinería.', freeInstallments: 6 },
];

export const STORE_BY_ID: Record<string, StoreDef> = Object.fromEntries(STORES.map((s) => [s.id, s]));

const cloth = (id: string, storeId: string, slot: Slot, name: string, price: number, style: number, shape: string, colors: [string, string], description: string, exclusive = false): ItemDef =>
  ({ id, storeId, name, category: storeId === 'joyeria' ? 'lujo' : 'ropa', slot, price, style, durable: false, shape, colors, description, exclusive });

export const ITEMS: ItemDef[] = [
  // ---------------------------------------------------------------- Ropa: popular
  cloth('remera_basica', 'feria', 'torso', 'Remera básica', 12, 3, 'remera', ['#8a939c', '#6d767f'], 'Algodón liviano. Cómoda, pero no causa impresión.'),
  cloth('buzo_capucha', 'feria', 'torso', 'Buzo con capucha', 25, 3, 'buzo', ['#3f5a73', '#2f4457'], 'Abrigado e informal.'),
  cloth('jean_clasico', 'feria', 'piernas', 'Jean clásico', 30, 3, 'jean', ['#35507a', '#2a3f61'], 'Sirve para casi todo.'),
  cloth('zapatillas_lona', 'feria', 'calzado', 'Zapatillas de lona', 35, 3, 'zapatillas', ['#e9e6df', '#b8b3a8'], 'Livianas y baratas.'),
  cloth('campera_rompeviento', 'feria', 'abrigo', 'Campera rompeviento', 45, 3, 'campera', ['#2f6b58', '#23503f'], 'Protege del viento y la lluvia.'),
  // ---------------------------------------------------------------- Ropa: media
  cloth('camisa_oxford', 'urbana', 'torso', 'Camisa oxford', 45, 6, 'camisa', ['#dfe8f3', '#9fb3c9'], 'La prenda más útil para una entrevista.'),
  cloth('sweater_lana', 'urbana', 'torso', 'Sweater de lana', 60, 6, 'sweater', ['#7a4b3a', '#5c382b'], 'Prolijo y abrigado.'),
  cloth('chino', 'urbana', 'piernas', 'Pantalón chino', 55, 5, 'pantalon', ['#b59b73', '#8f7a59'], 'Entre formal e informal.'),
  cloth('falda_midi', 'urbana', 'piernas', 'Falda midi', 55, 5, 'falda', ['#2c2f4a', '#1f2135'], 'Elegante y cómoda.'),
  cloth('zapatos_cuero_eco', 'urbana', 'calzado', 'Zapatos de ecocuero', 85, 6, 'zapatos', ['#3b2a20', '#2a1d16'], 'Para la oficina.'),
  cloth('saco_casual', 'urbana', 'abrigo', 'Saco casual', 120, 7, 'blazer', ['#4a5160', '#363b46'], 'Suma formalidad sin ser un traje.'),
  // ---------------------------------------------------------------- Ropa: premium
  cloth('camisa_medida', 'sastreria', 'torso', 'Camisa a medida', 160, 10, 'camisa', ['#f4f6f9', '#c9d3df'], 'Hecha a tu medida. Se nota.'),
  cloth('pantalon_sastre', 'sastreria', 'piernas', 'Pantalón de sastre', 190, 8, 'pantalon', ['#2b2e36', '#1d1f25'], 'Corte perfecto.'),
  cloth('zapatos_cuero', 'sastreria', 'calzado', 'Zapatos de cuero italiano', 280, 9, 'zapatos', ['#5a3420', '#3e2415'], 'Duran años si los cuidás.'),
  cloth('traje_completo', 'sastreria', 'abrigo', 'Saco de traje', 480, 11, 'blazer', ['#1f2a3d', '#141c29'], 'El uniforme de los ejecutivos.'),
  // ---------------------------------------------------------------- Ropa: lujo
  cloth('camisa_seda', 'maison', 'torso', 'Camisa de seda', 620, 14, 'camisa', ['#efe2c9', '#cdb88f'], 'Seda natural.', true),
  cloth('pantalon_maison', 'maison', 'piernas', 'Pantalón de lana fría', 690, 10, 'pantalon', ['#26272b', '#161719'], 'Caída impecable.'),
  cloth('zapatos_maison', 'maison', 'calzado', 'Zapatos hechos a mano', 1150, 12, 'zapatos', ['#2a1a12', '#140c08'], 'Cosidos a mano, suela de cuero.', true),
  cloth('abrigo_cashmere', 'maison', 'abrigo', 'Abrigo de cashmere', 2600, 14, 'tapado', ['#8c7a66', '#6b5c4b'], 'La prenda que todos miran.', true),
  cloth('vestido_gala', 'maison', 'torso', 'Top de gala', 890, 14, 'gala', ['#6b1f3a', '#4a1428'], 'Para eventos importantes.', true),
  // ---------------------------------------------------------------- Lujo (durables que se usan)
  { id: 'reloj_clasico', storeId: 'joyeria', name: 'Reloj clásico de acero', category: 'lujo', slot: 'reloj', price: 3500, style: 8, durable: true, depreciation: 0.04, resale: 0.75, shape: 'reloj', colors: ['#c9ced6', '#8b929c'], description: 'Automático, sobrio. Pierde poco valor.' },
  { id: 'reloj_alta', storeId: 'joyeria', name: 'Reloj de alta relojería', category: 'lujo', slot: 'reloj', price: 18000, style: 14, durable: true, depreciation: 0.01, resale: 0.8, shape: 'reloj', colors: ['#d6b25e', '#9a7a33'], exclusive: true, description: 'Pieza de colección: casi no se desvaloriza.' },
  { id: 'cadena_oro', storeId: 'joyeria', name: 'Cadena de oro', category: 'lujo', slot: 'accesorio', price: 2200, style: 5, durable: true, depreciation: 0, resale: 0.8, shape: 'cadena', colors: ['#d9b44a', '#a8852b'], description: 'Oro de 18 quilates.' },
  { id: 'bolso_disenador', storeId: 'joyeria', name: 'Bolso de diseñador', category: 'lujo', slot: 'accesorio', price: 3200, style: 7, durable: true, depreciation: 0.08, resale: 0.6, shape: 'bolso', colors: ['#6e4a2e', '#4b311e'], description: 'Cuero curtido a mano.' },
  { id: 'anillo_brillante', storeId: 'joyeria', name: 'Anillo con brillante', category: 'lujo', slot: 'accesorio', price: 6500, style: 8, durable: true, depreciation: 0.02, resale: 0.7, shape: 'anillo', colors: ['#e8e8f0', '#b9bccb'], exclusive: true, description: 'Un quilate, certificado.' },
  // ---------------------------------------------------------------- Vehículos
  { id: 'bici_urbana', storeId: 'rodados', name: 'Bicicleta urbana', category: 'vehiculos', price: 350, style: 1, durable: true, depreciation: 0.15, resale: 0.6, effects: { running: 5, stress: -0.3, health: 0.3 }, description: 'Hacés ejercicio y ahorrás transporte.' },
  { id: 'moto_usada', storeId: 'rodados', name: 'Moto 150 cc usada', category: 'vehiculos', price: 2200, style: 3, durable: true, depreciation: 0.12, resale: 0.8, effects: { running: 60, stress: -0.4 }, description: 'Barata de mantener; más independencia.' },
  { id: 'auto_usado', storeId: 'usados', name: 'Auto compacto usado', category: 'vehiculos', price: 7500, style: 6, durable: true, depreciation: 0.1, resale: 0.85, effects: { running: 210, stress: -0.6 }, description: 'Ocho años de uso, mecánica revisada.' },
  { id: 'pickup_usada', storeId: 'usados', name: 'Camioneta usada', category: 'vehiculos', price: 14500, style: 8, durable: true, depreciation: 0.09, resale: 0.85, effects: { running: 290, stress: -0.6 }, description: 'Útil y resistente.' },
  { id: 'sedan_0km', storeId: 'concesionaria', name: 'Sedán 0 km', category: 'vehiculos', price: 24000, style: 10, durable: true, depreciation: 0.15, resale: 0.88, effects: { running: 300, stress: -0.8 }, description: 'Nuevo, con garantía. Pierde valor rápido los primeros años.' },
  { id: 'suv_0km', storeId: 'concesionaria', name: 'SUV 0 km', category: 'vehiculos', price: 42000, style: 13, durable: true, depreciation: 0.14, resale: 0.88, effects: { running: 380, stress: -0.8 }, description: 'Amplia y cómoda.' },
  { id: 'deportivo', storeId: 'prestige', name: 'Deportivo biplaza', category: 'vehiculos', price: 95000, style: 17, durable: true, depreciation: 0.12, resale: 0.9, effects: { running: 650, stress: -0.5 }, exclusive: true, description: 'Llama la atención en cualquier lado.' },
  { id: 'sedan_lujo', storeId: 'prestige', name: 'Sedán de lujo', category: 'vehiculos', price: 160000, style: 20, durable: true, depreciation: 0.13, resale: 0.9, effects: { running: 900, stress: -1 }, exclusive: true, description: 'El auto de los directorios.' },
  // ---------------------------------------------------------------- Tecnología
  { id: 'celular_medio', storeId: 'electro', name: 'Celular de gama media', category: 'tecnologia', price: 320, style: 0, durable: true, depreciation: 0.35, resale: 0.5, effects: { network: 0.1 }, description: 'Te mantiene en contacto: tu red crece un poco cada mes.' },
  { id: 'tablet', storeId: 'electro', name: 'Tablet', category: 'tecnologia', price: 480, style: 0, durable: true, depreciation: 0.3, resale: 0.5, effects: { study: 0.05 }, description: 'Leer y estudiar en cualquier lado: cursos 5 % más rápidos.' },
  { id: 'notebook', storeId: 'electro', name: 'Notebook', category: 'tecnologia', price: 900, style: 0, durable: true, depreciation: 0.3, resale: 0.5, effects: { study: 0.1 }, description: 'Cursos y carreras 10 % más rápidos.' },
  { id: 'celular_alta', storeId: 'techpro', name: 'Celular de alta gama', category: 'tecnologia', price: 1150, style: 0, durable: true, depreciation: 0.3, resale: 0.55, effects: { network: 0.25 }, description: 'Más contactos, más oportunidades: tu red crece cada mes.' },
  { id: 'notebook_pro', storeId: 'techpro', name: 'Notebook profesional', category: 'tecnologia', price: 2400, style: 0, durable: true, depreciation: 0.25, resale: 0.55, effects: { study: 0.18 }, description: 'Cursos y carreras 18 % más rápidos.' },
  // ---------------------------------------------------------------- Hogar
  { id: 'colchon', storeId: 'hogarmas', name: 'Colchón ortopédico', category: 'hogar', price: 700, style: 0, durable: true, depreciation: 0.12, resale: 0.25, effects: { health: 0.5, stress: -0.2 }, description: 'Dormís mejor: salud +0,5 por mes.' },
  { id: 'sillon', storeId: 'hogarmas', name: 'Sillón reclinable', category: 'hogar', price: 850, style: 0, durable: true, depreciation: 0.12, resale: 0.3, effects: { stress: -0.5 }, description: 'Descanso real al volver a casa: estrés −0,5 por mes.' },
  { id: 'cocina', storeId: 'hogarmas', name: 'Cocina equipada', category: 'hogar', price: 2400, style: 0, durable: true, depreciation: 0.1, resale: 0.35, effects: { food: 0.12 }, description: 'Cocinás en casa: gastás 12 % menos en comida.' },
  { id: 'gimnasio', storeId: 'hogarmas', name: 'Gimnasio en casa', category: 'hogar', price: 1800, style: 0, durable: true, depreciation: 0.12, resale: 0.35, effects: { health: 0.6, stress: -0.5 }, description: 'Entrenar sin salir: salud +0,6 y estrés −0,5 por mes.' },
  { id: 'escritorio', storeId: 'hogarmas', name: 'Escritorio y silla ergonómica', category: 'hogar', price: 1100, style: 0, durable: true, depreciation: 0.1, resale: 0.35, effects: { study: 0.06, stress: -0.2 }, description: 'Un lugar para concentrarte: estudio 6 % más rápido.' },
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/** Ropa con la que empieza cualquier personaje (usada). */
export const STARTER_OUTFIT: Array<{ id: string; condition: number }> = [
  { id: 'remera_basica', condition: 55 },
  { id: 'jean_clasico', condition: 50 },
  { id: 'zapatillas_lona', condition: 45 },
];

// ------------------------------------------------------------------ Apariencia del personaje

export const SKIN_TONES = ['#f5d7c3', '#e8b896', '#c98e66', '#9c6644', '#6b4430'];
export const HAIR_COLORS = ['#1f1a17', '#4a3121', '#8a5a33', '#c9a15c', '#9a9ea6'];
export const HAIR_STYLES = ['corto', 'largo', 'rulos', 'rapado', 'recogido'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const HAIR_STYLE_NAMES: Record<HairStyle, string> = { corto: 'Corto', largo: 'Largo', rulos: 'Rulos', rapado: 'Rapado', recogido: 'Recogido' };
