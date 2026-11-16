import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, List, LoaderCircle, Search } from "lucide-react";
import type { Transaction } from "@/domain/entities";
import type { ActivityQuery, PageMeta } from "@/domain/repositories";
import { formatNaira } from "@/domain/rules";
import { useAuth } from "../../../contexts/AuthContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  Button,
  Card,
  Chips,
  EmptyState,
  LoadingScreen,
  LoadingSpinner,
} from "../../../design-system";
import { downloadCsv } from "../../../utils/csv";
import { TxRow, describeTx } from "../components/TransactionParts";

type Tab = "All" | "Contributions" | "Payouts" | "Pending" | "Failed";

const PER_PAGE = 15;

const INITIAL_META: PageMeta = {
  current_page: 1,
  per_page: PER_PAGE,
  last_page: 1,
  total: 0,
};

const TAB_TO_FILTER: Record<Tab, ActivityQuery["filter"]> = {
  All: undefined,
  Contributions: "contributions",
  Payouts: "payouts",
  Pending: "pending",
  Failed: "failed",
};

/** MEM-12: every contribution and payout with search, filters and a CSV statement download. */
export function ActivityPage() {
  const { session } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const member = session?.kind === "member" ? session.member : null;
  const [list, setList] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<PageMeta>(INITIAL_META);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!member) return;
    let active = true;
    setLoading(true);
    repos.member
      .listActivity({
        filter: TAB_TO_FILTER[tab],
        search: query.trim() || undefined,
        per_page: PER_PAGE,
        page,
      })
      .then((res) => {
        if (!active) return;
        setList(res.data);
        setMeta(res.meta);
      })
      .catch((err) => {
        if (!active) return;
        toast((err as Error).message || "Could not load activity.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repos, member, tab, query, page, toast]);

  if (!member) return <LoadingScreen />;

  const firstRow =
    meta.total === 0 ? 0 : (meta.current_page - 1) * meta.per_page + 1;
  const lastRow =
    meta.total === 0
      ? 0
      : Math.min(meta.total, firstRow + Math.max(0, list.length - 1));

  const statement = () => {
    downloadCsv(
      `IWH-statement-${member.id}.csv`,
      ["Date", "Description", "Reference", "Amount", "Charge", "Status"],
      list.map((t) => [
        t.createdAt.slice(0, 10),
        describeTx(t),
        t.reference,
        formatNaira(t.amountKobo),
        formatNaira(t.platformChargeKobo),
        t.status,
      ]),
    );
    toast("Statement downloaded.");
  };

  const hasFilters = tab !== "All" || query.trim() !== "";

  return (
    <div className="mx-auto flex max-w-245 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold tracking-tight">Activity</h1>
        <Button
          variant="outline"
          size="md"
          icon={<Download size={18} />}
          onClick={statement}
        >
          Statement
        </Button>
      </div>
      <label className="flex h-10.5 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
        <Search size={20} className="shrink-0" />
        <span className="sr-only">Search activity</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search by reference, month (e.g. 2026-06) or amount"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-mute"
        />
      </label>
      <div className="overflow-x-auto">
        <Chips<Tab>
          value={tab}
          onChange={(nextTab) => {
            setTab(nextTab);
            setPage(1);
          }}
          options={(
            ["All", "Contributions", "Payouts", "Pending", "Failed"] as Tab[]
          ).map((t) => ({ value: t, label: t }))}
        />
      </div>
      <Card>
        {loading ? (
          <div className="flex min-h-48 items-center justify-center py-8">
            <LoadingSpinner size="sm" label="Loading activity…" />
          </div>
        ) : list.length ? (
          list.map((t) => <TxRow key={t.id} t={t} />)
        ) : (
          <EmptyState
            icon={<List size={28} />}
            title={hasFilters ? "Nothing here" : "No payments yet"}
          >
            {hasFilters
              ? "Try another filter."
              : "Your contributions will show here with their status."}
          </EmptyState>
        )}
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-mute">
          {loading
            ? "Loading activity…"
            : meta.total === 0
              ? "No activity found"
              : `Showing ${firstRow}–${lastRow} of ${meta.total} transactions`}
        </p>
        {meta.last_page > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label="Previous page"
              icon={<ChevronLeft size={16} />}
              disabled={loading || meta.current_page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <span className="sr-only">Previous page</span>
            </Button>
            <span className="text-[13px] font-semibold text-mute">
              Page {meta.current_page} of {meta.last_page}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label="Next page"
              icon={<ChevronRight size={16} />}
              disabled={loading || meta.current_page >= meta.last_page}
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
            >
              <span className="sr-only">Next page</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
