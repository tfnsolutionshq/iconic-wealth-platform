/**
 * HTTP implementations of the domain ports. Endpoint paths are a PROPOSED contract for the backend team;
 * agree them in Sprint 0 and keep this file as the single place that knows URLs and payload shapes.
 * Money is exchanged in kobo (integers).
 */
import type {
  AdminListItem,
  AdminRole,
  AdminUser,
  AuditEntry,
  Bank,
  ContributionPaymentMethod,
  InterestActor,
  InterestBand,
  InterestCalcRow,
  InterestCalculationEntries,
  InterestCalculationSummary,
  InterestRateMode,
  InterestScope,
  InterestNotifyChannel,
  InterestStage,
  InterestStageStatus,
  InterestStatus,
  InterestWizardStage,
  InterestWorkflow,
  InterestYearSummary,
  Kobo,
  Member,
  MemberNotification,
  MemberListRow,
  MemberSummary,
  MonthIndex,
  NotificationSettings,
  PayoutAccount,
  PayoutBatch,
  PayoutBatchStatus,
  PayoutDestination,
  PayoutRow,
  PayoutRowStatus,
  ReferralGroup,
  Registration,
  ReportKind,
  ReportResult,
  SavingsDashboard,
  SavingsMonth,
  SavingsPeriod,
  SavingsYear,
  Session,
  Testimonial,
  Transaction,
  TransactionStatus,
} from "@/domain/entities";
import type { PlatformSettings } from "@/domain/rules";
import { interestWizardProgress, MONTHS, naira } from "@/domain/rules";
import type {
  ActivityPageResult,
  ActivityQuery,
  AdminRepository,
  AuthRepository,
  ChangeField,
  ContributionIntent,
  ContributionRepository,
  InterestRulesInput,
  MemberQuery,
  MemberListPage,
  MemberRepository,
  NewRegistration,
  PageMeta,
  PayoutAccountRepository,
  RegistrationRepository,
  RegistrationStarted,
  SavingsDashboardRepository,
  SavingsTargetRepository,
  SettingsRepository,
  TestimonialRepository,
  VerifiedContribution,
  ApiMember,
  ApiMemberPage,
  ApiMemberStatus,
  TransactionCounts,
  TransactionListPage,
  TransactionPageMeta,
  TransactionQuery,
} from "@/domain/repositories";
import type { RegistrationDetails } from "@/domain/rules";
import type { HttpClient } from "@/data/api/httpClient";
import { ApiError, type ApiEnvelope } from "@/data/api/httpClient";
import { ValidationError } from "@/domain/errors";

/**
 * Re-throws a transport-level `ApiError` as the domain's `ValidationError` when the
 * response carried field-level messages, so the presentation layer can map each
 * message onto the right form field instead of showing the generic envelope text.
 */
function rethrowWithFieldErrors(error: unknown): never {
  if (error instanceof ApiError && Object.keys(error.errors).length > 0) {
    throw new ValidationError(error.message, error.errors);
  }
  throw error;
}

/** Reads `data` from the API envelope, while also tolerating an unwrapped payload. */
function unwrapData<T>(payload: ApiEnvelope<T> | T): T | null {
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    "data" in payload
  ) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

/**
 * Normalises a record from GET /admin/members.
 *
 * The mock adapter returns `MemberSummary` rows, while the live API returns
 * member records (`ApiMember`). In both cases the admin list needs at least an
 * id, a name and a status; savings figures are carried through when present.
 */
