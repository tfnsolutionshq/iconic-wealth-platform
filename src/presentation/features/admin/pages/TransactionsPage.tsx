import { useEffect, useMemo, useState } from "react";
import { Clock, Download, Search } from "lucide-react";
import type { Transaction } from "@/domain/entities";
import { MONTHS, formatNaira } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import { Banner, Button, Card, Chips, DataTable, Modal, Pill, Select } from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { downloadCsv } from "../../../utils/csv";

const STATUS_TONE = { Successful: "ok", Pending: "pending", Failed: "fail", Processing: "info" } as const;
type Tab = "All" | "Successful" | "Pending" | "Failed" | "Late";
type Kind = "All" | "Contribution" | "Payout";
type Range = "all" | "today" | "7" | "30";

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

const describe = (t: Transaction) => {
  if (t.kind === "Payout") return `${t.year} year-end payout`;
  const ms = [...new Set(t.allocations.map((a) => a.month))].sort((a, b) => a - b);
  return ms.length > 1 ? `${MONTHS[ms[0]]} – ${MONTHS[ms[ms.length - 1]]} contribution` : `${MONTHS[ms[0]]} contribution`;
};

const downloadText = (filename: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/** ADM-14: all contributions and payouts with receipt preview. */
export function AdminTransactionsPage() {
  const { repos, clock } = useServices();
  const toast = useToast();
  const { session } = useAuth();
  const now = useMemo(() => clock.now(), [clock]);
  const [all, setAll] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<Tab>("All");
  const [kind, setKind] = useState<Kind>("All");
  const [range, setRange] = useState<Range>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Transaction | null>(null);

  useEffect(() => {
    repos.admin.listTransactions().then(setAll);
  }, [repos]);

  const daysAgo = (iso: string) => (now.getTime() - new Date(iso).getTime()) / 86_400_000;
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (t) =>
        (tab === "All" || (tab === "Late" ? t.late : t.status === tab)) &&
        (kind === "All" || t.kind === kind) &&
        (range === "all" || (range === "today" ? daysAgo(t.createdAt) < 1 : daysAgo(t.createdAt) < Number(range))) &&
        (!q || `${t.memberName} ${t.memberId} ${t.reference} ${t.gatewayReference ?? ""} ${Math.round(t.amountKobo / 100)}`.toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, tab, kind, range, search, now]);

  const count = (t: Tab) => (t === "All" ? all.length : t === "Late" ? all.filter((x) => x.late).length : all.filter((x) => x.status === t).length);

  const exportCsv = async () => {
    downloadCsv("iwh-transactions.csv",
      ["Date", "Member ID", "Member", "Type", "Description", "Amount", "Charge", "Reference", "Paystack ref", "Status", "Reason"],
      list.map((t) => [t.createdAt.slice(0, 10), t.memberId, t.memberName, t.kind, describe(t), formatNaira(t.amountKobo),
        formatNaira(t.platformChargeKobo), t.reference, t.gatewayReference ?? "—", t.status, t.failureReason ?? "—"]));
    if (session?.kind === "admin") {
      await repos.admin.logAudit({ at: clock.now().toISOString(), actor: session.admin.name,
        role: session.admin.role === "SuperAdmin" ? "Super Admin" : "Administrator",
        action: "Exported transactions", entity: "Transactions", change: `CSV, ${list.length} rows`, category: "Access" });
    }
    toast(`Exported ${list.length} transactions.`);
  };

  const receipt = (t: Transaction) =>
    [`Iconic Wealth Hub — ${t.kind} receipt`, `Member: ${t.memberName} (${t.memberId})`, `Description: ${describe(t)}`,
      `Amount: ${formatNaira(t.amountKobo)}`, `Platform charge: ${formatNaira(t.platformChargeKobo)}`, `Reference: ${t.reference}`,
      `Paystack ref: ${t.gatewayReference ?? "—"}`, `Date: ${fmtDateTime(t.createdAt)}`, `Status: ${t.status}${t.late ? " · Late" : ""}`,
      ...(t.failureReason ? [`Reason: ${t.failureReason}`] : [])].join("\n");

  return (
    <>
      <AdminPageHeader
        title="Transactions"
        sub="All contributions and payouts · click a row to preview the receipt"
        actions={<Button variant="outline" size="md" icon={<Download size={18} />} onClick={exportCsv}>Export</Button>}
      />
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Chips<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "All", label: `All ${count("All")}` },
              { value: "Successful", label: `Successful ${count("Successful")}` },
              { value: "Pending", label: `Pending ${count("Pending")}` },
              { value: "Failed", label: `Failed ${count("Failed")}` },
              { value: "Late", label: `Late ${count("Late")}` },
            ]}
          />
          <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="flex h-10.5 w-full sm:w-64 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
              <Search size={18} />
              <input
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                placeholder="Member, reference or amount"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Select aria-label="Transaction type" value={kind} onChange={(e) => setKind(e.target.value as Kind)} options={[{ value: "All", label: "All types" }, { value: "Contribution", label: "Contributions" }, { value: "Payout", label: "Payouts" }]} />
            <Select aria-label="Filter by date" value={range} onChange={(e) => setRange(e.target.value as Range)} options={[{ value: "all", label: "Any date" }, { value: "today", label: "Today" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }]} />
          </div>
        </div>
        <DataTable<Transaction>
          rows={list}
          rowKey={(r) => r.id}
          onRowClick={setOpen}
          columns={[
            { header: "Date", render: (t) => <span className="text-mute">{fmtDateTime(t.createdAt)}</span> },
            { header: "Member", render: (t) => <b>{t.memberName}</b> },
            { header: "Description", render: (t) => (<span className="flex items-center gap-2">{describe(t)}{t.late && <Pill tone="pending" icon={<Clock size={12} />}>Late</Pill>}</span>) },
            { header: "Amount", align: "right", render: (t) => <b>{formatNaira(t.amountKobo)}</b> },
            { header: "Platform charge", align: "right", render: (t) => formatNaira(t.platformChargeKobo) },
            { header: "Reference", render: (t) => <span className="font-mono text-xs">{t.reference}</span> },
            { header: "Status", render: (t) => <Pill tone={STATUS_TONE[t.status]}>{t.status}</Pill> },
            { header: "Reason", render: (t) => <span className="text-sm text-mute">{t.failureReason ?? "—"}</span> },
          ]}
        />
        <p className="text-[13px] font-semibold text-mute">Showing {list.length} of {all.length}</p>
        <Banner tone="neutral">
          Status comes from server-side verification with Paystack. Each payment must be at least the platform minimum (₦10,000); online payments carry a ₦100 platform charge.
        </Banner>
      </div>

      <Modal
        open={!!open}
        title="Receipt preview"
        onClose={() => setOpen(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(null)}>Close</Button>
            <Button icon={<Download size={18} />} onClick={() => open && (downloadText(`receipt-${open.reference}.txt`, receipt(open)), toast("Receipt downloaded."))}>
              Download receipt
            </Button>
          </>
        }
      >
        {open && (
          <Card tone="soft" className="flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <b>{describe(open)}</b>
              <Pill tone={STATUS_TONE[open.status]}>{open.status}</Pill>
            </div>
            {[["Member", `${open.memberName} (${open.memberId})`], ["Amount", formatNaira(open.amountKobo)],
              ["Platform charge", formatNaira(open.platformChargeKobo)], ["Reference", open.reference],
              ["Paystack ref", open.gatewayReference ?? "—"], ["Date", fmtDateTime(open.createdAt)],
              ...(open.failureReason ? [["Reason", open.failureReason] as [string, string]] : [])].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 border-t border-line py-2 text-sm first:border-t-0 sm:flex-row sm:justify-between sm:gap-3">
                <span className="shrink-0 font-semibold text-mute">{k}</span>
                <span className="min-w-0 font-bold break-all sm:text-right">{v}</span>
              </div>
            ))}
          </Card>
        )}
      </Modal>
    </>
  );
}
