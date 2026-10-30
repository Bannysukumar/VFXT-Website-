import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { Wallet } from 'ethers';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { DEFAULT_BSC_RPC_URL, USDT_BEP20_ADDRESS } from '../../config/bsc';
import { getHotWalletPoolSettings } from '../platform/store';

const SECRETS_DOC = 'cryptoHotWallet';
const POOL_DOC = 'cryptoHotWalletPool';

export interface HotWalletRecord {
  privateKey: string;
  address: string;
  rpcUrl: string;
  autoWithdraw: boolean;
  updatedAt: Timestamp | FieldValue;
  updatedBy: string;
}

export interface HotWalletPoolEntry {
  id: string;
  label: string;
  privateKey: string;
  address: string;
  rpcUrl: string;
  enabled: boolean;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

function normalizeKey(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
}

function walletFromKey(privateKey: string): Wallet {
  try {
    return new Wallet(normalizeKey(privateKey));
  } catch {
    throw new AppError('invalid-argument', 'Invalid private key');
  }
}

export async function getHotWallet(): Promise<{
  privateKey: string;
  address: string;
  rpcUrl: string;
  autoWithdraw: boolean;
  walletId?: string;
}> {
  const poolSettings = await getHotWalletPoolSettings();
  if (poolSettings.multiWalletEnabled) {
    const picked = await pickRandomEnabledHotWallet();
    if (picked) {
      return {
        privateKey: picked.privateKey,
        address: picked.address,
        rpcUrl: picked.rpcUrl || DEFAULT_BSC_RPC_URL,
        autoWithdraw: true,
        walletId: picked.id,
      };
    }
  }

  const snap = await getDb().collection(Collections.secrets).doc(SECRETS_DOC).get();
  if (!snap.exists) {
    // Fall back to any pool wallet even if multi mode off.
    const any = await pickRandomEnabledHotWallet();
    if (any) {
      return {
        privateKey: any.privateKey,
        address: any.address,
        rpcUrl: any.rpcUrl || DEFAULT_BSC_RPC_URL,
        autoWithdraw: true,
        walletId: any.id,
      };
    }
    throw new AppError(
      'failed-precondition',
      'Crypto hot wallet is not configured. An admin must set the private key first.',
    );
  }
  const data = snap.data() as HotWalletRecord;
  if (!data.privateKey || !data.address) {
    throw new AppError('failed-precondition', 'Crypto hot wallet is incomplete');
  }
  return {
    privateKey: data.privateKey,
    address: data.address,
    rpcUrl: data.rpcUrl || DEFAULT_BSC_RPC_URL,
    autoWithdraw: data.autoWithdraw !== false,
  };
}

/** Prefer a specific wallet (e.g. deposit was assigned to it). */
export async function getHotWalletByAddress(address: string): Promise<{
  privateKey: string;
  address: string;
  rpcUrl: string;
  autoWithdraw: boolean;
} | null> {
  const target = address.toLowerCase();
  const pool = await listHotWalletPool();
  const hit = pool.find((w) => w.address.toLowerCase() === target && w.enabled);
  if (hit) {
    return {
      privateKey: hit.privateKey,
      address: hit.address,
      rpcUrl: hit.rpcUrl || DEFAULT_BSC_RPC_URL,
      autoWithdraw: true,
    };
  }
  const primary = await getDb().collection(Collections.secrets).doc(SECRETS_DOC).get();
  if (primary.exists) {
    const data = primary.data() as HotWalletRecord;
    if (data.address?.toLowerCase() === target && data.privateKey) {
      return {
        privateKey: data.privateKey,
        address: data.address,
        rpcUrl: data.rpcUrl || DEFAULT_BSC_RPC_URL,
        autoWithdraw: data.autoWithdraw !== false,
      };
    }
  }
  return null;
}

export async function getHotWalletPublicInfo(): Promise<{
  configured: boolean;
  address: string | null;
  rpcUrlConfigured: boolean;
  autoWithdraw: boolean;
  network: 'BSC';
  token: 'USDT';
  tokenAddress: string;
  multiWalletEnabled: boolean;
  poolCount: number;
  poolAddresses: string[];
}> {
  const poolSettings = await getHotWalletPoolSettings();
  const pool = await listHotWalletPool();
  const enabled = pool.filter((w) => w.enabled);

  const snap = await getDb().collection(Collections.secrets).doc(SECRETS_DOC).get();
  const primary = snap.exists ? (snap.data() as HotWalletRecord) : null;

  const address =
    poolSettings.multiWalletEnabled && enabled.length > 0
      ? enabled[0]!.address
      : primary?.address ?? enabled[0]?.address ?? null;

  return {
    configured: Boolean(primary?.privateKey || enabled.length > 0),
    address,
    rpcUrlConfigured: Boolean(primary?.rpcUrl || enabled[0]?.rpcUrl),
    autoWithdraw: primary?.autoWithdraw !== false,
    network: 'BSC',
    token: 'USDT',
    tokenAddress: USDT_BEP20_ADDRESS,
    multiWalletEnabled: poolSettings.multiWalletEnabled,
    poolCount: enabled.length,
    poolAddresses: enabled.map((w) => w.address),
  };
}

export async function setHotWallet(input: {
  privateKey: string;
  rpcUrl?: string;
  autoWithdraw?: boolean;
  actorId: string;
}): Promise<{ address: string }> {
  const wallet = walletFromKey(input.privateKey);
  const doc: HotWalletRecord = {
    privateKey: normalizeKey(input.privateKey),
    address: wallet.address,
    rpcUrl: input.rpcUrl?.trim() || DEFAULT_BSC_RPC_URL,
    autoWithdraw: input.autoWithdraw !== false,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: input.actorId,
  };
  await getDb().collection(Collections.secrets).doc(SECRETS_DOC).set(doc, { merge: true });
  return { address: wallet.address };
}

export async function listHotWalletPool(): Promise<HotWalletPoolEntry[]> {
  const snap = await getDb().collection(Collections.secrets).doc(POOL_DOC).get();
  if (!snap.exists) return [];
  const wallets = (snap.data()?.wallets ?? []) as HotWalletPoolEntry[];
  return Array.isArray(wallets) ? wallets : [];
}

export async function addHotWalletToPool(input: {
  privateKey: string;
  label?: string;
  rpcUrl?: string;
  actorId: string;
}): Promise<{ id: string; address: string }> {
  const wallet = walletFromKey(input.privateKey);
  const id = `hw_${wallet.address.slice(2, 10).toLowerCase()}`;
  const entry: HotWalletPoolEntry = {
    id,
    label: input.label?.trim() || `Wallet ${wallet.address.slice(0, 8)}…`,
    privateKey: normalizeKey(input.privateKey),
    address: wallet.address,
    rpcUrl: input.rpcUrl?.trim() || DEFAULT_BSC_RPC_URL,
    enabled: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const ref = getDb().collection(Collections.secrets).doc(POOL_DOC);
  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const wallets = (snap.exists ? (snap.data()?.wallets as HotWalletPoolEntry[]) : []) ?? [];
    if (wallets.some((w) => w.address.toLowerCase() === wallet.address.toLowerCase())) {
      throw new AppError('already-exists', 'This wallet address is already in the pool');
    }
    tx.set(
      ref,
      {
        wallets: [...wallets, entry],
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: input.actorId,
      },
      { merge: true },
    );
  });

