import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Lock,
  Shield,
  Star,
  TriangleAlert,
  X,
} from "lucide-react";
import type { SavingsMonth } from "@/domain/entities";
import { useAuth } from "../../../contexts/AuthContext";
import { useSavingsDashboard } from "../../../hooks/useSavingsDashboard";
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Modal,
  Pill,
  cn,
} from "../../../design-system";
import { formatNaira, formatShortDate, targetPeriodFor } from "@/domain/rules";
import { paths } from "../../../routes/paths";
import { SavingsTargetModal } from "../components/SavingsTargetModal";

/** Parses the date-only payout date and the ISO deadlines returned by GET /savings. */
function parseDate(value: string): Date {
  return value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
}

const SAVED_STATUSES = new Set(["saved", "completed", "paid"]);
const MISSED_STATUSES = new Set(["defaulted", "missed", "late"]);
const OPEN_STATUSES = new Set(["open", "active", "catchup", "catch_up"]);
const AHEAD_STATUSES = new Set(["ahead", "saving_ahead"]);

type RowState = "saved" | "missed" | "open" | "ahead" | "upcoming" | "payout";

function rowState(month: SavingsMonth): RowState {
  const status = month.status.toLowerCase();
  if (SAVED_STATUSES.has(status)) return "saved";
  if (MISSED_STATUSES.has(status)) return "missed";
  if (OPEN_STATUSES.has(status)) return "open";
  if (AHEAD_STATUSES.has(status)) return "ahead";
  return "upcoming";
}

const TILE: Record<RowState, { cls: string; icon: React.ReactNode }> = {
  saved: { cls: "bg-brand-tint text-brand-dark", icon: <Check size={18} /> },
  missed: { cls: "bg-fail-tint text-fail", icon: <X size={18} /> },
  open: { cls: "bg-gold-tint text-[#7a5410]", icon: <Clock size={18} /> },
  ahead: { cls: "bg-gold-tint text-[#7a5410]", icon: <Calendar size={18} /> },
  upcoming: { cls: "bg-soft text-ink", icon: <Calendar size={18} /> },
  payout: { cls: "bg-brand-tint text-brand-dark", icon: <Lock size={18} /> },
};

/**
 * MEM-06 (v5): the member's savings year, backed by GET /savings and
 * GET /savings/months?year=. The dashboard supplies the year summary and
 * payout journey; the months endpoint supplies each month's saved amount and
 * status. Interactive target changes use the existing POST /savings/target.
 */
