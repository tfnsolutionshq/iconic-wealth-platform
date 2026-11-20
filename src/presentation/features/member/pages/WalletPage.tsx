import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Info,
  Landmark,
  Plus,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import type {
  WalletEntry,
  WalletEntryKind,
  WalletSnapshot,
} from "@/domain/entities";
import type { PageMeta, WalletFilter } from "@/domain/repositories";
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
  LoadingScreen,
  LoadingSpinner,
  Modal,
  Pill,
  SelectField,
  TextField,
  cn,
} from "../../../design-system";
import { downloadCsv } from "../../../utils/csv";
import { paths } from "../../../routes/paths";
import { fmtDateTime } from "../components/TransactionParts";

type Tab = "All" | "Money in" | "Money out" | "Pending" | "Failed";

const PER_PAGE = 15;

const INITIAL_META: PageMeta = {
  current_page: 1,
  per_page: PER_PAGE,
  last_page: 1,
  total: 0,
};

const TAB_TO_FILTER: Record<Tab, WalletFilter | undefined> = {
  All: undefined,
  "Money in": "money_in",
  "Money out": "money_out",
  Pending: "pending",
  Failed: "failed",
};

type StatementType = "All" | WalletEntryKind;

const STATEMENT_TYPES: { value: StatementType; label: string }[] = [
  { value: "All", label: "All transactions" },
  { value: "TopUp", label: "Top-ups" },
  { value: "Withdrawal", label: "Withdrawals" },
  { value: "Contribution", label: "Contributions" },
  { value: "Payout", label: "Year-end payouts" },
];

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
      : e.kind === "Contribution"
        ? "Contribution to savings"
        : e.kind === "Payout"
          ? "Year-end payout"
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
        <b className="text-[15px] wrap-break-word text-ink">
          {describeEntry(e)}
        </b>
        <span className="text-[13px] font-semibold wrap-break-word text-mute">
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
  const [searchParams, setSearchParams] = useSearchParams();
  const member = session?.kind === "member" ? session.member : null;
  const [snap, setSnap] = useState<WalletSnapshot | null>(null);
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [meta, setMeta] = useState<PageMeta>(INITIAL_META);
  const [page, setPage] = useState(1);
  const [txLoading, setTxLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("All");
  const [amountText, setAmountText] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statementType, setStatementType] = useState<StatementType>("All");

  const reloadWallet = useCallback(async () => {
    if (!member) return;
    try {
      setSnap(await repos.wallet.getSnapshot(member.id));
    } catch {
      setSnap({
        memberId: member.id,
        availableKobo: 0,
        pendingDepositKobo: 0,
        pendingWithdrawalKobo: 0,
        entries: [],
        withdrawals: [],
      });
    }
  }, [repos, member]);

  const reloadTransactions = useCallback(async () => {
    if (!member) return;
    setTxLoading(true);
    try {
      if (repos.wallet.listTransactions) {
        const res = await repos.wallet.listTransactions({
          filter: TAB_TO_FILTER[tab],
          per_page: PER_PAGE,
          page,
        });
        setEntries(res.data);
        setMeta(res.meta);
      } else {
        const fallback = await repos.wallet.getSnapshot(member.id);
        setEntries(fallback.entries);
        setMeta({
          current_page: 1,
          per_page: PER_PAGE,
          last_page: 1,
          total: fallback.entries.length,
        });
      }
    } catch (e) {
      toast((e as Error).message || "Could not load wallet transactions.");
    } finally {
      setTxLoading(false);
    }
  }, [repos, member, tab, page, toast]);

  const reloadAll = useCallback(async () => {
    await Promise.all([reloadWallet(), reloadTransactions()]);
  }, [reloadWallet, reloadTransactions]);

  useEffect(() => {
    void reloadWallet();
  }, [reloadWallet]);

  useEffect(() => {
    void reloadTransactions();
  }, [reloadTransactions]);

  // Verify redirect callback if Paystack returned ?reference=... to /member/wallet
  useEffect(() => {
    const ref = searchParams.get("reference") || searchParams.get("trxref");
    if (!ref || !member || !repos.wallet.verifyFund) return;
    const storedAmt = Number(sessionStorage.getItem(`iwh.wal.amt.${ref}`) || 0);
    setVerifyingRef(ref);
    repos.wallet
      .verifyFund(ref, storedAmt)
      .then((res) => {
        sessionStorage.removeItem(`iwh.wal.amt.${ref}`);
        if (res.transaction.status === "Successful") {
          toast(`${formatNaira(res.transaction.amountKobo)} added to your wallet.`);
        } else if (res.transaction.status === "Failed") {
          toast("Wallet funding did not go through.");
        } else {
          toast("Payment is being confirmed. Your balance will update shortly.");
        }
        void reloadAll();
      })
      .catch((e) => {
        toast((e as Error).message || "Could not verify wallet funding.");
      })
      .finally(() => {
        setVerifyingRef(null);
        setSearchParams({}, { replace: true });
      });
  }, [searchParams, setSearchParams, member, repos, toast, reloadAll]);

  const statementEntries = useMemo(() => {
    const source = entries.length ? entries : (snap?.entries ?? []);
    return source.filter((e) => {
      if (statementType !== "All" && e.kind !== statementType) return false;
      const day = e.createdAt.slice(0, 10);
      return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
    });
  }, [entries, snap, statementType, dateFrom, dateTo]);

  if (!member || !snap || verifyingRef) {
    return (
      <LoadingScreen
        label={verifyingRef ? "Confirming your wallet payment…" : undefined}
      />
    );
  }

  const dateError =
    dateFrom && dateTo && dateFrom > dateTo
      ? "The start date must be on or before the end date."
      : undefined;

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
      if (repos.wallet.initiateFund && repos.wallet.verifyFund) {
        const { intent } = await repos.wallet.initiateFund(amount);
        sessionStorage.setItem(`iwh.wal.amt.${intent.reference}`, String(amount));

        if (!intent.accessCode && intent.authorizationUrl) {
          window.location.href = intent.authorizationUrl;
          return;
        }

        setFundOpen(false);
        const outcome = await repos.gateway.checkout(intent);
        if (outcome === "closed") {
          setBusy(false);
          toast("Payment cancelled.");
          return;
        }

        setVerifyingRef(intent.reference);
        const verified = await repos.wallet.verifyFund(intent.reference, amount);
        sessionStorage.removeItem(`iwh.wal.amt.${intent.reference}`);
        setVerifyingRef(null);
        setAmountText("");

        if (verified.transaction.status === "Successful") {
          toast(`${formatNaira(amount)} added to your wallet.`);
        } else if (verified.transaction.status === "Failed") {
          toast("Wallet funding did not go through.");
        } else {
          toast("Payment is being confirmed. Your balance will update shortly.");
        }
        await reloadAll();
      } else {
        await repos.wallet.requestTopUp(member.id, amount);
        toast(
          `${formatNaira(amount)} top-up started. It will show in your balance once confirmed.`,
        );
        setFundOpen(false);
        setAmountText("");
        await reloadAll();
      }
    } catch (e) {
      setVerifyingRef(null);
      toast((e as Error).message || "Could not complete wallet funding.");
    } finally {
      setBusy(false);
    }
  };

  const canWithdrawAccount = Boolean(
    member.payoutAccount || member.isProfileComplete,
  );

  const withdraw = async () => {
    if (amount <= 0 || withdrawError || busy) return;
    setBusy(true);
    try {
      await repos.wallet.requestWithdrawal(member.id, amount);
      toast(
        `Withdrawal of ${formatNaira(amount)} submitted. It will be processed once approved by an admin.`,
      );
      setWithdrawOpen(false);
      setAmountText("");
      await reloadAll();
    } catch (e) {
      toast((e as Error).message || "Could not submit withdrawal request.");
    } finally {
      setBusy(false);
    }
  };

  const statement = () => {
    if (dateError || !statementEntries.length) return;
    downloadCsv(
      `IWH-wallet-statement-${member.id}.csv`,
      [
        "Date",
        "Description",
        "Reference",
        "Direction",
        "Amount (Naira)",
        "Status",
      ],
      statementEntries.map((e) => [
        e.createdAt.slice(0, 10),
        describeEntry(e),
        e.reference,
        e.direction === "Credit" ? "Money in" : "Money out",
        Math.round(e.amountKobo / 100),
        e.status,
      ]),
    );
    setStatementOpen(false);
    toast("Statement downloaded.");
  };

  const openStatement = () => {
    setDateFrom("");
    setDateTo("");
    setStatementType("All");
    setStatementOpen(true);
  };

  return (
    <div className="mx-auto flex max-w-245 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold tracking-tight">Wallet</h1>
        <Button
          variant="outline"
          size="md"
          icon={<Download size={18} />}
          onClick={openStatement}
        >
          Statement
        </Button>
      </div>

      <Card
        tone="night"
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-white/70">
            Available balance
          </span>
          <b className="text-3xl wrap-break-word tabular-nums">
            {formatNaira(snap.availableKobo)}
          </b>
          <span className="text-[13px] font-semibold text-white/70">
            Confirmed money you can spend or withdraw.
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button size="md" icon={<Plus size={18} />} onClick={openFund}>
            Fund wallet
          </Button>
          <Button
            variant="outline"
            size="md"
            icon={<ArrowUpRight size={18} />}
            disabled={snap.availableKobo <= 0}
            onClick={openWithdraw}
          >
            Withdraw
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Card className="flex flex-col gap-1 bg-soft">
          <span className="text-xs font-bold text-mute">Pending deposits</span>
          <b className="text-xl wrap-break-word tabular-nums">
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
          <b className="text-xl wrap-break-word tabular-nums">
            {formatNaira(snap.pendingWithdrawalKobo)}
          </b>
          <span className="text-[13px] font-semibold text-mute">
            On the way to your bank account.
          </span>
        </Card>
      </div>

      <div className="overflow-x-auto">
        <Chips<Tab>
          value={tab}
          onChange={(next) => {
            setTab(next);
            setPage(1);
          }}
          options={(
            ["All", "Money in", "Money out", "Pending", "Failed"] as Tab[]
          ).map((t) => ({ value: t, label: t }))}
        />
      </div>
      <Card>
        {txLoading ? (
          <div className="flex min-h-48 items-center justify-center py-8">
            <LoadingSpinner size="sm" label="Loading transactions…" />
          </div>
        ) : entries.length ? (
          entries.map((e) => <WalletRow key={e.id} e={e} />)
        ) : (
          <EmptyState
            icon={<Wallet size={28} />}
            title={tab === "All" ? "No wallet activity yet" : "Nothing here"}
          >
            {tab === "All"
              ? "Fund your wallet to see top-ups and withdrawals here."
              : "Try another filter."}
          </EmptyState>
        )}
      </Card>

      {meta.last_page > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-mute">
            Page {meta.current_page} of {meta.last_page} ({meta.total} total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={txLoading || meta.current_page <= 1}
              icon={<ChevronLeft size={16} />}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={txLoading || meta.current_page >= meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={statementOpen}
        title="Export statement"
        onClose={() => setStatementOpen(false)}
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => setStatementOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="md"
              icon={<Download size={18} />}
              disabled={!!dateError || !statementEntries.length}
              onClick={statement}
            >
              Download CSV
            </Button>
          </>
        }
      >
        <p className="text-sm font-semibold text-mute">
          Choose a date range and transaction type for your wallet statement.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Start date"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <TextField
            label="End date"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            error={dateError}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <SelectField
          label="Transaction type"
          options={STATEMENT_TYPES}
          value={statementType}
          onChange={(e) => setStatementType(e.target.value as StatementType)}
        />
        <p className="text-[13px] font-semibold text-mute">
          {statementEntries.length
            ? `${statementEntries.length} transaction${statementEntries.length === 1 ? "" : "s"} will be exported.`
            : "No transactions match these filters."}
        </p>
      </Modal>

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
            <Button
              size="md"
              disabled={!!fundError || !amount || busy}
              onClick={fund}
            >
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
            <KeyValue
              label="Available balance"
              value={formatNaira(snap.availableKobo)}
            />
            <KeyValue
              label="After this top-up"
              value={formatNaira(snap.availableKobo + amount)}
            />
          </Card>
        )}
        <Banner tone="info" icon={<Info size={20} />}>
          You’ll complete the payment securely on Paystack. Your wallet balance
          updates once the payment is verified.
        </Banner>
      </Modal>

      <Modal
        open={withdrawOpen}
        title="Withdraw"
        onClose={() => setWithdrawOpen(false)}
        footer={
          canWithdrawAccount ? (
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
                {busy
                  ? "Submitting…"
                  : amount > 0
                    ? `Withdraw ${formatNaira(amount)}`
                    : "Withdraw"}
              </Button>
            </>
          ) : (
            <ButtonLink to={paths.member.profile} size="md">
              Set up payout account
            </ButtonLink>
          )
        }
      >
        {!canWithdrawAccount ? (
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
                value={
                  member.payoutAccount
                    ? `${member.payoutAccount.bankName} •••• ${member.payoutAccount.accountNumber.slice(-4)}`
                    : "Your verified payout account"
                }
              />
              {member.payoutAccount?.accountName && (
                <KeyValue
                  label="Account name"
                  value={member.payoutAccount.accountName}
                />
              )}
              <KeyValue label="Withdrawal charges" value={formatNaira(0)} />
              {amount > 0 && !withdrawError && (
                <KeyValue
                  label="Balance after withdrawal"
                  value={formatNaira(snap.availableKobo - amount)}
                />
              )}
            </Card>
            <Banner tone="info" icon={<Info size={20} />}>
              Withdrawals are sent to your bank account once approved by an
              admin. You will see it here as pending until it is completed.
            </Banner>
          </>
        )}
      </Modal>
    </div>
  );
}
