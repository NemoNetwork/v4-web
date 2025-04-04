import { useMemo } from 'react';

import { BonsaiHelpers, BonsaiHooks } from '@/bonsai/ontology';
import { LiveTrade } from '@/bonsai/types/summaryTypes';
import { OrderSide } from '@nemo-network/v4-client-js/src/clients/constants';
import styled, { css, keyframes } from 'styled-components';

import { STRING_KEYS } from '@/constants/localization';
import { TOKEN_DECIMALS } from '@/constants/numbers';
import { EMPTY_ARR } from '@/constants/objects';
import { IndexerOrderSide } from '@/types/indexer/indexerApiGen';

import { useBreakpoints } from '@/hooks/useBreakpoints';
import { useLocaleSeparators } from '@/hooks/useLocaleSeparators';
import { useStringGetter } from '@/hooks/useStringGetter';

import breakpoints from '@/styles/breakpoints';

import { LoadingSpace } from '@/components/Loading/LoadingSpinner';
import { Output, OutputType } from '@/components/Output';

import { useAppSelector } from '@/state/appTypes';
import { getSelectedLocale } from '@/state/localizationSelectors';

import { getConsistentAssetSizeString } from '@/lib/consistentAssetSize';
import { getSimpleStyledOutputType } from '@/lib/genericFunctionalComponentUtils';
import { isTruthy } from '@/lib/isTruthy';
import { MaybeBigNumber, MustBigNumber } from '@/lib/numbers';

import { OrderbookTradesOutput, OrderbookTradesTable } from './OrderbookTradesTable';

const MAX_ORDERBOOK_BAR_SIZE = 0.4;
const LARGE_TRADE_USD_VALUE = 10000;

type StyleProps = {
  className?: string;
  histogramSide: 'left' | 'right';
};

// Current fix for styled-component not preserving generic row
type RowData = {
  key: string;
  createdAtMilliseconds: number;
  price: number;
  side: OrderSide;
  size: number;
};

