import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Info,
  Landmark,
  Lock,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type {
  ContributionPaymentMethod,
  WalletSnapshot,
} from "@/domain/entities";
import { useAuth } from "../../../contexts/AuthContext";
import { useContributionDraft } from "../../../contexts/ContributionDraftContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useSavings } from "../../../hooks/useSavings";
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  KeyValue,
  OpenDecisionTag,
  cn,
} from "../../../design-system";
import {
  MONTHS,
  chargeBreakdown,
  formatNaira,
  isCatchUp,
  planAllocation,
} from "@/domain/rules";
import { ContributeUseCase } from "@/domain/usecases/contribute";
import { paths } from "../../../routes/paths";

/** MEM-09/10 (v5): one total, including the ₦100 platform charge. No separate charge line elsewhere. */
export function ReviewPaymentPage() {
  const { session, updateMember } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const navigate = useNavigate();
  const draft = useContributionDraft();
  const member = session?.kind === "member" ? session.member : null;
  const { data } = useSavings(member);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<ContributionPaymentMethod>("Bank Account");
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  useEffect(() => {
    if (!member) return;
    let active = true;
    repos.wallet
      .getSnapshot(member.id)
      .then((s) => {
        if (active) setWallet(s);
      })
      .catch(() => {
        if (active) setWallet(null);
      });
    return () => {
      active = false;
    };
  }, [repos, member]);
  if (!draft.amount) return <Navigate to={paths.member.contribute} replace />;
  if (!member || !data) return <p className="text-mute">Loading…</p>;
  const { year, txs, now, settings } = data;
  const plan = planAllocation(draft.amount, year, txs, now, settings);
  if (!plan.ok) return <Navigate to={paths.member.contribute} replace />;
  const b = chargeBreakdown(draft.amount, settings.platformCharge);
  const a = plan.allocations;
  const goesTo =
    a.length > 1
      ? `${MONTHS[a[0].month]} – ${MONTHS[a[a.length - 1].month]} ${year.year}`
      : `${MONTHS[a[0].month]} ${year.year}`;
  const walletBalance = wallet?.availableKobo ?? 0;
  const walletShortfall = Math.max(0, b.total - walletBalance);
  const walletUnavailable = method === "Wallet" && (!wallet || walletShortfall > 0);
  const canPay = !busy && !walletUnavailable;
  const pay = async () => {
    if (!canPay) return;
    setBusy(true);
    try {
      const r = await new ContributeUseCase(
        repos.contribution,
        repos.gateway,
      ).pay(member.id, year, txs, draft.amount!, now, settings, method);
      if (r.communityUnlocked)
        updateMember({ ...member, community: "Eligible" });
      draft.setResult(r);
      navigate(paths.member.result);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto flex max-w-140 flex-col gap-4">
      <div className="flex h-13 items-center gap-3">
        <Link
          to={paths.member.contribute}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line bg-white"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-[19px] font-extrabold">Review payment</h1>
      </div>
      <div className="flex flex-col items-center gap-1 py-3">
        <span className="text-[13px] font-semibold text-mute">
          Total to pay
        </span>
        <span className="text-3xl font-extrabold break-words tabular-nums sm:text-[44px]">
          {formatNaira(b.total)}
        </span>
        <span className="text-[13px] font-semibold text-mute">
          Includes the {formatNaira(b.platformCharge)} platform charge
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold">Payment method</span>
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Payment method"
        >
          <button
            type="button"
            role="radio"
            aria-checked={method === "Bank Account"}
            onClick={() => setMethod("Bank Account")}
            className={cn(
              "flex items-start gap-3 rounded-card border p-4 text-left transition focus-visible:ring-[3px] focus-visible:ring-brand/25 focus-visible:outline-none",
              method === "Bank Account"
                ? "border-brand bg-brand-tint"
                : "border-line bg-white hover:border-brand/60",
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-input",
                method === "Bank Account"
                  ? "bg-brand text-white"
                  : "bg-soft text-brand-dark",
              )}
            >
              <Landmark size={20} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b>Bank Account</b>
              <span className="text-[13px] font-semibold text-mute">
                Pay securely with your bank account through Paystack.
              </span>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={method === "Wallet"}
            onClick={() => setMethod("Wallet")}
            className={cn(
              "flex items-start gap-3 rounded-card border p-4 text-left transition focus-visible:ring-[3px] focus-visible:ring-brand/25 focus-visible:outline-none",
              method === "Wallet"
                ? "border-brand bg-brand-tint"
                : "border-line bg-white hover:border-brand/60",
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-input",
                method === "Wallet"
                  ? "bg-brand text-white"
                  : "bg-soft text-brand-dark",
              )}
            >
              <Wallet size={20} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b>Wallet</b>
              <span className="text-[13px] font-semibold text-mute">
                {wallet
                  ? `Available balance ${formatNaira(wallet.availableKobo)}.`
                  : "Loading your wallet balance…"}
              </span>
              {method === "Wallet" && wallet && walletShortfall > 0 && (
                <span className="flex items-center gap-1 text-[13px] font-bold text-fail">
                  <TriangleAlert size={14} />
                  You need {formatNaira(walletShortfall)} more.
                </span>
              )}
            </span>
          </button>
        </div>
      </div>
      <Card>
        <KeyValue label="Goes to" value={goesTo} />
        <KeyValue label="Amount saved" value={formatNaira(b.amount)} />
        {a.length > 1 &&
          a.map((x) => (
            <KeyValue
              key={x.month}
              label={`· ${MONTHS[x.month]}${isCatchUp(year, x.month) ? " (catch-up)" : ""}`}
              value={formatNaira(x.amountKobo)}
            />
          ))}
      </Card>
      {method === "Bank Account" ? (
        <Banner tone="neutral" icon={<Info size={20} />}>
          You’ll pay on Paystack’s secure page. Your savings update only after
          Paystack confirms the payment.
        </Banner>
      ) : walletUnavailable ? (
        <Banner tone="fail" icon={<TriangleAlert size={20} />}>
          <b>
            {wallet
              ? "Your wallet balance is too low."
              : "We couldn’t load your wallet balance."}
          </b>{" "}
          {wallet
            ? `Top up at least ${formatNaira(walletShortfall)} or pay with your bank account.`
            : "Try again or pay with your bank account."}
        </Banner>
      ) : (
        <Banner tone="info" icon={<Wallet size={20} />}>
          The total will be debited from your wallet immediately. Your savings
          update right away.
        </Banner>
      )}
      {method === "Wallet" && walletUnavailable && wallet && (
        <ButtonLink to={paths.member.wallet} variant="outline" full>
          Top up wallet
        </ButtonLink>
      )}
      <Button
        full
        icon={method === "Wallet" ? <Wallet size={18} /> : <Lock size={18} />}
        disabled={!canPay}
        onClick={pay}
      >
        {busy
          ? method === "Wallet"
            ? "Paying from wallet…"
            : "Opening Paystack…"
          : method === "Wallet"
            ? `Pay ${formatNaira(b.total)} from wallet`
            : `Pay ${formatNaira(b.total)} with Paystack`}
      </Button>
      <ButtonLink to={paths.member.contribute} variant="outline" full>
        Change amount
      </ButtonLink>
      <OpenDecisionTag code="OD-06/07">
        Gateway fee and platform charge treatment
      </OpenDecisionTag>
    </div>
  );
}
