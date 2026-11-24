import { Fragment, useEffect, useState } from "react";
import { Ban, LoaderCircle, Search, Shield, User, Users } from "lucide-react";
import type {
  AdminListItem,
  AdminRoleDefinition,
  MonthIndex,
  NotificationSettings,
  RuleChangeRequest,
} from "@/domain/entities";
import { MONTHS, formatNaira, naira } from "@/domain/rules";
import type {
  NumericSavingsRule,
  SavingsRuleChangeInput,
  SavingsRuleCode,
} from "@/domain/repositories";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Banner,
  Button,
  Card,
  Chips,
  DataTable,
  EmptyState,
  Modal,
  OpenDecisionTag,
  Pill,
  Select,
  SelectField,
  Switch,
  TextField,
} from "../../../design-system";
import { AdminPageHeader } from "../../../layouts/AdminLayout";

type Tab = "roles" | "platform" | "admins" | "notifications" | "ruleRequests";

/** Groups permission codes by their namespace, in the order used by the API. */
const PERMISSION_NAMESPACES = [
  "announcements",
  "audit-logs",
  "interest",
  "members",
  "notification-settings",
  "notifications",
  "payout-account",
  "profile",
  "reports",
  "roles",
  "savings-settings",
  "savings",
  "staff",
  "testimonials",
  "transactions",
  "wallet",
] as const;

const NAMESPACE_LABELS: Record<string, string> = {
  announcements: "Announcements",
  "audit-logs": "Audit log",
  interest: "Interest",
  members: "Members",
  "notification-settings": "Notification settings",
  notifications: "Notifications",
  "payout-account": "Payout account",
  profile: "Profile",
  reports: "Reports",
  roles: "Roles",
  "savings-settings": "Savings settings",
  savings: "Savings",
  staff: "Staff",
  testimonials: "Testimonials",
  transactions: "Transactions",
  wallet: "Wallet",
};

/** User-friendly captions for known permission codes. */
const PERMISSION_CAPTIONS: Record<string, string> = {
  "announcements:delete": "Delete Announcements",
  "announcements:view-any": "View All Announcements",
  "audit-logs:view-any": "View All Audit Logs",
  "interest:approve": "Approve Interest",
  "interest:configure": "Configure Interest",
  "interest:disburse": "Disburse Interest",
  "members:approve": "Approve Members",
  "members:reject": "Reject Members",
  "members:suspend": "Suspend Members",
  "members:view": "View Members",
  "members:view-any": "View All Members",
  "notification-settings:update": "Update Notification Settings",
  "notification-settings:view": "View Notification Settings",
  "notifications:announce": "Make Announcements",
  "notifications:manage-own": "Manage Own Notifications",
  "notifications:view-own": "View Own Notifications",
  "payout-account:approve-change": "Approve Payout Account Changes",
  "payout-account:reject-change": "Reject Payout Account Changes",
  "payout-account:request-change": "Request Payout Account Changes",
  "payout-account:setup": "Set Up Payout Account",
  "payout-account:verify": "Verify Payout Account",
  "payout-account:view-any": "View All Payout Accounts",
  "payout-account:view-own": "View Own Payout Account",
  "profile:change-password": "Change Password",
  "profile:update": "Update Profile",
  "reports:view-any": "View All Reports",
  "roles:manage-permissions": "Manage Role Permissions",
  "savings-settings:approve": "Approve Savings Settings Changes",
  "savings-settings:request-change": "Request Savings Settings Changes",
  "savings-settings:view": "View Global Savings Settings",
  "savings:contribute": "Make Savings Contributions",
  "savings:lock-month": "Lock Savings Month",
  "savings:set-target": "Set Savings Target",
  "savings:view-any": "View All Members' Savings",
  "savings:view-own": "View Own Savings",
  "staff:assign-role": "Assign Staff Roles",
  "staff:create": "Create Staff Accounts",
  "staff:view-any": "View All Staff",
  "testimonials:create": "Create Testimonials",
  "testimonials:delete": "Delete Testimonials",
  "testimonials:publish": "Publish Testimonials",
  "testimonials:update": "Update Testimonials",
  "testimonials:view-any": "View All Testimonials",
  "transactions:view-any": "View All Transactions",
  "wallet:fund": "Fund Wallet",
  "wallet:manage-withdrawals": "Manage Withdrawals",
  "wallet:view": "View Wallet",
  "wallet:withdraw": "Withdraw from Wallet",
};

const roleKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Groups the union of both roles' server-provided permission codes. */
function groupPermissions(permissions: string[]): [string, string[]][] {
  const grouped = new Map<string, string[]>();
  for (const permission of permissions) {
    const namespace = permission.split(":")[0];
    grouped.set(namespace, [...(grouped.get(namespace) ?? []), permission]);
  }
  const ordered = PERMISSION_NAMESPACES.filter((namespace) =>
    grouped.has(namespace),
  ).map(
    (namespace) =>
      [NAMESPACE_LABELS[namespace], grouped.get(namespace)!.sort()] as [
        string,
        string[],
      ],
  );
  const extras = [...grouped.keys()]
    .filter(
      (namespace) =>
        !(PERMISSION_NAMESPACES as readonly string[]).includes(namespace),
    )
    .map(
      (namespace) =>
        [namespace, grouped.get(namespace)!.sort()] as [string, string[]],
    );
  return [...ordered, ...extras];
}

const RULE_OPTIONS: { value: SavingsRuleCode; label: string }[] = [
  { value: "minimum_per_payment", label: "Minimum per payment" },
  {
    value: "mid_year_joining_cutoff",
    label: "Mid-year joining cut-off",
  },
  { value: "payout_date", label: "Payout date" },
  {
    value: "platform_charge_per_payment",
    label: "Platform charge per payment",
  },
];

const isNumericRule = (rule: SavingsRuleCode): rule is NumericSavingsRule =>
  rule === "minimum_per_payment" || rule === "platform_charge_per_payment";

