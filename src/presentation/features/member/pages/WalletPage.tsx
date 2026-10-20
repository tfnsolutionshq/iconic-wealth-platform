import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Clock, Download, Info, Landmark, Plus, TriangleAlert, Wallet, X } from "lucide-react";
import type { WalletEntry, WalletSnapshot } from "@/domain/entities";
import { formatNaira, parseNairaInput } from "@/domain/rules";
import { useAuth } from "../../../contexts/AuthContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chips,
  EmptyState,
  KeyValue,
  Modal,
  Pill,
  cn,
} from "../../../design-system";
import { downloadCsv } from "../../../utils/csv";
import { paths } from "../../../routes/paths";
import { fmtDateTime } from "../components/TransactionParts";

type Tab = "All" | "Money in" | "Money out" | "Pending" | "Failed";

const ENTRY_STATUS_TONE = {
  Successful: "ok",
  Pending: "pending",
  Failed: "fail",
  Processing: "info",
} as const;

const describeEntry = (e: WalletEntry) =>
  e.kind === "TopUp"
    ? "Wallet top-up"
    : e.kind === "Withdrawal"
      ? "Wallet withdrawal"
      : "Wallet adjustment";

function tileFor(e: WalletEntry): { cls: string; icon: ReactNode } {
  if (e.status === "Failed")
    return { cls: "bg-fail-tint text-fail", icon: <X size={20} /> };
  if (e.status === "Pending" || e.status === "Processing")
    return { cls: "bg-pending-tint text-pending", icon: <Clock size={20} /> };
  if (e.direction === "Credit")
    return { cls: "bg-ok-tint text-ok", icon: <ArrowDownLeft size={20} /> };
  return { cls: "bg-soft text-ink", icon: <ArrowUpRight size={20} /> };
}

function WalletRow({ e }: { e: WalletEntry }) {
  const tile = tileFor(e);
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <span
        className={`flex size-10.5 shrink-0 items-center justify-center rounded-input ${tile.cls}`}
      >
        {tile.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-[15px] break-words text-ink">
          {describeEntry(e)}
        </b>
        <span className="text-[13px] font-semibold break-words text-mute">
          {fmtDateTime(e.createdAt)} · {e.reference}
          {e.note ? ` · ${e.note}` : ""}
          {e.failureReason ? ` · ${e.failureReason}` : ""}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <b className="text-[15px] tabular-nums text-ink">
          {e.direction === "Credit" ? "+" : "−"}
          {formatNaira(e.amountKobo)}
        </b>
        <Pill tone={ENTRY_STATUS_TONE[e.status]}>{e.status}</Pill>
      </span>
    </div>
  );
}

