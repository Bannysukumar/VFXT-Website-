/**
 * Client-side display helpers for integer minor units.
 * The server remains the authority for balances and calculations.
 */

const DEFAULT_SCALE = 2

export function formatMinor(
  amountMinor: number | bigint,
  options?: {
    scale?: number
    currency?: string
    locale?: string
  },
): string {
  const scale = options?.scale ?? DEFAULT_SCALE
  const locale = options?.locale ?? 'en-US'
  const value = Number(amountMinor) / 10 ** scale

  if (options?.currency) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: options.currency,
      minimumFractionDigits: scale,
      maximumFractionDigits: scale,
    }).format(value)
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  }).format(value)
}

/** Parse a decimal string into integer minor units without floating-point math. */
export function parseToMinor(input: string, scale = DEFAULT_SCALE): bigint {
  const trimmed = input.trim()
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Invalid amount')
  }

  const negative = trimmed.startsWith('-')
  const raw = negative ? trimmed.slice(1) : trimmed
  const [wholePart, fractionPart = ''] = raw.split('.')

  if (fractionPart.length > scale) {
    throw new Error(`Amount supports at most ${scale} decimal places`)
  }

  const paddedFraction = fractionPart.padEnd(scale, '0')
  const minor = BigInt(wholePart + paddedFraction)
  return negative ? -minor : minor
}

export function assertNonNegativeMinor(amountMinor: bigint | number): void {
  if (BigInt(amountMinor) < 0n) {
    throw new Error('Amount must be non-negative')
  }
}
