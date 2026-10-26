import { describe, expect, it } from 'vitest';
import { naira } from '@/domain/rules';
import { fixedClock } from '@/domain/services/clock';
import { MockContributionRepository, MockWalletRepository } from './index';

const clock = fixedClock('2026-10-02T09:40:00');
const wallet = new MockWalletRepository(clock);
const contributions = new MockContributionRepository(clock, () => 'Successful');

describe('MockContributionRepository wallet payments', () => {
  it('debits the wallet total and records a successful contribution', async () => {
    const before = await wallet.getSnapshot('IWH-00412');
    const result = await contributions.payFromWallet('IWH-00412', 2026, naira(10_000));
    expect(result.transaction.status).toBe('Successful');
    expect(result.transaction.amountKobo).toBe(naira(10_000));
    const after = await wallet.getSnapshot('IWH-00412');
    expect(after.availableKobo).toBe(before.availableKobo - naira(10_100));
    expect(after.entries[0]).toMatchObject({
      kind: 'Contribution',
      direction: 'Debit',
      amountKobo: naira(10_100),
      status: 'Successful',
    });
  });
  it('rejects when the wallet cannot cover the amount plus charge', async () => {
    await expect(contributions.payFromWallet('IWH-01250', 2027, naira(10_000))).rejects.toThrow(/wallet balance/i);
  });
});
