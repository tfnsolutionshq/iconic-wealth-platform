import { useEffect, useState, type FormEvent } from "react";
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
import { ValidationError } from "@/domain/errors";
import type {
  ApiMemberStatus,
  MemberQuery,
  NewAdminMemberInput,
  PageMeta,
} from "@/domain/repositories";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  Banner,
  Button,
  Card,
  Chips,
  DataTable,
  Modal,
  Pill,
  SelectField,
  TextField,
} from "../../../design-system";
import {
  ageOn,
  formatNaira,
  HEARD_OPTIONS,
  isEmail,
  isPhone,
  isStrongPassword,
  MIN_AGE,
  MONTHS_SHORT,
  NG_STATES,
  REFERRAL_OPTION,
} from "@/domain/rules";
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

type AddMemberForm = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: NewAdminMemberInput["gender"];
  email: string;
  phone: string;
  stateOfResidence: string;
  residentialAddress: string;
  howHeardAboutUs: string;
  referredBy: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
  password: string;
  passwordConfirmation: string;
};
type AddMemberFormField = keyof AddMemberForm;
type AddMemberErrors = Partial<Record<AddMemberFormField, string>>;

const EMPTY_ADD_MEMBER_FORM: AddMemberForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "Female",
  email: "",
  phone: "",
  stateOfResidence: "",
  residentialAddress: "",
  howHeardAboutUs: "",
  referredBy: "",
  nextOfKinName: "",
  nextOfKinRelationship: "",
  nextOfKinPhone: "",
  password: "",
  passwordConfirmation: "",
};

const GENDER_OPTIONS: NewAdminMemberInput["gender"][] = [
  "Female",
  "Male",
  "Other",
];
const RELATIONSHIP_OPTIONS = [
  "Spouse",
  "Parent",
  "Sibling",
  "Child",
  "Relative",
  "Friend",
  "Other",
] as const;

/** API field names → the names used by the Add member form. */
const ADD_MEMBER_API_FIELDS: Record<string, AddMemberFormField> = {
  first_name: "firstName",
  last_name: "lastName",
  dob: "dateOfBirth",
  date_of_birth: "dateOfBirth",
  gender: "gender",
  email: "email",
  phone: "phone",
  state_of_residence: "stateOfResidence",
  residential_address: "residentialAddress",
  address: "residentialAddress",
  how_heard_about_us: "howHeardAboutUs",
  referred_by: "referredBy",
  next_of_kin_name: "nextOfKinName",
  next_of_kin_relationship: "nextOfKinRelationship",
  relationship: "nextOfKinRelationship",
  next_of_kin_phone: "nextOfKinPhone",
  password: "password",
  password_confirmation: "passwordConfirmation",
};

function validateAddMember(form: AddMemberForm): AddMemberErrors {
  const errors: AddMemberErrors = {};
  if (!form.firstName.trim()) errors.firstName = "Enter the first name.";
  if (!form.lastName.trim()) errors.lastName = "Enter the last name.";

  const dob = new Date(form.dateOfBirth);
  if (!form.dateOfBirth || Number.isNaN(dob.getTime())) {
    errors.dateOfBirth = "Enter a valid date of birth.";
  } else if (form.dateOfBirth > new Date().toISOString().slice(0, 10)) {
    errors.dateOfBirth = "Date of birth cannot be in the future.";
  } else if (ageOn(form.dateOfBirth, new Date()) < MIN_AGE) {
    errors.dateOfBirth = `Must be ${MIN_AGE} or older.`;
  }

  if (!form.gender) errors.gender = "Select a gender.";
  if (!isEmail(form.email)) errors.email = "Enter a valid email address.";
  if (form.phone.trim() && !isPhone(form.phone))
    errors.phone = "Enter an 11-digit phone number.";
  if (!(NG_STATES as readonly string[]).includes(form.stateOfResidence))
    errors.stateOfResidence = "Select a state of residence.";
  if (form.residentialAddress.trim().length < 5)
    errors.residentialAddress = "Enter the residential address.";
  if (!(HEARD_OPTIONS as readonly string[]).includes(form.howHeardAboutUs))
    errors.howHeardAboutUs = "Select how you heard about us.";
  if (
    form.howHeardAboutUs === REFERRAL_OPTION &&
    !form.referredBy.trim()
  )
    errors.referredBy = "Enter the referring member’s ID or phone number.";

  if (!form.nextOfKinName.trim())
    errors.nextOfKinName = "Enter the next of kin’s name.";
  if (!form.nextOfKinRelationship)
    errors.nextOfKinRelationship = "Select a relationship.";
  if (!isPhone(form.nextOfKinPhone))
    errors.nextOfKinPhone = "Enter an 11-digit phone number.";
  if (!isStrongPassword(form.password))
    errors.password =
      "Use at least 8 characters with upper and lower case letters and a number.";
  if (form.password !== form.passwordConfirmation)
    errors.passwordConfirmation = "Passwords do not match.";
  return errors;
}

