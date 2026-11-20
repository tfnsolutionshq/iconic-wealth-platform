import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type {
  ReferralDashboard,
  ReferralGroup,
  ReferralStatus,
} from "@/domain/entities";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  Card,
  DataTable,
  Kpi,
  OpenDecisionTag,
  Pill,
} from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";

const NO_GROUPS: ReferralGroup[] = [];

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
const fmtDay = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};
const latestDate = (g: ReferralGroup) =>
  g.latest ??
  g.referred
    .map((r) => r.date)
    .filter(Boolean)
    .sort()
    .pop();
const groupKey = (g: ReferralGroup) => g.id ?? g.referrer;

/** ADM-22: who referred whom, and whether they're saving. */
export function ReferralsPage() {
  const { repos } = useServices();
  const toast = useToast();
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null);
  const [detail, setDetail] = useState<ReferralDashboard | null>(null);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<string | undefined>();

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let live = true;
    repos.admin
      .referralDashboard({ search: search || undefined })
      .then((payload) => {
        if (live) setDashboard(payload);
      })
      .catch((error: unknown) => {
        if (live) toast((error as Error).message);
      });
    return () => {
      live = false;
    };
  }, [repos, toast, search]);

  const groups = dashboard?.groups ?? NO_GROUPS;
  const summary = dashboard?.summary;

  const names = useMemo(() => {
    const s = q.trim().toLowerCase();
    return groups
      .filter(
        (g) =>
          !s ||
          g.referrer.toLowerCase().includes(s) ||
          g.referred.some((r) => r.name.toLowerCase().includes(s)),
      )
      .sort(
        (a, b) =>
          (b.total ?? b.referred.length) - (a.total ?? a.referred.length),
      );
  }, [groups, q]);

  const selected = names.find((g) => groupKey(g) === sel) ?? names[0];
  const selectedKey = selected ? groupKey(selected) : undefined;

  useEffect(() => {
    let live = true;
    if (!selectedKey) {
      setDetail(null);
      return;
    }
    repos.admin
      .referralDashboard({ referral_id: selectedKey })
      .then((payload) => {
        if (live) setDetail(payload);
      })
      .catch((error: unknown) => {
        if (live) toast((error as Error).message);
      });
    return () => {
      live = false;
    };
  }, [repos, toast, selectedKey]);

  const panelGroup =
    detail?.groups.find((g) => groupKey(g) === selectedKey) ?? selected;
  const all = groups.flatMap((g) => g.referred);
  const saving = all.filter((r) => r.status === "Saving").length;
  const pending = all.filter((r) => r.status === "Pending").length;
  const sorted = [...groups].sort(
    (a, b) => (b.total ?? b.referred.length) - (a.total ?? a.referred.length),
  );
  const topName = summary?.topReferrer ?? sorted[0]?.referrer;
  const topCount =
    groups.find((g) => g.referrer === topName)?.total ??
    sorted[0]?.total ??
    sorted[0]?.referred.length;

  return (
    <>
      <AdminPageHeader
        title="Referrals"
        sub="Who referred whom, and whether they’re saving"
      />
      <div className="flex flex-col gap-3.5 px-4 py-5 sm:px-8 sm:py-6">
        <div className="grid gap-3.5 md:grid-cols-4">
          <Kpi
            label="Referred members"
            value={
              summary?.totalReferred ??
              all.filter((r) => r.status !== "Pending").length
            }
          />
          <Kpi label="Saving now" value={summary?.savingNow ?? saving} tone="good" />
          <Kpi
            label="Pending"
            value={summary?.pending ?? pending}
            note="New or under review"
            tone={summary?.pending || pending ? "warn" : undefined}
          />
          <Kpi
            label="Top referrer"
            value={topName ?? "—"}
            note={topName && topCount != null ? `${topCount} referrals` : undefined}
          />
        </div>
        <div className="flex">
          <label className="flex h-10.5 w-full sm:w-72 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
            <Search size={18} />
            <input
              className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
              placeholder="Search referrer or referred member"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-col items-start gap-3.5 lg:flex-row">
          <div className="min-w-0 flex-1">
            <DataTable<ReferralGroup>
              rows={names}
              rowKey={groupKey}
              onRowClick={(g) => setSel(groupKey(g))}
              columns={[
                { header: "Referrer", render: (g) => <b>{g.referrer}</b> },
                {
                  header: "Referred",
                  align: "right",
                  render: (g) => g.total ?? g.referred.length,
                },
                {
                  header: "Saving now",
                  align: "right",
                  render: (g) =>
                    g.saving ??
                    g.referred.filter((r) => r.status === "Saving").length,
                },
                {
                  header: "Pending",
                  align: "right",
                  render: (g) =>
                    g.pending ??
                    g.referred.filter((r) => r.status === "Pending").length,
                },
                {
                  header: "Latest",
                  render: (g) => (
                    <span className="text-mute">{fmtDay(latestDate(g))}</span>
                  ),
                },
              ]}
            />
          </div>
          {panelGroup && (
            <Card className="flex w-full shrink-0 flex-col gap-1 lg:w-105">
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-base font-extrabold">
                  Referred by {panelGroup.referrer}
                </h2>
                <Pill tone="mute">
                  {panelGroup.total ?? panelGroup.referred.length}
                </Pill>
              </div>
              {panelGroup.referred.map((r) => (
                <div
                  key={`${r.name}-${r.date}`}
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
              <div className="mt-3">
                <OpenDecisionTag code="OD-06">Referral rules</OpenDecisionTag>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
