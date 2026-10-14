import { useCallback, useEffect, useState } from 'react';
import type { Member, SavingsYear, Transaction } from '@/domain/entities';
import type { PlatformSettings } from '@/domain/rules';
import { useServices } from '../contexts/ServicesContext';

export interface SavingsData { year: SavingsYear; txs: Transaction[]; settings: PlatformSettings; now: Date }
/** Loads everything the savings rules need for one member: savings year, transactions and platform settings. */
export function useSavings(member: Member | null) {
  const { repos, clock } = useServices();
  const [data, setData] = useState<SavingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!member) return;
    try {
      const now = clock.now(); const settings = await repos.settings.get();
      const yearNo = member.joinedOn > `${now.getFullYear()}-${String(settings.cutoffMonth + 1).padStart(2, '0')}-31` ? now.getFullYear() + 1 : now.getFullYear();
      const [year, txs] = await Promise.all([repos.member.getSavingsYear(member.id, yearNo), repos.member.listTransactions(member.id)]);
      setData({ year, txs, settings, now });
    } catch (e) { setError((e as Error).message); }
  }, [repos, clock, member]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, reload };
}
