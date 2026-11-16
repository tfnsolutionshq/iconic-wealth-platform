import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import { useServices } from "../../../contexts/ServicesContext";
import { Button, Card, Kpi, Pill, SelectField } from "../../../design-system";
import { formatNaira } from "@/domain/rules";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import type { AdminRepository } from "@/domain/repositories";
import { useNavigate } from "react-router-dom";

type Dashboard = Awaited<ReturnType<AdminRepository["dashboard"]>>;

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function AdminDashboardPage() {
  const { repos } = useServices();
  const navigate = useNavigate();
  const [year, setYear] = useState("2026");
  const [d, setD] = useState<Dashboard | null>(null);

  useEffect(() => {
    repos.admin.dashboard(Number(year)).then(setD);
  }, [repos, year]);

  const compliancePct = useMemo(() => {
    if (!d?.currentMonthCompliance) return 0;
    const total = d.currentMonthCompliance.of || 1;
    return (d.currentMonthCompliance.paid / total) * 100;
  }, [d]);

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        sub={`Savings year ${year}${
          year === "2026" ? " · as of Fri 2 Oct, 9:40" : " · closed year"
        }`}
        actions={
          <div className="w-full sm:w-56">
            <SelectField
              options={["2026", "2025", "2024"]}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
        }
      />
      {!d ? (
        <p className="p-8 text-mute">Loading…</p>
      ) : (
        <div className="flex flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6">
          <div className="grid gap-3.5 md:grid-cols-4">
            <Kpi
              label="Total members"
              value={d.members.toLocaleString()}
              note={
                year === "2026"
                  ? `+${d.newThisMonth} this month`
                  : "At year end"
              }
            />
            <Kpi
              label={`Active savers · ${year}`}
              value={d.activeSavers.toLocaleString()}
              note={`${d.activeSaversPercent}% of members`}
            />
            <Kpi
              label={`Total savings · ${year}`}
              value={formatNaira(d.totalSavingsKobo)}
              note="Visible to Super Admin, Admin"
            />
            <Kpi
              label="Pending payments"
              value={d.pendingPayments.toLocaleString()}
              note={year === "2026" ? "Awaiting Paystack" : "None"}
              tone={d.pendingPayments ? "warn" : "good"}
            />
          </div>

          <div className="grid gap-3.5 xl:grid-cols-[1.55fr_1.45fr_1.5fr]">
            <Card className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-ink">
                  {d.currentMonthCompliance?.monthName ??
                    monthNames[new Date().getMonth()]}
                  {" compliance"}
                </h2>
                <Pill tone={year === "2026" ? "pending" : "mute"}>
                  {d.currentMonthCompliance?.dueDate
                    ? `Due ${new Date(
                        d.currentMonthCompliance.dueDate,
                      ).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}`
                    : "Closed"}
                </Pill>
              </div>

              <div className="flex items-end gap-2.5">
                <span className="text-[30px] font-extrabold tracking-tight text-ink">
                  {d.currentMonthCompliance?.paid ?? 0}
                </span>
                <span className="pb-1.5 text-[13px] font-semibold text-mute">
                  of {d.currentMonthCompliance?.of ?? 0} have paid
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-soft">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{
                    width: `${Math.max(0, Math.min(100, compliancePct))}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                <span className="text-sm font-semibold text-mute">
                  Not yet paid
                </span>
                <b className="text-lg font-extrabold tabular-nums text-ink">
                  {d.currentMonthCompliance?.notPaid ?? 0}
                </b>
              </div>

              {year === "2026" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  icon={<BellRing size={16} />}
                >
                  Send reminder
                </Button>
              )}
            </Card>

            <Card className="flex flex-col gap-3">
              <h2 className="text-base font-extrabold text-ink">
                {year} interest eligibility
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-soft p-3">
                  <span className="block text-[30px] font-extrabold tracking-tight text-ok">
                    {d.interestEligibility.eligible ?? 0}
                  </span>
                  <span className="text-[13px] font-semibold text-mute">
                    Eligible
                  </span>
                </div>
                <div className="rounded-2xl bg-soft p-3">
                  <span className="block text-[30px] font-extrabold tracking-tight text-fail">
                    {d.interestEligibility.forfeited ?? 0}
                  </span>
                  <span className="text-[13px] font-semibold text-mute">
                    Forfeited
                  </span>
                </div>
              </div>
              <div className="mt-1 flex flex-col gap-2 border-t border-line pt-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-mute">Late payments</span>
                  <b className="font-extrabold text-ink">
                    {d.interestEligibility.latePayments}
                  </b>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-mute">Missed months</span>
                  <b className="font-extrabold text-ink">
                    {d.interestEligibility.missedMonths}
                  </b>
                </div>
              </div>
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-ink">
                  Interest and payout
                </h2>
                <Pill
                  tone={
                    d.interest.status === "Paid out"
                      ? "ok"
                      : d.interest.status === "Not started"
                        ? "mute"
                        : "pending"
                  }
                >
                  {d.interest.statusLabel || "Not started"}
                </Pill>
              </div>

              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-soft px-3 py-2">
                  <span className="font-semibold text-mute">Rate</span>
                  <span className="font-extrabold text-ink">
                    {d.interest.rate != null
                      ? `${d.interest.rate}%`
                      : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-soft px-3 py-2">
                  <span className="font-semibold text-mute">Payout batch</span>
                  <span className="font-extrabold text-ink">
                    {d.interest.payoutBatch ?? "Not created"}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="self-start"
                icon={<ArrowRight size={16} />}
                onClick={() => navigate("/admin/interest")}
              >
                Open interest
              </Button>
            </Card>
          </div>

          <div className="grid gap-3.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-ink">
                  Failed payments
                </h2>
                <a
                  href="/admin/transactions?f=Failed"
                  className="text-sm font-bold text-brand hover:text-brand-dark"
                >
                  View all
                </a>
              </div>

              {d.failedPayments.length === 0 ? (
                <p className="text-sm font-semibold text-mute">
                  No failed payments in {year}
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-line">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-soft text-left text-[11px] font-extrabold uppercase tracking-[0.08em] text-mute">
                        <th className="px-3 py-2.5">Member</th>
                        <th className="px-3 py-2.5">Covers</th>
                        <th className="px-3 py-2.5 text-right">Amount</th>
                        <th className="px-3 py-2.5">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.failedPayments.slice(0, 4).map((row, index) => (
                        <tr
                          key={`${row.member}-${index}`}
                          className="border-t border-line align-top"
                        >
                          <td className="px-3 py-3 font-bold text-ink">
                            {row.member}
                          </td>
                          <td className="px-3 py-3 text-mute">{row.covers}</td>
                          <td className="px-3 py-3 text-right font-extrabold tabular-nums text-ink">
                            {formatNaira(row.amountKobo)}
                          </td>
                          <td className="px-3 py-3 text-mute">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold text-ink">
                  Recent activity
                </h2>
                <a
                  href="/admin/audit-log"
                  className="text-sm font-bold text-brand hover:text-brand-dark"
                >
                  Audit log
                </a>
              </div>

              <div className="flex flex-col gap-3">
                {d.recentActivity.slice(0, 5).map((item) => {
                  const icon =
                    item.type === "financial" ? (
                      <CircleDollarSign size={18} />
                    ) : item.type === "members" ? (
                      <ShieldCheck size={18} />
                    ) : item.type === "access" ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <Clock3 size={18} />
                    );

                  return (
                    <div
                      key={`${item.record}-${item.createdAt}`}
                      className="flex items-start gap-3 rounded-2xl border border-line bg-soft px-3 py-2.5"
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-brand">
                        {icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-extrabold text-ink">
                          {item.action} · {item.record}
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-mute">
                          {item.actor}
                        </div>
                      </div>
                      <div className="shrink-0 pt-1 text-[11px] font-bold text-mute">
                        {new Date(item.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
