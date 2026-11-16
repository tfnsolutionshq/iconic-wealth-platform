import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  History,
  Lock,
  Shield,
  Star,
  TriangleAlert,
  X,
} from "lucide-react";
import type { SavingsMonth } from "@/domain/entities";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { useSavingsDashboard } from "../../../hooks/useSavingsDashboard";
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  LoadingScreen,
  Modal,
  Pill,
  cn,
} from "../../../design-system";
import {
  MONTHS,
  deadlineFor,
  formatNaira,
  formatShortDate,
  targetPeriodFor,
} from "@/domain/rules";
import type { MonthIndex } from "@/domain/entities";
import { paths } from "../../../routes/paths";
import { LockMonthModal } from "../components/LockMonthModal";
import { SavingsTargetModal } from "../components/SavingsTargetModal";

/** Parses the date-only payout date and the ISO deadlines returned by GET /savings. */
function parseDate(value: string): Date {
  return value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
}

const MISSED_STATUSES = new Set(["defaulted", "missed", "late"]);
const AHEAD_STATUSES = new Set(["ahead", "saving_ahead"]);

type RowState =
  | "saved"
  | "missed"
  | "open"
  | "ahead"
  | "catchup"
  | "catchwait"
  | "next"
  | "upcoming"
  | "payout";

const TILE: Record<RowState, { cls: string; icon: React.ReactNode }> = {
  saved: { cls: "bg-brand-tint text-brand-dark", icon: <Check size={18} /> },
  missed: { cls: "bg-fail-tint text-fail", icon: <X size={18} /> },
  open: { cls: "bg-gold-tint text-[#7a5410]", icon: <Clock size={18} /> },
  ahead: { cls: "bg-gold-tint text-[#7a5410]", icon: <Calendar size={18} /> },
  catchup: { cls: "bg-gold-tint text-[#7a5410]", icon: <History size={18} /> },
  catchwait: { cls: "bg-soft text-ink", icon: <History size={18} /> },
  next: { cls: "bg-soft text-ink", icon: <Calendar size={18} /> },
  upcoming: { cls: "bg-soft text-ink", icon: <Calendar size={18} /> },
  payout: { cls: "bg-brand-tint text-brand-dark", icon: <Lock size={18} /> },
};

/**
 * MEM-06 (v5): the member's savings year, backed by GET /savings and
 * GET /savings/months?year=. The dashboard supplies the year summary and
 * payout journey; the months endpoint supplies each month's saved amount and
 * status. Interactive target changes use POST /savings/target.
 */
