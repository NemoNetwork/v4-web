import { type FormEvent } from 'react';

import { Nullable } from '@dydxprotocol/v4-abacus';
import { useDispatch, useSelector } from 'react-redux';
import styled, { type AnyStyledComponent } from 'styled-components';

import {
  type SubaccountOrder,
  ErrorType,
  ValidationError,
  HumanReadablePlaceOrderPayload,
} from '@/constants/abacus';
import { ButtonAction, ButtonType } from '@/constants/buttons';
import { STRING_KEYS } from '@/constants/localization';

import { useStringGetter, useSubaccount, useTriggerOrdersFormInputs } from '@/hooks';

import { layoutMixins } from '@/styles/layoutMixins';

import { Button } from '@/components/Button';
import { Icon, IconName } from '@/components/Icon';
import { Output, OutputType } from '@/components/Output';
import { WithTooltip } from '@/components/WithTooltip';

import { getPositionDetails } from '@/state/accountSelectors';
import { closeDialog } from '@/state/dialogs';
import { useTriggersFormData } from '@/state/inputsSelectors';

import { getTradeInputAlert } from '@/lib/tradeData';

import { AdvancedTriggersOptions } from './AdvancedTriggersOptions';
import { TriggerOrdersInput } from './TriggerOrdersInput';

type ElementProps = {
  marketId: string;
  stopLossOrders: SubaccountOrder[];
  takeProfitOrders: SubaccountOrder[];
  onViewOrdersClick: () => void;
};

export const TriggersForm = ({
  marketId,
  stopLossOrders,
  takeProfitOrders,
  onViewOrdersClick,
}: ElementProps) => {
  const stringGetter = useStringGetter();
  const dispatch = useDispatch();

  console.log('Xcxc stoplossOrders', stopLossOrders);

  const { asset, entryPrice, stepSizeDecimals, tickSizeDecimals, oraclePrice, size } =
    useSelector(getPositionDetails(marketId)) || {};

  const { submitTriggerOrders } = useSubaccount();

  const { inputErrors, isEditingExistingOrder, differingOrderSizes, inputSize } =
    useTriggerOrdersFormInputs({
      marketId,
      positionSize: size?.current || undefined,
      stopLossOrder: stopLossOrders.length === 1 ? stopLossOrders[0] : undefined,
      takeProfitOrder: takeProfitOrders.length === 1 ? takeProfitOrders[0] : undefined,
    });

  console.log('xcxc', inputSize, size?.current);

  const symbol = asset?.id ?? '';
  const multipleTakeProfitOrders = takeProfitOrders.length > 1;
  const multipleStopLossOrders = stopLossOrders.length > 1;

  const hasInputErrors = inputErrors?.some(
    (error: ValidationError) => error.type !== ErrorType.warning
  );

  const inputAlert = getTradeInputAlert({
    abacusInputErrors: inputErrors ?? [],
    stringGetter,
    stepSizeDecimals,
    tickSizeDecimals,
  });

  console.log('Xcxc', inputAlert);

  const confirmOrdersText = isEditingExistingOrder
    ? stringGetter({ key: STRING_KEYS.ENTER_TRIGGERS })
    : stringGetter({ key: STRING_KEYS.ADD_TRIGGERS });

  const priceInfo = (
    <Styled.PriceBox>
      <Styled.PriceRow>
        <Styled.PriceLabel>{stringGetter({ key: STRING_KEYS.AVG_ENTRY_PRICE })}</Styled.PriceLabel>
        <Styled.Price type={OutputType.Fiat} value={entryPrice?.current} />
      </Styled.PriceRow>
      <Styled.PriceRow>
        <Styled.PriceLabel>{stringGetter({ key: STRING_KEYS.ORACLE_PRICE })}</Styled.PriceLabel>
        <Styled.Price type={OutputType.Fiat} value={oraclePrice} />
      </Styled.PriceRow>
    </Styled.PriceBox>
  );

  const submitButton = (
    <Styled.Button
      action={ButtonAction.Primary}
      type={ButtonType.Submit}
      state={{ isDisabled: hasInputErrors }}
      slotLeft={hasInputErrors ? <Styled.WarningIcon iconName={IconName.Warning} /> : undefined}
      // onClick={() => onSubmitOrders()}
    >
      {hasInputErrors
        ? stringGetter({
            key: inputAlert?.actionStringKey ?? STRING_KEYS.UNAVAILABLE,
          })
        : confirmOrdersText}
    </Styled.Button>
  );

  const onSubmitOrders = async () => {
    await submitTriggerOrders({
      onError: (errorParams?: { errorStringKey?: Nullable<string> }) => {
        console.log('xcxc error', errorParams?.errorStringKey);
      },
      onSuccess: (placeOrderPayload?: Nullable<HumanReadablePlaceOrderPayload[]>) => {
        dispatch(closeDialog());
      },
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    onSubmitOrders();
  };

  return (
    <Styled.Form onSubmit={onSubmit}>
      {priceInfo}
      <TriggerOrdersInput
        symbol={symbol}
        multipleTakeProfitOrders={multipleTakeProfitOrders}
        multipleStopLossOrders={multipleStopLossOrders}
        tickSizeDecimals={tickSizeDecimals}
        onViewOrdersClick={onViewOrdersClick}
      />
      {!(multipleTakeProfitOrders && multipleStopLossOrders) && (
        <>
          <AdvancedTriggersOptions
            symbol={symbol}
            positionSize={size?.current ? Math.abs(size?.current) : undefined}
            size={inputSize}
            differingOrderSizes={differingOrderSizes}
            multipleTakeProfitOrders={multipleTakeProfitOrders}
            multipleStopLossOrders={multipleStopLossOrders}
            stepSizeDecimals={stepSizeDecimals}
            tickSizeDecimals={tickSizeDecimals}
          />
          <WithTooltip tooltipString={hasInputErrors ? inputAlert?.alertString : undefined}>
            {submitButton}
          </WithTooltip>
        </>
      )}
    </Styled.Form>
  );
};

const Styled: Record<string, AnyStyledComponent> = {};

Styled.Form = styled.form`
  ${layoutMixins.column}
  gap: 1.25ch;
`;

Styled.PriceBox = styled.div`
  background-color: var(--color-layer-2);
  border-radius: 0.5em;
  font: var(--font-base-medium);

  display: grid;
  gap: 0.625em;
  padding: 0.625em 0.75em;
`;

Styled.PriceRow = styled.div`
  ${layoutMixins.spacedRow};
`;

Styled.PriceLabel = styled.h3`
  color: var(--color-text-0);
`;

Styled.Price = styled(Output)`
  color: var(--color-text-2);
`;

Styled.Button = styled(Button)`
  width: 100%;
`;

Styled.WarningIcon = styled(Icon)`
  color: var(--color-warning);
`;
