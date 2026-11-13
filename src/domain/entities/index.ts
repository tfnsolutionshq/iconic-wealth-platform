/**
 * Domain entities. Plain types with no framework or transport concerns.
 * Money is always stored in kobo (integer). Use formatNaira() at the edge for display.
 */
export type Kobo = number;
export type MemberId = string;
export type MonthIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type MemberStatus = 'Active' | 'Suspended';
export type Eligibility = 'Eligible' | 'Forfeited';
export type MonthStatus = 'Paid' | 'Open' | 'Locked' | 'Due' | 'Late' | 'Missed' | 'NotDue' | 'BeforeJoining';
export type TransactionStatus = 'Successful' | 'Pending' | 'Failed' | 'Processing';
export type TransactionKind = 'Contribution' | 'Payout';
/**
 * How a member pays a contribution: a manual bank transfer to the platform account, from their wallet
 * balance, or online through Paystack. Only online payments carry the platform charge.
 */
export type ContributionPaymentMethod = 'Bank Account' | 'Wallet' | 'Online';
/** Where a year-end payout is sent: the member's verified bank account or their platform wallet. */
export type PayoutDestination = 'Bank account' | 'Wallet';
export type RegistrationStatus = 'New' | 'Approved' | 'Rejected' | 'ChangesRequested';
export type AdminRole = 'Administrator' | 'SuperAdmin';
export type OnboardingState = 'PayoutAccount' | 'Target' | 'NewYearTarget' | 'Complete';
/** WhatsApp community access: unlocked by the first confirmed payment of at least the minimum. */
export type CommunityAccess = 'Locked' | 'Eligible' | 'Granted' | 'Restricted';

export interface NextOfKin { name: string; relationship: string; phone: string }
export interface PayoutAccount { bankCode: string; bankName: string; accountNumber: string; accountName: string; verifiedAt?: string }
/** A bank offered for payout accounts. The code is the NUBAN `bank_code` sent when saving. */
export interface Bank { name: string; code: string }

export interface Member {
  id: MemberId;
  firstName: string;
  lastName: string;
  gender: 'Female';
  dateOfBirth: string;          // ISO date
  email: string;
  phone: string;
  stateOfResidence: string;
  address: string;
  nextOfKin: NextOfKin;
  status: MemberStatus;
  joinedOn: string;
  referredBy?: string;
  payoutAccount?: PayoutAccount;
  community: CommunityAccess;
  onboarding: OnboardingState;
  isProfileComplete: boolean;
}

/**
 * One member's savings year. Months January–November (0–10) are savings "buckets"; December is payout month.
 * Totals and statuses are DERIVED from successful transactions + locks (see rules/savings.ts), never stored.
 */
export interface MonthLock { by: 'member' | 'auto'; on: string }
export interface SavingsYear {
  memberId: MemberId;
  year: number;
  startMonth: MonthIndex;              // 0 normally; a later month is never used now (mid-year joiners use catch-up)
  joinMonth: MonthIndex | null;        // set for mid-year joiners: months before it are catch-up months
  target: Kobo;                        // standing monthly savings target (0 = not set). Optional, never enforced
  targets: Partial<Record<number, Kobo>>;   // per-month overrides
  locks: Partial<Record<number, MonthLock>>;
  interestException?: boolean;         // approved by a Super Admin
}

/** One savings month returned by GET /savings/months. */
export interface SavingsMonth {
  id: string | null;
  year: number;
  month: number;                       // 1-12 (savings months are 1-11)
  period: string;                      // e.g. "2026-01"
  monthName: string;
  status: string;                      // e.g. "defaulted", "upcoming", "saved", "open"
  statusLabel: string;
  targetAmount: Kobo | null;
  savedAmount: Kobo;
  remainingAmount: Kobo;
  progressPercentage: number | null;
  targetMet: boolean;
  contributionsCount: number;
  closeNote: string;
  deadline: string;                    // ISO date-time
}

/** One savings period returned by the member dashboard endpoint. */
export interface SavingsPeriod {
  year: number;
  month: number;                       // 1-12
  period: string;                      // e.g. "2027-01"
  monthName: string;                   // e.g. "January"
  deadline: string;                    // ISO date-time
}

export interface PayoutJourneyStep {
  step: number;
  title: string;
  description: string;
  completed: boolean;
  active: boolean;
}

