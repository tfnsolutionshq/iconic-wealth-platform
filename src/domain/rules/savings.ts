import type { Allocation, Kobo, MonthIndex, SavingsYear, Transaction } from '../entities';
import { naira, formatNaira } from './money';
import { deadlineFor } from './calendar';

/** Admin-configured platform settings (Settings › Platform settings). */
export interface PlatformSettings {
  minimumByYear: Record<number, Kobo>;   // minimum PER PAYMENT
  cutoffMonth: MonthIndex;               // approved after this month → savings start next January (default September)
  lastSavingsMonth: MonthIndex;          // November; December is payout month
  payoutDates: Record<number, string>;   // on or before 14 December
  platformCharge: Kobo;
}
export const DEFAULT_SETTINGS: PlatformSettings = {
  minimumByYear: { 2026: naira(10_000), 2027: naira(10_000) }, cutoffMonth: 8, lastSavingsMonth: 10,
  payoutDates: { 2026: '2026-12-12', 2027: '2027-12-14' }, platformCharge: naira(100),
};
export function minimumFor(s: PlatformSettings, year: number): Kobo {
  return s.minimumByYear[year] ?? s.minimumByYear[Math.max(...Object.keys(s.minimumByYear).map(Number))];
}
/** Mid-year joining: approved after the cut-off month → start the next January; otherwise clear catch-up months. */
export function savingsStartFor(approvedOn: Date, s: PlatformSettings): { year: number; joinMonth: MonthIndex | null } {
  const m = approvedOn.getMonth() as MonthIndex;
  if (m > s.cutoffMonth) return { year: approvedOn.getFullYear() + 1, joinMonth: null };
  return { year: approvedOn.getFullYear(), joinMonth: m === 0 ? null : m };
}

const successful = (txs: Transaction[], year: number) => txs.filter(t => t.kind === 'Contribution' && t.status === 'Successful' && t.year === year);
export const isCatchUp = (y: SavingsYear, i: number) => y.joinMonth != null && i < y.joinMonth;
export function monthTotal(y: SavingsYear, txs: Transaction[], i: number): Kobo {
  return successful(txs, y.year).reduce((sum, t) => sum + t.allocations.filter(a => a.month === i).reduce((x, a) => x + a.amountKobo, 0), 0);
}
export const monthPayments = (y: SavingsYear, txs: Transaction[], i: number) => successful(txs, y.year).filter(t => t.allocations.some(a => a.month === i));
export const savedThisYear = (y: SavingsYear, txs: Transaction[]) => successful(txs, y.year).reduce((s, t) => s + t.amountKobo, 0);

/** A month closes at 23:59 on the 5th of the next month, or when locked. Catch-up months close when they reach the minimum. */
export function isLocked(y: SavingsYear, i: number, now: Date): boolean {
  if (y.locks[i]) return true;
  return !isCatchUp(y, i) && now.getTime() > deadlineFor(y.year, i as MonthIndex).getTime();
}
/** Payments always go to the oldest open month. */
export function openMonth(y: SavingsYear, now: Date, s: PlatformSettings): MonthIndex | null {
  for (let i = y.startMonth; i <= s.lastSavingsMonth; i++) if (!isLocked(y, i, now)) return i as MonthIndex;
  return null;
}
export type MonthState = 'saved' | 'missed' | 'open' | 'ahead' | 'catchup' | 'catchupWaiting' | 'next' | 'upcoming' | 'beforeJoining' | 'payout';
export function monthState(y: SavingsYear, txs: Transaction[], i: number, now: Date, s: PlatformSettings): MonthState {
  if (i > s.lastSavingsMonth) return 'payout';
  if (i < y.startMonth) return 'beforeJoining';
  if (isLocked(y, i, now)) return monthTotal(y, txs, i) >= minimumFor(s, y.year) ? 'saved' : 'missed';
  const cur = openMonth(y, now, s);
  if (i === cur) return isCatchUp(y, i) ? 'catchup' : new Date(y.year, i, 1) > now ? 'ahead' : 'open';
  if (isCatchUp(y, i)) return 'catchupWaiting';
  return new Date(y.year, i, 1) <= now ? 'next' : 'upcoming';
}

