import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Kobo } from '@/domain/entities';
import type { PayResult } from '@/domain/usecases/contribute';

/** Carries the amount across Contribute → Review → Result without global state. */
interface Draft { amount: Kobo | null; setAmount: (a: Kobo | null) => void; result: PayResult | null; setResult: (r: PayResult | null) => void }
const Ctx = createContext<Draft | null>(null);
export function ContributionDraftProvider({ children }: { children: ReactNode }) {
  const [amount, setAmount] = useState<Kobo | null>(null);
  const [result, setResult] = useState<PayResult | null>(null);
  return <Ctx.Provider value={{ amount, setAmount, result, setResult }}>{children}</Ctx.Provider>;
}
export function useContributionDraft() { const c = useContext(Ctx); if (!c) throw new Error('useContributionDraft must be used inside ContributionDraftProvider'); return c; }
