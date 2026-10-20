import type { Kobo, WalletEntry } from '../entities';

export interface WalletBalances {
  availableKobo: Kobo;
  pendingDepositKobo: Kobo;
  pendingWithdrawalKobo: Kobo;
}

/**
 * Wallet balances are derived from ledger entries, never stored (mirrors savings totals).
 * Failed entries never count; an in-flight withdrawal is reserved out of the available balance
 * so the same money cannot be spent twice.
 */
export function walletBalances(entries: WalletEntry[]): WalletBalances {
  let availableKobo = 0;
  let pendingDepositKobo = 0;
  let pendingWithdrawalKobo = 0;
  for (const e of entries) {
    if (e.status === 'Failed') continue;
    if (e.direction === 'Credit') {
      if (e.status === 'Successful') availableKobo += e.amountKobo;
      else pendingDepositKobo += e.amountKobo;
    } else if (e.status === 'Successful') {
      availableKobo -= e.amountKobo;
    } else {
      availableKobo -= e.amountKobo;
      pendingWithdrawalKobo += e.amountKobo;
    }
  }
  return { availableKobo, pendingDepositKobo, pendingWithdrawalKobo };
}
