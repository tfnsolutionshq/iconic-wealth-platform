import { Link, Navigate } from "react-router-dom";
import { CalendarClock, Check, List, Lock, Plus, Users, X } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useSavingsDashboard } from "../../../hooks/useSavingsDashboard";
import { Button, ButtonLink, Card, Pill, cn } from "../../../design-system";
import { formatNaira, formatShortDate } from "@/domain/rules";
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
  const member = session?.kind === "member" ? session.member : null;
  const { data, error, reload } = useSavingsDashboard(member);
  if (!member) return <Navigate to={paths.login} replace />;
  if (error && !data)
    return (
      <Card className="mx-auto flex max-w-xl flex-col items-start gap-3">
        <b>We couldn’t load your dashboard</b>
        <p className="text-sm font-semibold text-mute">{error}</p>
        <Button onClick={() => void reload()}>Try again</Button>
      </Card>
    );
  if (!data) return <p className="text-mute">Loading…</p>;

  const { dashboard, recent, now, months } = data;
  const { summary, nextPeriod, activeMonth, payoutJourney, settings } =
    dashboard;
  const hasStarted = summary.totalMonths > 0 || summary.totalSaved > 0;
  const period = activeMonth ?? nextPeriod;
  const periodDate = parseDate(period.deadline);
  const payoutDate = parseDate(payoutJourney.payoutDate);

  return (
    <div className="mx-auto flex flex-col gap-4 max-w-245">
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
        <Card tone="night" className="p-4.5 gap-4 rounded-card">
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
              {!hasStarted ? null : summary.defaultedMonths === 0 ? (
                <Check size={10} strokeWidth={2.6} />
              ) : (
                <X size={10} strokeWidth={2.6} />
              )}
              {!hasStarted
                ? "Not started"
                : summary.defaultedMonths === 0
                  ? "Interest: on track"
                  : "Interest: forfeited"}
            </span>
          </div>

          {/* Amount saved */}
          <div className="text-[40px] font-extrabold tracking-tight tabular-nums my-2">
            {formatNaira(summary.savedThisYear)}
          </div>

          {/* Month tiles */}
          <div className="grid grid-cols-12 gap-1">
            {MONTH_SHORT.map((letter, i) => {
              const month = months[i];
              const isActiveMonth = activeMonth?.month === i + 1;
              const isDefaulted =
                month?.status === "defaulted" || month?.status === "missed";
              const isSaved =
                month?.status === "saved" || month?.status === "completed";
              const isDecember = i === 11;

              return (
                <div
                  key={i}
                  className="col-span-1 flex min-w-0 flex-col items-center gap-2"
                >
                  {/* Tile */}
                  <div
                    className={cn(
                      "aspect-13/9 w-full rounded-lg flex items-center justify-center transition-colors",
                      isDecember
                        ? "bg-[#4a2f45]"
                        : isSaved
                          ? "bg-brand"
                          : isDefaulted
                            ? "bg-red-500"
                            : isActiveMonth
                              ? "bg-transparent"
                              : "bg-white/10",
                      // Current month: thick white border (not on December)
                      isActiveMonth && !isDecember && "border-2 border-white",
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
                      isDefaulted && !isDecember
                        ? "text-red-400"
                        : "text-white/60",
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
          <div className="flex items-center justify-between gap-2 text-[13px] font-semibold text-white/75 mt-5">
            <span>
              {summary.totalMonths} of {TOTAL_MONTHS_IN_YEAR} months saved
            </span>
            <span>Payout by {formatShortDate(payoutDate)}</span>
          </div>
        </Card>

        <Card className="p-4.5 gap-4 rounded-card">
          {activeMonth ? (
            <>
              <div className="flex gap-2">
                <span className="flex size-10 items-center justify-center rounded-input bg-brand-tint text-brand-dark">
                  <CalendarClock size={20} />
                </span>
                <div className="flex-1 flex-col">
                  <b className="text-ink">{activeMonth.monthName} is open</b>
                  <span className="text-[13px] font-semibold text-mute">
                    Closes {formatShortDate(periodDate)}
                  </span>
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-mute">
                  Saved for {activeMonth.monthName}
                </span>
                <b className="text-ink">{formatNaira(summary.savedThisYear)}</b>
              </div>
              <div className="mt-1 flex gap-2">
                <ButtonLink
                  to={paths.member.contribute}
                  size="sm"
                  variant="primary"
                  full
                  className="flex-1"
                >
                  {hasStarted ? "Pay now" : "Make your first payment"}
                </ButtonLink>
                {hasStarted && (
                  <button
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-pill px-4 text-[13px] font-bold transition",
                      summary.defaultedMonths > 0
                        ? "bg-brand text-white hover:bg-brand-dark"
                        : "bg-white text-ink hover:bg-brand hover:text-white",
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
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card
          tone="soft"
          className="rounded-card border border-gray-200 bg-white"
        >
          <p className="text-[13px] font-semibold text-mute">Monthly target</p>
          <b className="text-[20px] font-extrabold">Not set</b>
        </Card>
        <Link to={paths.member.savings} className="block">
          <Card
            tone="soft"
            className="rounded-card border border-gray-200 bg-white"
          >
            <p className="text-[13px] font-semibold text-mute">Target streak</p>
            <b className="text-[20px] font-extrabold">
              {summary.streak} month{summary.streak === 1 ? "" : "s"}
            </b>
            <p className="text-[12px] font-semibold text-mute">
              Met in {summary.monthsTargetMet} of {TOTAL_MONTHS_IN_YEAR} months
            </p>
          </Card>
        </Link>
        <Link to={paths.member.payout} className="block">
          <Card
            tone="soft"
            className="rounded-card border border-gray-200 bg-white"
          >
            <p className="text-[13px] font-semibold text-mute">
              Year-end payout
            </p>
            <b className="text-[20px] font-extrabold">December</b>
            <p className="text-[12px] font-semibold text-mute">
              On or before {formatShortDate(payoutDate)}
            </p>
          </Card>
        </Link>
      </div>

      {member.community === "Locked" && (
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
      {member.community === "Eligible" && (
        <Card className="flex items-center gap-3 border-[#cdb8f6] bg-linear-to-b from-[#f7f2fe] to-white">
          <span className="flex size-10.5 items-center justify-center rounded-input bg-brand-tint text-brand-dark">
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
            className="inline-flex h-9 items-center rounded-pill bg-brand px-3.5 text-[13px] font-bold text-white"
            onClick={async () => {
              await repos.member.markCommunityJoined(member.id);
              updateMember({ ...member, community: "Granted" });
            }}
          >
            Join
          </a>
        </Card>
      )}

      <Card className="p-4.5 rounded-card">
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
    </div>
  );
}
