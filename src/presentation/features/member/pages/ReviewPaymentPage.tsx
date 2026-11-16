import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Check,
  ChevronLeft,
  Copy,
  CreditCard,
  Info,
  Landmark,
  Lock,
  RefreshCw,
  Timer,
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
import { useSavingsDashboard } from "../../../hooks/useSavingsDashboard";
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  KeyValue,
  LoadingScreen,
  OpenDecisionTag,
  Pill,
  cn,
} from "../../../design-system";
import {
  BANK_TRANSFER_WINDOW_MS,
  DEFAULT_SETTINGS,
  MONTHS,
  bankTransferFor,
  chargeBreakdown,
  formatNaira,
} from "@/domain/rules";
import { paths } from "../../../routes/paths";

const BANK_WINDOW_MINUTES = Math.round(BANK_TRANSFER_WINDOW_MS / 60_000);

/**
 * MEM-09/10 (v5): choose how to pay — bank transfer, wallet or online (Paystack).
 * Only the online method includes the platform charge; the bank method shows the platform account
 * and a timed window before the member confirms they have paid.
 */
export function ReviewPaymentPage() {
  const { session } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const navigate = useNavigate();
  const draft = useContributionDraft();
  const member = session?.kind === "member" ? session.member : null;
  const { data } = useSavingsDashboard(member);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<ContributionPaymentMethod>("Online");
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [bankDeadline, setBankDeadline] = useState(
    () => Date.now() + BANK_TRANSFER_WINDOW_MS,
  );
  const [remaining, setRemaining] = useState(BANK_TRANSFER_WINDOW_MS);
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    if (method !== "Bank Account") return;
    const tick = () => setRemaining(Math.max(0, bankDeadline - Date.now()));
    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, [method, bankDeadline]);

  if (!draft.amount) return <Navigate to={paths.member.contribute} replace />;
  if (!member || !data) return <LoadingScreen />;

  const { dashboard, now, viewState } = data;
  const { activeMonth, summary, settings } = dashboard;
  const minimum = settings.minimumPerPayment;
  if (draft.amount < minimum) {
    return <Navigate to={paths.member.contribute} replace />;
  }

  const isCatchUpMode = viewState.isCatchUpMode;
  const effectiveOpenMonth = viewState.openPeriod ?? activeMonth;
  const activeMonthName =
    (isCatchUpMode ? viewState.activeCatchUpMonthName : null) ??
    effectiveOpenMonth?.monthName ??
    dashboard.nextPeriod?.monthName ??
    MONTHS[Math.min(now.getMonth(), 10)];
  const activeYear =
    effectiveOpenMonth?.year ?? dashboard.nextPeriod?.year ?? summary.year;

  const goesTo = `${activeMonthName} ${activeYear}${isCatchUpMode ? " (catch-up)" : ""}`;
  const b = chargeBreakdown(
    draft.amount,
    settings.platformChargePerPayment ?? DEFAULT_SETTINGS.platformCharge,
    method,
  );
  const bank = bankTransferFor(DEFAULT_SETTINGS);
  const walletBalance = wallet?.availableKobo ?? 0;
  const walletShortfall = Math.max(0, b.total - walletBalance);
  const walletUnavailable =
    method === "Wallet" && (!wallet || walletShortfall > 0);
  const bankExpired = method === "Bank Account" && remaining <= 0;
  const canPay = !busy && !walletUnavailable;
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  const countdown = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const windowPct = Math.max(
    0,
    Math.min(100, (remaining / BANK_TRANSFER_WINDOW_MS) * 100),
  );

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(bank.accountNumber);
      setCopied(true);
      toast("Account number copied.");
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      toast("Copy the account number manually.");
    }
  };
  const pay = async () => {
    if (!canPay) return;
    setBusy(true);
    try {
      const intent = await repos.contribution.initiate(
        member.id,
        activeYear,
        b.total,
        method,
      );

      if (!intent.accessCode && intent.authorizationUrl) {
        window.location.href = intent.authorizationUrl;
        return;
      }

      const outcome = await repos.gateway.checkout(intent);
      if (outcome === "closed") {
        setBusy(false);
        return;
      }

      draft.setResult(null);
      navigate(
        `${paths.member.result}?reference=${encodeURIComponent(intent.reference)}`,
      );
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };
  const methodTile = (selected: boolean) =>
    cn(
      "flex flex-col gap-2 rounded-card border p-3.5 text-left transition focus-visible:ring-[3px] focus-visible:ring-brand/25 focus-visible:outline-none",
      selected
        ? "border-brand bg-brand-tint"
        : "border-line bg-white hover:border-brand/60",
    );
  const methodIcon = (selected: boolean) =>
    cn(
      "flex size-9 shrink-0 items-center justify-center rounded-input",
      selected ? "bg-brand text-white" : "bg-soft text-brand-dark",
    );

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
          {b.platformCharge > 0
            ? `Includes the ${formatNaira(b.platformCharge)} platform charge`
            : "No platform charge with this payment method"}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold">Payment method</span>
        <div
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Payment method"
        >
          <button
            type="button"
            role="radio"
            disabled
            aria-disabled="true"
            aria-checked={false}
            className="flex cursor-not-allowed flex-col gap-2 rounded-card border border-line bg-soft/40 p-3.5 text-left opacity-60"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-input bg-soft text-mute">
                <Landmark size={20} />
              </span>
              <Pill tone="mute">Coming soon</Pill>
            </div>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-sm text-mute">Bank Account</b>
              <span className="text-[12px] leading-snug font-semibold text-mute">
                Direct transfer coming soon.
              </span>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            disabled
            aria-disabled="true"
            aria-checked={false}
            className="flex cursor-not-allowed flex-col gap-2 rounded-card border border-line bg-soft/40 p-3.5 text-left opacity-60"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-input bg-soft text-mute">
                <Wallet size={20} />
              </span>
              <Pill tone="mute">Coming soon</Pill>
            </div>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-sm text-mute">Wallet</b>
              <span className="text-[12px] leading-snug font-semibold text-mute">
                Wallet payment coming soon.
              </span>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={method === "Online"}
            onClick={() => setMethod("Online")}
            className={methodTile(method === "Online")}
          >
            <div className="flex items-center justify-between">
              <span className={methodIcon(method === "Online")}>
                <CreditCard size={20} />
              </span>
              <Pill tone="ok">Active</Pill>
            </div>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-sm">Online (Paystack)</b>
              <span className="text-[12px] leading-snug font-semibold text-mute">
                Card, bank, or USSD payment.
              </span>
            </span>
          </button>
        </div>
      </div>

      {method === "Bank Account" && (
        <Card className="flex flex-col gap-3 border-brand/35 bg-brand-tint/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-extrabold">
              Transfer to this account
            </span>
            <Pill
              tone={bankExpired ? "fail" : "pending"}
              icon={<Timer size={12} />}
            >
              {bankExpired ? "Window closed" : countdown}
            </Pill>
          </div>
          <KeyValue label="Bank" value={bank.bankName} />
          <div className="flex items-center justify-between gap-3 text-[15px]">
            <span className="shrink-0 font-semibold text-mute">
              Account number
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <b className="font-mono tracking-wide break-all">
                {bank.accountNumber}
              </b>
              <button
                type="button"
                onClick={copyAccount}
                aria-label="Copy account number"
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-white text-brand-dark transition hover:border-brand"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </span>
          </div>
          <KeyValue label="Account name" value={bank.accountName} />
          <KeyValue
            label="Amount to transfer"
            value={<b className="text-brand-dark">{formatNaira(b.total)}</b>}
          />
          <div className="flex flex-col gap-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-white">
              <div
                className={cn(
                  "h-full rounded-full",
                  bankExpired ? "bg-fail" : "bg-brand",
                )}
                style={{ width: `${windowPct}%` }}
              />
            </div>
            <span className="text-[12px] font-semibold text-mute">
              {bankExpired
                ? `This ${BANK_WINDOW_MINUTES}-minute window has closed. Start a new one to pay.`
                : `Transfer within ${countdown}. Tap “I have paid” once the transfer is done.`}
            </span>
          </div>
        </Card>
      )}

      <Card>
        <KeyValue label="Goes to" value={goesTo} />
        <KeyValue label="Amount saved" value={formatNaira(b.amount)} />
        <KeyValue
          label="Platform charge"
          value={b.platformCharge ? formatNaira(b.platformCharge) : "₦0"}
        />
        <KeyValue label="Total to pay" value={formatNaira(b.total)} />
      </Card>

      {method === "Bank Account" ? (
        bankExpired ? (
          <Banner tone="fail" icon={<Timer size={20} />}>
            <b>This transfer window has closed.</b> Start a new{" "}
            {BANK_WINDOW_MINUTES}-minute window to see the account details
            again.
          </Banner>
        ) : (
          <Banner tone="neutral" icon={<Info size={20} />}>
            Transfer the exact total to the account above, then tap “I have
            paid”. Your savings update only after we confirm the transfer.
          </Banner>
        )
      ) : method === "Wallet" ? (
        walletUnavailable ? (
          <Banner tone="fail" icon={<TriangleAlert size={20} />}>
            <b>
              {wallet
                ? "Your wallet balance is too low."
                : "We couldn’t load your wallet balance."}
            </b>{" "}
            {wallet
              ? `Top up at least ${formatNaira(walletShortfall)} or pay by bank transfer.`
              : "Try again or pay by bank transfer."}
          </Banner>
        ) : (
          <Banner tone="info" icon={<Wallet size={20} />}>
            {formatNaira(b.total)} will be debited from your wallet immediately.
            Your savings update right away.
          </Banner>
        )
      ) : (
        <Banner tone="info" icon={<Lock size={20} />}>
          You’ll pay {formatNaira(b.total)} on Paystack’s secure page — this
          includes the {formatNaira(b.platformCharge)} platform charge. Your
          savings update once Paystack confirms the payment.
        </Banner>
      )}

      {method === "Wallet" && walletUnavailable && wallet && (
        <ButtonLink to={paths.member.wallet} variant="outline" full>
          Top up wallet
        </ButtonLink>
      )}
      <Button
        full
        icon={
          method === "Bank Account" ? (
            bankExpired ? (
              <RefreshCw size={18} />
            ) : (
              <Check size={18} />
            )
          ) : method === "Wallet" ? (
            <Wallet size={18} />
          ) : (
            <Lock size={18} />
          )
        }
        disabled={!canPay || busy}
        onClick={pay}
      >
        {busy
          ? "Opening Paystack…"
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