/** Converts API validation messages into inline form errors. */
function mapAddMemberErrors(
  fields: Record<string, string[]>,
): AddMemberErrors {
  const errors: AddMemberErrors = {};
  for (const [apiField, messages] of Object.entries(fields)) {
    const field = ADD_MEMBER_API_FIELDS[apiField];
    if (!field) continue;
    const message = (Array.isArray(messages) ? messages : [messages])
      .filter(Boolean)
      .join(" ");
    if (!message) continue;
    errors[field] = errors[field]
      ? `${errors[field]} ${message}`
      : message;
  }
  return errors;
}

/** ADM-04/05: tabs, filters and the Add member modal for `POST /admin/members`. */
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
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddMemberForm>(
    EMPTY_ADD_MEMBER_FORM,
  );
  const [addErrors, setAddErrors] = useState<AddMemberErrors>({});
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [savingMember, setSavingMember] = useState(false);
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

  const openAddMember = () => {
    setAddForm(EMPTY_ADD_MEMBER_FORM);
    setAddErrors({});
    setAddFormError(null);
    setAddOpen(true);
  };
  const closeAddMember = () => {
    if (savingMember) return;
    setAddOpen(false);
    setAddForm(EMPTY_ADD_MEMBER_FORM);
    setAddErrors({});
    setAddFormError(null);
  };
  const refreshAfterAdd = async () => {
    const [page, nextCounts] = await Promise.all([
      repos.admin.listMembers(q),
      repos.admin.countMembers(),
    ]);
    setRows(page.data);
    setMeta(page.meta);
    setCounts(nextCounts);
  };
  const saveMember = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (typeof repos.admin.addMember !== "function") {
      toast("The app is running stale code. Refresh the page and try again.");
      return;
    }
    const nextErrors = validateAddMember(addForm);
    if (Object.keys(nextErrors).length > 0) {
      setAddErrors(nextErrors);
      setAddFormError("Check the highlighted fields.");
      return;
    }
    setSavingMember(true);
    setAddFormError(null);
    try {
      const created = await repos.admin.addMember({
        firstName: addForm.firstName.trim(),
        lastName: addForm.lastName.trim(),
        dateOfBirth: addForm.dateOfBirth,
        gender: addForm.gender,
        email: addForm.email.trim(),
        phone: addForm.phone.trim() || undefined,
        stateOfResidence: addForm.stateOfResidence,
        residentialAddress: addForm.residentialAddress.trim(),
        howHeardAboutUs: addForm.howHeardAboutUs,
        nextOfKinName: addForm.nextOfKinName.trim(),
        nextOfKinRelationship: addForm.nextOfKinRelationship,
        nextOfKinPhone: addForm.nextOfKinPhone.trim(),
        password: addForm.password,
        referredBy: addForm.referredBy.trim() || null,
      });
      setAddOpen(false);
      setAddForm(EMPTY_ADD_MEMBER_FORM);
      setAddErrors({});
      void refreshAfterAdd().catch(() => {});
      toast(created.message || `${created.name} added.`);
      if (created.id) navigate(paths.admin.member(created.id));
    } catch (error) {
      if (error instanceof ValidationError) {
        setAddErrors((prev) => ({
          ...prev,
          ...mapAddMemberErrors(error.fields),
        }));
        setAddFormError(error.message);
        toast(error.message);
      } else {
        const message =
          error instanceof Error ? error.message : "Could not add the member.";
        setAddFormError(message);
        toast(message);
      }
    } finally {
      setSavingMember(false);
    }
  };

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
              onClick={openAddMember}
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

      <Modal
        open={addOpen}
        title="Add member"
        onClose={closeAddMember}
        wide
        footer={
          <>
            <Button
              variant="outline"
              disabled={savingMember}
              onClick={closeAddMember}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-member-form"
              disabled={savingMember}
              icon={
                savingMember ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : undefined
              }
            >
              {savingMember ? "Adding member…" : "Add member"}
            </Button>
          </>
        }
      >
        <form
          id="add-member-form"
          className="flex flex-col gap-3.5"
          onSubmit={saveMember}
        >
          <p className="text-sm leading-relaxed text-mute">
            Onboard a member directly. They’ll get a login invite and complete
            the payout and baseline setup when they first log in.
          </p>
          {addFormError && <Banner tone="fail">{addFormError}</Banner>}

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="First name"
              autoComplete="given-name"
              value={addForm.firstName}
              error={addErrors.firstName}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, firstName: e.target.value }))
              }
            />
            <TextField
              label="Last name"
              autoComplete="family-name"
              value={addForm.lastName}
              error={addErrors.lastName}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, lastName: e.target.value }))
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              label="Date of birth"
              type="date"
              autoComplete="bday"
              max={new Date().toISOString().slice(0, 10)}
              value={addForm.dateOfBirth}
              error={addErrors.dateOfBirth}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  dateOfBirth: e.target.value,
                }))
              }
            />
            <SelectField
              label="Gender"
              options={GENDER_OPTIONS}
              value={addForm.gender}
              error={addErrors.gender}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  gender: e.target.value as NewAdminMemberInput["gender"],
                }))
              }
            />
            <TextField
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              optional
              placeholder="08012345678"
              value={addForm.phone}
              error={addErrors.phone}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
          </div>

          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="john.doe@example.com"
            value={addForm.email}
            error={addErrors.email}
            onChange={(e) =>
              setAddForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="State of residence"
              options={NG_STATES}
              placeholder="Select state"
              value={addForm.stateOfResidence}
              error={addErrors.stateOfResidence}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  stateOfResidence: e.target.value,
                }))
              }
            />
            <TextField
              label="Residential address"
              autoComplete="street-address"
              placeholder="12 Example Street, Lekki"
              value={addForm.residentialAddress}
              error={addErrors.residentialAddress}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  residentialAddress: e.target.value,
                }))
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="How heard about us"
              options={HEARD_OPTIONS}
              placeholder="Select an option"
              value={addForm.howHeardAboutUs}
              error={addErrors.howHeardAboutUs}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  howHeardAboutUs: e.target.value,
                }))
              }
            />
            <TextField
              label="Referred by"
              optional
              placeholder="Member ID or phone number"
              value={addForm.referredBy}
              error={addErrors.referredBy}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, referredBy: e.target.value }))
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              label="Next of kin name"
              autoComplete="off"
              placeholder="Jane Doe"
              value={addForm.nextOfKinName}
              error={addErrors.nextOfKinName}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  nextOfKinName: e.target.value,
                }))
              }
            />
            <SelectField
              label="Relationship"
              options={RELATIONSHIP_OPTIONS}
              placeholder="Select relationship"
              value={addForm.nextOfKinRelationship}
              error={addErrors.nextOfKinRelationship}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  nextOfKinRelationship: e.target.value,
                }))
              }
            />
            <TextField
              label="Next of kin phone"
              type="tel"
              inputMode="tel"
              placeholder="08087654321"
              value={addForm.nextOfKinPhone}
              error={addErrors.nextOfKinPhone}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  nextOfKinPhone: e.target.value,
                }))
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters, with upper and lower case letters and a number."
              value={addForm.password}
              error={addErrors.password}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, password: e.target.value }))
              }
            />
            <TextField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={addForm.passwordConfirmation}
              error={addErrors.passwordConfirmation}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  passwordConfirmation: e.target.value,
                }))
              }
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
