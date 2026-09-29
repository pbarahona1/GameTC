import { ACCOUNTS, ACCOUNT_IDS } from './ledger/accounts';
import { recomputeLedger } from './ledger/ledger';
import type { GameState } from './state';
import { gAudit } from './ledger/core';
import { CO_CHART } from './business/companyLedger';

/**
 * Invariantes contables. Si alguna falla, el estado es imposible y la
 * partida no se guarda (se conserva la copia anterior). Se ejecutan en las
 * pruebas automatizadas y al cargar cada partida.
 */
export function checkInvariants(state: GameState): string[] {
  const errors: string[] = [];
  const L = state.ledger;
  for (const e of L.entries) {
    let dr = 0;
    let cr = 0;
    for (const l of e.lines) {
      if (!Number.isSafeInteger(l.debit) || !Number.isSafeInteger(l.credit)) errors.push(`Asiento ${e.id}: importe no entero.`);
      dr += l.debit;
      cr += l.credit;
    }
    if (dr !== cr) errors.push(`Asiento ${e.id} descuadrado (${dr} ≠ ${cr}).`);
    if (errors.length > 20) return errors;
  }
  const recomputed = recomputeLedger(L);
  for (const id of ACCOUNT_IDS) {
    if (recomputed[id] !== L.balances[id]) errors.push(`Saldo de ${ACCOUNTS[id].name} no coincide con el libro (${L.balances[id]} vs ${recomputed[id]}).`);
    if ((ACCOUNTS[id] as { noNegative?: boolean }).noNegative && L.balances[id] < 0) errors.push(`${ACCOUNTS[id].name} en negativo.`);
  }
  const loans = state.bank.loans.reduce((s, l) => s + (l.status === 'paid' ? 0 : l.balance), 0);
  if (loans !== L.balances.personal_loans) errors.push(`Subregistro de préstamos (${loans}) ≠ mayor (${L.balances.personal_loans}).`);
  if (state.bank.loans.some((l) => l.balance < 0)) errors.push('Préstamo con saldo negativo.');
  const deps = state.bank.deposits.reduce((s, d) => s + d.principal, 0);
  if (deps !== L.balances.term_deposits) errors.push(`Subregistro de depósitos (${deps}) ≠ mayor (${L.balances.term_deposits}).`);
  const taxes = state.tax.filings.filter((f) => f.status === 'due').reduce((s, f) => s + f.outstanding, 0);
  if (taxes !== L.balances.taxes_payable) errors.push(`Impuestos pendientes (${taxes}) ≠ mayor (${L.balances.taxes_payable}).`);
  const refunds = state.tax.filings.filter((f) => f.status === 'refund_pending').reduce((s, f) => s + f.outstanding, 0);
  if (refunds !== L.balances.tax_receivable) errors.push(`Devoluciones pendientes (${refunds}) ≠ mayor (${L.balances.tax_receivable}).`);
  // Ecuación contable: Activo = Pasivo + Patrimonio + (Ingresos − Gastos)
  let assets = 0;
  let rhs = 0;
  for (const id of ACCOUNT_IDS) {
    const t = ACCOUNTS[id].type;
    const b = L.balances[id];
    if (t === 'asset') assets += b;
    else if (t === 'liability' || t === 'equity' || t === 'income') rhs += b;
    else rhs -= b;
  }
  if (assets !== rhs) errors.push(`Ecuación contable rota: activo ${assets} ≠ pasivo+patrimonio ${rhs}.`);
  if (state.day < 0 || !Number.isInteger(state.day)) errors.push('Día de juego inválido.');
  errors.push(...checkCompanies(state));
  errors.push(...checkPhase34(state));
  return errors;
}

