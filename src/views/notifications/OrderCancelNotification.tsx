import { BonsaiHelpers } from '@/bonsai/ontology';
import { OrderStatus } from '@/bonsai/types/summaryTypes';

import { AbacusOrderStatus, TRADE_TYPES_NEW } from '@/constants/abacus';
import { STRING_KEYS } from '@/constants/localization';
import { CancelOrderStatuses, LocalCancelOrderData, ORDER_TYPE_STRINGS } from '@/constants/trade';

import { useParameterizedSelector } from '@/hooks/useParameterizedSelector';
import { useStringGetter } from '@/hooks/useStringGetter';

import { AssetIcon } from '@/components/AssetIcon';
import { Icon, IconName } from '@/components/Icon';
import { LoadingSpinner } from '@/components/Loading/LoadingSpinner';
// eslint-disable-next-line import/no-cycle
import { Notification, NotificationProps } from '@/components/Notification';

import { getOrderById } from '@/state/accountSelectors';

import { orEmptyObj } from '@/lib/typeUtils';

import { OrderStatusIcon } from '../OrderStatusIcon';

type ElementProps = {
  localCancel: LocalCancelOrderData;
};

export const OrderCancelNotification = ({
  isToast,
  localCancel,
  notification,
}: NotificationProps & ElementProps) => {
  const stringGetter = useStringGetter();
  const order = useParameterizedSelector(getOrderById, localCancel.orderId)!;
  const { assetId, logo: logoUrl } = orEmptyObj(
    useParameterizedSelector(BonsaiHelpers.markets.createSelectMarketSummaryById, order.marketId)
  );

  const tradeType = TRADE_TYPES_NEW[order.type] ?? undefined;
  const orderTypeKey = tradeType && ORDER_TYPE_STRINGS[tradeType].orderTypeKey;
  const indexedOrderStatus = order.status;
  const cancelStatus = localCancel.submissionStatus;

  let orderStatusStringKey = STRING_KEYS.CANCELING;
  let orderStatusIcon = <LoadingSpinner tw="text-color-accent [--spinner-width:0.9375rem]" />;
  let customContent = null;

  // show Canceled if either canceled confirmation happens (node / indexer)
  // note: indexer status is further processed by abacus, but PartiallyCanceled = CANCELED
  const isPartiallyCanceled = indexedOrderStatus === OrderStatus.PartiallyCanceled;
  const isCancelFinalized = indexedOrderStatus === OrderStatus.Canceled || isPartiallyCanceled;

  if (cancelStatus === CancelOrderStatuses.Canceled || isCancelFinalized) {
    orderStatusStringKey = isPartiallyCanceled
      ? STRING_KEYS.PARTIALLY_FILLED
      : STRING_KEYS.CANCELED;
    orderStatusIcon = (
      <OrderStatusIcon
        status={AbacusOrderStatus.Canceled.rawValue}
        tw="h-[0.9375rem] w-[0.9375rem]"
      />
    );
  }

  if (localCancel.errorParams) {
    orderStatusStringKey = STRING_KEYS.ERROR;
    orderStatusIcon = <Icon iconName={IconName.Warning} tw="text-color-warning" />;
    customContent = (
      <span>
        {stringGetter({
          key: localCancel.errorParams.errorStringKey,
          fallback: localCancel.errorParams.errorMessage ?? '',
        })}
      </span>
    );
  }

  return (
    <Notification
      isToast={isToast}
      notification={notification}
      slotIcon={<AssetIcon logoUrl={logoUrl} symbol={assetId} />}
      slotTitle={orderTypeKey && stringGetter({ key: orderTypeKey })}
      slotTitleRight={
        <span tw="row gap-[0.5ch] text-color-text-0 font-small-book">
          {stringGetter({ key: orderStatusStringKey })}
          {orderStatusIcon}
        </span>
      }
      slotCustomContent={customContent}
    />
  );
};
