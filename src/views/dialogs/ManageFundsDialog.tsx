import { shallowEqual } from 'react-redux';
import styled from 'styled-components';

import { TransferInputField, TransferType } from '@/constants/abacus';
import { ButtonSize } from '@/constants/buttons';
import { DialogProps, ManageFundsDialogProps } from '@/constants/dialogs';
import { STRING_KEYS } from '@/constants/localization';

import { useStringGetter } from '@/hooks/useStringGetter';

import { Dialog, DialogPlacement } from '@/components/Dialog';
import { ToggleGroup } from '@/components/ToggleGroup';
import { WithdrawForm } from '@/views/forms/AccountManagementForms/WithdrawForm';
import { TransferForm } from '@/views/forms/TransferForm';

import { useAppSelector } from '@/state/appTypes';
import { getTransferInputs } from '@/state/inputsSelectors';

import abacusStateManager from '@/lib/abacus';

import { DepositDialogContent } from './DepositDialog/DepositDialogContent';

export const ManageFundsDialog = ({
  setIsOpen,
  selectedTransferType,
}: DialogProps<ManageFundsDialogProps>) => {
  const stringGetter = useStringGetter();
  const { type } = useAppSelector(getTransferInputs, shallowEqual) ?? {};
  const currentType = type?.rawValue ?? selectedTransferType ?? TransferType.deposit.rawValue;

  const closeDialog = () => setIsOpen(false);

  const transferTypeConfig = {
    [TransferType.deposit.rawValue]: {
      value: TransferType.deposit.rawValue,
      label: stringGetter({ key: STRING_KEYS.DEPOSIT }),
      component: <DepositDialogContent />,
    },
    [TransferType.withdrawal.rawValue]: {
      value: TransferType.withdrawal.rawValue,
      label: stringGetter({ key: STRING_KEYS.WITHDRAW }),
      component: <WithdrawForm />,
    },
    [TransferType.transferOut.rawValue]: {
      value: TransferType.transferOut.rawValue,
      label: stringGetter({ key: STRING_KEYS.TRANSFER }),
      component: <TransferForm onDone={closeDialog} />,
    },
  };

  return (
    <Dialog
      isOpen
      setIsOpen={setIsOpen}
      placement={DialogPlacement.FullScreen}
      title={
        <$ToggleGroup
          items={Object.values(transferTypeConfig)}
          value={currentType}
          size={ButtonSize.Medium}
          onValueChange={(value: string) =>
            abacusStateManager.setTransferValue({
              field: TransferInputField.type,
              value,
            })
          }
        />
      }
      hasHeaderBorder
      tw="[--dialog-content-paddingTop:1.5rem]"
    >
      {transferTypeConfig[currentType]?.component}
    </Dialog>
  );
};
const $ToggleGroup = styled(ToggleGroup)`
  overflow-x: auto;

  button {
    --button-toggle-off-border: none;
    --button-padding: 0 1rem;
  }
`;
