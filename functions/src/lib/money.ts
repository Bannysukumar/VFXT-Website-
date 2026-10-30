import { AppError } from './errors';

/**
 * Money helpers — ALL monetary values are stored as integer minor units
 * (e.g. cents for USD, 10^-decimals for crypto display). NEVER use float.
 */

const MAX_SAFE_MINOR = Number.MAX_SAFE_INTEGER;

function assertSafeInteger(n: number, label: string): asserts n is number {
  if (!Number.isInteger(n) || !Number.isSafeInteger(n)) {
    throw new AppError(
      'invalid-argument',
      `${label} must be a safe integer (got ${String(n)})`,
    );
  }
}

/**
 * Parse a human amount string/number into integer minor units.
 * Rejects scientific notation, NaN, Infinity, and non-finite values.
 */
export function parseAmountToMinor(
  amount: string | number,
  decimals = 2,
): number {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new AppError('invalid-argument', 'decimals must be 0–18');
  }

  const raw = typeof amount === 'number' ? String(amount) : amount.trim();
  if (!raw || /[eE]/.test(raw)) {
    throw new AppError('invalid-argument', 'Invalid amount format');
  }

  const sign = raw.startsWith('-') ? -1 : 1;
  const unsigned = raw.replace(/^[+-]/, '');
  if (!/^\d+(\.\d+)?$/.test(unsigned)) {
    throw new AppError('invalid-argument', 'Invalid amount format');
  }

  const [wholePart = '0', fracPart = ''] = unsigned.split('.');
  if (fracPart.length > decimals) {
    throw new AppError(
      'invalid-argument',
      `Amount has more than ${decimals} decimal places`,
    );
  }

  const paddedFrac = fracPart.padEnd(decimals, '0');
  const combined = `${wholePart}${paddedFrac}`.replace(/^0+(?=\d)/, '') || '0';
  const minor = sign * Number(combined);

  assertSafeInteger(minor, 'amountMinor');
  return minor;
}

/** Format integer minor units as a fixed-decimal string (no float math). */
export function formatMinor(minor: number, decimals = 2): string {
  assertSafeInteger(minor, 'minor');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new AppError('invalid-argument', 'decimals must be 0–18');
  }

  const negative = minor < 0;
  const abs = Math.abs(minor).toString().padStart(decimals + 1, '0');
  const whole = decimals === 0 ? abs : abs.slice(0, -decimals) || '0';
  const frac = decimals === 0 ? '' : abs.slice(-decimals);
  const body = decimals === 0 ? whole : `${whole}.${frac}`;
  return negative ? `-${body}` : body;
}

export function assertPositiveMinor(minor: number): void {
  assertSafeInteger(minor, 'amountMinor');
  if (minor <= 0) {
    throw new AppError('invalid-argument', 'Amount must be a positive integer');
  }
  if (minor > MAX_SAFE_MINOR) {
    throw new AppError('invalid-argument', 'Amount exceeds safe integer range');
  }
}

export function assertNonNegativeMinor(minor: number): void {
  assertSafeInteger(minor, 'amountMinor');
  if (minor < 0) {
    throw new AppError('invalid-argument', 'Amount must be non-negative');
  }
}

/** Safe integer addition with overflow check. */
export function addMinor(a: number, b: number): number {
  assertSafeInteger(a, 'a');
  assertSafeInteger(b, 'b');
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) {
    throw new AppError('failed-precondition', 'Balance overflow');
  }
  return sum;
}

/** Safe integer subtraction with underflow check (result may be negative). */
export function subMinor(a: number, b: number): number {
  assertSafeInteger(a, 'a');
  assertSafeInteger(b, 'b');
  const diff = a - b;
  if (!Number.isSafeInteger(diff)) {
    throw new AppError('failed-precondition', 'Balance underflow');
  }
  return diff;
}
