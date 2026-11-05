/**
 * HTTP implementations of the domain ports. Endpoint paths are a PROPOSED contract for the backend team;
 * agree them in Sprint 0 and keep this file as the single place that knows URLs and payload shapes.
 * Money is exchanged in kobo (integers).
 */
import type { AdminListItem, AdminRole, AdminUser, AuditEntry, Bank, ContributionPaymentMethod, InterestCalcRow, InterestWorkflow, InterestYearSummary, Kobo, Member, MemberNotification, MemberSummary, MonthIndex, NotificationSettings, PayoutAccount, PayoutBatch, PayoutDestination, ReferralGroup, Registration, ReportKind, ReportResult, SavingsDashboard, SavingsPeriod, SavingsYear, Session, Testimonial, Transaction } from '@/domain/entities';
import type { PlatformSettings } from '@/domain/rules';
import { naira } from '@/domain/rules';
import type { AdminRepository, AuthRepository, ChangeField, ContributionIntent, ContributionRepository, InterestRulesInput, MemberQuery, MemberRepository, NewRegistration, PayoutAccountRepository, RegistrationRepository, RegistrationStarted, SavingsDashboardRepository, SavingsTargetRepository, SettingsRepository, TestimonialRepository, VerifiedContribution, ApiMember, ApiMemberPage, ApiMemberStatus } from '@/domain/repositories';
import type { RegistrationDetails } from '@/domain/rules';
import type { HttpClient } from '@/data/api/httpClient';
import { ApiError, type ApiEnvelope } from '@/data/api/httpClient';
import { ValidationError } from '@/domain/errors';

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
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
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
  next_of_kin?: { name: string | null; relationship: string | null; phone: string | null } | null;
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
  const isAdmin = u.user_type === 'staff' || u.user_type === 'admin'
    || roles.some(r => ['super-admin', 'administrator', 'Administrator', 'SuperAdmin'].includes(r));
  if (isAdmin) {
    const role: AdminRole = roles.some(r => r === 'super-admin' || r === 'SuperAdmin') ? 'SuperAdmin' : 'Administrator';
    // Build the domain object explicitly. Spreading the API payload here would
    // store both snake_case and camelCase copies of the same field.
    const status = (u.status ?? '').toLowerCase();
    return {
      kind: 'admin',
      id: u.id,
      name: u.full_name ?? `${u.first_name} ${u.last_name}`,
      email: u.email,
      role,
      status: status === 'invited' ? 'Invited' : status === 'deactivated' ? 'Deactivated' : 'Active',
    };
  }
  return {
    kind: 'member',
    id: u.member_id ?? u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    gender: 'Female' as const,
    dateOfBirth: u.dob ?? '',
    email: u.email,
    phone: u.phone ?? '',
    stateOfResidence: u.state_of_residence ?? '',
    address: u.residential_address ?? '',
    nextOfKin: {
      name: u.next_of_kin?.name ?? '',
      relationship: u.next_of_kin?.relationship ?? '',
      phone: u.next_of_kin?.phone ?? '',
    },
    status: (u.status ?? '').toLowerCase() === 'active' ? 'Active' : 'Suspended',
    // joinedOn is the account's join date, not the member's date of birth.
    joinedOn: u.created_at?.slice(0, 10) ?? u.dob ?? '',
    referredBy: u.referred_by ?? undefined,
    community: 'Locked' as const,
    onboarding: 'PayoutAccount' as const,
    isProfileComplete: Boolean(u.is_profile_complete),
  };
}

/** Builds a typed Session from the mapped user object. */
function buildLoginSession(user: unknown): Session {
  const u = user as { kind: string };
  if (u.kind === 'admin') return { kind: 'admin', admin: user as AdminUser };
  return { kind: 'member', member: user as Member };
}

export class HttpAuthRepository implements AuthRepository {
  constructor(private readonly http: HttpClient, private readonly onToken: (t: string | null) => void) {}

