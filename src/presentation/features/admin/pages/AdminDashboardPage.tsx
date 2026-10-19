import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useServices } from "../../../contexts/ServicesContext";
import { Card, Kpi, SelectField } from "../../../design-system";
import { formatNaira } from "@/domain/rules";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import type { AdminRepository } from "@/domain/repositories";

type Dashboard = Awaited<ReturnType<AdminRepository["dashboard"]>>;

export function AdminDashboardPage() {
  const { repos } = useServices();
  const [year, setYear] = useState("2026");
  const [d, setD] = useState<Dashboard | null>(null);
  useEffect(() => {
    repos.admin.dashboard(Number(year)).then(setD);
  }, [repos, year]);
  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        sub={`Savings year ${year}`}
        actions={
          <div className="w-full sm:w-44">
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
              note="+23 this month"
            />
            <Kpi
              label={`Active savers · ${year}`}
              value={d.activeSavers.toLocaleString()}
              note={`${Math.round((d.activeSavers / d.members) * 100)}% of members`}
            />
            <Kpi
              label={`Total savings · ${year}`}
              value={formatNaira(d.totalSavingsKobo)}
            />
            <Kpi
              label="Pending payments"
              value={d.pendingPayments}
              note="Awaiting Paystack"
              tone={d.pendingPayments ? "warn" : undefined}
            />
          </div>
          <div className="grid gap-3.5 lg:grid-cols-[2fr_1fr]">
            <Card>
              <h2 className="mb-3 text-base font-extrabold">
                Monthly compliance
              </h2>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={d.monthlyPaid}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e7e3ec"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      interval="preserveStartEnd"
                      tickMargin={8}
                    />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="paid"
                      name="Paid"
                      stackId="a"
                      fill="#6c2bd9"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="due"
                      name="Not yet paid"
                      stackId="a"
                      fill="#f2a93b"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="flex flex-col gap-3">
              <h2 className="text-base font-extrabold">
                {year} interest eligibility
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="text-2xl font-extrabold text-ok sm:text-3xl">
                    {d.eligible.toLocaleString()}
                  </span>
                  <p className="text-[13px] font-semibold text-mute">
                    Eligible
                  </p>
                </div>
                <div>
                  <span className="text-2xl font-extrabold text-fail sm:text-3xl">
                    {d.forfeited}
                  </span>
                  <p className="text-[13px] font-semibold text-mute">
                    Forfeited
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
