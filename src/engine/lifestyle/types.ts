import type { Cents } from '../money';
import type { Slot, HairStyle } from '../../content/shops';

/** Un artículo comprado. Los durables llevan valor contable (cuenta "Bienes personales"). */
export interface OwnedItem {
  uid: number;
  itemId: string;
  boughtDay: number;
  price: Cents;
  /** Valor contable actual (0 para ropa, que es consumo). */
  carrying: Cents;
  /** Estado 0–100 (la ropa se gasta; con menos de 40 luce gastada y rinde la mitad). */
  condition: number;
}

export interface Look {
  skin: number;
  hair: HairStyle;
  hairColor: number;
}

export interface PossessionsState {
  items: OwnedItem[];
  /** Prenda puesta en cada lugar (uid del artículo). */
  outfit: Partial<Record<Slot, number>>;
  look: Look;
  /** Gasto total en tiendas (para estadísticas y misiones). */
  spent: Cents;
}