/** ADM-24 to ADM-27: roles, platform settings, admin users and notifications. */
export function SettingsPage() {
  const { repos } = useServices();
  const toast = useToast();
  const { session } = useAuth();
  const admin = session?.kind === "admin" ? session.admin : null;
  const sup = admin?.role === "SuperAdmin";
  const actor = admin?.name ?? "You";

  const [tab, setTab] = useState<Tab>("roles");
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<AdminRoleDefinition[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    if (!sup && tab === "ruleRequests") setTab("roles");
  }, [sup, tab]);

  useEffect(() => {
    let live = true;
    setRolesLoading(true);
    repos.admin
      .listRoles()
      .then((definitions) => {
        if (live) setRoles(definitions);
      })
      .catch((error: unknown) => {
        if (live) toast((error as Error).message);
      })
      .finally(() => {
        if (live) setRolesLoading(false);
      });
    return () => {
      live = false;
    };
  }, [repos, toast]);

  const adminPermissions = new Set(
    roles.find((role) =>
      ["admin", "administrator"].includes(roleKey(role.name)),
    )?.permissions ?? [],
  );
  const superPermissions = new Set(
    roles.find((role) => roleKey(role.name) === "superadmin")?.permissions ??
      [],
  );
  const permissionGroups = groupPermissions([
    ...new Set([...adminPermissions, ...superPermissions]),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Settings"
        sub="Roles, platform settings, admin users, notifications and rule change requests"
      />
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-8 sm:py-6">
        <Chips<Tab>
          variant="underline"
          value={tab}
          onChange={setTab}
          options={[
            { value: "roles", label: "Roles and permissions" },
            { value: "platform", label: "Platform settings" },
            { value: "admins", label: "Admin users" },
            { value: "notifications", label: "Notifications" },
            ...(sup
              ? [
                  {
                    value: "ruleRequests" as const,
                    label: "Rule change requests",
                  },
                ]
              : []),
          ]}
        />

        {tab === "roles" && (
          <>
            <div className="grid gap-3.5 md:grid-cols-3">
              {[
                {
                  icon: <User size={20} />,
                  title: "Member",
                  note: "Uses the member portal: saves, pays, sees own records and payout.",
                },
                {
                  icon: <Users size={20} />,
                  title: "Administrator",
                  note: "Maker. Runs daily operations, prepares interest and payout batches. Can’t approve their own work.",
                },
                {
                  icon: <Shield size={20} />,
                  title: "Super Admin",
                  note: "Checker. Approves interest and payouts, manages admin users and roles.",
                },
              ].map(({ icon, title, note }) => (
                <Card key={title} className="flex flex-col gap-2">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand">
                    {icon}
                  </span>
                  <b className="text-base font-extrabold">{title}</b>
                  <span className="text-xs leading-relaxed text-mute">
                    {note}
                  </span>
                </Card>
              ))}
            </div>
            {rolesLoading ? (
              <Card
                role="status"
                aria-live="polite"
                className="flex min-h-48 items-center justify-center gap-2"
              >
                <LoaderCircle className="animate-spin text-brand" size={18} />
                <p className="text-sm font-semibold text-mute">
                  Loading roles and permissions…
                </p>
              </Card>
            ) : (
              <div className="max-w-full overflow-x-auto rounded-2xl border border-line bg-white [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-140 border-collapse text-sm">
                  <thead>
                    <tr>
                      {["Permission", "Administrator", "Super Admin"].map(
                        (h) => (
                          <th
                            key={h}
                            className="whitespace-nowrap border-b border-line bg-soft px-3.5 py-2.5 text-left text-xs font-bold text-mute"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {permissionGroups.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3.5 py-6 text-center text-sm font-semibold text-mute"
                        >
                          No permissions were returned by the server.
                        </td>
                      </tr>
                    )}
                    {permissionGroups.map(([group, permissions]) => (
                      <Fragment key={group}>
                        <tr className="bg-soft">
                          <td
                            colSpan={3}
                            className="border-b border-line px-3.5 py-2.5 text-xs font-extrabold text-ink"
                          >
                            {group}
                          </td>
                        </tr>
                        {permissions.map((permission) => (
                          <tr
                            key={permission}
                            className="border-b border-line last:border-b-0"
                          >
                            <td className="px-3.5 py-3 pl-7 text-xs">
                              <span
                                className={
                                  PERMISSION_CAPTIONS[permission]
                                    ? "font-semibold"
                                    : "font-mono"
                                }
                              >
                                {PERMISSION_CAPTIONS[permission] ?? permission}
                              </span>
                            </td>
                            {[adminPermissions, superPermissions].map(
                              (granted, i) => (
                                <td key={i} className="px-3.5 py-3">
                                  <Pill
                                    tone={
                                      granted.has(permission) ? "ok" : "mute"
                                    }
                                    icon={
                                      granted.has(permission) ? undefined : (
                                        <Ban size={12} />
                                      )
                                    }
                                  >
                                    {granted.has(permission)
                                      ? "Granted"
                                      : "No access"}
                                  </Pill>
                                </td>
                              ),
                            )}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-mute">
                <Pill tone="ok">Granted</Pill> assigned to the role ·{" "}
                <Pill tone="mute" icon={<Ban size={12} />}>
                  No access
                </Pill>{" "}
                not assigned
              </span>
              <OpenDecisionTag code="OD-05">
                Final roles and permissions
              </OpenDecisionTag>
            </div>
          </>
        )}

        {tab === "platform" && (
          <PlatformTab sup={sup} busy={busy} setBusy={setBusy} toast={toast} />
        )}
        {tab === "admins" && <AdminsTab sup={sup} self={actor} toast={toast} />}
        {tab === "notifications" && (
          <NotificationsTab sup={sup} toast={toast} />
        )}
        {tab === "ruleRequests" && sup && (
          <RuleChangeRequestsTab toast={toast} />
        )}
      </div>
    </>
  );
}

function PlatformTab({
  sup,
  busy,
  setBusy,
  toast,
}: {
  sup: boolean;
  busy: boolean;
  setBusy: (b: boolean) => void;
  toast: (m: string) => void;
}) {
  const { repos } = useServices();
  const [year, setYear] = useState("2027");
  const [minimum, setMinimum] = useState("10000");
  const [cutoff, setCutoff] = useState("8");
  const [payout, setPayout] = useState("2027-12-14");
  const [charge, setCharge] = useState("");
  const [ruleOpen, setRuleOpen] = useState(false);
  const [rule, setRule] = useState<SavingsRuleCode>(RULE_OPTIONS[0].value);
  const [proposal, setProposal] = useState("");
  const [why, setWhy] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const proposedValue = proposal.trim();
  const numericValue = isNumericRule(rule);
  const valueIsValid = numericValue
    ? proposedValue !== "" &&
      Number.isFinite(Number(proposedValue)) &&
      Number(proposedValue) >= 0
    : proposedValue !== "";

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError(null);
    repos.settings
      .get()
      .then((s) => {
        if (!live) return;
        const y = Number(year);
        setMinimum(String(Math.round((s.minimumByYear[y] ?? 0) / 100)));
        setCutoff(String(s.cutoffMonth));
        setPayout(s.payoutDates[y] ?? `${year}-12-14`);
        setCharge(formatNaira(s.platformCharge));
      })
      .catch((e: unknown) => {
        if (live) setLoadError((e as Error).message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
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
      const chargeNaira = Number(charge.replace(/\D/g, "")) || 0;
      await repos.settings.save({
        year: y,
        minimumPerPayment: naira(min),
        platformChargePerPayment: naira(chargeNaira),
        cutoffMonth: Number(cutoff) as MonthIndex,
        payoutDate: payout,
      });
      toast("Platform settings saved.");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const requestRule = async () => {
    if (busy || !valueIsValid || !why.trim()) return;
    setBusy(true);
    try {
      const input: SavingsRuleChangeInput = {
        rule,
        proposedValue,
        reason: why.trim(),
      };
      const message = await repos.settings.requestRuleChange(input);
      setRuleOpen(false);
      setProposal("");
      setWhy("");
      toast(message);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 rounded-card bg-white p-6 text-sm font-semibold text-mute">
        <LoaderCircle className="animate-spin text-brand" size={18} />
        Loading platform settings…
      </div>
    );
  if (loadError)
    return (
      <Banner tone="fail">Could not load platform settings: {loadError}</Banner>
    );

  return (
    <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start">
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
          label="Platform charge (online payments)"
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
      <Card className="flex w-full flex-col gap-1">
        <h2 className="mb-1.5 text-base font-extrabold">How savings work</h2>
        {[
          ["Savings months", "January to November; December is payout month"],
          ["Payments", "Any number per month; each at least the minimum"],
          ["Monthly target", "Set by each member; optional, never enforced"],
          [
            "Month closes",
            "End of the 5th of the next month, or earlier when the member locks it (needs at least the minimum)",
          ],
          [
            "Mid-year joiners",
            "Clear catch-up months (minimum each) before the current month counts",
          ],
          [
            "Platform charge",
            `${charge} per payment, shown in the member’s total`,
          ],
          [
            "Missed month",
            "Interest affected by default; exceptions need Super Admin approval",
          ],
          [
            "Community access",
            "After the first confirmed payment of at least the minimum",
          ],
        ].map(([label, detail]) => (
          <div
            key={label}
            className="flex items-start justify-between gap-3 border-b border-line py-[9px] text-sm"
          >
            <span className="shrink-0 font-semibold text-mute">{label}</span>
            <span className="max-w-[58%] text-right font-extrabold">
              {detail}
            </span>
          </div>
        ))}
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => setRuleOpen(true)}
          >
            Request a rule change
          </Button>
          <OpenDecisionTag code="OD-06/07/08">
            Charge and gateway fee treatment
          </OpenDecisionTag>
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
              disabled={busy || !valueIsValid || !why.trim()}
              onClick={requestRule}
            >
              Submit request
            </Button>
          </>
        }
      >
        <SelectField
          label="Rule"
          options={RULE_OPTIONS}
          value={rule}
          onChange={(e) => {
            setRule(e.target.value as SavingsRuleCode);
            setProposal("");
          }}
        />
        <TextField
          label="Proposed change"
          type={numericValue ? "number" : "date"}
          inputMode={numericValue ? "numeric" : undefined}
          min={numericValue ? 0 : undefined}
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          placeholder={numericValue ? "Enter the proposed amount" : undefined}
          hint={
            numericValue
              ? "Enter the amount in naira."
              : "Choose the proposed date."
          }
        />
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
      </Modal>
    </div>
  );
}

function AdminsTab({
  sup,
  self,
  toast,
}: {
  sup: boolean;
  self: string;
  toast: (m: string) => void;
}) {
  const { repos } = useServices();
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminListItem["role"]>("Administrator");
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = async () => setAdmins(await repos.admin.listAdmins());
  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError(null);
    repos.admin
      .listAdmins()
      .then((rows) => {
        if (live) setAdmins(rows);
      })
      .catch((e: unknown) => {
        if (live) setLoadError((e as Error).message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
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
    if (pendingId) return;
    const activating = a.status !== "Active";
    const next: AdminListItem["status"] = activating ? "Active" : "Deactivated";
    setPendingId(a.id);
    try {
      await repos.admin.setAdminStatus(a.id, next);
      await reload();
      toast(
        activating
          ? a.status === "Deactivated"
            ? `${a.name} is active again.`
            : `${a.name} is now active.`
          : `${a.name} has been deactivated.`,
      );
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setPendingId(null);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 rounded-card bg-white p-6 text-sm font-semibold text-mute">
        <LoaderCircle className="animate-spin text-brand" size={18} />
        Loading admin users…
      </div>
    );
  if (loadError)
    return <Banner tone="fail">Could not load admin users: {loadError}</Banner>;

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
            render: (a) => {
              if (!sup || a.name === self) return null;
              const pending = pendingId === a.id;
              const label = pending
                ? a.status === "Active"
                  ? "Deactivating..."
                  : a.status === "Deactivated"
                    ? "Reactivating..."
                    : "Activating..."
                : a.status === "Active"
                  ? "Deactivate"
                  : a.status === "Deactivated"
                    ? "Reactivate"
                    : "Activate";
              return (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendingId !== null}
                  icon={
                    pending ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : undefined
                  }
                  onClick={() => toggle(a)}
                >
                  {label}
                </Button>
              );
            },
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
  toast,
}: {
  sup: boolean;
  toast: (m: string) => void;
}) {
  const { repos } = useServices();
  const [s, setS] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    repos.admin
      .getNotifications()
      .then((settings) => {
        if (live) setS(settings);
      })
      .catch((e: unknown) => {
        if (live) setError((e as Error).message);
      });
    return () => {
      live = false;
    };
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
      await repos.admin.saveReminderDays(s.reminderDays);
      toast("Notification settings saved.");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error)
    return (
      <Banner tone="fail">Could not load notification settings: {error}</Banner>
    );
  if (!s)
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 rounded-card bg-white p-6 text-sm font-semibold text-mute">
        <LoaderCircle className="animate-spin text-brand" size={18} />
        Loading notification settings…
      </div>
    );
  const visibleChannels = s.channels.filter((c) => c !== "SMS");

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        rows={s.events}
        rowKey={(ev) => ev.key}
        columns={[
          {
            header: "Event",
            render: (ev) => <b>{ev.label}</b>,
          },
          ...visibleChannels.map((channel) => ({
            header: channel,
            render: (ev: { key: string; label: string }) => (
              <Switch
                aria-label={`${ev.label} via ${channel}`}
                disabled={!sup}
                checked={s.matrix[ev.key]?.[channel] ?? false}
                onChange={() => flip(ev.key, channel)}
              />
            ),
          })),
        ]}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <SelectField
            label="Send deadline reminders"
            options={s.availableReminderDays.map((day) => ({
              value: String(day),
              label: `${day} day${day === 1 ? "" : "s"} before`,
            }))}
            value={String(s.reminderDays)}
            disabled={!sup}
            onChange={(e) =>
              setS({ ...s, reminderDays: Number(e.target.value) })
            }
          />
        </div>
        <Button size="md" disabled={busy || !sup} onClick={save}>
          Save notification settings
        </Button>
        {!sup && (
          <p className="text-sm font-semibold text-mute">
            Switch to Super Admin to edit.
          </p>
        )}
        <OpenDecisionTag code="OD-20">Notification channels</OpenDecisionTag>
      </div>
    </div>
  );
}

const requestStatusTone = (status: string): "ok" | "fail" | "pending" =>
  status === "approved" ? "ok" : status === "rejected" ? "fail" : "pending";

const isMonetaryRule = (rule: string) =>
  rule === "minimum_per_payment" || rule === "platform_charge_per_payment";

/** API values are plain naira strings; show the ₦ sign for money rules only. */
const formatRuleValue = (rule: string, value: string) => {
  const trimmed = value.trim();
  if (!trimmed || !isMonetaryRule(rule) || trimmed.startsWith("₦")) return value;
  return `₦${trimmed}`;
};

const formatRequestDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })} · ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

/** Super Admin review queue for submitted savings-rule change requests. */
function RuleChangeRequestsTab({ toast }: { toast: (m: string) => void }) {
  const { repos } = useServices();
  const [requests, setRequests] = useState<RuleChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    repos.settings
      .listRuleChangeRequests()
      .then((rows) => {
        if (!live) return;
        setRequests(rows);
        setSelectedId(rows[0]?.id);
      })
      .catch((e: unknown) => {
        if (live) setError((e as Error).message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [repos]);

  const selected = requests.find((r) => r.id === selectedId) ?? requests[0];

  const reload = async () => {
    const rows = await repos.settings.listRuleChangeRequests();
    setRequests(rows);
    setSelectedId((current) =>
      rows.some((r) => r.id === current) ? current : rows[0]?.id,
    );
  };

  const decide = async (decision: "approve" | "reject") => {
    if (!selected) return;
    setAction(decision);
    try {
      if (decision === "approve") {
        await repos.settings.approveRuleChangeRequest(selected.id);
      } else {
        await repos.settings.rejectRuleChangeRequest(
          selected.id,
          reason.trim(),
        );
      }
      await reload();
      setRejectOpen(false);
      setReason("");
      toast(
        `Rule change request ${decision === "approve" ? "approved" : "rejected"}.`,
      );
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setAction(null);
    }
  };

  if (error)
    return (
      <Banner tone="fail">Could not load rule change requests: {error}</Banner>
    );
  if (loading)
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 rounded-card bg-white p-6 text-sm font-semibold text-mute">
        <LoaderCircle className="animate-spin text-brand" size={18} />
        Loading rule change requests…
      </div>
    );

  return (
    <>
      <div className="flex h-125 flex-col gap-5 lg:flex-row lg:items-start">
        <div className="h-full w-full min-h-0 flex-1 overflow-y-auto lg:w-60">
          <div className="rounded-card border border-line bg-white p-2.5 lg:h-full lg:overflow-y-auto">
            {requests.length === 0 ? (
              <EmptyState
                icon={<Search size={24} />}
                title="No rule change requests"
              >
                Submitted requests will appear here for review.
              </EmptyState>
            ) : (
              requests.map((request) => (
                <button
                  key={request.id}
                  onClick={() => setSelectedId(request.id)}
                  aria-current={selected?.id === request.id}
                  className={`flex w-full items-center gap-2.5 rounded-2xl p-3 text-left transition hover:bg-[#faf7fe] ${
                    selected?.id === request.id ? "bg-[#fffaF0]" : ""
                  }`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="text-sm">{request.ruleLabel}</b>
                    <span className="text-xs font-semibold text-mute">
                      {formatRequestDate(request.createdAt)}
                    </span>
                  </span>
                  <Pill tone={requestStatusTone(request.status)}>
                    {request.status.charAt(0).toUpperCase() +
                      selected.status.slice(1)}
                  </Pill>
                </button>
              ))
            )}
          </div>
        </div>

        {selected && (
          <Card className="flex h-full w-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[19px] font-extrabold">
                  {selected.ruleLabel}
                </h2>
                <p className="text-[13px] font-semibold text-mute">
                  Requested by {selected.requestedBy} ·{" "}
                  {formatRequestDate(selected.createdAt)}
                </p>
              </div>
              <Pill tone={requestStatusTone(selected.status)}>
                {selected.status.charAt(0).toUpperCase() +
                  selected.status.slice(1)}
              </Pill>
            </div>

            <dl className="grid gap-x-14 md:grid-cols-2">
              {[
                [
                  "Current value",
                  formatRuleValue(selected.rule, selected.currentValue),
                ],
                [
                  "Proposed value",
                  formatRuleValue(selected.rule, selected.proposedValue),
                ],
                ["Requested by", selected.requestedBy],
                ["Reviewed by", selected.reviewedBy ?? "—"],
                [
                  "Reviewed at",
                  selected.reviewedAt
                    ? formatRequestDate(selected.reviewedAt)
                    : "—",
                ],
                ["Decision reason", selected.decisionReason ?? "—"],
                ["Created", formatRequestDate(selected.createdAt)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-col gap-1 border-b border-line py-3"
                >
                  <dt className="text-[13px] font-semibold text-mute">
                    {label}
                  </dt>
                  <dd className="break-words font-bold">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-mute">
                Reason
              </span>
              <p className="rounded-input border border-line bg-soft p-3.5 text-[15px] font-semibold leading-relaxed">
                {selected.reason || "—"}
              </p>
            </div>

            {selected.status === "pending" ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  size="md"
                  disabled={action !== null}
                  icon={
                    action === "approve" ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : undefined
                  }
                  onClick={() => decide("approve")}
                >
                  {action === "approve" ? "Approving..." : "Approve request"}
                </Button>
                <Button
                  size="md"
                  variant="outline"
                  className="text-fail"
                  disabled={action !== null}
                  onClick={() => {
                    setReason("");
                    setRejectOpen(true);
                  }}
                >
                  Reject
                </Button>
              </div>
            ) : (
              <Banner tone={selected.status === "approved" ? "info" : "fail"}>
                <b>
                  {selected.status === "approved" ? "Approved" : "Rejected"}
                </b>
                {selected.decisionReason
                  ? ` · ${selected.decisionReason}`
                  : "."}
              </Banner>
            )}
          </Card>
        )}
      </div>

      <Modal
        open={rejectOpen}
        title="Reject rule change request"
        onClose={() => setRejectOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim() || action !== null}
              icon={
                action === "reject" ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : undefined
              }
              onClick={() => decide("reject")}
            >
              {action === "reject" ? "Rejecting..." : "Reject request"}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Reason
          <textarea
            rows={4}
            autoFocus
            placeholder="Explain why this change is being rejected"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-28 w-full rounded-input border-[1.5px] border-line bg-white p-3.5 text-[15px] font-semibold text-ink outline-none focus:border-brand"
          />
        </label>
      </Modal>
    </>
  );
}
