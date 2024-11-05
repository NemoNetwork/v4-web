import React, { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import isEmpty from 'lodash/isEmpty';
import {
  LanguageCode,
  ResolutionString,
  TradingTerminalWidgetOptions,
  widget as Widget,
} from 'public/tradingview/';

import { DEFAULT_RESOLUTION } from '@/constants/candles';
import { TOGGLE_ACTIVE_CLASS_NAME } from '@/constants/charts';
import { STRING_KEYS, SUPPORTED_LOCALE_BASE_TAGS } from '@/constants/localization';
import { StatsigFlags } from '@/constants/statsig';
import { tooltipStrings } from '@/constants/tooltips';
import type { TvWidget } from '@/constants/tvchart';

import { store } from '@/state/_store';
import { getSelectedNetwork } from '@/state/appSelectors';
import { useAppDispatch, useAppSelector } from '@/state/appTypes';
import { getAppColorMode, getAppTheme } from '@/state/appUiConfigsSelectors';
import { getSelectedLocale } from '@/state/localizationSelectors';
import { getCurrentMarketConfig, getCurrentMarketId } from '@/state/perpetualsSelectors';
import { updateChartConfig } from '@/state/tradingView';
import { getTvChartConfig } from '@/state/tradingViewSelectors';

import { getDydxDatafeed } from '@/lib/tradingView/dydxfeed';
import { getSavedResolution, getWidgetOptions, getWidgetOverrides } from '@/lib/tradingView/utils';
import { orEmptyObj } from '@/lib/typeUtils';

import { useDydxClient } from '../useDydxClient';
import { useLocaleSeparators } from '../useLocaleSeparators';
import { useAllStatsigGateValues, useStatsigGateValue } from '../useStatsig';
import { useStringGetter } from '../useStringGetter';
import { useURLConfigs } from '../useURLConfigs';
import { useTradingViewLimitOrder } from './useTradingViewLimitOrder';

/**
 * @description Hook to initialize TradingView Chart
 */
export const useTradingView = ({
  tvWidget,
  setTvWidget,
  orderLineToggleRef,
  orderLinesToggleOn,
  setOrderLinesToggleOn,
  orderbookCandlesToggleRef,
  orderbookCandlesToggleOn,
  setOrderbookCandlesToggleOn,
  buySellMarksToggleRef,
  buySellMarksToggleOn,
  setBuySellMarksToggleOn,
}: {
  tvWidget?: TvWidget;
  setTvWidget: Dispatch<SetStateAction<TvWidget | undefined>>;
  orderLineToggleRef: React.MutableRefObject<HTMLElement | null>;
  orderLinesToggleOn: boolean;
  setOrderLinesToggleOn: Dispatch<SetStateAction<boolean>>;
  orderbookCandlesToggleRef: React.MutableRefObject<HTMLElement | null>;
  orderbookCandlesToggleOn: boolean;
  setOrderbookCandlesToggleOn: Dispatch<SetStateAction<boolean>>;
  buySellMarksToggleRef: React.MutableRefObject<HTMLElement | null>;
  buySellMarksToggleOn: boolean;
  setBuySellMarksToggleOn: Dispatch<SetStateAction<boolean>>;
}) => {
  const stringGetter = useStringGetter();
  const urlConfigs = useURLConfigs();
  const featureFlags = useAllStatsigGateValues();
  const dispatch = useAppDispatch();

  const { group, decimal } = useLocaleSeparators();

  const appTheme = useAppSelector(getAppTheme);
  const appColorMode = useAppSelector(getAppColorMode);

  const marketId = useAppSelector(getCurrentMarketId);
  const selectedLocale = useAppSelector(getSelectedLocale);
  const selectedNetwork = useAppSelector(getSelectedNetwork);

  const { getCandlesForDatafeed, getMarketTickSize } = useDydxClient();

  const savedTvChartConfig = useAppSelector(getTvChartConfig);
  const ffEnableOrderbookCandles = useStatsigGateValue(StatsigFlags.ffEnableOhlc);

  const savedResolution = useMemo(
    () => getSavedResolution({ savedConfig: savedTvChartConfig }),
    [savedTvChartConfig]
  );

  const [tickSizeDecimalsIndexer, setTickSizeDecimalsIndexer] = useState<{
    [marketId: string]: number | undefined;
  }>({});
  const { tickSizeDecimals: tickSizeDecimalsAbacus } = orEmptyObj(
    useAppSelector(getCurrentMarketConfig)
  );
  const tickSizeDecimals =
    (marketId
      ? tickSizeDecimalsIndexer[marketId] ?? tickSizeDecimalsAbacus
      : tickSizeDecimalsAbacus) ?? undefined;

  const initializeToggle = useCallback(
    ({
      toggleRef,
      widget,
      isOn,
      setToggleOn,
      label,
      tooltip,
    }: {
      toggleRef: React.MutableRefObject<HTMLElement | null>;
      widget: TvWidget;
      isOn: boolean;
      setToggleOn: Dispatch<SetStateAction<boolean>>;
      label: string;
      tooltip: string;
    }) => {
      toggleRef.current = widget.createButton();
      toggleRef.current.innerHTML = `<span>${label}</span> <div class="toggle"></div>`;
      toggleRef.current.setAttribute('title', tooltip);
      if (isOn) {
        toggleRef.current.classList.add(TOGGLE_ACTIVE_CLASS_NAME);
      }
      toggleRef.current.onclick = () => setToggleOn((prev) => !prev);
    },
    []
  );

  useEffect(() => {
    // we only need tick size from current market for the price scale settings
    // if markets haven't been loaded via abacus, get the current market info from indexer
    (async () => {
      if (marketId && tickSizeDecimals === undefined) {
        const marketTickSize = await getMarketTickSize(marketId);
        setTickSizeDecimalsIndexer((prev) => ({
          ...prev,
          [marketId]: BigNumber(marketTickSize).decimalPlaces() ?? undefined,
        }));
      }
    })();
  }, [marketId, tickSizeDecimals, getMarketTickSize]);

  const tradingViewLimitOrder = useTradingViewLimitOrder(marketId, tickSizeDecimals);

  useEffect(() => {
    if (marketId && tickSizeDecimals !== undefined && !tvWidget) {
      const widgetOptions = getWidgetOptions();
      const widgetOverrides = getWidgetOverrides({ appTheme, appColorMode });

      const initialPriceScale = BigNumber(10).exponentiatedBy(tickSizeDecimals).toNumber();
      const options: TradingTerminalWidgetOptions = {
        ...widgetOptions,
        ...widgetOverrides,
        datafeed: getDydxDatafeed(
          store,
          getCandlesForDatafeed,
          initialPriceScale,
          orderbookCandlesToggleOn,
          { decimal, group },
          selectedLocale,
          stringGetter
        ),
        interval: (savedResolution ?? DEFAULT_RESOLUTION) as ResolutionString,
        locale: SUPPORTED_LOCALE_BASE_TAGS[selectedLocale] as LanguageCode,
        symbol: marketId,
        saved_data: !isEmpty(savedTvChartConfig) ? savedTvChartConfig : undefined,
        auto_save_delay: 1,
      };

      const tvChartWidget = new Widget(options);
      setTvWidget(tvChartWidget);

      tvChartWidget.onChartReady(() => {
        // Initialize additional right-click-menu options
        tvChartWidget.onContextMenu(tradingViewLimitOrder);

        tvChartWidget.headerReady().then(() => {
          // Order Lines
          initializeToggle({
            toggleRef: orderLineToggleRef,
            widget: tvChartWidget,
            isOn: orderLinesToggleOn,
            setToggleOn: setOrderLinesToggleOn,
            label: stringGetter({
              key: STRING_KEYS.ORDER_LINES,
            }),
            tooltip: stringGetter({
              key: STRING_KEYS.ORDER_LINES_TOOLTIP,
            }),
          });

          if (ffEnableOrderbookCandles) {
            // Orderbook Candles (OHLC)
            const getOhlcTooltipString = tooltipStrings.ohlc;
            const { title: ohlcTitle, body: ohlcBody } = getOhlcTooltipString({
              stringGetter,
              stringParams: {},
              urlConfigs,
              featureFlags,
            });

            initializeToggle({
              toggleRef: orderbookCandlesToggleRef,
              widget: tvChartWidget,
              isOn: orderbookCandlesToggleOn,
              setToggleOn: setOrderbookCandlesToggleOn,
              label: `${ohlcTitle}*`,
              tooltip: ohlcBody as string,
            });
          }

          // Buy/Sell Marks
          initializeToggle({
            toggleRef: buySellMarksToggleRef,
            widget: tvChartWidget,
            isOn: buySellMarksToggleOn,
            setToggleOn: setBuySellMarksToggleOn,
            label: stringGetter({
              key: STRING_KEYS.BUYS_SELLS_TOGGLE,
            }),
            tooltip: stringGetter({
              key: STRING_KEYS.BUYS_SELLS_TOGGLE_TOOLTIP,
            }),
          });
        });

        tvChartWidget.subscribe('onAutoSaveNeeded', () =>
          tvChartWidget.save((chartConfig: object) => {
            dispatch(updateChartConfig(chartConfig));
          })
        );
      });
    }

    return () => {
      orderLineToggleRef.current?.remove();
      orderLineToggleRef.current = null;
      orderbookCandlesToggleRef.current?.remove();
      orderbookCandlesToggleRef.current = null;
      buySellMarksToggleRef.current?.remove();
      buySellMarksToggleRef.current = null;
      tvWidget?.remove();
    };
  }, [
    selectedLocale,
    selectedNetwork,
    !!marketId,
    tickSizeDecimals !== undefined,
    orderLineToggleRef,
    orderbookCandlesToggleRef,
    buySellMarksToggleRef,
    setBuySellMarksToggleOn,
    setOrderLinesToggleOn,
    setOrderbookCandlesToggleOn,
    orderbookCandlesToggleOn,
    tvWidget,
    setTvWidget,
  ]);

  return { savedResolution };
};
