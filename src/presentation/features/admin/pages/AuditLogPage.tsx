import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import type { AuditCategory, AuditEntry } from "@/domain/entities";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { Banner, Button, Chips, DataTable, Pill } from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { downloadCsv } from "../../../utils/csv";

type Tab = "All" | AuditCategory;
type Range = "all" | "today" | "7" | "30";

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

/** ADM-23: every privileged and financial action. Entries are append-only. */
export function AuditLogPage() {
  const { repos, clock } = useServices();
  const toast = useToast();
  const now = useMemo(() => clock.now(), [clock]);
  const [all, setAll] = useState<AuditEntry[]>([]);
  const [tab, setTab] = useState<Tab>("All");
  const [range, setRange] = useState<Range>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    repos.admin.listAuditLog().then(setAll);
  }, [repos]);

  const daysAgo = (iso: string) => (now.getTime() - new Date(iso).getTime()) / 86_400_000;
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (a) =>
        (tab === "All" || a.category === tab) &&
        (range === "all" || (range === "today" ? daysAgo(a.at) < 1 : daysAgo(a.at) < Number(range))) &&
        (!q || `${a.actor} ${a.action} ${a.entity} ${a.change}`.toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, tab, range, search, now]);

  const exportCsv = () => {
    downloadCsv("iwh-audit-log.csv", ["When", "Who", "Role", "Action", "Record", "Change", "Type"],
      list.map((a) => [a.at, a.actor, a.role, a.action, a.entity, a.change, a.category]));
    toast("Audit log exported.");
  };

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        sub="Every privileged and financial action"
        actions={<Button variant="outline" size="md" icon={<Download size={18} />} onClick={exportCsv}>Export</Button>}
      />
      <div className="flex flex-col gap-4 px-8 py-6">
        <Banner tone="neutral">
          Audit entries can’t be edited or deleted by anyone, including Super Admins. Actions you take in this build appear here.
        </Banner>
        <div className="flex flex-wrap items-center gap-2">
          <Chips<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "All", label: "All" },
              { value: "Financial", label: "Financial" },
              { value: "Members", label: "Members" },
              { value: "Access", label: "Access" },
              { value: "Roles", label: "Roles" },
            ]}
          />
          <div className="ml-auto flex gap-2">
            <label className="flex h-10.5 w-72 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
              <Search size={18} />
              <input className="w-full bg-transparent text-sm font-semibold text-ink outline-none" placeholder="Search person, action or record" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <select aria-label="Filter by date" className="h-10.5 rounded-xl border-[1.5px] border-line bg-white px-3 text-sm font-semibold outline-none focus:border-brand" value={range} onChange={(e) => setRange(e.target.value as Range)}>
              <option value="all">Any date</option>
              <option value="today">Today</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
        </div>
        <DataTable<AuditEntry>
          rows={list}
          rowKey={(r) => r.id}
          columns={[
            { header: "When", render: (a) => <span className="whitespace-nowrap text-mute">{fmtDateTime(a.at)}</span> },
            { header: "Who", render: (a) => (<span className="flex flex-col"><b>{a.actor}</b><span className="text-xs font-semibold text-mute">{a.role}</span></span>) },
            { header: "Action", render: (a) => <b>{a.action}</b> },
            { header: "Record", render: (a) => <span className="font-mono text-xs">{a.entity}</span> },
            { header: "Change", render: (a) => <span className="text-mute">{a.change}</span> },
            { header: "Type", render: (a) => <Pill tone="mute" icon={false}>{a.category}</Pill> },
          ]}
        />
        <p className="text-[13px] font-semibold text-mute">Showing {list.length} of {all.length}</p>
      </div>
    </>
  );
}
