/**
 * Ports (interfaces) the domain depends on. The data layer implements each twice:
 *  - mock: in-memory, seeded from the approved build (demo, local dev, tests)
 *  - http: calls the backend API — see data/repositories/http
 * The presentation layer never imports data-layer classes directly; it receives these via ServicesContext.
 */
import type { AdminRole, AdminUser, Allocation, AuditCategory, AuditEntry, ContributionPaymentMethod, InterestBand, InterestCalcRow, InterestRateMode, InterestScope, InterestWorkflow, InterestYearSummary, Kobo, Member, MemberNotification, MemberSummary, MonthIndex, PayoutAccount, PayoutBatch, PayoutDestination, AdminListItem, NotificationSettings, ReferralGroup, Registration, ReportKind, ReportResult, SavingsYear, Session, Testimonial, Transaction, WalletEntry, WalletSnapshot, WalletWithdrawal } from '../entities';
import type { RegistrationDetails } from '../rules/registration';
import type { PlatformSettings } from '../rules/savings';

export interface AuthRepository {
  login(identifier: string, password: string): Promise<Session>;
  logout(): Promise<void>;
  requestPasswordReset(identifier: string): Promise<void>;
}

export interface NewRegistration extends RegistrationDetails { nextOfKin: { name: string; relationship: string; phone: string }; password: string }
export interface RegistrationRepository {
  sendEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<boolean>;
  submit(registration: NewRegistration): Promise<Registration>;
}

export type ChangeField = 'Phone number' | 'Email' | 'Payout account';
export interface MemberRepository {
  getMember(id: string): Promise<Member>;
  getSavingsYear(id: string, year: number): Promise<SavingsYear>;
  savePayoutAccount(id: string, account: Omit<PayoutAccount, 'accountName' | 'verifiedAt'>): Promise<PayoutAccount>;
  resolveAccountName(bankCode: string, accountNumber: string): Promise<string>;
  /** Monthly Savings Target for a month; `applyToFollowing` also makes it the standing target. 0 = clear. */
  setTarget(id: string, year: number, month: MonthIndex | null, amount: Kobo, applyToFollowing: boolean): Promise<SavingsYear>;
  /** Member locks the open month early (server checks it has at least the minimum). */
  lockMonth(id: string, year: number, month: MonthIndex): Promise<SavingsYear>;
  markCommunityJoined(id: string): Promise<void>;
  /** Phone, email and payout account are admin-controlled; members request changes. */
  requestChange(id: string, field: ChangeField, newValue: string, reason: string): Promise<void>;
  completeOnboarding(id: string): Promise<void>;
  listTransactions(id: string): Promise<Transaction[]>;
  listNotifications(id: string): Promise<MemberNotification[]>;
  /** MEM-18/19: full year-end payout to the verified bank account or the platform wallet (once per member/year). */
  requestPayout(id: string, year: number, destination: PayoutDestination): Promise<Transaction>;
  /** Demo helper: mark a bank payout as received so the status page can show the completed state. */
  markPayoutReceived(id: string, transactionId: string): Promise<Transaction>;
}

export interface SettingsRepository {
  get(): Promise<PlatformSettings>;
  /** ADM-25: Super Admin updates minimum per payment, cut-off or payout dates (audited). */
  save(patch: { minimumByYear?: Record<number, Kobo>; cutoffMonth?: MonthIndex; payoutDates?: Record<number, string> }): Promise<PlatformSettings>;
}

export interface ContributionIntent { reference: string; amountKobo: Kobo; platformChargeKobo: Kobo; allocations: Allocation[]; email: string }
export interface VerifiedContribution { transaction: Transaction; communityUnlocked: boolean }
export interface ContributionRepository {
  /** Server re-plans the allocation (oldest open month) and creates our unique reference BEFORE the gateway opens. */
  initiate(memberId: string, year: number, amountKobo: Kobo, method?: ContributionPaymentMethod): Promise<ContributionIntent>;
  /** Server-side verification with Paystack; applies catch-up auto-locks and community unlock. */
  verify(reference: string): Promise<VerifiedContribution>;
  /** Debits the member's wallet and records the contribution atomically; applies the same auto-locks and unlock. */
  payFromWallet(memberId: string, year: number, amountKobo: Kobo): Promise<VerifiedContribution>;
  /**
   * Records a manual bank transfer the member says they have made. The transaction stays Pending (and does not
   * count towards savings) until the team confirms the money arrived.
   */
  confirmBankTransfer(memberId: string, year: number, amountKobo: Kobo): Promise<VerifiedContribution>;
}

export type GatewayOutcome = 'success' | 'failed' | 'closed';
export interface PaymentGateway { checkout(intent: ContributionIntent): Promise<GatewayOutcome> }

export interface WalletRepository {
  /** Balances derived from the ledger; entries and withdrawals newest first. */
  getSnapshot(memberId: string): Promise<WalletSnapshot>;
  /** Member-initiated top-up. No gateway yet: demo mode settles it automatically shortly after. */
  requestTopUp(memberId: string, amountKobo: Kobo): Promise<WalletEntry>;
  /** Reserves the amount and targets the member's verified payout account; an admin disburses it later. */
  requestWithdrawal(memberId: string, amountKobo: Kobo): Promise<WalletWithdrawal>;
}

