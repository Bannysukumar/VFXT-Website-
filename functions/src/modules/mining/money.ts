import { AppError } from '../../lib/errors';

/** VFXT mining ledger uses 18-decimal minor units as decimal strings (BigInt only). */
export const MINING_DECIMALS = 18;

const AMOUNT_RE = /^\d+(\.\d+)?$/;

export function parseToMinor(amount: string, decimals = MINING_DECIMALS): bigint {
  const raw = amount.trim();
  if (!raw || /[eE-]/.test(raw) || raw.startsWith('-')) {
    throw new AppError('invalid-argument', 'Invalid amount');
  }
  if (!AMOUNT_RE.test(raw)) {
    throw new AppError('invalid-argument', 'Invalid amount format');
  }
  const [whole = '0', frac = ''] = raw.split('.');
  if (frac.length > decimals) {
    throw new AppError('invalid-argument', `More than ${decimals} decimal places`);
  }
  const combined = `${whole}${frac.padEnd(decimals, '0')}`.replace(/^0+(?=\d)/, '') || '0';
  return BigInt(combined);
}

export function formatMinor(minor: bigint, decimals = MINING_DECIMALS): string {
  const negative = minor < 0n;
  const abs = (negative ? -minor : minor).toString().padStart(decimals + 1, '0');
  const whole = abs.slice(0, -decimals) || '0';
  const frac = abs.slice(-decimals);
  const body = `${whole}.${frac}`;
  return negative ? `-${body}` : body;
}

/** Reward = ratePerHour × elapsedSeconds / 3600 (integer floor division). */
export function rewardForElapsed(ratePerHourMinor: bigint, elapsedSeconds: bigint): bigint {
  if (ratePerHourMinor < 0n || elapsedSeconds < 0n) {
    throw new AppError('invalid-argument', 'Negative values are not allowed');
  }
  return (ratePerHourMinor * elapsedSeconds) / 3600n;
}

export function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function toMinorString(minor: bigint): string {
  return minor.toString();
}

export function fromMinorString(raw: string | number | undefined | null): bigint {
  if (raw === undefined || raw === null || raw === '') return 0n;
  const s = String(raw).trim();
  if (!/^-?\d+$/.test(s)) {
    throw new AppError('failed-precondition', 'Corrupt minor-unit value in ledger');
  }
  return BigInt(s);
}
