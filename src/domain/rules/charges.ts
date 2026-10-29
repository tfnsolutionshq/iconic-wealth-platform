import type { ContributionPaymentMethod, Kobo } from '../entities';
import { naira } from './money';

/**
 * Platform charge (decided Oct 2026): flat ₦100 per online payment, added to the amount saved.
 * Only online payments (Paystack) carry it — bank transfers and wallet payments are free.
 * Shown to the member once, as part of the total at review — not as a separate line on the contribute screen.
 * Gateway (Paystack) fee treatment is still open (OD-06/07/08); keep it server-side.
 */
export const DEFAULT_PLATFORM_CHARGE: Kobo = naira(100);

/** The only payment channel that carries the platform charge. */
export const CHARGEABLE_METHOD: ContributionPaymentMethod = 'Online';

export interface ChargeBreakdown { amount: Kobo; platformCharge: Kobo; total: Kobo }

/** The platform charge for a payment method; zero for bank transfers and wallet payments. */
export function chargeForMethod(method: ContributionPaymentMethod, platformCharge: Kobo = DEFAULT_PLATFORM_CHARGE): Kobo {
  return method === CHARGEABLE_METHOD ? platformCharge : 0;
}

export function chargeBreakdown(amount: Kobo, platformCharge: Kobo = DEFAULT_PLATFORM_CHARGE, method: ContributionPaymentMethod = CHARGEABLE_METHOD): ChargeBreakdown {
  const pc = amount > 0 ? chargeForMethod(method, platformCharge) : 0;
  return { amount, platformCharge: pc, total: amount + pc };
}
