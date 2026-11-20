import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Banknote,
  Bell,
  Check,
  MessageCircle,
  Star,
  X,
} from "lucide-react";
import type { MemberNotification } from "@/domain/entities";
import type { NotificationPageMeta } from "@/domain/repositories";
import { useAuth } from "../../../contexts/AuthContext";
import { useNotificationUnread } from "../../../contexts/NotificationContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { Card, EmptyState, LoadingScreen, cn } from "../../../design-system";
import { paths } from "../../../routes/paths";

interface Item {
  id: string;
  title: string;
  body: string;
  date: string;
  read: boolean;
  link: string;
  tile: string;
  icon: React.ReactNode;
}

const TONE_TILE: Record<MemberNotification["tone"], string> = {
  brand: "bg-brand-tint text-brand-dark",
  gold: "bg-gold-tint text-[#7a4a00]",
  fail: "bg-fail-tint text-fail",
  neutral: "bg-soft text-ink",
};

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Formats timestamps like the prototype: `2h`, `15m`, or `3 Sep`. */
function fmtShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  if (diffMs >= 0 && diffMs < 86_400_000) {
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
  }
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
}

/** A notification from the server, mapped onto the portal's tile style. */
function fromServer(n: MemberNotification): Item {
  const event = (n.event ?? "").toLowerCase();
  const category = (n.category ?? "").toLowerCase();
  let icon: React.ReactNode = <Check size={20} />;
  if (n.tone === "fail") {
    icon = <X size={20} />;
  } else if (n.tone === "gold") {
    icon =
      category === "payout" || event.includes("payout") ? (
        <Banknote size={20} />
      ) : (
        <Star size={20} />
      );
  } else if (n.tone === "neutral") {
    icon = <MessageCircle size={20} />;
  }

  return {
    id: n.id,
    title: n.title,
    body: n.body,
    date: fmtShortDate(n.createdAt),
    read: n.read,
    link: n.link || paths.member.home,
    tile: TONE_TILE[n.tone],
    icon,
  };
}

/** MEM-14: in-app notifications backed by GET /notifications, POST /notifications/{id}/read, and POST /notifications/read-all. */
export function NotificationsPage() {
  const { session } = useAuth();
  const { repos } = useServices();
  const { setUnreadCount } = useNotificationUnread();
  const toast = useToast();
  const member = session?.kind === "member" ? session.member : null;

  const [notifications, setNotifications] = useState<MemberNotification[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<NotificationPageMeta>({
    current_page: 1,
    per_page: 15,
    last_page: 1,
    total: 0,
    unread_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const res = await repos.member.listNotificationsPage({
          page: targetPage,
          per_page: 15,
        });
        setNotifications(res.data);
        setMeta(res.meta);
        setUnreadCount(res.meta.unread_count);
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Could not load notifications.",
          "fail",
        );
      } finally {
        setLoading(false);
      }
    },
    [repos, setUnreadCount, toast],
  );

  useEffect(() => {
    if (!member) return;
    void load(page);
  }, [member, page, load]);

  if (!member || (loading && notifications.length === 0)) {
    return <LoadingScreen />;
  }

  const items = notifications.map(fromServer);
  const hasUnread =
    meta.unread_count > 0 || notifications.some((n) => !n.read);

  async function handleReadOne(item: Item) {
    if (item.read) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
    );
    setMeta((prev) => ({
      ...prev,
      unread_count: Math.max(0, prev.unread_count - 1),
    }));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      const updated = await repos.member.markNotificationRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? updated : n)),
      );
    } catch {
      // Keep optimistic state on navigation; next load will sync with server.
    }
  }

  async function handleMarkAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await repos.member.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setMeta((prev) => ({ ...prev, unread_count: 0 }));
      setUnreadCount(0);
      toast("All notifications marked as read.");
    } catch (err) {
      toast(
        err instanceof Error
          ? err.message
          : "Could not mark all notifications as read.",
        "fail",
      );
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-140 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-extrabold tracking-tight">
          Notifications
        </h1>
        {hasUnread && (
          <button
            type="button"
            disabled={markingAll}
            className="text-sm font-bold text-brand disabled:opacity-50"
            onClick={handleMarkAllRead}
          >
            {markingAll ? "Marking..." : "Mark all read"}
          </button>
        )}
      </div>
      <Card className="flex flex-col">
        {items.length ? (
          items.map((n) => {
            const isUnread = !n.read;
            return (
              <Link
                key={n.id}
                to={n.link}
                onClick={() => {
                  void handleReadOne(n);
                }}
                className={cn(
                  "flex items-start gap-3 border-b border-line py-3 no-underline last:border-b-0",
                  isUnread && "bg-[#faf7fe]",
                )}
              >
                <span
                  className={cn(
                    "flex size-10.5 shrink-0 items-center justify-center rounded-input",
                    n.tile,
                  )}
                >
                  {n.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <b className="text-[15px] text-ink">{n.title}</b>
                  <span className="text-sm font-semibold leading-snug text-mute">
                    {n.body}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-mute">
                  {n.date}
                </span>
              </Link>
            );
          })
        ) : (
          <EmptyState icon={<Bell size={28} />} title="No notifications">
            Payment updates and announcements will appear here.
          </EmptyState>
        )}
      </Card>
      {meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm font-semibold text-mute">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-line bg-white px-3 py-1.5 font-bold text-ink disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {meta.current_page} of {meta.last_page}
          </span>
          <button
            type="button"
            disabled={page >= meta.last_page || loading}
            onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
            className="rounded-lg border border-line bg-white px-3 py-1.5 font-bold text-ink disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
