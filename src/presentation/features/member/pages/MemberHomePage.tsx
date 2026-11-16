import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  CalendarClock,
  Check,
  History,
  List,
  Lock,
  Plus,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useSavingsDashboard } from "../../../hooks/useSavingsDashboard";
import {
  Button,
  ButtonLink,
  Card,
  LoadingScreen,
  Pill,
  cn,
} from "../../../design-system";
import { formatNaira, formatShortDate, targetPeriodFor } from "@/domain/rules";
import { LockMonthModal } from "../components/LockMonthModal";
import { SavingsTargetModal } from "../components/SavingsTargetModal";
import { TxRow } from "../components/TransactionParts";
import { paths } from "../../../routes/paths";
import { env } from "@/app/config/env";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_SHORT = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];
const TOTAL_MONTHS_IN_YEAR = 11;

/** Parses the date-only payout date and the ISO deadline returned by GET /savings. */
function parseDate(value: string): Date {
  return value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
}

export function MemberHomePage() {
  const { session, updateMember } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const member = session?.kind === "member" ? session.member : null;
  const { data, error, reload } = useSavingsDashboard(member);
  const [targetOpen, setTargetOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);

  const hasConfirmedPaymentFromData = Boolean(
    data &&
      (data.dashboard.summary.totalMonths > 0 ||
        data.dashboard.summary.totalSaved > 0 ||
        data.dashboard.summary.savedThisYear > 0 ||
        (data.dashboard.activeMonth?.savedAmount ?? 0) > 0 ||
        (data.dashboard.activeMonth?.contributionsCount ?? 0) > 0 ||
        data.recent.some(
          (t) =>
            t.kind === "Contribution" &&
            t.status === "Successful" &&
            t.amountKobo >= data.dashboard.settings.minimumPerPayment,
        )),
  );

  useEffect(() => {
    if (
      member &&
      member.community === "Locked" &&
      hasConfirmedPaymentFromData
    ) {
      updateMember({ ...member, community: "Eligible" });
    }
  }, [member, hasConfirmedPaymentFromData, updateMember]);

  if (!member) return <Navigate to={paths.login} replace />;
  if (error && !data)
    return (
      <Card className="mx-auto flex max-w-xl flex-col items-start gap-3">
        <b>We couldn’t load your dashboard</b>
        <p className="text-sm font-semibold text-mute">{error}</p>
        <Button onClick={() => void reload()}>Try again</Button>
      </Card>
    );
  if (!data) return <LoadingScreen />;

  const { dashboard, recent, now, months, viewState } = data;
  const { summary, activeMonth, payoutJourney, settings } = dashboard;
  const {
    joinMonthName,
    isMonthCatchUp,
    isMonthSaved,
    catchUpMonthsLeft,
    isCatchUpMode,
    activeCatchUpMonthName,
    openPeriod,
  } = viewState;

  const effectiveActiveMonth = openPeriod ?? activeMonth;

  const minimum = settings.minimumPerPayment;
  const displaySavedTotal =
    summary.savedThisYear ||
    summary.totalSaved ||
    (effectiveActiveMonth?.savedAmount ?? 0);

  const savedMonthsCount = Array.from(
    { length: TOTAL_MONTHS_IN_YEAR },
    (_, i) => i + 1,
  ).filter(isMonthSaved).length;

  const hasStarted =
    savedMonthsCount > 0 ||
    summary.totalMonths > 0 ||
    summary.totalSaved > 0 ||
    displaySavedTotal > 0 ||
    (effectiveActiveMonth?.contributionsCount ?? 0) > 0;

  const effectiveDefaultedMonths = isCatchUpMode ? 0 : summary.defaultedMonths;
  const payoutDate = parseDate(payoutJourney.payoutDate);
  const targetPeriod = targetPeriodFor(now);
  const targetMonthNum = effectiveActiveMonth?.month ?? targetPeriod.month;
  const targetMonthName =
    effectiveActiveMonth?.monthName ?? targetPeriod.monthName;
  const targetYear = effectiveActiveMonth?.year ?? targetPeriod.year;
  const currentMonth = months.find(
    (m) => m.year === targetYear && m.month === targetMonthNum,
  );
  const target =
    effectiveActiveMonth?.targetAmount ?? currentMonth?.targetAmount ?? null;
  const targetSaved =
    viewState.monthSavedAmount(targetMonthNum) ||
    effectiveActiveMonth?.savedAmount ||
    currentMonth?.savedAmount ||
    0;
  const canEditTarget = !isCatchUpMode && Boolean(effectiveActiveMonth);
  const targetRemaining =
    effectiveActiveMonth?.remainingAmount ??
    (target ? Math.max(0, target - targetSaved) : 0);
  const targetMet = Boolean(
    effectiveActiveMonth?.targetMet ??
      (target !== null && target > 0 && targetSaved >= target),
  );
  const targetPct =
    effectiveActiveMonth?.progressPercentage != null
      ? Math.min(100, Math.round(effectiveActiveMonth.progressPercentage))
      : target
        ? Math.min(100, Math.round((targetSaved / target) * 100))
        : 0;

  const monthsTargetMetCount = Math.max(
    summary.monthsTargetMet,
    savedMonthsCount,
  );
  const streakCount = Math.max(summary.streak, monthsTargetMetCount);

  const activeDeadlineDate = effectiveActiveMonth
    ? parseDate(effectiveActiveMonth.deadline)
    : null;
  const daysLeft = activeDeadlineDate
    ? Math.max(
        0,
        Math.ceil((activeDeadlineDate.getTime() - now.getTime()) / 86_400_000),
      )
    : null;

  const catchLeftCount = catchUpMonthsLeft.length;

  const hasConfirmedPayment =
    hasStarted ||
    recent.some(
      (t) =>
        t.kind === "Contribution" &&
        t.status === "Successful" &&
        t.amountKobo >= minimum,
    );

  const communityState =
    member.community === "Granted"
      ? "Granted"
      : hasConfirmedPayment || member.community === "Eligible"
        ? "Eligible"
        : "Locked";

  return (
    <div className="mx-auto flex max-w-245 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-mute">
            {now.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <h1 className="text-[28px] font-extrabold tracking-tight">
            Hello, {member.firstName}
          </h1>
        </div>
        <ButtonLink
          to={paths.member.contribute}
          size="md"
          variant="primary"
          icon={<Plus size={18} />}
          className="hidden md:inline-flex"
        >
          Contribute
        </ButtonLink>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card tone="night" className="gap-4 rounded-card p-4.5">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-white/70">
              Saved in {summary.year}
            </span>
            <span
              className={cn(
                "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold",
                "bg-white/14 text-white",
              )}
            >
              {!hasStarted ? null : effectiveDefaultedMonths === 0 ? (
                <Check size={10} strokeWidth={2.6} />
              ) : (
                <X size={10} strokeWidth={2.6} />
              )}
              {!hasStarted
                ? "Not started"
                : effectiveDefaultedMonths === 0
                  ? "Interest: on track"
                  : "Interest: forfeited"}
            </span>
          </div>

          {/* Amount saved */}
          <div className="my-2 text-[40px] font-extrabold tracking-tight tabular-nums">
            {formatNaira(displaySavedTotal)}
          </div>

          {/* Month tiles */}
          <div className="grid grid-cols-12 gap-1">
            {MONTH_SHORT.map((letter, i) => {
              const monthNum = i + 1;
              const month =
                months.find((m) => m.month === monthNum) ?? months[i];
              const isDecember = i === 11;
              const isSaved = !isDecember && isMonthSaved(monthNum);
              const isCatchUpTile =
                !isDecember && isMonthCatchUp(monthNum) && !isSaved;
              const isDefaulted =
                !isDecember &&
                !isSaved &&
                !isCatchUpTile &&
                !isCatchUpMode &&
                (month?.status === "defaulted" || month?.status === "missed");
              const isActiveNormalMonth =
                !isDecember &&
                !isCatchUpMode &&
                effectiveActiveMonth?.month === monthNum;

              return (
                <div
                  key={i}
                  className="col-span-1 flex min-w-0 flex-col items-center gap-2"
                >
                  {/* Tile */}
                  <div
                    className={cn(
                      "flex aspect-13/9 w-full items-center justify-center rounded-lg transition-colors",
                      isDecember
                        ? "bg-[#4a2f45]"
                        : isSaved
                          ? "bg-[#9B6BF2]"
                          : isCatchUpTile
                            ? "border-2 border-dashed border-gold bg-transparent text-gold"
                            : isDefaulted
                              ? "border-[1.5px] border-dashed border-fail bg-red-500/30"
                              : isActiveNormalMonth
                                ? "bg-transparent"
                                : "bg-white/10",
                      isActiveNormalMonth && "border-2 border-white",
                    )}
                  >
                    {isDecember ? (
                      <span className="text-sm font-bold text-[#f5c27a]">
                        ₦
                      </span>
                    ) : isSaved ? (
                      <Check size={14} strokeWidth={3} className="text-white" />
                    ) : isDefaulted ? (
                      <X size={14} strokeWidth={3} className="text-white" />
                    ) : null}
                  </div>

                  {/* Month letter below the tile */}
                  <span
                    className={cn(
                      "text-[10.5px] font-bold leading-none",
                      isDefaulted ? "text-red-400" : "text-white/60",
                    )}
                    title={MONTH_NAMES[i]}
                  >
                    {letter}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer row */}
          <div className="mt-5 flex items-center justify-between gap-2 text-[13px] font-semibold text-white/75">
            <span>
              {savedMonthsCount} of {TOTAL_MONTHS_IN_YEAR} months saved
            </span>
            <span>Payout by {formatShortDate(payoutDate)}</span>
          </div>
        </Card>

        <div className="flex flex-col justify-between gap-4 rounded-card border-2 border-gold bg-[#FFFBF2] p-5">
          {isCatchUpMode ? (
            <>
              <div className="flex items-start gap-3">
                <span className="flex size-10.5 shrink-0 items-center justify-center rounded-input bg-[#FDF3E4] text-[#7A5410]">
                  <History size={20} strokeWidth={2.2} />
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  <b className="text-[16px] font-extrabold text-ink">
                    Catch-up:{" "}
                    {activeCatchUpMonthName ??
                      dashboard.nextPeriod?.monthName ??
                      activeMonth?.monthName ??
                      "January"}
                  </b>
                  <span className="text-[13px] leading-relaxed font-semibold text-mute">
                    {joinMonthName
                      ? `You joined in ${joinMonthName}. Clear ${catchLeftCount} catch-up month${catchLeftCount === 1 ? "" : "s"} (${formatNaira(minimum)} each) before ${joinMonthName} savings count.`
                      : `Clear ${catchLeftCount} catch-up month${catchLeftCount === 1 ? "" : "s"} (${formatNaira(minimum)} each) before regular monthly savings count.`}
                  </span>
                </div>
              </div>
              <ButtonLink to={paths.member.contribute} variant="primary" full>
                Pay catch-up
              </ButtonLink>
            </>
          ) : effectiveActiveMonth ? (
            <>
              <div className="flex gap-2.5">
                <span className="flex size-10.5 shrink-0 items-center justify-center rounded-input bg-[#faefd4] text-[#8a5b0d]">
                  <CalendarClock size={20} />
                </span>
                <div className="flex flex-1 flex-col">
                  <b className="text-ink">
                    {effectiveActiveMonth.monthName} is open
                  </b>
                  <span className="text-[13px] font-semibold text-mute">
                    Closes{" "}
                    {formatShortDate(parseDate(effectiveActiveMonth.deadline))}
                    {daysLeft !== null
                      ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
                      : ""}
                  </span>
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-mute">
                  Saved for {effectiveActiveMonth.monthName}
                </span>
                <b className="tabular-nums text-ink">
                  {formatNaira(targetSaved)}
                </b>
              </div>
              <div className="mt-1 flex gap-2.5">
                <ButtonLink
                  to={paths.member.contribute}
                  variant="primary"
                  full
                  className="flex-1"
                >
                  {hasStarted ? "Pay now" : "Make your first payment"}
                </ButtonLink>
                {hasStarted && (
                  <button
                    type="button"
                    onClick={() => {
                      if (targetSaved >= minimum) {
                        setLockOpen(true);
                      } else {
                        toast(
                          `You can lock ${effectiveActiveMonth.monthName} once it has at least ${formatNaira(minimum)}.`,
                        );
                      }
                    }}
                    className={cn(
                      "inline-flex min-h-12 items-center justify-center gap-2 rounded-pill border-[1.5px] px-4.5 text-[15px] font-bold transition",
                      targetSaved >= minimum
                        ? "border-line bg-white text-ink hover:border-brand"
                        : "cursor-not-allowed border-transparent bg-[#EAE6F2] text-mute",
                    )}
                  >
                    <Lock size={18} /> Lock
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <b>All {summary.year} savings months are locked</b>
              <span className="text-[13px] font-semibold text-mute">
                Your savings are paid out on or before{" "}
                {formatShortDate(payoutDate)}.
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {isCatchUpMode || !canEditTarget ? (
          <Card
            tone="soft"
            className={cn(
              "h-full rounded-card border bg-white",
              !isCatchUpMode && target && targetMet
                ? "border-[#bfe3d5] bg-linear-to-b from-[#f3fbf7] to-white"
                : "border-gray-200",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-semibold text-mute">
                {!isCatchUpMode && target
                  ? `${targetMonthName} target`
                  : "Monthly target"}
              </p>
              {!isCatchUpMode && target ? (
                targetMet ? (
                  <Pill tone="ok" icon={<Check size={12} />}>
                    Target met
                  </Pill>
                ) : (
                  <Pill tone="gold" icon={false}>
                    {formatNaira(targetRemaining)} to go
                  </Pill>
                )
              ) : null}
            </div>
            <b className="text-[20px] font-extrabold">
              {target ? formatNaira(target) : "Not set"}
            </b>
            {!isCatchUpMode && target ? (
              <>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-pill bg-soft"
                  role="progressbar"
                  aria-valuenow={targetPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progress toward ${targetMonthName} target`}
                >
                  <i
                    className={cn(
                      "block h-full rounded-pill transition-[width] duration-700",
                      targetMet
                        ? "bg-ok"
                        : "bg-linear-to-r from-brand to-gold",
                    )}
                    style={{ width: `${targetPct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] font-semibold text-mute">
                  <span>
                    {formatNaira(targetSaved)} saved this month · {targetPct}%
                  </span>
                  <span>Locked</span>
                </div>
              </>
            ) : null}
          </Card>
        ) : (
          <button
            type="button"
            className="block h-full text-left"
            aria-haspopup="dialog"
            aria-label={
              target
                ? `Change ${targetMonthName} savings target`
                : `Set a savings target for ${targetMonthName}`
            }
            onClick={() => setTargetOpen(true)}
          >
            <Card
              tone="soft"
              className={cn(
                "h-full rounded-card border bg-white",
                targetMet
                  ? "border-[#bfe3d5] bg-linear-to-b from-[#f3fbf7] to-white"
                  : "border-gray-200",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold text-mute">
                  {target ? `${targetMonthName} target` : "Monthly target"}
                </p>
                {target ? (
                  targetMet ? (
                    <Pill tone="ok" icon={<Check size={12} />}>
                      Target met
                    </Pill>
                  ) : (
                    <Pill tone="gold" icon={false}>
                      {formatNaira(targetRemaining)} to go
                    </Pill>
                  )
                ) : null}
              </div>
              <b className="text-[20px] font-extrabold">
                {target ? formatNaira(target) : "Not set"}
              </b>
              {target ? (
                <>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-pill bg-soft"
                    role="progressbar"
                    aria-valuenow={targetPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progress toward ${targetMonthName} target`}
                  >
                    <i
                      className={cn(
                        "block h-full rounded-pill transition-[width] duration-700",
                        targetMet
                          ? "bg-ok"
                          : "bg-linear-to-r from-brand to-gold",
                      )}
                      style={{ width: `${targetPct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] font-semibold text-mute">
                    <span>
                      {formatNaira(targetSaved)} saved this month · {targetPct}%
                    </span>
                    <span>Resets each month</span>
                  </div>
                  <p className="mt-2 text-[12px] font-bold text-brand">
                    Change {targetMonthName} target
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[12px] font-bold text-brand">
                  Set a target for {targetMonthName}
                </p>
              )}
            </Card>
          </button>
        )}

        <Link to={paths.member.savings} className="block">
          <Card
            tone="soft"
            className="h-full rounded-card border border-gray-200 bg-white"
          >
            <p className="text-[13px] font-semibold text-mute">Target streak</p>
            <b className="text-[20px] font-extrabold">
              {streakCount} month{streakCount === 1 ? "" : "s"}
            </b>
            <p className="text-[12px] font-semibold text-mute">
              Met in {monthsTargetMetCount} of {TOTAL_MONTHS_IN_YEAR} months ›
            </p>
          </Card>
        </Link>
        <Link to={paths.member.payout} className="block">
          <Card
            tone="soft"
            className="h-full rounded-card border border-gray-200 bg-white"
          >
            <p className="text-[13px] font-semibold text-mute">
              Year-end payout
            </p>
            <b className="text-[20px] font-extrabold">December</b>
            <p className="text-[12px] font-semibold text-mute">
              On or before {formatShortDate(payoutDate)} ›
            </p>
          </Card>
        </Link>
      </div>

      {communityState === "Locked" && (
        <Card className="flex flex-wrap items-center gap-3">
          <span className="flex size-10.5 items-center justify-center rounded-input bg-soft">
            <Lock size={20} />
          </span>
          <span className="flex flex-1 flex-col">
            <b>WhatsApp community</b>
            <span className="text-[13px] font-semibold text-mute">
              Unlocks after your first payment of at least{" "}
              {formatNaira(settings.minimumPerPayment)} is confirmed.
            </span>
          </span>
          <Pill tone="mute" icon={<Lock size={12} />}>
            Locked
          </Pill>
        </Card>
      )}
      {communityState === "Eligible" && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-[#cdb8f6] bg-linear-to-b from-[#f7f2fe] to-white p-4.5">
          <span className="flex size-10.5 shrink-0 items-center justify-center rounded-input bg-brand-tint text-brand-dark">
            <Users size={20} />
          </span>
          <span className="flex flex-1 flex-col">
            <b>You’re in! Join the WhatsApp community</b>
            <span className="text-[13px] font-semibold text-mute">
              Reminders, announcements and support from other members.
            </span>
          </span>
          <a
            href={env.waCommunityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-pill bg-brand px-4.5 text-[14px] font-bold text-white transition hover:bg-brand-dark"
            onClick={async () => {
              await repos.member.markCommunityJoined(member.id).catch(() => {});
              updateMember({ ...member, community: "Granted" });
            }}
          >
            Join
          </a>
        </div>
      )}

      <Card className="rounded-card p-4.5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[19px] font-extrabold tracking-[-0.01em]">
            Recent activity
          </h2>
          <Link
            to={paths.member.activity}
            className="text-sm font-bold text-brand"
          >
            See all
          </Link>
        </div>
        {recent?.length ? (
          recent.map((t) => <TxRow key={t.id} t={t} />)
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-mute">
            <List size={28} />
            <b>No payments yet</b>
            <span>Your contributions will show here with their status.</span>
          </div>
        )}
      </Card>

      {canEditTarget && (
        <SavingsTargetModal
          open={targetOpen}
          onClose={() => setTargetOpen(false)}
          memberId={member.id}
          year={targetYear}
          monthName={targetMonthName}
          target={target}
          minimum={settings.minimumPerPayment}
          onSaved={() => void reload()}
        />
      )}

      {effectiveActiveMonth && !isCatchUpMode && (
        <LockMonthModal
          open={lockOpen}
          onClose={() => setLockOpen(false)}
          memberId={member.id}
          year={effectiveActiveMonth.year}
          month={effectiveActiveMonth.month}
          monthId={
            effectiveActiveMonth.id ??
            viewState.monthSavingsId(effectiveActiveMonth.month)
          }
          monthName={effectiveActiveMonth.monthName}
          savedAmount={targetSaved}
          deadline={parseDate(effectiveActiveMonth.deadline)}
          onLocked={() => void reload()}
        />
      )}
    </div>
  );
}
