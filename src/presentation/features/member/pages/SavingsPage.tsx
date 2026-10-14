import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Ban,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  History,
  Landmark,
  Lock,
  Shield,
  TriangleAlert,
  X,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useSavings } from "../../../hooks/useSavings";
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Modal,
  Pill,
  cn,
} from "../../../design-system";
import {
  MONTHS,
  deadlineFor,
  formatNaira,
  formatShortDate,
  interestOnTrack,
  isCatchUp,
  minimumFor,
  monthPayments,
  monthState,
  monthTotal,
  monthsSaved,
  openMonth,
  savedThisYear,
  targetFor,
  type MonthState,
} from "@/domain/rules";
import { TargetCard } from "../components/SavingsCards";
import { paths } from "../../../routes/paths";

const TILE: Record<string, { cls: string; icon: React.ReactNode }> = {
  saved: { cls: "bg-brand-tint text-brand-dark", icon: <Check size={18} /> },
  missed: { cls: "bg-fail-tint text-fail", icon: <X size={18} /> },
  open: { cls: "bg-gold-tint text-[#7a5410]", icon: <Clock size={18} /> },
  ahead: { cls: "bg-gold-tint text-[#7a5410]", icon: <Calendar size={18} /> },
  catchup: { cls: "bg-gold-tint text-[#7a5410]", icon: <History size={18} /> },
  waiting: { cls: "bg-soft text-ink", icon: <History size={18} /> },
  future: { cls: "bg-soft text-ink", icon: <Calendar size={18} /> },
  before: { cls: "bg-soft text-ink", icon: <Ban size={18} /> },
  payout: {
    cls: "bg-brand-tint text-brand-dark",
    icon: <Landmark size={18} />,
  },
};
const tileFor = (s: MonthState) =>
  s === "saved"
    ? TILE.saved
    : s === "missed"
      ? TILE.missed
      : s === "open"
        ? TILE.open
        : s === "ahead"
          ? TILE.ahead
          : s === "catchup"
            ? TILE.catchup
            : s === "payout"
              ? TILE.payout
              : s === "beforeJoining"
                ? TILE.before
                : s === "catchupWaiting"
                  ? TILE.waiting
                  : TILE.future;

