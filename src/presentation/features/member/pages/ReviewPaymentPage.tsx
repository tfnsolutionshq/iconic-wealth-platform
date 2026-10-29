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
import { useSavings } from "../../../hooks/useSavings";
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  KeyValue,
  OpenDecisionTag,
  Pill,
  cn,
} from "../../../design-system";
import {
  BANK_TRANSFER_WINDOW_MS,
  MONTHS,
  bankTransferFor,
  chargeBreakdown,
  formatNaira,
  isCatchUp,
  planAllocation,
} from "@/domain/rules";
import { ContributeUseCase } from "@/domain/usecases/contribute";
import { paths } from "../../../routes/paths";

const BANK_WINDOW_MINUTES = Math.round(BANK_TRANSFER_WINDOW_MS / 60_000);

/**
 * MEM-09/10 (v5): choose how to pay — bank transfer, wallet or online (Paystack).
 * Only the online method includes the platform charge; the bank method shows the platform account
 * and a timed window before the member confirms they have paid.
 */
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
    const tick = () =>
      setRemaining(Math.max(0, bankDeadline - Date.now()));
    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, [method, bankDeadline]);

  if (!draft.amount) return <Navigate to={paths.member.contribute} replace />;
  if (!member || !data) return <p className="text-mute">Loading…</p>;
  const { year, txs, now, settings } = data;
  const plan = planAllocation(draft.amount, year, txs, now, settings);
  if (!plan.ok) return <Navigate to={paths.member.contribute} replace />;

  const b = chargeBreakdown(draft.amount, settings.platformCharge, method);
  const a = plan.allocations;
  const goesTo =
    a.length > 1
      ? `${MONTHS[a[0].month]} – ${MONTHS[a[a.length - 1].month]} ${year.year}`
      : `${MONTHS[a[0].month]} ${year.year}`;
  const bank = bankTransferFor(settings);
  const walletBalance = wallet?.availableKobo ?? 0;
  const walletShortfall = Math.max(0, b.total - walletBalance);
  const walletUnavailable = method === "Wallet" && (!wallet || walletShortfall > 0);
  const bankExpired = method === "Bank Account" && remaining <= 0;
  const canPay = !busy && !walletUnavailable;
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  const countdown = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const windowPct = Math.max(
    0,
    Math.min(100, (remaining / BANK_TRANSFER_WINDOW_MS) * 100),
  );

  const startNewWindow = () => {
    setBankDeadline(Date.now() + BANK_TRANSFER_WINDOW_MS);
    setRemaining(BANK_TRANSFER_WINDOW_MS);
    toast("New transfer window started.");
  };
  const chooseBank = () => {
    if (bankDeadline <= Date.now()) startNewWindow();
    setMethod("Bank Account");
  };
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
    if (bankExpired) {
      startNewWindow();
      return;
    }
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
            aria-checked={method === "Bank Account"}
            onClick={chooseBank}
            className={methodTile(method === "Bank Account")}
          >
            <span className={methodIcon(method === "Bank Account")}>
              <Landmark size={20} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-sm">Bank Account</b>
              <span className="text-[12px] leading-snug font-semibold text-mute">
                Transfer to our account. No charge.
              </span>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={method === "Wallet"}
            onClick={() => setMethod("Wallet")}
            className={methodTile(method === "Wallet")}
          >
            <span className={methodIcon(method === "Wallet")}>
              <Wallet size={20} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-sm">Wallet</b>
              <span className="text-[12px] leading-snug font-semibold text-mute">
                {wallet
                  ? `${formatNaira(wallet.availableKobo)} available. No charge.`
                  : "Loading your balance…"}
              </span>
              {method === "Wallet" && wallet && walletShortfall > 0 && (
                <span className="flex items-center gap-1 text-[12px] font-bold text-fail">
                  <TriangleAlert size={13} />
                  {formatNaira(walletShortfall)} short.
                </span>
              )}
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={method === "Online"}
            onClick={() => setMethod("Online")}
            className={methodTile(method === "Online")}
          >
            <span className={methodIcon(method === "Online")}>
              <CreditCard size={20} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-sm">Online</b>
              <span className="text-[12px] leading-snug font-semibold text-mute">
                Paystack checkout. Includes {formatNaira(settings.platformCharge)}.
              </span>
            </span>
          </button>
        </div>
      </div>

      {method === "Bank Account" && (
        <Card className="flex flex-col gap-3 border-brand/35 bg-brand-tint/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-extrabold">Transfer to this account</span>
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
        bankExpired ? (
          <Banner tone="fail" icon={<Timer size={20} />}>
            <b>This transfer window has closed.</b> Start a new{" "}
            {BANK_WINDOW_MINUTES}-minute window to see the account details again.
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
        disabled={!canPay}
        onClick={pay}
      >
        {busy
          ? method === "Bank Account"
            ? "Confirming payment…"
            : method === "Wallet"
              ? "Paying from wallet…"
              : "Opening Paystack…"
          : method === "Bank Account"
            ? bankExpired
              ? `Start a new ${BANK_WINDOW_MINUTES}-minute window`
              : `I have paid ${formatNaira(b.total)}`
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
