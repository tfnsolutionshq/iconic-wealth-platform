import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Landmark,
  Shield,
  Wallet,
} from "lucide-react";
import type { PayoutDestination, Transaction } from "@/domain/entities";
import { formatNaira, payoutProjection } from "@/domain/rules";
import { useAuth } from "../../../contexts/AuthContext";
import { useSavings } from "../../../hooks/useSavings";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  Banner,
  Button,
  Card,
  OpenDecisionTag,
  Pill,
  cn,
} from "../../../design-system";
import { OtpModal } from "../../auth/components/AuthModals";
import { PayoutStatusView } from "../components/PayoutStatus";
import { paths } from "../../../routes/paths";

/** MEM-18/19: payout day — preview the year-end figure, choose a destination, confirm with OTP and track the payout. */
export function PayoutDayPage() {
  const { session } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const member = session?.kind === "member" ? session.member : null;
  const { data, reload } = useSavings(member);
  const [destination, setDestination] = useState<PayoutDestination | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [completed, setCompleted] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);

  if (!member || !data) return <p className="text-mute">Loading…</p>;

  const { year, txs, now, settings } = data;
  const payoutDate = new Date(
    `${settings.payoutDates[year.year] ?? `${year.year}-12-14`}T10:00`,
  );
  const projection = payoutProjection(year, txs, now, settings);
  const selected: PayoutDestination =
    destination ?? (member.payoutAccount ? "Bank account" : "Wallet");
  const canWithdraw =
    projection.totalKobo > 0 &&
    (selected === "Wallet" || !!member.payoutAccount);

  const latestPayout = [...txs]
    .filter(
      (t) =>
        t.kind === "Payout" && t.year === year.year && t.status !== "Failed",
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const payout = completed ?? latestPayout;
  if (payout) {
    return <PayoutStatusView payout={payout} onUpdated={reload} />;
  }

  const maskedPhone = member.phone.replace(
    /(\d{3})\s?(\d{3})\s?(\d{4})$/,
    "$1 ••• $3",
  );

  const requestPayout = async (): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      const tx = await repos.member.requestPayout(
        member.id,
        year.year,
        selected,
      );
      setCompleted(tx);
      setOtpOpen(false);
      toast(
        selected === "Wallet"
          ? "Payout added to your wallet."
          : "Withdrawal confirmed.",
      );
      void reload();
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const summary: [string, string][] = [
    [
      `${year.year} savings · ${projection.months} month${projection.months === 1 ? "" : "s"}`,
      formatNaira(projection.savingsKobo),
    ],
    [
      "Interest",
      projection.interestKobo
        ? formatNaira(projection.interestKobo)
        : "Not applicable",
    ],
    ["Charges deducted", formatNaira(0)],
  ];

  return (
    <div className="mx-auto flex max-w-140 flex-col gap-4">
      <div className="flex h-13 items-center gap-3">
        <Link
          to={paths.member.payout}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line bg-white"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-[19px] font-extrabold">Payout day</h1>
      </div>

      <div>
        <Pill tone="gold" icon={<CalendarDays size={14} />}>
          {payoutDate.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Pill>
      </div>

      <Card tone="night" className="flex flex-col gap-2 p-5.5">
        <span className="text-[13px] font-bold text-white/70">
          Ready to withdraw
        </span>
        <div className="text-3xl font-extrabold wrap-break-word tabular-nums sm:text-[40px]">
          {formatNaira(projection.totalKobo)}
        </div>
        <div className="mt-2 h-px w-full bg-white/15" />
        {summary.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 py-1.5 text-[15px]"
          >
            <span className="font-semibold text-white/70">{label}</span>
            <span className="font-extrabold tabular-nums">{value}</span>
          </div>
        ))}
      </Card>

      <Banner
        tone={projection.interestIncluded ? "info" : "warn"}
        icon={<Shield size={20} />}
      >
        {projection.interestIncluded
          ? "Every month had savings before it closed, so your interest is included."
          : "Interest isn’t included this year because a month closed with nothing saved."}
      </Banner>

      <div className="flex flex-col gap-2.5">
        <h2 className="text-base font-extrabold">Where should we send it?</h2>

        <button
          type="button"
          disabled={!member.payoutAccount}
          aria-pressed={selected === "Bank account"}
          onClick={() => setDestination("Bank account")}
          className={cn(
            "flex items-center gap-3 rounded-card border-2 bg-white p-4 text-left transition",
            selected === "Bank account"
              ? "border-brand ring-2 ring-brand/15"
              : "border-line hover:border-brand/40",
            !member.payoutAccount && "cursor-not-allowed opacity-60",
          )}
        >
          <span className="flex size-10.5 shrink-0 items-center justify-center rounded-input bg-soft">
            <Landmark size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b className="wrap-break-word">
              {member.payoutAccount
                ? `${member.payoutAccount.bankName} •••• ${member.payoutAccount.accountNumber.slice(-4)}`
                : "No payout account"}
            </b>
            <span className="text-[13px] font-semibold wrap-break-word text-mute">
              {member.payoutAccount
                ? member.payoutAccount.accountName
                : "Set one up in your profile, or choose your wallet."}
            </span>
          </span>
          {member.payoutAccount && (
            <Pill tone="ok" icon={<Check size={12} />}>
              Verified
            </Pill>
          )}
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
              selected === "Bank account"
                ? "border-brand bg-brand text-white"
                : "border-line",
            )}
          >
            {selected === "Bank account" && (
              <Check size={14} strokeWidth={3} />
            )}
          </span>
        </button>

        <button
          type="button"
          aria-pressed={selected === "Wallet"}
          onClick={() => setDestination("Wallet")}
          className={cn(
            "flex items-center gap-3 rounded-card border-2 bg-white p-4 text-left transition",
            selected === "Wallet"
              ? "border-brand ring-2 ring-brand/15"
              : "border-line hover:border-brand/40",
          )}
        >
          <span className="flex size-10.5 shrink-0 items-center justify-center rounded-input bg-soft">
            <Wallet size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b>Iconic Wealth Hub wallet</b>
            <span className="text-[13px] font-semibold text-mute">
              Instant — ready to spend or withdraw from your wallet.
            </span>
          </span>
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
              selected === "Wallet"
                ? "border-brand bg-brand text-white"
                : "border-line",
            )}
          >
            {selected === "Wallet" && <Check size={14} strokeWidth={3} />}
          </span>
        </button>
      </div>

      {!member.payoutAccount && (
        <Banner tone="warn" icon={<Landmark size={20} />}>
          No payout account yet.{" "}
          <Link to={paths.member.profile} className="font-bold text-brand">
            Set one up in your profile
          </Link>{" "}
          so bank withdrawals aren’t delayed. You can still use your wallet.
        </Banner>
      )}

      <p className="text-[13px] font-semibold leading-relaxed text-mute">
        {selected === "Wallet"
          ? "The full amount is paid into your wallet in one go. Figures assume all remaining months are paid on time."
          : "The full amount is paid in one transfer. Figures assume all remaining months are paid on time."}
      </p>

      <Button
        full
        disabled={!canWithdraw || busy}
        onClick={() => setOtpOpen(true)}
      >
        {projection.totalKobo > 0
          ? `Withdraw ${formatNaira(projection.totalKobo)}`
          : "Nothing to withdraw yet"}
      </Button>

      <OpenDecisionTag code="OD-01/02">
        Interest eligibility and calculation
      </OpenDecisionTag>

      <OtpModal
        open={otpOpen}
        destination={maskedPhone}
        title="Confirm withdrawal"
        confirmLabel={`Withdraw ${formatNaira(projection.totalKobo)}`}
        onCancel={() => setOtpOpen(false)}
        onConfirm={async (code) => {
          if (!/^\d{6}$/.test(code)) return false;
          return requestPayout();
        }}
      />
    </div>
  );
}
