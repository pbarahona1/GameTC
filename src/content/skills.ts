/**
 * Definición de habilidades. Cada habilidad sube SOLO con experiencia (XP)
 * obtenida por estudio o práctica relacionada. El nivel general del jugador no
 * las modifica. `phase` indica en qué fase del proyecto se activa su efecto
 * principal cuando todavía no está disponible (se muestra con honestidad).
 */
export type SkillId =
  | 'finEdu'
  | 'stocks'
  | 'prediction'
  | 'negotiation'
  | 'accounting'
  | 'management'
  | 'marketing'
  | 'realEstate'
  | 'law'
  | 'cybersecurity'
  | 'luck'
  | 'social'
  | 'discipline'
  | 'risk'
  | 'forecasting';

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  description: string;
  /** Efectos implementados hoy, descritos con cifras reales del motor. */
  effects: string[];
  /** Efectos previstos para fases futuras. */
  futureEffects?: string[];
  methods: string[];
  /** La suerte no se entrena: es un rasgo fijo del personaje. */
  trainable: boolean;
}

export const SKILL_MAX_LEVEL = 100;

export const SKILLS: SkillDef[] = [
  {
    id: 'finEdu', name: 'Educación financiera', icon: '📘', trainable: true,
    description: 'Comprender ingresos, gastos, deudas, intereses y rentabilidad.',
    effects: [
      'Requisito de empleos del sector financiero.',
      'Mejora el desempeño en puestos donde es habilidad clave.',
      'Desde nivel 15 el asesor muestra rangos de proyección más ajustados.',
    ],
    methods: ['Libros y cursos de finanzas', 'Abrir depósitos a plazo', 'Pagar la tarjeta completa', 'Revisar informes'],
  },
  {
    id: 'stocks', name: 'Bolsa de valores', icon: '📈', trainable: true,
    description: 'Interpretar información bursátil: precios, valoraciones, dividendos.',
    effects: ['Requisito de certificaciones de análisis financiero.', 'Mejor ejecución de órdenes: reduce hasta 40 % el costo de diferencial e impacto de mercado (−0.4 % por nivel).'],
    methods: ['Libros y cursos de inversión', 'Comprar, vender y dar órdenes en la bolsa'],
  },
  {
    id: 'prediction', name: 'Predicción bursátil', icon: '🔭', trainable: true,
    description: 'Precisión de tus estimaciones sobre movimientos del mercado. Nunca llega al 100 %.',
    effects: ['Margen de error de tu estimación del valor de una acción: ±35 % × (1 − nivel/120), mínimo ±6 %. Nunca adivina el futuro: el precio también depende de noticias y del ánimo del mercado.'],
    methods: ['Curso de trading', 'Analizar acciones en Bolsa Lite o Trading Pro'],
  },
  {
    id: 'negotiation', name: 'Negociación', icon: '🤝', trainable: true,
    description: 'Negociar salarios, tasas de interés, precios y contratos.',
    effects: [
      'Aumenta la probabilidad de éxito al negociar el salario de una oferta.',
      'Permite negociar una rebaja de tasa en ofertas de préstamo.',
      'Clave en empleos de ventas y consultoría.',
    ],
    methods: ['Negociar ofertas y préstamos', 'Libros, cursos y tutor de negociación', 'Trabajar en ventas'],
  },
  {
    id: 'accounting', name: 'Contabilidad', icon: '🧮', trainable: true,
    description: 'Interpretar balances, estados financieros, costos y obligaciones fiscales.',
    effects: ['Requisito y habilidad clave en finanzas y administración.', 'Revisar informes otorga XP (con tope diario).'],
    methods: ['Revisar el estado de resultados y el balance', 'Libros, cursos y certificación contable'],
  },
  {
    id: 'management', name: 'Administración empresarial', icon: '🏢', trainable: true,
    description: 'Gestionar personas, inventarios, productividad y operaciones.',
    effects: ['Requisito de puestos de jefatura y gerencia.', 'Suma a la Proyección de negocios (15 % de tu nivel).'],
    methods: ['Trabajar en puestos de coordinación', 'Libros de liderazgo, certificación de proyectos, MBA'],
  },
  {
    id: 'marketing', name: 'Marketing', icon: '📣', trainable: true,
    description: 'Diseñar campañas y comprender la demanda.',
    effects: ['Requisito de empleos de marketing.', 'Tus campañas ganan +0.4 % de conocimiento de marca por nivel (hasta +40 %).'],
    methods: ['Cursos de marketing', 'Trabajar en marketing'],
  },
  {
    id: 'realEstate', name: 'Bienes raíces', icon: '🏠', trainable: true,
    description: 'Analizar propiedades, alquileres, precios y rentabilidad inmobiliaria.',
    effects: ['Aumenta la probabilidad de que acepten tus contraofertas por inmuebles (+0.2 % por nivel).'],
    methods: ['Curso de bienes raíces', 'Inspeccionar, comprar, renovar y vender inmuebles'],
  },
  {
    id: 'law', name: 'Derecho', icon: '⚖️', trainable: true,
    description: 'Comprender contratos, obligaciones legales y riesgos jurídicos.',
    effects: ['Requisito de puestos directivos de tecnología.', 'Suma a tu defensa en un juicio (+0.1 punto por nivel).'],
    methods: ['Curso de derecho empresarial'],
  },
  {
    id: 'cybersecurity', name: 'Ciberseguridad y tecnología', icon: '🛡️', trainable: true,
    description: 'Conocimientos técnicos de informática, software y seguridad.',
    effects: ['Requisito y habilidad clave de empleos de tecnología.'],
    methods: ['Cursos de programación y ciberseguridad', 'Carrera técnica o licenciatura en informática'],
  },
  {
    id: 'luck', name: 'Suerte', icon: '🍀', trainable: false,
    description: 'Rasgo fijo del personaje que inclina ligeramente algunos acontecimientos. Nunca garantiza resultados.',
    effects: ['Modifica entre −3 y +3 puntos porcentuales la probabilidad de algunas respuestas (postulaciones, imprevistos).'],
    methods: ['No se entrena: se asigna al crear el personaje.'],
  },
  {
    id: 'social', name: 'Inteligencia social', icon: '💬', trainable: true,
    description: 'Interacciones, entrevistas y relaciones profesionales.',
    effects: ['Aumenta la probabilidad de que una postulación termine en oferta.', 'Ayuda en negociaciones.'],
    methods: ['Postularse a empleos', 'Trabajar de cara al público', 'Libros y cursos de ventas'],
  },
  {
    id: 'discipline', name: 'Disciplina', icon: '⏱️', trainable: true,
    description: 'Constancia en estudio y práctica.',
    effects: ['Cada nivel suma +0.3 % de XP en estudios (hasta +30 %).', 'Reduce el estrés que genera estudiar.'],
    methods: ['Terminar cursos', 'Libro de hábitos'],
  },
  {
    id: 'risk', name: 'Gestión del riesgo', icon: '🎯', trainable: true,
    description: 'Interpretar riesgos financieros y empresariales.',
    effects: ['Desde nivel 10 el asesor añade el escenario pesimista a sus proyecciones.'],
    methods: ['Curso de gestión de riesgos', 'Libro de inversión'],
  },
  {
    id: 'forecasting', name: 'Proyección de negocios', icon: '🔮', trainable: true,
    description: 'Estimar cómo le irá a un negocio antes de crearlo o comprarlo: ventas, ganancias, caja y probabilidad de sobrevivir. Nunca llega al 100 %: el futuro tiene azar.',
    effects: [
      'Cada proyección simula muchos futuros posibles de tu negocio con las reglas reales del juego.',
      'Con más nivel se simulan más futuros (5 + nivel/10, hasta 15) y tu lectura de los resultados tiene menos sesgo: ±45 % × (1 − nivel/110), mínimo ±5 %.',
      'Administración empresarial (15 %) y Contabilidad (10 %) también suman a tu nivel efectivo.',
    ],
    methods: ['Proyectar negocios antes de fundarlos o comprarlos', 'Dirigir empresas (cada mes enseña algo)', 'Comparar tus proyecciones con lo que pasó', 'Libro, curso y certificación de planes de negocio'],
  },
];

export const SKILL_BY_ID: Record<SkillId, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

/** XP necesaria para pasar del nivel `level` al siguiente. */
export function xpToNext(level: number): number {
  return Math.round(20 * Math.pow(level, 1.35));
}
