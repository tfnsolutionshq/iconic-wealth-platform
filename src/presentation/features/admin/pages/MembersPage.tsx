import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Funnel,
  Plus,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type { MemberSummary } from "@/domain/entities";
import type { MemberQuery } from "@/domain/repositories";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  Button,
  Card,
  Chips,
  DataTable,
  Pill,
  SelectField,
} from "../../../design-system";
import { formatNaira } from "@/domain/rules";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";

const MONTH_TONE = {
  Paid: "ok",
  Locked: "ok",
  Open: "pending",
  Due: "pending",
  Late: "pending",
  Missed: "fail",
  NotDue: "mute",
  BeforeJoining: "mute",
} as const;

/** ADM-04: tabs with counts, search, more filters. Add/Import/Export are wired to toasts until their modals are built (ADM-05 to ADM-07). */
export function MembersPage() {
  const { repos } = useServices();
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState<MemberQuery>({ tab: "All", search: "" });
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<MemberSummary[]>([]);
  const [counts, setCounts] = useState<Record<
    MemberQuery["tab"],
    number
  > | null>(null);
  useEffect(() => {
    repos.admin.listMembers(q).then(setRows);
  }, [repos, q]);
  useEffect(() => {
    repos.admin.countMembers().then(setCounts);
  }, [repos]);
  const tabs: { value: MemberQuery["tab"]; label: string }[] = [
    ["All", "All"],
    ["Active", "Active"],
    ["Suspended", "Suspended"],
    ["NotPaid", "Not paid this month"],
    ["Forfeited", "Forfeited"],
  ].map(([v, l]) => ({
    value: v as MemberQuery["tab"],
    label: `${l}${counts ? " " + counts[v as MemberQuery["tab"]] : ""}`,
  }));
  const activeFilters = [
    q.eligibility,
    q.referred !== undefined,
    q.joinedYear,
  ].filter(Boolean).length;
  return (
    <>
      <AdminPageHeader
        title="Members"
        sub="Search, filter and manage member records"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="md"
              icon={<Upload size={18} />}
              onClick={() => toast("Import: build modal per ADM-06")}
            >
              Import
            </Button>
            <Button
              variant="outline"
              size="md"
              icon={<Download size={18} />}
              onClick={() => toast("Export: CSV of the filtered list (ADM-07)")}
            >
              Export
            </Button>
            <Button
              size="md"
              icon={<Plus size={18} />}
              onClick={() => toast("Add member: build modal per ADM-05")}
            >
              Add member
            </Button>
          </div>
        }
      />
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Chips
            value={q.tab}
            options={tabs}
            onChange={(tab) => setQ({ ...q, tab })}
          />
          <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="flex h-10.5 w-full sm:w-72 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
              <Search size={18} />
              <input
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                placeholder="Search name or member ID"
                value={q.search}
                onChange={(e) => setQ({ ...q, search: e.target.value })}
              />
            </label>
            <Button
              variant={open || activeFilters ? "dark" : "outline"}
              size="md"
              icon={<Funnel size={16} />}
              onClick={() => setOpen(!open)}
            >
              More filters{activeFilters ? ` · ${activeFilters}` : ""}
            </Button>
          </div>
        </div>
        {open && (
          <Card className="grid gap-3 md:grid-cols-4">
            <SelectField
              label="Interest eligibility"
              options={["Eligible", "Forfeited"]}
              placeholder="Any"
              value={q.eligibility ?? ""}
              onChange={(e) =>
                setQ({
                  ...q,
                  eligibility: (e.target.value ||
                    undefined) as MemberQuery["eligibility"],
                })
              }
            />
            <SelectField
              label="Referral"
              options={[
                { value: "yes", label: "Referred" },
                { value: "no", label: "Not referred" },
              ]}
              placeholder="Any"
              value={q.referred === undefined ? "" : q.referred ? "yes" : "no"}
              onChange={(e) =>
                setQ({
                  ...q,
                  referred: e.target.value
                    ? e.target.value === "yes"
                    : undefined,
                })
              }
            />
            <SelectField
              label="Joined in"
              options={["2023", "2024", "2025", "2026"]}
              placeholder="Any"
              value={q.joinedYear ?? ""}
              onChange={(e) =>
                setQ({ ...q, joinedYear: e.target.value || undefined })
              }
            />
            <div className="flex items-end">
              <Button
                variant="outline"
                size="md"
                onClick={() => setQ({ tab: q.tab, search: q.search })}
              >
                Clear all
              </Button>
            </div>
          </Card>
        )}
        <DataTable<MemberSummary>
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(paths.admin.member(r.id))}
          columns={[
            {
              header: "Member",
              render: (r) => (
                <span className="flex flex-col">
                  <b>{r.name}</b>
                  <span className="font-mono text-xs text-mute">{r.id}</span>
                </span>
              ),
            },
            {
              header: "Status",
              render: (r) => (
                <Pill tone={r.status === "Active" ? "ok" : "fail"}>
                  {r.status}
                </Pill>
              ),
            },
            {
              header: "Monthly target",
              align: "right",
              render: (r) =>
                r.targetKobo ? formatNaira(r.targetKobo) : "Not set",
            },
            {
              header: "Saved",
              align: "right",
              render: (r) => <b>{formatNaira(r.savedKobo)}</b>,
            },
            {
              header: "September",
              render: (r) => (
                <Pill tone={MONTH_TONE[r.currentMonthStatus]}>
                  {r.currentMonthStatus}
                </Pill>
              ),
            },
            {
              header: "Interest",
              render: (r) =>
                r.eligibility === "Eligible" ? (
                  <Pill tone="ok" icon={<ShieldCheck size={12} />}>
                    Eligible
                  </Pill>
                ) : (
                  <Pill tone="fail">Forfeited</Pill>
                ),
            },
            {
              header: "Referred by",
              render: (r) => (
                <span className="text-mute">{r.referredBy ?? "—"}</span>
              ),
            },
          ]}
        />
        <p className="text-[13px] font-semibold text-mute">
          Showing {rows.length} members
        </p>
      </div>
    </>
  );
}
