import { describe, expect, it } from 'vitest';
import { naira } from '@/domain/rules';
import { fixedClock } from '@/domain/services/clock';
import { MockContributionRepository, MockWalletRepository } from './index';

const clock = fixedClock('2026-10-02T09:40:00');
const wallet = new MockWalletRepository(clock);
const contributions = new MockContributionRepository(clock, () => 'Successful');

describe('MockContributionRepository payments', () => {
  it('debits only the amount from the wallet (no platform charge)', async () => {
    const before = await wallet.getSnapshot('IWH-00412');
    const result = await contributions.payFromWallet('IWH-00412', 2026, naira(10_000));
    expect(result.transaction.status).toBe('Successful');
    expect(result.transaction.amountKobo).toBe(naira(10_000));
    expect(result.transaction.platformChargeKobo).toBe(0);
    expect(result.transaction.paymentMethod).toBe('Wallet');
    const after = await wallet.getSnapshot('IWH-00412');
    expect(after.availableKobo).toBe(before.availableKobo - naira(10_000));
    expect(after.entries[0]).toMatchObject({
      kind: 'Contribution',
      direction: 'Debit',
      amountKobo: naira(10_000),
      status: 'Successful',
    });
  });

  it('rejects when the wallet cannot cover the amount', async () => {
    await expect(contributions.payFromWallet('IWH-01250', 2027, naira(10_000))).rejects.toThrow(/wallet balance/i);
  });

  it('records a bank transfer as pending, with no platform charge', async () => {
    const result = await contributions.confirmBankTransfer('IWH-01244', 2026, naira(10_000));
    expect(result.transaction.status).toBe('Pending');
    expect(result.transaction.amountKobo).toBe(naira(10_000));
    expect(result.transaction.platformChargeKobo).toBe(0);
    expect(result.transaction.paymentMethod).toBe('Bank Account');
    expect(result.communityUnlocked).toBe(false);
  });

  it('adds the ₦100 platform charge only to online payments', async () => {
    const intent = await contributions.initiate('IWH-01250', 2027, naira(10_000), 'Online');
    expect(intent.platformChargeKobo).toBe(naira(100));
    const settled = await contributions.verify(intent.reference);
    expect(settled.transaction.platformChargeKobo).toBe(naira(100));
    expect(settled.transaction.paymentMethod).toBe('Online');
    expect(settled.transaction.amountKobo).toBe(naira(10_000));
  });
});
