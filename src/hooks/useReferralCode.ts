import { useEffect } from 'react';

import { DialogTypes } from '@/constants/dialogs';

import { removeLatestReferrer, updateLatestReferrer } from '@/state/affiliates';
import { getLatestReferrer } from '@/state/affiliatesSelector';
import { useAppDispatch, useAppSelector } from '@/state/appTypes';
import { openDialog } from '@/state/dialogs';

import { testFlags } from '@/lib/testFlags';

import { useAccounts } from './useAccounts';
import { useAffiliateMetadata } from './useAffiliatesInfo';
import { useReferralAddress } from './useReferralAddress';
import { useReferredBy } from './useReferredBy';

export function useReferralCode() {
  const dispatch = useAppDispatch();
  const { dydxAddress } = useAccounts();

  const { data: affiliateMetadata, isPending: isAffiliateMetadataPending } =
    useAffiliateMetadata(dydxAddress);

  const { data: referralAddress, isSuccess: isReferralAddressSuccess } = useReferralAddress(
    testFlags.referralCode
  );

  const { data: referredBy, isPending: isReferredByPending } = useReferredBy();

  const latestReferrer = useAppSelector(getLatestReferrer);

  const isOwnReferralCode = affiliateMetadata?.metadata?.referralCode === testFlags.referralCode;

  useEffect(() => {
    if (testFlags.referralCode) {
      dispatch(openDialog(DialogTypes.Referral({ refCode: testFlags.referralCode })));
    }
  }, [dispatch]);

  useEffect(() => {
    // wait for relevant data to load
    if (!isReferralAddressSuccess || isReferredByPending || isAffiliateMetadataPending) return;

    // current user already has a referrer registered
    if (referredBy?.affiliateAddress) return;

    // current user is using their own code
    if (isOwnReferralCode) return;

    if (referralAddress) {
      dispatch(updateLatestReferrer(referralAddress));
    }
  }, [
    referralAddress,
    isReferralAddressSuccess,
    dispatch,
    isReferredByPending,
    referredBy?.affiliateAddress,
    isAffiliateMetadataPending,
    isOwnReferralCode,
  ]);

  // If the current user already has a referrer registered, remove the pending referrer address
  // This handles the case of:
  // 1. User opens referral link without a wallet connected, affiliate address is saved
  // 2. User connects their wallet, and their account already has an affiliate registered or they are using their own code
  // 3. Remove saved affiliate address
  useEffect(() => {
    if ((isOwnReferralCode || referredBy?.affiliateAddress) && latestReferrer) {
      dispatch(removeLatestReferrer());
    }
  }, [dispatch, latestReferrer, referredBy?.affiliateAddress, isOwnReferralCode]);
}
