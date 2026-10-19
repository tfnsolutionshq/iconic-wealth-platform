import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import type { InterestYearSummary } from "@/domain/entities";
import { formatNaira } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { Button, Card, DataTable, Modal, Pill } from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";

export const INTEREST_STAGES = ["Period setup", "Rule config", "Calculation", "Review and submit", "Approval", "Payout batch", "Notification", "History"];
const STATUS_TONE = { "Not started": "mute", Draft: "info", "Pending approval": "pending", Returned: "fail", Approved: "ok", "Paid out": "ok" } as const;

/** ADM-15: one interest configuration per savings year. */
export function InterestPage() {
  const { repos } = useServices();
  const navigate = useNavigate();
  const [years, setYears] = useState<InterestYearSummary[]>([]);
  const [done, setDone] = useState(0);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    repos.admin.listInterest().then(setYears);
    repos.admin.getInterest(2026).then(({ workflow }) => setDone(workflow.done)).catch(() => {});
  }, [repos]);

  const progress = (y: InterestYearSummary) => {
    if (y.status === "Paid out") return "Paid out";
    if (y.status === "Not started") return "—";
    if (y.year !== 2026) return "Closed";
    return done >= 8 ? "All stages done" : `Stage ${done + 1} of 8 · ${INTEREST_STAGES[done]}`;
  };

  const cta = (y: InterestYearSummary) =>
    y.status === "Not started" ? "Start configuration" : y.status === "Paid out" ? "View" : "Continue";

  const newConfig = async () => {
    const current = years.find((y) => y.year === 2026);
    if (current && current.status !== "Not started") setConfirm(true);
    else navigate(paths.admin.interestYear(2026));
  };

  return (
    <>
      <AdminPageHeader
        title="Interest"
        sub="One configuration per savings year. Closed years are read-only."
        actions={<Button size="md" onClick={newConfig}>New interest configuration</Button>}
      />
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6">
        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-extrabold">How a configuration runs</h2>
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
            {INTEREST_STAGES.map((s, i) => (
              <li key={s} className="flex items-center gap-2.5 text-sm font-semibold">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${i < done ? "bg-brand text-white" : i === done ? "bg-gold text-[#2a1a00]" : "bg-soft text-mute"}`}>
                  {i < done ? <Check size={14} /> : i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <p className="text-[13px] font-semibold leading-relaxed text-mute">
            The maker (Administrator) sets the period and rate, runs the calculation and submits. A different person (Super Admin) approves or returns it; approval creates the payout batch.
          </p>
        </Card>
        <DataTable<InterestYearSummary>
          rows={[...years].sort((a, b) => b.year - a.year)}
          rowKey={(r) => String(r.year)}
          onRowClick={(r) => navigate(paths.admin.interestYear(r.year))}
          columns={[
            { header: "Year", render: (y) => <b>Savings year {y.year}</b> },
            { header: "Status", render: (y) => <Pill tone={STATUS_TONE[y.status]}>{y.status}</Pill> },
            { header: "Progress", render: (y) => <span className="text-mute">{progress(y)}</span> },
            { header: "Rate", align: "right", render: (y) => (y.rate != null ? `${y.rate}%` : "Not set") },
            { header: "Eligible members", align: "right", render: (y) => y.eligible.toLocaleString() },
            { header: "Total interest", align: "right", render: (y) => (y.interestKobo ? <b>{formatNaira(y.interestKobo)}</b> : "—") },
            { header: "Approved by", render: (y) => <span className="text-mute">{y.checker ? `${y.checker} · ${y.approvedAt}` : "—"}</span> },
            { header: "", render: (y) => <span className="font-bold text-brand">{cta(y)} ›</span> },
          ]}
        />
      </div>

      <Modal
        open={confirm}
        title="2026 is already configured"
        onClose={() => setConfirm(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button onClick={() => navigate(paths.admin.interestYear(2026))}>Open 2026</Button>
          </>
        }
      >
        <p className="leading-relaxed text-[#474252]">There is already an interest configuration for savings year 2026. There can only be one per year.</p>
      </Modal>
    </>
  );
}
