import { describe, expect, it } from 'vitest';
import {
  dateOnlySchema,
  parseDateOnly,
  toDateOnly,
  todayDateOnly,
  utcMidnightOfLocalDay,
} from './date-only.dto.js';

describe('date-only helpers', () => {
  it('keeps the requested calendar day for date-picker input', () => {
    expect(toDateOnly('2026-03-01').toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(toDateOnly(' 2026-03-01 ').toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('never shifts a day for local instants', () => {
    // 28 Oct 23:59 server-local — a naive `setHours(0, 0, 0, 0)` stores 27 Oct
    // on any timezone east of UTC (the API runs in Asia/Tehran).
    const lateNight = new Date(2026, 9, 28, 23, 59, 59);
    const day = toDateOnly(lateNight);

    expect(day.getUTCHours()).toBe(0);
    expect(day.getUTCFullYear()).toBe(2026);
    expect(day.getUTCMonth()).toBe(9);
    expect(day.getUTCDate()).toBe(28);
    expect(day.getTime()).toBe(utcMidnightOfLocalDay(lateNight).getTime());
  });

  it('normalises an instant to its UTC calendar day', () => {
    expect(toDateOnly(new Date('2026-10-30T00:00:00.000Z')).getTime()).toBe(
      Date.UTC(2026, 9, 30),
    );
  });

  it('rejects impossible and malformed days', () => {
    expect(parseDateOnly('2026-02-31')).toBeNull();
    expect(parseDateOnly('2026-13-01')).toBeNull();
    expect(parseDateOnly('not-a-date')).toBeNull();
    expect(parseDateOnly('')).toBeNull();
    expect(() => toDateOnly('nonsense')).toThrow(RangeError);
  });

  it('returns today as UTC midnight of the local day', () => {
    const now = new Date(2026, 0, 5, 8, 30);
    const today = todayDateOnly(now);

    expect(today.getUTCHours()).toBe(0);
    expect(today.getUTCDate()).toBe(5);
    expect(today.getUTCMonth()).toBe(0);
    expect(today.getUTCFullYear()).toBe(2026);
  });

  it('exposes a zod schema that accepts strings and dates', () => {
    expect(dateOnlySchema.parse('2026-10-30').toISOString()).toBe('2026-10-30T00:00:00.000Z');
    expect(dateOnlySchema.parse(new Date(2026, 9, 30, 12)).getUTCDate()).toBe(30);

    const invalid = dateOnlySchema.safeParse('2026-99-99');
    expect(invalid.success).toBe(false);
    expect(invalid.error?.issues[0]?.message).toBe('تاریخ نامعتبر است');
  });
});