/** Conciliación de inversiones, inmuebles, hipotecas, multas y grupos (Fases 3–4). */
export function checkPhase34(state: GameState): string[] {
  const errors: string[] = [];
  const L = state.ledger.balances;
  const classes: Array<['stocks' | 'bonds' | 'funds' | 'mogul' | 'managed', Record<string, { qty: number; cost: number; carrying: number; lots: Array<{ qty: number; cost: number }> }>]> = [
    ['stocks', state.stocks.holdings], ['bonds', state.bonds.holdings], ['funds', state.funds.holdings], ['mogul', state.mogul.holdings], ['managed', state.managed?.holdings ?? {}],
  ];
  for (const m of state.managed?.mandates ?? []) {
    const h = state.managed.holdings[m.id];
    if (m.status === 'activo') {
      if (!h) errors.push(`Cuenta gestionada ${m.id}: sin tenencia registrada.`);
      else if (Math.abs(h.qty - m.units) > 1e-6 * Math.max(1, m.units)) errors.push(`Cuenta gestionada ${m.id}: unidades (${m.units}) ≠ tenencia (${h.qty}).`);
      if (m.cash < -1) errors.push(`Cuenta gestionada ${m.id}: caja negativa.`);
      if (m.positions.some((p) => p.units < 0)) errors.push(`Cuenta gestionada ${m.id}: posición negativa.`);
    } else if (h) errors.push(`Cuenta gestionada ${m.id} cerrada con tenencia.`);
  }
  for (const [acc, hs] of classes) {
    let carrying = 0;
    for (const [id, h] of Object.entries(hs)) {
      carrying += h.carrying;
      if (!(h.qty > 0)) errors.push(`${acc}/${id}: cantidad no positiva.`);
      const lq = h.lots.reduce((s, l) => s + l.qty, 0);
      if (Math.abs(lq - h.qty) > 1e-6 * Math.max(1, h.qty)) errors.push(`${acc}/${id}: lotes (${lq}) ≠ cantidad (${h.qty}).`);
      const lc = h.lots.reduce((s, l) => s + l.cost, 0);
      if (lc !== h.cost) errors.push(`${acc}/${id}: costo de lotes (${lc}) ≠ costo (${h.cost}).`);
      if (!Number.isSafeInteger(h.carrying) || !Number.isSafeInteger(h.cost)) errors.push(`${acc}/${id}: importes no enteros.`);
    }
    if (carrying !== L[acc]) errors.push(`Tenencias de ${acc} (${carrying}) ≠ mayor (${L[acc]}).`);
  }
  const personalProps = state.realEstate.properties.filter((p) => p.owner.kind === 'personal');
  const re = personalProps.reduce((s, p) => s + p.carrying, 0);
  if (re !== L.real_estate) errors.push(`Inmuebles personales (${re}) ≠ mayor (${L.real_estate}).`);
  const activeM = state.realEstate.mortgages.filter((m) => m.status === 'activa');
  const pm = activeM.filter((m) => m.owner.kind === 'personal').reduce((s, m) => s + m.balance, 0);
  if (pm !== L.mortgages) errors.push(`Hipotecas personales (${pm}) ≠ mayor (${L.mortgages}).`);
  for (const m of activeM) {
    if (m.balance < 0) errors.push(`Hipoteca ${m.id} con saldo negativo.`);
    if (!state.realEstate.properties.some((p) => p.id === m.propertyId)) errors.push(`Hipoteca ${m.id} sin inmueble.`);
  }
  const fines = state.legal.fines.reduce((s, f) => s + f.balance, 0);
  if (fines !== L.fines_payable) errors.push(`Multas pendientes (${fines}) ≠ mayor (${L.fines_payable}).`);
  for (const co of state.companies) {
    const b = co.ledger.balances;
    const props = state.realEstate.properties.filter((p) => p.owner.kind === 'company' && p.owner.id === co.id).reduce((s, p) => s + p.carrying, 0);
    if (props !== b.real_estate) errors.push(`${co.name}: inmuebles (${props}) ≠ mayor (${b.real_estate}).`);
    const cm = activeM.filter((m) => m.owner.kind === 'company' && m.owner.id === co.id).reduce((s, m) => s + m.balance, 0);
    if (cm !== b.mortgages) errors.push(`${co.name}: hipotecas (${cm}) ≠ mayor (${b.mortgages}).`);
    const subs = state.companies.filter((c) => c.parentId === co.id).reduce((s, c) => s + c.carrying, 0);
    if (subs !== b.subsidiaries) errors.push(`${co.name}: subsidiarias (${subs}) ≠ mayor (${b.subsidiaries}).`);
    const lent = state.icLoans.filter((l) => l.status === 'activo' && l.lenderId === co.id).reduce((s, l) => s + l.balance, 0);
    const owed = state.icLoans.filter((l) => l.status === 'activo' && l.borrowerId === co.id).reduce((s, l) => s + l.balance, 0);
    if (lent !== b.ic_receivable) errors.push(`${co.name}: préstamos intragrupo otorgados (${lent}) ≠ mayor (${b.ic_receivable}).`);
    if (owed !== b.ic_payable) errors.push(`${co.name}: préstamos intragrupo recibidos (${owed}) ≠ mayor (${b.ic_payable}).`);
    if (co.parentId && !state.companies.some((c) => c.id === co.parentId)) errors.push(`${co.name}: su matriz no existe.`);
  }
  return errors;
}