export interface TestimonialRepository {
  listPublished(): Promise<Testimonial[]>;
  /** ADM-28: full list for admins, in display order. */
  listAll(): Promise<Testimonial[]>;
  save(t: { id?: string; name: string; descriptor: string; quote: string; status: Testimonial['status'] }): Promise<Testimonial>;
  setStatus(id: string, status: Testimonial['status']): Promise<Testimonial>;
  move(id: string, direction: -1 | 1): Promise<Testimonial[]>;
  remove(id: string): Promise<void>;
}

/** Rule configuration input: either one fixed rate, or contribution bands with their own rates. */
export interface InterestRulesInput {
  rateMode?: InterestRateMode;
  rate: number | null;
  bands?: InterestBand[];
  rounding: string;
  scope: InterestScope;
  selectedMemberIds: string[];
}

export interface MemberQuery { tab: 'All' | 'Active' | 'Suspended' | 'NotPaid' | 'Forfeited'; search: string; eligibility?: 'Eligible' | 'Forfeited'; referred?: boolean; joinedYear?: string }
export interface AdminRepository {
  dashboard(year: number): Promise<{ members: number; activeSavers: number; totalSavingsKobo: Kobo; pendingPayments: number; monthlyPaid: { month: string; paid: number; due: number }[]; eligible: number; forfeited: number }>;
  listMembers(query: MemberQuery): Promise<MemberSummary[]>;
  countMembers(): Promise<Record<MemberQuery['tab'], number>>;
  listRegistrations(): Promise<Registration[]>;
  /** ADM-12: approve (opens the member account) or reject (reason required) a registration. */
  decideRegistration(id: string, decision: 'Approved' | 'Rejected', reason?: string): Promise<Registration>;
  /** ADM-13: per-member savings rows plus members-saving-per-month counts for the chart. */
  savingsOverview(year: number): Promise<{ rows: MemberSummary[]; monthly: { month: string; members: number }[] }>;
  /** ADM-14: every contribution and payout (server-side verified). */
  listTransactions(): Promise<Transaction[]>;
  /** ADM-15 to ADM-17: one interest configuration per savings year; 8-stage maker-checker workflow. */
  listInterest(): Promise<InterestYearSummary[]>;
  getInterest(year: number): Promise<{ workflow: InterestWorkflow; preview: InterestCalcRow[] }>;
  saveInterestPeriod(year: number, period: { start: string; end: string; close: string }): Promise<InterestWorkflow>;
  saveInterestRules(year: number, rules: InterestRulesInput): Promise<InterestWorkflow>;
  /** Removes members from the payout preview/batch (pass `[]` to restore everyone). */
  setInterestExclusions(year: number, memberIds: string[]): Promise<InterestWorkflow>;
  runInterestCalculation(year: number): Promise<InterestWorkflow>;
  submitInterest(year: number, note: string, by: string): Promise<InterestWorkflow>;
  /** `role` identifies the checker: only a Super Admin may approve — including their own maker request. */
  decideInterest(year: number, decision: 'Approved' | 'Returned', opts: { by: string; role?: AdminRole; reason?: string }): Promise<InterestWorkflow>;
  createPayoutBatch(year: number, by: string): Promise<PayoutBatch>;
  notifyInterest(year: number, by: string): Promise<InterestWorkflow>;
  /** ADM-18 to ADM-20: year-end payout batches. */
  listPayoutBatches(): Promise<PayoutBatch[]>;
  getPayoutBatch(id: string): Promise<PayoutBatch>;
  decideBatch(id: string, decision: 'Approved' | 'Returned', opts: { by: string; role?: AdminRole; reason?: string }): Promise<PayoutBatch>;
  resubmitBatch(id: string, by: string): Promise<PayoutBatch>;
  startDisbursement(id: string, by: string): Promise<PayoutBatch>;
  retryPayout(id: string, memberId: string, by: string): Promise<PayoutBatch>;
  markPayoutPaid(id: string, memberId: string, opts: { method: string; proof: string; note: string; by: string }): Promise<PayoutBatch>;
  /** ADM-21: filtered report preview (exported client-side to CSV). */
  runReport(kind: ReportKind, year: number, month?: number | 'all', status?: string): Promise<ReportResult>;
  /** ADM-22: referrer → referred members and pending registrations. */
  referralGroups(): Promise<ReferralGroup[]>;
  /** ADM-23: every privileged and financial action. Entries are append-only. */
  listAuditLog(): Promise<AuditEntry[]>;
  logAudit(e: { at: string; actor: string; role: string; action: string; entity: string; change: string; category: AuditCategory }): Promise<AuditEntry>;
  /** ADM-24/26: admin users (Super Admin manages). */
  listAdmins(): Promise<AdminListItem[]>;
  inviteAdmin(input: { name: string; email: string; role: AdminRole }): Promise<AdminListItem>;
  setAdminStatus(id: string, status: AdminListItem['status']): Promise<AdminListItem>;
  /** ADM-27: member notification preferences matrix. */
  getNotifications(): Promise<NotificationSettings>;
  saveNotifications(s: NotificationSettings): Promise<NotificationSettings>;
  currentAdmin(role: AdminRole): Promise<AdminUser>;
}

export interface Repositories {
  auth: AuthRepository; registration: RegistrationRepository; member: MemberRepository; contribution: ContributionRepository;
  settings: SettingsRepository; testimonials: TestimonialRepository; admin: AdminRepository; gateway: PaymentGateway; wallet: WalletRepository;
}
