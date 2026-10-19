import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Search, X } from "lucide-react";
import type { Registration } from "@/domain/entities";
import { ageOn } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Banner,
  Button,
  Card,
  Chips,
  EmptyState,
  Modal,
  OpenDecisionTag,
  Pill,
  Select,
} from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";
import { paths } from "../../../routes/paths";

type Tab = "New" | "Approved" | "Rejected" | "All";
type DateRange = "all" | "today" | "7" | "30";

const TONE = { New: "pending", Approved: "ok", Rejected: "fail" } as const;

const initials = (r: Registration) =>
  `${r.firstName[0] ?? ""}${r.lastName[0] ?? ""}`.toUpperCase();

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
};

const fmtDob = (iso: string, now: Date) => {
  const d = new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${d} · age ${ageOn(iso, now)}`;
};

/** ADM-12: review new members before their accounts open. Matches the approved build's two-pane layout. */
export function RegistrationsPage() {
  const { repos, clock } = useServices();
  const toast = useToast();
  const { session } = useAuth();
  const admin = session?.kind === "admin" ? session.admin : null;
  const now = useMemo(() => clock.now(), [clock]);
  const [all, setAll] = useState<Registration[]>([]);
  const [tab, setTab] = useState<Tab>("New");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>("all");
  const [selId, setSelId] = useState<string | undefined>();
  const [rejectFor, setRejectFor] = useState<Registration | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => setAll(await repos.admin.listRegistrations());
  useEffect(() => {
    reload();
  }, [repos]);

  const daysAgo = (iso: string) =>
    (now.getTime() - new Date(iso).getTime()) / 86_400_000;
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (r) =>
        (tab === "All" || r.status === tab) &&
        (range === "all" ||
          (range === "today"
            ? daysAgo(r.submittedAt) < 1
            : daysAgo(r.submittedAt) < Number(range))) &&
        (!q ||
          `${r.firstName} ${r.lastName} ${r.email} ${r.phone} ${r.id}`
            .toLowerCase()
            .includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, tab, search, range, now]);

  const count = (t: Tab) =>
    all.filter((r) => t === "All" || r.status === t).length;
  const selected = list.find((r) => r.id === selId) ?? list[0];

  const duplicateOf = (r: Registration) =>
    all.some(
      (x) =>
        x.id !== r.id &&
        (x.email.toLowerCase() === r.email.toLowerCase() ||
          (r.phone.replace(/\D/g, "") &&
            x.phone.replace(/\D/g, "") === r.phone.replace(/\D/g, ""))),
    );

  const audit = (action: string, entity: string, change: string) =>
    admin
      ? repos.admin.logAudit({ at: clock.now().toISOString(), actor: admin.name,
          role: admin.role === "SuperAdmin" ? "Super Admin" : "Administrator", action, entity, change, category: "Members" })
      : Promise.resolve();

  const approve = async (r: Registration) => {
    setBusy(true);
    try {
      const done = await repos.admin.decideRegistration(r.id, "Approved");
      await audit("Approved registration", done.memberId ?? done.id, "Pending → Active");
      await reload();
      setSelId(done.id);
      toast(
        `${done.firstName} ${done.lastName} approved. Account ${done.memberId} opened.`,
      );
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!rejectFor || !reason.trim()) return;
    setBusy(true);
    try {
      await repos.admin.decideRegistration(
        rejectFor.id,
        "Rejected",
        reason.trim(),
      );
      await audit("Rejected registration", rejectFor.id, reason.trim());
      await reload();
      setSelId(rejectFor.id);
      setRejectFor(null);
      setReason("");
      toast("Registration rejected.");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const askChanges = (r: Registration) =>
    toast(`Asked ${r.firstName} to update her details.`);

  return (
    <>
      <AdminPageHeader
        title="Registrations"
        sub="Review new members before their accounts open"
      />
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Chips<Tab>
            value={tab}
            onChange={(t) => {
              setTab(t);
              setSelId(undefined);
            }}
            options={[
              { value: "New", label: `New ${count("New")}` },
              { value: "Approved", label: `Approved ${count("Approved")}` },
              { value: "Rejected", label: `Rejected ${count("Rejected")}` },
              { value: "All", label: `All ${count("All")}` },
            ]}
          />
          <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="flex h-10.5 w-full sm:w-72 items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
              <Search size={18} />
              <input
                className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
                placeholder="Search name, email, phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Select
              aria-label="Filter by date"
              value={range}
              onChange={(e) => setRange(e.target.value as DateRange)}
              options={[{ value: "all", label: "Any date" }, { value: "today", label: "Today" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }]}
            />
          </div>
        </div>

        <div className="flex flex-col items-start gap-5 lg:flex-row">
          <div className="w-full shrink-0 rounded-card border border-line bg-white p-2.5 lg:w-100">
            {list.length === 0 ? (
              <EmptyState icon={<Search size={24} />} title="No registrations">
                Try another filter.
              </EmptyState>
            ) : (
              list.map((r) => (
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
                    <b className="text-sm">
                      {r.firstName} {r.lastName}
                    </b>
                    <span className="text-xs font-semibold text-mute">
                      {fmtDateTime(r.submittedAt)} · {r.id}
                    </span>
                  </span>
                  <Pill tone={TONE[r.status as keyof typeof TONE] ?? "mute"}>
                    {r.status}
                  </Pill>
                </button>
              ))
            )}
          </div>

          {selected && (
            <Card className="flex flex-1 flex-col gap-4 p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#e4d7fb] text-sm font-extrabold text-[#3b1580]">
                  {initials(selected)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[19px] font-extrabold">
                    {selected.firstName} {selected.lastName}
                  </h2>
                  <p className="text-[13px] font-semibold text-mute">
                    Submitted {fmtDateTime(selected.submittedAt)} · referred by{" "}
                    {selected.referredBy ?? "—"}
                  </p>
                </div>
                <Pill
                  tone={TONE[selected.status as keyof typeof TONE] ?? "mute"}
                >
                  {selected.status}
                </Pill>
              </div>

              <dl className="grid gap-x-14 md:grid-cols-2">
                {[
                  ["Gender", selected.gender],
                  ["Date of birth", fmtDob(selected.dateOfBirth, now)],
                  ["Heard about us", selected.heardAboutUs || "—"],
                  ["Email", `${selected.email} · verified`],
                  ["Phone", selected.phone],
                  ["State of residence", selected.stateOfResidence || "—"],
                  ["Address", selected.address || "—"],
                  [
                    "Next of kin",
                    selected.nextOfKin.name
                      ? `${selected.nextOfKin.name} · ${selected.nextOfKin.relationship}`
                      : "—",
                  ],
                  [
                    "Possible duplicate",
                    duplicateOf(selected)
                      ? "Matches an existing registration"
                      : "None found",
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

              {selected.status === "New" && (
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
                      onClick={() => askChanges(selected)}
                    >
                      Request changes
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
                    <span className="ml-auto">
                      <OpenDecisionTag code="OD-01">
                        Approval policy
                      </OpenDecisionTag>
                    </span>
                  </div>
                </>
              )}
              {selected.status === "Rejected" && (
                <Banner tone="fail" icon={<X size={20} />}>
                  <b>Rejected:</b> {selected.reason}
                </Banner>
              )}
              {selected.status === "Approved" && (
                <Banner tone="info" icon={<Check size={20} />}>
                  Approved. The member account is open
                  {selected.memberId && (
                    <>
                      {" · "}
                      <Link
                        to={paths.admin.member(selected.memberId)}
                        className="font-bold text-brand underline underline-offset-2"
                      >
                        {selected.memberId}
                      </Link>
                    </>
                  )}
                  .
                </Banner>
              )}
            </Card>
          )}
        </div>
      </div>

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
