import { describe, expect, it } from 'vitest';
import { chargeBreakdown, naira, validateDetails, isStrongPassword, deadlineFor, DEFAULT_SETTINGS as S, planAllocation, openMonth, monthState, canLock, autoLocksAfter, targetStreak, savingsStartFor, interestOnTrack } from './index';
import type { SavingsYear, Transaction } from '../entities';

const tx = (month: number, amount: number, i = 0): Transaction => ({ id: 'T' + month + i, reference: 'R' + month + i, memberId: 'M', memberName: 'M', kind: 'Contribution', year: 2026,
  allocations: [{ month: month as never, amountKobo: naira(amount) }], amountKobo: naira(amount), platformChargeKobo: naira(100), status: 'Successful', late: false, createdAt: '' });
const year = (over: Partial<SavingsYear> = {}): SavingsYear => ({ memberId: 'M', year: 2026, startMonth: 0, joinMonth: null, target: naira(25_000), targets: {}, locks: {}, ...over });
const oct2 = new Date(2026, 9, 2, 9);
const funmi = [tx(0, 20_000), tx(1, 25_000), tx(2, 20_000), tx(2, 10_000, 1), tx(3, 25_000), tx(4, 30_000), tx(5, 35_000), tx(6, 25_000), tx(7, 30_000), tx(8, 15_000)];

describe('charges', () => {
  it('flat ₦100 platform charge on every payment', () => expect(chargeBreakdown(naira(25_000))).toEqual({ amount: naira(25_000), platformCharge: naira(100), total: naira(25_100) }));
});

describe('savings months and allocation', () => {
  it('September is still open on 2 October (closes end of 5 Oct)', () => expect(openMonth(year(), oct2, S)).toBe(8));
  it('August closed automatically after 5 September', () => expect(monthState(year(), funmi, 7, oct2, S)).toBe('saved'));
  it('December is payout month', () => expect(monthState(year(), funmi, 11, oct2, S)).toBe('payout'));
  it('minimum ₦10,000 per payment', () => expect(planAllocation(naira(9_000), year(), funmi, oct2, S).ok).toBe(false));
  it('payment goes to the oldest open month', () => { const p = planAllocation(naira(10_000), year(), funmi, oct2, S); expect(p.ok && p.allocations).toEqual([{ month: 8, amountKobo: naira(10_000) }]); });
  it('locking September moves payments to October', () => { const p = planAllocation(naira(10_000), year({ locks: { 8: { by: 'member', on: '' } } }), funmi, oct2, S); expect(p.ok && p.allocations[0].month).toBe(9); });
  it('lock needs at least the minimum', () => { expect(canLock(year(), funmi, 8, oct2, S)).toBe(true); expect(canLock(year(), funmi.slice(0, 9), 8, oct2, S)).toBe(false); });
  it('nothing after November', () => { const locks = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i, { by: 'member' as const, on: '' }])); expect(planAllocation(naira(10_000), year({ locks }), funmi, oct2, S).ok).toBe(false); });
  it('a month closed with nothing saved is missed and affects interest', () => { const y = year(); const t = funmi.filter(x => x.allocations[0].month !== 6); expect(monthState(y, t, 6, oct2, S)).toBe('missed'); expect(interestOnTrack(y, t, oct2, S)).toBe(false); });
});

describe('mid-year joiners', () => {
  const y = year({ joinMonth: 8 });
  it('approved in September clears catch-up; approved in October starts next January', () => {
    expect(savingsStartFor(new Date(2026, 8, 28), S)).toEqual({ year: 2026, joinMonth: 8 }); expect(savingsStartFor(new Date(2026, 9, 2), S)).toEqual({ year: 2027, joinMonth: null });
  });
  it('catch-up months take the minimum each and the rest flows to the current month', () => {
    const p = planAllocation(naira(95_000), y, [], oct2, S); expect(p.ok && p.allocations.length).toBe(9); expect(p.ok && p.allocations[8]).toEqual({ month: 8, amountKobo: naira(15_000) });
  });
  it('catch-up months close themselves at the minimum', () => expect(Object.keys(autoLocksAfter(y, [tx(0, 10_000)], S, 'now'))).toEqual(['0']));
});

describe('monthly target', () => {
  it('7-month streak (Feb–Aug met, Jan missed target)', () => expect(targetStreak(year(), funmi, oct2, S)).toBe(7));
});

describe('deadlines and registration', () => {
  it('September closes 5 October', () => expect(deadlineFor(2026, 8).toDateString()).toBe(new Date(2026, 9, 5).toDateString()));
  const ok = { firstName: 'Ada', lastName: 'O', dateOfBirth: '1990-01-01', email: 'a@b.co', phone: '08031112222', stateOfResidence: 'Lagos', address: '7 Bode Thomas St', heardAboutUs: 'Advert', referredBy: '' };
  it('accepts valid details', () => expect(validateDetails(ok, oct2)).toEqual({}));
  it('rejects under 18', () => expect(validateDetails({ ...ok, dateOfBirth: '2012-01-01' }, oct2).dateOfBirth).toBeTruthy());
  it('password rules', () => { expect(isStrongPassword('weakpass')).toBe(false); expect(isStrongPassword('Savings2027')).toBe(true); });
});