export type AllocationPlan = { ok: true; allocations: Allocation[] } | { ok: false; error: string };
/** BR: minimum per payment; oldest open month first; catch-up months take up to the minimum and the rest flows on. */
export function planAllocation(amount: Kobo, y: SavingsYear, txs: Transaction[], now: Date, s: PlatformSettings): AllocationPlan {
  const min = minimumFor(s, y.year);
  if (openMonth(y, now, s) === null) return { ok: false, error: `All ${y.year} savings months are locked.` };
  if (amount < min) return { ok: false, error: `The minimum per payment is ${formatNaira(min)}.` };
  const out: Allocation[] = []; let left = amount;
  for (let i = y.startMonth; i <= s.lastSavingsMonth && left > 0; i++) {
    if (isLocked(y, i, now)) continue;
    if (isCatchUp(y, i)) { const need = Math.max(0, min - monthTotal(y, txs, i)); if (!need) continue; const take = Math.min(left, need); out.push({ month: i as MonthIndex, amountKobo: take }); left -= take; continue; }
    out.push({ month: i as MonthIndex, amountKobo: left }); left = 0;
  }
  if (left > 0) return { ok: false, error: `That’s more than the months left to save in ${y.year}.` };
  return { ok: true, allocations: out };
}
/** Members may lock the open (non catch-up) month early once it has at least the minimum. */
export function canLock(y: SavingsYear, txs: Transaction[], i: number, now: Date, s: PlatformSettings): boolean {
  return i === openMonth(y, now, s) && !isCatchUp(y, i) && monthTotal(y, txs, i) >= minimumFor(s, y.year);
}
/** After a successful payment: catch-up months that reached the minimum close themselves. */
export function autoLocksAfter(y: SavingsYear, txs: Transaction[], s: PlatformSettings, nowIso: string): SavingsYear['locks'] {
  const locks = { ...y.locks }; const min = minimumFor(s, y.year);
  for (let i = 0; i < (y.joinMonth ?? 0); i++) if (!locks[i] && monthTotal(y, txs, i) >= min) locks[i] = { by: 'auto', on: nowIso };
  return locks;
}

/* ---- Monthly Savings Target: optional, never enforced; progress resets each month ---- */
export const targetFor = (y: SavingsYear, i: number): Kobo => y.targets[i] ?? y.target;
export function targetHistory(y: SavingsYear, txs: Transaction[], now: Date, s: PlatformSettings): boolean[] {
  const r: boolean[] = [];
  for (let i = y.startMonth; i <= s.lastSavingsMonth; i++) if (isLocked(y, i, now) && !isCatchUp(y, i) && targetFor(y, i)) r.push(monthTotal(y, txs, i) >= targetFor(y, i));
  return r;
}
export function targetStreak(y: SavingsYear, txs: Transaction[], now: Date, s: PlatformSettings): number {
  const r = targetHistory(y, txs, now, s); let n = 0; for (let k = r.length - 1; k >= 0 && r[k]; k--) n++; return n;
}
export function validateTarget(amount: Kobo, s: PlatformSettings, year: number): string | null {
  const min = minimumFor(s, year); return amount && amount < min ? `Set at least ${formatNaira(min)}.` : null;
}
/** Default rule: a non catch-up month closing with nothing saved affects interest, unless an exception was approved. */
export function interestOnTrack(y: SavingsYear, txs: Transaction[], now: Date, s: PlatformSettings): boolean {
  if (y.interestException) return true;
  for (let i = y.startMonth; i <= s.lastSavingsMonth; i++) if (!isCatchUp(y, i) && monthState(y, txs, i, now, s) === 'missed') return false;
  return true;
}
export const monthsSaved = (y: SavingsYear, txs: Transaction[], s: PlatformSettings) => {
  let n = 0; for (let i = y.startMonth; i <= s.lastSavingsMonth; i++) if (monthTotal(y, txs, i) >= minimumFor(s, y.year)) n++; return n;
};