  async login(identifier: string, password: string) {
    let envelope: ApiEnvelope<LoginApiData>;
    try {
      envelope = await this.http.post<ApiEnvelope<LoginApiData>>('/auth/login', { login: identifier, password });
    } catch (error) {
      rethrowWithFieldErrors(error);
    }
    const data = envelope.data!;
    const token = data.token ?? data.access_token ?? '';
    this.onToken(token);

    const apiUser = data.user;
    const mappedUser = mapApiLoginUser(apiUser);
    const session = buildLoginSession(mappedUser);
    // `user` stays in the API's snake_case shape for persistence; `session` is
    // the mapped domain object the rest of the app consumes.
    return { session, token, user: apiUser };
  }

  async logout() { await this.http.post('/auth/logout'); this.onToken(null); }
  async requestPasswordReset(identifier: string) { await this.http.post('/auth/password-reset', { identifier }); }
}

interface ApiNextOfKin { name: string; relationship: string; phone: string }
interface ApiRegUser { id: string; member_id: string; first_name: string; last_name: string; email: string; phone: string; status: string; next_of_kin?: ApiNextOfKin }
interface ApiVerification { expires_at: string; resend_available_in_seconds: number }
interface RegisterApiData { user: ApiRegUser; verification?: ApiVerification }
interface VerifyEmailApiData { token?: string; access_token?: string }

export class HttpRegistrationRepository implements RegistrationRepository {
  constructor(private readonly http: HttpClient, private readonly onToken: (t: string | null) => void) {}

