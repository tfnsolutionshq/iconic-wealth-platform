import type { Kobo } from '../entities';
import { naira } from './money';

/**
 * Platform charge (decided Oct 2026): flat ₦100 per payment, added to the amount saved.
 * Shown to the member once, as part of the total at review — not as a separate line on the contribute screen.
 * Gateway (Paystack) fee treatment is still open (OD-06/07/08); keep it server-side.
 */
export const DEFAULT_PLATFORM_CHARGE: Kobo = naira(100);

export interface ChargeBreakdown { amount: Kobo; platformCharge: Kobo; total: Kobo }
export function chargeBreakdown(amount: Kobo, platformCharge: Kobo = DEFAULT_PLATFORM_CHARGE): ChargeBreakdown {
  const pc = amount > 0 ? platformCharge : 0;
  return { amount, platformCharge: pc, total: amount + pc };
}
