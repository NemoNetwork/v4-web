import { OrderSide } from '@nemo-network/v4-client-js/src/clients/constants';

import { AbacusOrderSide, type AbacusOrderSides, type Nullable } from '@/constants/abacus';

/** @deprecated use ORDER_SIDES from constants/abacus */
export const convertAbacusOrderSide = (abacusOrderSide: Nullable<AbacusOrderSides>) => {
  switch (abacusOrderSide) {
    case AbacusOrderSide.Buy:
      return OrderSide.BUY;
    case AbacusOrderSide.Sell:
      return OrderSide.SELL;
    default:
      return null;
  }
};
