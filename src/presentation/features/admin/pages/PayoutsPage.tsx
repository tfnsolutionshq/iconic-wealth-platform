import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import type { PayoutBatch, PayoutBatchStatus } from "@/domain/entities";
import { formatNaira } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { Button, Chips, DataTable, Modal, Pill } from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";

const STATUS_TONE = { "Awaiting approval": "pending", "Returned to maker": "fail", Approved: "info", Processing: "info", Partial: "gold", Completed: "ok" } as const;
type Tab = "All" | PayoutBatchStatus;

/** ADM-18: year-end payout batches. Batches are created from approved interest. */
export function PayoutsPage() {
  const { repos } = useServices();
  const navigate = useNavigate();
  const [all, setAll] = useState<PayoutBatch[]>([]);
  const [tab, setTab] = useState<Tab>("All");
  const [year, setYear] = useState("All");
  const [info, setInfo] = useState(false);

  useEffect(() => {
    repos.admin.listPayoutBatches().then(setAll);
  }, [repos]);

  const list = useMemo(
    () => all.filter((b) => (tab === "All" || b.status === tab) && (year === "All" || b.year === Number(year))),
    [all, tab, year],
  );

  return (
    <>
      <AdminPageHeader
        title="Payouts"
        sub="Year-end payout batches. Batches are created from approved interest."
        actions={<Button size="md" icon={<Plus size={18} />} onClick={() => setInfo(true)}>New batch</Button>}
      />
      <div className="flex flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Chips<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "All", label: "All" },
              { value: "Awaiting approval", label: "Awaiting approval" },
              { value: "Returned to maker", label: "Returned to maker" },
              { value: "Processing", label: "Processing" },
              { value: "Partial", label: "Partial" },
              { value: "Completed", label: "Completed" },
            ]}
          />
          <select aria-label="Filter by year" className="ml-auto h-10.5 rounded-xl border-[1.5px] border-line bg-white px-3 text-sm font-semibold outline-none focus:border-brand" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="All">All years</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        </div>
        <DataTable<PayoutBatch>
          rows={list}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(paths.admin.payoutBatch(r.id))}
          empty="No batches for this filter"
          columns={[
            { header: "Batch", render: (b) => <span className="font-mono text-xs font-bold">{b.id}</span> },
            { header: "Savings year", align: "right", render: (b) => b.year },
            { header: "Disbursement", render: (b) => `${b.month} ${b.year}` },
            { header: "Members", align: "right", render: (b) => b.count.toLocaleString() },
            { header: "Total payout", align: "right", render: (b) => <b>{formatNaira(b.savingsKobo + b.interestKobo)}</b> },
            { header: "Status", render: (b) => <Pill tone={STATUS_TONE[b.status]}>{b.status}</Pill> },
            { header: "Prepared by", render: (b) => <span className="text-mute">{b.maker}</span> },
            { header: "Approved by", render: (b) => <span className="text-mute">{b.checker ?? "—"}</span> },
          ]}
        />
        <p className="text-[13px] font-semibold text-mute">Showing {list.length} of {all.length}</p>
      </div>

      <Modal
        open={info}
        title="Create a payout batch"
        onClose={() => setInfo(false)}
        footer={<><Button variant="outline" onClick={() => setInfo(false)}>Close</Button><Button onClick={() => navigate(paths.admin.interestYear(2026))}>Go to interest</Button></>}
      >
        <p className="leading-relaxed text-[#474252]">Payout batches are generated from an approved interest configuration — set the rate, get checker approval, then create the batch from the interest workflow.</p>
      </Modal>
    </>
  );
}
