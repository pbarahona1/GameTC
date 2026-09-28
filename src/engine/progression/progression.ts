import { usd } from '../money';
import type { GameState } from '../state';
import { addLog } from '../log';
import { computeMetrics, Metrics } from '../reports/metrics';

/**
 * Etapas de magnate. Ninguna exige una ruta concreta: cada criterio puede
 * cumplirse con empleo, inversiones o (en fases futuras) empresas y
 * propiedades. La etapa alcanzada nunca retrocede; los criterios actuales
 * se muestran para que el jugador vea si mantiene su posición.
 */
export interface Criterion {
  label: string;
  met: boolean;
  /** Criterio que depende de sistemas de una fase futura. */
  future?: string;
}

export interface StageDef {
  n: number;
  name: string;
  description: string;
  unlocks: string;
  criteria: (s: GameState, m: Metrics) => Criterion[];
}

const nw = (m: Metrics, v: number): Criterion => ({ label: `Patrimonio neto ≥ $${v.toLocaleString('en-US')}`, met: m.netWorth >= usd(v) });

export const STAGES: StageDef[] = [
  { n: 1, name: 'Supervivencia financiera', description: 'Recursos limitados. El objetivo es no quedarte sin efectivo.', unlocks: 'Banca básica, empleo y formación.', criteria: () => [] },
  {
    n: 2, name: 'Ingreso estable', description: 'Tus ingresos recurrentes cubren tus gastos esenciales.', unlocks: 'Préstamos de bancos tradicionales (con requisitos).',
    criteria: (_s, m) => [{ label: 'Ingreso neto recurrente ≥ gastos esenciales', met: m.expectedNetPay + m.passiveMonthly >= m.essentialMonthly && m.essentialMonthly > 0 }],
  },
  {
    n: 3, name: 'Primeros ahorros', description: 'Un colchón para imprevistos y cero atrasos.', unlocks: 'Depósitos a plazo más largos rinden más.',
    criteria: (s, m) => [
      { label: 'Fondo de emergencia ≥ 1 mes de gastos esenciales', met: m.emergencyMonths >= 1 },
      { label: 'Sin pagos vencidos', met: s.ledger.balances.arrears === 0 },
    ],
  },
  {
    n: 4, name: 'Primeras inversiones', description: 'Tu dinero empieza a trabajar para vos.', unlocks: 'Fase 3: bolsa de valores y Mogul Exchange.',
    criteria: (s, m) => [
      { label: 'Tener inversiones activas (depósitos, empresas u otros activos)', met: m.investments > 0 || s.ledger.balances.business_equity > 0 || s.progression.achievements['first_deposit_matured'] !== undefined },
      nw(m, 10_000),
    ],
  },
  {
    n: 5, name: 'Patrimonio sólido', description: 'Base financiera sana para emprender o invertir en grande.', unlocks: 'Mejores condiciones de crédito empresarial.',
    criteria: (s, m) => [nw(m, 50_000), { label: 'Fondo de emergencia ≥ 3 meses', met: m.emergencyMonths >= 3 }, { label: 'Puntaje crediticio ≥ 670', met: s.credit.score >= 670 }],
  },
  {
    n: 6, name: 'Empresario emergente', description: 'Ingresos más allá del salario.', unlocks: 'Fase 3: bienes raíces e hipotecas.',
    criteria: (_s, m) => [nw(m, 150_000), { label: 'Ingresos pasivos ≥ 20 % de tus gastos', met: m.passiveMonthly >= m.recurringMonthly * 0.2 }, { label: 'Deuda / activos < 50 %', met: m.debtToAssets < 0.5 }],
  },
  { n: 7, name: 'Magnate regional', description: 'Un patrimonio que ya mueve tu región.', unlocks: 'Grupos empresariales.', criteria: (s, m) => [nw(m, 1_000_000), { label: 'Al menos una empresa propia con ganancias en los últimos 3 meses', met: s.companies.some((c) => c.status === 'active' && c.history.length >= 3 && c.history.slice(-3).reduce((a, h) => a + h.netIncome, 0) > 0) }] },
  { n: 8, name: 'Empresario nacional', description: 'Tu nombre se conoce en todo el país.', unlocks: 'Emisión de bonos.', criteria: (s, m) => [nw(m, 10_000_000), { label: 'Reputación ≥ 60', met: s.player.attributes.reputation >= 60 }] },
  { n: 9, name: 'Grupo empresarial', description: 'Varias empresas bajo tu control.', unlocks: 'Sociedades matrices y filiales (Fase 4).', criteria: (s, m) => [nw(m, 50_000_000), { label: '3 empresas activas o más', met: s.companies.filter((c) => c.status === 'active').length >= 3 }] },
  { n: 10, name: 'Corporación internacional', description: 'Operaciones en varias jurisdicciones.', unlocks: 'Planificación fiscal internacional.', criteria: (_s, m) => [nw(m, 250_000_000), { label: 'Presencia en 2 jurisdicciones', met: false, future: 'Fase 4' }] },
  { n: 11, name: 'Conglomerado global', description: 'Diversificado en múltiples sectores.', unlocks: 'Adquisiciones hostiles.', criteria: (s, m) => [nw(m, 1_000_000_000), { label: 'Empresas en 5 sectores distintos', met: new Set(s.companies.filter((c) => c.status === 'active').map((c) => c.sector)).size >= 5 }] },
  { n: 12, name: 'Imperio económico', description: 'La cima.', unlocks: '—', criteria: (_s, m) => [nw(m, 10_000_000_000)] },
];

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  check?: (s: GameState, m: Metrics) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_job', name: 'Primer sueldo', description: 'Conseguí tu primer empleo.', icon: '💼', check: (s) => s.career.job !== null || s.career.history.length > 0 },
  { id: 'first_savings', name: 'Hormiguita', description: 'Tené dinero en la cuenta de ahorro.', icon: '🐜', check: (s) => s.ledger.balances.savings > 0 },
  { id: 'emergency_3', name: 'Paracaídas', description: 'Fondo de emergencia de 3 meses.', icon: '🪂', check: (_s, m) => m.emergencyMonths >= 3 },
  { id: 'emergency_6', name: 'Búnker', description: 'Fondo de emergencia de 6 meses.', icon: '🛡️', check: (_s, m) => m.emergencyMonths >= 6 },
  { id: 'first_deposit', name: 'Paciencia', description: 'Abrí tu primer depósito a plazo.', icon: '🔒', check: (s) => s.bank.deposits.length > 0 },
  { id: 'first_deposit_matured', name: 'Cosecha', description: 'Cobrá un depósito a su vencimiento.', icon: '🌾' },
  { id: 'card_streak_6', name: 'Cero intereses', description: 'Pagá el resumen completo de la tarjeta 6 veces seguidas.', icon: '💳', check: (s) => s.bank.card.fullPayStreak >= 6 },
  { id: 'debt_free', name: 'Libre de deudas', description: 'Terminá de pagar un préstamo.', icon: '🕊️', check: (s) => s.bank.loans.some((l) => l.status === 'paid') },
  { id: 'score_750', name: 'Buen pagador', description: 'Alcanzá un puntaje crediticio de 750.', icon: '⭐', check: (s) => s.credit.score >= 750 },
  { id: 'score_800', name: 'Crédito de oro', description: 'Alcanzá un puntaje crediticio de 800.', icon: '🏅', check: (s) => s.credit.score >= 800 },
  { id: 'promotion', name: 'Escalera', description: 'Conseguí un ascenso.', icon: '🚀', check: (s) => s.career.promotions > 0 },
  { id: 'first_course', name: 'Aprendiz', description: 'Completá tu primer curso o libro.', icon: '📚', check: (s) => s.education.completed.length > 0 },
  { id: 'degree', name: 'Graduado', description: 'Obtené un título universitario.', icon: '🎓', check: (s) => s.education.level === 'universitario' || s.education.level === 'posgrado' },
  { id: 'nw_10k', name: 'Cinco cifras', description: 'Patrimonio neto de $10,000.', icon: '💰', check: (_s, m) => m.netWorth >= usd(10_000) },
  { id: 'nw_100k', name: 'Seis cifras', description: 'Patrimonio neto de $100,000.', icon: '💎', check: (_s, m) => m.netWorth >= usd(100_000) },
  { id: 'nw_1m', name: 'Millonario', description: 'Patrimonio neto de $1,000,000.', icon: '👑', check: (_s, m) => m.netWorth >= usd(1_000_000) },
  { id: 'clean_year', name: 'Año impecable', description: 'Completá un año sin ningún atraso ni mora.', icon: '📆', check: (s) => s.day >= 365 && s.credit.latePayments.length === 0 && s.credit.arrearsEvents === 0 },
  { id: 'first_company', name: 'Emprendedor', description: 'Fundá o comprá tu primera empresa.', icon: '🏭', check: (s) => s.companies.length > 0 || s.formerCompanies.length > 0 },
  { id: 'first_profit', name: 'Números negros', description: 'Una empresa tuya cierra un mes con ganancia.', icon: '📗', check: (s) => s.companies.some((c) => c.history.some((h) => h.netIncome > 0 && h.day > (c.acquiredDay ?? c.foundedDay))) },
  { id: 'first_dividend', name: 'Dueño que cobra', description: 'Cobrá un dividendo o retiro de una empresa.', icon: '💰', check: (s) => s.companies.some((c) => c.receivedByOwner > 0) || s.formerCompanies.some((f) => f.result > 0) },
  { id: 'ten_employees', name: 'Generador de empleo', description: 'Tené 10 empleados entre todas tus empresas.', icon: '👥', check: (s) => s.companies.reduce((a, c) => a + c.employees.length, 0) >= 10 },
  { id: 'profitable_exit', name: 'Salida exitosa', description: 'Vendé una empresa ganando más de lo que invertiste.', icon: '🤝', check: (s) => s.formerCompanies.some((f) => f.outcome === 'vendida' && f.result > 0) },
  { id: 'skill_25', name: 'Especialista', description: 'Llevá una habilidad a nivel 25.', icon: '🧠', check: (s) => Object.entries(s.skills).some(([k, v]) => k !== 'luck' && v.level >= 25) },
];

