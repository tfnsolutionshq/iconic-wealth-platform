import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Search, ShieldCheck } from "lucide-react";
import type { MemberSummary } from "@/domain/entities";
import { formatNaira } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { Button, Card, Chips, DataTable, Kpi, Pill, SelectField } from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";
import { downloadCsv } from "../../../utils/csv";

const MONTH_TONE = { Paid: "ok", Locked: "ok", Open: "pending", Due: "pending", Late: "pending", Missed: "fail", NotDue: "mute", BeforeJoining: "mute" } as const;
type Tab = "All" | "Paid" | "Due" | "Late" | "Missed";

/** ADM-13: monthly savings across members, with members-saving-per-month chart. */
export function AdminSavingsPage() {
  const { repos, clock } = useServices();
  const toast = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState("2026");
  const [tab, setTab] = useState<Tab>("All");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<MemberSummary[]>([]);
  const [monthly, setMonthly] = useState<{ month: string; members: number }[]>([]);

  useEffect(() => {
    repos.admin.savingsOverview(Number(year)).then((d) => {
      setRows(d.rows);
      setMonthly(d.monthly);
    });
  }, [repos, year]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (m) =>
        (tab === "All" || (tab === "Paid" ? m.currentMonthStatus === "Paid" : m.currentMonthStatus === tab)) &&
        (!q || `${m.name} ${m.id}`.toLowerCase().includes(q)),
    );
  }, [rows, tab, search]);

  const saved = rows.reduce((s, m) => s + m.savedKobo, 0);
  const upToDate = rows.filter((m) => m.currentMonthStatus === "Paid").length;
  const locked = rows.filter((m) => m.currentMonthStatus === "Locked").length;
  const behind = rows.filter((m) => m.currentMonthStatus === "Missed" || m.currentMonthStatus === "Late").length;

  const exportCsv = async () => {
    downloadCsv(`iwh-savings-${year}.csv`,
      ["Member ID", "Name", "Monthly target", "Months saved", "Saved", "September", "Interest"],
      list.map((m) => [m.id, m.name, String(Math.round(m.targetKobo / 100)), `${m.monthsPaid} of 11`, formatNaira(m.savedKobo), m.currentMonthStatus, m.eligibility]));
    if (session?.kind === "admin") {
      await repos.admin.logAudit({ at: clock.now().toISOString(), actor: session.admin.name,
        role: session.admin.role === "SuperAdmin" ? "Super Admin" : "Administrator",
        action: "Exported savings list", entity: `Savings ${year}`, change: `CSV, ${list.length} rows`, category: "Access" });
    }
    toast("Savings exported.");
  };

  return (
    <>
      <AdminPageHeader
        title="Savings"
        sub={`Monthly savings across members · ${year}`}
        actions={
          <div className="flex items-center gap-2">
            <div className="w-40">
              <SelectField aria-label="Savings year" options={["2026", "2025", "2024"]} value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <Button variant="outline" size="md" icon={<Download size={18} />} onClick={exportCsv}>Export</Button>
          </div>
        }
      />
      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="grid gap-3.5 md:grid-cols-4">
          <Kpi label="Saved by sample members" value={formatNaira(saved)} note={`${rows.length} members`} />
          <Kpi label="Up to date" value={upToDate} note="Paid September" tone="good" />
          <Kpi label="Locked early" value={locked} note="September locked" />
          <Kpi label="Behind" value={behind} note="Late or missed" tone={behind ? "warn" : undefined} />
        </div>
        <Card>
          <h2 className="text-base font-extrabold">Members who have saved each month</h2>
          <p className="mb-3 text-[13px] font-semibold text-mute">September in gold: open until 5 Oct</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e3ec" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="members" name="Members saving" radius={[6, 6, 0, 0]}>
                  {monthly.map((_, i) => (
                    <Cell key={i} fill={i === 8 ? "#f2a93b" : i < 8 ? "#0e7a5c" : "#e7e3ec"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <div className="flex flex-wrap items-center gap-2">
          <Chips<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "All", label: "All" },
              { value: "Paid", label: "Up to date" },
              { value: "Due", label: "Due" },
              { value: "Late", label: "Late" },
              { value: "Missed", label: "Missed" },
            ]}
          />
          <label className="ml-auto flex h-10.5 w-72 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
            <Search size={18} />
            <input
              className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
              placeholder="Search member"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <DataTable<MemberSummary>
          rows={list}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(paths.admin.member(r.id))}
          columns={[
            { header: "Member", render: (r) => (<span className="flex flex-col"><b>{r.name}</b><span className="font-mono text-xs text-mute">{r.id}</span></span>) },
            { header: "Monthly target", align: "right", render: (r) => (r.targetKobo ? formatNaira(r.targetKobo) : "Not set") },
            { header: "Months saved", align: "right", render: (r) => `${r.monthsPaid} of 11` },
            { header: "Saved", align: "right", render: (r) => <b>{formatNaira(r.savedKobo)}</b> },
            { header: "September", render: (r) => <Pill tone={MONTH_TONE[r.currentMonthStatus]}>{r.currentMonthStatus}</Pill> },
            { header: "Interest", render: (r) => (r.eligibility === "Eligible"
              ? <Pill tone="ok" icon={<ShieldCheck size={12} />}>Eligible</Pill>
              : <Pill tone="fail">Forfeited</Pill>) },
          ]}
        />
        <p className="text-[13px] font-semibold text-mute">Showing {list.length} of {rows.length} · sample data</p>
      </div>
    </>
  );
}
