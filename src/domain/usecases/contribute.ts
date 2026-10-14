import type { Kobo, MonthIndex, SavingsYear, Transaction } from '../entities';
import type { ContributionRepository, PaymentGateway } from '../repositories';
import { isCatchUp, monthTotal, planAllocation, targetFor, type PlatformSettings } from '../rules/savings';

export interface PayResult { outcome: 'success' | 'failed' | 'pending'; transaction?: Transaction; targetMetMonth: MonthIndex | null; communityUnlocked: boolean }

/**
 * Contribute (MEM-07 to MEM-11, v5): validate (minimum per payment, oldest open month) → initiate (server creates
 * reference and re-plans the allocation) → gateway checkout → server verifies. A closed checkout leaves the payment Pending.
 */
export class ContributeUseCase {
  constructor(private readonly contributions: ContributionRepository, private readonly gateway: PaymentGateway) {}

  async pay(memberId: string, year: SavingsYear, txs: Transaction[], amount: Kobo, now: Date, settings: PlatformSettings): Promise<PayResult> {
    const plan = planAllocation(amount, year, txs, now, settings);
    if (!plan.ok) throw new Error(plan.error);
    const last = plan.allocations[plan.allocations.length - 1];
    const before = monthTotal(year, txs, last.month);
    const intent = await this.contributions.initiate(memberId, year.year, amount);
    const outcome = await this.gateway.checkout(intent);
    if (outcome === 'closed') return { outcome: 'pending', targetMetMonth: null, communityUnlocked: false };
    const { transaction, communityUnlocked } = await this.contributions.verify(intent.reference);
    const ok = transaction.status === 'Successful';
    const target = targetFor(year, last.month);
    const targetMetMonth = ok && !isCatchUp(year, last.month) && target > 0 && before < target && before + last.amountKobo >= target ? last.month : null;
    return { outcome: ok ? 'success' : transaction.status === 'Pending' ? 'pending' : 'failed', transaction, targetMetMonth, communityUnlocked };
  }
}