/** The signed-in member's dashboard from GET /savings. */
export interface SavingsDashboard {
  activeMonth: SavingsPeriod | null;
  nextPeriod: SavingsPeriod | null;
  summary: {
    year: number;
    savedThisYear: Kobo;
    totalSaved: Kobo;
    totalMonths: number;
    monthsTargetMet: number;
    defaultedMonths: number;
    streak: number;
  };
  payoutJourney: {
    year: number;
    payoutDate: string;
    steps: PayoutJourneyStep[];
  };
  settings: {
    minimumPerPayment: Kobo;
    platformChargePerPayment: Kobo;
  };
}

export interface Allocation { month: MonthIndex; amountKobo: Kobo }
export interface Transaction {
  id: string;
  reference: string;            // our reference, e.g. IWH-C-...
  gatewayReference?: string;    // Paystack reference
  memberId: MemberId;
  memberName: string;
  kind: TransactionKind;
  year: number;
  allocations: Allocation[];    // which month(s) the amount was applied to (oldest open month first)
  amountKobo: Kobo;             // amount saved (or paid out)
  platformChargeKobo: Kobo;     // flat ₦100, online payments only; member pays amount + charge
  paymentMethod?: ContributionPaymentMethod;  // how a contribution was paid (absent on older records)
  payoutDestination?: PayoutDestination;      // where a payout was sent (payout records only)
  status: TransactionStatus;
  late: boolean;
  failureReason?: string;
  createdAt: string;
}

export interface Registration {
  id: string;
  firstName: string;
  lastName: string;
  gender: 'Female';
  dateOfBirth: string;
  email: string;
  phone: string;
  stateOfResidence: string;
  address: string;
  heardAboutUs: string;
  referredBy?: string;
  nextOfKin: NextOfKin;
  submittedAt: string;
  status: RegistrationStatus;
  reason?: string;
  memberId?: MemberId;
}

export interface MemberNotification { id: string; title: string; body: string; createdAt: string; read: boolean; link: string; tone: 'brand' | 'gold' | 'fail' | 'neutral' }

export interface Testimonial { id: string; name: string; descriptor: string; quote: string; status: 'Published' | 'Draft'; order: number }

export interface AdminUser { id: string; name: string; email: string; role: AdminRole; status: 'Active' | 'Invited' | 'Deactivated' }

/**
 * A row in the admin members list.
 *
 * The live `/admin/members` endpoint returns the member record before the
 * savings totals are exposed, so those figures are optional here. The mock
 * repository still returns a full `MemberSummary`.
 */
export interface MemberListRow {
  id: MemberId; name: string; status: MemberStatus; targetKobo?: Kobo; savedKobo?: Kobo; monthsPaid?: number;
  currentMonthStatus?: MonthStatus; eligibility?: Eligibility; forfeitReason?: string; referredBy?: string; joinedOn: string;
}

export interface MemberSummary extends MemberListRow {
  targetKobo: Kobo; savedKobo: Kobo; monthsPaid: number;
  currentMonthStatus: MonthStatus; eligibility: Eligibility;
}

export type Session =
  | { kind: 'member'; member: Member }
  | { kind: 'admin'; admin: AdminUser }
  | { kind: 'pending'; registration: Registration };

/* ---------------- Member wallet ---------------- */

export type WalletEntryKind = 'TopUp' | 'Withdrawal' | 'Contribution' | 'Payout' | 'Adjustment';
export type WalletEntryStatus = 'Pending' | 'Processing' | 'Successful' | 'Failed';

/** One money movement in or out of the member's wallet. Statuses mirror Transaction; Pending/Failed never count. */
export interface WalletEntry {
  id: string;
  reference: string;            // our reference, e.g. IWH-W-...
  memberId: MemberId;
  kind: WalletEntryKind;
  direction: 'Credit' | 'Debit';
  amountKobo: Kobo;
  status: WalletEntryStatus;
  note?: string;                // human detail, e.g. "To GTBank •••• 6789"
  failureReason?: string;
  createdAt: string;            // ISO
}

/** A member's request to move wallet money to their verified payout account; an admin disburses it later. */
export interface WalletWithdrawal {
  id: string;
  reference: string;
  memberId: MemberId;
  amountKobo: Kobo;
  status: 'Processing' | 'Paid' | 'Failed';
  bankName: string;
  accountNumber: string;
  accountName: string;
  createdAt: string;
  failureReason?: string;
}