  async start(details: RegistrationDetails): Promise<RegistrationStarted> {
    // Normalise phone: convert leading 0 to +234 (e.g. 08031234567 → +2348031234567)
    const phone = details.phone.startsWith('0')
      ? `+234${details.phone.slice(1)}`
      : details.phone;
    const envelope = await this.http.post<ApiEnvelope<RegisterApiData>>('/auth/member/register', {
      first_name: details.firstName,
      last_name: details.lastName,
      dob: details.dateOfBirth,
      gender: 'female',
      email: details.email,
      phone,
      state_of_residence: details.stateOfResidence,
      residential_address: details.address,
      how_heard_about_us: details.heardAboutUs,
      referred_by: details.referredBy || undefined,
    });
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
            resendAvailableInSeconds: data.verification.resend_available_in_seconds,
          }
        : undefined,
    };
  }

  async resendEmailCode(email: string): Promise<RegistrationStarted> {
    const envelope = await this.http.post<ApiEnvelope<RegisterApiData>>('/registrations/resend-code', { email });
    return {
      emailSent: true,
      message: envelope.message,
    };
  }

  async verifyEmailCode(email: string, code: string): Promise<boolean> {
    const envelope = await this.http.post<ApiEnvelope<VerifyEmailApiData>>('/auth/member/register/verify-email', { email, code });
    const token = envelope.data?.token ?? envelope.data?.access_token;
    if (token) this.onToken(token);
    return envelope.success;
  }

  async submit(r: NewRegistration): Promise<Registration> {
    return this.http.post<Registration>('/auth/member/register/complete', {
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
    const payload = await this.http.get<ApiEnvelope<ApiBank[]> | ApiBank[]>('/payout-account/banks');
    const banks = unwrapData(payload) ?? [];
    return banks
      .filter(b => b.active !== false && !b.is_deleted)
      .map(b => ({ name: b.name, code: b.code }));
  }
  async savePayoutAccount(_id: string, a: { bankCode: string; bankName: string; accountNumber: string }): Promise<PayoutAccount> {
    const payload = await this.http.post<ApiEnvelope<ApiPayoutAccount> | ApiPayoutAccount>('/payout-account', {
      bank_code: a.bankCode,
      account_number: a.accountNumber,
    });
    const saved = unwrapData(payload);
    return {
      bankCode: saved?.bank_code ?? a.bankCode,
      bankName: saved?.bank_name ?? a.bankName,
      accountNumber: saved?.account_number ?? a.accountNumber,
      accountName: saved?.account_name ?? '',
      verifiedAt: saved?.verified_at,
    };
  }
  async resolveAccountName(bankCode: string, accountNumber: string) { return (await this.http.get<{ accountName: string }>(`/banks/${bankCode}/resolve?account=${accountNumber}`)).accountName; }
}

export class HttpSavingsTargetRepository implements SavingsTargetRepository {
  constructor(private readonly http: HttpClient) {}
  async setTarget(_memberId: string, _year: number, amountKobo: Kobo) {
    // The API expresses the target in naira; the domain keeps money in kobo.
    await this.http.post('/savings/target', { target_amount: Math.round(amountKobo / 100) });
  }
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
  next_period: ApiSavingsPeriod;
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
    steps: { step: number; title: string; description: string; completed: boolean; active: boolean }[];
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

function mapSavingsDashboard(d: ApiSavingsDashboard): SavingsDashboard {
  return {
    activeMonth: d.active_month ? mapSavingsPeriod(d.active_month) : null,
    nextPeriod: mapSavingsPeriod(d.next_period),
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
      steps: d.payout_journey.steps.map(s => ({
        step: s.step,
        title: s.title,
        description: s.description,
        completed: s.completed,
        active: s.active,
      })),
    },
    settings: {
      minimumPerPayment: koboFromApi(d.settings.minimum_per_payment),
      platformChargePerPayment: koboFromApi(d.settings.platform_charge_per_payment),
    },
  };
}

export class HttpSavingsDashboardRepository implements SavingsDashboardRepository {
  constructor(private readonly http: HttpClient) {}
  async get(): Promise<SavingsDashboard> {
    const payload = await this.http.get<ApiEnvelope<ApiSavingsDashboard> | ApiSavingsDashboard>('/savings');
    const data = unwrapData(payload);
    if (!data) throw new Error('Your savings dashboard is unavailable right now.');
    return mapSavingsDashboard(data);
  }
}

export class HttpMemberRepository implements MemberRepository {
  constructor(private readonly http: HttpClient) {}
  getMember(id: string) { return this.http.get<Member>(`/members/${id}`); }
  getSavingsYear(id: string, year: number) { return this.http.get<SavingsYear>(`/members/${id}/savings/${year}`); }
  setTarget(id: string, year: number, month: MonthIndex | null, amountKobo: Kobo, applyToFollowing: boolean) { return this.http.put<SavingsYear>(`/members/${id}/savings/${year}/target`, { month, amountKobo, applyToFollowing }); }
  lockMonth(id: string, year: number, month: MonthIndex) { return this.http.post<SavingsYear>(`/members/${id}/savings/${year}/months/${month}/lock`); }
  async markCommunityJoined(id: string) { await this.http.post(`/members/${id}/community/joined`); }
  async requestChange(id: string, field: ChangeField, newValue: string, reason: string) { await this.http.post(`/members/${id}/change-requests`, { field, newValue, reason }); }
  async completeOnboarding(id: string) { await this.http.post(`/members/${id}/onboarding/complete`); }
  listTransactions(id: string) { return this.http.get<Transaction[]>(`/members/${id}/transactions`); }
  listNotifications(id: string) { return this.http.get<MemberNotification[]>(`/members/${id}/notifications`); }
  requestPayout(id: string, year: number, destination: PayoutDestination) { return this.http.post<Transaction>(`/members/${id}/payouts`, { year, destination }); }
  markPayoutReceived(id: string, transactionId: string) { return this.http.post<Transaction>(`/members/${id}/payouts/${transactionId}/received`); }
}
export class HttpContributionRepository implements ContributionRepository {
  constructor(private readonly http: HttpClient) {}
  initiate(memberId: string, year: number, amountKobo: Kobo, method: ContributionPaymentMethod = 'Online') { return this.http.post<ContributionIntent>('/contributions', { memberId, year, amountKobo, method }); }
  verify(reference: string) { return this.http.post<VerifiedContribution>(`/contributions/${reference}/verify`); }
  payFromWallet(memberId: string, year: number, amountKobo: Kobo) { return this.http.post<VerifiedContribution>('/contributions/wallet', { memberId, year, amountKobo }); }
  confirmBankTransfer(memberId: string, year: number, amountKobo: Kobo) { return this.http.post<VerifiedContribution>('/contributions/bank-transfer', { memberId, year, amountKobo }); }
}
export class HttpSettingsRepository implements SettingsRepository {
  constructor(private readonly http: HttpClient) {}
  get() { return this.http.get<PlatformSettings>('/settings/platform'); }
  save(patch: { minimumByYear?: Record<number, Kobo>; cutoffMonth?: MonthIndex; payoutDates?: Record<number, string> }) { return this.http.put<PlatformSettings>('/settings/platform', patch); }
}
export class HttpTestimonialRepository implements TestimonialRepository {
  constructor(private readonly http: HttpClient) {}
  listPublished() { return this.http.get<Testimonial[]>('/content/testimonials?status=Published'); }
  listAll() { return this.http.get<Testimonial[]>('/content/testimonials'); }
  save(t: { id?: string; name: string; descriptor: string; quote: string; status: Testimonial['status'] }) { return t.id ? this.http.put<Testimonial>(`/content/testimonials/${t.id}`, t) : this.http.post<Testimonial>('/content/testimonials', t); }
  setStatus(id: string, status: Testimonial['status']) { return this.http.post<Testimonial>(`/content/testimonials/${id}/status`, { status }); }
  move(id: string, direction: -1 | 1) { return this.http.post<Testimonial[]>(`/content/testimonials/${id}/move`, { direction }); }
  async remove(id: string) { await this.http.post(`/content/testimonials/${id}/delete`); }
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
      monthly_compliance: { month: number; paid: number; not_paid: number }[];
      interest_eligibility: { eligible: number | null; forfeited: number | null };
    }
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const envelope = await this.http.get<ApiEnvelope<ApiDashboard>>(`/admin/dashboard?year=${year}`);
    const d = envelope.data!;
    return {
      members: d.total_members,
      activeSavers: d.active_savers,
      totalSavingsKobo: Math.round(parseFloat(d.total_savings) * 100),
      pendingPayments: d.pending_payments,
      monthlyPaid: d.monthly_compliance.map(m => ({
        month: MONTH_NAMES[m.month - 1] ?? String(m.month),
        paid: m.paid,
        due: m.not_paid,
      })),
      eligible: d.interest_eligibility.eligible ?? 0,
      forfeited: d.interest_eligibility.forfeited ?? 0,
    };
  }
  listMembers(q: MemberQuery) { const p = new URLSearchParams({ tab: q.tab, search: q.search, ...(q.eligibility ? { eligibility: q.eligibility } : {}), ...(q.joinedYear ? { joinedYear: q.joinedYear } : {}), ...(q.referred !== undefined ? { referred: String(q.referred) } : {}) }); return this.http.get<MemberSummary[]>(`/admin/members?${p}`); }
  countMembers() { return this.http.get<Record<MemberQuery['tab'], number>>('/admin/members/counts'); }
  listRegistrations() { return this.http.get<Registration[]>('/admin/registrations'); }
  async listAllMembers(params: { search?: string; status?: ApiMemberStatus; page?: number } = {}): Promise<ApiMemberPage> {
    const p = new URLSearchParams();
    if (params.search) p.set('search', params.search);
    if (params.status) p.set('status', params.status);
    if (params.page && params.page > 1) p.set('page', String(params.page));
    const query = p.toString();
    const envelope = await this.http.get<ApiEnvelope<ApiMember[]>>(`/admin/members${query ? `?${query}` : ''}`);
    return {
      data: envelope.data ?? [],
      meta: (envelope as unknown as { meta: ApiMemberPage['meta'] }).meta ?? { current_page: 1, per_page: 15, last_page: 1, total: 0 },
    };
  }
  decideRegistration(id: string, decision: 'Approved' | 'Rejected', reason?: string) { return this.http.post<Registration>(`/admin/registrations/${id}/decision`, { decision, reason }); }
  async approveMember(id: string): Promise<ApiMember> {
    const envelope = await this.http.post<ApiEnvelope<ApiMember>>(`/admin/members/${id}/approve`);
    return envelope.data!;
  }
  async rejectMember(id: string, reason: string): Promise<ApiMember> {
    const envelope = await this.http.post<ApiEnvelope<ApiMember>>(`/admin/members/${id}/reject`, { reason });
    return envelope.data!;
  }
  savingsOverview(year: number) { return this.http.get<{ rows: MemberSummary[]; monthly: { month: string; members: number }[] }>(`/admin/savings?year=${year}`); }
  listTransactions() { return this.http.get<Transaction[]>('/admin/transactions'); }
  listInterest() { return this.http.get<InterestYearSummary[]>('/admin/interest'); }
  getInterest(year: number) { return this.http.get<{ workflow: InterestWorkflow; preview: InterestCalcRow[] }>(`/admin/interest/${year}`); }
  saveInterestPeriod(year: number, period: { start: string; end: string; close: string }) { return this.http.put<InterestWorkflow>(`/admin/interest/${year}/period`, period); }
  saveInterestRules(year: number, rules: InterestRulesInput) { return this.http.put<InterestWorkflow>(`/admin/interest/${year}/rules`, rules); }
  setInterestExclusions(year: number, memberIds: string[]) { return this.http.put<InterestWorkflow>(`/admin/interest/${year}/exclusions`, { memberIds }); }
  runInterestCalculation(year: number) { return this.http.post<InterestWorkflow>(`/admin/interest/${year}/calculate`); }
  submitInterest(year: number, note: string, by: string) { return this.http.post<InterestWorkflow>(`/admin/interest/${year}/submit`, { note, by }); }
  decideInterest(year: number, decision: 'Approved' | 'Returned', opts: { by: string; role?: AdminRole; reason?: string }) { return this.http.post<InterestWorkflow>(`/admin/interest/${year}/decision`, { decision, ...opts }); }
  createPayoutBatch(year: number, by: string) { return this.http.post<PayoutBatch>(`/admin/interest/${year}/batch`, { by }); }
  notifyInterest(year: number, by: string) { return this.http.post<InterestWorkflow>(`/admin/interest/${year}/notify`, { by }); }
  listPayoutBatches() { return this.http.get<PayoutBatch[]>('/admin/payouts'); }
  getPayoutBatch(id: string) { return this.http.get<PayoutBatch>(`/admin/payouts/${id}`); }
  decideBatch(id: string, decision: 'Approved' | 'Returned', opts: { by: string; role?: AdminRole; reason?: string }) { return this.http.post<PayoutBatch>(`/admin/payouts/${id}/decision`, { decision, ...opts }); }
  resubmitBatch(id: string, by: string) { return this.http.post<PayoutBatch>(`/admin/payouts/${id}/resubmit`, { by }); }
  startDisbursement(id: string, by: string) { return this.http.post<PayoutBatch>(`/admin/payouts/${id}/disburse`, { by }); }
  retryPayout(id: string, _memberId: string, by: string) { return this.http.post<PayoutBatch>(`/admin/payouts/${id}/retry`, { memberId: _memberId, by }); }
  markPayoutPaid(id: string, memberId: string, opts: { method: string; proof: string; note: string; by: string }) { return this.http.post<PayoutBatch>(`/admin/payouts/${id}/mark-paid`, { memberId, ...opts }); }
  runReport(kind: ReportKind, year: number, month?: number | 'all', status?: string) {
    const p = new URLSearchParams({ kind, year: String(year), ...(month !== undefined ? { month: String(month) } : {}), ...(status ? { status } : {}) });
    return this.http.get<ReportResult>(`/admin/reports?${p}`);
  }
  referralGroups() { return this.http.get<ReferralGroup[]>('/admin/referrals'); }
  listAuditLog() { return this.http.get<AuditEntry[]>('/admin/audit-log'); }
  logAudit(e: { at: string; actor: string; role: string; action: string; entity: string; change: string; category: AuditEntry['category'] }) { return this.http.post<AuditEntry>('/admin/audit-log', e); }
  listAdmins() { return this.http.get<AdminListItem[]>('/admin/users'); }
  inviteAdmin(input: { name: string; email: string; role: AdminListItem['role'] }) { return this.http.post<AdminListItem>('/admin/users/invite', input); }
  setAdminStatus(id: string, status: AdminListItem['status']) { return this.http.post<AdminListItem>(`/admin/users/${id}/status`, { status }); }
  getNotifications() { return this.http.get<NotificationSettings>('/admin/notification-settings'); }
  saveNotifications(s: NotificationSettings) { return this.http.put<NotificationSettings>('/admin/notification-settings', s); }
  currentAdmin(_role: AdminRole) { return this.http.get<AdminUser>('/admin/me'); }
}
