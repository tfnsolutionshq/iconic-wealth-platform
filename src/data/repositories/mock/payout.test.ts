import { beforeEach, describe, expect, it } from 'vitest';
import { naira } from '@/domain/rules';
import { fixedClock } from '@/domain/services/clock';
import { transactions, walletEntries } from '@/data/mock/seed';
import { MockMemberRepository, MockWalletRepository } from './index';

const seedTransactions = [...transactions];
const seedWalletEntries = [...walletEntries];
const reset = () => {
  transactions.splice(0, transactions.length, ...seedTransactions);
  walletEntries.splice(0, walletEntries.length, ...seedWalletEntries);
};
beforeEach(reset);

const clock = fixedClock('2026-10-02T09:40:00');
const members = new MockMemberRepository(clock);
const wallet = new MockWalletRepository(clock);

describe('MockMemberRepository payout day', () => {
  it('creates a processing bank payout for the full savings plus interest', async () => {
    const tx = await members.requestPayout('IWH-00412', 2026, 'Bank account');
    expect(tx.kind).toBe('Payout');
    expect(tx.payoutDestination).toBe('Bank account');
    expect(tx.status).toBe('Processing');
    expect(tx.amountKobo).toBe(naira(258_500)); // ₦235,000 savings + ₦23,500 interest
    expect(tx.platformChargeKobo).toBe(0);
    expect(tx.allocations).toEqual([]);
    expect(tx.reference).toMatch(/^IWH-P-/);
  });

  it('marks a bank payout as received (demo helper)', async () => {
    const tx = await members.requestPayout('IWH-00412', 2026, 'Bank account');
    const updated = await members.markPayoutReceived('IWH-00412', tx.id);
    expect(updated.status).toBe('Successful');
  });

  it('credits the platform wallet immediately for wallet payouts', async () => {
    const before = await wallet.getSnapshot('IWH-00412');
    const tx = await members.requestPayout('IWH-00412', 2026, 'Wallet');
    expect(tx.status).toBe('Successful');
    expect(tx.payoutDestination).toBe('Wallet');
    const after = await wallet.getSnapshot('IWH-00412');
    expect(after.availableKobo).toBe(before.availableKobo + tx.amountKobo);
    expect(after.entries[0]).toMatchObject({
      kind: 'Payout',
      direction: 'Credit',
      amountKobo: tx.amountKobo,
      status: 'Successful',
    });
  });

  it('allows only one payout per member and year', async () => {
    await members.requestPayout('IWH-00412', 2026, 'Wallet');
    await expect(members.requestPayout('IWH-00412', 2026, 'Bank account')).rejects.toThrow(/already been requested/i);
  });

  it('requires a payout account for a bank withdrawal', async () => {
    await expect(members.requestPayout('IWH-01250', 2027, 'Bank account')).rejects.toThrow(/payout account/i);
  });
});
