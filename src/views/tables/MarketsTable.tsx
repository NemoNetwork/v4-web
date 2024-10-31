import { Key, useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import tw from 'twin.macro';

import { ButtonSize } from '@/constants/buttons';
import { STRING_KEYS } from '@/constants/localization';
import { MarketFilters, type MarketData } from '@/constants/markets';
import { FUNDING_DECIMALS } from '@/constants/numbers';
import { AppRoute, MarketsRoute } from '@/constants/routes';

import { useBreakpoints } from '@/hooks/useBreakpoints';
import { useMarketsData } from '@/hooks/useMarketsData';
import { usePotentialMarkets } from '@/hooks/usePotentialMarkets';
import { useStringGetter } from '@/hooks/useStringGetter';

import breakpoints from '@/styles/breakpoints';
import { layoutMixins } from '@/styles/layoutMixins';
import { tradeViewMixins } from '@/styles/tradeViewMixins';

import { Button } from '@/components/Button';
import { LoadingSpace } from '@/components/Loading/LoadingSpinner';
import { Output, OutputType } from '@/components/Output';
import { Table, type ColumnDef } from '@/components/Table';
import { AssetTableCell } from '@/components/Table/AssetTableCell';
import { TableCell } from '@/components/Table/TableCell';
import { Toolbar } from '@/components/Toolbar';
import { TriangleIndicator } from '@/components/TriangleIndicator';
import { SparklineChart } from '@/components/visx/SparklineChart';
import { MarketFilter } from '@/views/MarketFilter';

import { useAppDispatch, useAppSelector } from '@/state/appTypes';
import { setMarketFilter } from '@/state/perpetuals';
import { getMarketFilter } from '@/state/perpetualsSelectors';

import { MustBigNumber } from '@/lib/numbers';
import { testFlags } from '@/lib/testFlags';

export const MarketsTable = ({ className }: { className?: string }) => {
  const stringGetter = useStringGetter();
  const { isTablet } = useBreakpoints();
  const dispatch = useAppDispatch();
  const filter: MarketFilters = useAppSelector(getMarketFilter);
  const [searchFilter, setSearchFilter] = useState<string>();
  const navigate = useNavigate();

  const { filteredMarkets, marketFilters, hasMarketIds } = useMarketsData({
    filter,
    searchFilter,
  });

  const { hasPotentialMarketsData } = usePotentialMarkets();

  const columns = useMemo<ColumnDef<MarketData>[]>(
    () =>
      isTablet
        ? ([
            {
              columnKey: 'marketAndVolume',
              getCellValue: (row) => row.volume24H,
              label: stringGetter({ key: STRING_KEYS.MARKET }),
              renderCell: ({
                assetId,
                effectiveInitialMarginFraction,
                imageUrl,
                initialMarginFraction,
                name,
                isUnlaunched,
                volume24H,
              }) => (
                <AssetTableCell
                  configs={{
                    effectiveInitialMarginFraction,
                    imageUrl,
                    initialMarginFraction,
                    isUnlaunched,
                  }}
                  name={name}
                  symbol={assetId}
                >
                  <Output
                    type={OutputType.CompactFiat}
                    value={volume24H ?? undefined}
                    tw="text-color-text-0 font-mini-medium"
                  />
                </AssetTableCell>
              ),
            },
            {
              columnKey: 'price',
              getCellValue: (row) => row.oraclePrice,
              label: stringGetter({ key: STRING_KEYS.PRICE }),
              renderCell: ({
                oraclePrice,
                priceChange24H,
                priceChange24HPercent,
                tickSizeDecimals,
              }) => (
                <TableCell stacked>
                  <$TabletOutput
                    withSubscript
                    type={OutputType.Fiat}
                    value={oraclePrice}
                    fractionDigits={tickSizeDecimals}
                    withBaseFont
                  />
                  <$InlineRow tw="font-small-book">
                    {!priceChange24H ? (
                      <Output type={OutputType.Fiat} value={null} />
                    ) : (
                      <>
                        {priceChange24H > 0 && (
                          <TriangleIndicator value={MustBigNumber(priceChange24H)} />
                        )}
                        <$Output
                          type={OutputType.Percent}
                          value={MustBigNumber(priceChange24HPercent).abs()}
                          isPositive={MustBigNumber(priceChange24HPercent).gt(0)}
                          isNegative={MustBigNumber(priceChange24HPercent).isNegative()}
                        />
                      </>
                    )}
                  </$InlineRow>
                </TableCell>
              ),
            },
          ] satisfies ColumnDef<MarketData>[])
        : ([
            {
              columnKey: 'market',
              getCellValue: (row) => row.id,
              label: stringGetter({ key: STRING_KEYS.MARKET }),
              renderCell: ({
                assetId,
                effectiveInitialMarginFraction,
                imageUrl,
                initialMarginFraction,
                name,
                isUnlaunched,
              }) => (
                <AssetTableCell
                  configs={{
                    effectiveInitialMarginFraction,
                    imageUrl,
                    initialMarginFraction,
                    isUnlaunched,
                  }}
                  name={name}
                  symbol={assetId}
                />
              ),
            },
            {
              columnKey: 'oraclePrice',
              getCellValue: (row) => row.oraclePrice,
              label: stringGetter({ key: STRING_KEYS.ORACLE_PRICE }),
              renderCell: ({ oraclePrice, tickSizeDecimals }) => (
                <$TabletOutput
                  withSubscript
                  type={OutputType.Fiat}
                  value={oraclePrice}
                  fractionDigits={tickSizeDecimals}
                />
              ),
            },
            {
              columnKey: 'priceChange24HChart',
              label: stringGetter({ key: STRING_KEYS.LAST_24H }),
              renderCell: ({ line, priceChange24HPercent }) => (
                <div tw="h-2 w-3">
                  <SparklineChart
                    data={(line ?? []).map((datum, index) => ({
                      x: index + 1,
                      y: parseFloat(datum.toString()),
                    }))}
                    xAccessor={(datum) => datum?.x ?? 0}
                    yAccessor={(datum) => datum?.y ?? 0}
                    positive={MustBigNumber(priceChange24HPercent).gt(0)}
                  />
                </div>
              ),
              allowsSorting: false,
            },
            {
              columnKey: 'priceChange24HPercent',
              getCellValue: (row) => row.priceChange24HPercent,
              label: stringGetter({ key: STRING_KEYS.CHANGE_24H }),
              renderCell: ({ priceChange24HPercent }) => (
                <TableCell stacked>
                  <$InlineRow>
                    {!priceChange24HPercent ? (
                      <Output type={OutputType.Text} value={null} />
                    ) : (
                      <$Output
                        type={OutputType.Percent}
                        value={MustBigNumber(priceChange24HPercent).abs()}
                        isPositive={MustBigNumber(priceChange24HPercent).gt(0)}
                        isNegative={MustBigNumber(priceChange24HPercent).isNegative()}
                      />
                    )}
                  </$InlineRow>
                </TableCell>
              ),
            },
            {
              columnKey: 'volume24H',
              getCellValue: (row) => row.volume24H,
              label: stringGetter({ key: STRING_KEYS.VOLUME_24H }),
              renderCell: (row) => (
                <$NumberOutput type={OutputType.CompactFiat} value={row.volume24H} />
              ),
            },
            {
              columnKey: 'trades24H',
              getCellValue: (row) => row.trades24H,
              label: stringGetter({ key: STRING_KEYS.TRADES }),
              renderCell: (row) => (
                <$NumberOutput type={OutputType.CompactNumber} value={row.trades24H} />
              ),
            },
            {
              columnKey: 'openInterest',
              getCellValue: (row) => row.openInterestUSDC,
              label: stringGetter({ key: STRING_KEYS.OPEN_INTEREST }),
              renderCell: (row) => (
                <$NumberOutput type={OutputType.CompactFiat} value={row.openInterestUSDC} />
              ),
            },
            {
              columnKey: 'nextFundingRate',
              getCellValue: (row) => row.nextFundingRate,
              label: stringGetter({ key: STRING_KEYS.FUNDING_RATE_1H_SHORT }),
              renderCell: (row) => (
                <$Output
                  type={OutputType.Percent}
                  fractionDigits={FUNDING_DECIMALS}
                  value={row.nextFundingRate}
                  isPositive={MustBigNumber(row.nextFundingRate).gt(0)}
                  isNegative={MustBigNumber(row.nextFundingRate).isNegative()}
                />
              ),
            },
          ] satisfies ColumnDef<MarketData>[]),
    [stringGetter, isTablet]
  );

  const setFilter = (newFilter: MarketFilters) => {
    dispatch(setMarketFilter(newFilter));
  };

  return (
    <>
      <$Toolbar>
        <MarketFilter
          hideNewMarketButton
          compactLayout
          searchPlaceholderKey={STRING_KEYS.SEARCH_MARKETS}
          selectedFilter={filter}
          filters={marketFilters}
          onChangeFilter={setFilter}
          onSearchTextChange={setSearchFilter}
        />
      </$Toolbar>

      <$Table
        withInnerBorders
        data={hasMarketIds ? filteredMarkets : []}
        getRowKey={(row: MarketData) => row.id}
        label="Markets"
        onRowAction={(market: Key) =>
          navigate(`${AppRoute.Trade}/${market}`, { state: { from: AppRoute.Markets } })
        }
        defaultSortDescriptor={{
          column: isTablet ? 'marketAndVolume' : 'volume24H',
          direction: 'descending',
        }}
        columns={columns}
        initialPageSize={50}
        paginationBehavior={testFlags.pml ? 'paginate' : 'showAll'}
        shouldResetOnTotalRowsChange
        className={className}
        slotEmpty={
          <$MarketNotFound>
            {filter === MarketFilters.NEW && !searchFilter ? (
              <>
                <h2>
                  {stringGetter({
                    key: STRING_KEYS.QUERY_NOT_FOUND,
                    params: { QUERY: stringGetter({ key: STRING_KEYS.NEW }) },
                  })}
                </h2>
                {hasPotentialMarketsData && (
                  <p>{stringGetter({ key: STRING_KEYS.ADD_DETAILS_TO_LAUNCH_MARKET })}</p>
                )}
              </>
            ) : searchFilter ? (
              <>
                <h2>
                  {stringGetter({
                    key: STRING_KEYS.QUERY_NOT_FOUND,
                    params: { QUERY: searchFilter },
                  })}
                </h2>
                <p>{stringGetter({ key: STRING_KEYS.MARKET_SEARCH_DOES_NOT_EXIST_YET })}</p>
              </>
            ) : (
              <LoadingSpace id="markets-table" />
            )}

            {hasPotentialMarketsData && hasMarketIds && (
              <div>
                <Button
                  onClick={() => navigate(`${AppRoute.Markets}/${MarketsRoute.New}`)}
                  size={ButtonSize.Small}
                >
                  {stringGetter({ key: STRING_KEYS.PROPOSE_NEW_MARKET })}
                </Button>
              </div>
            )}
          </$MarketNotFound>
        }
      />
    </>
  );
};
const $Toolbar = styled(Toolbar)`
  max-width: 100vw;
  overflow: hidden;
  margin-bottom: 0.625rem;
  padding-left: 0.375rem;
  padding-right: 0;

  @media ${breakpoints.desktopSmall} {
    padding-right: 0.375rem;
  }

  @media ${breakpoints.tablet} {
    padding-left: 1rem;
    padding-right: 1rem;
  }
`;

const $Table = styled(Table)`
  ${tradeViewMixins.horizontalTable}
  tbody {
    --tableCell-padding: 1rem 0;
  }

  @media ${breakpoints.tablet} {
    table {
      max-width: 100vw;
    }
  }
` as typeof Table;

const $TabletOutput = tw(Output)`font-base-book text-color-text-2`;

const $InlineRow = tw.div`inlineRow`;
const $NumberOutput = tw(Output)`font-base-medium text-color-text-2`;

const $Output = styled(Output)<{ isNegative?: boolean; isPositive?: boolean }>`
  color: ${({ isNegative, isPositive }) =>
    isNegative
      ? `var(--color-negative)`
      : isPositive
        ? `var(--color-positive)`
        : `var(--color-text-1)`};
  font: var(--font-base-medium);
`;

const $MarketNotFound = styled.div`
  ${layoutMixins.column}
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 1rem;
  padding: 2rem 1.5rem;

  h2 {
    font: var(--font-medium-book);
    font-weight: 500;
  }
`;
