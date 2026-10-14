import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Bell, Check, Clock, X } from 'lucide-react';
import type { MemberNotification, Transaction } from '@/domain/entities';
import { formatNaira } from '@/domain/rules';
import { useAuth } from '../../../contexts/AuthContext';
import { useServices } from '../../../contexts/ServicesContext';
import { useToast } from '../../../contexts/ToastContext';
import { Card, EmptyState, cn } from '../../../design-system';
import { paths } from '../../../routes/paths';
import { describeTx, fmtDateTime } from '../components/TransactionParts';

interface Item { id: string; title: string; body: string; date: string; link: string; tile: string; icon: React.ReactNode }

const TONE_TILE: Record<MemberNotification['tone'], string> = {
  brand: 'bg-brand-tint text-brand-dark',
  gold: 'bg-gold-tint text-[#7a4a00]',
  fail: 'bg-fail-tint text-fail',
  neutral: 'bg-soft text-ink',
};

/** A notification from the server, mapped onto the portal's tile style. */
function fromServer(n: MemberNotification): Item {
  return {
    id: n.id, title: n.title, body: n.body, date: fmtDateTime(n.createdAt), link: n.link || paths.member.home,
    tile: TONE_TILE[n.tone],
    icon: n.tone === 'fail' ? <X size={20} /> : n.tone === 'gold' ? <Banknote size={20} /> : <Check size={20} />,
  };
}

/** Payment updates derived from the member's own transactions, newest first. */
function fromTx(t: Transaction): Item | null {
  const where = describeTx(t);
  if (t.kind === 'Payout') {
    return { id: `tx-${t.id}`, title: 'Withdrawal on its way', body: `${formatNaira(t.amountKobo)} is being sent to your bank.`, date: fmtDateTime(t.createdAt), link: paths.member.receipt(t.id), tile: 'bg-brand-tint text-brand-dark', icon: <Banknote size={20} /> };
  }
  if (t.status === 'Successful') {
    return { id: `tx-${t.id}`, title: 'Contribution recorded', body: `${formatNaira(t.amountKobo)} added to ${where.replace(' contribution', '')} savings.`, date: fmtDateTime(t.createdAt), link: paths.member.receipt(t.id), tile: 'bg-brand-tint text-brand-dark', icon: <Check size={20} /> };
  }
  if (t.status === 'Failed') {
    return { id: `tx-${t.id}`, title: 'Payment failed', body: `${t.failureReason ?? 'Your payment didn’t go through'}. Nothing was added to your savings.`, date: fmtDateTime(t.createdAt), link: paths.member.receipt(t.id), tile: 'bg-fail-tint text-fail', icon: <X size={20} /> };
  }
  return { id: `tx-${t.id}`, title: 'Confirming your payment', body: 'We’re waiting for Paystack to confirm. Please don’t pay again.', date: fmtDateTime(t.createdAt), link: paths.member.receipt(t.id), tile: 'bg-pending-tint text-pending', icon: <Clock size={20} /> };
}

/** MEM-14: in-app notifications. Server items first, then payment updates from the member's transactions. */
export function NotificationsPage() {
  const { session } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const member = session?.kind === 'member' ? session.member : null;
  const [server, setServer] = useState<MemberNotification[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [read, setRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!member) return;
    repos.member.listNotifications(member.id).then(setServer);
    repos.member.listTransactions(member.id).then(setTxs);
  }, [repos, member]);

  const items: Item[] = useMemo(() => {
    const seen = new Set(server.map((n) => n.id));
    const derived = [...txs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20)
      .map(fromTx).filter((x): x is Item => !!x && !seen.has(x.id));
    return [...server.map(fromServer), ...derived];
  }, [server, txs]);

  if (!member) return <p className="text-mute">Loading…</p>;
  const unread = items.filter((n) => !read.has(n.id) && !server.find((s) => s.id === n.id)?.read);

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-extrabold tracking-tight">Notifications</h1>
        {unread.length > 0 && (
          <button className="text-sm font-bold text-brand" onClick={() => { setRead(new Set(items.map((n) => n.id))); toast('All notifications marked as read.'); }}>
            Mark all read
          </button>
        )}
      </div>
      <Card className="flex flex-col">
        {items.length ? items.map((n) => {
          const isUnread = !read.has(n.id) && !server.find((s) => s.id === n.id)?.read;
          return (
            <Link key={n.id} to={n.link} onClick={() => setRead((prev) => new Set(prev).add(n.id))}
              className={cn('flex items-start gap-3 border-b border-line py-3 no-underline last:border-b-0', isUnread && 'bg-[#faf7fe]')}>
              <span className={cn('flex size-[42px] shrink-0 items-center justify-center rounded-[14px]', n.tile)}>{n.icon}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <b className="text-[15px] text-ink">{n.title}</b>
                <span className="text-sm font-semibold leading-snug text-mute">{n.body}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-mute">{n.date}</span>
            </Link>
          );
        }) : <EmptyState icon={<Bell size={28} />} title="No notifications">Payment updates and announcements will appear here.</EmptyState>}
      </Card>
    </div>
  );
}
