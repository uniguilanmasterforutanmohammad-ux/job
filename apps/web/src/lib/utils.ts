import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats numbers with Persian digits and thousands separators. */
export function formatToman(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString('fa-IR')} تومان`;
}

export function formatNumber(value: number | string | null | undefined): string {
  return Number(value ?? 0).toLocaleString('fa-IR');
}

/** Gregorian ISO -> Jalali display string (fa-IR-u-ca-persian). */
export function formatJalali(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const options: Intl.DateTimeFormatOptions = {
    calendar: 'persian',
    numberingSystem: 'arabext',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  };
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', options).format(date);
}
