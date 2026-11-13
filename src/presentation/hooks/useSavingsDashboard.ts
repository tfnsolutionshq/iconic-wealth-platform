import { useCallback, useEffect, useState } from 'react';
import type { Member, SavingsDashboard, SavingsMonth, Transaction } from '@/domain/entities';
import { useServices } from '../contexts/ServicesContext';

export interface SavingsDashboardData {
  /** The signed-in member's dashboard from GET /savings. */
  dashboard: SavingsDashboard;
  /** The status of every savings month for the dashboard's year. */
  months: SavingsMonth[];
  /** The three most recent transactions, best-effort: an empty list when unavailable. */
  recent: Transaction[];
  now: Date;
}

/**
 * Loads the member dashboard from GET /savings. Recent transactions are loaded
 * separately and never fail the dashboard: the live savings endpoint is the
 * source of truth for the summary, while activity is still mock-backed.
 */
export function useSavingsDashboard(member: Member | null) {
  const { repos, clock } = useServices();
  const [data, setData] = useState<SavingsDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(member !== null);

  const reload = useCallback(async () => {
    if (!member) return;
    setLoading(true);
    setError(null);
    try {
      const dashboard = await repos.savingsDashboard.get(member.id);
      const [transactions, months] = await Promise.all([
        repos.member.listTransactions(member.id).catch(() => [] as Transaction[]),
        repos.savingsDashboard.getMonths(dashboard.summary.year).catch(() => [] as SavingsMonth[]),
      ]);
      const recent = [...transactions]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 3);
      setData({ dashboard, months, recent, now: clock.now() });
    } catch (e) {
      // Keep the last good dashboard; surface the failure so the page can offer
      // a retry instead of showing “Loading…” forever.
      setError((e as Error).message || 'We couldn’t load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, [repos, clock, member]);

  useEffect(() => { void reload(); }, [reload]);

  return { data, error, loading, reload };
}
