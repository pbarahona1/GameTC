import type { SkillId } from './skills';
import type { EducationLevel, Field } from './jobs';

export type CourseKind = 'libro' | 'curso' | 'tutor' | 'certificacion' | 'titulo';

export const COURSE_KIND_NAMES: Record<CourseKind, string> = {
  libro: 'Libro',
  curso: 'Curso en línea',
  tutor: 'Tutor privado',
  certificacion: 'Certificación',
  titulo: 'Título académico',
};

export interface CourseDef {
  id: string;
  name: string;
  kind: CourseKind;
  provider: string;
  /** Costo total (libros, cursos, tutores, certificaciones) en USD. */
  cost?: number;
  /** Matrícula mensual (títulos académicos) en USD. */
  monthlyTuition?: number;
  durationDays: number;
  hoursPerWeek: number;
  /** XP total que otorga al completar la duración (se reparte por día). */
  xp: Partial<Record<SkillId, number>>;
  requires?: { education?: EducationLevel; skills?: Partial<Record<SkillId, number>> };
  grants?: { education?: EducationLevel; field?: Field; certificate?: string; network?: number };
}

export const COURSES: CourseDef[] = [
  // LIBROS
  { id: 'book_finanzas', name: 'Finanzas personales esenciales', kind: 'libro', provider: 'Editorial Brújula', cost: 25, durationDays: 21, hoursPerWeek: 3, xp: { finEdu: 1200 } },
  { id: 'book_contabilidad', name: 'Contabilidad sin miedo', kind: 'libro', provider: 'Editorial Brújula', cost: 40, durationDays: 30, hoursPerWeek: 3, xp: { accounting: 1400 } },
  { id: 'book_negociacion', name: 'El arte de pedir más', kind: 'libro', provider: 'Ediciones Umbral', cost: 30, durationDays: 21, hoursPerWeek: 3, xp: { negotiation: 1200, social: 300 } },
  { id: 'book_marketing', name: 'Clientes que vuelven', kind: 'libro', provider: 'Ediciones Umbral', cost: 35, durationDays: 28, hoursPerWeek: 3, xp: { marketing: 1300 } },
  { id: 'book_inversion', name: 'Invertir con la cabeza fría', kind: 'libro', provider: 'Editorial Brújula', cost: 45, durationDays: 35, hoursPerWeek: 3, xp: { stocks: 1200, risk: 500, finEdu: 400 } },
  { id: 'book_liderazgo', name: 'Equipos que funcionan', kind: 'libro', provider: 'Ediciones Umbral', cost: 30, durationDays: 28, hoursPerWeek: 3, xp: { management: 1200 } },
  { id: 'book_habitos', name: 'Pequeños hábitos, grandes cuentas', kind: 'libro', provider: 'Editorial Brújula', cost: 20, durationDays: 21, hoursPerWeek: 2, xp: { discipline: 1500 } },
  // CURSOS EN LÍNEA
  { id: 'curso_hojas', name: 'Hojas de cálculo para finanzas', kind: 'curso', provider: 'Academia Cenit', cost: 120, durationDays: 45, hoursPerWeek: 5, xp: { accounting: 2500, finEdu: 1500 } },
  { id: 'curso_ventas', name: 'Ventas consultivas', kind: 'curso', provider: 'Academia Cenit', cost: 150, durationDays: 45, hoursPerWeek: 5, xp: { negotiation: 2600, social: 1200 } },
  { id: 'curso_mkt_digital', name: 'Marketing digital práctico', kind: 'curso', provider: 'Academia Cenit', cost: 180, durationDays: 60, hoursPerWeek: 6, xp: { marketing: 3500 } },
  { id: 'curso_programacion', name: 'Programación desde cero', kind: 'curso', provider: 'CódigoAbierto.lat', cost: 220, durationDays: 90, hoursPerWeek: 8, xp: { cybersecurity: 3500, discipline: 500 } },
  { id: 'curso_ciberseguridad', name: 'Fundamentos de ciberseguridad', kind: 'curso', provider: 'CódigoAbierto.lat', cost: 250, durationDays: 75, hoursPerWeek: 7, xp: { cybersecurity: 4000 } },
  { id: 'curso_riesgo', name: 'Gestión de riesgos financieros', kind: 'curso', provider: 'Academia Cenit', cost: 200, durationDays: 60, hoursPerWeek: 6, xp: { risk: 3000, finEdu: 1000 } },
  { id: 'curso_derecho', name: 'Derecho empresarial básico', kind: 'curso', provider: 'Universidad Abierta del Sur', cost: 260, durationDays: 75, hoursPerWeek: 6, xp: { law: 3500 } },
  { id: 'curso_inmobiliario', name: 'Análisis inmobiliario', kind: 'curso', provider: 'Universidad Abierta del Sur', cost: 190, durationDays: 60, hoursPerWeek: 5, xp: { realEstate: 3500 } },
  { id: 'curso_trading', name: 'Lectura de mercados', kind: 'curso', provider: 'Academia Cenit', cost: 300, durationDays: 60, hoursPerWeek: 6, xp: { stocks: 3000, prediction: 1500 } },
  // TUTORES
  { id: 'tutor_finanzas', name: 'Tutoría intensiva de finanzas', kind: 'tutor', provider: 'Lic. Marta Ibarra', cost: 600, durationDays: 30, hoursPerWeek: 6, xp: { finEdu: 4000, accounting: 1500 } },
  { id: 'tutor_negociacion', name: 'Entrenamiento en negociación', kind: 'tutor', provider: 'Julián Portal, coach', cost: 700, durationDays: 30, hoursPerWeek: 6, xp: { negotiation: 4500, social: 1500 } },
  // CERTIFICACIONES
  { id: 'cert_contable', name: 'Certificación contable básica', kind: 'certificacion', provider: 'Colegio de Contadores', cost: 450, durationDays: 90, hoursPerWeek: 6, xp: { accounting: 4000 }, requires: { skills: { accounting: 15 } }, grants: { certificate: 'Contable básico', network: 3 } },
  { id: 'cert_ventas', name: 'Certificación profesional en ventas', kind: 'certificacion', provider: 'Cámara de Comercio', cost: 350, durationDays: 60, hoursPerWeek: 5, xp: { negotiation: 3000 }, requires: { skills: { negotiation: 10 } }, grants: { certificate: 'Ventas profesionales', network: 3 } },
  { id: 'cert_proyectos', name: 'Gestión de proyectos', kind: 'certificacion', provider: 'Instituto de Proyectos', cost: 600, durationDays: 90, hoursPerWeek: 6, xp: { management: 5000 }, requires: { skills: { management: 15 } }, grants: { certificate: 'Gestión de proyectos', network: 4 } },
  { id: 'cert_analista', name: 'Analista financiero nivel I', kind: 'certificacion', provider: 'Instituto de Analistas', cost: 900, durationDays: 120, hoursPerWeek: 8, xp: { finEdu: 4000, stocks: 3000, accounting: 2000 }, requires: { skills: { finEdu: 25, accounting: 20 } }, grants: { certificate: 'Analista financiero I', network: 5 } },
  { id: 'cert_ciber', name: 'Profesional en ciberseguridad', kind: 'certificacion', provider: 'Consejo de Seguridad Digital', cost: 800, durationDays: 120, hoursPerWeek: 8, xp: { cybersecurity: 6000 }, requires: { skills: { cybersecurity: 20 } }, grants: { certificate: 'Ciberseguridad profesional', network: 4 } },
  // TÍTULOS
  { id: 'tec_informatica', name: 'Técnico en informática', kind: 'titulo', provider: 'Instituto Técnico Nacional', monthlyTuition: 180, durationDays: 730, hoursPerWeek: 15, xp: { cybersecurity: 15000, discipline: 2000 }, grants: { education: 'tecnico', field: 'informatica', network: 5 } },
  { id: 'tec_ingenieria', name: 'Técnico en electromecánica', kind: 'titulo', provider: 'Instituto Técnico Nacional', monthlyTuition: 180, durationDays: 730, hoursPerWeek: 15, xp: { risk: 5000, management: 4000, discipline: 3000 }, grants: { education: 'tecnico', field: 'ingenieria', network: 5 } },
  { id: 'tec_admin', name: 'Técnico en administración', kind: 'titulo', provider: 'Instituto Técnico Nacional', monthlyTuition: 160, durationDays: 730, hoursPerWeek: 15, xp: { accounting: 7000, management: 6000 }, grants: { education: 'tecnico', field: 'administracion', network: 5 } },
  { id: 'lic_admin', name: 'Licenciatura en Administración', kind: 'titulo', provider: 'Universidad del Pacífico', monthlyTuition: 350, durationDays: 1460, hoursPerWeek: 20, xp: { management: 20000, accounting: 12000, finEdu: 8000, social: 4000 }, grants: { education: 'universitario', field: 'administracion', network: 12 } },
  { id: 'lic_finanzas', name: 'Licenciatura en Finanzas', kind: 'titulo', provider: 'Universidad del Pacífico', monthlyTuition: 380, durationDays: 1460, hoursPerWeek: 20, xp: { finEdu: 22000, accounting: 18000, stocks: 6000, risk: 4000 }, grants: { education: 'universitario', field: 'finanzas', network: 12 } },
  { id: 'lic_ingenieria', name: 'Ingeniería Industrial', kind: 'titulo', provider: 'Universidad Politécnica', monthlyTuition: 400, durationDays: 1825, hoursPerWeek: 22, xp: { management: 14000, risk: 12000, discipline: 8000 }, grants: { education: 'universitario', field: 'ingenieria', network: 12 } },
  { id: 'lic_informatica', name: 'Ingeniería en Informática', kind: 'titulo', provider: 'Universidad Politécnica', monthlyTuition: 400, durationDays: 1825, hoursPerWeek: 22, xp: { cybersecurity: 30000, discipline: 6000 }, grants: { education: 'universitario', field: 'informatica', network: 12 } },
  { id: 'lic_marketing', name: 'Licenciatura en Marketing', kind: 'titulo', provider: 'Universidad del Pacífico', monthlyTuition: 340, durationDays: 1460, hoursPerWeek: 20, xp: { marketing: 24000, social: 8000 }, grants: { education: 'universitario', field: 'marketing', network: 12 } },
  { id: 'mba', name: 'MBA ejecutivo', kind: 'titulo', provider: 'Escuela de Negocios Andina', monthlyTuition: 900, durationDays: 730, hoursPerWeek: 15, xp: { management: 25000, finEdu: 12000, negotiation: 8000 }, requires: { education: 'universitario' }, grants: { education: 'posgrado', field: 'administracion', network: 20 } },
  { id: 'master_finanzas', name: 'Maestría en Finanzas', kind: 'titulo', provider: 'Escuela de Negocios Andina', monthlyTuition: 850, durationDays: 730, hoursPerWeek: 15, xp: { finEdu: 25000, stocks: 12000, risk: 10000 }, requires: { education: 'universitario' }, grants: { education: 'posgrado', field: 'finanzas', network: 18 } },
];

export const COURSE_BY_ID: Record<string, CourseDef> = Object.fromEntries(COURSES.map((c) => [c.id, c]));
