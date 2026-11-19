import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  ChartColumn,
  Clock3,
  CreditCard,
  Download,
  LoaderCircle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { ReportKind, ReportResult } from "@/domain/entities";
import { MONTHS } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Button,
  Card,
  cn,
  DataTable,
  OpenDecisionTag,
  Select,
} from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { downloadCsv } from "../../../utils/csv";

type ReportMeta = {
  value: ReportKind;
  name: string;
  desc: string;
  icon: LucideIcon;
  statuses: string[];
  /** Column that the status filter compares against. */
  statusColumn?: number;
  /** Prototype payout rows are filtered with `startsWith`, not equality. */
  statusStartsWith?: boolean;
  monthMode?: "month" | "all-months";
};

/** Mirrors the prototype's six report cards, order, wording and filter sets. */
const REPORTS: ReportMeta[] = [
  {
    value: "compliance",
    name: "Monthly contribution compliance",
    desc: "Member, month, on time / late / missed",
    icon: CalendarDays,
    statuses: ["All", "Paid", "Due", "Late", "Missed", "Not due"],
    statusColumn: 3,
    monthMode: "month",
  },
  {
    value: "eligibility",
    name: "Interest eligibility",
    desc: "Eligibility and forfeiture reason",
    icon: ShieldCheck,
    statuses: ["All", "Eligible", "Forfeited"],
    statusColumn: 2,
  },
  {
    value: "charges",
    name: "Contribution charges",
    desc: "Platform charge per payment",
    icon: CreditCard,
    statuses: ["All", "Successful", "Pending", "Failed"],
    statusColumn: 5,
    monthMode: "all-months",
  },
  {
    value: "payout",
    name: "Year-end payout",
    desc: "Member, savings, interest, status",
    icon: Banknote,
    statuses: ["All", "Paid", "Failed", "Pending"],
    statusColumn: 5,
    statusStartsWith: true,
  },
  {
    value: "late",
    name: "Late contributions",
    desc: "Payments after the 5th",
    icon: Clock3,
    statuses: ["All"],
  },
  {
    value: "savings",
    name: "Savings by member",
    desc: "Baseline, months paid, total saved",
    icon: ChartColumn,
    statuses: ["All", "Paid", "Due", "Late", "Missed"],
    statusColumn: 5,
  },
];

const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i), label: m }));

/** ADM-21: pick a report, filter it and export. */
export function ReportsPage() {
  const { repos, clock } = useServices();
  const toast = useToast();
  const { session } = useAuth();
  const [kind, setKind] = useState<ReportKind>("compliance");
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState<string>("8");
  const [status, setStatus] = useState("All");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);

  const meta = REPORTS.find((r) => r.value === kind) ?? REPORTS[0];

  useEffect(() => {
    let live = true;
    setLoading(true);
    const apiMonth =
      meta.monthMode === "all-months"
        ? month === "all"
          ? "all"
          : Number(month)
        : meta.monthMode === "month" || kind === "late"
          ? Number(month)
          : undefined;
    repos.admin
      .runReport(
        kind,
        Number(year),
        apiMonth,
        status === "All" ? undefined : status,
      )
      .then((data) => {
        if (live) setResult(data);
      })
      .catch(() => {
        if (live) setResult({ headers: [], rows: [] });
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, kind, year, month, status]);

  /** The prototype filters the visible column locally, then exports what is shown. */
  const visible = useMemo(() => {
    if (!result) return null;
    if (meta.statusColumn == null || status === "All") return result;
    const column = meta.statusColumn;
    return {
      ...result,
      rows: result.rows.filter((r) => {
        const cell = r[column] ?? "";
        return meta.statusStartsWith ? cell.startsWith(status) : cell === status;
      }),
    };
  }, [result, meta, status]);

  const pickReport = (next: ReportKind) => {
    setKind(next);
    setMonth(next === "charges" ? "all" : "8");
    setStatus("All");
  };

  const exportCsv = async () => {
    if (!visible) return;
    downloadCsv(`iwh-report-${kind}-${year}.csv`, visible.headers, visible.rows);
    if (session?.kind === "admin") {
      await repos.admin.logAudit({
        at: clock.now().toISOString(),
        actor: session.admin.name,
        role:
          session.admin.role === "SuperAdmin" ? "Super Admin" : "Administrator",
        action: "Exported report",
        entity: `${meta.name} ${year}`,
        change: `CSV, ${visible.rows.length} rows`,
        category: "Access",
      });
    }
    toast("Report exported.");
  };

  return (
    <>
      <AdminPageHeader
        title="Reports"
        sub="Pick a report, filter it and export"
        actions={
          <Button size="sm" icon={<Download size={18} />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <div className="flex flex-col gap-3 px-4 py-5 sm:px-8 sm:py-6">
        <div className="grid gap-3 md:grid-cols-3">
          {REPORTS.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.value}
                onClick={() => pickReport(r.value)}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-card border-[1.5px] p-4 text-left transition",
                  kind === r.value
                    ? "border-2 border-brand bg-[#faf7fe]"
                    : "border-[1.5px] border-line bg-white hover:border-brand",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-brand-tint text-brand-dark">
                    <Icon size={18} />
                  </span>
                  <b>{r.name}</b>
                </span>
                <span className="text-[13px] font-semibold text-mute">
                  {r.desc}
                </span>
              </button>
            );
          })}
        </div>

        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2.5">
            <h2 className="flex-1 text-base font-extrabold">{meta.name}</h2>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-mute">Year</span>
              <Select
                aria-label="Report year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                options={["2026", "2025", "2024"]}
              />
            </div>
            {meta.monthMode && (
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-mute">
                  Month
                </span>
                <Select
                  aria-label="Report month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  options={
                    meta.monthMode === "month"
                      ? MONTH_OPTIONS
                      : [
                          { value: "all", label: "All months" },
                          ...MONTH_OPTIONS,
                        ]
                  }
                />
              </div>
            )}
            {meta.statuses.length > 1 && (
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-mute">
                  Status
                </span>
                <Select
                  aria-label="Filter by status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  options={meta.statuses}
                />
              </div>
            )}
          </div>

          {loading ? (
            <Card
              role="status"
              aria-live="polite"
              className="flex min-h-48 items-center justify-center gap-2"
            >
              <LoaderCircle className="animate-spin text-brand" size={18} />
              <p className="text-sm font-semibold text-mute">
                Loading reports…
              </p>
            </Card>
          ) : (
            <DataTable<string[]>
              rows={visible?.rows ?? []}
              rowKey={(r) => r.join("|")}
              columns={(visible?.headers ?? []).map((h, i) => ({
                header: h,
                align: (visible?.rows ?? []).some((r) => /₦/.test(r[i] ?? ""))
                  ? ("right" as const)
                  : ("left" as const),
                render: (r) => (i === 1 ? <b>{r[i]}</b> : r[i]),
              }))}
              empty="No rows for these filters"
            />
          )}
          <p className="text-[13px] font-semibold text-mute">
            {loading
              ? "Loading reports…"
              : `${visible?.rows.length ?? 0} row${visible?.rows.length === 1 ? "" : "s"} · sample data`}
          </p>
        </Card>
        <OpenDecisionTag code="OD-09">
          Final report list and export formats
        </OpenDecisionTag>
      </div>
    </>
  );
}
