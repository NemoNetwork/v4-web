/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { GasPrice } from '@cosmjs/stargate';
import { NobleClient } from '@dydxprotocol/v4-client-js';
import Long from 'long';
import { type NumberFormatValues } from 'react-number-format';
import { shallowEqual } from 'react-redux';
import styled from 'styled-components';
import { Abi, parseUnits } from 'viem';

import erc20 from '@/abi/erc20.json';
import erc20_usdt from '@/abi/erc20_usdt.json';
import { TransferInputField, TransferInputTokenResource, TransferType } from '@/constants/abacus';
import { AlertType } from '@/constants/alerts';
import {
  AnalyticsEventPayloads,
  AnalyticsEvents,
  DEFAULT_TRANSACTION_MEMO,
} from '@/constants/analytics';
import { ButtonSize } from '@/constants/buttons';
import { DialogTypes } from '@/constants/dialogs';
import { STRING_KEYS } from '@/constants/localization';
import { isMainnet } from '@/constants/networks';
import { TransferNotificationTypes } from '@/constants/notifications';
import {
  DEFAULT_GAS_LIMIT,
  DEFAULT_NOBLE_GAS_FEE,
  MAX_CCTP_TRANSFER_AMOUNT,
  MAX_PRICE_IMPACT,
  MIN_CCTP_TRANSFER_AMOUNT,
  NumberSign,
} from '@/constants/numbers';
import { AppRoute, BASE_ROUTE } from '@/constants/routes';
import { WalletType, type EvmAddress } from '@/constants/wallets';

import { CHAIN_DEFAULT_TOKEN_ADDRESS, useAccountBalance } from '@/hooks/useAccountBalance';
import { useAccounts } from '@/hooks/useAccounts';
import { useDebounce } from '@/hooks/useDebounce';
import { useEndpointsConfig } from '@/hooks/useEndpointsConfig';
import { useLocalNotifications } from '@/hooks/useLocalNotifications';
import { useStringGetter } from '@/hooks/useStringGetter';
import { useTokenConfigs } from '@/hooks/useTokenConfigs';

import { formMixins } from '@/styles/formMixins';

import { AlertMessage } from '@/components/AlertMessage';
import { DiffOutput } from '@/components/DiffOutput';
import { FormInput } from '@/components/FormInput';
import { FormMaxInputToggleButton } from '@/components/FormMaxInputToggleButton';
import { InputType } from '@/components/Input';
import { Link } from '@/components/Link';
import { LoadingSpace } from '@/components/Loading/LoadingSpinner';
import { OutputType } from '@/components/Output';
import { Tag } from '@/components/Tag';
import { WithDetailsReceipt } from '@/components/WithDetailsReceipt';
import { WithTooltip } from '@/components/WithTooltip';

import { getOnboardingGuards } from '@/state/accountSelectors';
import { getSelectedDydxChainId } from '@/state/appSelectors';
import { useAppDispatch, useAppSelector } from '@/state/appTypes';
import { closeDialog, forceOpenDialog, openDialog } from '@/state/dialogs';
import { getTransferInputs } from '@/state/inputsSelectors';

import abacusStateManager from '@/lib/abacus';
import { track } from '@/lib/analytics';
import { MustBigNumber } from '@/lib/numbers';
import {
  NATIVE_TOKEN_ADDRESS,
  fetchSkipRoute,
  getNobleChainId,
  isTransferOperation,
} from '@/lib/squid';
import { log } from '@/lib/telemetry';
import { parseWalletError } from '@/lib/wallet';

import { CoinbaseDeposit } from '../CoinbaseDeposit';
import { DepositButtonAndReceipt } from './DepositForm/DepositButtonAndReceipt';
import { SourceSelectMenu } from './SourceSelectMenu';
import { TokenSelectMenu } from './TokenSelectMenu';

type DepositFormProps = {
  onDeposit?: (event?: AnalyticsEventPayloads['TransferDeposit']) => void;
  onError?: () => void;
};

enum DepositSteps {
  Initial = 'initial',
  Approval = 'approval',
  Confirm = 'confirm',
}

