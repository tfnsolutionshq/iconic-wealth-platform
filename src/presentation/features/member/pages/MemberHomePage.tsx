import { Link } from "react-router-dom";
import { List, Lock, Plus, Users } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useSavings } from "../../../hooks/useSavings";
import { ButtonLink, Card, EmptyState, Pill, YearStrip } from "../../../design-system";
import {
  formatNaira,
  formatShortDate,
  interestOnTrack,
  isCatchUp,
  minimumFor,
  monthsSaved,
  openMonth,
  savedThisYear,
  targetHistory,
  targetStreak,
} from "@/domain/rules";
import { OpenMonthCard, TargetCard } from "../components/SavingsCards";
import { TxRow } from "../components/TransactionParts";
import { paths } from "../../../routes/paths";
import { env } from "@/app/config/env";

export function MemberHomePage() {
  const { session, updateMember } = useAuth();
  const { repos } = useServices();
  const member = session?.kind === "member" ? session.member : null;
  const { data, reload } = useSavings(member);
  if (!member || !data) return <p className="text-mute">Loading…</p>;
  const { year, txs, now, settings } = data;
  const first = !txs.some(
    (t) => t.status === "Successful" && t.kind === "Contribution",
  );
  const onTrack = interestOnTrack(year, txs, now, settings);
  const payout = new Date(
    `${settings.payoutDates[year.year] ?? year.year + "-12-14"}T10:00`,
  );
  const streak = targetStreak(year, txs, now, settings);
  const targetMonths = targetHistory(year, txs, now, settings);
  const metMonths = targetMonths.filter(Boolean).length;
  const currentMonth = openMonth(year, now, settings);
  const showTargetCard = currentMonth !== null && !isCatchUp(year, currentMonth);
  const recent = [...txs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  const props = {
    memberId: member.id,
    year,
    txs,
    now,
    settings,
    onChange: reload,
  };
  return (
    <div className="mx-auto flex max-w-245 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
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
          icon={<Plus size={18} />}
          className="hidden lg:inline-flex"
        >
          Contribute
        </ButtonLink>
      </div>
      <div className="grid gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <Card tone="night" className="flex flex-col gap-3.5 rounded-3xl">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-white/70">
              Saved in {year.year}
            </span>
            {first ? (
              <Pill tone="mute" icon={false}>
                Not started
              </Pill>
            ) : (
              <Pill tone={onTrack ? "brand" : "fail"}>
                {onTrack ? "Interest: on track" : "Interest: affected"}
              </Pill>
            )}
          </div>
          <div className="text-3xl font-extrabold tracking-tight wrap-break-word tabular-nums sm:text-[40px]">
            {formatNaira(savedThisYear(year, txs))}
          </div>
          <YearStrip
            year={year}
            txs={txs}
            now={now}
            settings={settings}
            onDark
          />
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-semibold text-white/75">
            <span>
              {monthsSaved(year, txs, settings)} of{" "}
              {settings.lastSavingsMonth + 1 - year.startMonth} months saved
            </span>
            <span>Payout by {formatShortDate(payout)}</span>
          </div>
        </Card>
        <OpenMonthCard {...props} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {showTargetCard ? (
          <TargetCard {...props} compact />
        ) : (
          <Card className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-mute">
              Monthly target
            </span>
            <b className="text-xl">
              {year.target ? formatNaira(year.target) : "Not set"}
            </b>
          </Card>
        )}
        <Link
          to={paths.member.savings}
          className="flex flex-col gap-1 rounded-card border border-line bg-white p-4.5 text-ink transition hover:bg-[#faf7fe]"
        >
          <span className="text-[13px] font-semibold text-mute">
            Target streak
          </span>
          <b className="text-xl">
            {streak} month{streak === 1 ? "" : "s"}
          </b>
          <span className="text-xs font-semibold text-mute">
            Met in {metMonths} of {targetMonths.length} months ›
          </span>
        </Link>
        <Link
          to={paths.member.payout}
          className="col-span-2 flex flex-col gap-1 rounded-card border border-line bg-white p-4.5 text-ink transition hover:bg-[#faf7fe] lg:col-span-1"
        >
          <span className="text-[13px] font-semibold text-mute">
            Year-end payout
          </span>
          <b className="text-xl">December</b>
          <span className="text-xs font-semibold text-mute">
            On or before {formatShortDate(payout)} ›
          </span>
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
              {formatNaira(minimumFor(settings, year.year))} is confirmed.
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
      <Card className="flex flex-col">
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
        {recent.length ? (
          recent.map((t) => <TxRow key={t.id} t={t} />)
        ) : (
          <EmptyState icon={<List size={28} />} title="No payments yet">
            Your contributions will show here with their status.
          </EmptyState>
        )}
      </Card>
    </div>
  );
}
