import { DepositDialogProps, DialogProps } from '@/constants/dialogs';
import { STRING_KEYS } from '@/constants/localization';

import { useBreakpoints } from '@/hooks/useBreakpoints';
import { useStringGetter } from '@/hooks/useStringGetter';

import { Dialog, DialogPlacement } from '@/components/Dialog';

import { DepositDialogContent } from './DepositDialog/DepositDialogContent';

enum DepositType {
  FUNKIT = 'funkit',
  STANDARD = 'standard',
}

export const DepositDialog = ({
  setIsOpen,
  depositType = DepositType.FUNKIT,
}: DialogProps<DepositDialogProps>) => {
  const stringGetter = useStringGetter();
  const { isMobile } = useBreakpoints();
  // const startCheckout = useFunkitBuyNobleUsdc();
  // const dispatch = useAppDispatch();
  // const ffEnableFunkit =
  //   (useStatsigGateValue(StatsigFlags.ffEnableFunkit) || testFlags.showInstantDepositToggle) &&
  //   import.meta.env.VITE_FUNKIT_API_KEY;

  // const {
  //   sourceAccount: { walletInfo },
  // } = useAccounts();

  // useEffect(() => {
  //   if (
  //     depositType === DepositType.FUNKIT &&
  //     ffEnableFunkit &&
  //     walletInfo?.name !== WalletType.Keplr &&
  //     walletInfo?.name !== WalletType.Phantom
  //   ) {
  //     dispatch(closeDialog());
  //     startCheckout();
  //   }
  // }, [depositType, dispatch, startCheckout, ffEnableFunkit, walletInfo?.name]);

  return (
    <Dialog
      isOpen
      withAnimation
      setIsOpen={setIsOpen}
      title={stringGetter({ key: STRING_KEYS.DEPOSIT })}
      placement={isMobile ? DialogPlacement.FullScreen : DialogPlacement.Default}
    >
      <DepositDialogContent />
    </Dialog>
  );
};
