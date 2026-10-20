import { describe, expect, it } from 'vitest';
import { naira } from '@/domain/rules';
import { fixedClock } from '@/domain/services/clock';
import { MockWalletRepository } from './index';

const wallet = new MockWalletRepository(fixedClock('2026-10-02T09:40:00'));

describe('MockWalletRepository snapshot', () => {
  it('derives the demo member balances from seeded entries', async () => {
    const s = await wallet.getSnapshot('IWH-00412');
    expect(s.availableKobo).toBe(naira(35_000));      // ₦30k + ₦25k − ₦15k, minus the ₦5k in flight
    expect(s.pendingDepositKobo).toBe(0);
    expect(s.pendingWithdrawalKobo).toBe(naira(5_000));
    expect(s.entries.length).toBeGreaterThanOrEqual(5);
    expect(s.withdrawals.some(w => w.status === 'Processing')).toBe(true);
    expect(s.entries[0].createdAt >= s.entries[s.entries.length - 1].createdAt).toBe(true);
  });
  it('returns an empty wallet for a member who never funded one', async () => {
    const s = await wallet.getSnapshot('IWH-01250');
    expect(s.availableKobo).toBe(0);
    expect(s.entries).toHaveLength(0);
    expect(s.withdrawals).toHaveLength(0);
  });
  it('rejects unknown members', async () => await expect(wallet.getSnapshot('IWH-99999')).rejects.toThrow());
});

describe('MockWalletRepository top-ups', () => {
  it('rejects non-positive amounts', async () => {
    await expect(wallet.requestTopUp('IWH-00412', 0)).rejects.toThrow();
  });
  it('creates a pending credit that counts as a pending deposit', async () => {
    const entry = await wallet.requestTopUp('IWH-01244', naira(7_000));
    expect(entry.status).toBe('Pending');
    expect(entry.direction).toBe('Credit');
    expect(entry.reference).toMatch(/^IWH-W-/);
    const s = await wallet.getSnapshot('IWH-01244');
    expect(s.pendingDepositKobo).toBe(naira(7_000));
    expect(s.availableKobo).toBe(0);
  });
});

describe('MockWalletRepository withdrawals', () => {
  it('requires a payout account', async () => {
    await expect(wallet.requestWithdrawal('IWH-01250', naira(1_000))).rejects.toThrow(/payout account/i);
  });
  it('rejects amounts above the available balance', async () => {
    await expect(wallet.requestWithdrawal('IWH-00412', naira(999_000))).rejects.toThrow(/available balance/i);
  });
  it('reserves the amount and targets the verified payout account', async () => {
    const before = await wallet.getSnapshot('IWH-00412');
    const w = await wallet.requestWithdrawal('IWH-00412', naira(10_000));
    expect(w.status).toBe('Processing');
    expect(w.bankName).toBe('GTBank');
    expect(w.accountNumber).toBe('0123456789');
    const after = await wallet.getSnapshot('IWH-00412');
    expect(after.availableKobo).toBe(before.availableKobo - naira(10_000));
    expect(after.pendingWithdrawalKobo).toBe(before.pendingWithdrawalKobo + naira(10_000));
    expect(after.entries.some(e => e.reference === w.reference && e.status === 'Processing')).toBe(true);
  });
});