export const LiveTrades = ({ className, histogramSide = 'left' }: StyleProps) => {
  const stringGetter = useStringGetter();
  const { isTablet } = useBreakpoints();
  const currentMarketConfig = useAppSelector(BonsaiHelpers.currentMarket.stableMarketInfo);
  const currentMarketLiveTrades =
    BonsaiHooks.useCurrentMarketLiveTrades().data?.trades ?? EMPTY_ARR;

  const {
    stepSizeDecimals,
    tickSizeDecimals,
    stepSize,
    displayableAsset: displayableAssetId,
  } = currentMarketConfig ?? {};
  const { decimal: decimalSeparator, group: groupSeparator } = useLocaleSeparators();
  const selectedLocale = useAppSelector(getSelectedLocale);

  const rows = useMemo(
    () =>
      currentMarketLiveTrades.map(
        ({ createdAt, price, size, side, id }: LiveTrade): RowData => ({
          key: id,
          createdAtMilliseconds: new Date(createdAt).getTime(),
          price: MustBigNumber(price).toNumber(),
          // todo use same helper as the horizontal panel files
          side: side === IndexerOrderSide.BUY ? OrderSide.BUY : OrderSide.SELL,
          size: MustBigNumber(size).toNumber(),
        })
      ),
    [currentMarketLiveTrades]
  );

  const columns = useMemo(() => {
    const timeColumn = {
      columnKey: 'time',
      getCellValue: (row: RowData) => row.createdAtMilliseconds,
      label: stringGetter({ key: STRING_KEYS.TIME }),
      renderCell: (row: RowData) => (
        <OrderbookTradesOutput
          type={OutputType.Time}
          value={row.createdAtMilliseconds}
          tw="text-color-text-0 [font-feature-settings:--fontFeature-monoNumbers]"
        />
      ),
    };
    return [
      isTablet && timeColumn,
      isTablet && {
        columnKey: 'side',
        getCellValue: (row: RowData) => row.size,
        label: stringGetter({ key: STRING_KEYS.SIDE }),
        renderCell: (row: RowData) => (
          <Output
            type={OutputType.Text}
            value={stringGetter({
              key: row.side === OrderSide.BUY ? STRING_KEYS.BUY : STRING_KEYS.SELL,
            })}
            tw="text-[color:--accent-color]"
          />
        ),
      },
      {
        columnKey: 'size',
        getCellValue: (row: RowData) => row.size,
        label: stringGetter({ key: STRING_KEYS.SIZE }),
        tag: displayableAssetId,
        renderCell: (row: RowData) => (
          <Output
            type={OutputType.Text}
            value={getConsistentAssetSizeString(row.size, {
              decimalSeparator,
              groupSeparator,
              selectedLocale,
              stepSize: MaybeBigNumber(stepSize)?.toNumber() ?? 10 ** (-1 * TOKEN_DECIMALS),
              stepSizeDecimals: stepSizeDecimals ?? TOKEN_DECIMALS,
            })}
            tw="text-[color:--accent-color] tablet:text-color-text-1"
          />
        ),
      },
      {
        columnKey: 'price',
        getCellValue: (row: RowData) => row.price,
        label: stringGetter({ key: STRING_KEYS.PRICE }),
        tag: 'USD',
        renderCell: (row: RowData) => (
          <OrderbookTradesOutput
            type={OutputType.Fiat}
            value={row.price}
            fractionDigits={tickSizeDecimals}
            useGrouping={false}
          />
        ),
      },
      !isTablet && timeColumn,
    ].filter(isTruthy);
  }, [
    stringGetter,
    isTablet,
    displayableAssetId,
    decimalSeparator,
    groupSeparator,
    selectedLocale,
    stepSize,
    stepSizeDecimals,
    tickSizeDecimals,
  ]);

  return (
    <$LiveTradesTable
      className={className}
      key="live-trades"
      tableId="live-trades"
      label="Recent Trades"
      data={rows}
      columns={columns}
      getRowKey={(row: RowData) => `${row.key}`}
      getRowAttributes={(row: RowData) => ({
        'data-side': row.side,
        style: {
          '--histogram-bucket-size': Math.min(
            ((row.price * row.size) / LARGE_TRADE_USD_VALUE) * MAX_ORDERBOOK_BAR_SIZE,
            MAX_ORDERBOOK_BAR_SIZE
          ),
        },
      })}
      histogramSide={histogramSide}
      selectionBehavior="replace"
      slotEmpty={<LoadingSpace id="live-trades-loading" />}
      withScrollSnapRows
      withScrollSnapColumns
      withFocusStickyRows
      withInnerBorders={isTablet}
    />
  );
};
const liveTradesTableType = getSimpleStyledOutputType(OrderbookTradesTable, {} as StyleProps);
const $LiveTradesTable = styled(OrderbookTradesTable)<StyleProps>`
  background: var(--color-layer-2);

  tr {
    --histogram-bucket-size: 1;

    &[data-side=${OrderSide.BUY}] {
      --accent-color: var(--color-positive);
    }
    &[data-side=${OrderSide.SELL}] {
      --accent-color: var(--color-negative);
    }

    td:first-child {
      &:before,
      &:after {
        content: '';
        inset: 1px -2px;

        position: absolute;

        ${({ histogramSide }) =>
          histogramSide === 'left'
            ? css`
                right: auto;
              `
            : css`
                left: auto;
              `}
      }

      /* Animation
        @media (prefers-reduced-motion: no-preference) {
          will-change: width;
          transition: var(--ease-out-expo) 0.3s, width var(--ease-in-out-expo) 0.5s;
        } */

      /* Histogram: Size bar */
      &:before {
        width: calc(var(--histogram-bucket-size) * var(--histogram-width));
        border-radius: 2px;

        background: linear-gradient(
          to var(--histogram-gradient-to),
          var(--accent-color),
          transparent 500%
        );
        opacity: 0.4;

        tr:hover & {
          opacity: 0.75;
        }

        @media (prefers-reduced-motion: no-preference) {
          animation: ${keyframes`
          20% {
            opacity: 0.6;
          }
        `} 0.5s;
        }
      }
    }
  }

  @media ${breakpoints.tablet} {
    --tableCell-padding: 0.3em 1em;

    font-size: 0.875em;
  }
` as typeof liveTradesTableType;
