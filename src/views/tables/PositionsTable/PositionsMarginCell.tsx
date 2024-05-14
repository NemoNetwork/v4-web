import { useMemo } from 'react';

import { useDispatch } from 'react-redux';
import styled, { AnyStyledComponent } from 'styled-components';

import { type SubaccountPosition } from '@/constants/abacus';
import { ButtonShape } from '@/constants/buttons';
import { DialogTypes } from '@/constants/dialogs';
import { STRING_KEYS } from '@/constants/localization';

import { useStringGetter } from '@/hooks';

import { IconName } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Output, OutputType, ShowSign } from '@/components/Output';
import { TableCell } from '@/components/Table/TableCell';

import { openDialog } from '@/state/dialogs';

import { getPositionMargin } from '@/lib/tradeData';

type PositionsMarginCellProps = { position: SubaccountPosition };

export const PositionsMarginCell = ({ position }: PositionsMarginCellProps) => {
  const stringGetter = useStringGetter();
  const dispatch = useDispatch();

  const { marginMode, marginModeLabel, margin } = useMemo(() => {
    const { childSubaccountNumber } = position;
    const marginMode = childSubaccountNumber && childSubaccountNumber >= 128 ? 'ISOLATED' : 'CROSS';

    const marginModeLabel =
      marginMode === 'CROSS'
        ? stringGetter({ key: STRING_KEYS.CROSS })
        : stringGetter({ key: STRING_KEYS.ISOLATED });

    const margin = getPositionMargin({ position });

    return {
      marginMode,
      marginModeLabel,
      margin,
    };
  }, [position]);

  return (
    <TableCell
      stacked
      slotRight={
        marginMode === 'ISOLATED' && (
          <Styled.EditButton
            key="edit-margin"
            iconName={IconName.Pencil}
            shape={ButtonShape.Square}
            onClick={() =>
              dispatch(
                openDialog({
                  type: DialogTypes.AdjustIsolatedMargin,
                  dialogProps: { positionId: position.id },
                })
              )
            }
          />
        )
      }
    >
      <Output type={OutputType.Fiat} value={margin} showSign={ShowSign.None} />
      <span>{marginModeLabel}</span>
    </TableCell>
  );
};

const Styled: Record<string, AnyStyledComponent> = {};

Styled.EditButton = styled(IconButton)`
  --button-icon-size: 1.5em;
  --button-padding: 0;
  --button-textColor: var(--color-text-0);
  --button-hover-textColor: var(--color-text-1);

  margin-left: 0.5rem;
`;
