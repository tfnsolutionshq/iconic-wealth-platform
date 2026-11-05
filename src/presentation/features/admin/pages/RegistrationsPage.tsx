import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import type { ApiMember, ApiMemberStatus } from "@/domain/repositories";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  Banner,
  Button,
  Card,
  Chips,
  EmptyState,
  Modal,
  Pill,
} from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";
import type { Tone } from "../../../design-system/components/Feedback";

// ─── Status config ────────────────────────────────────────────────────────────

type StatusFilter = "all" | ApiMemberStatus;

const STATUS_LABEL: Record<ApiMemberStatus, string> = {
  pending_email_verification: "Pending email verification",
  pending_profile_completion: "Pending profile completion",
  pending_approval: "Pending admin approval",
  active: "Active",
  rejected: "Rejected",
  suspended: "Suspended",
};

const STATUS_TONE: Record<ApiMemberStatus, Tone> = {
  pending_email_verification: "mute",
  pending_profile_completion: "gold",
  pending_approval: "pending",
  active: "ok",
  rejected: "fail",
  suspended: "fail",
};

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...(
    [
      "pending_email_verification",
      "pending_profile_completion",
      "pending_approval",
      "active",
      "rejected",
      "suspended",
    ] as ApiMemberStatus[]
  ).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initials = (m: ApiMember) =>
  `${m.first_name[0] ?? ""}${m.last_name[0] ?? ""}`.toUpperCase();

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

const DEBOUNCE_MS = 400;

// ─── Component ────────────────────────────────────────────────────────────────

