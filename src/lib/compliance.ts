import { Secp256k1, sha256 } from '@cosmjs/crypto';

import { Hdkey } from '@/constants/account';
import { BLOCKED_COUNTRIES, CountryCodes, OFAC_SANCTIONED_COUNTRIES } from '@/constants/geo';
import { LOCAL_STORAGE_VERSIONS, LocalStorageKey } from '@/constants/localStorage';
import { DydxAddress } from '@/constants/wallets';

import { getLocalStorage, setLocalStorage } from '@/lib/localStorage';

import { stringifyTransactionError } from './errors';
import { log } from './telemetry';

type KeplrComplianceStorage = {
  version?: string;
  [address: DydxAddress]: {
    pubKey?: string;
    signature?: string;
  };
};

const signComplianceSignature = async (
  message: string,
  action: string,
  status: string,
  hdkey: Hdkey
): Promise<{ signedMessage: string; timestamp: number }> => {
  if (!hdkey.privateKey || !hdkey.publicKey) {
    throw new Error('Missing hdkey');
  }

  const timestampInSeconds = Math.floor(Date.now() / 1000);
  const messageToSign: string = `${message}:${action}"${status || ''}:${timestampInSeconds}`;
  const messageHash = sha256(new Uint8Array(Buffer.from(messageToSign)));

  const signed = await Secp256k1.createSignature(messageHash, hdkey.privateKey);
  const signedMessage = signed.toFixedLength();
  return {
    signedMessage: Buffer.from(signedMessage).toString('base64'),
    timestamp: timestampInSeconds,
  };
};

const signComplianceSignatureKeplr = async (
  message: string,
  signer: DydxAddress,
  chainId: string
): Promise<{ signedMessage: string; pubKey: string }> => {
  if (!window.keplr) {
    throw new Error('Keplr not found');
  }

  const stored = getLocalStorage<KeplrComplianceStorage>({
    key: LocalStorageKey.KeplrCompliance,
  });

  const storedSignature = stored[signer]?.signature;
  const storedPubKey = stored[signer]?.pubKey;

  if (storedPubKey && storedSignature) {
    return {
      signedMessage: storedSignature,
      pubKey: storedPubKey,
    };
  }

  const { pub_key: pubKey, signature } = await window.keplr.signArbitrary(chainId, signer, message);

  setLocalStorage({
    key: LocalStorageKey.KeplrCompliance,
    value: {
      version: LOCAL_STORAGE_VERSIONS[LocalStorageKey.KeplrCompliance],
      [signer]: {
        pubKey: pubKey.value,
        signature,
      },
    },
  });

  return {
    signedMessage: signature,
    pubKey: pubKey.value,
  };
};

export const signCompliancePayload = async (
  address: string,
  params: {
    message: string;
    action: string;
    status: string;
    chainId: string;
  }
): Promise<string> => {
  try {
    const hdkey = hdKeyManager.getHdkey(address);
    if (hdkey?.privateKey && hdkey.publicKey) {
      const { signedMessage, timestamp } = await signComplianceSignature(
        params.message,
        params.action,
        params.status,
        hdkey
      );
      return JSON.stringify({
        signedMessage,
        publicKey: Buffer.from(hdkey.publicKey).toString('base64'),
        timestamp,
      });
    }
    if (window.keplr && params.chainId && address) {
      const { signedMessage, pubKey } = await signComplianceSignatureKeplr(
        params.message,
        address as DydxAddress,
        params.chainId
      );
      return JSON.stringify({
        signedMessage,
        publicKey: pubKey,
        isKeplr: true,
      });
    }
    throw new Error('Missing hdkey');
  } catch (error) {
    log('DydxChainTransactions/signComplianceMessage', error);
    return stringifyTransactionError(error);
  }
};

class HDKeyManager {
  private address: string | undefined;

  private hdkey: Hdkey | undefined;

  setHdkey(address: string | undefined, hdkey: Hdkey) {
    this.address = address;
    this.hdkey = hdkey;
  }

  getHdkey(localWalletAddress: string): Hdkey | undefined {
    if (localWalletAddress !== this.address) {
      return undefined;
    }
    return this.hdkey;
  }

  clearHdkey() {
    this.hdkey = undefined;
    this.address = undefined;
  }
}

export const hdKeyManager = new HDKeyManager();

export const isBlockedGeo = (geo: string): boolean => {
  return [...BLOCKED_COUNTRIES, ...OFAC_SANCTIONED_COUNTRIES].includes(geo as CountryCodes);
};