/** MEM-06 (v5): month rows with totals; expand months with several payments; Pay now + Lock on the open month; December = payout. */
export function SavingsPage() {
  const { session } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const member = session?.kind === "member" ? session.member : null;
  const { data, reload } = useSavings(member);
  const [open, setOpen] = useState<number | null>(null);
  const [lockAsk, setLockAsk] = useState<number | null>(null);
  const [lockBusy, setLockBusy] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  if (!member || !data) return <p className="text-mute">Loading…</p>;
  const { year, txs, now, settings } = data;
  const cur = openMonth(year, now, settings);
  const min = minimumFor(settings, year.year);
  const payout = new Date(
    `${settings.payoutDates[year.year] ?? `${year.year}-12-14`}T10:00`,
  );
  const onTrack = interestOnTrack(year, txs, now, settings);
  const props = {
    memberId: member.id,
    year,
    txs,
    now,
    settings,
    onChange: reload,
  };

  const lock = async (i: number) => {
    setLockBusy(true);
    try {
      await repos.member.lockMonth(member.id, year.year, i as 0);
      toast(
        `${MONTHS[i]} locked. Next payments count toward ${MONTHS[i + 1] ?? "January"}.`,
      );
      setLockAsk(null);
      reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setLockBusy(false);
    }
  };

  const months: number[] = [];
  for (let i = year.startMonth; i <= settings.lastSavingsMonth; i++)
    months.push(i);

  return (
    <div className="mx-auto flex max-w-245 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-extrabold tracking-tight">Savings</h1>
        <Pill tone="mute" icon={false}>
          {String(year.year)}
        </Pill>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Card tone="night" className="flex flex-col gap-1">
          <span className="text-xs font-bold text-white/70">Total saved</span>
          <b className="text-2xl tabular-nums">
            {formatNaira(savedThisYear(year, txs))}
          </b>
        </Card>
        <Card className="flex flex-col gap-1 bg-soft">
          <span className="text-xs font-bold text-mute">Months saved</span>
          <b className="text-2xl tabular-nums">
            {monthsSaved(year, txs, settings)} of{" "}
            {settings.lastSavingsMonth + 1 - year.startMonth}
          </b>
        </Card>
      </div>

      <TargetCard {...props} />

      {onTrack ? (
        <Banner tone="info" icon={<Shield size={20} />}>
          <b>Interest: on track for {year.year}.</b> Save at least{" "}
          {formatNaira(min)} in every month before it closes on the 5th.
        </Banner>
      ) : (
        <Banner tone="warn" icon={<TriangleAlert size={20} />}>
          <b>Interest for {year.year} is affected</b> because a month closed
          with nothing saved. Your savings are safe and paid out in full.
        </Banner>
      )}

      <Card className="flex flex-col">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-extrabold">Months</h2>
          <button
            className="text-sm font-bold text-brand"
            onClick={() => setHowOpen(true)}
          >
            How months close
          </button>
        </div>
        {months.map((i) => {
          const s = monthState(year, txs, i, now, settings);
          const t = monthTotal(year, txs, i);
          const pays = monthPayments(year, txs, i);
          const lk = year.locks[i];
          const tile = tileFor(s);
          const target = targetFor(year, i);
          const isOpen = open === i;
          const active = i === cur;
          const hl = s === "open" || s === "ahead" || s === "catchup";
          const dim =
            s === "upcoming" || s === "next" || s === "catchupWaiting";
          const cap =
            s === "saved"
              ? `${isCatchUp(year, i) ? "Catch-up month · cleared" : lk?.by === "member" ? `Locked by you · ${formatShortDate(new Date(lk.on))}` : `Closed automatically after ${formatShortDate(deadlineFor(year.year, i as 0))}`}${pays.length > 1 ? ` · ${pays.length} payments` : ""}`
              : s === "missed"
                ? `Nothing saved before ${formatShortDate(deadlineFor(year.year, i as 0))}`
                : s === "open"
                  ? `Open · closes ${formatShortDate(deadlineFor(year.year, i as 0))}${pays.length > 1 ? ` · ${pays.length} payments` : ""}`
                  : s === "ahead"
                    ? `Saving ahead${pays.length > 1 ? ` · ${pays.length} payments` : ""}`
                    : s === "catchup"
                      ? `Catch-up month · ${formatNaira(min)} needed`
                      : s === "catchupWaiting"
                        ? "Catch-up month · waiting"
                        : s === "next"
                          ? `Opens for payments after ${cur != null ? MONTHS[cur] : ""} closes or is locked`
                          : `Opens ${formatShortDate(new Date(year.year, i, 1))}`;
          const right =
            s === "upcoming" || s === "next" || s === "catchupWaiting" ? (
              <Pill tone="mute" icon={false}>
                {s === "catchupWaiting" ? "Catch-up" : "Upcoming"}
              </Pill>
            ) : (
              <span className="flex flex-col items-end gap-1">
                <b className="text-[15px] tabular-nums">{formatNaira(t)}</b>
                {s === "saved" ? (
                  target && !isCatchUp(year, i) && t >= target ? (
                    <Pill tone="ok" icon={<Check size={12} />}>
                      Target met
                    </Pill>
                  ) : (
                    <Pill tone="ok" icon={<Lock size={12} />}>
                      Saved
                    </Pill>
                  )
                ) : s === "missed" ? (
                  <Pill tone="fail" icon={<X size={12} />}>
                    Missed
                  </Pill>
                ) : (
                  <Pill tone="pending" icon={<Clock size={12} />}>
                    {s === "catchup" ? "Catch-up" : "Open"}
                  </Pill>
                )}
              </span>
            );
          const actions = active && (
            <div className="flex gap-2">
              <ButtonLink to={paths.member.contribute} size="sm">
                {s === "catchup" ? "Pay catch-up" : "Pay now"}
              </ButtonLink>
              {s !== "catchup" && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Lock size={14} />}
                  disabled={t < min}
                  title={
                    t < min
                      ? `You can lock ${MONTHS[i]} once it has at least ${formatNaira(min)}`
                      : undefined
                  }
                  onClick={() => setLockAsk(i)}
                >
                  Lock
                </Button>
              )}
            </div>
          );
          const expandable = pays.length > 1;
          return (
            <div
              key={i}
              className={cn(
                "border-b border-line py-1 last:border-b-0",
                hl &&
                  "-mx-2.5 rounded-input border-2 border-gold bg-[#fffbf2] px-2.5",
                dim && "opacity-60",
              )}
            >
              <div
                className="flex items-center gap-3 py-2.5"
                {...(expandable
                  ? {
                      role: "button",
                      tabIndex: 0,
                      "aria-expanded": isOpen,
                      style: { cursor: "pointer" },
                      onClick: () => setOpen(isOpen ? null : i),
                      onKeyDown: (e: React.KeyboardEvent) =>
                        e.key === "Enter" && setOpen(isOpen ? null : i),
                    }
                  : {})}
              >
                <span
                  className={cn(
                    "flex size-10.5 shrink-0 items-center justify-center rounded-input",
                    tile.cls,
                  )}
                >
                  {tile.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b>{MONTHS[i]}</b>
                  <span className="text-[13px] font-semibold text-mute">
                    {cap}
                  </span>
                </span>
                {right}
                {expandable && (
                  <ChevronRight
                    size={16}
                    className={cn(
                      "shrink-0 text-mute transition-transform",
                      isOpen && "rotate-90",
                    )}
                  />
                )}
              </div>
              {!isOpen && actions && <div className="pb-3">{actions}</div>}
              {isOpen && expandable && (
                <div className="mb-3 rounded-input bg-soft px-3.5 py-1.5">
                  {pays.map((p) => {
                    const a = p.allocations
                      .filter((x) => x.month === i)
                      .reduce((s2, x) => s2 + x.amountKobo, 0);
                    return (
                      <Link
                        key={p.id}
                        to={paths.member.receipt(p.id)}
                        className="flex items-center justify-between gap-3 border-b border-line py-2.5 no-underline last:border-b-0"
                      >
                        <span className="flex flex-col gap-0.5">
                          <b className="text-sm text-ink">
                            {new Date(p.createdAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                          </b>
                          <span className="font-mono text-xs font-semibold text-mute">
                            {p.reference}
                          </span>
                        </span>
                        <b className="text-sm tabular-nums text-ink">
                          {formatNaira(a)}
                        </b>
                      </Link>
                    );
                  })}
                  <div className="flex items-center justify-between gap-3 border-t-[1.5px] border-line py-2.5">
                    <b className="text-sm">Total for {MONTHS[i]}</b>
                    <b className="text-sm tabular-nums">{formatNaira(t)}</b>
                  </div>
                  {actions && <div className="pb-2 pt-1">{actions}</div>}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <Link
        to={paths.member.payout}
        className="flex items-center gap-3 rounded-card border border-line bg-soft p-4.5 no-underline"
      >
        <span className="flex size-10.5 items-center justify-center rounded-input bg-white">
          <Lock size={20} />
        </span>
        <span className="flex flex-1 flex-col">
          <b className="text-ink">Withdrawals open on payout day</b>
          <span className="text-[13px] font-semibold text-mute">
            Savings are paid out on or before {formatShortDate(payout)}.
          </span>
        </span>
        <ChevronRight size={18} className="text-ink" />
      </Link>

      <Modal
        open={lockAsk !== null}
        title={lockAsk !== null ? `Lock ${MONTHS[lockAsk]}?` : ""}
        onClose={() => setLockAsk(null)}
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => setLockAsk(null)}
            >
              Not now
            </Button>
            <Button
              size="md"
              icon={<Lock size={18} />}
              disabled={lockBusy}
              onClick={() => lockAsk !== null && lock(lockAsk)}
            >
              Lock {lockAsk !== null ? MONTHS[lockAsk] : ""}
            </Button>
          </>
        }
      >
        {lockAsk !== null && (
          <>
            <p className="leading-relaxed text-[#474252]">
              {MONTHS[lockAsk]} will be saved at{" "}
              <b>{formatNaira(monthTotal(year, txs, lockAsk))}</b> and closed.{" "}
              {lockAsk < settings.lastSavingsMonth ? (
                <>
                  Your next payment will count toward{" "}
                  <b>{MONTHS[lockAsk + 1]}</b>.
                </>
              ) : (
                "This is the last savings month of the year."
              )}
            </p>
            <div className="flex flex-col gap-1.5 rounded-card bg-soft p-4 text-sm font-bold">
              <span className="flex items-center gap-2">
                <Check size={16} />
                Optional. {MONTHS[lockAsk]} closes automatically after{" "}
                {formatShortDate(deadlineFor(year.year, lockAsk as 0))}.
              </span>
              <span className="flex items-center gap-2">
                <X size={16} />
                You can’t add to {MONTHS[lockAsk]} after locking.
              </span>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={howOpen}
        title="How months close"
        onClose={() => setHowOpen(false)}
        footer={
          <Button full onClick={() => setHowOpen(false)}>
            Got it
          </Button>
        }
      >
        <div className="flex flex-col gap-2.5 leading-relaxed text-[#474252]">
          <p>
            Each savings month opens on the 1st. Pay as many times as you like;
            every payment of at least {formatNaira(min)} is added to the open
            month.
          </p>
          <p>
            A month closes automatically at the end of the 5th of the next
            month. Once it has {formatNaira(min)} or more, you can also{" "}
            <b>lock</b> it early so your next payments count toward the
            following month.
          </p>
          <p>
            If a month closes with nothing saved, it’s recorded as missed and
            your interest for {year.year} may be affected. Your savings are
            always safe.
          </p>
        </div>
      </Modal>
    </div>
  );
}