/** Auditoría de cada empresa: su libro y la conciliación de cada subregistro con el mayor. */
export function checkCompanies(state: GameState): string[] {
  const errors: string[] = [];
  let carrying = 0;
  for (const co of state.companies) {
    if (!co.parentId) carrying += co.carrying;
    const L = co.ledger;
    const tag = co.name;
    errors.push(...gAudit(CO_CHART, L, tag));
    const b = L.balances;
    const inv = co.inventory.reduce((s, l) => s + l.value, 0) + co.products.reduce((s, p) => s + p.finished.reduce((x, l) => x + l.value, 0), 0);
    if (inv !== b.inventory) errors.push(`${tag}: lotes de inventario (${inv}) ≠ cuenta Inventario (${b.inventory}).`);
    if (co.inventory.some((l) => l.value < 0 || l.qty < -1e-9)) errors.push(`${tag}: lote con valor o cantidad negativa.`);
    const transit = co.orders.filter((o) => o.prepaid).reduce((s, o) => s + o.total, 0);
    if (transit !== b.in_transit) errors.push(`${tag}: pedidos pagados en tránsito (${transit}) ≠ mayor (${b.in_transit}).`);
    const pay = co.payables.reduce((s, p) => s + p.amount, 0);
    if (pay !== b.payables) errors.push(`${tag}: cuentas por pagar (${pay}) ≠ mayor (${b.payables}).`);
    const rec = co.receivables.reduce((s, r) => s + r.amount, 0);
    if (rec !== b.receivables) errors.push(`${tag}: cuentas por cobrar (${rec}) ≠ mayor (${b.receivables}).`);
    const arr = co.arrears.reduce((s, a) => s + a.amount, 0);
    if (arr !== b.arrears) errors.push(`${tag}: deudas vencidas (${arr}) ≠ mayor (${b.arrears}).`);
    const fa = co.assets.reduce((s, a) => s + a.bookValue, 0);
    if (fa !== b.fixed_assets) errors.push(`${tag}: equipos (${fa}) ≠ activo fijo (${b.fixed_assets}).`);
    const loans = co.loans.reduce((s, l) => s + Math.max(0, l.balance), 0);
    if (loans !== b.loans) errors.push(`${tag}: préstamos (${loans}) ≠ mayor (${b.loans}).`);
    const tax = co.taxFilings.reduce((s, f) => s + f.outstanding, 0);
    if (tax !== b.taxes_payable) errors.push(`${tag}: impuestos pendientes (${tax}) ≠ mayor (${b.taxes_payable}).`);
    if (co.ownership <= 0 || co.ownership > 1) errors.push(`${tag}: participación inválida.`);
  }
  if (carrying !== state.ledger.balances.business_equity) errors.push(`Participaciones en empresas (${state.ledger.balances.business_equity}) ≠ suma de valores contables (${carrying}).`);
  return errors;
}
