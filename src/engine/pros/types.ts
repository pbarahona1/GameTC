import type { Cents } from '../money';

export type ProKind = 'contador' | 'asesor' | 'abogado' | 'auditor' | 'gerente' | 'gestor';

export interface Professional {
  id: number;
  name: string;
  kind: ProKind;
  specialty: string;
  /** Años de experiencia. */
  experience: number;
  /** Honorario mensual (contador, asesor, gerente) o por encargo (abogado por caso, auditor por auditoría). */
  fee: Cents;
  /** Reputación pública 0–100 (visible). */
  reputation: number;
  /** Calidad real de servicio 0–100 (oculta; la reputación la estima con error). */
  quality: number;
  /** Gestor de inversiones: comisión anual de gestión y comisión de éxito (fracciones). */
  mgmtFee?: number;
  perfFee?: number;
}

export interface ProHire {
  id: number;
  pro: Professional;
  /** 'personal' o id de empresa. */
  scope: 'personal' | number;
  since: number;
  /** Caso judicial asignado (abogados). */
  caseId?: number;
  /** Capacitaciones pagadas por el jugador y día de la última. */
  trainings?: number;
  lastTraining?: number;
}

export interface AuditReport {
  id: number;
  companyId: number;
  day: number;
  auditorName: string;
  quality: number;
  findings: string[];
  clean: boolean;
  /** Vigencia del efecto sobre valoración y crédito. */
  validUntil: number;
}

export interface ProsState {
  market: Professional[];
  hires: ProHire[];
  audits: AuditReport[];
  lastRefresh: number;
}