function mapAdminMemberRow(raw: ApiMember | MemberListRow): MemberListRow {
  if ("name" in raw) return raw;

  const m = raw as ApiMember;
  const extras = raw as unknown as Partial<MemberListRow>;
  const name =
    m.full_name?.trim() ||
    `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() ||
    m.email;
  return {
    id: m.member_id || m.id,
    name,
    status: m.status === "active" ? "Active" : "Suspended",
    accountStatus: m.status,
    joinedOn: m.created_at?.slice(0, 10) ?? "",
    referredBy: m.referred_by ?? undefined,
    ...(extras.targetKobo !== undefined
      ? { targetKobo: extras.targetKobo }
      : {}),
    ...(extras.savedKobo !== undefined ? { savedKobo: extras.savedKobo } : {}),
    ...(extras.monthsPaid !== undefined
      ? { monthsPaid: extras.monthsPaid }
      : {}),
    ...(extras.currentMonthStatus !== undefined
      ? { currentMonthStatus: extras.currentMonthStatus }
      : {}),
    ...(extras.eligibility !== undefined
      ? { eligibility: extras.eligibility }
      : {}),
    ...(extras.forfeitReason !== undefined
      ? { forfeitReason: extras.forfeitReason }
      : {}),
  };
}

/** Raw transaction row returned by GET /admin/transactions. */
interface ApiAdminTransaction {
  id?: string;
  reference?: string;
  gateway_reference?: string;
  paystack_reference?: string;
  member_id?: string;
  member_name?: string;
  member?:
    | string
    | {
        id?: string;
        member_id?: string;
        full_name?: string;
        name?: string;
        first_name?: string;
        last_name?: string;
      };
  user?: {
    id?: string;
    member_id?: string;
    full_name?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
  };
  kind?: string;
  type?: string;
  transaction_type?: string;
  year?: number | string;
  month?: number | string;
  amount?: string | number;
  amount_kobo?: string | number;
  net_amount?: string | number;
  platform_charge?: string | number;
  platform_charge_kobo?: string | number;
  status?: string;
  status_label?: string;
  late?: boolean;
  is_late?: boolean;
  failure_reason?: string;
  reason?: string;
  created_at?: string;
  confirmed_at?: string;
  date?: string;
  savings_month?: {
    year?: number;
    month?: number;
    period?: string;
    month_name?: string;
  };
  payment_method?: string;
  paymentMethod?: ContributionPaymentMethod;
  channel?: string;
  payout_destination?: PayoutDestination;
  payoutDestination?: PayoutDestination;
  allocations?: Transaction["allocations"];
  // Fields already normalised by the API.
  memberName?: string;
  memberId?: string;
  amountKobo?: number;
  platformChargeKobo?: number;
  gatewayReference?: string;
  failureReason?: string;
  createdAt?: string;
}

/** Normalises an admin transaction row, whether it is in API snake_case or domain shape. */
function mapAdminTransaction(raw: ApiAdminTransaction): Transaction {
  const member = typeof raw.member === "object" ? raw.member : raw.user;
  const memberName =
    raw.memberName ??
    raw.member_name ??
    (typeof raw.member === "string" ? raw.member : undefined) ??
    member?.full_name ??
    member?.name ??
    [member?.first_name, member?.last_name].filter(Boolean).join(" ");
  const memberId =
    raw.memberId ?? raw.member_id ?? member?.member_id ?? member?.id ?? "";

  const kindText = String(
    raw.kind ?? raw.type ?? raw.transaction_type ?? "",
  ).toLowerCase();
  const kind: Transaction["kind"] = kindText.includes("payout")
    ? "Payout"
    : "Contribution";

  const period = raw.savings_month?.period ?? "";
  const periodMatch = /^(\d{4})-(\d{2})$/.exec(period);
  const createdAt =
    raw.createdAt ??
    raw.created_at ??
    raw.confirmed_at ??
    raw.date ??
    new Date().toISOString();

  const amountKobo =
    raw.amountKobo !== undefined
      ? Number(raw.amountKobo)
      : raw.amount_kobo !== undefined
        ? Number(raw.amount_kobo)
        : koboFromApi(raw.amount ?? raw.net_amount);
  const platformChargeKobo =
    raw.platformChargeKobo !== undefined
      ? Number(raw.platformChargeKobo)
      : raw.platform_charge_kobo !== undefined
        ? Number(raw.platform_charge_kobo)
        : koboFromApi(raw.platform_charge);
  const netAmountKobo = koboFromApi(raw.net_amount);

  const createdYear = new Date(createdAt).getFullYear();
  const year =
    Number(
      raw.year ??
        raw.savings_month?.year ??
        (periodMatch ? periodMatch[1] : createdYear),
    ) || createdYear;

  const toMonthIndex = (value: number): MonthIndex =>
    Math.max(0, Math.min(11, value)) as MonthIndex;

  let monthIndex: MonthIndex | null = null;
  if (periodMatch) {
    monthIndex = toMonthIndex(Number(periodMatch[2]) - 1);
  } else if (raw.savings_month?.month !== undefined) {
    monthIndex = toMonthIndex(Number(raw.savings_month.month) - 1);
  } else if (raw.month !== undefined) {
    monthIndex = toMonthIndex(Number(raw.month) - 1);
  } else if (raw.savings_month?.month_name) {
    const idx = MONTHS.findIndex(
      (m) => m.toLowerCase() === raw.savings_month!.month_name!.toLowerCase(),
    );
    if (idx >= 0) monthIndex = idx as MonthIndex;
  }

  const statusText = (raw.status ?? "").toLowerCase();
  let status: TransactionStatus = "Pending";
  if (
    ["successful", "success", "confirmed", "paid", "completed"].includes(
      statusText,
    )
  ) {
    status = "Successful";
  } else if (statusText === "processing") {
    status = "Processing";
  } else if (
    ["failed", "declined", "cancelled", "abandoned"].includes(statusText)
  ) {
    status = "Failed";
  }

  const methodText = (
    raw.paymentMethod ??
    raw.payment_method ??
    raw.channel ??
    ""
  ).toLowerCase();
  const paymentMethod: ContributionPaymentMethod | undefined =
    methodText === "wallet"
      ? "Wallet"
      : ["bank", "bank_transfer", "bank account"].includes(methodText)
        ? "Bank Account"
        : methodText
          ? "Online"
          : undefined;

  const allocations =
    kind === "Payout"
      ? []
      : Array.isArray(raw.allocations) && raw.allocations.length > 0
        ? raw.allocations
        : [
            {
              month:
                monthIndex ?? (new Date(createdAt).getMonth() as MonthIndex),
              amountKobo: netAmountKobo || amountKobo,
            },
          ];

  const failureReason =
    raw.failureReason ??
    raw.failure_reason ??
    raw.reason ??
    (status === "Failed" ? raw.status_label : undefined);
  const payoutDestination = raw.payoutDestination ?? raw.payout_destination;

  return {
    id: raw.id ?? raw.reference ?? `TX-${createdAt}`,
    reference: raw.reference ?? raw.id ?? "",
    gatewayReference:
      raw.gatewayReference ?? raw.gateway_reference ?? raw.paystack_reference,
    memberId,
    memberName: memberName || memberId || "—",
    kind,
    year,
    allocations,
    amountKobo,
    platformChargeKobo,
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(payoutDestination ? { payoutDestination } : {}),
    status,
    late: Boolean(
      raw.late ?? raw.is_late ?? /late/i.test(raw.status_label ?? ""),
    ),
    ...(failureReason ? { failureReason } : {}),
    createdAt,
  };
}

/** Extracts transaction rows from an envelope, a paginator object or a plain array. */
function readAdminTransactionRows(payload: unknown): unknown[] {
  const data = unwrapData<unknown>(payload);
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const record = data as {
      data?: unknown;
      transactions?: unknown;
      items?: unknown;
    };
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.transactions)) return record.transactions;
    if (Array.isArray(record.items)) return record.items;
  }
  return [];
}

function readMetaNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }
  return fallback;
}

/**
 * Finds the object that carries pagination metadata. It may sit on the
 * envelope (`meta`), inside the payload (`data.meta`) or be the paginator
 * payload itself.
 */
function readMetaRecord(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  if (root.meta && typeof root.meta === "object") {
    return root.meta as Record<string, unknown>;
  }
  if ("current_page" in root || "per_page" in root || "last_page" in root) {
    return root;
  }
  const data = unwrapData<unknown>(payload);
  if (!data || typeof data !== "object") return undefined;
  const inner = data as Record<string, unknown>;
  if (inner.meta && typeof inner.meta === "object") {
    return inner.meta as Record<string, unknown>;
  }
  if ("current_page" in inner || "per_page" in inner || "last_page" in inner) {
    return inner;
  }
  return undefined;
}

/** Reads pagination plus the status counts returned with GET /admin/transactions. */
function readTransactionPageMeta(
  payload: unknown,
  fallback: PageMeta,
): TransactionPageMeta {
  const meta = readPageMeta(payload, fallback);
  const rawMeta = readMetaRecord(payload);
  const rawCounts = rawMeta?.counts;
  const counts: Record<string, unknown> =
    rawCounts && typeof rawCounts === "object"
      ? (rawCounts as Record<string, unknown>)
      : {};
  const transactionCounts: TransactionCounts = {
    all: readMetaNumber(counts.all, meta.total),
    successful: readMetaNumber(counts.successful, 0),
    pending: readMetaNumber(counts.pending, 0),
    failed: readMetaNumber(counts.failed, 0),
    late: readMetaNumber(counts.late, 0),
  };
  return { ...meta, counts: transactionCounts };
}

/** Reads the pagination metadata from an API envelope, falling back to the request page. */
function readPageMeta(payload: unknown, fallback: PageMeta): PageMeta {
  const meta = readMetaRecord(payload);
  if (!meta) return fallback;
  const read = (key: keyof PageMeta, fallbackValue: number) => {
    const value = meta[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      Number.isFinite(Number(value))
    )
      return Number(value);
    return fallbackValue;
  };
  return {
    current_page: read("current_page", fallback.current_page),
    per_page: read("per_page", fallback.per_page),
    last_page: read("last_page", fallback.last_page),
    total: read("total", fallback.total),
  };
}

/* ---------------- Interest configuration (ADM-15 to ADM-20) ---------------- */

/** Coerces an API value (numeric strings included) to a number. */
function readNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Reads the first non-empty string (or number) from a list of candidates. */
function readString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return undefined;
}

/** Reads a display name from a name string or a nested user/member object. */
function readPersonName(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  const record = asRecord(value);
  const name = readString(record.name, record.full_name, record.fullName);
  if (name) return name;
  const joined = [
    record.first_name ?? record.firstName,
    record.last_name ?? record.lastName,
  ]
    .filter(
      (part): part is string => typeof part === "string" && part.trim() !== "",
    )
    .join(" ")
    .trim();
  return joined || readString(record.email);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Reads a boolean-ish API value (`true`, `1`, `"yes"`, `"active"`). */
function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) return undefined;
  if (["false", "no", "0", "off"].includes(text)) return false;
  return true;
}

/**
 * Money from the API: `*_kobo` fields already hold kobo, every other money
 * field is a naira amount (the backend's convention).
 */
function readApiKobo(
  record: Record<string, unknown>,
  keys: string[],
): Kobo | undefined {
  for (const key of keys) {
    const raw = record[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    return (
      key.toLowerCase().includes("kobo") ? Math.round(n) : koboFromApi(n)
    ) as Kobo;
  }
  return undefined;
}

/** Members may be sent as ids or as objects with an id. */
function readIdList(value: unknown): string[] {
  return readArray(value)
    .map((item) => {
      if (typeof item === "string" || typeof item === "number")
        return String(item);
      const record = asRecord(item);
      return readString(
        record.id,
        record.member_id,
        record.memberId,
        record.code,
      );
    })
    .filter((id): id is string => Boolean(id));
}

/** Finds a list inside an envelope, a paginator or a named collection. */
function readRecordList(payload: unknown, keys: string[]): unknown[] {
  const data = unwrapData<unknown>(payload);
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  for (const key of [...keys, "data", "items", "records", "list"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  const nested = asRecord(record.data);
  for (const key of [...keys, "data", "items"]) {
    if (Array.isArray(nested[key])) return nested[key] as unknown[];
  }
  return [];
}

const INTEREST_STATUS_VALUES: readonly InterestStatus[] = [
  "Not started",
  "Draft",
  "Submitted",
  "Pending approval",
  "Returned",
  "Approved",
  "Paid out",
];

function readInterestStatus(value: unknown): InterestStatus {
  const exact = INTEREST_STATUS_VALUES.find((status) => status === value);
  if (exact) return exact;
  const text = String(value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
  if (!text) return "Not started";
  if (text.includes("not started") || text.includes("new") || text === "none") {
    return "Not started";
  }
  if (
    text.includes("paid") ||
    text.includes("disburs") ||
    text.includes("complete")
  ) {
    return "Paid out";
  }
  if (text.includes("return") || text.includes("reject")) return "Returned";
  if (text.includes("submit")) return "Submitted";
  if (text.includes("pending") || text.includes("awaiting"))
    return "Pending approval";
  if (text.includes("approv")) return "Approved";
  if (
    text.includes("draft") ||
    text.includes("progress") ||
    text.includes("active")
  ) {
    return "Draft";
  }
  return "Not started";
}

function readInterestRateMode(value: unknown): InterestRateMode {
  const text = String(value ?? "").toLowerCase();
  return text.includes("range") ||
    text.includes("band") ||
    text.includes("tier") ||
    text.includes("contrib")
    ? "Contribution ranges"
    : "Fixed rate";
}

function readInterestScope(value: unknown): InterestScope {
  const text = String(value ?? "").toLowerCase();
  return text.includes("selected") ||
    text.includes("specific") ||
    text.includes("manual") ||
    text.includes("custom")
    ? "Selected members"
    : "All members";
}

function readEligibility(value: unknown): boolean | undefined {
  const flag = readBoolean(value);
  if (flag === undefined) return undefined;
  const text = String(value ?? "").toLowerCase();
  if (text.includes("forfeit") || text.includes("ineligib")) return false;
  return flag;
}

function mapInterestBand(raw: unknown): InterestBand {
  const r = asRecord(raw);
  const minKobo =
    readApiKobo(r, [
      "minKobo",
      "min_kobo",
      "min",
      "min_contribution",
      "min_amount",
      "from_amount",
      "minimum",
      "from",
      "lower_bound",
    ]) ?? 0;
  const maxKobo =
    readApiKobo(r, [
      "maxKobo",
      "max_kobo",
      "max",
      "max_contribution",
      "max_amount",
      "to_amount",
      "maximum",
      "to",
      "upper_bound",
    ]) ?? null;
  return {
    minKobo,
    maxKobo: maxKobo != null && maxKobo > 0 ? maxKobo : null,
    rate: readNumber(r.rate, r.interest_rate, r.percentage) ?? 0,
  };
}

function mapInterestHistoryEntry(
  raw: unknown,
): [string, string, string] | null {
  if (Array.isArray(raw)) {
    return [String(raw[0] ?? ""), String(raw[1] ?? ""), String(raw[2] ?? "")];
  }
  const r = asRecord(raw);
  if (Object.keys(r).length === 0) return null;
  return [
    readString(r.at, r.created_at, r.date, r.timestamp) ?? "",
    readString(r.event, r.action, r.description, r.title) ?? "",
    readPersonName(r.actor ?? r.by ?? r.user) ??
      readString(r.actor_name, r.performed_by) ??
      "",
  ];
}

function mapInterestYearSummary(raw: unknown): InterestYearSummary {
  const r = asRecord(raw);
  const money = { ...asRecord(r.totals ?? r.summary), ...r };
  const bands = readArray(
    r.bands ?? r.contribution_ranges ?? r.ranges ?? r.tiers,
  ).map(mapInterestBand);
  const rateModeValue = r.rateMode ?? r.rate_mode ?? r.rate_type;
  const rateMode =
    rateModeValue == null
      ? bands.length > 0
        ? "Contribution ranges"
        : undefined
      : readInterestRateMode(rateModeValue);
  // The list endpoint exposes the checker through `reviewed_by` and the
  // approval timestamp on the completed `approve` stage, not as top-level
  // `checker` / `approved_at` fields.
  const approveStage = readArray(r.stages).find(
    (stage) => asRecord(stage).key === "approve",
  );
  const approvedAt =
    readString(
      approveStage &&
        readString(
          asRecord(approveStage).completed_at,
          asRecord(approveStage).completedAt,
        ),
      r.approvedAt,
      r.approved_at,
      r.approved_on,
      r.reviewed_at,
      r.reviewedAt,
    ) ?? undefined;
  const batchId =
    readString(r.batchId, r.batch_id) ??
    readString(asRecord(r.batch).id, asRecord(r.batch).batch_id);
  const summary: InterestYearSummary = {
    id:
      readString(r.id, r.config_id, r.interest_config_id, r.configuration_id) ??
      undefined,
    year: Math.trunc(
      readNumber(r.year, r.savings_year, r.config_year, r.interest_year) ?? 0,
    ),
    status: readInterestStatus(r.status ?? r.status_label ?? r.state),
    rate: readNumber(r.rate, r.interest_rate, r.percentage) ?? null,
    eligible: Math.trunc(
      readNumber(
        r.eligible,
        r.eligible_count,
        r.eligible_members,
        r.eligibleMembers,
      ) ?? 0,
    ),
    forfeited: Math.trunc(
      readNumber(
        r.forfeited,
        r.forfeited_count,
        r.forfeited_members,
        r.forfeitedMembers,
      ) ?? 0,
    ),
    contributionsKobo:
      readApiKobo(money, [
        "contributionsKobo",
        "contributions_kobo",
        "total_contributions",
        "contributions_total",
        "contributions",
        "total_savings",
        "savings_kobo",
        "savings",
      ]) ?? 0,
    interestKobo:
      readApiKobo(money, [
        "interestKobo",
        "interest_kobo",
        "total_interest",
        "interest_total",
        "interest",
        "payout_kobo",
      ]) ?? 0,
  };
  if (rateMode) summary.rateMode = rateMode;
  const maker = readPersonName(r.maker ?? r.prepared_by ?? r.created_by);
  const checker = readPersonName(
    r.reviewed_by ?? r.reviewedBy ?? r.checker ?? r.approved_by ?? r.approver,
  );
  if (maker) summary.maker = maker;
  if (checker) summary.checker = checker;
  if (approvedAt) summary.approvedAt = approvedAt;
  if (batchId) summary.batchId = batchId;
  return summary;
}

/** Reads a list of stage keys, which may arrive as strings or `{ key }` records. */
function readStringList(...values: unknown[]): string[] {
  for (const value of values) {
    const items = Array.isArray(value)
      ? value
      : typeof value === "string" && value.trim()
        ? value.split(",")
        : [];
    if (items.length === 0) continue;
    const strings = items
      .map((item) =>
        readString(item, asRecord(item).key, asRecord(item).id, asRecord(item).name),
      )
      .filter((item): item is string => Boolean(item));
    if (strings.length > 0) return [...new Set(strings)];
  }
  return [];
}

function readInterestStageStatus(value: unknown): InterestStageStatus {
  const text = readString(value)?.toLowerCase() ?? "";
  if (["completed", "complete", "done", "approved"].includes(text)) return "completed";
  if (["current", "active", "in_progress", "in-progress"].includes(text)) return "current";
  return "pending";
}

function mapInterestStage(raw: unknown): InterestStage | null {
  const r = asRecord(raw);
  const key = readString(r.key, r.stage, r.stage_key, r.name);
  if (!key) return null;
  return {
    key,
    label: readString(r.label, r.title, r.name) ?? key,
    status: readInterestStageStatus(r.status ?? r.state),
    completedAt: readString(r.completed_at, r.completedAt) ?? null,
  };
}

function mapInterestWizardStage(
  raw: unknown,
  fallbackStep: number,
): InterestWizardStage | null {
  const stage = mapInterestStage(raw);
  if (!stage) return null;
  const r = asRecord(raw);
  return {
    ...stage,
    step: Math.trunc(
      readNumber(r.step, r.step_number, r.position) ?? fallbackStep,
    ),
  };
}

function mapInterestActor(raw: unknown): InterestActor | null {
  if (raw == null) return null;
  const name = readPersonName(raw);
  if (!name) return null;
  const r = asRecord(raw);
  return {
    id: readString(r.id, r.admin_id, r.user_id, r.member_id) ?? "",
    name,
  };
}

/**
 * Calculation endpoints echo the run's totals and configuration instead of the
 * workflow's own progress fields. Treat that shape as a finished `calculate`
 * milestone so the wizard advances from the response itself.
 */
function hasInterestCalculationResult(r: Record<string, unknown>): boolean {
  const hasTotal =
    r.total_interest != null ||
    r.interest_total != null ||
    r.totalInterest != null;
  const hasCounts = r.eligible != null || r.forfeited != null;
  const hasRunConfig =
    r.period != null || r.ranges != null || r.applies_to != null;
  return hasTotal && hasCounts && hasRunConfig;
}

/** Splits API ranges such as `2026-01-01 – 2026-11-30` into two dates. */
function readInterestPeriod(value: unknown): { start: string; end: string } {
  const text = readString(value) ?? "";
  if (!text) return { start: "", end: "" };
  const parts = text
    .split(/\s*(?:[–—―]|\bto\b|\s+-\s+)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return { start: parts[0] ?? "", end: parts[1] ?? "" };
}

function mapInterestWorkflow(raw: unknown, fallbackYear = 0): InterestWorkflow {
  const r = asRecord(raw);
  const summary = mapInterestYearSummary(raw);
  const bands = readArray(
    r.bands ?? r.contribution_ranges ?? r.ranges ?? r.tiers,
  ).map(mapInterestBand);
  const rateMode =
    summary.rateMode ??
    (bands.length > 0 ? "Contribution ranges" : "Fixed rate");
  const hasCalculationResult = hasInterestCalculationResult(r);
  const serverCompletedStages = readStringList(
    r.completed_stages,
    r.completedStages,
  );
  const completedStages = hasCalculationResult
    ? [...new Set([...serverCompletedStages, "calculate"])]
    : serverCompletedStages;
  const period = readInterestPeriod(
    r.period ?? r.period_range ?? r.calculation_period,
  );
  const stages = readArray(r.stages)
    .map(mapInterestStage)
    .filter((stage): stage is InterestStage => stage != null);
  const wizardStages = readArray(r.wizard_stages ?? r.wizardStages)
    .map((stage, i) => mapInterestWizardStage(stage, i + 1))
    .filter((stage): stage is InterestWizardStage => stage != null);
  const currentStage =
    readString(r.current_stage, r.currentStage) ??
    stages.find((stage) => stage.status === "current")?.key ??
    (hasCalculationResult ? "submit" : null);
  const statusLabel = readString(r.status_label, r.statusLabel) ?? summary.status;
  const numericDone = Math.trunc(readNumber(r.done, r.stages_done) ?? 0);
  // Some responses only expose the workflow status, so derive the milestone it
  // implies instead of reporting a started configuration as "Not started".
  const statusDone =
    summary.status === "Submitted" || summary.status === "Pending approval"
      ? 4
      : summary.status === "Approved"
        ? 5
        : summary.status === "Paid out"
          ? 8
          : 0;
  const numericStage = Math.trunc(
    readNumber(r.stage, r.stage_index) ??
      Math.min(8, Math.max(numericDone, statusDone) + 1),
  );
  const selectedMemberIds = readIdList(
    r.selectedMemberIds ?? r.selected_member_ids ?? r.selected_members,
  );
  const scopeValue = r.scope ?? r.member_scope ?? r.applies_to;
  const rejectReason = readString(
    r.rejectReason,
    r.reject_reason,
    r.return_reason,
    r.returnReason,
  );
  const workflow: InterestWorkflow = {
    ...summary,
    year: summary.year || fallbackYear,
    rateMode,
    closed:
      readBoolean(r.closed ?? r.is_closed ?? r.locked ?? r.read_only) ??
      summary.status === "Paid out",
    stage: Math.max(1, Math.min(8, numericStage)),
    done: Math.max(0, Math.min(8, Math.max(numericDone, statusDone))),
    start:
      readString(r.start, r.period_start, r.start_date, r.savings_start) ??
      period.start,
    end:
      readString(r.end, r.period_end, r.end_date, r.savings_end) ?? period.end,
    close:
      readString(r.close, r.close_date, r.deadline, r.contribution_close) ?? "",
    rounding:
      readString(r.rounding, r.rounding_mode, r.rounding_rule) ??
      "Nearest naira",
    bands,
    scope:
      scopeValue == null && selectedMemberIds.length > 0
        ? "Selected members"
        : readInterestScope(scopeValue),
    selectedMemberIds,
    excludedMemberIds: readIdList(
      r.excludedMemberIds ??
        r.excluded_member_ids ??
        r.excluded_members ??
        r.exclusions,
    ),
    calc:
      readBoolean(
        r.calc ??
          r.calculated ??
          r.has_calculations ??
          r.is_calculated ??
          r.calculation_run_at,
      ) ?? hasCalculationResult,
    note: readString(r.note, r.maker_note, r.remarks) ?? "",
    ...(rejectReason ? { rejectReason } : {}),
    notified:
      readBoolean(r.notified ?? r.is_notified ?? r.notification_sent) ?? false,
    history: readArray(r.history ?? r.events ?? r.activities ?? r.timeline)
      .map(mapInterestHistoryEntry)
      .filter((entry): entry is [string, string, string] => entry !== null),
    statusLabel,
    currentStage,
    completedStages,
    stages,
    ...(wizardStages.length ? { wizardStages } : {}),
    calculationRunAt: readString(r.calculation_run_at, r.calculationRunAt) ?? null,
    createdBy: mapInterestActor(r.created_by ?? r.createdBy),
    submittedBy: mapInterestActor(r.submitted_by ?? r.submittedBy),
    reviewedBy: mapInterestActor(r.reviewed_by ?? r.reviewedBy),
    submittedAt: readString(r.submitted_at, r.submittedAt) ?? null,
    reviewedAt: readString(r.reviewed_at, r.reviewedAt) ?? null,
  };
  const progress = interestWizardProgress(workflow);
  workflow.done = progress.done;
  workflow.stage = progress.stage;
  return workflow;
}

function mapInterestCalcRow(raw: unknown): InterestCalcRow {
  const r = asRecord(raw);
  const member = asRecord(r.member ?? r.user);
  const memberId =
    readString(r.memberId, r.member_id, member.member_id, member.id) ?? "";
  const contributionsKobo =
    readApiKobo({ ...asRecord(r.totals ?? r.summary), ...r }, [
      "contributionsKobo",
      "contributions_kobo",
      "total_contributions",
      "contributions",
      "savingsKobo",
      "savings_kobo",
      "savings",
    ]) ?? 0;
  const interestKobo =
    readApiKobo({ ...asRecord(r.totals ?? r.summary), ...r }, [
      "interestKobo",
      "interest_kobo",
      "interest",
      "interest_amount",
      "total_interest",
    ]) ?? 0;
  const reason = readString(
    r.reason,
    r.forfeiture_reason,
    r.ineligible_reason,
    r.note,
  );
  const eligible =
    readEligibility(r.eligible ?? r.is_eligible ?? r.eligibility ?? r.status) ??
    !reason;
  const rate = readNumber(
    r.rate,
    r.applied_rate,
    r.interest_rate,
    r.percentage,
  );
  return {
    memberId,
    memberName:
      readPersonName(r.memberName ?? r.member_name ?? r.name ?? member) ||
      memberId ||
      "—",
    contributionsKobo,
    sharePct:
      readNumber(r.sharePct, r.share_percent, r.share_pct, r.share, r.percentage) ??
      0,
    interestKobo,
    eligible,
    ...(reason ? { reason } : {}),
    ...(rate != null ? { rate } : {}),
  };
}

function mapInterestCalculationSummary(
  raw: unknown,
): InterestCalculationSummary {
  const r = asRecord(raw);
  return {
    eligible: Math.trunc(
      readNumber(r.eligible, r.eligible_count, r.eligible_members) ?? 0,
    ),
    forfeited: Math.trunc(
      readNumber(r.forfeited, r.forfeited_count, r.forfeited_members) ?? 0,
    ),
    eligibleContributionsKobo:
      readApiKobo(r, [
        "eligible_contributions_kobo",
        "eligibleContributionsKobo",
        "eligible_contributions",
        "contributionsKobo",
        "contributions_kobo",
        "contributions",
      ]) ?? 0,
    interestKobo:
      readApiKobo(r, [
        "interest_kobo",
        "interestKobo",
        "total_interest",
        "interest",
      ]) ?? 0,
  };
}

/** Reads GET /admin/interest/:interestConfigId/entries. */
function mapInterestEntriesPayload(payload: unknown): InterestCalculationEntries {
  const data = unwrapData<unknown>(payload);
  const record = asRecord(data);
  return {
    summary: mapInterestCalculationSummary(record.summary ?? record.totals ?? data),
    entries: readArray(
      record.entries ?? record.rows ?? record.preview ?? record.calculations,
    ).map(mapInterestCalcRow),
  };
}

/** Reads `{ workflow, preview }` from whichever shape the API returns. */
function mapInterestDetail(
  payload: unknown,
  fallbackYear = 0,
): { workflow: InterestWorkflow; preview: InterestCalcRow[] } {
  const unwrapped = unwrapData<unknown>(payload);
  // Some endpoints return the configuration inside a one-item `data` array.
  const data = Array.isArray(unwrapped) ? unwrapped[0] ?? null : unwrapped;
  const record = asRecord(data);
  const workflowRaw =
    record.workflow ??
    record.interest ??
    record.configuration ??
    record.config ??
    data;
  const previewRaw =
    record.preview ??
    record.calculations ??
    record.calc_rows ??
    record.calculation_rows ??
    record.rows ??
    record.members;
  return {
    workflow: mapInterestWorkflow(workflowRaw, fallbackYear),
    preview: readArray(previewRaw).map(mapInterestCalcRow),
  };
}

/** Reads a workflow from an envelope, a `{ workflow }` wrapper or a bare payload. */
function readInterestWorkflow(payload: unknown, fallbackYear = 0) {
  const unwrapped = unwrapData<unknown>(payload);
  const data = Array.isArray(unwrapped) ? unwrapped[0] ?? null : unwrapped;
  const record = asRecord(data);
  const workflowRaw =
    record.workflow ?? record.interest ?? record.configuration ?? data;
  return mapInterestWorkflow(workflowRaw, fallbackYear);
}

function readPayoutBatchStatus(value: unknown): PayoutBatchStatus {
  const text = String(value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
  if (text.includes("return")) return "Returned to maker";
  if (text.includes("partial")) return "Partial";
  if (text.includes("process") || text.includes("disburs")) return "Processing";
  if (text.includes("complete") || text.includes("paid")) return "Completed";
  if (text.includes("approv")) return "Approved";
  return "Awaiting approval";
}

function readPayoutRowStatus(value: unknown): PayoutRowStatus {
  const text = String(value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
  if (text.includes("manual")) return "Paid manually";
  if (text.includes("retry") || text.includes("retrying")) return "Retrying";
  if (text.includes("fail") || text.includes("declin")) return "Failed";
  if (
    text.includes("paid") ||
    text.includes("success") ||
    text.includes("complete")
  ) {
    return "Paid";
  }
  return "Pending";
}

function mapPayoutRow(raw: unknown): PayoutRow {
  const r = asRecord(raw);
  const member = asRecord(r.member ?? r.user);
  const memberId =
    readString(r.memberId, r.member_id, member.member_id, member.id) ?? "";
  const money = { ...asRecord(r.totals ?? r.summary), ...r };
  const savingsKobo =
    readApiKobo(money, [
      "savingsKobo",
      "savings_kobo",
      "savings",
      "savings_amount",
      "contributionsKobo",
      "contributions_kobo",
      "contributions",
    ]) ?? 0;
  const interestKobo =
    readApiKobo(money, [
      "interestKobo",
      "interest_kobo",
      "interest",
      "interest_amount",
    ]) ?? 0;
  const totalKobo =
    readApiKobo(money, [
      "totalKobo",
      "total_kobo",
      "total",
      "total_payout",
      "amount",
    ]) ?? savingsKobo + interestKobo;
  const account =
    readString(
      r.account,
      r.payout_account_snapshot,
      r.account_number,
      r.accountNumber,
      r.destination,
      r.bank_account,
    ) ??
    [
      readString(r.bank, r.bank_name, member.bank_name),
      readString(r.account_number, r.accountNumber, member.account_number),
    ]
      .filter(Boolean)
      .join(" ");
  const reason = readString(r.reason, r.failure_reason, r.failureReason);
  return {
    memberId,
    memberName:
      readPersonName(r.memberName ?? r.member_name ?? r.name ?? member) ||
      memberId ||
      "—",
    savingsKobo,
    interestKobo,
    totalKobo,
    account,
    status: readPayoutRowStatus(r.status ?? r.status_label),
    ...(reason ? { reason } : {}),
    reference:
      readString(r.reference, r.gateway_reference, r.gatewayReference, r.id) ??
      "",
    ...(readString(r.proof, r.proof_reference, r.proof_url, r.receipt)
      ? { proof: readString(r.proof, r.proof_reference, r.proof_url, r.receipt) }
      : {}),
  };
}

function mapPayoutBatch(raw: unknown): PayoutBatch {
  const r = asRecord(raw);
  const money = { ...asRecord(r.totals ?? r.summary), ...r };
  const rows = readArray(r.rows ?? r.payouts ?? r.recipients ?? r.items).map(
    mapPayoutRow,
  );
  const checker = readPersonName(r.checker ?? r.approved_by ?? r.approver);
  const returnReason = readString(
    r.returnReason,
    r.return_reason,
    r.rejectReason,
    r.reject_reason,
  );
  const interestConfigId = readString(
    r.interestConfigId,
    r.interest_config_id,
    r.config_id,
    r.configuration_id,
    asRecord(r.interest_config).id,
    asRecord(r.interestConfiguration).id,
  );
  return {
    id: readString(r.id, r.batch_id, r.batchId, r.reference) ?? "",
    ...(interestConfigId ? { interestConfigId } : {}),
    year: Math.trunc(readNumber(r.year, r.savings_year) ?? 0),
    month: readString(r.month, r.month_name, r.period) ?? "",
    status: readPayoutBatchStatus(r.status ?? r.status_label),
    count: Math.trunc(
      readNumber(
        r.count,
        r.members_in_batch,
        r.total_members,
        r.members_count,
      ) ?? rows.length,
    ),
    savingsKobo:
      readApiKobo(money, [
        "savingsKobo",
        "savings_kobo",
        "total_savings",
        "savings",
        "contributionsKobo",
        "contributions_kobo",
        "contributions",
      ]) ?? 0,
    interestKobo:
      readApiKobo(money, [
        "interestKobo",
        "interest_kobo",
        "total_interest",
        "interest",
      ]) ?? 0,
    maker: readPersonName(r.maker ?? r.prepared_by ?? r.created_by) ?? "",
    ...(checker ? { checker } : {}),
    createdAt: readString(r.createdAt, r.created_at, r.date) ?? "",
    ...(returnReason ? { returnReason } : {}),
    rows,
    history: readArray(r.history ?? r.events ?? r.activities ?? r.timeline)
      .map(mapInterestHistoryEntry)
      .filter((entry): entry is [string, string, string] => entry !== null),
  };
}

function readPayoutBatchPayload(payload: unknown): PayoutBatch {
  const data = unwrapData<unknown>(payload);
  const record = asRecord(data);
  return mapPayoutBatch(
    record.batch ?? record.payout ?? record.payout_batch ?? data,
  );
}

/** Raw shape of the login response data from the API. */
interface LoginApiData {
  user: ApiLoginUser;
  token?: string;
  access_token?: string;
}

/** The signed-in user object returned by POST /auth/login. */
interface ApiLoginUser {
  id: string;
  member_id: string | null;
  first_name: string;
  last_name: string;
  full_name?: string | null;
  dob?: string | null;
  gender?: string | null;
  email: string;
  phone?: string | null;
  state_of_residence?: string | null;
  residential_address?: string | null;
  how_heard_about_us?: string | null;
  referred_by?: string | null;
  next_of_kin?: {
    name: string | null;
    relationship: string | null;
    phone: string | null;
  } | null;
  user_type: string;
  status: string;
  email_verified_at?: string | null;
  roles?: string[];
  permissions?: string[];
  created_at?: string | null;
  is_profile_complete?: boolean;
}

/** Maps the snake_case API user to the camelCase domain shape stored in context. */
function mapApiLoginUser(u: ApiLoginUser): unknown {
  const roles = u.roles ?? [];
  const isAdmin =
    u.user_type === "staff" ||
    u.user_type === "admin" ||
    roles.some((r) =>
      ["super-admin", "administrator", "Administrator", "SuperAdmin"].includes(
        r,
      ),
    );
  if (isAdmin) {
    const role: AdminRole = roles.some(
      (r) => r === "super-admin" || r === "SuperAdmin",
    )
      ? "SuperAdmin"
      : "Administrator";
    // Build the domain object explicitly. Spreading the API payload here would
    // store both snake_case and camelCase copies of the same field.
    const status = (u.status ?? "").toLowerCase();
    return {
      kind: "admin",
      id: u.id,
      name: u.full_name ?? `${u.first_name} ${u.last_name}`,
      email: u.email,
      role,
      status:
        status === "invited"
          ? "Invited"
          : status === "deactivated"
            ? "Deactivated"
            : "Active",
    };
  }
  return {
    kind: "member",
    id: u.member_id ?? u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    gender: "Female" as const,
    dateOfBirth: u.dob ?? "",
    email: u.email,
    phone: u.phone ?? "",
    stateOfResidence: u.state_of_residence ?? "",
    address: u.residential_address ?? "",
    nextOfKin: {
      name: u.next_of_kin?.name ?? "",
      relationship: u.next_of_kin?.relationship ?? "",
      phone: u.next_of_kin?.phone ?? "",
    },
    status:
      (u.status ?? "").toLowerCase() === "active" ? "Active" : "Suspended",
    // joinedOn is the account's join date, not the member's date of birth.
    joinedOn: u.created_at?.slice(0, 10) ?? u.dob ?? "",
    referredBy: u.referred_by ?? undefined,
    community: "Locked" as const,
    onboarding: "PayoutAccount" as const,
    isProfileComplete: Boolean(u.is_profile_complete),
  };
}

/** Builds a typed Session from the mapped user object. */
function buildLoginSession(user: unknown): Session {
  const u = user as { kind: string };
  if (u.kind === "admin") return { kind: "admin", admin: user as AdminUser };
  return { kind: "member", member: user as Member };
}

export class HttpAuthRepository implements AuthRepository {
  constructor(
    private readonly http: HttpClient,
    private readonly onToken: (t: string | null) => void,
  ) {}

  async login(identifier: string, password: string) {
    let envelope: ApiEnvelope<LoginApiData>;
    try {
      envelope = await this.http.post<ApiEnvelope<LoginApiData>>(
        "/auth/login",
        { login: identifier, password },
      );
    } catch (error) {
      rethrowWithFieldErrors(error);
    }
    const data = envelope.data!;
    const token = data.token ?? data.access_token ?? "";
    this.onToken(token);

    const apiUser = data.user;
    const mappedUser = mapApiLoginUser(apiUser);
    const session = buildLoginSession(mappedUser);
    // `user` stays in the API's snake_case shape for persistence; `session` is
    // the mapped domain object the rest of the app consumes.
    return { session, token, user: apiUser };
  }

  async logout() {
    await this.http.post("/auth/logout");
    this.onToken(null);
  }
  async requestPasswordReset(identifier: string) {
    await this.http.post("/auth/password-reset", { identifier });
  }
}

interface ApiNextOfKin {
  name: string;
  relationship: string;
  phone: string;
}
interface ApiRegUser {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  next_of_kin?: ApiNextOfKin;
}
interface ApiVerification {
  expires_at: string;
  resend_available_in_seconds: number;
}
interface RegisterApiData {
  user: ApiRegUser;
  verification?: ApiVerification;
}
interface VerifyEmailApiData {
  token?: string;
  access_token?: string;
}

export class HttpRegistrationRepository implements RegistrationRepository {
  constructor(
    private readonly http: HttpClient,
    private readonly onToken: (t: string | null) => void,
  ) {}

  async start(details: RegistrationDetails): Promise<RegistrationStarted> {
    // Normalise phone: convert leading 0 to +234 (e.g. 08031234567 → +2348031234567)
    const phone = details.phone.startsWith("0")
      ? `+234${details.phone.slice(1)}`
      : details.phone;
    const envelope = await this.http.post<ApiEnvelope<RegisterApiData>>(
      "/auth/member/register",
      {
        first_name: details.firstName,
        last_name: details.lastName,
        dob: details.dateOfBirth,
        gender: "female",
        email: details.email,
        phone,
        state_of_residence: details.stateOfResidence,
        residential_address: details.address,
        how_heard_about_us: details.heardAboutUs,
        referred_by: details.referredBy || undefined,
      },
    );
    const data = envelope.data;
    return {
      emailSent: true,
      message: envelope.message,
      user: data?.user
        ? {
            id: data.user.id,
            memberId: data.user.member_id,
            firstName: data.user.first_name,
            lastName: data.user.last_name,
            email: data.user.email,
            phone: data.user.phone,
            status: data.user.status,
          }
        : undefined,
      verification: data?.verification
        ? {
            expiresAt: data.verification.expires_at,
            resendAvailableInSeconds:
              data.verification.resend_available_in_seconds,
          }
        : undefined,
    };
  }

  async resendEmailCode(email: string): Promise<RegistrationStarted> {
    const envelope = await this.http.post<ApiEnvelope<RegisterApiData>>(
      "/registrations/resend-code",
      { email },
    );
    return {
      emailSent: true,
      message: envelope.message,
    };
  }

  async verifyEmailCode(email: string, code: string): Promise<boolean> {
    const envelope = await this.http.post<ApiEnvelope<VerifyEmailApiData>>(
      "/auth/member/register/verify-email",
      { email, code },
    );
    const token = envelope.data?.token ?? envelope.data?.access_token;
    if (token) this.onToken(token);
    return envelope.success;
  }

  async submit(r: NewRegistration): Promise<Registration> {
    return this.http.post<Registration>("/auth/member/register/complete", {
      first_name: r.firstName,
      last_name: r.lastName,
      next_of_kin_name: r.nextOfKin.name,
      relationship: r.nextOfKin.relationship,
      next_of_kin_phone: r.nextOfKin.phone,
      password: r.password,
      password_confirmation: r.password,
    });
  }
}
/** Bank record returned by GET /payout-account/banks. */
interface ApiBank {
  name: string;
  code: string;
  active?: boolean;
  is_deleted?: boolean;
}

/** Payout account record returned by POST /payout-account. */
interface ApiPayoutAccount {
  bank_code?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  verified_at?: string;
}

export class HttpPayoutAccountRepository implements PayoutAccountRepository {
  constructor(private readonly http: HttpClient) {}
  async listBanks(): Promise<Bank[]> {
    const payload = await this.http.get<ApiEnvelope<ApiBank[]> | ApiBank[]>(
      "/payout-account/banks",
    );
    const banks = unwrapData(payload) ?? [];
    return banks
      .filter((b) => b.active !== false && !b.is_deleted)
      .map((b) => ({ name: b.name, code: b.code }));
  }
  async savePayoutAccount(
    _id: string,
    a: { bankCode: string; bankName: string; accountNumber: string },
  ): Promise<PayoutAccount> {
    const payload = await this.http.post<
      ApiEnvelope<ApiPayoutAccount> | ApiPayoutAccount
    >("/payout-account", {
      bank_code: a.bankCode,
      account_number: a.accountNumber,
    });
    const saved = unwrapData(payload);
    return {
      bankCode: saved?.bank_code ?? a.bankCode,
      bankName: saved?.bank_name ?? a.bankName,
      accountNumber: saved?.account_number ?? a.accountNumber,
      accountName: saved?.account_name ?? "",
      verifiedAt: saved?.verified_at,
    };
  }
  async resolveAccountName(bankCode: string, accountNumber: string) {
    return (
      await this.http.get<{ accountName: string }>(
        `/banks/${bankCode}/resolve?account=${accountNumber}`,
      )
    ).accountName;
  }
}

export class HttpSavingsTargetRepository implements SavingsTargetRepository {
  constructor(private readonly http: HttpClient) {}
  async setTarget(_memberId: string, _year: number, amountKobo: Kobo) {
    // The API expresses the target in naira; the domain keeps money in kobo.
    await this.http.post("/savings/target", {
      target_amount: Math.round(amountKobo / 100),
    });
  }
}

/** Raw savings month record returned by GET /savings/months. */
interface ApiSavingsMonth {
  id: string | null;
  year: number;
  month: number;
  period: string;
  month_name: string;
  status: string;
  status_label: string;
  target_amount: string | number | null;
  saved_amount: string | number;
  remaining_amount: string | number;
  progress_percentage: number | null;
  target_met: boolean;
  contributions_count: number;
  close_note: string;
  deadline: string;
}
/** Raw period record returned by GET /savings. */
interface ApiSavingsPeriod {
  year: number;
  month: number;
  period: string;
  month_name: string;
  deadline: string;
}

/** Raw dashboard record returned by GET /savings. */
interface ApiSavingsDashboard {
  active_month: ApiSavingsPeriod | null;
  next_period: ApiSavingsPeriod | null;
  summary: {
    year: number;
    saved_this_year: string;
    total_saved: string;
    total_months: number;
    months_target_met: number;
    defaulted_months: number;
    streak: number;
  };
  payout_journey: {
    year: number;
    payout_date: string;
    steps: {
      step: number;
      title: string;
      description: string;
      completed: boolean;
      active: boolean;
    }[];
  };
  settings: {
    minimum_per_payment: string;
    platform_charge_per_payment: string;
  };
}

/** The API expresses money in naira strings; the domain keeps integer kobo. */
const koboFromApi = (value: string | number | null | undefined): Kobo =>
  naira(Number(value ?? 0));

function mapSavingsPeriod(p: ApiSavingsPeriod): SavingsPeriod {
  return {
    year: p.year,
    month: p.month,
    period: p.period,
    monthName: p.month_name,
    deadline: p.deadline,
  };
}

function mapSavingsMonth(m: ApiSavingsMonth): SavingsMonth {
  return {
    id: m.id,
    year: m.year,
    month: m.month,
    period: m.period,
    monthName: m.month_name,
    status: m.status,
    statusLabel: m.status_label,
    targetAmount: m.target_amount == null ? null : koboFromApi(m.target_amount),
    savedAmount: koboFromApi(m.saved_amount),
    remainingAmount: koboFromApi(m.remaining_amount),
    progressPercentage: m.progress_percentage,
    targetMet: m.target_met,
    contributionsCount: m.contributions_count,
    closeNote: m.close_note,
    deadline: m.deadline,
  };
}

function mapSavingsDashboard(d: ApiSavingsDashboard): SavingsDashboard {
  return {
    activeMonth: d.active_month ? mapSavingsPeriod(d.active_month) : null,
    nextPeriod: d.next_period ? mapSavingsPeriod(d.next_period) : null,
    summary: {
      year: d.summary.year,
      savedThisYear: koboFromApi(d.summary.saved_this_year),
      totalSaved: koboFromApi(d.summary.total_saved),
      totalMonths: d.summary.total_months,
      monthsTargetMet: d.summary.months_target_met,
      defaultedMonths: d.summary.defaulted_months,
      streak: d.summary.streak,
    },
    payoutJourney: {
      year: d.payout_journey.year,
      payoutDate: d.payout_journey.payout_date,
      steps: d.payout_journey.steps.map((s) => ({
        step: s.step,
        title: s.title,
        description: s.description,
        completed: s.completed,
        active: s.active,
      })),
    },
    settings: {
      minimumPerPayment: koboFromApi(d.settings.minimum_per_payment),
      platformChargePerPayment: koboFromApi(
        d.settings.platform_charge_per_payment,
      ),
    },
  };
}

export class HttpSavingsDashboardRepository implements SavingsDashboardRepository {
  constructor(private readonly http: HttpClient) {}
  async get(): Promise<SavingsDashboard> {
    const payload = await this.http.get<
      ApiEnvelope<ApiSavingsDashboard> | ApiSavingsDashboard
    >("/savings");
    const data = unwrapData(payload);
    if (!data)
      throw new Error("Your savings dashboard is unavailable right now.");
    return mapSavingsDashboard(data);
  }
  async getMonths(year: number): Promise<SavingsMonth[]> {
    const payload = await this.http.get<
      ApiEnvelope<ApiSavingsMonth[]> | ApiSavingsMonth[]
    >(`/savings/months?year=${year}`);
    const data = unwrapData(payload);
    return (data ?? []).map(mapSavingsMonth);
  }
}

interface ApiActivityItem {
  kind?: string;
  created_at?: string;
  data?: {
    id?: string;
    reference?: string;
    amount?: string;
    platform_charge?: string;
    net_amount?: string;
    channel?: string;
    status?: string;
    status_label?: string;
    gateway_reference?: string;
    confirmed_at?: string | null;
    savings_month?: {
      id?: string;
      period?: string;
      month_name?: string;
      status?: string;
    };
    created_at?: string;
  };
}

function mapActivityItem(item: ApiActivityItem): Transaction {
  const d =
    item.data ?? (item as unknown as NonNullable<ApiActivityItem["data"]>);
  const kind: Transaction["kind"] =
    (item.kind ?? "").toLowerCase() === "payout" ? "Payout" : "Contribution";

  const period = d.savings_month?.period ?? "";
  const periodMatch = /^(\d{4})-(\d{2})$/.exec(period);
  const createdAt = d.created_at || item.created_at || new Date().toISOString();
  const year = periodMatch
    ? Number(periodMatch[1])
    : new Date(createdAt).getFullYear() || new Date().getFullYear();

  let monthIndex: MonthIndex = 0;
  if (periodMatch) {
    monthIndex = Math.max(
      0,
      Math.min(11, Number(periodMatch[2]) - 1),
    ) as MonthIndex;
  } else if (d.savings_month?.month_name) {
    const idx = MONTHS.findIndex(
      (m) => m.toLowerCase() === d.savings_month!.month_name!.toLowerCase(),
    );
    if (idx >= 0) monthIndex = idx as MonthIndex;
  }

  const amountKobo = koboFromApi(d.amount ?? d.net_amount);
  const platformChargeKobo = koboFromApi(d.platform_charge);
  const netKobo = koboFromApi(d.net_amount) || amountKobo;

  const statusLower = (d.status ?? "").toLowerCase();
  let status: TransactionStatus = "Pending";
  if (["confirmed", "successful", "paid", "completed"].includes(statusLower)) {
    status = "Successful";
  } else if (statusLower === "processing") {
    status = "Processing";
  } else if (
    ["failed", "declined", "cancelled", "abandoned"].includes(statusLower)
  ) {
    status = "Failed";
  }

  const channelLower = (d.channel ?? "").toLowerCase();
  let paymentMethod: ContributionPaymentMethod = "Online";
  if (channelLower === "wallet") paymentMethod = "Wallet";
  else if (
    channelLower === "bank" ||
    channelLower === "bank_transfer" ||
    channelLower === "bank account"
  ) {
    paymentMethod = "Bank Account";
  }

  return {
    id: d.id || d.reference || `TX-${Date.now()}`,
    reference: d.reference || d.id || "",
    gatewayReference: d.gateway_reference || undefined,
    memberId: "",
    memberName: "",
    kind,
    year,
    allocations:
      kind === "Contribution"
        ? [{ month: monthIndex, amountKobo: netKobo }]
        : [],
    amountKobo,
    platformChargeKobo,
    paymentMethod,
    status,
    late: false,
    createdAt,
  };
}

export class HttpMemberRepository implements MemberRepository {
  private readonly txCache = new Map<string, Transaction>();
  constructor(private readonly http: HttpClient) {}
  getMember(id: string) {
    return this.http.get<Member>(`/members/${id}`);
  }
  getSavingsYear(id: string, year: number) {
    return this.http.get<SavingsYear>(`/members/${id}/savings/${year}`);
  }
  setTarget(
    id: string,
    year: number,
    month: MonthIndex | null,
    amountKobo: Kobo,
    applyToFollowing: boolean,
  ) {
    return this.http.put<SavingsYear>(`/members/${id}/savings/${year}/target`, {
      month,
      amountKobo,
      applyToFollowing,
    });
  }
  lockMonth(id: string, year: number, month: MonthIndex) {
    return this.http.post<SavingsYear>(
      `/members/${id}/savings/${year}/months/${month}/lock`,
    );
  }
  async markCommunityJoined(id: string) {
    await this.http.post(`/members/${id}/community/joined`);
  }
  async requestChange(
    id: string,
    field: ChangeField,
    newValue: string,
    reason: string,
  ) {
    await this.http.post(`/members/${id}/change-requests`, {
      field,
      newValue,
      reason,
    });
  }
  async completeOnboarding(id: string) {
    await this.http.post(`/members/${id}/onboarding/complete`);
  }
  async listActivity(params: ActivityQuery = {}): Promise<ActivityPageResult> {
    const p = new URLSearchParams();
    if (params.filter) p.set("filter", params.filter);
    if (params.search?.trim()) p.set("search", params.search.trim());
    if (params.per_page) p.set("per_page", String(params.per_page));
    if (params.page) p.set("page", String(params.page));
    const qs = p.toString();
    const payload = await this.http.get<
      ApiEnvelope<ApiActivityItem[]> | ApiActivityItem[]
    >(`/activity${qs ? `?${qs}` : ""}`);
    const rawItems = unwrapData(payload) ?? [];
    const data = rawItems.map(mapActivityItem);
    for (const tx of data) {
      this.txCache.set(tx.id, tx);
    }
    const perPage = params.per_page ?? 15;
    const page = params.page ?? 1;
    return {
      data,
      meta: readPageMeta(payload, {
        current_page: page,
        per_page: perPage,
        last_page: 1,
        total: data.length,
      }),
    };
  }
  async listTransactions(_id: string): Promise<Transaction[]> {
    const res = await this.listActivity({ page: 1 });
    const merged = new Map<string, Transaction>(this.txCache);
    for (const tx of res.data) merged.set(tx.id, tx);
    return Array.from(merged.values());
  }
  listNotifications(id: string) {
    return this.http.get<MemberNotification[]>(`/members/${id}/notifications`);
  }
  requestPayout(id: string, year: number, destination: PayoutDestination) {
    return this.http.post<Transaction>(`/members/${id}/payouts`, {
      year,
      destination,
    });
  }
  markPayoutReceived(id: string, transactionId: string) {
    return this.http.post<Transaction>(
      `/members/${id}/payouts/${transactionId}/received`,
    );
  }
}
export class HttpContributionRepository implements ContributionRepository {
  constructor(private readonly http: HttpClient) {}

  async initiate(
    memberId: string,
    year: number,
    amountKobo: Kobo,
    method: ContributionPaymentMethod = "Online",
  ): Promise<ContributionIntent> {
    void memberId;
    void year;
    void method;

    const amountStr = (amountKobo / 100).toFixed(2);
    const payload = await this.http.post<
      | ApiEnvelope<{
          contribution?: { reference?: string; id?: string };
          payment?: {
            authorization_url?: string;
            reference?: string;
            access_code?: string;
            status?: string;
          };
          authorization_url?: string;
          url?: string;
          access_code?: string;
          reference?: string;
        }>
      | {
          contribution?: { reference?: string; id?: string };
          payment?: {
            authorization_url?: string;
            reference?: string;
            access_code?: string;
            status?: string;
          };
          authorization_url?: string;
          url?: string;
          access_code?: string;
          reference?: string;
        }
    >("/savings/contributions", {
      amount: amountStr,
      channel: "paystack",
    });

    const data = unwrapData(payload);
    const payment = data?.payment;
    const authUrl =
      payment?.authorization_url || data?.authorization_url || data?.url;
    const ref =
      payment?.reference ||
      data?.contribution?.reference ||
      data?.reference ||
      data?.access_code ||
      `REF-${Date.now()}`;

    return {
      reference: ref,
      amountKobo,
      platformChargeKobo: 0,
      allocations: [],
      email: "",
      authorizationUrl: authUrl,
      accessCode: payment?.access_code || data?.access_code,
    };
  }

  async verify(reference: string): Promise<VerifiedContribution> {
    try {
      const payload = await this.http.post<
        | ApiEnvelope<{
            contribution?: {
              id?: string;
              reference?: string;
              amount?: string;
              platform_charge?: string;
              net_amount?: string;
              channel?: string;
              status?: string;
              status_label?: string;
              gateway_reference?: string;
              confirmed_at?: string;
              savings_month?: {
                id?: string;
                period?: string;
                month_name?: string;
                status?: string;
              };
              created_at?: string;
            };
            savings_month?: {
              id?: string;
              year?: number;
              month?: number;
              period?: string;
              month_name?: string;
              target_amount?: string;
              saved_amount?: string;
              remaining_amount?: string;
              progress_percentage?: number;
              target_met?: boolean;
              status?: string;
            };
            target_met?: boolean;
          }>
        | {
            contribution?: {
              id?: string;
              reference?: string;
              amount?: string;
              platform_charge?: string;
              net_amount?: string;
              channel?: string;
              status?: string;
              status_label?: string;
              gateway_reference?: string;
              confirmed_at?: string;
              savings_month?: {
                id?: string;
                period?: string;
                month_name?: string;
                status?: string;
              };
              created_at?: string;
            };
            savings_month?: {
              id?: string;
              year?: number;
              month?: number;
              period?: string;
              month_name?: string;
              target_amount?: string;
              saved_amount?: string;
              remaining_amount?: string;
              progress_percentage?: number;
              target_met?: boolean;
              status?: string;
            };
            target_met?: boolean;
          }
      >(`/savings/contributions/${reference}/verify`);

      const data = unwrapData(payload);
      const c = data?.contribution;
      const sm = data?.savings_month;

      const totalAmountKobo = koboFromApi(c?.amount);
      const netAmountKobo = koboFromApi(c?.net_amount);
      const chargeKobo = koboFromApi(c?.platform_charge);
      const monthName =
        sm?.month_name || c?.savings_month?.month_name || "January";
      const year = sm?.year || 2027;
      const monthIndex = (sm?.month ? sm.month - 1 : 0) as MonthIndex;

      const statusStr = (c?.status || "").toLowerCase();
      let txStatus: TransactionStatus = "Processing";
      if (statusStr === "confirmed" || statusStr === "successful") {
        txStatus = "Successful";
      } else if (
        statusStr === "failed" ||
        statusStr === "declined" ||
        statusStr === "cancelled" ||
        statusStr === "abandoned"
      ) {
        txStatus = "Failed";
      }

      const failureReason =
        txStatus === "Failed"
          ? c?.status_label ||
            (payload as { message?: string })?.message ||
            "Declined by your bank: insufficient funds."
          : undefined;

      const tx: Transaction = {
        id: c?.id || reference,
        reference: c?.reference || reference,
        gatewayReference: c?.gateway_reference,
        memberId: "",
        memberName: "",
        kind: "Contribution",
        year,
        allocations: [
          { month: monthIndex, amountKobo: netAmountKobo || totalAmountKobo },
        ],
        amountKobo: totalAmountKobo || netAmountKobo,
        platformChargeKobo: chargeKobo,
        status: txStatus,
        failureReason,
        late: false,
        createdAt: c?.created_at || new Date().toISOString(),
        paymentMethod: "Online",
      };

      return {
        transaction: tx,
        communityUnlocked: false,
        savingsMonth: {
          monthName,
          year,
          savedAmount: netAmountKobo || totalAmountKobo,
          targetAmount: koboFromApi(sm?.target_amount),
        },
        targetMet: data?.target_met || sm?.target_met || false,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      const tx: Transaction = {
        id: reference,
        reference,
        memberId: "",
        memberName: "",
        kind: "Contribution",
        year: new Date().getFullYear(),
        allocations: [],
        amountKobo: 0,
        platformChargeKobo: 0,
        status: "Failed",
        failureReason:
          msg ||
          "Declined by your bank: insufficient funds. No money was taken and nothing was added to your savings.",
        late: false,
        createdAt: new Date().toISOString(),
        paymentMethod: "Online",
      };
      return { transaction: tx, communityUnlocked: false };
    }
  }

  payFromWallet(memberId: string, year: number, amountKobo: Kobo) {
    return this.http.post<VerifiedContribution>("/contributions/wallet", {
      memberId,
      year,
      amountKobo,
    });
  }
  confirmBankTransfer(memberId: string, year: number, amountKobo: Kobo) {
    return this.http.post<VerifiedContribution>(
      "/contributions/bank-transfer",
      { memberId, year, amountKobo },
    );
  }
}
export class HttpSettingsRepository implements SettingsRepository {
  constructor(private readonly http: HttpClient) {}
  get() {
    return this.http.get<PlatformSettings>("/settings/platform");
  }
  save(patch: {
    minimumByYear?: Record<number, Kobo>;
    cutoffMonth?: MonthIndex;
    payoutDates?: Record<number, string>;
  }) {
    return this.http.put<PlatformSettings>("/settings/platform", patch);
  }
}
export class HttpTestimonialRepository implements TestimonialRepository {
  constructor(private readonly http: HttpClient) {}
  listPublished() {
    return this.http.get<Testimonial[]>(
      "/content/testimonials?status=Published",
    );
  }
  listAll() {
    return this.http.get<Testimonial[]>("/content/testimonials");
  }
  save(t: {
    id?: string;
    name: string;
    descriptor: string;
    quote: string;
    status: Testimonial["status"];
  }) {
    return t.id
      ? this.http.put<Testimonial>(`/content/testimonials/${t.id}`, t)
      : this.http.post<Testimonial>("/content/testimonials", t);
  }
  setStatus(id: string, status: Testimonial["status"]) {
    return this.http.post<Testimonial>(`/content/testimonials/${id}/status`, {
      status,
    });
  }
  move(id: string, direction: -1 | 1) {
    return this.http.post<Testimonial[]>(`/content/testimonials/${id}/move`, {
      direction,
    });
  }
  async remove(id: string) {
    await this.http.post(`/content/testimonials/${id}/delete`);
  }
}
export class HttpAdminRepository implements AdminRepository {
  constructor(private readonly http: HttpClient) {}
  async dashboard(year: number) {
    interface ApiDashboard {
      year: number;
      total_members: number;
      new_this_month: number;
      active_savers: number;
      active_savers_percent: number;
      total_savings: string;
      pending_payments: number;
      current_month_compliance?: {
        month: number;
        month_name: string;
        due_date: string;
        paid: number;
        not_paid: number;
        of: number;
      };
      monthly_compliance: {
        month: number;
        month_name: string;
        paid: number;
        not_paid: number;
      }[];
      interest_eligibility: {
        eligible: number | null;
        forfeited: number | null;
        late_payments: number;
        missed_months: number;
      };
      interest: {
        status: string | null;
        status_label: string;
        rate: number | null;
        id: string | null;
        payout_batch: string | null;
      };
      failed_payments: {
        member: string;
        covers: string;
        amount: string;
        reason: string;
      }[];
      recent_activity: {
        action: string;
        record: string;
        actor: string;
        type: string;
        created_at: string;
      }[];
    }
    const envelope = await this.http.get<ApiEnvelope<ApiDashboard>>(
      `/admin/dashboard?year=${year}`,
    );
    const d = envelope.data!;
    return {
      year: d.year,
      members: d.total_members,
      newThisMonth: d.new_this_month,
      activeSavers: d.active_savers,
      activeSaversPercent: d.active_savers_percent,
      totalSavingsKobo: Math.round(parseFloat(d.total_savings || "0") * 100),
      pendingPayments: d.pending_payments,
      currentMonthCompliance: d.current_month_compliance
        ? {
            month: d.current_month_compliance.month,
            monthName: d.current_month_compliance.month_name,
            dueDate: d.current_month_compliance.due_date,
            paid: d.current_month_compliance.paid,
            notPaid: d.current_month_compliance.not_paid,
            of: d.current_month_compliance.of,
          }
        : undefined,
      monthlyPaid: d.monthly_compliance.map((m) => ({
        month: m.month,
        monthName: m.month_name,
        paid: m.paid,
        due: m.not_paid,
      })),
      interestEligibility: {
        eligible: d.interest_eligibility.eligible,
        forfeited: d.interest_eligibility.forfeited,
        latePayments: d.interest_eligibility.late_payments,
        missedMonths: d.interest_eligibility.missed_months,
      },
      interest: {
        status: d.interest.status,
        statusLabel: d.interest.status_label,
        rate: d.interest.rate,
        id: d.interest.id,
        payoutBatch: d.interest.payout_batch,
      },
      failedPayments: (d.failed_payments ?? []).map((item) => ({
        member: item.member,
        covers: item.covers,
        amountKobo: Math.round(parseFloat(item.amount || "0") * 100),
        reason: item.reason,
      })),
      recentActivity: (d.recent_activity ?? []).map((item) => ({
        action: item.action,
        record: item.record,
        actor: item.actor,
        type: item.type,
        createdAt: item.created_at,
      })),
    };
  }
  async listMembers(q: MemberQuery): Promise<MemberListPage> {
    const p = new URLSearchParams({
      tab: q.tab,
      search: q.search,
      ...(q.status ? { status: q.status } : {}),
      ...(q.eligibility ? { eligibility: q.eligibility } : {}),
      ...(q.joinedYear ? { joinedYear: q.joinedYear } : {}),
      ...(q.baseline ? { baseline: q.baseline } : {}),
      ...(q.referred !== undefined ? { referred: String(q.referred) } : {}),
    });
    if (q.page && q.page > 1) p.set("page", String(q.page));
    const payload = await this.http.get<
      ApiEnvelope<(ApiMember | MemberListRow)[]> | (ApiMember | MemberListRow)[]
    >(`/admin/members?${p}`);
    const data = unwrapData(payload) ?? [];
    const perPage = 20;
    const page = q.page ?? 1;
    return {
      data: data.map(mapAdminMemberRow),
      meta: readPageMeta(payload, {
        current_page: page,
        per_page: perPage,
        last_page: Math.max(1, Math.ceil(data.length / perPage)),
        total: data.length,
      }),
    };
  }
  async countMembers(): Promise<Record<MemberQuery["tab"], number>> {
    const payload = await this.http.get<
      | ApiEnvelope<Record<MemberQuery["tab"], number>>
      | Record<MemberQuery["tab"], number>
    >("/admin/members/counts");
    return (
      unwrapData(payload) ?? {
        All: 0,
        Active: 0,
        Suspended: 0,
        NotPaid: 0,
        Forfeited: 0,
      }
    );
  }
  listRegistrations() {
    return this.http.get<Registration[]>("/admin/registrations");
  }
  async listAllMembers(
    params: { search?: string; status?: ApiMemberStatus; page?: number } = {},
  ): Promise<ApiMemberPage> {
    const p = new URLSearchParams();
    if (params.search) p.set("search", params.search);
    if (params.status) p.set("status", params.status);
    if (params.page && params.page > 1) p.set("page", String(params.page));
    const query = p.toString();
    const envelope = await this.http.get<ApiEnvelope<ApiMember[]>>(
      `/admin/members${query ? `?${query}` : ""}`,
    );
    return {
      data: envelope.data ?? [],
      meta: (envelope as unknown as { meta: ApiMemberPage["meta"] }).meta ?? {
        current_page: 1,
        per_page: 15,
        last_page: 1,
        total: 0,
      },
    };
  }
  decideRegistration(
    id: string,
    decision: "Approved" | "Rejected",
    reason?: string,
  ) {
    return this.http.post<Registration>(`/admin/registrations/${id}/decision`, {
      decision,
      reason,
    });
  }
  async approveMember(id: string): Promise<ApiMember> {
    const envelope = await this.http.post<ApiEnvelope<ApiMember>>(
      `/admin/members/${id}/approve`,
    );
    return envelope.data!;
  }
  async rejectMember(id: string, reason: string): Promise<ApiMember> {
    const envelope = await this.http.post<ApiEnvelope<ApiMember>>(
      `/admin/members/${id}/reject`,
      { reason },
    );
    return envelope.data!;
  }
  savingsOverview(year: number) {
    return this.http.get<{
      rows: MemberSummary[];
      monthly: { month: string; members: number }[];
    }>(`/admin/savings?year=${year}`);
  }
  listTransactions(): Promise<Transaction[]>;
  listTransactions(query: TransactionQuery): Promise<TransactionListPage>;
  async listTransactions(
    query?: TransactionQuery,
  ): Promise<Transaction[] | TransactionListPage> {
    const p = new URLSearchParams();
    if (query?.status && query.status !== "All") {
      p.set("status", query.status.toLowerCase());
    }
    if (query?.kind && query.kind !== "All") {
      p.set("type", query.kind.toLowerCase());
    }
    if (query?.range && query.range !== "all") {
      p.set("range", query.range);
    }
    if (query?.search?.trim()) p.set("search", query.search.trim());
    if (query?.page && query.page > 1) p.set("page", String(query.page));

    const qs = p.toString();
    const payload = await this.http.get<unknown>(
      `/admin/transactions${qs ? `?${qs}` : ""}`,
    );
    const data = readAdminTransactionRows(payload).map((row) =>
      mapAdminTransaction(row as ApiAdminTransaction),
    );

    if (!query) return data;
    return {
      data,
      meta: readTransactionPageMeta(payload, {
        current_page: query.page ?? 1,
        per_page: 20,
        last_page: Math.max(1, Math.ceil(data.length / 20)),
        total: data.length,
      }),
    };
  }
  listInterest() {
    return this.http.get<unknown>("/admin/interest").then((payload) =>
      readRecordList(payload, ["years", "interest_years", "interestYears"])
        .map(mapInterestYearSummary)
        .filter((year) => year.year > 0),
    );
  }
  getInterest(interestConfigId: number | string) {
    return this.http
      .get<unknown>(
        `/admin/interest/${encodeURIComponent(String(interestConfigId))}`,
      )
      .then((payload) =>
        mapInterestDetail(payload, Number(interestConfigId) || 0),
      );
  }
  createInterestConfig(payload: {
    year: number;
    savings_start: string;
    savings_end: string;
    contribution_close: string;
    rate: number;
    rounding: string;
    applies_to: string;
    proportional_basis: boolean;
    rate_type?: "fixed" | "range";
    ranges?: {
      from_amount: number | null;
      to_amount: number | null;
      rate: number;
    }[];
    member_ids?: string[];
  }) {
    return this.http
      .post<unknown>("/admin/interest", payload)
      .then((response) => {
        const data = unwrapData<unknown>(response);
        const record = asRecord(data);
        const workflowRaw =
          record.workflow ?? record.interest ?? record.configuration ?? data;
        return mapInterestWorkflow(workflowRaw, payload.year);
      });
  }
  saveInterestPeriod(
    year: number,
    period: { start: string; end: string; close: string },
  ) {
    return this.http
      .put<unknown>(`/admin/interest/${year}/period`, period)
      .then((payload) => readInterestWorkflow(payload, year));
  }
  saveInterestRules(year: number, rules: InterestRulesInput) {
    return this.http
      .put<unknown>(`/admin/interest/${year}/rules`, rules)
      .then((payload) => readInterestWorkflow(payload, year));
  }
  saveInterestConfig(
    interestConfigId: number | string,
    config: {
      savings_start: string;
      savings_end: string;
      contribution_close: string;
      rate: number;
      rounding: string;
      applies_to: string;
      proportional_basis: boolean;
    },
  ) {
    return this.http
      .patch<unknown>(
        `/admin/interest/${encodeURIComponent(String(interestConfigId))}`,
        config,
      )
      .then((payload) =>
        readInterestWorkflow(payload, Number(interestConfigId) || 0),
      );
  }
  setInterestExclusions(year: number, memberIds: string[]) {
    return this.http
      .put<unknown>(`/admin/interest/${year}/exclusions`, { memberIds })
      .then((payload) => readInterestWorkflow(payload, year));
  }
  runInterestCalculation(interestConfigId: number | string) {
    return this.http
      .post<unknown>(
        `/admin/interest/${encodeURIComponent(String(interestConfigId))}/calculate`,
      )
      .then((payload) =>
        readInterestWorkflow(payload, Number(interestConfigId) || 0),
      );
  }
  getInterestEntries(interestConfigId: number | string) {
    return this.http
      .get<unknown>(
        `/admin/interest/${encodeURIComponent(String(interestConfigId))}/entries`,
      )
      .then(mapInterestEntriesPayload);
  }
  getInterestPayouts(
    interestConfigId: number | string,
    batch: { id?: string; year?: number; month?: string } = {},
  ) {
    return this.http
      .get<unknown>(
        `/admin/interest/${encodeURIComponent(String(interestConfigId))}/payouts`,
      )
      .then((payload) => {
        const data = asRecord(unwrapData<unknown>(payload));
        const year =
          batch.year ??
          Math.trunc(readNumber(data.year, data.savings_year) ?? 0);
        return {
          ...mapPayoutBatch({
            ...data,
            id:
              batch.id ?? readString(data.id, data.batch_id, data.batchId) ?? "",
            year,
            month: batch.month ?? readString(data.month, data.month_name) ?? "",
          }),
          // This endpoint is keyed by the config, so keep that id for the
          // "savings year" link even when the payload omits it.
          interestConfigId: String(interestConfigId),
        };
      });
  }
  createInterestPayouts(interestConfigId: number | string) {
    return this.http
      .post<unknown>(
        `/admin/interest/${encodeURIComponent(String(interestConfigId))}/payouts`,
      )
      .then((payload) => ({
        ...readPayoutBatchPayload(payload),
        // Keep the config id for the "savings year" link even when the
        // creation response omits it.
        interestConfigId: String(interestConfigId),
      }));
  }
  submitInterest(year: number, note: string, by: string) {
    return this.http
      .post<unknown>(`/admin/interest/${year}/submit`, { note, by })
      .then((payload) => readInterestWorkflow(payload, year));
  }
  decideInterest(
    interestConfigId: number | string,
    decision: "Approved" | "Returned",
    opts: { by: string; role?: AdminRole; reason?: string },
  ) {
    const id = encodeURIComponent(String(interestConfigId));
    const action = decision === "Approved" ? "approve" : "reject";
    const body: { note?: string } = {};
    if (opts.reason?.trim()) body.note = opts.reason.trim();
    return this.http
      .post<unknown>(`/admin/interest/${id}/${action}`, body)
      .then((payload) =>
        readInterestWorkflow(payload, Number(interestConfigId) || 0),
      );
  }
  createPayoutBatch(year: number, by: string) {
    return this.http
      .post<unknown>(`/admin/interest/${year}/batch`, { by })
      .then(readPayoutBatchPayload);
  }
  notifyInterest(
    interestConfigId: number | string,
    channels: InterestNotifyChannel[],
  ) {
    return this.http
      .post<unknown>(
        `/admin/interest/${encodeURIComponent(String(interestConfigId))}/notify`,
        { channels },
      )
      .then((payload) =>
        readInterestWorkflow(payload, Number(interestConfigId) || 0),
      );
  }
  getInterestHistory(interestConfigId: number | string) {
    return this.http
      .get<unknown>(
        `/admin/interest/${encodeURIComponent(String(interestConfigId))}/history`,
      )
      .then((payload) =>
        readRecordList(payload, ["history", "events", "activities", "timeline"])
          .map(mapInterestHistoryEntry)
          .filter((entry): entry is [string, string, string] => entry !== null),
      );
  }
  listPayoutBatches() {
    return this.http
      .get<unknown>("/admin/payouts")
      .then((payload) =>
        readRecordList(payload, ["batches", "payouts", "payout_batches"]).map(
          mapPayoutBatch,
        ),
      );
  }
  getPayoutBatch(id: string) {
    return this.http
      .get<unknown>(`/admin/payouts/${id}`)
      .then(readPayoutBatchPayload);
  }
  decideBatch(
    id: string,
    decision: "Approved" | "Returned",
    opts: { by: string; role?: AdminRole; reason?: string },
  ) {
    return this.http
      .post<unknown>(`/admin/payouts/${id}/decision`, { decision, ...opts })
      .then(readPayoutBatchPayload);
  }
  resubmitBatch(id: string, by: string) {
    return this.http
      .post<unknown>(`/admin/payouts/${id}/resubmit`, { by })
      .then(readPayoutBatchPayload);
  }
  startDisbursement(id: string, by: string) {
    return this.http
      .post<unknown>(`/admin/payouts/${id}/disburse`, { by })
      .then(readPayoutBatchPayload);
  }
  retryPayout(id: string, _memberId: string, by: string) {
    return this.http
      .post<unknown>(`/admin/payouts/${id}/retry`, {
        memberId: _memberId,
        by,
      })
      .then(readPayoutBatchPayload);
  }
  markPayoutPaid(
    id: string,
    memberId: string,
    opts: { method: string; proof: string; note: string; by: string },
  ) {
    return this.http
      .post<unknown>(`/admin/payouts/${id}/mark-paid`, {
        memberId,
        ...opts,
      })
      .then(readPayoutBatchPayload);
  }
  runReport(
    kind: ReportKind,
    year: number,
    month?: number | "all",
    status?: string,
  ) {
    const p = new URLSearchParams({
      kind,
      year: String(year),
      ...(month !== undefined ? { month: String(month) } : {}),
      ...(status ? { status } : {}),
    });
    return this.http.get<ReportResult>(`/admin/reports?${p}`);
  }
  referralGroups() {
    return this.http.get<ReferralGroup[]>("/admin/referrals");
  }
  listAuditLog() {
    return this.http.get<AuditEntry[]>("/admin/audit-log");
  }
  logAudit(e: {
    at: string;
    actor: string;
    role: string;
    action: string;
    entity: string;
    change: string;
    category: AuditEntry["category"];
  }) {
    return this.http.post<AuditEntry>("/admin/audit-log", e);
  }
  listAdmins() {
    return this.http.get<AdminListItem[]>("/admin/users");
  }
  inviteAdmin(input: {
    name: string;
    email: string;
    role: AdminListItem["role"];
  }) {
    return this.http.post<AdminListItem>("/admin/users/invite", input);
  }
  setAdminStatus(id: string, status: AdminListItem["status"]) {
    return this.http.post<AdminListItem>(`/admin/users/${id}/status`, {
      status,
    });
  }
  getNotifications() {
    return this.http.get<NotificationSettings>("/admin/notification-settings");
  }
  saveNotifications(s: NotificationSettings) {
    return this.http.put<NotificationSettings>(
      "/admin/notification-settings",
      s,
    );
  }
  currentAdmin(_role: AdminRole) {
    return this.http.get<AdminUser>("/admin/me");
  }
}
