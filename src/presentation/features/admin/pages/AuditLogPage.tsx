import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  Lock,
  Search,
} from "lucide-react";
import type {
  AuditCategory,
  AuditLogPage as AuditLogPageData,
  AuditLogQuery,
} from "@/domain/entities";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  Banner,
  Button,
  Card,
  Chips,
  DataTable,
  Pill,
  Select,
} from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { downloadCsv } from "../../../utils/csv";

type Tab = "All" | AuditCategory;
type Range = "all" | "today" | "7" | "30";

const PAGE_SIZE = 15;

const fmtDateTime = (value: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

const dateParam = (range: Range): AuditLogQuery["date"] =>
  range === "7" || range === "30" ? `last_${range}_days` : range;

/** ADM-23: every privileged and financial action. Entries are append-only. */
export function AuditLogPage() {
  const { repos } = useServices();
  const toast = useToast();
  const [result, setResult] = useState<AuditLogPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("All");
  const [range, setRange] = useState<Range>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let live = true;
    setLoading(true);
    repos.admin
      .listAuditLog({
        type: tab === "All" ? "all" : (tab.toLowerCase() as AuditLogQuery["type"]),
        date: dateParam(range),
        search,
        per_page: PAGE_SIZE,
        page,
      })
      .then((payload) => {
        if (live) setResult(payload);
      })
      .catch((error: unknown) => {
        if (live) toast((error as Error).message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [repos, toast, tab, range, search, page]);

  const rows = result?.rows ?? [];
  const meta = result?.meta;
  const firstRow = rows.length
    ? ((meta?.current_page ?? 1) - 1) * (meta?.per_page ?? PAGE_SIZE) + 1
    : 0;
  const lastRow = firstRow ? firstRow + rows.length - 1 : 0;

  const changeTab = (next: Tab) => {
    setTab(next);
    setPage(1);
  };
  const changeRange = (next: Range) => {
    setRange(next);
    setPage(1);
  };
  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const exportCsv = () => {
    downloadCsv(
      "iwh-audit-log.csv",
      ["When", "Who", "Role", "Action", "Record", "Change", "Type"],
      rows.map((a) => [
        a.at,
        a.actor,
        a.role,
        a.action,
        a.entity,
        a.change,
        a.category,
      ]),
    );
    toast("Audit log exported.");
  };

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        sub="Every privileged and financial action"
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={18} />}
            onClick={exportCsv}
          >
            Export
          </Button>
        }
      />
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Chips<Tab>
            value={tab}
            onChange={changeTab}
            options={[
              { value: "All", label: "All" },
              { value: "Financial", label: "Financial" },
              { value: "Members", label: "Members" },
              { value: "Access", label: "Access" },
              { value: "Roles", label: "Roles" },
            ]}
          />
          <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="flex h-10.5 w-full sm:w-72 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
              <Search size={18} />
              <input
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                placeholder="Search person, action or record"
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
              />
            </label>
            <Select
              aria-label="Filter by date"
              value={range}
              onChange={(e) => changeRange(e.target.value as Range)}
              options={[
                { value: "all", label: "Any date" },
                { value: "today", label: "Today" },
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
              ]}
            />
          </div>
        </div>
        {loading ? (
          <Card
            role="status"
            aria-live="polite"
            className="flex min-h-48 items-center justify-center gap-2"
          >
            <LoaderCircle className="animate-spin text-brand" size={18} />
            <p className="text-sm font-semibold text-mute">
              Loading audit log…
            </p>
          </Card>
        ) : (
          <DataTable
            rows={rows}
            rowKey={(entry) => entry.id}
            empty="No audit entries match these filters"
            columns={[
              {
                header: "When",
                render: (a) => (
                  <span className="whitespace-nowrap text-mute">
                    {fmtDateTime(a.at)}
                  </span>
                ),
              },
              {
                header: "Who",
                render: (a) => (
                  <span className="flex flex-col">
                    <b>{a.actor}</b>
                    <span className="text-xs font-semibold text-mute">
                      {a.role}
                    </span>
                  </span>
                ),
              },
              { header: "Action", render: (a) => <b>{a.action}</b> },
              {
                header: "Record",
                render: (a) => (
                  <span className="font-mono text-xs">{a.entity}</span>
                ),
              },
              {
                header: "Change",
                render: (a) => <span className="text-mute">{a.change}</span>,
              },
              {
                header: "Type",
                render: (a) => (
                  <Pill tone="mute" icon={false}>
                    {a.category}
                  </Pill>
                ),
              },
            ]}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-mute">
            {loading
              ? "Loading audit log…"
              : meta?.total
                ? `Showing ${firstRow}–${lastRow} of ${meta.total}`
                : "No audit entries match these filters"}
          </p>
          {meta && meta.last_page > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label="Previous page"
                icon={<ChevronLeft size={16} />}
                disabled={loading || meta.current_page <= 1}
                onClick={() => setPage(Math.max(1, meta.current_page - 1))}
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
                  setPage(Math.min(meta.last_page, meta.current_page + 1))
                }
              >
                <span className="sr-only">Next page</span>
              </Button>
            </div>
          )}
        </div>
        <Banner tone="neutral" icon={<Lock size={20} />}>
          Audit entries can’t be edited or deleted by anyone, including Super
          Admins. Actions you take in this build appear here.
        </Banner>
      </div>
    </>
  );
}