export const DepositForm = ({ onDeposit, onError }: DepositFormProps) => {
  const stringGetter = useStringGetter();
  const dispatch = useAppDispatch();
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [depositStep, setDepositStep] = useState<DepositSteps>(DepositSteps.Initial);
  const [requireUserActionInWallet, setRequireUserActionInWallet] = useState(false);
  const selectedDydxChainId = useAppSelector(getSelectedDydxChainId);
  const { hasAcknowledgedTerms } = useAppSelector(getOnboardingGuards);

  const {
    dydxAddress,
    evmAddress,
    signerWagmi,
    publicClientWagmi,
    nobleAddress,
    saveHasAcknowledgedTerms,
    localNobleWallet,
    walletType,
  } = useAccounts();

  const { addOrUpdateTransferNotification } = useLocalNotifications();

  const isKeplrWallet = walletType === WalletType.Keplr;

  const {
    requestPayload,
    token,
    exchange,
    chain: chainIdStr,
    resources,
    summary,
    errors: routeErrors,
    errorMessage: routeErrorMessage,
    isCctp,
  } = useAppSelector(getTransferInputs, shallowEqual) ?? {};
  // todo are these guaranteed to be base 10?
  // eslint-disable-next-line radix
  const chainId = chainIdStr && !isKeplrWallet ? parseInt(chainIdStr) : chainIdStr ?? undefined;
  const nobleChainId = getNobleChainId();

  // User inputs
  const sourceToken = useMemo(
    () => (token ? resources?.tokenResources?.get(token) : undefined),
    [token, resources]
  );

  const sourceChain = useMemo(
    () => (chainIdStr ? resources?.chainResources?.get(chainIdStr) : undefined),
    [chainIdStr, resources]
  );

  const [fromAmount, setFromAmount] = useState('');
  const [slippage, setSlippage] = useState(isCctp ? 0 : 0.01); // 1% slippage
  const debouncedAmount = useDebounce<string>(fromAmount, 500);

  const { usdcLabel, usdcDecimals, usdcGasDenom, usdcDenom } = useTokenConfigs();
  const { nobleValidator, skip } = useEndpointsConfig();
  // Async Data
  const { balance } = useAccountBalance({
    addressOrDenom: sourceToken?.address || CHAIN_DEFAULT_TOKEN_ADDRESS,
    chainId,
    isCosmosChain: isKeplrWallet,
    cosmosAddress: isKeplrWallet ? nobleAddress : undefined,
    rpc: isKeplrWallet ? nobleValidator : undefined,
    decimals: isKeplrWallet ? usdcDecimals : undefined,
  });
  // BN
  const debouncedAmountBN = MustBigNumber(debouncedAmount);
  const balanceBN = MustBigNumber(balance);

  useEffect(() => {
    setSlippage(isCctp || isKeplrWallet ? 0 : 0.01);
  }, [isCctp, isKeplrWallet]);

  useEffect(() => {
    const hasInvalidInput =
      debouncedAmountBN.isNaN() || debouncedAmountBN.lte(0) || debouncedAmountBN.gt(balanceBN);

    abacusStateManager.setTransferValue({
      value: hasInvalidInput ? 0 : debouncedAmount,
      field: TransferInputField.size,
    });

    setError(null);
  }, [debouncedAmountBN.toNumber()]);

  useEffect(() => {
    if (dydxAddress) {
      // TODO: this is for fixing a race condition where the sourceAddress is not set in time.
      // worth investigating a better fix on abacus
      if (evmAddress) {
        abacusStateManager.setTransfersSourceAddress(evmAddress);
      }
      if (walletType === WalletType.Keplr && nobleAddress) {
        abacusStateManager.setTransfersSourceAddress(nobleAddress);
      }
      abacusStateManager.setTransferValue({
        field: TransferInputField.type,
        value: TransferType.deposit.rawValue,
      });
    }
    return () => {
      abacusStateManager.resetInputState();
    };
  }, [dydxAddress, evmAddress, nobleAddress, walletType]);

  useEffect(() => {
    if (error) onError?.();
  }, [error]);

  useEffect(() => {
    if (walletType === WalletType.Privy) {
      abacusStateManager.setTransferValue({
        field: TransferInputField.exchange,
        value: 'coinbase',
      });
    }
    if (walletType === WalletType.Keplr) {
      abacusStateManager.setTransferValue({
        field: TransferInputField.chain,
        value: nobleChainId,
      });
    }
  }, [nobleAddress, nobleChainId, walletType]);

  const onSelectNetwork = useCallback((name: string, type: 'chain' | 'exchange') => {
    if (name) {
      abacusStateManager.clearTransferInputValues();
      setFromAmount('');
      if (type === 'chain') {
        abacusStateManager.setTransferValue({
          field: TransferInputField.chain,
          value: name,
        });
      } else {
        abacusStateManager.setTransferValue({
          field: TransferInputField.exchange,
          value: name,
        });
      }
    }
  }, []);

  const onSelectToken = useCallback((selectedToken: TransferInputTokenResource) => {
    if (selectedToken) {
      abacusStateManager.clearTransferInputValues();
      abacusStateManager.setTransferValue({
        field: TransferInputField.token,
        value: selectedToken.address,
      });
      setFromAmount('');
    }
  }, []);

  const onChangeAmount = useCallback(
    ({ value }: NumberFormatValues) => {
      setFromAmount(value);
    },
    [setFromAmount]
  );

  const onSetSlippage = useCallback(
    (newSlippage: number) => {
      setSlippage(newSlippage);
      // TODO: to be implemented via abacus
    },
    [setSlippage, debouncedAmount]
  );

  const onClickMax = useCallback(() => {
    if (balance) {
      if (chainIdStr === nobleChainId) {
        setFromAmount(balanceBN.minus(DEFAULT_NOBLE_GAS_FEE).toString());
        return;
      }
      setFromAmount(balanceBN.toString());
    }
  }, [balance, balanceBN, chainIdStr, nobleChainId]);

  const validateTokenApproval = useCallback(async () => {
    if (!signerWagmi || !publicClientWagmi) throw new Error('Missing signer');
    if (!sourceToken?.address || !sourceToken.decimals)
      throw new Error('Missing source token address');
    if (!requestPayload?.targetAddress) throw new Error('Missing target address');
    if (!requestPayload?.value) throw new Error('Missing transaction value');
    if (sourceToken?.address === NATIVE_TOKEN_ADDRESS) return;

    const allowance = await publicClientWagmi.readContract({
      address: sourceToken.address as EvmAddress,
      abi: erc20,
      functionName: 'allowance',
      args: [evmAddress as EvmAddress, requestPayload.targetAddress as EvmAddress],
    });

    const sourceAmountBN = parseUnits(debouncedAmount, sourceToken.decimals);

    if (sourceAmountBN > (allowance as bigint)) {
      setDepositStep(DepositSteps.Approval);
      const simulateApprove = async (abi: Abi) =>
        publicClientWagmi.simulateContract({
          account: evmAddress,
          address: sourceToken.address as EvmAddress,
          abi,
          functionName: 'approve',
          args: [requestPayload.targetAddress as EvmAddress, sourceAmountBN],
        });

      let result;
      try {
        result = await simulateApprove(erc20 as Abi);
      } catch (e) {
        result = await simulateApprove(erc20_usdt as Abi);
      }

      const approveTx = await signerWagmi.writeContract(result.request);
      await publicClientWagmi.waitForTransactionReceipt({
        hash: approveTx,
      });
    }
  }, [signerWagmi, publicClientWagmi, sourceToken, requestPayload, evmAddress, debouncedAmount]);

  const sendNobleIBC = useCallback(async () => {
    const nobleClient = new NobleClient(nobleValidator);
    if (!localNobleWallet) {
      throw new Error('Missing local noble wallet');
    }
    await nobleClient.connect(localNobleWallet);

    const amount = summary?.toAmount ?? 0;
    const parsedAmount = parseUnits(amount.toString(), usdcDecimals).toString();

    const ibcTransfer = (sourceChannel: string) => {
      return {
        typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
        value: {
          sourcePort: 'transfer',
          sourceChannel,
          sender: nobleAddress,
          receiver: dydxAddress,
          token: {
            denom: usdcGasDenom,
            amount: parsedAmount,
          },
          timeoutTimestamp: Long.fromNumber(Math.floor(Date.now() / 1000) * 1e9 + 10 * 60 * 1e9),
        },
      };
    };
    const nobleGasPrice = GasPrice.fromString('0.1uusdc');
    const memo = `${DEFAULT_TRANSACTION_MEMO} | ${nobleAddress}`;

    if (isMainnet) {
      try {
        const route = await fetchSkipRoute({
          baseUrl: skip,
          routeRequestGivenIn: {
            amount_in: parsedAmount,
            source_asset_chain_id: nobleChainId,
            source_asset_denom: usdcGasDenom,
            dest_asset_chain_id: selectedDydxChainId,
            dest_asset_denom: usdcDenom,
          },
        });

        const transferOperation = route?.operations.find(isTransferOperation);
        const transferChannel = transferOperation?.transfer.channel;

        if (!transferChannel) {
          throw new Error('Failed to get transfer channel');
        }

        const tx = ibcTransfer(transferChannel);
        const txResult = await nobleClient.send([tx], nobleGasPrice, memo);
        return txResult;
      } catch (e) {
        throw new Error('Failed to send IBC transfer');
      }
    } else {
      const tx = ibcTransfer('channel-21');
      const txResult = await nobleClient.send([tx], nobleGasPrice, memo);
      return txResult;
    }
  }, [
    dydxAddress,
    localNobleWallet,
    nobleAddress,
    nobleChainId,
    nobleValidator,
    selectedDydxChainId,
    skip,
    summary?.toAmount,
    usdcDecimals,
    usdcDenom,
    usdcGasDenom,
  ]);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      try {
        e.preventDefault();

        if (chainIdStr === nobleChainId) {
          setIsLoading(true);
          const txResult = await sendNobleIBC();

          const nobleTxHash = txResult.transactionHash;

          if (nobleTxHash) {
            addTransferNotification({
              txHash: nobleTxHash,
              toChainId: selectedDydxChainId,
              fromChainId: chainIdStr || undefined,
              toAmount: summary?.usdcSize ?? undefined,
              triggeredAt: Date.now(),
              isCctp,
              type: TransferNotificationTypes.Deposit,
              depositSubaccount: {
                needToDeposit: true,
              },
            });
            dispatch(closeDialog());
            dispatch(
              openDialog(
                DialogTypes.CosmosDeposit({
                  toChainId: selectedDydxChainId,
                  fromChainId: chainIdStr ?? undefined,
                  toAmount: summary?.toAmount ?? undefined,
                  txHash: nobleTxHash,
                })
              )
            );
          }
          return;
        }

        if (!signerWagmi) {
          throw new Error('Missing signer');
        }
        if (!requestPayload?.targetAddress || !requestPayload.data || !requestPayload.value) {
          throw new Error('Missing request payload');
        }

        if (isCctp && !abacusStateManager.chainTransactions.isNobleClientConnected) {
          throw new Error('Noble RPC endpoint unaccessible');
        }

        setIsLoading(true);

        if (!hasAcknowledgedTerms) {
          saveHasAcknowledgedTerms(true);
        }

        await validateTokenApproval();

        const tx = {
          to: requestPayload.targetAddress as EvmAddress,
          data: requestPayload.data as EvmAddress,
          gasLimit: BigInt(requestPayload.gasLimit || DEFAULT_GAS_LIMIT),
          value: requestPayload.routeType !== 'SEND' ? BigInt(requestPayload.value) : undefined,
        };
        setDepositStep(DepositSteps.Confirm);
        const txHash = await signerWagmi.sendTransaction(tx);

        if (txHash) {
          addOrUpdateTransferNotification({
            txHash,
            toChainId: !isCctp ? selectedDydxChainId : nobleChainId,
            fromChainId: chainIdStr || undefined,
            toAmount: summary?.usdcSize || undefined,
            triggeredAt: Date.now(),
            isCctp,
            requestId: requestPayload.requestId ?? undefined,
            type: TransferNotificationTypes.Deposit,
          });
          abacusStateManager.clearTransferInputValues();
          setFromAmount('');

          onDeposit?.({
            chainId: chainIdStr || undefined,
            tokenAddress: sourceToken?.address || undefined,
            tokenSymbol: sourceToken?.symbol || undefined,
            slippage: slippage || undefined,
            gasFee: summary?.gasFee || undefined,
            bridgeFee: summary?.bridgeFee || undefined,
            exchangeRate: summary?.exchangeRate || undefined,
            estimatedRouteDuration: summary?.estimatedRouteDuration || undefined,
            toAmount: summary?.toAmount || undefined,
            toAmountMin: summary?.toAmountMin || undefined,
          });
        }
      } catch (err) {
        log('DepositForm/onSubmit', err);
        setError(err);
      } finally {
        setIsLoading(false);
        setDepositStep(DepositSteps.Initial);
      }
    },
    [requestPayload, signerWagmi, chainIdStr, sourceToken, sourceChain, nobleChainId, sendNobleIBC]
  );

  const amountInputReceipt = [
    {
      key: 'amount',
      label: (
        <span>
          {stringGetter({ key: STRING_KEYS.AVAILABLE })}{' '}
          {sourceToken && <Tag>{sourceToken.symbol}</Tag>}
        </span>
      ),
      value: (
        <DiffOutput
          type={OutputType.Asset}
          value={balance}
          newValue={balanceBN.minus(debouncedAmountBN).toString()}
          sign={NumberSign.Negative}
          hasInvalidNewValue={balanceBN.minus(debouncedAmountBN).isNegative()}
          withDiff={
            Boolean(fromAmount && balance) &&
            !debouncedAmountBN.isNaN() &&
            !debouncedAmountBN.isZero()
          }
        />
      ),
    },
  ];

  // TODO: abstract as much as possible to a util/hook and share between WithdrawForm
  const errorMessage = useMemo(() => {
    if (isCctp) {
      if (
        !debouncedAmountBN.isZero() &&
        MustBigNumber(debouncedAmountBN).lte(MIN_CCTP_TRANSFER_AMOUNT)
      ) {
        return stringGetter({
          key: STRING_KEYS.AMOUNT_MINIMUM_ERROR,
          params: {
            NUMBER: MIN_CCTP_TRANSFER_AMOUNT,
            TOKEN: usdcLabel,
          },
        });
      }
      if (MustBigNumber(debouncedAmountBN).gte(MAX_CCTP_TRANSFER_AMOUNT)) {
        return stringGetter({
          key: STRING_KEYS.MAX_CCTP_TRANSFER_LIMIT_EXCEEDED,
          params: {
            MAX_CCTP_TRANSFER_AMOUNT,
          },
        });
      }
    }
    if (error) {
      return parseWalletError({ error, stringGetter }).message;
    }

    if (routeErrors) {
      track(
        AnalyticsEvents.RouteError({
          transferType: TransferType.deposit.name,
          errorMessage: routeErrorMessage ?? undefined,
          amount: debouncedAmount,
          chainId: chainIdStr ?? undefined,
          assetId: sourceToken?.toString(),
        })
      );
      return routeErrorMessage
        ? stringGetter({
            key: STRING_KEYS.SOMETHING_WENT_WRONG_WITH_MESSAGE,
            params: { ERROR_MESSAGE: routeErrorMessage },
          })
        : stringGetter({ key: STRING_KEYS.SOMETHING_WENT_WRONG });
    }

    if (fromAmount) {
      if (!chainId) {
        return stringGetter({ key: STRING_KEYS.MUST_SPECIFY_CHAIN });
      }
      if (!sourceToken) {
        return stringGetter({ key: STRING_KEYS.MUST_SPECIFY_ASSET });
      }
    }

    if (MustBigNumber(fromAmount).gt(MustBigNumber(balance))) {
      return stringGetter({ key: STRING_KEYS.DEPOSIT_MORE_THAN_BALANCE });
    }

    if (isMainnet && MustBigNumber(summary?.aggregatePriceImpact).gte(MAX_PRICE_IMPACT)) {
      return stringGetter({ key: STRING_KEYS.PRICE_IMPACT_TOO_HIGH });
    }

    return undefined;
  }, [
    error,
    routeErrors,
    routeErrorMessage,
    balance,
    chainId,
    fromAmount,
    sourceToken,
    stringGetter,
    summary,
    debouncedAmountBN,
  ]);

  const depositCTAString = useMemo(() => {
    if (depositStep === DepositSteps.Approval) {
      return stringGetter({ key: STRING_KEYS.PENDING_TOKEN_APPROVAL });
    }
    if (depositStep === DepositSteps.Confirm) {
      return stringGetter({ key: STRING_KEYS.PENDING_DEPOSIT_CONFIRMATION });
    }
    return hasAcknowledgedTerms
      ? stringGetter({ key: STRING_KEYS.DEPOSIT_FUNDS })
      : stringGetter({ key: STRING_KEYS.ACKNOWLEDGE_TERMS_AND_DEPOSIT });
  }, [depositStep, stringGetter, hasAcknowledgedTerms]);

  const isDisabled =
    Boolean(errorMessage) ||
    !sourceToken ||
    !chainId ||
    debouncedAmountBN.isNaN() ||
    debouncedAmountBN.isZero();

  if (!resources) {
    return <LoadingSpace id="DepositForm" />;
  }
  return (
    <$Form onSubmit={onSubmit}>
      <$Subheader>
        {stringGetter({
          key: STRING_KEYS.LOWEST_FEE_DEPOSITS,
          params: {
            LOWEST_FEE_TOKENS_TOOLTIP: (
              <WithTooltip tooltip="lowest-fees-deposit">
                {stringGetter({
                  key: STRING_KEYS.SELECT_CHAINS,
                })}
              </WithTooltip>
            ),
          },
        })}
      </$Subheader>
      <SourceSelectMenu
        selectedChain={chainIdStr || undefined}
        selectedExchange={exchange || undefined}
        onSelect={onSelectNetwork}
      />
      {exchange && nobleAddress ? (
        <CoinbaseDeposit />
      ) : (
        <>
          <TokenSelectMenu selectedToken={sourceToken || undefined} onSelectToken={onSelectToken} />
          <$WithDetailsReceipt side="bottom" detailItems={amountInputReceipt}>
            <FormInput
              type={InputType.Number}
              onChange={onChangeAmount}
              label={stringGetter({ key: STRING_KEYS.AMOUNT })}
              value={fromAmount}
              slotRight={
                <FormMaxInputToggleButton
                  size={ButtonSize.XSmall}
                  isInputEmpty={fromAmount === ''}
                  isLoading={isLoading}
                  onPressedChange={(isPressed: boolean) =>
                    isPressed ? onClickMax() : setFromAmount('')
                  }
                />
              }
            />
          </$WithDetailsReceipt>
          {errorMessage && <AlertMessage type={AlertType.Error}>{errorMessage}</AlertMessage>}
          {requireUserActionInWallet && (
            <AlertMessage type={AlertType.Warning}>
              {stringGetter({ key: STRING_KEYS.CHECK_WALLET_FOR_REQUEST })}
            </AlertMessage>
          )}
          <$Footer>
            <DepositButtonAndReceipt
              buttonLabel={depositCTAString}
              isDisabled={isDisabled}
              isLoading={isLoading}
              chainId={chainId || undefined}
              setSlippage={onSetSlippage}
              slippage={slippage}
              sourceToken={sourceToken || undefined}
              setRequireUserActionInWallet={setRequireUserActionInWallet}
              setError={setError}
            />
            {!hasAcknowledgedTerms && (
              <$Terms>
                {stringGetter({
                  key: STRING_KEYS.DEPOSIT_ACKNOWLEDGEMENT,
                  params: {
                    TERMS_LINK: (
                      <Link href={`${BASE_ROUTE}${AppRoute.Terms}`} isInline>
                        {stringGetter({ key: STRING_KEYS.TERMS_OF_USE })}
                      </Link>
                    ),
                    POLICY_LINK: (
                      <Link href={`${BASE_ROUTE}${AppRoute.Privacy}`} isInline>
                        {stringGetter({ key: STRING_KEYS.PRIVACY_POLICY })}
                      </Link>
                    ),
                    VIEW_MORE_LINK: (
                      <Link
                        isInline
                        onClick={() => {
                          dispatch(forceOpenDialog(DialogTypes.AcknowledgeTerms()));
                        }}
                      >
                        {stringGetter({ key: STRING_KEYS.VIEW_MORE })} →
                      </Link>
                    ),
                  },
                })}
              </$Terms>
            )}
          </$Footer>
        </>
      )}
    </$Form>
  );
};
const $Form = styled.form`
  ${formMixins.transfersForm}
`;

const $Subheader = styled.div`
  color: var(--color-text-0);
`;

const $Footer = styled.footer`
  ${formMixins.footer}
  --stickyFooterBackdrop-outsetY: var(--dialog-content-paddingBottom);
`;

const $WithDetailsReceipt = styled(WithDetailsReceipt)`
  --withReceipt-backgroundColor: var(--color-layer-2);
`;

const $Terms = styled.div`
  margin-top: 1rem;
  color: var(--color-text-0);
  font: var(--font-small-book);
`;
