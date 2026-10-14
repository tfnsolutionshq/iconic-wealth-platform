import { useEffect, useMemo, useState } from 'react';
import { Download, List, Search } from 'lucide-react';
import type { Transaction } from '@/domain/entities';
import { formatNaira } from '@/domain/rules';
import { useAuth } from '../../../contexts/AuthContext';
import { useServices } from '../../../contexts/ServicesContext';
import { useToast } from '../../../contexts/ToastContext';
import { Button, Card, Chips, EmptyState } from '../../../design-system';
import { downloadCsv } from '../../../utils/csv';
import { TxRow, describeTx } from '../components/TransactionParts';

type Tab = 'All' | 'Contributions' | 'Payouts' | 'Pending' | 'Failed';

/** MEM-12: every contribution and payout with search, filters and a CSV statement download. */
export function ActivityPage() {
  const { session } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const member = session?.kind === 'member' ? session.member : null;
  const [all, setAll] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<Tab>('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (member) repos.member.listTransactions(member.id).then(setAll);
  }, [repos, member]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...all]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((t) => tab === 'All' || (tab === 'Contributions' && t.kind === 'Contribution') || (tab === 'Payouts' && t.kind === 'Payout') || t.status === tab)
      .filter((t) => !q || `${t.reference} ${describeTx(t)} ${Math.round(t.amountKobo / 100)}`.toLowerCase().includes(q));
  }, [all, tab, query]);

  if (!member) return <p className="text-mute">Loading…</p>;

  const statement = () => {
    downloadCsv(`IWH-statement-${member.id}.csv`,
      ['Date', 'Description', 'Reference', 'Amount', 'Charge', 'Status'],
      list.map((t) => [t.createdAt.slice(0, 10), describeTx(t), t.reference, formatNaira(t.amountKobo), formatNaira(t.platformChargeKobo), t.status]));
    toast('Statement downloaded.');
  };

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-extrabold tracking-tight">Activity</h1>
        <Button variant="outline" size="md" icon={<Download size={18} />} onClick={statement}>Statement</Button>
      </div>
      <label className="flex h-[42px] items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
        <Search size={20} className="shrink-0" />
        <span className="sr-only">Search activity</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by reference, month or amount"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-mute" />
      </label>
      <div className="overflow-x-auto">
        <Chips<Tab> value={tab} onChange={setTab}
          options={(['All', 'Contributions', 'Payouts', 'Pending', 'Failed'] as Tab[]).map((t) => ({ value: t, label: t }))} />
      </div>
      <Card>
        {list.length ? list.map((t) => <TxRow key={t.id} t={t} />)
          : <EmptyState icon={<List size={28} />} title={all.length ? 'Nothing here' : 'No payments yet'}>{all.length ? 'Try another filter.' : 'Your contributions will show here with their status.'}</EmptyState>}
      </Card>
    </div>
  );
}
