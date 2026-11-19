import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, LoaderCircle, Plus } from "lucide-react";
import type { PayoutBatch } from "@/domain/entities";
import type {
  PayoutBatchCounts,
  PayoutBatchPageMeta,
  PayoutBatchQuery,
} from "@/domain/repositories";
import { formatNaira } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  Button,
  Card,
  Chips,
  DataTable,
  Modal,
  Pill,
  Select,
} from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";

const STATUS_TONE = {
  "Awaiting approval": "pending",
  "Returned to maker": "fail",
  Approved: "info",
  Processing: "info",
  Partial: "gold",
  Completed: "ok",
} as const;
type Tab =
  | "All"
  | "Awaiting approval"
  | "Returned to maker"
  | "Processing"
  | "Partial"
  | "Completed";
const COUNT_KEY: Record<Exclude<Tab, "All">, keyof PayoutBatchCounts> = {
  "Awaiting approval": "awaiting_approval",
  "Returned to maker": "returned",
  Processing: "processing",
  Partial: "partial",
  Completed: "completed",
};
interface QueryState {
  tab: Tab;
  year: string;
  page: number;
}

const EMPTY_META: PayoutBatchPageMeta = {
  current_page: 1,
  per_page: 15,
  last_page: 1,
  total: 0,
  counts: {
    all: 0,
    awaiting_approval: 0,
    returned: 0,
    processing: 0,
    partial: 0,
    completed: 0,
  },
  availableYears: [],
};

/** ADM-18: year-end payout batches. Batches are created from approved interest. */
export function PayoutsPage() {
  const { repos } = useServices();
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState<QueryState>({ tab: "All", year: "All", page: 1 });
  const [rows, setRows] = useState<PayoutBatch[]>([]);
  const [meta, setMeta] = useState<PayoutBatchPageMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const query: PayoutBatchQuery = {
      page: q.page,
      status: q.tab === "All" ? undefined : q.tab,
      year: q.year === "All" ? undefined : Number(q.year),
    };
    repos.admin
      .listPayoutBatches(query)
      .then((page) => {
        if (!live) return;
        setRows(page.data);
        setMeta(page.meta);
      })
      .catch((error) => {
        if (live) toast((error as Error).message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [repos, q, toast]);

  /** Any filter change starts again from the first page. */
  const updateQuery = (patch: Partial<QueryState>) =>
    setQ((prev) => ({ ...prev, ...patch, page: 1 }));

  /** The API filters server-side; keep this as a safety net for older adapters. */
  const list = useMemo(
    () =>
      rows.filter(
        (b) =>
          (q.tab === "All" || b.status === q.tab) &&
          (q.year === "All" || b.year === Number(q.year)),
      ),
    [rows, q.tab, q.year],
  );

  const count = (t: Tab) =>
    t === "All" ? meta.counts.all : meta.counts[COUNT_KEY[t]];
  const firstRow =
    meta.total === 0 ? 0 : (meta.current_page - 1) * meta.per_page + 1;
  const lastRow = meta.total === 0 ? 0 : firstRow + list.length - 1;
  const years = meta.availableYears.length
    ? meta.availableYears
    : [2026, 2025, 2024];

  return (
    <>
      <AdminPageHeader
        title="Payouts"
        sub="Year-end payout batches. Batches are created from approved interest."
        actions={
          <Button
            size="sm"
            variant="outline"
            icon={<Plus size={18} />}
            onClick={() => setInfo(true)}
          >
            New batch
          </Button>
        }
      />
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Chips<Tab>
            value={q.tab}
            onChange={(tab) => updateQuery({ tab })}
            options={[
              { value: "All", label: `All ${count("All")}` },
              {
                value: "Awaiting approval",
                label: `Awaiting approval ${count("Awaiting approval")}`,
              },
              {
                value: "Returned to maker",
                label: `Returned to maker ${count("Returned to maker")}`,
              },
              {
                value: "Processing",
                label: `Processing ${count("Processing")}`,
              },
              { value: "Partial", label: `Partial ${count("Partial")}` },
              { value: "Completed", label: `Completed ${count("Completed")}` },
            ]}
          />
          <Select
            aria-label="Filter by year"
            className="w-full sm:ml-auto sm:w-auto"
            value={q.year}
            onChange={(e) => updateQuery({ year: e.target.value })}
            options={[
              { value: "All", label: "All years" },
              ...years.map((y) => ({ value: String(y), label: String(y) })),
            ]}
          />
        </div>
        {loading ? (
          <Card
            role="status"
            aria-live="polite"
            className="flex min-h-48 items-center justify-center gap-2"
          >
            <LoaderCircle className="animate-spin text-brand" size={18} />
            <p className="text-sm font-semibold text-mute">Loading payouts…</p>
          </Card>
        ) : (
          <DataTable<PayoutBatch>
            rows={list}
            rowKey={(r) => r.id}
            onRowClick={(r) =>
              navigate(
                paths.admin.payoutBatch(r.id, {
                  interestConfigId: r.interestConfigId,
                  year: r.year,
                }),
              )
            }
            columns={[
              {
                header: "Batch",
                render: (b) => (
                  <span className="font-mono text-xs font-bold">
                    {b.batchCode ?? b.id}
                  </span>
                ),
              },
              {
                header: "Savings year",
                align: "right",
                render: (b) => b.year,
              },
              {
                header: "Disbursement",
                render: (b) =>
                  b.month.includes(String(b.year))
                    ? b.month
                    : `${b.month} ${b.year}`.trim(),
              },
              {
                header: "Members",
                align: "right",
                render: (b) => b.count.toLocaleString(),
              },
              {
                header: "Total payout",
                align: "right",
                render: (b) => (
                  <b>{formatNaira(b.savingsKobo + b.interestKobo)}</b>
                ),
              },
              {
                header: "Status",
                render: (b) => (
                  <Pill tone={STATUS_TONE[b.status]} icon={false}>
                    {b.status}
                  </Pill>
                ),
              },
              {
                header: "Prepared by",
                render: (b) => <span className="text-mute">{b.maker}</span>,
              },
              {
                header: "Approved by",
                render: (b) => (
                  <span className="text-mute">{b.checker ?? "—"}</span>
                ),
              },
            ]}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-mute">
            {loading
              ? "Loading payouts…"
              : meta.total === 0
                ? "No batches match these filters"
                : `Showing ${firstRow}–${lastRow} of ${meta.total} payouts`}
          </p>
          {meta.last_page > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label="Previous page"
                icon={<ChevronLeft size={16} />}
                disabled={loading || meta.current_page <= 1}
                onClick={() =>
                  setQ((prev) => ({
                    ...prev,
                    page: Math.max(1, meta.current_page - 1),
                  }))
                }
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
                onClick={() =>
                  setQ((prev) => ({
                    ...prev,
                    page: Math.min(meta.last_page, meta.current_page + 1),
                  }))
                }
              >
                <span className="sr-only">Next page</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={info}
        title="Create a payout batch"
        onClose={() => setInfo(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setInfo(false)}>
              Close
            </Button>
            <Button onClick={() => navigate(paths.admin.interestConfig(2026))}>
              Go to interest
            </Button>
          </>
        }
      >
        <p className="leading-relaxed text-[#474252]">
          Payout batches are generated from an approved interest configuration —
          set the rate, get checker approval, then create the batch from the
          interest workflow.
        </p>
      </Modal>
    </>
  );
}
