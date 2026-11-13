import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Funnel,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type { MemberListRow } from "@/domain/entities";
import type {
  ApiMemberStatus,
  MemberQuery,
  PageMeta,
} from "@/domain/repositories";
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
import { formatNaira, MONTHS_SHORT } from "@/domain/rules";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";
import {
  isMemberStatus,
  MEMBER_STATUS_LABEL,
  memberStatusLabel,
  memberStatusTone,
} from "../memberStatus";

type MemberPill = "All" | ApiMemberStatus | "NotPaid" | "Forfeited";

/** Statuses shown as primary pills. */
const PILL_STATUSES: ApiMemberStatus[] = ["active", "rejected", "suspended"];
const PILL_STATUS_LABEL: Partial<Record<ApiMemberStatus, string>> = {
  rejected: "Forfeited",
};

const BASELINE_OPTIONS: {
  value: NonNullable<MemberQuery["baseline"]>;
  label: string;
}[] = [
  { value: "10000-50000", label: "₦10,000 - ₦50,000" },
  { value: "above-50000", label: "Above ₦50,000" },
];

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
  const [q, setQ] = useState<MemberQuery>({
    tab: "All",
    search: "",
    page: 1,
  });
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<MemberListRow[]>([]);
  const [meta, setMeta] = useState<PageMeta>({
    current_page: 1,
    per_page: 20,
    last_page: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<
    MemberQuery["tab"],
    number
  > | null>(null);
  useEffect(() => {
    let live = true;
    setLoading(true);
    repos.admin
      .listMembers(q)
      .then((page) => {
        if (!live) return;
        setRows(page.data);
        setMeta(page.meta);
      })
      .catch((error) => {
        if (live) toast((error as Error).message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [repos, q, toast]);
  useEffect(() => {
    repos.admin.countMembers().then(setCounts);
  }, [repos]);
  /** Any filter change starts again from the first page. */
  const updateQuery = (patch: Partial<MemberQuery>) =>
    setQ((prev) => ({ ...prev, ...patch, page: 1 }));
  const firstRow =
    meta.total === 0 ? 0 : (meta.current_page - 1) * meta.per_page + 1;
  const lastRow = meta.total === 0 ? 0 : firstRow + rows.length - 1;
  const currentMonthShort = MONTHS_SHORT[new Date().getMonth()];
  const tabs: { value: MemberPill; label: string }[] = [
    { value: "All", label: `All${counts ? " " + counts.All : ""}` },
    ...PILL_STATUSES.map((status) => {
      const count =
        status === "active"
          ? counts?.Active
          : status === "suspended"
            ? counts?.Suspended
            : undefined;
      return {
        value: status,
        label: `${PILL_STATUS_LABEL[status] ?? MEMBER_STATUS_LABEL[status]}${
          count === undefined ? "" : " " + count
        }`,
      };
    }),
    {
      value: "NotPaid",
      label: `Not paid ${currentMonthShort}${
        counts ? " " + counts.NotPaid : ""
      }`,
    },
    {
      value: "Forfeited",
      label: `Interest forfeited${counts ? " " + counts.Forfeited : ""}`,
    },
  ];
  const selectedPill: MemberPill =
    q.status ??
    (q.tab === "Active"
      ? "active"
      : q.tab === "Suspended"
        ? "suspended"
        : q.tab);
  const selectPill = (pill: MemberPill) => {
    if (pill === "All") {
      updateQuery({ tab: "All", status: undefined });
    } else if (isMemberStatus(pill)) {
      updateQuery({ tab: "All", status: pill });
    } else {
      updateQuery({ tab: pill, status: undefined });
    }
  };
  const activeFilters = [
    q.baseline,
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
          <Chips value={selectedPill} options={tabs} onChange={selectPill} />
          <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="flex h-10.5 w-full sm:w-72 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
              <Search size={18} />
              <input
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                placeholder="Search name or member ID"
                value={q.search}
                onChange={(e) => updateQuery({ search: e.target.value })}
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
          <Card className="flex flex-col gap-3">
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm font-bold text-brand transition hover:text-brand-dark"
                onClick={() =>
                  setQ({
                    tab: q.tab,
                    search: q.search,
                    status: q.status,
                    page: 1,
                  })
                }
              >
                Clear all
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <SelectField
                label="Baseline"
                options={BASELINE_OPTIONS}
                placeholder="Any"
                value={q.baseline ?? ""}
                onChange={(e) =>
                  updateQuery({
                    baseline: (e.target.value ||
                      undefined) as MemberQuery["baseline"],
                  })
                }
              />
              <SelectField
                label="Interest eligibility"
                options={["Eligible", "Forfeited"]}
                placeholder="Any"
                value={q.eligibility ?? ""}
                onChange={(e) =>
                  updateQuery({
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
                value={
                  q.referred === undefined ? "" : q.referred ? "yes" : "no"
                }
                onChange={(e) =>
                  updateQuery({
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
                  updateQuery({ joinedYear: e.target.value || undefined })
                }
              />
            </div>
          </Card>
        )}
        {loading ? (
          <Card
            role="status"
            aria-live="polite"
            className="flex min-h-48 items-center justify-center gap-2"
          >
            <LoaderCircle className="animate-spin text-brand" size={18} />
            <p className="text-sm font-semibold text-mute">Loading members…</p>
          </Card>
        ) : (
          <DataTable<MemberListRow>
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
              render: (r) => {
                const status = r.accountStatus ?? r.status;
                return (
                  <Pill tone={memberStatusTone(status)}>
                    {memberStatusLabel(status)}
                  </Pill>
                );
              },
            },
            {
              header: "Monthly target",
              align: "right",
              render: (r) =>
                r.targetKobo === undefined
                  ? "—"
                  : r.targetKobo
                    ? formatNaira(r.targetKobo)
                    : "Not set",
            },
            {
              header: "Saved",
              align: "right",
              render: (r) =>
                r.savedKobo === undefined ? (
                  "—"
                ) : (
                  <b>{formatNaira(r.savedKobo)}</b>
                ),
            },
            {
              header: "September",
              render: (r) =>
                r.currentMonthStatus === undefined ? (
                  <span className="text-mute">—</span>
                ) : (
                  <Pill tone={MONTH_TONE[r.currentMonthStatus]}>
                    {r.currentMonthStatus}
                  </Pill>
                ),
            },
            {
              header: "Interest",
              render: (r) =>
                r.eligibility === undefined ? (
                  <span className="text-mute">—</span>
                ) : r.eligibility === "Eligible" ? (
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
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-mute">
            {loading
              ? "Loading members…"
              : meta.total === 0
                ? "No members match these filters"
                : `Showing ${firstRow}–${lastRow} of ${meta.total} members`}
          </p>
          {meta.last_page > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label="Previous page"
                icon={<ChevronLeft size={16} />}
                disabled={loading || meta.current_page <= 1}
                onClick={() =>
                  setQ((prev) => ({
                    ...prev,
                    page: Math.max(1, meta.current_page - 1),
                  }))
                }
              >
                <span className="sr-only">Previous page</span>
              </Button>
              <span className="text-[13px] font-semibold text-mute">
                Page {meta.current_page} of {meta.last_page}
              </span>
              <Button
                variant="outline"
                size="sm"
                aria-label="Next page"
                icon={<ChevronRight size={16} />}
                disabled={loading || meta.current_page >= meta.last_page}
                onClick={() =>
                  setQ((prev) => ({
                    ...prev,
                    page: Math.min(meta.last_page, meta.current_page + 1),
                  }))
                }
              >
                <span className="sr-only">Next page</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
