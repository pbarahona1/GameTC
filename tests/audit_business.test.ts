import { makeGame, expectConsistent } from './helpers';
import { advanceDay } from '../src/engine/simulation';
import { isLastDayOfMonth } from '../src/engine/time/calendar';
import { incomeStatement, balanceSheet, cashFlowStatement } from '../src/engine/reports/statements';
import { post } from '../src/engine/ledger/ledger';
import { usd } from '../src/engine/money';
import { nextRandom } from '../src/engine/rng';
import { SECTORS, LEGAL_FORMS, allRoles } from '../src/content/sectors';
import { foundCompany, injectCapital, distribute, requestSaleOffer, acceptSale, liquidate, buyListing, raiseEquity } from '../src/engine/business/ownership';
import { placeOrder } from '../src/engine/business/inventory';
import { generateCandidates, hire, fire, train, setWage } from '../src/engine/business/staff';
import { startCampaign, buyResearch, stopCampaign, CHANNELS } from '../src/engine/business/marketing';
import { setPrice, setPlan, buyEquipment, sellEquipment, setMaintenance, toggleProduct } from '../src/engine/business/operations';
import { takeCoLoan, prepayCoLoan, payCoArrearsNow } from '../src/engine/business/finance';
import { analyze } from '../src/engine/advisor/advisor';
import { isOpen } from '../src/engine/business/common';
import type { GameState } from '../src/engine/state';

function bizAction(s: GameState, r: { rng: number }) {
  const rnd = () => nextRandom(r);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const open = s.companies.filter(isOpen);
  const k = Math.floor(rnd() * 24);
  if (!open.length || k === 0) {
    const sec = pick(SECTORS);
    return foundCompany(s, { sector: sec.id, legalForm: pick(LEGAL_FORMS).id, name: 'Bot ' + Math.floor(rnd() * 1e6), capital: usd(sec.recommendedCapital * (0.6 + rnd())) });
  }
  const co = pick(open);
  const sec = SECTORS.find((x) => x.id === co.sector)!;
  switch (k) {
    case 1: return setPrice(s, co, pick(co.products).id, Math.round(pick(co.products).price * (0.7 + rnd() * 0.8)));
    case 2: { const sup = sec.suppliers.length ? pick(sec.suppliers) : null; return sup ? placeOrder(s, co, sup.id, sup.minOrder * (1 + Math.floor(rnd() * 4))) : null; }
    case 3: { const c = generateCandidates(s, co, pick(allRoles(sec)).id)[0]; return hire(s, co, c.id); }
    case 4: return co.employees.length ? fire(s, co, pick(co.employees).id) : null;
    case 5: return co.employees.length ? train(s, co, pick(co.employees).id) : null;
    case 6: return co.employees.length ? setWage(s, co, pick(co.employees).id, Math.round(pick(co.employees).wage * (0.8 + rnd() * 0.5))) : null;
    case 7: return startCampaign(s, co, pick(CHANNELS).id, usd(10 + rnd() * 150), 7 + Math.floor(rnd() * 60));
    case 8: return buyResearch(s, co);
    case 9: return co.campaigns[0] ? stopCampaign(s, co, co.campaigns[0].id) : null;
    case 10: return setPlan(s, co, pick(co.products).id, Math.floor(rnd() * 12));
    case 11: return buyEquipment(s, co, pick(sec.equipment).id);
    case 12: return co.assets.length ? sellEquipment(s, co, pick(co.assets).id) : null;
    case 13: return setMaintenance(s, co, pick(['none', 'basic', 'preventive'] as const));
    case 14: return toggleProduct(s, co, pick(co.products).id, rnd() < 0.8);
    case 15: return takeCoLoan(s, co, pick(['austral_pyme', 'andino_emp']), usd(1000 + rnd() * 20000), pick([12, 24, 36]));
    case 16: return co.loans[0] ? prepayCoLoan(s, co, co.loans[0].id, usd(rnd() * 5000)) : null;
    case 17: return payCoArrearsNow(s, co);
    case 18: return injectCapital(s, co, usd(rnd() * 8000));
    case 19: return distribute(s, co, usd(rnd() * 5000));
    case 20: { const o = requestSaleOffer(s, co); return o.ok && rnd() < 0.3 ? acceptSale(s, co) : o; }
    case 21: return rnd() < 0.2 ? liquidate(s, co, 'voluntary') : null;
    case 22: return s.listings[0] ? buyListing(s, s.listings[0].id, Math.round(s.listings[0].askPrice * (0.7 + rnd() * 0.4))) : null;
    case 23: return raiseEquity(s, co, 0.05 + rnd() * 0.2);
  }
  return null;
}

describe('Auditoría de empresas (bots aleatorios)', () => {
  for (const seed of ['p', 'q', 'r', 's']) {
    it(`semilla ${seed}: 3 años con decisiones empresariales aleatorias sin estados imposibles`, () => {
      const s = makeGame('herencia', 'biz-audit-' + seed);
      s.skills.accounting.level = 12;
      post(s.ledger, { day: 0, memo: 'Capital de prueba', cf: 'internal', lines: [{ account: 'checking', debit: usd(150000) }, { account: 'opening_equity', credit: usd(150000) }] });
      const bot = { rng: seed.charCodeAt(0) * 104729 };
      let monthStart = s.day + 1;
      let nw0 = balanceSheet(s).netWorth;
      let actions = 0;
      while (s.day < 3 * 365) {
        advanceDay(s);
        if (nextRandom(bot) < 0.35) { bizAction(s, bot); actions++; }
        if (isLastDayOfMonth(s.day)) {
          expectConsistent(s);
          const is = incomeStatement(s, monthStart, s.day);
          const nw1 = balanceSheet(s).netWorth;
          expect(nw1 - nw0).toBe(is.netResult);
          const cf = cashFlowStatement(s, monthStart, s.day);
          expect(cf.opening + cf.totalOperating + cf.totalInvesting + cf.totalFinancing).toBe(cf.closing);
          for (const i of analyze(s)) expect(i.data.length).toBeGreaterThan(0);
          monthStart = s.day + 1;
          nw0 = nw1;
        }
      }
      expect(actions).toBeGreaterThan(200);
      expect(s.companies.length + s.formerCompanies.length).toBeGreaterThan(0);
    });
  }
});
