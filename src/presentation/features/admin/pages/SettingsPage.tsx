import { Fragment, useEffect, useState } from "react";
import { Ban } from "lucide-react";
import type {
  AdminListItem,
  MonthIndex,
  NotificationSettings,
} from "@/domain/entities";
import { MONTHS, formatNaira, naira } from "@/domain/rules";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Banner,
  Button,
  Card,
  Chips,
  DataTable,
  Kpi,
  Modal,
  OpenDecisionTag,
  Pill,
  Select,
  SelectField,
  TextField,
} from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";

type Tab = "roles" | "platform" | "admins" | "notifications";
type Level = "Full" | "Prepare" | "Approve" | "View" | "No access";
const LEVEL_TONE = {
  Full: "ok",
  Prepare: "info",
  Approve: "gold",
  View: "mute",
  "No access": "mute",
} as const;

const PERMS: [string, [string, Level, Level, Level][]][] = [
  [
    "Members",
    [
      ["View records", "View", "Full", "Full"],
      ["Edit details", "No access", "Full", "Full"],
      ["Suspend or activate", "No access", "Full", "Full"],
    ],
  ],
  [
    "Registrations",
    [
      ["Review applications", "No access", "Full", "Full"],
      ["Approve or reject", "No access", "Prepare", "Approve"],
    ],
  ],
  [
    "Savings and transactions",
    [
      ["View and export", "View", "Full", "Full"],
      ["Resolve failed payments", "No access", "Full", "Full"],
    ],
  ],
  [
    "Interest",
    [
      ["Prepare configuration", "No access", "Prepare", "View"],
      ["Approve configuration", "No access", "No access", "Approve"],
    ],
  ],
  [
    "Payouts",
    [
      ["Prepare batch", "No access", "Prepare", "View"],
      ["Approve batch", "No access", "No access", "Approve"],
      ["Mark paid manually", "No access", "Full", "Full"],
    ],
  ],
  [
    "Platform",
    [
      ["Edit platform settings", "No access", "No access", "Full"],
      ["Manage admin users", "No access", "View", "Full"],
    ],
  ],
];

const RULES = [
  "Minimum per payment",
  "Monthly close",
  "Platform charge",
  "Missed month and interest",
  "Mid-year joining",
  "Withdrawals",
];

/** ADM-24 to ADM-27: roles, platform settings, admin users and notifications. */
export function SettingsPage() {
  const { repos, clock } = useServices();
  const toast = useToast();
  const { session } = useAuth();
  const admin = session?.kind === "admin" ? session.admin : null;
  const sup = admin?.role === "SuperAdmin";
  const actor = admin?.name ?? "You";
  const roleLabel = admin
    ? admin.role === "SuperAdmin"
      ? "Super Admin"
      : "Administrator"
    : "";

  const [tab, setTab] = useState<Tab>("roles");
  const [busy, setBusy] = useState(false);

  const audit = (action: string, entity: string, change: string) =>
    admin
      ? repos.admin.logAudit({
          at: clock.now().toISOString(),
          actor: admin.name,
          role: roleLabel,
          action,
          entity,
          change,
          category: "Roles",
        })
      : Promise.resolve();

  return (
    <>
      <AdminPageHeader
        title="Settings"
        sub="Roles, platform settings, admin users and notifications"
      />
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6">
        <Chips<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "roles", label: "Roles and permissions" },
            { value: "platform", label: "Platform settings" },
            { value: "admins", label: "Admin users" },
            { value: "notifications", label: "Notifications" },
          ]}
        />

        {tab === "roles" && (
          <>
            <div className="grid gap-3.5 md:grid-cols-3">
              <Kpi
                label="Member"
                value="Portal"
                note="Save, pay and view their own records"
              />
              <Kpi
                label="Administrator"
                value="Maker"
                note="Daily ops; prepares interest and payouts; can't approve own work"
              />
              <Kpi
                label="Super Admin"
                value="Checker"
                note="Approves maker work and manages admins"
              />
            </div>
            {PERMS.map(([group, rows]) => (
              <Card key={group} className="flex flex-col gap-1">
                <h2 className="mb-1 text-base font-extrabold">{group}</h2>
                <div className="max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
                  <div className="grid min-w-[560px] grid-cols-[1fr_repeat(3,minmax(110px,140px))] items-center gap-2 text-sm">
                  <span />
                  {["Member", "Administrator", "Super Admin"].map((h) => (
                    <b key={h} className="text-xs font-extrabold text-mute">
                      {h}
                    </b>
                  ))}
                  {rows.map(([perm, m, a, s]) => (
                    <Fragment key={perm}>
                      <span className="font-semibold">{perm}</span>
                      {([m, a, s] as Level[]).map((lv, i) => (
                        <Pill
                          key={i}
                          tone={LEVEL_TONE[lv]}
                          icon={
                            lv === "No access" ? <Ban size={12} /> : undefined
                          }
                        >
                          {lv}
                        </Pill>
                      ))}
                    </Fragment>
                  ))}
                  </div>
                </div>
              </Card>
            ))}
            <OpenDecisionTag code="OD-05">
              Roles and permissions
            </OpenDecisionTag>
          </>
        )}

        {tab === "platform" && (
          <PlatformTab
            sup={sup}
            busy={busy}
            setBusy={setBusy}
            audit={audit}
            toast={toast}
          />
        )}
        {tab === "admins" && (
          <AdminsTab sup={sup} self={actor} audit={audit} toast={toast} />
        )}
        {tab === "notifications" && (
          <NotificationsTab sup={sup} audit={audit} toast={toast} />
        )}
      </div>
    </>
  );
}