export function SavingsPage() {
  const { session } = useAuth();
  const member = session?.kind === "member" ? session.member : null;
  const { data, error, reload } = useSavingsDashboard(member);
  const [targetOpen, setTargetOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  if (!member) return <Navigate to={paths.login} replace />;
  if (error && !data)
    return (
      <Card className="mx-auto flex max-w-xl flex-col items-start gap-3">
        <b>We couldn’t load your savings</b>
        <p className="text-sm font-semibold text-mute">{error}</p>
        <Button onClick={() => void reload()}>Try again</Button>
      </Card>
    );
  if (!data) return <p className="text-mute">Loading…</p>;

  const { dashboard, months, now } = data;
  const { summary, activeMonth, payoutJourney, settings } = dashboard;
  const year = summary.year;
  const savingsMonths = [...months]
    .filter((m) => m.month <= 11)
    .sort((a, b) => a.month - b.month);
  const monthsUnavailable = savingsMonths.length === 0;
  const monthsInYear = savingsMonths.length || 11;
  const savedMonths = monthsUnavailable
    ? summary.totalMonths
    : savingsMonths.filter((m) => rowState(m) === "saved").length;
  const defaultedMonths = monthsUnavailable
    ? summary.defaultedMonths
    : savingsMonths.filter((m) => rowState(m) === "missed").length;
  const monthsTargetMet = monthsUnavailable
    ? summary.monthsTargetMet
    : savingsMonths.filter((m) => m.targetMet).length;
  const onTrack = defaultedMonths === 0;
  // A target always belongs to the calendar month the member is in now.
  const targetPeriod = targetPeriodFor(now);
  const currentMonth = months.find(
    (m) => m.year === targetPeriod.year && m.month === targetPeriod.month,
  );
  const target = currentMonth?.targetAmount ?? null;
  const targetSaved = currentMonth?.savedAmount ?? 0;
  const targetPct = target
    ? Math.min(100, Math.round((targetSaved / target) * 100))
    : 0;
  const payoutDate = parseDate(payoutJourney.payoutDate);
  const minimum = settings.minimumPerPayment;
  const showTarget = targetPeriod.year === year;

  return (
    <div className="mx-auto flex max-w-245 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-extrabold tracking-tight">Savings</h1>
        <Pill tone="mute" icon={false}>
          {String(year)}
        </Pill>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Card tone="night" className="flex flex-col gap-1">
          <span className="text-xs font-bold text-white/70">Total saved</span>
          <b className="text-xl break-words tabular-nums sm:text-2xl">
            {formatNaira(summary.savedThisYear)}
          </b>
        </Card>
        <Card className="flex flex-col gap-1 bg-soft">
          <span className="text-xs font-bold text-mute">Months saved</span>
          <b className="text-xl tabular-nums sm:text-2xl">
            {savedMonths} of {monthsInYear}
          </b>
        </Card>
      </div>

      {showTarget && (
        <Card
          className={
            target && targetSaved >= target
              ? "border-[#bfe3d5] bg-linear-to-b from-[#f3fbf7] to-white"
              : ""
          }
        >
          <div className="flex items-start justify-between">
            <span className="flex flex-col">
              <span className="text-[13px] font-bold text-mute">
                {targetPeriod.monthName} target
              </span>
              <b className="text-xl">
                {target ? formatNaira(target) : "Not set"}
              </b>
            </span>
            {target ? (
              targetSaved >= target ? (
                <Pill tone="ok">Target met</Pill>
              ) : (
                <Pill tone="gold" icon={false}>
                  {formatNaira(target - targetSaved)} to go
                </Pill>
              )
            ) : null}
          </div>
          {target !== null && target > 0 && (
            <>
              <div
                className="mt-3 h-2.5 overflow-hidden rounded-pill bg-soft"
                role="progressbar"
                aria-valuenow={targetPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progress toward ${targetPeriod.monthName} target`}
              >
                <i
                  className={`block h-full rounded-pill transition-[width] duration-700 ${targetSaved >= target ? "bg-ok" : "bg-linear-to-r from-brand to-gold"}`}
                  style={{ width: `${targetPct}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-xs font-semibold text-mute">
                <span>
                  {formatNaira(targetSaved)} saved this month · {targetPct}%
                </span>
                <span>Resets each month</span>
              </div>
            </>
          )}
          {!target && (
            <p className="mt-1 text-[13px] font-semibold text-mute">
              Set an optional goal for {targetPeriod.monthName} and we’ll track your
              progress.
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {summary.streak > 0 && (
              <span className="inline-flex h-6 items-center gap-1 rounded-pill bg-gold-tint px-2.5 text-xs font-extrabold text-pending">
                <Star size={13} />
                {summary.streak}-month streak
              </span>
            )}
            <span className="text-xs font-semibold text-mute">
              Target met in {monthsTargetMet} of {monthsInYear} months
            </span>
          </div>
          <button
            className="mt-2 text-sm font-bold text-brand"
            onClick={() => setTargetOpen(true)}
          >
            {target ? `Change ${targetPeriod.monthName} target` : "Set a target"}
          </button>
        </Card>
      )}

      {onTrack ? (
        <Banner tone="info" icon={<Shield size={20} />}>
          <b>Interest: on track for {year}.</b> Save at least{" "}
          {formatNaira(minimum)} in every month before it closes on the 5th.
        </Banner>
      ) : (
        <Banner tone="warn" icon={<TriangleAlert size={20} />}>
          <b>Interest for {year} is affected</b> because{" "}
          {defaultedMonths === 1
            ? "a month"
            : `${defaultedMonths} months`}{" "}
          closed with nothing saved. Your savings are safe and paid out in full.
        </Banner>
      )}

      {monthsUnavailable && (
        <Banner tone="warn" icon={<TriangleAlert size={20} />}>
          <b>We couldn’t load the month-by-month view.</b>{" "}
          <button
            className="font-bold underline"
            onClick={() => void reload()}
          >
            Try again
          </button>
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
        {savingsMonths.map((m) => {
          const state = rowState(m);
          const tile = TILE[state];
          const active =
            activeMonth?.year === m.year && activeMonth?.month === m.month;
          const catchUp = m.status.toLowerCase().includes("catch");
          const payments =
            m.contributionsCount > 1 ? ` · ${m.contributionsCount} payments` : "";
          const caption =
            state === "saved"
              ? `${m.closeNote || `Closed automatically after ${formatShortDate(parseDate(m.deadline))}`}${payments}`
              : state === "missed"
                ? `Nothing saved before ${formatShortDate(parseDate(m.deadline))}`
                : state === "open"
                  ? `Open · closes ${formatShortDate(parseDate(m.deadline))}${payments}`
                  : state === "ahead"
                    ? `Saving ahead${payments}`
                    : `Opens ${formatShortDate(new Date(m.year, m.month - 1, 1))}`;
          const highlight = state === "open" || state === "ahead";
          const dim = state === "upcoming";
          const right =
            state === "upcoming" ? (
              <Pill tone="mute" icon={false}>
                Upcoming
              </Pill>
            ) : (
              <span className="flex flex-col items-end gap-1">
                <b className="text-[15px] tabular-nums">
                  {formatNaira(m.savedAmount)}
                </b>
                {state === "saved" ? (
                  m.targetMet && m.targetAmount ? (
                    <Pill tone="ok" icon={<Check size={12} />}>
                      Target met
                    </Pill>
                  ) : (
                    <Pill tone="ok" icon={<Lock size={12} />}>
                      Saved
                    </Pill>
                  )
                ) : state === "missed" ? (
                  <Pill tone="fail" icon={<X size={12} />}>
                    Missed
                  </Pill>
                ) : (
                  <Pill tone="pending" icon={<Clock size={12} />}>
                    {state === "ahead" ? "Ahead" : "Open"}
                  </Pill>
                )}
              </span>
            );
          return (
            <div
              key={m.period || `${m.year}-${m.month}`}
              className={cn(
                "border-b border-line py-1 last:border-b-0",
                highlight &&
                  "-mx-2.5 rounded-input border-2 border-gold bg-[#fffbf2] px-2.5",
                dim && "opacity-60",
              )}
            >
              <div className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    "flex size-10.5 shrink-0 items-center justify-center rounded-input",
                    tile.cls,
                  )}
                >
                  {tile.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b>{m.monthName}</b>
                  <span className="text-[13px] font-semibold text-mute">
                    {caption}
                  </span>
                </span>
                {right}
              </div>
              {active && (
                <div className="flex flex-wrap gap-2 pb-3">
                  <ButtonLink to={paths.member.contribute} size="sm">
                    {catchUp ? "Pay catch-up" : "Pay now"}
                  </ButtonLink>
                </div>
              )}
            </div>
          );
        })}

        <div className="border-b border-line py-1 last:border-b-0">
          <div className="flex items-center gap-3 py-2.5">
            <span
              className={cn(
                "flex size-10.5 shrink-0 items-center justify-center rounded-input",
                TILE.payout.cls,
              )}
            >
              {TILE.payout.icon}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <b>December</b>
              <span className="text-[13px] font-semibold text-mute">
                Payout month · on or before {formatShortDate(payoutDate)}
              </span>
            </span>
            <Pill tone="gold" icon={false}>
              Payout
            </Pill>
          </div>
        </div>
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
            Savings are paid out on or before {formatShortDate(payoutDate)}.
          </span>
        </span>
        <ChevronRight size={18} className="text-ink" />
      </Link>

      <SavingsTargetModal
        open={targetOpen}
        onClose={() => setTargetOpen(false)}
        memberId={member.id}
        year={targetPeriod.year}
        monthName={targetPeriod.monthName}
        target={target}
        minimum={minimum}
        onSaved={() => void reload()}
      />

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
            every payment of at least {formatNaira(minimum)} is added to the open
            month.
          </p>
          <p>
            A month closes automatically at the end of the 5th of the next
            month. Once it has {formatNaira(minimum)} or more, you can also{" "}
            <b>lock</b> it early so your next payments count toward the
            following month.
          </p>
          <p>
            If a month closes with nothing saved, it’s recorded as missed and
            your interest for {year} may be affected. Your savings are always
            safe.
          </p>
        </div>
      </Modal>
    </div>
  );
}
