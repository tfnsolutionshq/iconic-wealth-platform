import type { ContributionPaymentMethod, Kobo, MonthIndex, SavingsYear, Transaction } from '../entities';
import type { ContributionRepository, PaymentGateway, VerifiedContribution } from '../repositories';
import { isCatchUp, monthTotal, planAllocation, targetFor, type PlatformSettings } from '../rules/savings';

export interface PayResult {
  outcome: 'success' | 'failed' | 'pending';
  transaction?: Transaction;
  targetMetMonth: MonthIndex | null;
  communityUnlocked: boolean;
  /** How the payment was made, so the result screen can explain what happens next. */
  method: ContributionPaymentMethod;
}

/**
 * Contribute (MEM-07 to MEM-11, v5): validate (minimum per payment, oldest open month) → pay by the chosen method.
 *  - Bank Account: the member transfers to the platform account and confirms; the transaction stays Pending.
 *  - Wallet: the amount is debited from the wallet immediately (no platform charge).
 *  - Online: initiate (server creates the reference and re-plans the allocation) → Paystack checkout → verify.
 * A closed checkout leaves the payment Pending. Only the Online method carries the platform charge.
 */
export class ContributeUseCase {
  constructor(private readonly contributions: ContributionRepository, private readonly gateway: PaymentGateway) {}

  async pay(memberId: string, year: SavingsYear, txs: Transaction[], amount: Kobo, now: Date, settings: PlatformSettings, method: ContributionPaymentMethod = 'Online'): Promise<PayResult> {
    const plan = planAllocation(amount, year, txs, now, settings);
    if (!plan.ok) throw new Error(plan.error);

    if (method === 'Bank Account') {
      const settled = await this.contributions.confirmBankTransfer(memberId, year.year, amount);
      return { outcome: 'pending', transaction: settled.transaction, targetMetMonth: null, communityUnlocked: false, method };
    }

    const last = plan.allocations[plan.allocations.length - 1];
    const before = monthTotal(year, txs, last.month);
    let settled: VerifiedContribution;
    if (method === 'Wallet') {
      settled = await this.contributions.payFromWallet(memberId, year.year, amount);
    } else {
      const intent = await this.contributions.initiate(memberId, year.year, amount, method);
      const outcome = await this.gateway.checkout(intent);
      if (outcome === 'closed') return { outcome: 'pending', targetMetMonth: null, communityUnlocked: false, method };
      settled = await this.contributions.verify(intent.reference);
    }
    const { transaction, communityUnlocked } = settled;
    const ok = transaction.status === 'Successful';
    const target = targetFor(year, last.month);
    const targetMetMonth = ok && !isCatchUp(year, last.month) && target > 0 && before < target && before + last.amountKobo >= target ? last.month : null;
    return { outcome: ok ? 'success' : transaction.status === 'Pending' ? 'pending' : 'failed', transaction, targetMetMonth, communityUnlocked, method };
  }
}
