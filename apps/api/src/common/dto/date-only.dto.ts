import { z } from 'zod';

/**
 * Calendar-day helpers for PostgreSQL `date` columns (Prisma `@db.Date`).
 *
 * Prisma persists a JS `Date` into a `date` column using its **UTC** calendar
 * day, so a local-midnight value is stored one day earlier whenever the server
 * runs east of UTC. The API runs in `Asia/Tehran` (UTC+03:30), which means
 * `new Date(2026, 9, 28)` (28 Oct 00:00 local) was written as `2026-10-27`.
 *
 * Always build `@db.Date` values with the helpers below: they normalise any
 * input — a `YYYY-MM-DD` string from a date picker, or an instant — to UTC
 * midnight of the intended calendar day, so a day means the same thing in the
 * API, the database and the UI regardless of the server timezone.
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC midnight for the calendar day carried by `value`, or `null` if invalid. */
export function parseDateOnly(value: string | Date): Date | null {
  if (typeof value === 'string') {
    const match = DATE_ONLY_PATTERN.exec(value.trim());
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      // `Date.UTC` rolls invalid components over (2026-02-31 → 2026-03-03).
      const exact =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;
      return exact ? date : null;
    }
  }

  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return utcMidnightOfLocalDay(instant);
}

/** Same as {@link parseDateOnly} but throws when the input is not a date. */
export function toDateOnly(value: string | Date): Date {
  const date = parseDateOnly(value);
  if (!date) throw new RangeError(`تاریخ نامعتبر است: ${String(value)}`);
  return date;
}

/** UTC midnight of the server-local calendar day the instant falls on. */
export function utcMidnightOfLocalDay(instant: Date): Date {
  return new Date(Date.UTC(instant.getFullYear(), instant.getMonth(), instant.getDate()));
}

/** Today (server-local calendar day) as a UTC-midnight `Date`. */
export function todayDateOnly(now: Date = new Date()): Date {
  return utcMidnightOfLocalDay(now);
}

/**
 * Zod schema for `@db.Date` inputs: accepts a calendar day (`YYYY-MM-DD`) or an
 * instant and always yields UTC midnight of that day.
 */
export const dateOnlySchema = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    const date = parseDateOnly(value);
    if (!date) {
      ctx.addIssue({ code: 'custom', message: 'تاریخ نامعتبر است' });
      return z.NEVER;
    }
    return date;
  });
