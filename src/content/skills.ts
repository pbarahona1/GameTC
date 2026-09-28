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
  | 'risk';

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
    effects: ['Requisito de certificaciones de análisis financiero.'],
    futureEffects: ['Fase 3: comisiones más bajas y análisis más detallado en Trading Pro.'],
    methods: ['Libros y cursos de inversión', 'Operar en bolsa (Fase 3)'],
  },
  {
    id: 'prediction', name: 'Predicción bursátil', icon: '🔭', trainable: true,
    description: 'Precisión de tus estimaciones sobre movimientos del mercado. Nunca llega al 100 %.',
    effects: [],
    futureEffects: ['Fase 3: estimaciones con margen de error que se reduce con el nivel, sin revelar el futuro.'],
    methods: ['Curso de trading', 'Analizar acciones (Fase 3)'],
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
    effects: ['Requisito de puestos de jefatura y gerencia.'],
    futureEffects: ['Fase 2: mejora la eficiencia de tus empresas.'],
    methods: ['Trabajar en puestos de coordinación', 'Libros de liderazgo, certificación de proyectos, MBA'],
  },
  {
    id: 'marketing', name: 'Marketing', icon: '📣', trainable: true,
    description: 'Diseñar campañas y comprender la demanda.',
    effects: ['Requisito de empleos de marketing.'],
    futureEffects: ['Fase 2: mejor conversión de las campañas de tus empresas.'],
    methods: ['Cursos de marketing', 'Trabajar en marketing'],
  },
  {
    id: 'realEstate', name: 'Bienes raíces', icon: '🏠', trainable: true,
    description: 'Analizar propiedades, alquileres, precios y rentabilidad inmobiliaria.',
    effects: [],
    futureEffects: ['Fase 3: estimaciones de valor y vacancia más precisas.'],
    methods: ['Curso de bienes raíces', 'Analizar propiedades (Fase 3)'],
  },
  {
    id: 'law', name: 'Derecho', icon: '⚖️', trainable: true,
    description: 'Comprender contratos, obligaciones legales y riesgos jurídicos.',
    effects: ['Requisito de puestos directivos de tecnología.'],
    futureEffects: ['Fase 4: detectar cláusulas de riesgo y reducir costos legales.'],
    methods: ['Curso de derecho empresarial'],
  },
  {
    id: 'cybersecurity', name: 'Ciberseguridad y tecnología', icon: '🛡️', trainable: true,
    description: 'Conocimientos técnicos de informática, software y seguridad.',
    effects: ['Requisito y habilidad clave de empleos de tecnología.'],
    futureEffects: ['Fase 2: base para empresas de software y ciberseguridad.'],
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
    effects: ['Cada nivel suma +0,3 % de XP en estudios (hasta +30 %).', 'Reduce el estrés que genera estudiar.'],
    methods: ['Terminar cursos', 'Libro de hábitos'],
  },
  {
    id: 'risk', name: 'Gestión del riesgo', icon: '🎯', trainable: true,
    description: 'Interpretar riesgos financieros y empresariales.',
    effects: ['Desde nivel 10 el asesor añade el escenario pesimista a sus proyecciones.'],
    futureEffects: ['Fase 3: medición del riesgo de cartera.'],
    methods: ['Curso de gestión de riesgos', 'Libro de inversión'],
  },
];

export const SKILL_BY_ID: Record<SkillId, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

/** XP necesaria para pasar del nivel `level` al siguiente. */
export function xpToNext(level: number): number {
  return Math.round(20 * Math.pow(level, 1.35));
}
