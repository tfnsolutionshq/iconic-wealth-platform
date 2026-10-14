import type { ContributionIntent, GatewayOutcome, PaymentGateway } from '@/domain/repositories';

/** Production: Paystack Inline (loaded on demand, no npm dependency). The server still verifies every payment. */
export class PaystackInlineGateway implements PaymentGateway {
  constructor(private readonly publicKey: string) {}
  private load(): Promise<void> {
    if ((window as unknown as { PaystackPop?: unknown }).PaystackPop) return Promise.resolve();
    return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = 'https://js.paystack.co/v2/inline.js'; s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load Paystack.')); document.head.appendChild(s); });
  }
  async checkout(intent: ContributionIntent): Promise<GatewayOutcome> {
    await this.load();
    type Popup = new () => { newTransaction(o: Record<string, unknown>): void };
    const Pop = (window as unknown as { PaystackPop: Popup }).PaystackPop;
    return new Promise(resolve => new Pop().newTransaction({
      key: this.publicKey, email: intent.email, amount: intent.amountKobo + intent.platformChargeKobo, reference: intent.reference, currency: 'NGN',
      onSuccess: () => resolve('success'), onCancel: () => resolve('closed'), onError: () => resolve('failed'),
    }));
  }
}

/** Demo only: lets presenters choose the outcome. The presentation layer registers the picker UI. */
export type DemoOutcome = 'Successful' | 'Failed' | 'Pending';
type Picker = (intent: ContributionIntent) => Promise<DemoOutcome>;
export class DemoGateway implements PaymentGateway {
  private picker: Picker = async () => 'Successful';
  private last = new Map<string, DemoOutcome>();
  setPicker(p: Picker) { this.picker = p; }
  outcomeFor = (reference: string): DemoOutcome => this.last.get(reference) ?? 'Pending';
  async checkout(intent: ContributionIntent): Promise<GatewayOutcome> {
    const o = await this.picker(intent); this.last.set(intent.reference, o);
    return o === 'Pending' ? 'closed' : o === 'Failed' ? 'failed' : 'success';
  }
}