function PlatformTab({
  sup,
  busy,
  setBusy,
  audit,
  toast,
}: {
  sup: boolean;
  busy: boolean;
  setBusy: (b: boolean) => void;
  audit: (a: string, e: string, c: string) => Promise<unknown>;
  toast: (m: string) => void;
}) {
  const { repos } = useServices();
  const [year, setYear] = useState("2027");
  const [minimum, setMinimum] = useState("10000");
  const [cutoff, setCutoff] = useState("8");
  const [payout, setPayout] = useState("2027-12-14");
  const [charge, setCharge] = useState("");
  const [ruleOpen, setRuleOpen] = useState(false);
  const [rule, setRule] = useState(RULES[0]);
  const [proposal, setProposal] = useState("");
  const [why, setWhy] = useState("");

  useEffect(() => {
    repos.settings.get().then((s) => {
      const y = Number(year);
      setMinimum(String(Math.round((s.minimumByYear[y] ?? 0) / 100)));
      setCutoff(String(s.cutoffMonth));
      setPayout(s.payoutDates[y] ?? `${year}-12-14`);
      setCharge(formatNaira(s.platformCharge));
    });
  }, [repos, year]);

  const save = async () => {
    const y = Number(year);
    const min = Number(minimum.replace(/\D/g, ""));
    if (!min || min < 1000) {
      toast("Minimum must be at least ₦1,000.");
      return;
    }
    if (
      !/^\d{4}-12-(0[1-9]|1[0-4])$/.test(payout) ||
      !payout.startsWith(`${year}-12`)
    ) {
      toast(`Choose a date in December ${y}, on or before the 14th.`);
      return;
    }
    setBusy(true);
    try {
      const before = await repos.settings.get();
      const changes: string[] = [];
      if (Math.round((before.minimumByYear[y] ?? 0) / 100) !== min)
        changes.push(
          `minimum ${formatNaira(before.minimumByYear[y] ?? 0)} → ${formatNaira(naira(min))}`,
        );
      if (before.cutoffMonth !== Number(cutoff))
        changes.push(
          `cut-off ${MONTHS[before.cutoffMonth]} → ${MONTHS[Number(cutoff)]}`,
        );
      if (before.payoutDates[y] !== payout)
        changes.push(`payout date → ${payout}`);
      if (!changes.length) {
        toast("No changes to save.");
        return;
      }
      await repos.settings.save({
        minimumByYear: { [y]: naira(min) },
        cutoffMonth: Number(cutoff) as MonthIndex,
        payoutDates: { [y]: payout },
      });
      await audit(
        "Updated platform settings",
        `Savings year ${y}`,
        changes.join("; "),
      );
      toast("Platform settings saved.");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const requestRule = async () => {
    if (!proposal.trim() || (!sup && !why.trim())) return;
    await audit(
      "Requested rule change",
      rule,
      sup ? proposal.trim() : `${proposal.trim()} · ${why.trim()}`,
    );
    setRuleOpen(false);
    setProposal("");
    setWhy("");
    toast("Rule change submitted.");
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <Card className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-extrabold">Platform settings</h2>
          <Select
            aria-label="Settings year"
            className="ml-auto w-auto min-w-28"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            options={["2026", "2027"]}
          />
        </div>
        <TextField
          label={`Minimum per payment (₦)`}
          inputMode="numeric"
          value={minimum}
          disabled={!sup}
          hint="Applies to months that have not started"
          onChange={(e) => setMinimum(e.target.value)}
        />
        <SelectField
          label="Mid-year joining cut-off"
          value={cutoff}
          disabled={!sup}
          hint="Approved after this month → savings start next January"
          options={MONTHS.slice(0, 11).map((m, i) => ({
            value: String(i),
            label: m,
          }))}
          onChange={(e) => setCutoff(e.target.value)}
        />
        <TextField
          label="Payout date"
          type="date"
          value={payout}
          disabled={!sup}
          hint={`On or before 14 Dec ${year}; members are notified`}
          onChange={(e) => setPayout(e.target.value)}
        />
        <TextField
          label="Platform charge per payment"
          value={charge}
          readOnly
          hint="Fixed by policy; request a rule change to revisit it"
        />
        {!sup && (
          <Banner tone="neutral">Switch to a Super Admin to edit.</Banner>
        )}
        {sup && (
          <div>
            <Button size="md" disabled={busy} onClick={save}>
              Save changes
            </Button>
          </div>
        )}
      </Card>
      <Card className="flex w-full shrink-0 flex-col items-start gap-3 lg:w-96">
        <h2 className="text-base font-extrabold">How savings work</h2>
        <ul className="flex flex-col gap-1.5 text-sm font-semibold leading-relaxed text-[#474252]">
          {[
            "Save January–November; December is payout month.",
            "Every payment meets the minimum per payment.",
            "The monthly target is optional and never enforced.",
            "Months close on the 5th; members can lock early.",
            "Mid-year joiners catch up month by month.",
            "A missed month affects interest eligibility.",
            "The community unlocks after the first confirmed payment.",
          ].map((t) => (
            <li key={t}>· {t}</li>
          ))}
        </ul>
        <Button variant="outline" size="md" onClick={() => setRuleOpen(true)}>
          Request a rule change
        </Button>
        <div className="flex flex-wrap gap-2">
          <OpenDecisionTag code="OD-06">Minimum and charges</OpenDecisionTag>
          <OpenDecisionTag code="OD-07">Gateway fees</OpenDecisionTag>
          <OpenDecisionTag code="OD-08">Charge display</OpenDecisionTag>
        </div>
      </Card>

      <Modal
        open={ruleOpen}
        title="Request a rule change"
        onClose={() => setRuleOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!proposal.trim() || (!sup && !why.trim())}
              onClick={requestRule}
            >
              Submit request
            </Button>
          </>
        }
      >
        <SelectField
          label="Rule"
          options={RULES}
          value={rule}
          onChange={(e) => setRule(e.target.value)}
        />
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Proposed change
          <textarea
            rows={3}
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            placeholder="What should change?"
            className="w-full rounded-input border-[1.5px] border-line bg-white p-3.5 text-[15px] font-semibold outline-none focus:border-brand"
          />
        </label>
        {!sup && (
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Why
            <textarea
              rows={3}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Required"
              className="w-full rounded-input border-[1.5px] border-line bg-white p-3.5 text-[15px] font-semibold outline-none focus:border-brand"
            />
          </label>
        )}
      </Modal>
    </div>
  );
}

function AdminsTab({
  sup,
  self,
  audit,
  toast,
}: {
  sup: boolean;
  self: string;
  audit: (a: string, e: string, c: string) => Promise<unknown>;
  toast: (m: string) => void;
}) {
  const { repos } = useServices();
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminListItem["role"]>("Administrator");
  const [busy, setBusy] = useState(false);

  const reload = async () => setAdmins(await repos.admin.listAdmins());
  useEffect(() => {
    reload();
  }, [repos]);

  const invite = async () => {
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      toast("Add a name and a valid work email.");
      return;
    }
    setBusy(true);
    try {
      await repos.admin.inviteAdmin({
        name: name.trim(),
        email: email.trim(),
        role,
      });
      await audit(
        "Invited admin user",
        name.trim(),
        role === "SuperAdmin" ? "Super Admin" : "Administrator",
      );
      setOpen(false);
      setName("");
      setEmail("");
      await reload();
      toast(`Invite sent to ${email.trim()}.`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a: AdminListItem) => {
    const next = a.status === "Deactivated" ? "Active" : "Deactivated";
    await repos.admin.setAdminStatus(a.id, next);
    await audit(
      next === "Active" ? "Reactivated admin user" : "Deactivated admin user",
      a.name,
      a.role,
    );
    await reload();
    toast(
      next === "Active"
        ? `${a.name} is active again.`
        : `${a.name} has been deactivated.`,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-mute">
          {sup
            ? "Invite and manage who can work in the admin portal."
            : "Only a Super Admin can invite or deactivate admins."}
        </p>
        {sup && (
          <span className="ml-auto">
            <Button size="md" onClick={() => setOpen(true)}>
              Invite admin
            </Button>
          </span>
        )}
      </div>
      <DataTable<AdminListItem>
        rows={admins}
        rowKey={(r) => r.id}
        columns={[
          { header: "Name", render: (a) => <b>{a.name}</b> },
          {
            header: "Email",
            render: (a) => <span className="text-mute">{a.email}</span>,
          },
          {
            header: "Role",
            render: (a) => (
              <Pill tone={a.role === "SuperAdmin" ? "gold" : "brand"}>
                {a.role === "SuperAdmin" ? "Super Admin" : "Administrator"}
              </Pill>
            ),
          },
          {
            header: "Status",
            render: (a) => (
              <Pill
                tone={
                  a.status === "Active"
                    ? "ok"
                    : a.status === "Invited"
                      ? "pending"
                      : "mute"
                }
              >
                {a.status}
              </Pill>
            ),
          },
          {
            header: "Last active",
            render: (a) => <span className="text-mute">{a.lastActive}</span>,
          },
          {
            header: "",
            render: (a) =>
              sup && a.name !== self ? (
                <Button size="sm" variant="outline" onClick={() => toggle(a)}>
                  {a.status === "Deactivated" ? "Reactivate" : "Deactivate"}
                </Button>
              ) : null,
          },
        ]}
      />
      <Modal
        open={open}
        title="Invite admin"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={invite}>
              Send invite
            </Button>
          </>
        }
      >
        <TextField
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Work email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <SelectField
          label="Role"
          options={[
            { value: "Administrator", label: "Administrator · maker" },
            { value: "SuperAdmin", label: "Super Admin · checker" },
          ]}
          value={role}
          onChange={(e) => setRole(e.target.value as AdminListItem["role"])}
        />
      </Modal>
    </div>
  );
}

function NotificationsTab({
  sup,
  audit,
  toast,
}: {
  sup: boolean;
  audit: (a: string, e: string, c: string) => Promise<unknown>;
  toast: (m: string) => void;
}) {
  const { repos } = useServices();
  const [s, setS] = useState<NotificationSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    repos.settings.get().then(() => repos.admin.getNotifications().then(setS));
  }, [repos]);

  const flip = (ev: string, ch: string) => {
    if (!s || !sup) return;
    setS({
      ...s,
      matrix: {
        ...s.matrix,
        [ev]: { ...s.matrix[ev], [ch]: !s.matrix[ev][ch] },
      },
    });
  };

  const save = async () => {
    if (!s) return;
    setBusy(true);
    try {
      await repos.admin.saveNotifications(s);
      await audit(
        "Updated notification settings",
        "Notifications",
        `Reminders ${s.reminderDays} day(s) before`,
      );
      toast("Notification settings saved.");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!s) return <p className="text-sm font-semibold text-mute">Loading…</p>;
  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-x-auto">
        <div className="grid min-w-160 grid-cols-[1fr_repeat(4,110px)] items-center gap-2 text-sm">
          <span />
          {s.channels.map((c) => (
            <b key={c} className="text-xs font-extrabold text-mute">
              {c}
            </b>
          ))}
          {s.events.map((ev) => (
            <>
              <span key={ev.key} className="font-semibold">
                {ev.label}
              </span>
              {s.channels.map((c) => (
                <input
                  key={c}
                  type="checkbox"
                  aria-label={`${ev.label} via ${c}`}
                  disabled={!sup}
                  checked={s.matrix[ev.key]?.[c] ?? false}
                  onChange={() => flip(ev.key, c)}
                  className="size-5 accent-brand"
                />
              ))}
            </>
          ))}
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <SelectField
            label="Payment reminders"
            options={[
              { value: "1", label: "1 day before" },
              { value: "3", label: "3 days before" },
              { value: "5", label: "5 days before" },
            ]}
            value={String(s.reminderDays)}
            disabled={!sup}
            onChange={(e) =>
              setS({ ...s, reminderDays: Number(e.target.value) })
            }
          />
        </div>
        {sup ? (
          <span className="ml-auto">
            <Button size="md" disabled={busy} onClick={save}>
              Save changes
            </Button>
          </span>
        ) : (
          <p className="text-sm font-semibold text-mute">
            Switch to a Super Admin to edit.
          </p>
        )}
        <OpenDecisionTag code="OD-20">Notification channels</OpenDecisionTag>
      </div>
    </div>
  );
}
