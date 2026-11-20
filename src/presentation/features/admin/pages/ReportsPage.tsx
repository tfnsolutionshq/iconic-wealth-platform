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
import type { AdminReportKey, AdminReports } from "@/domain/entities";
import { MONTHS } from "@/domain/rules";
import {
  ADMIN_REPORT_KEYS,
  REPORT_STATUS_OPTIONS,
} from "@/domain/rules/reports";
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

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(
  String,
);

/** Matches the six report cards in `#/admin/reports`. */
const REPORT_META: Record<
  AdminReportKey,
  { title: string; description: string; icon: LucideIcon }
> = {
  compliance: {
    title: "Monthly contribution compliance",
    description: "Member, month, on time / late / missed",
    icon: CalendarDays,
  },
  eligibility: {
    title: "Interest eligibility",
    description: "Eligibility and forfeiture reason",
    icon: ShieldCheck,
  },
  charges: {
    title: "Contribution charges",
    description: "Platform charge per payment",
    icon: CreditCard,
  },
  payout: {
    title: "Year-end payout",
    description: "Member, savings, interest, status",
    icon: Banknote,
  },
  late: {
    title: "Late contributions",
    description: "Payments after the 5th",
    icon: Clock3,
  },
  savings: {
    title: "Savings by member",
    description: "Baseline, months paid, total saved",
    icon: ChartColumn,
  },
};

/** ADM-21: one `GET /admin/reports` call feeds all six sections. */
export function ReportsPage() {
  const { repos, clock } = useServices();
  const toast = useToast();
  const { session } = useAuth();
  const [kind, setKind] = useState<AdminReportKey>("compliance");
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState("All");
  const [data, setData] = useState<AdminReports | null>(null);
  const [loading, setLoading] = useState(true);

  /** Compliance defaults to August; charges defaults to all months. */
  const effectiveMonth = useMemo(() => {
    if (kind === "compliance") return month ?? "8";
    if (kind === "charges") return month ?? "all";
    return undefined;
  }, [kind, month]);
  const apiMonth: number | "all" | undefined =
    effectiveMonth === undefined
      ? undefined
      : effectiveMonth === "all"
        ? "all"
        : Number(effectiveMonth);
  const query = useMemo(
    () => ({
      year: Number(year),
      month: apiMonth,
      eligibility: status === "All" ? undefined : status,
    }),
    [year, apiMonth, status],
  );

  useEffect(() => {
    let live = true;
    setLoading(true);
    repos.admin
      .getReports(query)
      .then((payload) => {
        if (live) setData(payload);
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
  }, [repos, query, toast]);

  const result = data?.reports[kind];
  const statusOptions = REPORT_STATUS_OPTIONS[kind];
  // The reports API uses 1-based calendar months (e.g. 8 = August).
  const monthOptions =
    kind === "charges"
      ? [
          { value: "all", label: "All months" },
          ...MONTHS.map((label, index) => ({
            value: String(index + 1),
            label,
          })),
        ]
      : MONTHS.map((label, index) => ({ value: String(index + 1), label }));

  const pickReport = (next: AdminReportKey) => {
    setKind(next);
    setStatus("All");
  };

  const exportCsv = async () => {
    if (!result) return;
    downloadCsv(`iwh-report-${kind}-${year}.csv`, result.headers, result.rows);
    if (session?.kind === "admin") {
      await repos.admin.logAudit({
        at: clock.now().toISOString(),
        actor: session.admin.name,
        role:
          session.admin.role === "SuperAdmin" ? "Super Admin" : "Administrator",
        action: "Exported report",
        entity: `${REPORT_META[kind].title} ${year}`,
        change: `CSV, ${result.rows.length} rows`,
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
          <Button
            size="sm"
            icon={<Download size={18} />}
            disabled={loading || !result}
            onClick={exportCsv}
          >
            Export CSV
          </Button>
        }
      />
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_REPORT_KEYS.map((key) => {
            const meta = REPORT_META[key];
            const Icon = meta.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => pickReport(key)}
                aria-pressed={kind === key}
                className={cn(
                  "flex flex-col items-start gap-2.5 rounded-card border-[1.5px] p-4 text-left transition",
                  kind === key
                    ? "border-brand bg-[#faf7fe]"
                    : "border-line bg-white hover:border-brand",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-soft text-brand">
                    <Icon size={18} />
                  </span>
                  <b>{meta.title}</b>
                </span>
                <span className="text-left text-[13px] font-semibold text-mute">
                  {meta.description}
                </span>
              </button>
            );
          })}
        </div>

        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <h3 className="text-lg font-extrabold sm:mr-auto">
              {REPORT_META[kind].title}
            </h3>
            <Select
              aria-label="Report year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              options={YEAR_OPTIONS}
            />
            {(kind === "compliance" || kind === "charges") && (
              <Select
                aria-label="Report month"
                value={effectiveMonth}
                onChange={(e) => setMonth(e.target.value)}
                options={monthOptions}
              />
            )}
            {statusOptions.length > 1 && (
              <Select
                aria-label="Filter by status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={statusOptions}
              />
            )}
          </div>

          {loading || !result ? (
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
            <>
              <DataTable<string[]>
                rows={result.rows}
                rowKey={(r) => `${r[0] ?? "row"}-${r[1] ?? ""}-${r[2] ?? ""}`}
                columns={result.headers.map((header, index) => ({
                  header,
                  align: result.rows.some((row) => /₦/.test(row[index] ?? ""))
                    ? ("right" as const)
                    : ("left" as const),
                  render: (row) =>
                    index === 1 ? (
                      <b>{row[index] ?? "—"}</b>
                    ) : (
                      (row[index] ?? "—")
                    ),
                }))}
                empty="No rows for these filters"
              />
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[13px] font-semibold text-mute">
                  {result.rows.length} row
                  {result.rows.length === 1 ? "" : "s"} · sample data
                </p>
                <span className="ml-auto">
                  <OpenDecisionTag code="OD-09">
                    Final report list and export formats
                  </OpenDecisionTag>
                </span>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
