import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import type { ReportKind, ReportResult } from "@/domain/entities";
import { MONTHS } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { Button, Card, DataTable, OpenDecisionTag } from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { downloadCsv } from "../../../utils/csv";
import { cn } from "../../../design-system";

const KINDS: { value: ReportKind; name: string; desc: string }[] = [
  { value: "compliance", name: "Monthly compliance", desc: "Who has paid each month" },
  { value: "collections", name: "Collections", desc: "Totals collected per month" },
  { value: "eligibility", name: "Interest eligibility", desc: "Eligible vs forfeited members" },
  { value: "charges", name: "Platform charges", desc: "Charges collected per payment" },
];

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

  useEffect(() => {
    setStatus("All");
    repos.admin.runReport(kind, Number(year), kind === "compliance" ? Number(month) : kind === "charges" && month !== "all" ? Number(month) : "all",
      kind === "compliance" || kind === "eligibility" ? "All" : undefined).then(setResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, kind, year, month]);

  useEffect(() => {
    if (kind !== "compliance" && kind !== "eligibility") return;
    repos.admin.runReport(kind, Number(year), "all", status).then(setResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const exportCsv = async () => {
    if (!result) return;
    downloadCsv(`iwh-report-${kind}-${year}.csv`, result.headers, result.rows);
    if (session?.kind === "admin") {
      await repos.admin.logAudit({ at: clock.now().toISOString(), actor: session.admin.name,
        role: session.admin.role === "SuperAdmin" ? "Super Admin" : "Administrator",
        action: "Exported report", entity: `${KINDS.find((k) => k.value === kind)?.name} ${year}`, change: `CSV, ${result.rows.length} rows`, category: "Access" });
    }
    toast("Report exported.");
  };

  return (
    <>
      <AdminPageHeader
        title="Reports"
        sub="Pick a report, filter it and export"
        actions={<Button size="md" icon={<Download size={18} />} onClick={exportCsv}>Export CSV</Button>}
      />
      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="grid gap-3 md:grid-cols-4">
          {KINDS.map((k) => (
            <button key={k.value} onClick={() => setKind(k.value)}
              className={cn("flex flex-col items-start gap-1 rounded-card border-[1.5px] p-4 text-left transition",
                kind === k.value ? "border-brand bg-[#faf7fe]" : "border-line bg-white hover:border-brand")}>
              <b>{k.name}</b>
              <span className="text-[13px] font-semibold text-mute">{k.desc}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Report year" className="h-10.5 rounded-xl border-[1.5px] border-line bg-white px-3 text-sm font-semibold outline-none focus:border-brand" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
          {(kind === "compliance" || kind === "charges") && (
            <select aria-label="Report month" className="h-10.5 rounded-xl border-[1.5px] border-line bg-white px-3 text-sm font-semibold outline-none focus:border-brand" value={month} onChange={(e) => setMonth(e.target.value)}>
              {kind === "charges" && <option value="all">All months</option>}
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          )}
          {(kind === "compliance" || kind === "eligibility") && (
            <select aria-label="Filter by status" className="h-10.5 rounded-xl border-[1.5px] border-line bg-white px-3 text-sm font-semibold outline-none focus:border-brand" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="All">All</option>
              <option value="Eligible">Eligible</option>
              <option value="Forfeited">Forfeited</option>
            </select>
          )}
        </div>
        {result && (
          <>
            <DataTable<string[]>
              rows={result.rows}
              rowKey={(r) => `${r[0]}|${r[1] ?? ""}`}
              columns={result.headers.map((h, i) => ({
                header: h,
                align: /₦|saved|charge|interest|total|payments|months/i.test(h) ? "right" as const : "left" as const,
                render: (r) => (i === 0 ? <b>{r[i]}</b> : r[i]),
              }))}
              empty="No rows for these filters"
            />
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[13px] font-semibold text-mute">{result.rows.length} row(s) · sample data</p>
              <span className="ml-auto"><OpenDecisionTag code="OD-09">Final report list and export formats</OpenDecisionTag></span>
            </div>
          </>
        )}
        {result === null && <Card><p className="text-sm font-semibold text-mute">Loading…</p></Card>}
      </div>
    </>
  );
}
