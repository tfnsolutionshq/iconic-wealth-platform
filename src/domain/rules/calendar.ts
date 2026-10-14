import type { MonthIndex } from '../entities';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export const MONTHS_SHORT = MONTHS.map(m => m.slice(0, 3));

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
