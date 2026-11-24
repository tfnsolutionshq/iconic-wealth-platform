import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, LoaderCircle, Search, ShieldCheck } from "lucide-react";
import type {
  AdminSavingsDashboard,
  AdminSavingsMember,
  AdminSavingsStatus,
} from "@/domain/entities";
import { formatNaira, MONTHS, MONTHS_SHORT } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { Button, Card, Chips, DataTable, Kpi, Pill, SelectField } from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";
import { downloadCsv } from "../../../utils/csv";

type Tab = "All" | AdminSavingsStatus;

/** Prototype `SEPK` tones, keyed by the API's snake_case status values. */
const STATUS_META = {
  up_to_date: { label: "Paid", tone: "ok" },
  due: { label: "Due", tone: "pending" },
  late: { label: "Late", tone: "pending" },
  missed: { label: "Missed", tone: "fail" },
} as const;

const TABS: { value: Tab; label: string }[] = [
  { value: "All", label: "All" },
  { value: "up_to_date", label: "Up to date" },
  { value: "due", label: "Due" },
  { value: "late", label: "Late" },
  { value: "missed", label: "Missed" },
];

/** ADM-13: savings dashboard with the prototype's monthly bars and member table. */
export function AdminSavingsPage() {
  const { repos, clock } = useServices();
  const toast = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState("2026");
  const [tab, setTab] = useState<Tab>("All");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<AdminSavingsDashboard | null>(null);
  /** Table refreshes on every fetch; the chart only reloads on initial/year change. */
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const lastFetchedYear = useRef<number | null>(null);

  /** Status and search are server-side filters, so the page sends them as-is. */
  const query = useMemo(
    () => ({
      year: Number(year),
      status: tab === "All" ? undefined : tab,
      search,
    }),
    [year, tab, search],
  );

  useEffect(() => {
    let live = true;
    setLoading(true);
    // Only a new year (or the first load) invalidates the monthly bars; status
    // and search only change the member table, so keep the chart visible.
    if (lastFetchedYear.current !== query.year) setChartLoading(true);
    const timer = window.setTimeout(() => {
      repos.admin
        .getSavingsDashboard(query)
        .then((d) => {
          if (live) {
            setData(d);
            lastFetchedYear.current = query.year;
          }
        })
        .catch((e) => {
          if (live) toast((e as Error).message);
        })
        .finally(() => {
          if (live) {
            setLoading(false);
            setChartLoading(false);
          }
        });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [repos, query, toast]);

  const focusMonth = data?.focus_month ?? 8;
  const focusName = MONTHS[focusMonth - 1] ?? "September";
  const nextName = MONTHS_SHORT[focusMonth % 12] ?? "Oct";
  const chart = data?.monthly_chart ?? [];
  const members = data?.members ?? [];
  const maxCount = data?.summary.member_count || 1;

  const exportCsv = async () => {
    downloadCsv(
      `iwh-savings-${year}.csv`,
      ["Member ID", "Name", "Monthly target", "Months saved", "Saved", focusName, "Interest"],
      members.map((m) => [
        m.member_id,
        m.name,
        m.monthly_target == null ? "Not set" : formatNaira(m.monthly_target),
        `${m.months_saved} of ${m.total_months}`,
        formatNaira(m.total_saved),
        STATUS_META[m.focus_month_status].label,
        m.interest_eligible ? "Eligible" : "Forfeited",
      ]),
    );
    if (session?.kind === "admin") {
      await repos.admin.logAudit({
        at: clock.now().toISOString(),
        actor: session.admin.name,
        role: session.admin.role === "SuperAdmin" ? "Super Admin" : "Administrator",
        action: "Exported savings list",
        entity: `Savings ${year}`,
        change: `CSV, ${members.length} rows`,
        category: "Access",
      });
    }
    toast("Savings exported.");
  };

  return (
    <>
      <AdminPageHeader
        title="Savings"
        sub={`Monthly savings across members · ${year}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-40">
              <SelectField aria-label="Savings year" options={["2026", "2025", "2024"]} value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <Button variant="outline" size="md" icon={<Download size={18} />} onClick={exportCsv}>Export</Button>
          </div>
        }
      />
      <div className="flex flex-col gap-3.5 px-4 py-5 sm:px-8 sm:py-6">
        <div className="grid gap-3.5 md:grid-cols-4">
          <Kpi
            label="Saved by sample members"
            value={formatNaira(data?.summary.total_saved ?? 0)}
            note={`${data?.summary.member_count ?? 0} members`}
          />
          <Kpi
            label="Up to date"
            value={data?.summary.up_to_date ?? 0}
            note={`Paid ${focusName}`}
            tone="good"
          />
          <Kpi
            label="Months locked early"
            value={data?.summary.locked_early ?? 0}
            note="200%–500% of baseline"
          />
          <Kpi
            label="Behind"
            value={data?.summary.behind ?? 0}
            note="Late or missed"
            tone={data?.summary.behind ? "warn" : undefined}
          />
        </div>

        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-extrabold">Members who have saved each month</h2>
            <p className="text-[13px] font-semibold text-mute">
              {focusName} in gold: open until 5 {nextName}
            </p>
          </div>
          {chartLoading || !data ? (
            <div className="flex h-40 items-center justify-center gap-2" role="status" aria-live="polite">
              <LoaderCircle className="animate-spin text-brand" size={18} />
              <p className="text-sm font-semibold text-mute">Loading savings…</p>
            </div>
          ) : (
            <div className="flex h-40 items-end gap-1.5 sm:gap-2.5">
              {chart.map((m) => {
                const count = m.up_to_date + m.paid + m.late;
                return (
                  <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className="text-[11px] font-bold text-mute">{count}</span>
                    <div
                      className="w-full rounded-lg"
                      style={{
                        height: `${Math.max(4, (count / maxCount) * 120)}px`,
                        background:
                          m.month === focusMonth
                            ? "#f2a93b"
                            : m.month < focusMonth
                              ? "#0e7a5c"
                              : "#e7e3ec",
                      }}
                    />
                    <span className="text-[11px] font-semibold text-mute">
                      {MONTHS_SHORT[m.month - 1] ?? m.month}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Chips<Tab> value={tab} onChange={setTab} options={TABS} />
          <label className="flex h-10.5 w-full items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand sm:ml-auto sm:w-72">
            <Search size={18} />
            <input
              className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
              placeholder="Search member"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <Card className="flex h-40 items-center justify-center gap-2" role="status" aria-live="polite">
            <LoaderCircle className="animate-spin text-brand" size={18} />
            <p className="text-sm font-semibold text-mute">Loading members…</p>
          </Card>
        ) : (
          <DataTable<AdminSavingsMember>
            rows={members}
            rowKey={(r) => r.id || r.member_id}
            onRowClick={(r) => navigate(paths.admin.member(r.id || r.member_id))}
            columns={[
              {
                header: "Member",
                render: (r) => (
                  <span className="flex flex-col">
                    <b>{r.name}</b>
                    <span className="font-mono text-xs text-mute">{r.member_id}</span>
                  </span>
                ),
              },
              {
                header: "Monthly target",
                align: "right",
                render: (r) =>
                  r.monthly_target == null ? "Not set" : formatNaira(r.monthly_target),
              },
              {
                header: "Months saved",
                align: "right",
                render: (r) => `${r.months_saved} of ${r.total_months}`,
              },
              {
                header: "Saved",
                align: "right",
                render: (r) => <b>{formatNaira(r.total_saved)}</b>,
              },
              {
                header: focusName,
                render: (r) => (
                  <Pill tone={STATUS_META[r.focus_month_status].tone}>
                    {STATUS_META[r.focus_month_status].label}
                  </Pill>
                ),
              },
              {
                header: "Interest",
                render: (r) =>
                  r.interest_eligible ? (
                    <Pill tone="ok" icon={<ShieldCheck size={12} />}>Eligible</Pill>
                  ) : (
                    <Pill tone="fail">Forfeited</Pill>
                  ),
              },
            ]}
            empty="No members match these filters"
          />
        )}
      </div>
    </>
  );
}
