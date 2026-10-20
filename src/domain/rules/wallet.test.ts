import { describe, expect, it } from 'vitest';
import { naira, walletBalances } from './index';
import type { WalletEntry } from '../entities';

const entry = (over: Partial<WalletEntry> & Pick<WalletEntry, 'direction' | 'amountKobo' | 'status'>): WalletEntry =>
  ({ id: 'W', reference: 'R', memberId: 'M', kind: 'TopUp', createdAt: '2026-01-01T00:00:00', ...over });

describe('walletBalances', () => {
  it('an empty ledger is zero everywhere', () => expect(walletBalances([])).toEqual({ availableKobo: 0, pendingDepositKobo: 0, pendingWithdrawalKobo: 0 }));
  it('settled credits add to available; settled debits leave it', () => {
    const b = walletBalances([
      entry({ direction: 'Credit', amountKobo: naira(30_000), status: 'Successful' }),
      entry({ direction: 'Credit', amountKobo: naira(25_000), status: 'Successful' }),
      entry({ direction: 'Debit', amountKobo: naira(15_000), status: 'Successful', kind: 'Withdrawal' }),
    ]);
    expect(b.availableKobo).toBe(naira(40_000));
    expect(b.pendingDepositKobo).toBe(0);
    expect(b.pendingWithdrawalKobo).toBe(0);
  });
  it('a pending credit counts as a pending deposit, not available money', () => {
    const b = walletBalances([entry({ direction: 'Credit', amountKobo: naira(7_000), status: 'Pending' })]);
    expect(b.availableKobo).toBe(0);
    expect(b.pendingDepositKobo).toBe(naira(7_000));
  });
  it('an in-flight withdrawal is reserved out of available and shown as pending', () => {
    const b = walletBalances([
      entry({ direction: 'Credit', amountKobo: naira(40_000), status: 'Successful' }),
      entry({ direction: 'Debit', amountKobo: naira(5_000), status: 'Processing', kind: 'Withdrawal' }),
    ]);
    expect(b.availableKobo).toBe(naira(35_000));
    expect(b.pendingWithdrawalKobo).toBe(naira(5_000));
  });
  it('failed entries never count', () => {
    const b = walletBalances([
      entry({ direction: 'Credit', amountKobo: naira(10_000), status: 'Failed' }),
      entry({ direction: 'Debit', amountKobo: naira(2_000), status: 'Failed', kind: 'Withdrawal' }),
    ]);
    expect(b).toEqual({ availableKobo: 0, pendingDepositKobo: 0, pendingWithdrawalKobo: 0 });
  });
});
