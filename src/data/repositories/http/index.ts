/**
 * HTTP implementations of the domain ports. Endpoint paths are a PROPOSED contract for the backend team;
 * agree them in Sprint 0 and keep this file as the single place that knows URLs and payload shapes.
 * Money is exchanged in kobo (integers).
 */
import type { AdminListItem, AdminRole, AdminUser, AuditEntry, InterestCalcRow, InterestWorkflow, InterestYearSummary, Kobo, Member, MemberNotification, MemberSummary, MonthIndex, NotificationSettings, PayoutAccount, PayoutBatch, ReferralGroup, Registration, ReportKind, ReportResult, SavingsYear, Session, Testimonial, Transaction } from '@/domain/entities';
import type { PlatformSettings } from '@/domain/rules';
import type { AdminRepository, AuthRepository, ChangeField, ContributionIntent, ContributionRepository, MemberQuery, MemberRepository, NewRegistration, RegistrationRepository, SettingsRepository, TestimonialRepository, VerifiedContribution } from '@/domain/repositories';
import type { HttpClient } from '@/data/api/httpClient';

export class HttpAuthRepository implements AuthRepository {
  constructor(private readonly http: HttpClient, private readonly onToken: (t: string | null) => void) {}
  async login(identifier: string, password: string) { const r = await this.http.post<{ token: string; session: Session }>('/auth/login', { identifier, password }); this.onToken(r.token); return r.session; }
  async logout() { await this.http.post('/auth/logout'); this.onToken(null); }
  async requestPasswordReset(identifier: string) { await this.http.post('/auth/password-reset', { identifier }); }
}
export class HttpRegistrationRepository implements RegistrationRepository {
  constructor(private readonly http: HttpClient) {}
  async sendEmailCode(email: string) { await this.http.post('/registrations/email-code', { email }); }
  async verifyEmailCode(email: string, code: string) { return (await this.http.post<{ verified: boolean }>('/registrations/email-code/verify', { email, code })).verified; }
  submit(r: NewRegistration) { return this.http.post<Registration>('/registrations', r); }
}
export class HttpMemberRepository implements MemberRepository {
  constructor(private readonly http: HttpClient) {}
  getMember(id: string) { return this.http.get<Member>(`/members/${id}`); }
  getSavingsYear(id: string, year: number) { return this.http.get<SavingsYear>(`/members/${id}/savings/${year}`); }
  savePayoutAccount(id: string, a: { bankCode: string; bankName: string; accountNumber: string }) { return this.http.put<PayoutAccount>(`/members/${id}/payout-account`, a); }
  async resolveAccountName(bankCode: string, accountNumber: string) { return (await this.http.get<{ accountName: string }>(`/banks/${bankCode}/resolve?account=${accountNumber}`)).accountName; }
  setTarget(id: string, year: number, month: MonthIndex | null, amountKobo: Kobo, applyToFollowing: boolean) { return this.http.put<SavingsYear>(`/members/${id}/savings/${year}/target`, { month, amountKobo, applyToFollowing }); }
  lockMonth(id: string, year: number, month: MonthIndex) { return this.http.post<SavingsYear>(`/members/${id}/savings/${year}/months/${month}/lock`); }
  async markCommunityJoined(id: string) { await this.http.post(`/members/${id}/community/joined`); }
  async requestChange(id: string, field: ChangeField, newValue: string, reason: string) { await this.http.post(`/members/${id}/change-requests`, { field, newValue, reason }); }
  async completeOnboarding(id: string) { await this.http.post(`/members/${id}/onboarding/complete`); }
  listTransactions(id: string) { return this.http.get<Transaction[]>(`/members/${id}/transactions`); }
  listNotifications(id: string) { return this.http.get<MemberNotification[]>(`/members/${id}/notifications`); }
}
export class HttpContributionRepository implements ContributionRepository {
  constructor(private readonly http: HttpClient) {}
  initiate(memberId: string, year: number, amountKobo: Kobo) { return this.http.post<ContributionIntent>('/contributions', { memberId, year, amountKobo }); }
  verify(reference: string) { return this.http.post<VerifiedContribution>(`/contributions/${reference}/verify`); }
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
  dashboard(year: number) { return this.http.get<Awaited<ReturnType<AdminRepository['dashboard']>>>(`/admin/dashboard?year=${year}`); }
  listMembers(q: MemberQuery) { const p = new URLSearchParams({ tab: q.tab, search: q.search, ...(q.eligibility ? { eligibility: q.eligibility } : {}), ...(q.joinedYear ? { joinedYear: q.joinedYear } : {}), ...(q.referred !== undefined ? { referred: String(q.referred) } : {}) }); return this.http.get<MemberSummary[]>(`/admin/members?${p}`); }
  countMembers() { return this.http.get<Record<MemberQuery['tab'], number>>('/admin/members/counts'); }
  listRegistrations() { return this.http.get<Registration[]>('/admin/registrations'); }
  decideRegistration(id: string, decision: 'Approved' | 'Rejected', reason?: string) { return this.http.post<Registration>(`/admin/registrations/${id}/decision`, { decision, reason }); }
  savingsOverview(year: number) { return this.http.get<{ rows: MemberSummary[]; monthly: { month: string; members: number }[] }>(`/admin/savings?year=${year}`); }
  listTransactions() { return this.http.get<Transaction[]>('/admin/transactions'); }
  listInterest() { return this.http.get<InterestYearSummary[]>('/admin/interest'); }
  getInterest(year: number) { return this.http.get<{ workflow: InterestWorkflow; preview: InterestCalcRow[] }>(`/admin/interest/${year}`); }
  saveInterestPeriod(year: number, period: { start: string; end: string; close: string }) { return this.http.put<InterestWorkflow>(`/admin/interest/${year}/period`, period); }
  saveInterestRules(year: number, rules: { rate: number; rounding: string }) { return this.http.put<InterestWorkflow>(`/admin/interest/${year}/rules`, rules); }
  runInterestCalculation(year: number) { return this.http.post<InterestWorkflow>(`/admin/interest/${year}/calculate`); }
  submitInterest(year: number, note: string, by: string) { return this.http.post<InterestWorkflow>(`/admin/interest/${year}/submit`, { note, by }); }
  decideInterest(year: number, decision: 'Approved' | 'Returned', opts: { by: string; reason?: string }) { return this.http.post<InterestWorkflow>(`/admin/interest/${year}/decision`, { decision, ...opts }); }
  createPayoutBatch(year: number, by: string) { return this.http.post<PayoutBatch>(`/admin/interest/${year}/batch`, { by }); }
  notifyInterest(year: number, by: string) { return this.http.post<InterestWorkflow>(`/admin/interest/${year}/notify`, { by }); }
  listPayoutBatches() { return this.http.get<PayoutBatch[]>('/admin/payouts'); }
  getPayoutBatch(id: string) { return this.http.get<PayoutBatch>(`/admin/payouts/${id}`); }
  decideBatch(id: string, decision: 'Approved' | 'Returned', opts: { by: string; reason?: string }) { return this.http.post<PayoutBatch>(`/admin/payouts/${id}/decision`, { decision, ...opts }); }
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