function AmountField({
  text,
  setText,
  error,
  hint,
}: {
  text: string;
  setText: (v: string) => void;
  error?: string;
  hint?: ReactNode;
}) {
  const n = text ? parseNairaInput(text) : 0;
  return (
    <div>
      <label htmlFor="wallet-amount" className="mb-2 block text-sm font-bold">
        Amount
      </label>
      <div
        className={cn(
          "flex min-h-16 items-center gap-2 rounded-2xl border-2 bg-white px-4 py-2 text-2xl font-extrabold",
          error ? "border-fail" : "border-brand",
        )}
      >
        <span className="shrink-0 text-mute">₦</span>
        <input
          id="wallet-amount"
          inputMode="numeric"
          className="w-full min-w-0 bg-transparent tabular-nums outline-none"
          value={(n / 100).toLocaleString("en-NG")}
          onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold text-fail">
          <TriangleAlert size={16} />
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-[13px] font-semibold leading-snug text-mute">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Wallet: spendable balance plus a financial overview — top-ups, withdrawals and a filterable ledger. */
export function WalletPage() {
  const { session } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const member = session?.kind === "member" ? session.member : null;
  const [snap, setSnap] = useState<WalletSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>("All");
  const [amountText, setAmountText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const reload = useCallback(async () => {
    if (member) setSnap(await repos.wallet.getSnapshot(member.id));
  }, [repos, member]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Top-ups settle on their own (demo mode), so refresh while one is in flight.
  const pendingDeposits = snap?.pendingDepositKobo ?? 0;
  useEffect(() => {
    if (pendingDeposits <= 0) return;
    const t = setInterval(() => void reload(), 2000);
    return () => clearInterval(t);
  }, [pendingDeposits, reload]);

  const list = useMemo(() => {
    const entries = snap?.entries ?? [];
    return entries.filter(
      (e) =>
        tab === "All" ||
        (tab === "Money in" && e.direction === "Credit") ||
        (tab === "Money out" && e.direction === "Debit") ||
        (tab === "Pending" && (e.status === "Pending" || e.status === "Processing")) ||
        e.status === tab,
    );
  }, [snap, tab]);

  if (!member || !snap) return <p className="text-mute">Loading…</p>;

  const amount = amountText ? parseNairaInput(amountText) : 0;
  const openFund = () => {
    setAmountText("");
    setFundOpen(true);
  };
  const openWithdraw = () => {
    setAmountText("");
    setWithdrawOpen(true);
  };
  const fundError =
    amountText !== "" && amount <= 0
      ? "Enter an amount greater than ₦0."
      : undefined;
  const withdrawError =
    amountText !== "" && amount <= 0
      ? "Enter an amount greater than ₦0."
      : amountText !== "" && amount > snap.availableKobo
        ? `Cannot be more than your available balance of ${formatNaira(snap.availableKobo)}.`
        : undefined;

  const fund = async () => {
    if (amount <= 0 || fundError || busy) return;
    setBusy(true);
    try {
      await repos.wallet.requestTopUp(member.id, amount);
      toast(
        `${formatNaira(amount)} top-up started. It will show in your balance once confirmed.`,
      );
      setFundOpen(false);
      setAmountText("");
      void reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (amount <= 0 || withdrawError || busy) return;
    setBusy(true);
    try {
      await repos.wallet.requestWithdrawal(member.id, amount);
      toast(
        `Withdrawal of ${formatNaira(amount)} requested. Track it under Pending.`,
      );
      setWithdrawOpen(false);
      setAmountText("");
      void reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const statement = () => {
    downloadCsv(
      `IWH-wallet-statement-${member.id}.csv`,
      ["Date", "Description", "Reference", "Direction", "Amount", "Status"],
      list.map((e) => [
        e.createdAt.slice(0, 10),
        describeEntry(e),
        e.reference,
        e.direction === "Credit" ? "Money in" : "Money out",
        formatNaira(e.amountKobo),
        e.status,
      ]),
    );
    toast("Statement downloaded.");
  };

  return (
    <div className="mx-auto flex max-w-245 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold tracking-tight">Wallet</h1>
        <Button
          variant="outline"
          size="md"
          icon={<Download size={18} />}
          onClick={statement}
        >
          Statement
        </Button>
      </div>

      <Card tone="night" className="flex flex-col gap-1">
        <span className="text-xs font-bold text-white/70">
          Available balance
        </span>
        <b className="text-3xl break-words tabular-nums">
          {formatNaira(snap.availableKobo)}
        </b>
        <span className="text-[13px] font-semibold text-white/70">
          Confirmed money you can spend or withdraw.
        </span>
      </Card>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Card className="flex flex-col gap-1 bg-soft">
          <span className="text-xs font-bold text-mute">Pending deposits</span>
          <b className="text-xl break-words tabular-nums">
            {formatNaira(snap.pendingDepositKobo)}
          </b>
          <span className="text-[13px] font-semibold text-mute">
            Top-ups awaiting confirmation.
          </span>
        </Card>
        <Card className="flex flex-col gap-1 bg-soft">
          <span className="text-xs font-bold text-mute">
            Pending withdrawals
          </span>
          <b className="text-xl break-words tabular-nums">
            {formatNaira(snap.pendingWithdrawalKobo)}
          </b>
          <span className="text-[13px] font-semibold text-mute">
            On the way to your bank account.
          </span>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Button
          size="md"
          icon={<Plus size={18} />}
          className="min-w-40 flex-1"
          onClick={openFund}
        >
          Fund wallet
        </Button>
        <Button
          variant="outline"
          size="md"
          icon={<ArrowUpRight size={18} />}
          className="min-w-40 flex-1"
          disabled={snap.availableKobo <= 0}
          onClick={openWithdraw}
        >
          Withdraw
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Chips<Tab>
          value={tab}
          onChange={setTab}
          options={(
            ["All", "Money in", "Money out", "Pending", "Failed"] as Tab[]
          ).map((t) => ({ value: t, label: t }))}
        />
      </div>
      <Card>
        {list.length ? (
          list.map((e) => <WalletRow key={e.id} e={e} />)
        ) : (
          <EmptyState
            icon={<Wallet size={28} />}
            title={snap.entries.length ? "Nothing here" : "No wallet activity yet"}
          >
            {snap.entries.length
              ? "Try another filter."
              : "Fund your wallet to see top-ups and withdrawals here."}
          </EmptyState>
        )}
      </Card>

      <Modal
        open={fundOpen}
        title="Fund wallet"
        onClose={() => setFundOpen(false)}
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => setFundOpen(false)}
            >
              Cancel
            </Button>
            <Button size="md" disabled={!!fundError || !amount || busy} onClick={fund}>
              {amount > 0 ? `Fund ${formatNaira(amount)}` : "Fund wallet"}
            </Button>
          </>
        }
      >
        <AmountField
          text={amountText}
          setText={setAmountText}
          error={fundError}
          hint={`Available balance ${formatNaira(snap.availableKobo)}.`}
        />
        {amount > 0 && !fundError && (
          <Card tone="soft" className="flex flex-col">
            <KeyValue label="Available balance" value={formatNaira(snap.availableKobo)} />
            <KeyValue
              label="After this top-up"
              value={formatNaira(snap.availableKobo + amount)}
            />
          </Card>
        )}
        <Banner tone="info" icon={<Info size={20} />}>
          Payments are simulated in demo mode, so your top-up confirms
          automatically and appears in your balance shortly.
        </Banner>
      </Modal>

      <Modal
        open={withdrawOpen}
        title="Withdraw"
        onClose={() => setWithdrawOpen(false)}
        footer={
          member.payoutAccount ? (
            <>
              <Button
                variant="outline"
                size="md"
                onClick={() => setWithdrawOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="md"
                disabled={!!withdrawError || !amount || busy}
                onClick={withdraw}
              >
                {amount > 0 ? `Withdraw ${formatNaira(amount)}` : "Withdraw"}
              </Button>
            </>
          ) : (
            <ButtonLink to={paths.member.profile} size="md">
              Set up payout account
            </ButtonLink>
          )
        }
      >
        {!member.payoutAccount ? (
          <Banner tone="warn" icon={<Landmark size={20} />}>
            You need a verified bank account before you can withdraw. Set up
            your payout account in Profile — it takes a minute.
          </Banner>
        ) : (
          <>
            <AmountField
              text={amountText}
              setText={setAmountText}
              error={withdrawError}
              hint={`Available balance ${formatNaira(snap.availableKobo)}.`}
            />
            <Card tone="soft" className="flex flex-col">
              <KeyValue
                label="Sending to"
                value={`${member.payoutAccount.bankName} •••• ${member.payoutAccount.accountNumber.slice(-4)}`}
              />
              <KeyValue
                label="Account name"
                value={member.payoutAccount.accountName}
              />
              {amount > 0 && !withdrawError && (
                <KeyValue
                  label="Balance after withdrawal"
                  value={formatNaira(snap.availableKobo - amount)}
                />
              )}
            </Card>
            <Banner tone="info" icon={<Info size={20} />}>
              Withdrawals are sent to your bank account by the Iconic Wealth
              Hub team. You will see it here as pending until it is completed.
            </Banner>
          </>
        )}
      </Modal>
    </div>
  );
}
