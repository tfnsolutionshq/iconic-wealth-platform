import type { MonthIndex } from '../entities';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export const MONTHS_SHORT = MONTHS.map(m => m.slice(0, 3));

export interface TargetPeriod {
  year: number;
  month: number;                       // 1-12
  monthName: (typeof MONTHS)[number];
}

/**
 * The savings month a target set today belongs to. Savings run January to
 * November; December is payout month, so a target set then applies to January
 * of the following year.
 */
export function targetPeriodFor(now: Date): TargetPeriod {
  const calendarMonth = now.getMonth() + 1;
  const inPayoutMonth = calendarMonth > 11;
  const month = inPayoutMonth ? 1 : calendarMonth;
  return {
    year: inPayoutMonth ? now.getFullYear() + 1 : now.getFullYear(),
    month,
    monthName: MONTHS[month - 1],
  };
}

/** BR-06: month M's savings are due by the 5th of month M+1 (end of that day, WAT). */
export function deadlineFor(year: number, month: MonthIndex): Date {
  return new Date(year, month + 1, 5, 23, 59, 59);
}

export function daysUntil(now: Date, date: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

/** BR-07: a payment confirmed after the deadline is late. */
export function isLate(confirmedAt: Date, year: number, month: MonthIndex): boolean {
  return confirmedAt.getTime() > deadlineFor(year, month).getTime();
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function ageOn(dateOfBirth: string, today: Date): number {
  const b = new Date(dateOfBirth);
  let a = today.getFullYear() - b.getFullYear();
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) a--;
  return a;
}
