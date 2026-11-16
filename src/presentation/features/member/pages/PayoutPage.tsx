import { Link } from "react-router-dom";
import { Check, ChevronLeft, Landmark, Lock, Shield, X } from "lucide-react";
import { formatNaira, formatShortDate } from "@/domain/rules";
import { useAuth } from "../../../contexts/AuthContext";
import { useSavingsDashboard } from "../../../hooks/useSavingsDashboard";
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  KeyValue,
  LoadingScreen,
  Pill,
} from "../../../design-system";
import { TxRow } from "../components/TransactionParts";
import { PayoutStatusView } from "../components/PayoutStatus";
import { paths } from "../../../routes/paths";

/** Parses the date-only payout date and ISO timestamps returned by GET /savings. */
function parseDate(value: string): Date {
  return value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
}

/** MEM-17: where the payout is, eligibility, payout account and date. Withdrawals open on payout day only. */
export function PayoutPage() {
  const { session } = useAuth();
  const member = session?.kind === "member" ? session.member : null;
  const { data, error, reload } = useSavingsDashboard(member);

  if (!member) return <LoadingScreen />;
  if (error && !data)
    return (
      <Card className="mx-auto flex max-w-xl flex-col items-start gap-3">
        <b>We couldn’t load your payout details</b>
        <p className="text-sm font-semibold text-mute">{error}</p>
        <Button onClick={() => void reload()}>Try again</Button>
      </Card>
    );
  if (!data) return <LoadingScreen />;

  const { dashboard, recent, viewState } = data;
  const { summary, activeMonth, payoutJourney } = dashboard;
  const year = activeMonth?.year ?? summary.year;
  const displaySavedTotal =
    summary.savedThisYear ||
    summary.totalSaved ||
    (activeMonth?.savedAmount ?? 0);

  const payout = parseDate(payoutJourney.payoutDate);
  const onTrack = viewState.isCatchUpMode || summary.defaultedMonths === 0;

  const past = [...recent]
    .filter((t) => t.kind === "Payout")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const thisYearPayout = past.find(
    (t) => t.year === year && t.status !== "Failed",
  );

  if (thisYearPayout) {
    return <PayoutStatusView payout={thisYearPayout} onUpdated={reload} />;
  }

  return (
    <div className="mx-auto flex max-w-140 flex-col gap-4">
      <div className="flex h-13 items-center gap-3">
        <Link
          to={paths.member.home}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line bg-white"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-[19px] font-extrabold">Year-end payout</h1>
      </div>

      <Card tone="night" className="flex flex-col gap-2.5 p-5.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-white/70">
            Saved so far in {year}
          </span>
          <Pill tone="mute" icon={<Lock size={12} />}>
            Opens on payout day
          </Pill>
        </div>
        <div className="text-3xl font-extrabold break-words tabular-nums sm:text-4xl">
          {formatNaira(displaySavedTotal)}
        </div>
        <span className="text-[13px] font-semibold leading-relaxed text-white/75">
          Your full-year savings, plus interest if you stay eligible, are paid
          out on payout day.
        </span>
      </Card>

      <Card className="flex flex-col gap-1">
        <h2 className="mb-2.5 text-base font-extrabold">
          Where your payout is
        </h2>
        {payoutJourney.steps.map((s) => (
          <div key={s.step} className="flex items-center gap-3 py-1.5">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${
                s.completed
                  ? "bg-ok-tint text-ok"
                  : s.active
                    ? "bg-gold text-[#2a1a00]"
                    : "bg-soft text-mute"
              }`}
            >
              {s.completed ? <Check size={15} /> : s.step}
            </span>
            <span className="flex flex-col gap-0.5">
              <b>{s.title}</b>
              <span className="text-[13px] font-semibold text-mute">
                {s.description}
              </span>
            </span>
          </div>
        ))}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-[15px]">
          <span className="font-semibold text-mute">Interest eligibility</span>
          {onTrack ? (
            <Pill tone="ok" icon={<Shield size={12} />}>
              On track
            </Pill>
          ) : (
            <Pill tone="fail" icon={<X size={12} />}>
              Not eligible
            </Pill>
          )}
        </div>
        <KeyValue
          label="Paid to"
          value={
            member.payoutAccount
              ? `${member.payoutAccount.bankName} •••• ${member.payoutAccount.accountNumber.slice(-4)}`
              : member.isProfileComplete
                ? "Verified payout account"
                : "Not set"
          }
        />
        <KeyValue
          label="Payout day"
          value={`On or before ${formatShortDate(payout)}`}
        />
      </Card>

      {!onTrack && (
        <Banner tone="warn" icon={<Shield size={20} />}>
          Interest isn’t included this year because a month closed with nothing
          saved. Your savings are paid out in full.
        </Banner>
      )}

      <Banner tone="neutral" icon={<Lock size={20} />}>
        You can only withdraw on payout day. Until then, your savings stay with
        Iconic Wealth Hub.
      </Banner>

      {past.length > 0 && (
        <Card className="flex flex-col">
          <h2 className="mb-1 text-base font-extrabold">Past payouts</h2>
          {past.map((t) => (
            <TxRow key={t.id} t={t} />
          ))}
        </Card>
      )}

      <Card
        tone="soft"
        className="flex flex-col gap-2.5 border-2 border-dashed border-gold bg-[#fffaf0]"
      >
        <b className="text-sm">Demo · jump ahead to payout day</b>
        <ButtonLink
          to={paths.member.payoutDay}
          variant="gold"
          size="md"
          full
        >
          Preview payout day
        </ButtonLink>
      </Card>

      {member.payoutAccount ? (
        <Card className="flex items-center gap-3">
          <span className="flex size-10.5 items-center justify-center rounded-input bg-soft">
            <Landmark size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b>
              {member.payoutAccount.bankName} ••••{" "}
              {member.payoutAccount.accountNumber.slice(-4)}
            </b>
            <span className="text-[13px] font-semibold text-mute">
              {member.payoutAccount.accountName}
            </span>
          </span>
          <Pill tone="ok" icon={<Check size={12} />}>
            Verified
          </Pill>
        </Card>
      ) : member.isProfileComplete ? (
        <Card className="flex items-center gap-3">
          <span className="flex size-10.5 items-center justify-center rounded-input bg-soft">
            <Landmark size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b>Payout account on file</b>
            <span className="text-[13px] font-semibold text-mute">
              Your verified bank account will receive your year-end payout.
            </span>
          </span>
          <Pill tone="ok" icon={<Check size={12} />}>
            Verified
          </Pill>
        </Card>
      ) : (
        <Banner tone="warn" icon={<Landmark size={20} />}>
          No payout account yet.{" "}
          <Link to={paths.member.profile} className="font-bold text-brand">
            Set one up in your profile
          </Link>{" "}
          so payout day isn’t delayed.
        </Banner>
      )}
    </div>
  );
}