export function SavingsPage() {
  const { session } = useAuth();
  const toast = useToast();
  const member = session?.kind === "member" ? session.member : null;
  const { data, error, reload } = useSavingsDashboard(member);
  const [targetOpen, setTargetOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  if (!member) return <Navigate to={paths.login} replace />;
  if (error && !data)
    return (
      <Card className="mx-auto flex max-w-xl flex-col items-start gap-3">
        <b>We couldn’t load your savings</b>
        <p className="text-sm font-semibold text-mute">{error}</p>
        <Button onClick={() => void reload()}>Try again</Button>
      </Card>
    );
  if (!data) return <LoadingScreen />;

  const { dashboard, months, now, viewState } = data;
  const { summary, activeMonth, payoutJourney, settings } = dashboard;
  const {
    joinMonth,
    isMonthCatchUp,
    isMonthSaved,
    monthSavedAmount,
    monthPayments,
    monthSavingsId,
    isCatchUpMode,
    activeCatchUpMonth,
    activeCatchUpMonthName,
    openPeriod,
  } = viewState;

  const effectiveActiveMonth = openPeriod ?? activeMonth;
  const year =
    effectiveActiveMonth?.year ?? dashboard.nextPeriod?.year ?? summary.year;
  const minimum = settings.minimumPerPayment;

  // Build full 11-month list (Jan..Nov) so every month row is always shown
  const savingsMonths: SavingsMonth[] = Array.from(
    { length: 11 },
    (_, index) => {
      const mNum = index + 1;
      const existing = months.find((m) => m.month === mNum);
      const isAct = effectiveActiveMonth?.month === mNum;
      const pays = monthPayments(mNum);
      const dl =
        existing?.deadline ||
        (isAct ? effectiveActiveMonth?.deadline : null) ||
        deadlineFor(year, index as MonthIndex).toISOString();
      return {
        id:
          monthSavingsId(mNum) ??
          existing?.id ??
          (isAct ? (effectiveActiveMonth?.id ?? null) : null),
        year,
        month: mNum,
        period: `${year}-${String(mNum).padStart(2, "0")}`,
        monthName: existing?.monthName ?? MONTHS[index],
        status:
          existing?.status ??
          (isAct ? (effectiveActiveMonth?.status ?? "open") : "upcoming"),
        statusLabel:
          existing?.statusLabel ??
          (isAct ? (effectiveActiveMonth?.statusLabel ?? "Open") : "Upcoming"),
        targetAmount:
          existing?.targetAmount ??
          (isAct ? (effectiveActiveMonth?.targetAmount ?? null) : null),
        savedAmount: monthSavedAmount(mNum),
        remainingAmount:
          existing?.remainingAmount ??
          (isAct ? (effectiveActiveMonth?.remainingAmount ?? 0) : 0),
        progressPercentage:
          existing?.progressPercentage ??
          (isAct ? (effectiveActiveMonth?.progressPercentage ?? null) : null),
        targetMet:
          existing?.targetMet ??
          (isAct ? Boolean(effectiveActiveMonth?.targetMet) : false),
        contributionsCount: Math.max(
          pays.length,
          existing?.contributionsCount ?? 0,
          isAct ? (effectiveActiveMonth?.contributionsCount ?? 0) : 0,
        ),
        closeNote:
          existing?.closeNote ??
          (isAct ? (effectiveActiveMonth?.closeNote ?? "") : ""),
        deadline: dl,
      };
    },
  );

  const activeTargetMonthNum = isCatchUpMode
    ? activeCatchUpMonth
    : (effectiveActiveMonth?.month ?? null);

  const resolveRowState = (m: SavingsMonth): RowState => {
    const isCatch = isMonthCatchUp(m.month);
    const saved = isMonthSaved(m.month);
    const active = activeTargetMonthNum === m.month;
    const statusLower = m.status.toLowerCase();

    if (isCatch) {
      if (saved) return "saved";
      if (active) return "catchup";
      return "catchwait";
    }
    if (MISSED_STATUSES.has(statusLower)) return "missed";
    if (active) {
      return AHEAD_STATUSES.has(statusLower) ? "ahead" : "open";
    }
    if (saved) return "saved";
    if (
      isCatchUpMode &&
      joinMonth !== null &&
      m.month === joinMonth &&
      new Date(m.year, m.month - 1, 1) <= now
    ) {
      return "next";
    }
    return "upcoming";
  };

  const monthsInYear = 11;
  const savedMonths =
    summary.totalMonths ||
    savingsMonths.filter((m) => isMonthSaved(m.month)).length;
  const defaultedMonths =
    summary.defaultedMonths ||
    savingsMonths.filter((m) => resolveRowState(m) === "missed").length;
  const monthsTargetMet = Math.max(summary.monthsTargetMet, savedMonths);
  const streakCount = Math.max(summary.streak, savedMonths);
  const onTrack = defaultedMonths === 0;

  const targetPeriod = targetPeriodFor(now);
  const targetMonthName =
    effectiveActiveMonth?.monthName ?? targetPeriod.monthName;
  const targetYear = effectiveActiveMonth?.year ?? targetPeriod.year;
  const currentMonth = savingsMonths.find(
    (m) => m.month === (effectiveActiveMonth?.month ?? targetPeriod.month),
  );
  const target =
    effectiveActiveMonth?.targetAmount ?? currentMonth?.targetAmount ?? null;
  const targetSaved =
    effectiveActiveMonth?.savedAmount ?? currentMonth?.savedAmount ?? 0;
  const targetPct =
    effectiveActiveMonth?.progressPercentage != null
      ? Math.min(100, Math.round(effectiveActiveMonth.progressPercentage))
      : target
        ? Math.min(100, Math.round((targetSaved / target) * 100))
        : 0;
  const payoutDate = parseDate(payoutJourney.payoutDate);
  const displaySavedTotal =
    summary.savedThisYear ||
    summary.totalSaved ||
    (effectiveActiveMonth?.savedAmount ?? 0);

  // Target setting is hidden while in catch-up mode, and disabled once the open month is locked
  const showTarget = !isCatchUpMode;
  const canEditTarget = !isCatchUpMode && Boolean(effectiveActiveMonth);

  const activeNormalMonth =
    !isCatchUpMode && activeTargetMonthNum
      ? savingsMonths.find((m) => m.month === activeTargetMonthNum)
      : null;

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
            {formatNaira(displaySavedTotal)}
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
                {target ? `${targetMonthName} target` : "Monthly savings target"}
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
            ) : (
              <Pill tone="mute" icon={false}>
                Not set
              </Pill>
            )}
          </div>
          {target !== null && target > 0 && (
            <>
              <div
                className="mt-3 h-2.5 overflow-hidden rounded-pill bg-soft"
                role="progressbar"
                aria-valuenow={targetPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progress toward ${targetMonthName} target`}
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
              Set a goal for each month and we’ll track your progress and remind
              you until you reach it.
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {streakCount > 0 && (
              <span className="inline-flex h-6 items-center gap-1 rounded-pill bg-gold-tint px-2.5 text-xs font-extrabold text-pending">
                <Star size={13} />
                {streakCount}-month streak
              </span>
            )}
            <span className="text-xs font-semibold text-mute">
              Target met in {monthsTargetMet} of {monthsInYear} months
            </span>
          </div>
          {canEditTarget && (
            <button
              className="mt-2 text-sm font-bold text-brand"
              onClick={() => setTargetOpen(true)}
            >
              {target ? `Change ${targetMonthName} target` : "Set a target"}
            </button>
          )}
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
          {defaultedMonths === 1 ? "a month" : `${defaultedMonths} months`}{" "}
          closed with nothing saved. Your savings are safe and paid out in full.
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
          const state = resolveRowState(m);
          const tile = TILE[state];
          const isCatch = isMonthCatchUp(m.month);
          const active = activeTargetMonthNum === m.month;
          const pays = monthPayments(m.month);
          const canExpand = pays.length > 0;
          const isExpanded = canExpand && expandedMonth === m.month;
          const paymentsCount = Math.max(pays.length, m.contributionsCount);
          const payments =
            paymentsCount > 1 ? ` · ${paymentsCount} payments` : "";

          const caption =
            state === "saved"
              ? isCatch
                ? `Catch-up month · cleared${payments}`
                : `${m.closeNote || `Closed automatically after ${formatShortDate(parseDate(m.deadline))}`}${payments}`
              : state === "missed"
                ? `Nothing saved before ${formatShortDate(parseDate(m.deadline))}`
                : state === "catchup"
                  ? `Catch-up month · ${formatNaira(minimum)} needed`
                  : state === "catchwait"
                    ? "Catch-up month · waiting"
                    : state === "open"
                      ? `Open · closes ${formatShortDate(parseDate(m.deadline))}${payments}`
                      : state === "ahead"
                        ? `Saving ahead${payments}`
                        : state === "next"
                          ? `Opens for payments after ${activeCatchUpMonthName ?? activeMonth?.monthName ?? "current month"} closes or is locked`
                          : `Opens ${formatShortDate(new Date(m.year, m.month - 1, 1))}`;

          const highlight =
            state === "open" || state === "ahead" || state === "catchup";
          const dim = state === "upcoming";

          const right =
            state === "catchwait" ? (
              <Pill tone="mute" icon={false}>
                Catch-up
              </Pill>
            ) : state === "upcoming" || state === "next" ? (
              <Pill tone="mute" icon={false}>
                Upcoming
              </Pill>
            ) : (
              <span className="flex flex-col items-end gap-1">
                <b className="text-[15px] tabular-nums">
                  {formatNaira(m.savedAmount)}
                </b>
                {state === "saved" ? (
                  !isCatch && m.targetMet && m.targetAmount ? (
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

          const actions =
            active && highlight ? (
              <div className="flex flex-wrap gap-2 pb-3">
                <ButtonLink to={paths.member.contribute} size="sm">
                  {isCatch ? "Pay catch-up" : "Pay now"}
                </ButtonLink>
                {!isCatch && (
                  <button
                    type="button"
                    onClick={() => {
                      if (m.savedAmount >= minimum) {
                        setLockOpen(true);
                      } else {
                        toast(
                          `You can lock ${m.monthName} once it has at least ${formatNaira(minimum)}.`,
                        );
                      }
                    }}
                    className={cn(
                      "inline-flex min-h-9.5 items-center justify-center gap-1.5 rounded-pill border-[1.5px] px-3.5 text-[13px] font-bold transition",
                      m.savedAmount >= minimum
                        ? "border-line bg-white text-ink hover:border-brand"
                        : "cursor-not-allowed border-transparent bg-[#EAE6F2] text-mute",
                    )}
                  >
                    <Lock size={14} /> Lock
                  </button>
                )}
              </div>
            ) : null;

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
              <div
                className={cn(
                  "flex items-center gap-3 py-2.5",
                  canExpand && "cursor-pointer select-none",
                )}
                role={canExpand ? "button" : undefined}
                tabIndex={canExpand ? 0 : undefined}
                aria-expanded={canExpand ? isExpanded : undefined}
                onClick={
                  canExpand
                    ? () => setExpandedMonth(isExpanded ? null : m.month)
                    : undefined
                }
                onKeyDown={
                  canExpand
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedMonth(isExpanded ? null : m.month);
                        }
                      }
                    : undefined
                }
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
                  <b>{m.monthName}</b>
                  <span className="text-[13px] font-semibold text-mute">
                    {caption}
                  </span>
                </span>
                {right}
                {canExpand && (
                  <ChevronDown
                    size={16}
                    className={cn(
                      "shrink-0 text-mute transition-transform duration-200",
                      isExpanded && "rotate-180",
                    )}
                  />
                )}
              </div>
              {!isExpanded && actions}
              {isExpanded && (
                <div className="mb-3 rounded-input bg-soft px-3.5 py-1.5 sm:ml-13.5">
                  {pays.map((p) => (
                    <Link
                      key={p.id}
                      to={`${paths.member.activity}/${p.id}`}
                      className="flex items-center justify-between border-b border-line py-2.5 text-ink no-underline last-of-type:border-b-0"
                    >
                      <span className="flex flex-col gap-0.5">
                        <b className="text-[13px]">
                          {parseDate(p.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </b>
                        <span className="font-mono text-[11.5px] font-semibold text-mute">
                          {p.reference}
                        </span>
                      </span>
                      <b className="text-[13px] tabular-nums">
                        {formatNaira(p.amountKobo)}
                      </b>
                    </Link>
                  ))}
                  <div className="flex items-center justify-between border-t-[1.5px] border-line py-2.5">
                    <b className="text-[13px]">Total for {m.monthName}</b>
                    <b className="text-[13px] tabular-nums">
                      {formatNaira(m.savedAmount)}
                    </b>
                  </div>
                  {actions && <div className="pt-2">{actions}</div>}
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

      {canEditTarget && (
        <SavingsTargetModal
          open={targetOpen}
          onClose={() => setTargetOpen(false)}
          memberId={member.id}
          year={targetYear}
          monthName={targetMonthName}
          target={target}
          minimum={minimum}
          onSaved={() => void reload()}
        />
      )}

      {activeNormalMonth && !isCatchUpMode && (
        <LockMonthModal
          open={lockOpen}
          onClose={() => setLockOpen(false)}
          memberId={member.id}
          year={activeNormalMonth.year}
          month={activeNormalMonth.month}
          monthId={
            activeNormalMonth.id ?? monthSavingsId(activeNormalMonth.month)
          }
          monthName={activeNormalMonth.monthName}
          savedAmount={activeNormalMonth.savedAmount}
          deadline={parseDate(activeNormalMonth.deadline)}
          onLocked={() => void reload()}
        />
      )}

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
