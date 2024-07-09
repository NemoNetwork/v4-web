import { useMemo } from 'react';

import { shallowEqual } from 'react-redux';
import styled from 'styled-components';

import { TransferInputTokenResource, TransferType } from '@/constants/abacus';
import { getMapOfLowestFeeTokensByDenom } from '@/constants/cctp';
import { STRING_KEYS } from '@/constants/localization';
import { EMPTY_ARR } from '@/constants/objects';

import { useEnvFeatures } from '@/hooks/useEnvFeatures';
import { useStringGetter } from '@/hooks/useStringGetter';

import { layoutMixins } from '@/styles/layoutMixins';

import { DiffArrow } from '@/components/DiffArrow';
import { SearchSelectMenu } from '@/components/SearchSelectMenu';
import { Tag } from '@/components/Tag';

import { useAppSelector } from '@/state/appTypes';
import { getTransferInputs } from '@/state/inputsSelectors';

import { LowestFeesDecoratorText } from './LowestFeesText';

type ElementProps = {
  selectedToken?: TransferInputTokenResource;
  onSelectToken: (token: TransferInputTokenResource) => void;
  isExchange?: boolean;
};

export const TokenSelectMenu = ({ selectedToken, onSelectToken, isExchange }: ElementProps) => {
  const stringGetter = useStringGetter();
  const { type, depositOptions, withdrawalOptions, resources } =
    useAppSelector(getTransferInputs, shallowEqual) ?? {};
  const { CCTPWithdrawalOnly, CCTPDepositOnly } = useEnvFeatures();

  const cctpTokensByDenom = useMemo(() => getMapOfLowestFeeTokensByDenom(type), [type]);

  const tokens =
    (type === TransferType.deposit ? depositOptions : withdrawalOptions)?.assets?.toArray() ??
    EMPTY_ARR;

  const tokenItems = Object.values(tokens)
    .map((token) => ({
      value: token.type,
      label: token.stringKey,
      onSelect: () => {
        const newSelectedToken = resources?.tokenResources?.get(token.type);
        if (newSelectedToken) {
          onSelectToken(newSelectedToken);
        }
      },
      slotBefore: (
        // the curve dao token svg causes the web app to lag when rendered
        <$Img src={token.iconUrl ?? undefined} alt="" />
      ),
      slotAfter: !!cctpTokensByDenom[token.type] && <LowestFeesDecoratorText />,
      tag: resources?.tokenResources?.get(token.type)?.symbol,
    }))
    .filter((token) => {
      // if deposit and CCTPDepositOnly enabled, only return cctp tokens
      if (type === TransferType.deposit && CCTPDepositOnly) {
        return !!cctpTokensByDenom[token.value];
      }
      // if withdrawal and CCTPWithdrawalOnly enabled, only return cctp tokens
      if (type === TransferType.withdrawal && CCTPWithdrawalOnly) {
        return !!cctpTokensByDenom[token.value];
      }
      return true;
    })
    .sort((token) => (cctpTokensByDenom[token.value] ? -1 : 1));

  return (
    <SearchSelectMenu
      items={[
        {
          group: 'assets',
          groupLabel: stringGetter({ key: STRING_KEYS.ASSET }),
          items: tokenItems,
        },
      ]}
      label={stringGetter({ key: STRING_KEYS.ASSET })}
      withSearch={!isExchange}
      withReceiptItems={
        !isExchange
          ? [
              {
                key: 'swap',
                label: stringGetter({ key: STRING_KEYS.SWAP }),
                value: selectedToken && (
                  <>
                    <Tag>{type === TransferType.deposit ? selectedToken?.symbol : 'USDC'}</Tag>
                    <DiffArrow />
                    <Tag>{type === TransferType.deposit ? 'USDC' : selectedToken?.symbol}</Tag>
                  </>
                ),
              },
            ]
          : undefined
      }
    >
      <$AssetRow>
        {selectedToken ? (
          <>
            <$Img src={selectedToken?.iconUrl ?? undefined} alt="" /> {selectedToken?.name}{' '}
            <Tag>{selectedToken?.symbol}</Tag>
          </>
        ) : (
          stringGetter({ key: STRING_KEYS.SELECT_ASSET })
        )}
      </$AssetRow>
    </SearchSelectMenu>
  );
};

const $AssetRow = styled.div`
  ${layoutMixins.row}
  gap: 0.5rem;
  color: var(--color-text-2);
  font: var(--font-base-book);
`;

const $Img = styled.img`
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
`;
