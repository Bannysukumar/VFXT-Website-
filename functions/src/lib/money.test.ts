import { describe, expect, it } from 'vitest';
import {
  addMinor,
  assertPositiveMinor,
  formatMinor,
  parseAmountToMinor,
  subMinor,
} from './money';
import { AppError } from './errors';

describe('parseAmountToMinor', () => {
  it('parses whole dollars to cents', () => {
    expect(parseAmountToMinor('100', 2)).toBe(10000);
    expect(parseAmountToMinor('0.01', 2)).toBe(1);
    expect(parseAmountToMinor('12.34', 2)).toBe(1234);
  });

  it('parses VFXT-style 8 decimals', () => {
    expect(parseAmountToMinor('1.5', 8)).toBe(150000000);
    expect(parseAmountToMinor('0.00000001', 8)).toBe(1);
  });

  it('rejects floats with excess precision', () => {
    expect(() => parseAmountToMinor('1.234', 2)).toThrow(AppError);
  });

  it('rejects scientific notation and non-numeric', () => {
    expect(() => parseAmountToMinor('1e2', 2)).toThrow(AppError);
    expect(() => parseAmountToMinor('abc', 2)).toThrow(AppError);
    expect(() => parseAmountToMinor('', 2)).toThrow(AppError);
  });

  it('accepts number inputs as stringified decimals', () => {
    expect(parseAmountToMinor(10, 2)).toBe(1000);
  });
});

describe('formatMinor', () => {
  it('formats cents without float math', () => {
    expect(formatMinor(10000, 2)).toBe('100.00');
    expect(formatMinor(1, 2)).toBe('0.01');
    expect(formatMinor(0, 2)).toBe('0.00');
    expect(formatMinor(-50, 2)).toBe('-0.50');
  });

  it('formats zero-decimal currencies', () => {
    expect(formatMinor(42, 0)).toBe('42');
  });
});

describe('assertPositiveMinor', () => {
  it('accepts positive integers', () => {
    expect(() => assertPositiveMinor(1)).not.toThrow();
  });

  it('rejects zero, negative, and non-integers', () => {
    expect(() => assertPositiveMinor(0)).toThrow(AppError);
    expect(() => assertPositiveMinor(-1)).toThrow(AppError);
    expect(() => assertPositiveMinor(1.5)).toThrow(AppError);
  });
});

describe('addMinor / subMinor', () => {
  it('adds and subtracts safely', () => {
    expect(addMinor(100, 50)).toBe(150);
    expect(subMinor(100, 40)).toBe(60);
  });
});
