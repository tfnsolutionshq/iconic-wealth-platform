import { Link } from "react-router-dom";
import { Check, ChevronLeft, Landmark, Lock, Shield, X } from "lucide-react";
import {
  MONTHS,
  formatNaira,
  formatShortDate,
  interestOnTrack,
  openMonth,
  savedThisYear,
} from "@/domain/rules";
import { useAuth } from "../../../contexts/AuthContext";
import { useSavings } from "../../../hooks/useSavings";
import { Banner, Card, KeyValue, Pill } from "../../../design-system";
import { TxRow } from "../components/TransactionParts";
import { paths } from "../../../routes/paths";

/** MEM-17: where the payout is, eligibility, payout account and date. Withdrawals open on payout day only. */
export function PayoutPage() {
  const { session } = useAuth();
  const member = session?.kind === "member" ? session.member : null;
  const { data } = useSavings(member);

  if (!member || !data) return <p className="text-mute">Loading…</p>;
  const { year, txs, now, settings } = data;
  const cur = openMonth(year, now, settings);
  const payout = new Date(
    `${settings.payoutDates[year.year] ?? `${year.year}-12-14`}T10:00`,
  );
  const onTrack = interestOnTrack(year, txs, now, settings);
  const past = [...txs]
    .filter((t) => t.kind === "Payout")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const steps: [string, string, boolean][] = [
    [
      "Saving year",
      `January–November · ${cur != null ? `${MONTHS[cur]} open` : "all months saved"}`,
      true,
    ],
    [
      "Interest calculated",
      `After November closes on ${formatShortDate(new Date(year.year, 11, 5, 23, 59, 59))}`,
      false,
    ],
    ["Approval", "Interest and payout approved by Iconic Wealth Hub", false],
    ["Payout day", "You withdraw your savings and interest", false],
  ];

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
            Saved so far in {year.year}
          </span>
          <Pill tone="mute" icon={<Lock size={12} />}>
            Opens on payout day
          </Pill>
        </div>
        <div className="text-3xl font-extrabold break-words tabular-nums sm:text-4xl">
          {formatNaira(savedThisYear(year, txs))}
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
        {steps.map(([title, sub, current], i) => (
          <div key={title} className="flex items-center gap-3 py-1.5">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${current ? "bg-gold text-[#2a1a00]" : "bg-soft text-mute"}`}
            >
              {i + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              <b>{title}</b>
              <span className="text-[13px] font-semibold text-mute">{sub}</span>
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
