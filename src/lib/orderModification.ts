import Abacus, { Nullable } from '@dydxprotocol/v4-abacus';

import {
  HumanReadableCancelOrderPayload,
  ParsingError,
  SubaccountOrder,
  TriggerOrdersInputField,
} from '@/constants/abacus';

import abacusStateManager from './abacus';
import { isTruthy } from './isTruthy';
import { isLimitOrderType, isStopLossOrder, isTakeProfitOrder } from './orders';

export const syncSLTPOrderToAbacusState = (
  order: SubaccountOrder,
  isSlTpLimitOrdersEnabled: boolean,
  priceOverride?: number
) => {
  abacusStateManager.setTriggerOrdersValue({
    field: TriggerOrdersInputField.marketId,
    value: order.marketId,
  });

  if (isStopLossOrder(order, isSlTpLimitOrdersEnabled)) {
    [
      {
        field: TriggerOrdersInputField.stopLossOrderId,
        value: order.id,
      },
      {
        field: TriggerOrdersInputField.stopLossOrderSize,
        value: order.size,
      },
      {
        field: TriggerOrdersInputField.stopLossOrderType,
        value: order.type.rawValue,
      },
      {
        field: TriggerOrdersInputField.stopLossPrice,
        value: priceOverride ?? order.triggerPrice,
      },
      isLimitOrderType(order.type) && {
        field: TriggerOrdersInputField.stopLossLimitPrice,
        value: order.price,
      },
    ]
      .filter(isTruthy)
      .forEach(({ field, value }) => {
        abacusStateManager.setTriggerOrdersValue({ field, value });
      });
  }

  if (isTakeProfitOrder(order, isSlTpLimitOrdersEnabled)) {
    [
      {
        field: TriggerOrdersInputField.takeProfitOrderId,
        value: order.id,
      },
      {
        field: TriggerOrdersInputField.takeProfitOrderSize,
        value: order.size,
      },
      {
        field: TriggerOrdersInputField.takeProfitOrderType,
        value: order.type.rawValue,
      },
      {
        field: TriggerOrdersInputField.takeProfitPrice,
        value: priceOverride ?? order.triggerPrice,
      },
      isLimitOrderType(order.type) && {
        field: TriggerOrdersInputField.takeProfitLimitPrice,
        value: order.price,
      },
    ]
      .filter(isTruthy)
      .forEach(({ field, value }) => {
        abacusStateManager.setTriggerOrdersValue({ field, value });
      });
  }
};

// Inverse of calculateGoodTilBlockTime in v4-client
// https://github.com/dydxprotocol/v4-clients/blob/4227bd06a6f4503d863dcd99b3aba703cb94c40b/v4-client-js/src/clients/composite-client.ts#L253
const calculateGoodTilTimeInSeconds = (goodTilBlockTime: number) => {
  const futureMs = goodTilBlockTime * 1000;
  const nowMs = Date.now();
  return Math.round((futureMs - nowMs) / 1000);
};

/* Copies an existing order into a PlaceOrder object */
export const createPlaceOrderPayloadFromExistingOrder = (
  order: SubaccountOrder,
  newPrice: number
) => {
  const {
    subaccountNumber,
    marketId,
    type,
    side,
    size,
    clientId,
    timeInForce,
    goodTilBlock,
    goodTilBlockTime,
    postOnly,
    reduceOnly,
    triggerPrice,
  } = order;

  // subaccountNumber can be 0 -_-
  if (subaccountNumber === undefined || subaccountNumber === null || !clientId) {
    return undefined;
  }

  return new Abacus.exchange.dydx.abacus.state.manager.HumanReadablePlaceOrderPayload(
    subaccountNumber,
    marketId,
    clientId,
    type.rawValue,
    side.rawValue,
    newPrice,
    triggerPrice,
    size,
    null,
    reduceOnly,
    postOnly,
    timeInForce?.rawValue,
    null, // execution,
    goodTilBlockTime && calculateGoodTilTimeInSeconds(goodTilBlockTime),
    goodTilBlock,
    null // marketInfo,
  );
};

export const cancelOrderAsync = (
  orderId: string
): Promise<{
  success: boolean;
  parsingError: Nullable<ParsingError>;
  data: Nullable<HumanReadableCancelOrderPayload>;
}> => {
  return new Promise((resolve) => {
    abacusStateManager.cancelOrder(orderId, (success, parsingError, data) => {
      resolve({ success, parsingError, data });
    });
  });
};
