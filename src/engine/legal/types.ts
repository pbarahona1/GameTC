import type { Cents } from '../money';
import type { JurisdictionId } from '../../content/jurisdictions';

/**
 * Actividades ilegales FICTICIAS del juego. Mecánicas abstractas: no describen
 * métodos reales, solo decisiones con riesgos y consecuencias probabilísticas.
 */
export type IllegalKind = 'soborno' | 'evasion' | 'fraude' | 'clandestino' | 'lavado' | 'evasion_empresa';

export interface IllegalAct {
  id: number;
  kind: IllegalKind;
  day: number;
  label: string;
  /** Beneficio económico obtenido (o impuesto evitado). */
  benefit: Cents;
  /** Monto involucrado (para calcular multas). */
  amount: Cents;
  /** Solidez de la prueba que existe (0–100). */
  evidence: number;
  /** Gravedad 1–5. */
  severity: number;
  /** Personas que saben (empleados, cómplices): posibles denunciantes. */
  witnesses: number;
  jurisdiction: JurisdictionId;
  companyId?: number;
  /** Día en que prescribe (ya no se puede perseguir). */
  statuteDay: number;
  status: 'oculto' | 'investigado' | 'juzgado' | 'regularizado' | 'prescrito';
  /** Para evasión: año fiscal e impuesto evitado. */
  taxYear?: number;
}

export type CaseStage = 'investigacion' | 'imputacion' | 'juicio' | 'sentencia' | 'cerrado';

export interface LegalCase {
  id: number;
  acts: number[];
  kind: 'fiscal' | 'penal';
  title: string;
  origin: string;
  stage: CaseStage;
  openedDay: number;
  nextStepDay: number;
  /** Fuerza de la acusación (0–100): crece durante la investigación. */
  prosecution: number;
  /** Preparación de la defensa (0–100). */
  defense: number;
  /** Abogado asignado (id de contratación). */
  lawyerHireId: number | null;
  /** El jugador sabe cuán sólida es la prueba (tras revisar el expediente). */
  reviewed: boolean;
  plea: { fine: Cents; prisonMonths: number; expires: number } | null;
  outcome?: CaseOutcome;
  negotiations?: number;
  appealed?: boolean;
}

export interface CaseOutcome {
  day: number;
  verdict: 'archivado' | 'absuelto' | 'condenado' | 'acuerdo' | 'regularizado';
  fine: Cents;
  restitution: Cents;
  seized: Cents;
  prisonMonths: number;
  suspended: boolean;
  text: string;
}

export interface Fine {
  id: number;
  caseId: number | null;
  label: string;
  balance: Cents;
  original: Cents;
  dueDay: number;
  /** Cuota mensual si se acordó un plan de pagos. */
  installment: Cents | null;
  garnishing: boolean;
}

export interface LegalState {
  /** Nivel de sospecha de las autoridades (0–100). */
  heat: number;
  acts: IllegalAct[];
  cases: LegalCase[];
  fines: Fine[];
  prison: { from: number; until: number; caseId: number } | null;
  criminalRecord: number;
  /** Operaciones clandestinas en curso. */
  ventures: Array<{ id: number; invested: Cents; day: number; resolveDay: number; risk: number; expected: number; actId: number }>;
  log: Array<{ day: number; text: string }>;
  lastTaxAudit: number;
  /** Contratos públicos obtenidos con sobornos (ventas extra mensuales). */
  contracts: Array<{ id: number; companyId: number; monthly: Cents; monthsLeft: number; actId: number }>;
  /** Multas de inspección pendientes de resolver. */
  inspections: Array<{ id: number; companyId: number; fine: Cents; reason: string; dueDay: number; resolved: boolean }>;
}
