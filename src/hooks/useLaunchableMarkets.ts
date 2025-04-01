import { useMemo } from 'react';

import { mergeLoadableStatusState } from '@/bonsai/lib/mapLoadable';
import { BonsaiCore } from '@/bonsai/ontology';

import { useAppSelector } from '@/state/appTypes';

import metadataClient from '@/clients/metadataService';
import { getAssetFromMarketId, getMarketIdFromAsset } from '@/lib/assetUtils';
import { getTickSizeDecimalsFromPrice } from '@/lib/numbers';
import { orEmptyRecord } from '@/lib/typeUtils';

export const useMetadataService = () => {
  const metadataQuery = useQueries({
    queries: [
      {
        queryKey: ['marketMapInfo'],
        queryFn: async (): Promise<MetadataServiceInfoResponse> => {
          return metadataClient.getAssetInfo();
        },
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      {
        queryKey: ['marketMapPrice'],
        queryFn: async (): Promise<MetadataServicePricesResponse> => {
          return metadataClient.getAssetPrices();
        },
        refetchInterval: timeUnits.minute * 5,
      },
    ],
    combine: (results) => {
      const info = results[0].data;
      const prices = results[1].data;
      const data: Record<string, MetadataServiceAsset> = {};

      Object.keys(info ?? {}).forEach((key) => {
        if (info?.[key] && prices?.[key]) {
          const tickSizeDecimals = getTickSizeDecimalsFromPrice(prices[key].price);

          data[key] = {
            id: key,
            name: info[key].name,
            logo: info[key].logo,
            urls: {
              website: '',
              technicalDoc: '',
              // cmc: info[key].urls.cmc,
              cmc: '',
            },
            sectorTags: info[key].sector_tags,
            exchanges: info[key].exchanges,
            price: prices[key].price,
            percentChange24h: prices[key].percent_change_24h,
            marketCap: prices[key].market_cap,
            volume24h: prices[key].volume_24h,
            reportedMarketCap: prices[key].self_reported_market_cap,
            tickSizeDecimals,
          };
        }
      });

      return {
        data,
        isLoading: results.some((result) => result.isLoading),
        isError: results.some((result) => result.isError),
        isSuccess: results.every((result) => result.isSuccess),
      };
    },
  });

  return metadataQuery;
};

export const useMetadataServiceAssetFromId = (marketId?: string) => {
  const metadataServiceData = useMetadataService();

  const launchableAsset = useMemo(() => {
    if (!metadataServiceData.data || !marketId) {
      return null;
    }

    const assetId = getAssetFromMarketId(marketId);
    return metadataServiceData.data?.[assetId];
  }, [metadataServiceData.data, marketId]);

  return launchableAsset;
};
export const useLaunchableMarkets = () => {
  const perpsRaw = orEmptyRecord(useAppSelector(BonsaiCore.markets.markets.data));
  const assetsRaw = orEmptyRecord(useAppSelector(BonsaiCore.markets.assets.data));
  const loadingStateMarkets = useAppSelector(BonsaiCore.markets.markets.loading);
  const loadingStateAssets = useAppSelector(BonsaiCore.markets.assets.loading);
  const loadingState = mergeLoadableStatusState(loadingStateMarkets, loadingStateAssets);

  const filteredPotentialMarkets: { id: string; asset: string }[] = useMemo(() => {
    const assets = Object.values(assetsRaw).map((asset) => {
      return {
        id: getMarketIdFromAsset(asset.assetId),
        asset: asset.assetId,
      };
    });

    return assets.filter(({ id }) => {
      return perpsRaw[id] == null;
    });
  }, [assetsRaw, perpsRaw]);

  return {
    data: filteredPotentialMarkets,
    isLoading:
      (Object.keys(perpsRaw).length === 0 || Object.keys(assetsRaw).length === 0) &&
      (loadingState === 'idle' || loadingState === 'pending'),
  };
};
