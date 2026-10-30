import { describe, expect, it } from 'vitest'
import { assertNonNegativeMinor, formatMinor, parseToMinor } from '@/lib/money'

describe('money helpers', () => {
  it('parses decimal strings into minor units without float drift', () => {
    expect(parseToMinor('10.25', 2)).toBe(1025n)
    expect(parseToMinor('0.01', 2)).toBe(1n)
    expect(parseToMinor('100', 2)).toBe(10000n)
  })

  it('rejects excessive precision', () => {
    expect(() => parseToMinor('1.234', 2)).toThrow(/decimal places/)
  })

  it('formats minor units', () => {
    expect(formatMinor(1025, { scale: 2, currency: 'USD', locale: 'en-US' })).toContain('10.25')
  })

  it('asserts non-negative amounts', () => {
    expect(() => assertNonNegativeMinor(-1n)).toThrow()
    expect(() => assertNonNegativeMinor(0n)).not.toThrow()
  })
})
