import type { GameState } from '../state';
import type { Cents } from '../money';
import { CARD_TIER_BY_ID, CardTierDef } from '../../content/cards';

/** Nivel vigente de la tarjeta (partidas viejas: Clásica). */
export function cardTier(state: GameState): CardTierDef {
  return CARD_TIER_BY_ID[state.bank.card.tier ?? 'clasica'];
}

/** Crédito usado: saldo de la tarjeta + cuotas que todavía no pasaron al resumen. */
export function cardUsed(state: GameState): Cents {
  return state.ledger.balances.credit_card + (state.ledger.balances.card_installments ?? 0);
}

/** Reintegro por un consumo con tarjeta (se acredita en el próximo resumen). */
export function accrueRewards(state: GameState, amount: Cents): void {
  const rate = cardTier(state).cashback;
  if (rate <= 0 || amount <= 0) return;
  state.bank.card.rewardsPending = (state.bank.card.rewardsPending ?? 0) + Math.round(amount * rate);
}