  return { id, address: wallet.address };
}

export async function updateHotWalletPoolEntry(input: {
  id: string;
  enabled?: boolean;
  label?: string;
  rpcUrl?: string;
  actorId: string;
}): Promise<void> {
  const ref = getDb().collection(Collections.secrets).doc(POOL_DOC);
  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError('not-found', 'Wallet pool is empty');
    const wallets = [...((snap.data()?.wallets as HotWalletPoolEntry[]) ?? [])];
    const idx = wallets.findIndex((w) => w.id === input.id);
    if (idx < 0) throw new AppError('not-found', 'Pool wallet not found');
    const current = wallets[idx]!;
    wallets[idx] = {
      ...current,
      enabled: input.enabled ?? current.enabled,
      label: input.label?.trim() || current.label,
      rpcUrl: input.rpcUrl?.trim() || current.rpcUrl,
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(
      ref,
      { wallets, updatedAt: FieldValue.serverTimestamp(), updatedBy: input.actorId },
      { merge: true },
    );
  });
}

export async function removeHotWalletFromPool(input: {
  id: string;
  actorId: string;
}): Promise<void> {
  const ref = getDb().collection(Collections.secrets).doc(POOL_DOC);
  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AppError('not-found', 'Wallet pool is empty');
    const wallets = ((snap.data()?.wallets as HotWalletPoolEntry[]) ?? []).filter(
      (w) => w.id !== input.id,
    );
    tx.set(
      ref,
      { wallets, updatedAt: FieldValue.serverTimestamp(), updatedBy: input.actorId },
      { merge: true },
    );
  });
}

async function pickRandomEnabledHotWallet(): Promise<HotWalletPoolEntry | null> {
  const enabled = (await listHotWalletPool()).filter((w) => w.enabled && w.privateKey);
  if (enabled.length === 0) return null;
  const idx = Math.floor(Math.random() * enabled.length);
  return enabled[idx] ?? null;
}

/** Assign a deposit receiving wallet (random from pool when multi mode on). */
export async function pickDepositHotWallet(): Promise<{
  privateKey: string;
  address: string;
  rpcUrl: string;
  walletId?: string;
}> {
  return getHotWallet();
}
