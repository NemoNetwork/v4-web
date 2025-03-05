/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { HeightResponse } from '@dydxprotocol/v4-client-js';

import { HeightState } from '@/state/raw';

import { assertNever } from '@/lib/assertNever';

import { isLoadableError, isLoadableSuccess } from '../lib/loadable';
import { logBonsaiInfo } from '../logs';
import { ApiState, ApiStatus } from '../types/summaryTypes';

enum NetworkStatus {
  UNKNOWN = 'UNKNOWN',
  UNREACHABLE = 'UNREACHABLE',
  HALTED = 'HALTED',
  NORMAL = 'NORMAL',
}

const MAX_NUM_BLOCK_DELAY = 25;

function computeNetworkState(heightState: HeightState): NetworkStatus {
  // If no last few results, we're unknown
  if (heightState.lastFewResults.length === 0) {
    return NetworkStatus.UNKNOWN;
  }

  // all errors or at least 3 errors in a row
  if (heightState.lastFewResults.slice(0, 3).every(isLoadableError)) {
    return NetworkStatus.UNREACHABLE;
  }

  // guaranteed this has >=1 element
  const successResults = heightState.lastFewResults.filter(isLoadableSuccess);

  // Check for same block height
  if (successResults.length >= 6) {
    const firstHeight = successResults[0]!.data.height;
    const allSameHeight = successResults
      .slice(0, 6)
      .every((result) => result.data.height === firstHeight);

    if (allSameHeight) {
      return NetworkStatus.HALTED;
    }
  }

  // we have at least one success, we're normal
  return NetworkStatus.NORMAL;
}

type ApiStateInner = Pick<ApiState, 'status' | 'haltedBlock' | 'trailingBlocks'>;

function maybeTrailingInNormalState({
  indexerHeight,
  validatorHeight,
}: {
  indexerHeight: HeightResponse | undefined;
  validatorHeight: HeightResponse | undefined;
}): ApiStateInner {
  if (indexerHeight && validatorHeight) {
    const blockDiff = validatorHeight.height - indexerHeight.height;
    if (blockDiff > MAX_NUM_BLOCK_DELAY) {
      return { status: ApiStatus.INDEXER_TRAILING, trailingBlocks: blockDiff };
    }
  }
  return { status: ApiStatus.NORMAL };
}

// eslint-disable-next-line consistent-return
function getApiState({
  indexerHeight,
  indexerState,
  validatorHeight,
  validatorState,
}: {
  validatorState: NetworkStatus;
  indexerState: NetworkStatus;
  indexerHeight: HeightResponse | undefined;
  validatorHeight: HeightResponse | undefined;
}): ApiStateInner {
  if (validatorState === NetworkStatus.NORMAL) {
    if (indexerState === NetworkStatus.NORMAL || indexerState === NetworkStatus.UNKNOWN) {
      return maybeTrailingInNormalState({ indexerHeight, validatorHeight });
    }
    if (indexerState === NetworkStatus.UNREACHABLE) {
      return { status: ApiStatus.INDEXER_DOWN };
    }
    if (indexerState === NetworkStatus.HALTED) {
      return {
        status: ApiStatus.INDEXER_HALTED,
        haltedBlock: indexerHeight?.height,
      };
    }
    assertNever(indexerState);
  }

  if (validatorState === NetworkStatus.UNKNOWN) {
    if (indexerState === NetworkStatus.NORMAL) {
      return maybeTrailingInNormalState({ indexerHeight, validatorHeight });
    }
    if (indexerState === NetworkStatus.UNKNOWN) {
      return { status: ApiStatus.UNKNOWN };
    }
    if (indexerState === NetworkStatus.UNREACHABLE) {
      return { status: ApiStatus.INDEXER_DOWN };
    }
    if (indexerState === NetworkStatus.HALTED) {
      return {
        status: ApiStatus.INDEXER_HALTED,
        haltedBlock: indexerHeight?.height,
      };
    }
    assertNever(indexerState);
  }

  if (validatorState === NetworkStatus.UNREACHABLE) {
    return { status: ApiStatus.VALIDATOR_DOWN };
  }

  if (validatorState === NetworkStatus.HALTED) {
    return {
      status: ApiStatus.VALIDATOR_HALTED,
      haltedBlock: validatorHeight?.height,
    };
  }

  assertNever(validatorState);
}

export function getLatestHeight(heightState: HeightState): HeightResponse | undefined {
  return heightState.lastFewResults.find((s) => s.data != null)?.data;
}

export function computeApiState(heights: {
  indexerHeight: HeightState;
  validatorHeight: HeightState;
}): ApiState | undefined {
  if (loadingWithNoData(heights.indexerHeight) || loadingWithNoData(heights.validatorHeight)) {
    return undefined;
  }
  const indexerState = computeNetworkState(heights.indexerHeight);
  const validatorState = computeNetworkState(heights.validatorHeight);

  const indexerHeight = getLatestHeight(heights.indexerHeight);
  const validatorHeight = getLatestHeight(heights.validatorHeight);

  const { status, haltedBlock, trailingBlocks } = getApiState({
    indexerHeight,
    indexerState,
    validatorHeight,
    validatorState,
  });

  const result = {
    status,
    haltedBlock,
    trailingBlocks,
    indexerHeight: indexerHeight?.height,
    validatorHeight: validatorHeight?.height,
  };
  if (result.status !== ApiStatus.NORMAL) {
    logBonsaiInfo('ComputeApiStatus', 'Computed non-normal status', {
      ...result,
      rawHeights: heights,
    });
  }
  return result;
}

function loadingWithNoData(height: HeightState) {
  return (
    height.latest.data == null &&
    (height.latest.status === 'pending' || height.latest.status === 'idle')
  );
}