/** ADM-12: review new members before their accounts open. */
export function RegistrationsPage() {
  const { repos } = useServices();
  const toast = useToast();

  // List state
  const [rows, setRows] = useState<ApiMember[]>([]);
  const [meta, setMeta] = useState({
    current_page: 1,
    per_page: 15,
    last_page: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(false);

  // Filter / pagination state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Detail / action state
  const [selId, setSelId] = useState<string | undefined>();
  const [rejectFor, setRejectFor] = useState<ApiMember | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Debounce search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, DEBOUNCE_MS);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const result = await repos.admin.listAllMembers({
        search: debouncedSearch || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
      });
      setRows(result.data);
      setMeta(result.meta);
      // Auto-select first row when page/filter changes
      setSelId(result.data[0]?.id);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [repos, debouncedSearch, statusFilter, page, toast]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const selected = rows.find((r) => r.id === selId) ?? rows[0];

  // ── Approve ───────────────────────────────────────────────────────────────
  const approve = async (m: ApiMember) => {
    setBusy(true);
    try {
      const done = await repos.admin.approveMember(m.id);
      await fetchPage();
      toast(`${done.full_name} approved. Account ${done.member_id} opened.`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ── Reject ────────────────────────────────────────────────────────────────
  const reject = async () => {
    if (!rejectFor || !reason.trim()) return;
    setBusy(true);
    try {
      await repos.admin.rejectMember(rejectFor.id, reason.trim());
      await fetchPage();
      setRejectFor(null);
      setReason("");
      toast("Registration rejected.");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Registrations"
        sub="Review new members before their accounts open"
      />
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-8 sm:py-6">
        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-2">
          <Chips<StatusFilter>
            value={statusFilter}
            onChange={(s) => {
              setStatusFilter(s);
              setPage(1);
              setSelId(undefined);
            }}
            options={FILTER_OPTIONS}
          />
          <div className="ml-auto flex w-full sm:w-auto">
            {/* Live search */}
            <label className="flex h-10.5 w-full sm:w-72 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
              <Search size={18} />
              <input
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                placeholder="Search name, email, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className="shrink-0 text-mute hover:text-ink"
                >
                  <X size={15} />
                </button>
              )}
            </label>
          </div>
        </div>

        {/* ── Layout ── */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start h-125">
          {/* List */}
          <div className="w-full lg:w-60 h-full flex-1 min-h-0 overflow-y-auto">
            <div className="rounded-card border border-line bg-white p-2.5 lg:h-full lg:overflow-y-auto">
              {loading ? (
                <p className="py-8 text-center text-sm font-semibold text-mute">
                  Loading…
                </p>
              ) : rows.length === 0 ? (
                <EmptyState icon={<Search size={24} />} title="No results">
                  Try a different search or filter.
                </EmptyState>
              ) : (
                rows.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelId(r.id)}
                    aria-current={selected?.id === r.id}
                    className={`flex w-full items-center gap-2.5 rounded-2xl p-3 text-left transition hover:bg-[#faf7fe] ${
                      selected?.id === r.id ? "bg-[#fffaF0]" : ""
                    }`}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e4d7fb] text-xs font-extrabold text-[#3b1580]">
                      {initials(r)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="text-sm">{r.full_name}</b>
                      <span className="text-xs font-semibold text-mute">
                        {fmtDateTime(r.created_at)} · {r.member_id}
                      </span>
                    </span>
                    <Pill tone={STATUS_TONE[r.status]}>
                      {STATUS_LABEL[r.status]}
                    </Pill>
                  </button>
                ))
              )}
            </div>

            {/* Pagination */}
            {meta.last_page > 1 && (
              <div className="mt-3 flex items-center justify-between gap-2 text-sm font-semibold text-mute">
                <span>
                  Page {meta.current_page} of {meta.last_page} · {meta.total}{" "}
                  total
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="flex size-9 items-center justify-center rounded-xl border-[1.5px] border-line bg-white text-ink disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={page >= meta.last_page}
                    onClick={() => setPage((p) => p + 1)}
                    className="flex size-9 items-center justify-center rounded-xl border-[1.5px] border-line bg-white text-ink disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Detail */}
          {selected && (
            <Card className="flex w-full flex-1 flex-col gap-4 p-6 h-full flex-1 min-h-0 overflow-y-auto">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#e4d7fb] text-sm font-extrabold text-[#3b1580]">
                  {initials(selected)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[19px] font-extrabold">
                    {selected.full_name}
                  </h2>
                  <p className="text-[13px] font-semibold text-mute">
                    Registered {fmtDateTime(selected.created_at)} · referred by{" "}
                    {selected.referred_by ?? "—"}
                  </p>
                </div>
                <Pill tone={STATUS_TONE[selected.status]}>
                  {STATUS_LABEL[selected.status]}
                </Pill>
              </div>

              <dl className="grid gap-x-14 md:grid-cols-2">
                {[
                  ["Member ID", selected.member_id],
                  ["Gender", selected.gender ?? "—"],
                  [
                    "Date of birth",
                    selected.dob
                      ? new Date(selected.dob).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—",
                  ],
                  ["Heard about us", selected.how_heard_about_us ?? "—"],
                  [
                    "Email",
                    `${selected.email}${selected.email_verified_at ? " · verified" : " · unverified"}`,
                  ],
                  ["Phone", selected.phone ?? "—"],
                  ["State of residence", selected.state_of_residence ?? "—"],
                  ["Address", selected.residential_address ?? "—"],
                  [
                    "Next of kin",
                    selected.next_of_kin?.name
                      ? `${selected.next_of_kin.name} · ${selected.next_of_kin.relationship}`
                      : "—",
                  ],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex flex-col gap-1 border-b border-line py-3"
                  >
                    <dt className="text-[13px] font-semibold text-mute">{k}</dt>
                    <dd className="font-bold">{v}</dd>
                  </div>
                ))}
              </dl>

              {/* Actions — only for pending_approval */}
              {selected.status === "pending_approval" && (
                <>
                  <Banner tone="info" icon={<Check size={20} />}>
                    Email verified by one-time code. Payout details and the
                    monthly target are set by the member at first login; the
                    WhatsApp community unlocks after the first payment.
                  </Banner>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      size="md"
                      disabled={busy}
                      onClick={() => approve(selected)}
                    >
                      Approve and open account
                    </Button>
                    <Button
                      size="md"
                      variant="outline"
                      className="text-fail"
                      onClick={() => {
                        setRejectFor(selected);
                        setReason("");
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </>
              )}

              {selected.status === "rejected" && (
                <Banner tone="fail" icon={<X size={20} />}>
                  <b>Rejected{selected.rejection_reason ? ":" : "."}</b>{" "}
                  {selected.rejection_reason}
                </Banner>
              )}

              {selected.status === "suspended" && (
                <Banner tone="fail" icon={<X size={20} />}>
                  <b>Suspended{selected.suspension_reason ? ":" : "."}</b>{" "}
                  {selected.suspension_reason}
                </Banner>
              )}

              {selected.status === "active" && selected.approved_at && (
                <Banner tone="info" icon={<Check size={20} />}>
                  Approved on {fmtDateTime(selected.approved_at)}.{" "}
                  <Link
                    to={paths.admin.member(selected.member_id)}
                    className="font-bold text-brand underline underline-offset-2"
                  >
                    View member profile →
                  </Link>
                </Banner>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Reject modal */}
      <Modal
        open={!!rejectFor}
        title="Reject registration"
        onClose={() => setRejectFor(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectFor(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim() || busy}
              onClick={reject}
            >
              Reject registration
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Reason (shared with the applicant)
          <textarea
            rows={4}
            autoFocus
            placeholder="Required"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-28 w-full rounded-input border-[1.5px] border-line bg-white p-3.5 text-[15px] font-semibold text-ink outline-none focus:border-brand"
          />
        </label>
      </Modal>
    </>
  );
}
