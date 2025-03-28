import { useCallback, useState } from 'react';

import { useDispatch } from 'react-redux';
import styled from 'styled-components';

import { ButtonAction } from '@/constants/buttons';
import type { DialogProps, PredictionMarketIntroDialogProps } from '@/constants/dialogs';
import { STRING_KEYS } from '@/constants/localization';

import { useStringGetter } from '@/hooks/useStringGetter';
import { useURLConfigs } from '@/hooks/useURLConfigs';

import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { Dialog } from '@/components/Dialog';
import { Icon, IconName } from '@/components/Icon';
import { Link } from '@/components/Link';
import { NewTag } from '@/components/Tag';

import { setHasSeenPredictionMarketIntroDialog } from '@/state/dismissable';

export const PredictionMarketIntroDialog = ({
  setIsOpen,
}: DialogProps<PredictionMarketIntroDialogProps>) => {
  const stringGetter = useStringGetter();
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  const dispatch = useDispatch();
  const { predictionMarketLearnMore } = useURLConfigs();

  const onDismissPredictionMarketsIntro = useCallback(() => {
    dispatch(setHasSeenPredictionMarketIntroDialog(true));
  }, [dispatch]);

  const onContinue = useCallback(() => {
    if (doNotShowAgain) {
      onDismissPredictionMarketsIntro();
    }

    setIsOpen(false);
  }, [doNotShowAgain, setIsOpen, onDismissPredictionMarketsIntro]);

  const renderPoint = ({
    icon,
    title,
    description,
  }: {
    icon: IconName;
    title: string;
    description: string;
  }) => (
    <div key={title} tw="row gap-0.75 align-middle">
      <$IconContainer>
        <Icon iconName={icon} size="1.75rem" tw="text-color-text-0" />
      </$IconContainer>
      <div tw="column text-medium">
        <span tw="text-color-text-1">{title}</span>
        <span tw="text-small text-color-text-0">{description}</span>
      </div>
    </div>
  );

  return (
    <Dialog
      isOpen
      setIsOpen={setIsOpen}
      title={
        <div tw="row gap-0.5 align-middle">
          {stringGetter({ key: STRING_KEYS.PREDICTION_MARKET })}{' '}
          <NewTag>{stringGetter({ key: STRING_KEYS.NEW })}</NewTag>
        </div>
      }
      tw="notMobile:[--dialog-width:25rem]"
    >
      <div tw="column mb-1.25 gap-1.5">
        {[
          {
            icon: IconName.Earth,
            title: stringGetter({ key: STRING_KEYS.LEVERAGE_TRADE_EVENTS }),
            description: stringGetter({ key: STRING_KEYS.LEVERAGE_TRADE_EVENTS_CONTINUATION }),
          },
          {
            icon: IconName.Money,
            title: stringGetter({ key: STRING_KEYS.BINARY_SETTLEMENT }),
            description: stringGetter({ key: STRING_KEYS.BINARY_SETTLEMENT_DESC }),
          },
        ].map(renderPoint)}

        <Checkbox
          checked={doNotShowAgain}
          onCheckedChange={() => {
            setDoNotShowAgain((prev) => !prev);
          }}
          label={stringGetter({ key: STRING_KEYS.DONT_SHOW_ME_AGAIN })}
        />
      </div>

      <Button action={ButtonAction.Primary} onClick={onContinue}>
        {stringGetter({ key: STRING_KEYS.CONTINUE })}
      </Button>

      <p tw="mt-1 text-color-text-0 font-small-book">
        {stringGetter({
          key: STRING_KEYS.PREDICTION_MARKET_DISCLAIMER,
          params: {
            HERE: (
              <Link
                isInline
                href={predictionMarketLearnMore}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                tw="underline"
              >
                {stringGetter({ key: STRING_KEYS.HERE })}
              </Link>
            ),
          },
        })}
      </p>
    </Dialog>
  );
};

const $IconContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 50%;
  min-width: 3rem;
  width: 3rem;
  height: 3rem;
  background-color: var(--color-layer-5);
`;