export function evaluateStage(state: GameState, m = computeMetrics(state)): { current: number; details: Array<{ stage: StageDef; criteria: Criterion[]; met: boolean }> } {
  const details = STAGES.map((st) => {
    const criteria = st.criteria(state, m);
    return { stage: st, criteria, met: criteria.every((c) => c.met) };
  });
  let current = 1;
  for (const d of details) if (d.met) current = Math.max(current, d.stage.n);
  return { current, details };
}

/** Actualiza etapa y logros. Llamado tras cada acción y al cierre de cada mes. */
export function updateProgression(state: GameState): void {
  if (state.meta.projection) return;
  const m = computeMetrics(state);
  const { current } = evaluateStage(state, m);
  if (current > state.progression.stage) {
    state.progression.stage = current;
    const st = STAGES[current - 1];
    addLog(state, 'success', '🏆', `Nueva etapa: ${st.name}. Desbloquea: ${st.unlocks}`);
  }
  for (const a of ACHIEVEMENTS) {
    if (state.progression.achievements[a.id] !== undefined || !a.check) continue;
    if (a.check(state, m)) {
      state.progression.achievements[a.id] = state.day;
      addLog(state, 'success', a.icon, `Logro desbloqueado: ${a.name}.`);
    }
  }
}

export function professionalLevel(state: GameState): { level: number; progress: number } {
  const pts = state.career.careerPoints;
  const level = Math.min(50, 1 + Math.floor(Math.sqrt(pts / 40)));
  const cur = Math.pow(level - 1, 2) * 40;
  const next = Math.pow(level, 2) * 40;
  return { level, progress: (pts - cur) / (next - cur) };
}
