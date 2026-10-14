import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ReferralGroup, ReferralStatus } from "@/domain/entities";
import { useServices } from "../../../contexts/ServicesContext";
import {
  Card,
  DataTable,
  Kpi,
  OpenDecisionTag,
  Pill,
} from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";

const STATUS_TONE: Record<ReferralStatus, "ok" | "pending" | "mute"> = {
  Saving: "ok",
  Pending: "pending",
  Inactive: "mute",
  "Not started": "mute",
};
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** ADM-22: who referred whom, and whether they're saving. */
export function ReferralsPage() {
  const { repos } = useServices();
  const [groups, setGroups] = useState<ReferralGroup[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | undefined>();

  useEffect(() => {
    repos.admin.referralGroups().then(setGroups);
  }, [repos]);

  const names = useMemo(() => {
    const s = q.trim().toLowerCase();
    return groups
      .filter(
        (g) =>
          !s ||
          g.referrer.toLowerCase().includes(s) ||
          g.referred.some((r) => r.name.toLowerCase().includes(s)),
      )
      .sort((a, b) => b.referred.length - a.referred.length);
  }, [groups, q]);

  const selected = names.find((g) => g.referrer === sel) ?? names[0];
  const all = groups.flatMap((g) => g.referred);
  const saving = all.filter((r) => r.status === "Saving").length;
  const pending = all.filter((r) => r.status === "Pending").length;
  const top = [...groups].sort(
    (a, b) => b.referred.length - a.referred.length,
  )[0];

  return (
    <>
      <AdminPageHeader
        title="Referrals"
        sub="Who referred whom, and whether they're saving"
      />
      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="grid gap-3.5 md:grid-cols-4">
          <Kpi
            label="Referred members"
            value={all.filter((r) => r.status !== "Pending").length}
          />
          <Kpi label="Saving now" value={saving} tone="good" />
          <Kpi
            label="Pending"
            value={pending}
            note="New or under review"
            tone={pending ? "warn" : undefined}
          />
          <Kpi
            label="Top referrer"
            value={top?.referrer ?? "—"}
            note={top ? `${top.referred.length} referrals` : undefined}
          />
        </div>
        <div className="flex">
          <label className="flex h-10.5 w-72 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
            <Search size={18} />
            <input
              className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
              placeholder="Search referrer or member"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-col items-start gap-5 lg:flex-row">
          <div className="min-w-0 flex-1">
            <DataTable<ReferralGroup>
              rows={names}
              rowKey={(g) => g.referrer}
              onRowClick={(g) => setSel(g.referrer)}
              columns={[
                { header: "Referrer", render: (g) => <b>{g.referrer}</b> },
                {
                  header: "Referred",
                  align: "right",
                  render: (g) => g.referred.length,
                },
                {
                  header: "Saving now",
                  align: "right",
                  render: (g) =>
                    g.referred.filter((r) => r.status === "Saving").length,
                },
                {
                  header: "Pending",
                  align: "right",
                  render: (g) =>
                    g.referred.filter((r) => r.status === "Pending").length,
                },
                {
                  header: "Latest",
                  render: (g) => (
                    <span className="text-mute">
                      {fmtDay(
                        g.referred
                          .map((r) => r.date)
                          .sort()
                          .reverse()[0],
                      )}
                    </span>
                  ),
                },
              ]}
            />
          </div>
          {selected && (
            <Card className="flex w-full shrink-0 flex-col gap-1 lg:w-105">
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-base font-extrabold">
                  Referred by {selected.referrer}
                </h2>
                <Pill tone="mute">{selected.referred.length}</Pill>
              </div>
              {selected.referred.map((r) => (
                <div
                  key={r.name}
                  className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-b-0"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e4d7fb] text-xs font-extrabold text-[#3b1580]">
                    {initials(r.name)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="text-sm">{r.name}</b>
                    <span className="text-xs font-semibold text-mute">
                      {fmtDay(r.date)}
                    </span>
                  </span>
                  <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
                </div>
              ))}
              <OpenDecisionTag code="OD-06">Referral rules</OpenDecisionTag>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