/** Balances are DERIVED from entries (see rules/wallet.ts), never stored. */
export interface WalletSnapshot {
  memberId: MemberId;
  availableKobo: Kobo;         // spendable: settled credits − settled debits − in-flight withdrawals
  pendingDepositKobo: Kobo;    // top-ups awaiting confirmation
  pendingWithdrawalKobo: Kobo; // requested, awaiting disbursement to the bank
  entries: WalletEntry[];      // newest first
  withdrawals: WalletWithdrawal[]; // newest first
}

/* ---------------- Admin portal (ADM-13 and later) ---------------- */

export type AuditCategory = 'Financial' | 'Members' | 'Access' | 'Roles';
export interface AuditEntry {
  id: string; at: string; actor: string; role: string;
  action: string; entity: string; change: string; category: AuditCategory;
}

export type InterestStatus = 'Not started' | 'Draft' | 'Pending approval' | 'Returned' | 'Approved' | 'Paid out';
/** Whether interest applies to every eligible member or only to members picked manually (Rule configuration). */
export type InterestScope = 'All members' | 'Selected members';
/** One fixed rate for everyone, or different rates for bands of total contributions. */
export type InterestRateMode = 'Fixed rate' | 'Contribution ranges';
/** A contribution band and the rate applied to members whose total savings fall inside it. `maxKobo: null` = no upper limit. */
export interface InterestBand { minKobo: Kobo; maxKobo: Kobo | null; rate: number }
export interface InterestYearSummary {
  year: number; status: InterestStatus; rate: number | null; rateMode?: InterestRateMode;
  eligible: number; forfeited: number; contributionsKobo: Kobo; interestKobo: Kobo;
  maker?: string; checker?: string; approvedAt?: string; batchId?: string;
}
export interface InterestCalcRow {
  memberId: string; memberName: string; contributionsKobo: Kobo;
  sharePct: number; interestKobo: Kobo; eligible: boolean; reason?: string;
  /** The rate applied to this member (fixed or the matching contribution band). */
  rate?: number | null;
}
/** 8-stage maker-checker workflow (ADM-16, ADM-17). `closed` years are read-only. */
export interface InterestWorkflow extends InterestYearSummary {
  closed: boolean; stage: number; done: number;
  start: string; end: string; close: string; rounding: string;
  rateMode: InterestRateMode; bands: InterestBand[];
  scope: InterestScope; selectedMemberIds: string[];
  /** Members removed from the payout preview; they are excluded from the batch and interest totals. */
  excludedMemberIds: string[];
  calc: boolean; note: string; rejectReason?: string; notified: boolean;
  history: [string, string, string][]; // [at, event, actor]
}

export type PayoutBatchStatus = 'Awaiting approval' | 'Returned to maker' | 'Approved' | 'Processing' | 'Partial' | 'Completed';
export type PayoutRowStatus = 'Paid' | 'Paid manually' | 'Failed' | 'Retrying' | 'Pending';
export interface PayoutRow {
  memberId: string; memberName: string; savingsKobo: Kobo; interestKobo: Kobo; totalKobo: Kobo;
  account: string; status: PayoutRowStatus; reason?: string; reference: string; proof?: string;
}
export interface PayoutBatch {
  id: string; year: number; month: string; status: PayoutBatchStatus; count: number;
  savingsKobo: Kobo; interestKobo: Kobo; maker: string; checker?: string; createdAt: string;
  returnReason?: string; rows: PayoutRow[]; history: [string, string, string][];
}

export type ReportKind = 'compliance' | 'collections' | 'eligibility' | 'charges';
export interface ReportResult { headers: string[]; rows: string[][] }

export type ReferralStatus = 'Saving' | 'Pending' | 'Inactive' | 'Not started';
export interface ReferralGroup { referrer: string; referred: { name: string; date: string; status: ReferralStatus }[] }

export interface AdminListItem { id: string; name: string; email: string; role: AdminRole; status: 'Active' | 'Invited' | 'Deactivated'; lastActive: string }

export interface NotificationSettings {
  channels: ('In-app' | 'Email' | 'SMS' | 'WhatsApp')[];
  events: { key: string; label: string }[];
  matrix: Record<string, Record<string, boolean>>;
  reminderDays: number;
}
