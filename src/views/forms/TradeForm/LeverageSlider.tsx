import { useMemo } from 'react';

import { OrderSide } from '@nemo-network/v4-client-js/src/clients/constants';
import { debounce } from 'lodash';
import styled, { css } from 'styled-components';

import { TradeInputField } from '@/constants/abacus';
import { QUICK_DEBOUNCE_MS } from '@/constants/debounce';
import { PositionSide } from '@/constants/trade';

import { Slider } from '@/components/Slider';

import abacusStateManager from '@/lib/abacus';
import { MustBigNumber, type BigNumberish } from '@/lib/numbers';

type ElementProps = {
  leverage?: BigNumberish | null;
  leverageInputValue: string;
  maxLeverage: BigNumberish | null;
  orderSide: OrderSide;
  positionSide: PositionSide;
  setLeverageInputValue: (value: string) => void;
};

type StyleProps = { className?: string };

export const LeverageSlider = ({
  leverage,
  leverageInputValue,
  maxLeverage,
  orderSide,
  positionSide,
  setLeverageInputValue,
  className,
}: ElementProps & StyleProps) => {
  const leverageBN = MustBigNumber(leverage);
  const maxLeverageBN = MustBigNumber(maxLeverage);
  const leverageInputBN = MustBigNumber(leverageInputValue || leverage);
  const leverageInputNumber = Number.isNaN(leverageInputBN.toNumber())
    ? 0
    : leverageInputBN.toNumber();

  const sliderConfig = useMemo(
    () => ({
      [PositionSide.None]: {
        min: orderSide === OrderSide.BUY ? 0 : maxLeverageBN.negated().toNumber(),
        max: orderSide === OrderSide.BUY ? maxLeverageBN.toNumber() : 0,
        midpoint: undefined,
      },
      [PositionSide.Long]: {
        min:
          orderSide === OrderSide.BUY ? leverageBN.toNumber() : maxLeverageBN.negated().toNumber(),
        max: orderSide === OrderSide.BUY ? maxLeverageBN.toNumber() : leverageBN.toNumber(),
        midpoint:
          orderSide === OrderSide.SELL
            ? MustBigNumber(100)
                .minus(leverageBN.div(leverageBN.plus(maxLeverageBN)).times(100))
                .toNumber()
            : undefined,
      },
      [PositionSide.Short]: {
        min:
          orderSide === OrderSide.BUY ? leverageBN.toNumber() : maxLeverageBN.negated().toNumber(),
        max: orderSide === OrderSide.BUY ? maxLeverageBN.toNumber() : leverageBN.toNumber(),
        midpoint:
          orderSide === OrderSide.BUY
            ? leverageBN.abs().div(leverageBN.abs().plus(maxLeverageBN)).times(100).toNumber()
            : undefined,
      },
    }),
    [maxLeverageBN, leverageBN, orderSide, positionSide]
  );

  const { min, max, midpoint } = sliderConfig[positionSide] || {};

  // Debounced slightly to avoid excessive updates to Abacus while still providing a smooth slide
  const debouncedSetAbacusLeverage = useMemo(
    () =>
      debounce(
        (newLeverage: number) =>
          abacusStateManager.setTradeValue({
            value: newLeverage,
            field: TradeInputField.leverage,
          }),
        QUICK_DEBOUNCE_MS
      ),
    []
  );

  const onSliderDrag = ([newLeverage]: number[]) => {
    setLeverageInputValue(`${newLeverage}`);
    debouncedSetAbacusLeverage(newLeverage!);
  };

  const onValueCommit = ([newLeverage]: number[]) => {
    setLeverageInputValue(`${newLeverage}`);

    // Ensure Abacus is updated with the latest, committed value
    debouncedSetAbacusLeverage.cancel();

    abacusStateManager.setTradeValue({
      value: newLeverage,
      field: TradeInputField.leverage,
    });
  };

  return (
    <div className={className} tw="h-[1.375rem]">
      <$Slider
        label="MarketLeverage"
        min={min}
        max={max}
        step={0.1}
        value={Math.min(Math.max(leverageInputNumber, min), max)}
        onSliderDrag={onSliderDrag}
        onValueCommit={onValueCommit}
        midpoint={midpoint}
        orderSide={orderSide}
      />
    </div>
  );
};
const $Slider = styled(Slider)<{ midpoint?: number; orderSide: OrderSide }>`
  --slider-track-backgroundColor: var(--color-layer-4);

  ${({ midpoint, orderSide }) => css`
    --slider-track-background: linear-gradient(
      90deg,
      var(--color-negative) 0%,
      var(--color-layer-7)
        ${midpoint ?? (orderSide === OrderSide.BUY ? 0 : orderSide === OrderSide.SELL ? 100 : 50)}%,
      var(--color-positive) 100%
    );
  `}
`;
