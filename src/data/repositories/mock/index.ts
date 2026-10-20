import type { AdminListItem, AdminRole, AdminUser, Allocation, AuditEntry, InterestCalcRow, InterestScope, InterestWorkflow, Kobo, MonthIndex, NotificationSettings, PayoutBatch, Registration, ReportKind, ReportResult, Session, Testimonial, Transaction } from '@/domain/entities';
import type { AdminRepository, AuthRepository, ChangeField, ContributionIntent, ContributionRepository, MemberQuery, MemberRepository, NewRegistration, RegistrationRepository, SettingsRepository, TestimonialRepository, VerifiedContribution } from '@/domain/repositories';
import { DEFAULT_SETTINGS, MONTHS_SHORT, autoLocksAfter, canLock, chargeBreakdown, formatNaira, minimumFor, naira, planAllocation, type PlatformSettings } from '@/domain/rules';
import type { Clock } from '@/domain/services/clock';
import { adminUsers, auditEntries, interestYears, memberSummaries, members, payoutBatches, registrations, savingsYears, testimonials, transactions } from '@/data/mock/seed';

const delay = <T,>(v: T, ms = 250) => new Promise<T>(r => setTimeout(() => r(structuredClone(v)), ms));
const notFound = (what: string) => new Error(`${what} not found`);
const ref = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const admins: AdminUser[] = adminUsers.map(({ id, name, email, role, status }) => ({ id, name, email, role, status }));

export class MockAuthRepository implements AuthRepository {
  async login(identifier: string, _password: string): Promise<Session> {
    const id = identifier.trim().toLowerCase();
    const admin = admins.find(a => a.email === id); if (admin) return delay({ kind: 'admin', admin });
    const reg = registrations.find(r => r.email === id && r.status !== 'Approved'); if (reg) return delay({ kind: 'pending', registration: reg });
    const digits = id.replace(/\D/g, '');
    const isPhone = digits.length >= 10 && !id.includes('@');
    const member = members.find(m => m.email === id || (isPhone && m.phone.replace(/\D/g, '').endsWith(digits.slice(-10))));
    if (!member) throw new Error('Email, phone number or password is incorrect.');
    if (member.status === 'Suspended') throw new Error('Your account is suspended. Please contact Iconic Wealth Hub.');
    return delay({ kind: 'member', member });
  }
  async logout() { await delay(null, 50); }
  async requestPasswordReset() { await delay(null); }
}

export class MockRegistrationRepository implements RegistrationRepository {
  constructor(private readonly clock: Clock) {}
  async sendEmailCode() { await delay(null); }
  async verifyEmailCode(_email: string, code: string) { return delay(/^\d{6}$/.test(code)); } // demo: any 6 digits
  async submit(r: NewRegistration): Promise<Registration> {
    const reg: Registration = { id: ref('R'), firstName: r.firstName, lastName: r.lastName, gender: 'Female', dateOfBirth: r.dateOfBirth, email: r.email, phone: r.phone,
      stateOfResidence: r.stateOfResidence, address: r.address, heardAboutUs: r.heardAboutUs, referredBy: r.referredBy || undefined, nextOfKin: r.nextOfKin,
      submittedAt: this.clock.now().toISOString(), status: 'New' };
    registrations.unshift(reg); return delay(reg);
  }
}

const settings: PlatformSettings = structuredClone(DEFAULT_SETTINGS);
const yearOf = (id: string, year: number) => { const y = savingsYears.find(x => x.memberId === id && x.year === year); if (!y) throw notFound('Savings year'); return y; };
const memberOf = (id: string) => { const m = members.find(x => x.id === id); if (!m) throw notFound('Member'); return m; };

export class MockSettingsRepository implements SettingsRepository {
  async get() { return delay(settings, 50); }
  async save(patch: { minimumByYear?: Record<number, Kobo>; cutoffMonth?: MonthIndex; payoutDates?: Record<number, string> }) {
    if (patch.minimumByYear) settings.minimumByYear = { ...settings.minimumByYear, ...patch.minimumByYear };
    if (patch.cutoffMonth !== undefined) settings.cutoffMonth = patch.cutoffMonth;
    if (patch.payoutDates) settings.payoutDates = { ...settings.payoutDates, ...patch.payoutDates };
    return delay(settings, 50);
  }
}
export class MockTestimonialRepository implements TestimonialRepository {
  async listPublished() { return delay(testimonials.filter(t => t.status === 'Published').sort((a, b) => a.order - b.order), 80); }
  async listAll() { return delay([...testimonials].sort((a, b) => a.order - b.order), 80); }
  async save(t: { id?: string; name: string; descriptor: string; quote: string; status: Testimonial['status'] }) {
    if (t.id) { const x = testimonials.find(y => y.id === t.id); if (!x) throw notFound('Testimonial'); Object.assign(x, t); return delay(x); }
    const created: Testimonial = { ...t, id: `T${Date.now().toString(36).toUpperCase()}`, order: Math.max(...testimonials.map(y => y.order)) + 1 };
    testimonials.push(created); return delay(created);
  }
  async setStatus(id: string, status: Testimonial['status']) {
    const x = testimonials.find(y => y.id === id); if (!x) throw notFound('Testimonial'); x.status = status; return delay(x);
  }
  async move(id: string, direction: -1 | 1) {
    const sorted = [...testimonials].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex(y => y.id === id), j = i + direction;
    if (i < 0 || j < 0 || j >= sorted.length) throw new Error('Cannot move further.');
    [sorted[i].order, sorted[j].order] = [sorted[j].order, sorted[i].order];
    return delay([...testimonials].sort((a, b) => a.order - b.order));
  }
  async remove(id: string) { const i = testimonials.findIndex(y => y.id === id); if (i < 0) throw notFound('Testimonial'); testimonials.splice(i, 1); await delay(null, 50); }
}

export class MockMemberRepository implements MemberRepository {
  constructor(private readonly clock: Clock) {}
  async getMember(id: string) { return delay(memberOf(id)); }
  async getSavingsYear(id: string, year: number) { return delay(yearOf(id, year)); }
  async resolveAccountName(_bank: string, accountNumber: string) { return delay(accountNumber.length === 10 ? 'ACCOUNT HOLDER NAME' : ''); }
  async savePayoutAccount(id: string, a: { bankCode: string; bankName: string; accountNumber: string }) {
    const m = memberOf(id); m.payoutAccount = { ...a, accountName: `${m.firstName} ${m.lastName}`.toUpperCase(), verifiedAt: this.clock.now().toISOString() }; m.onboarding = 'Target';
    return delay(m.payoutAccount);
  }
  async setTarget(id: string, year: number, month: MonthIndex | null, amount: Kobo, applyToFollowing: boolean) {
    const y = yearOf(id, year);
    if (applyToFollowing || month === null) { y.target = amount; if (month !== null) for (let k = month + 1; k < 12; k++) delete y.targets[k]; }
    if (month !== null) y.targets[month] = amount;
    return delay(y);
  }
  async lockMonth(id: string, year: number, month: MonthIndex) {
    const y = yearOf(id, year);
    if (!canLock(y, transactions.filter(t => t.memberId === id), month, this.clock.now(), settings)) throw new Error('This month can’t be locked yet.');
    y.locks[month] = { by: 'member', on: this.clock.now().toISOString() }; return delay(y);
  }
  async markCommunityJoined(id: string) { const m = memberOf(id); if (m.community === 'Eligible') m.community = 'Granted'; await delay(null, 50); }
  async requestChange(_id: string, _field: ChangeField, _value: string, _reason: string) { await delay(null); }
  async completeOnboarding(id: string) { memberOf(id).onboarding = 'Complete'; await delay(null, 50); }
  async listTransactions(id: string) { return delay(transactions.filter(t => t.memberId === id)); }
  async listNotifications() { return delay([]); }
}

export class MockContributionRepository implements ContributionRepository {
  private intents = new Map<string, { memberId: string; year: number; allocations: Allocation[]; amount: Kobo }>();
  constructor(private readonly clock: Clock, private readonly outcomeFor: (reference: string) => 'Successful' | 'Failed' | 'Pending') {}
  async initiate(memberId: string, year: number, amount: Kobo): Promise<ContributionIntent> {
    const y = yearOf(memberId, year), m = memberOf(memberId);
    const plan = planAllocation(amount, y, transactions.filter(t => t.memberId === memberId), this.clock.now(), settings);
    if (!plan.ok) throw new Error(plan.error);
    const reference = ref('IWH-C'); this.intents.set(reference, { memberId, year, allocations: plan.allocations, amount });
    return delay({ reference, amountKobo: amount, platformChargeKobo: chargeBreakdown(amount, settings.platformCharge).platformCharge, allocations: plan.allocations, email: m.email });
  }
  async verify(reference: string): Promise<VerifiedContribution> {
    const i = this.intents.get(reference); if (!i) throw notFound('Payment');
    const status = this.outcomeFor(reference); const m = memberOf(i.memberId); const now = this.clock.now();
    const tx: Transaction = { id: ref('TX'), reference, gatewayReference: status === 'Pending' ? undefined : ref('T'), memberId: i.memberId, memberName: `${m.firstName} ${m.lastName}`,
      kind: 'Contribution', year: i.year, allocations: i.allocations, amountKobo: i.amount, platformChargeKobo: chargeBreakdown(i.amount, settings.platformCharge).platformCharge,
      status, late: false, failureReason: status === 'Failed' ? 'Declined by your bank: insufficient funds' : undefined, createdAt: now.toISOString() };
    transactions.unshift(tx);
    let communityUnlocked = false;
    if (status === 'Successful') {
      const y = yearOf(i.memberId, i.year);
      y.locks = autoLocksAfter(y, transactions.filter(t => t.memberId === i.memberId), settings, now.toISOString());
      if (m.community === 'Locked' && i.amount >= minimumFor(settings, i.year)) { m.community = 'Eligible'; communityUnlocked = true; }
    }
    return delay({ transaction: tx, communityUnlocked });
  }
}

const notifications: NotificationSettings = {
  channels: ['In-app', 'Email', 'SMS', 'WhatsApp'],
  events: [
    { key: 'due', label: 'Payment due reminder' }, { key: 'ok', label: 'Payment received' },
    { key: 'fail', label: 'Payment failed' }, { key: 'pay', label: 'Payout ready' },
    { key: 'reg', label: 'New registration' }, { key: 'ann', label: 'Year-end announcement' },
  ],
  matrix: {
    due: { 'In-app': true, Email: true, SMS: true, WhatsApp: false },
    ok: { 'In-app': true, Email: true, SMS: false, WhatsApp: false },
    fail: { 'In-app': true, Email: true, SMS: true, WhatsApp: false },
    pay: { 'In-app': true, Email: true, SMS: true, WhatsApp: true },
    reg: { 'In-app': true, Email: true, SMS: false, WhatsApp: false },
    ann: { 'In-app': true, Email: true, SMS: false, WhatsApp: false },
  },
  reminderDays: 3,
};

const interestOf = (year: number) => { const w = interestYears.find(x => x.year === year); if (!w) throw notFound('Interest configuration'); return w; };
const calcPreview = (rate: number, w?: InterestWorkflow): InterestCalcRow[] => {
  const total = memberSummaries.reduce((s, m) => s + m.savedKobo, 0) || 1;
  const inScope = (id: string) => !w || w.scope !== 'Selected members' || w.selectedMemberIds.includes(id);
  return memberSummaries.map(m => {
    const eligible = m.eligibility === 'Eligible' && inScope(m.id);
    return { memberId: m.id, memberName: m.name, contributionsKobo: m.savedKobo,
      sharePct: Math.round(m.savedKobo / total * 1000) / 10,
      interestKobo: eligible ? Math.round(m.savedKobo * rate / 100 / 100) * 100 : 0,
      eligible, reason: inScope(m.id) ? m.forfeitReason : 'Not selected for interest' };
  });
};
const batchOf = (id: string) => { const b = payoutBatches.find(x => x.id === id); if (!b) throw notFound('Payout batch'); return b; };
const completeBatchIfDone = (b: PayoutBatch) => {
  if (b.rows.every(r => r.status === 'Paid' || r.status === 'Paid manually')) {
    b.status = 'Completed'; b.history.push([new Date().toISOString(), 'All transfers paid · batch completed', 'System']);
    const w = interestYears.find(x => x.year === b.year); if (w) w.status = 'Paid out';
  } else if (b.rows.some(r => r.status === 'Failed')) b.status = 'Partial';
};

export class MockAdminRepository implements AdminRepository {
  async dashboard() {
    return delay({ members: 1248, activeSavers: 1106, totalSavingsKobo: naira(246_800_000), pendingPayments: 2, eligible: 1019, forfeited: 87,
      monthlyPaid: MONTHS_SHORT.slice(0, 9).map((month, i) => ({ month, paid: i < 8 ? 1080 - i * 6 : 842, due: i < 8 ? 26 + i * 6 : 264 })) });
  }
  async listMembers(q: MemberQuery) {
    const s = q.search.trim().toLowerCase();
    return delay(memberSummaries.filter(m =>
      (q.tab === 'All' || (q.tab === 'Active' && m.status === 'Active') || (q.tab === 'Suspended' && m.status === 'Suspended') || (q.tab === 'NotPaid' && m.currentMonthStatus !== 'Paid') || (q.tab === 'Forfeited' && m.eligibility === 'Forfeited'))
      && (!s || `${m.name} ${m.id}`.toLowerCase().includes(s)) && (!q.eligibility || m.eligibility === q.eligibility)
      && (q.referred === undefined || q.referred === !!m.referredBy) && (!q.joinedYear || m.joinedOn.startsWith(q.joinedYear))), 120);
  }
  async countMembers() {
    const c = (f: (m: (typeof memberSummaries)[number]) => boolean) => memberSummaries.filter(f).length;
    return delay({ All: memberSummaries.length, Active: c(m => m.status === 'Active'), Suspended: c(m => m.status === 'Suspended'), NotPaid: c(m => m.currentMonthStatus !== 'Paid'), Forfeited: c(m => m.eligibility === 'Forfeited') }, 50);
  }
  async listRegistrations() { return delay(registrations); }
  async decideRegistration(id: string, decision: 'Approved' | 'Rejected', reason?: string) {
    const r = registrations.find(x => x.id === id); if (!r) throw notFound('Registration');
    if (r.status !== 'New') throw new Error('Only new registrations can be decided.');
    if (decision === 'Rejected' && !reason?.trim()) throw new Error('A reason is required to reject a registration.');
    r.status = decision;
    if (decision === 'Approved') r.memberId = `IWH-0${1251 + registrations.length + Math.floor(Math.random() * 40)}`;
    else r.reason = reason!.trim();
    return delay(r);
  }
  async savingsOverview(year: number) {
    void year;
    return delay({ rows: memberSummaries,
      monthly: MONTHS_SHORT.map((month, i) => ({ month, members: memberSummaries.filter(s => s.monthsPaid > i).length })) }, 120);
  }
  async listTransactions() {
    return delay([...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), 120);
  }
  async listInterest() {
    return delay(interestYears.map(({ year, status, rate, eligible, forfeited, contributionsKobo, interestKobo, maker, checker, approvedAt, batchId }) =>
      ({ year, status, rate, eligible, forfeited, contributionsKobo, interestKobo, maker, checker, approvedAt, batchId })), 120);
  }
  async getInterest(year: number) {
    const w = interestOf(year);
    return delay({ workflow: w, preview: w.rate ? calcPreview(w.rate, w) : [] }, 120);
  }
  async saveInterestPeriod(year: number, period: { start: string; end: string; close: string }) {
    const w = interestOf(year); if (w.closed) throw new Error('Closed years are read-only.');
    Object.assign(w, period);
    if (w.status === 'Not started' || w.status === 'Returned') w.status = 'Draft';
    w.done = Math.max(w.done, 1); w.stage = 2;
    w.history.push([new Date().toISOString(), 'Saved period setup', 'You']);
    return delay(w);
  }
  async saveInterestRules(year: number, rules: { rate: number; rounding: string; scope: InterestScope; selectedMemberIds: string[] }) {
    const w = interestOf(year); if (w.closed) throw new Error('Closed years are read-only.');
    if (rules.rate < 0.1 || rules.rate > 30) throw new Error('Rate must be between 0.1% and 30%.');
    if (rules.scope === 'Selected members' && rules.selectedMemberIds.length === 0) throw new Error('Select at least one member to apply interest to.');
    const scopeChanged = w.scope !== rules.scope || w.selectedMemberIds.join(',') !== rules.selectedMemberIds.join(',');
    if (w.rate !== rules.rate || scopeChanged) w.calc = false;
    w.rate = rules.rate; w.rounding = rules.rounding; w.scope = rules.scope; w.selectedMemberIds = rules.selectedMemberIds;
    if (w.status === 'Not started' || w.status === 'Returned') w.status = 'Draft';
    w.done = Math.max(w.done, 2); w.stage = 3;
    w.history.push([new Date().toISOString(), rules.scope === 'Selected members'
      ? `Set rate to ${rules.rate}% · interest for ${rules.selectedMemberIds.length} selected members`
      : `Set rate to ${rules.rate}% for all members`, 'You']);
    return delay(w);
  }
  async runInterestCalculation(year: number) {
    const w = interestOf(year); if (w.closed) throw new Error('Closed years are read-only.');
    if (!w.rate) throw new Error('Set a rate first.');
    const preview = calcPreview(w.rate, w);
    w.eligible = preview.filter(p => p.eligible).length; w.forfeited = preview.filter(p => !p.eligible).length;
    w.contributionsKobo = preview.reduce((s, p) => s + p.contributionsKobo, 0);
    w.interestKobo = preview.reduce((s, p) => s + p.interestKobo, 0);
    w.calc = true; w.done = Math.max(w.done, 3); w.stage = 4;
    w.history.push([new Date().toISOString(), 'Ran calculation', 'You']);
    return delay(w);
  }
  async submitInterest(year: number, note: string, by: string) {
    const w = interestOf(year); if (w.closed) throw new Error('Closed years are read-only.');
    if (!w.calc) throw new Error('Run the calculation first.');
    w.status = 'Pending approval'; w.note = note; w.maker = by;
    w.done = Math.max(w.done, 4); w.stage = 5;
    w.history.push([new Date().toISOString(), 'Submitted for approval', by]);
    return delay(w);
  }
  async decideInterest(year: number, decision: 'Approved' | 'Returned', opts: { by: string; role?: AdminRole; reason?: string }) {
    const w = interestOf(year); if (w.closed) throw new Error('Closed years are read-only.');
    if (opts.role && opts.role !== 'SuperAdmin') throw new Error('Only a Super Admin can approve.');
    if (opts.by === w.maker && opts.role !== 'SuperAdmin') throw new Error('You can’t approve your own work. A Super Admin must approve it.');
    if (decision === 'Approved') {
      w.status = 'Approved'; w.checker = opts.by; w.approvedAt = new Date().toISOString().slice(0, 10);
      w.done = Math.max(w.done, 5); w.stage = 6;
      w.history.push([new Date().toISOString(), 'Approved configuration', opts.by]);
    } else {
      if (!opts.reason?.trim()) throw new Error('A reason is required to return to maker.');
      w.status = 'Returned'; w.rejectReason = opts.reason.trim(); w.checker = opts.by; w.calc = false;
      w.done = 1; w.stage = 2;
      w.history.push([new Date().toISOString(), `Returned to maker: ${opts.reason.trim()}`, opts.by]);
    }
    return delay(w);
  }
  async createPayoutBatch(year: number, by: string) {
    const w = interestOf(year);
    if (w.status !== 'Approved') throw new Error('Approve the interest configuration first.');
    if (w.batchId) return delay(batchOf(w.batchId));
    const banks = ['GTBank', 'Access Bank', 'First Bank', 'UBA', 'Zenith Bank'];
    const batch: PayoutBatch = { id: `PB-${year}-12`, year, month: 'December', status: 'Awaiting approval', count: w.eligible,
      savingsKobo: w.contributionsKobo, interestKobo: w.interestKobo, maker: by, createdAt: new Date().toISOString(),
      rows: calcPreview(w.rate ?? 0, w).filter(p => p.eligible).map((p, i) => ({ memberId: p.memberId, memberName: p.memberName,
        savingsKobo: p.contributionsKobo, interestKobo: p.interestKobo, totalKobo: p.contributionsKobo + p.interestKobo,
        account: `${banks[i % banks.length]} •••• ${(1000 + i * 137).toString().slice(-4)}`, status: 'Pending',
        reference: `IWH-P-${String(year).slice(2)}1218-${(2000 + i * 53).toString(36).toUpperCase().padStart(4, '0')}` })),
      history: [[new Date().toISOString(), 'Batch created', by]] };
    payoutBatches.unshift(batch);
    w.batchId = batch.id; w.done = Math.max(w.done, 6); w.stage = 7;
    w.history.push([new Date().toISOString(), `Created payout batch ${batch.id}`, by]);
    return delay(batch);
  }
  async notifyInterest(year: number, by: string) {
    const w = interestOf(year);
    w.notified = true; w.done = 8; w.stage = 8;
    w.history.push([new Date().toISOString(), 'Notified members', by]);
    return delay(w);
  }
  async listPayoutBatches() { return delay(payoutBatches, 120); }
  async getPayoutBatch(id: string) { return delay(batchOf(id), 120); }
  async decideBatch(id: string, decision: 'Approved' | 'Returned', opts: { by: string; reason?: string }) {
    const b = batchOf(id);
    if (opts.by === b.maker) throw new Error('You can’t approve your own work. A Super Admin must approve it.');
    if (decision === 'Approved') {
      b.status = 'Approved'; b.checker = opts.by;
      b.history.push([new Date().toISOString(), 'Approved batch', opts.by]);
    } else {
      if (!opts.reason?.trim()) throw new Error('A reason is required.');
      b.status = 'Returned to maker'; b.returnReason = opts.reason.trim(); b.checker = opts.by;
      b.history.push([new Date().toISOString(), `Returned: ${opts.reason.trim()}`, opts.by]);
    }
    return delay(b);
  }
  async resubmitBatch(id: string, by: string) {
    const b = batchOf(id);
    b.status = 'Awaiting approval'; delete b.returnReason;
    b.history.push([new Date().toISOString(), 'Fixed and resubmitted', by]);
    return delay(b);
  }
  async startDisbursement(id: string, by: string) {
    void by;
    const b = batchOf(id);
    if (b.status !== 'Approved') throw new Error('Approve the batch first.');
    b.status = 'Processing';
    b.history.push([new Date().toISOString(), 'Disbursement started', 'System']);
    const failReasons = ['Beneficiary account closed', 'Account name does not match member name'];
    b.rows.forEach((r, i) => {
      if (r.status !== 'Pending') return;
      if (b.rows.length > 4 && (i === 2 || i === 5)) { r.status = 'Failed'; r.reason = failReasons[i === 2 ? 0 : 1]; }
      else { r.status = 'Paid'; delete r.reason; }
    });
    const failed = b.rows.filter(r => r.status === 'Failed').length;
    const paid = b.rows.filter(r => r.status === 'Paid').length;
    if (failed) { b.status = 'Partial'; b.history.push([new Date().toISOString(), `${paid} paid · ${failed} failed`, 'System']); }
    else completeBatchIfDone(b);
    return delay(b, 600);
  }
  async retryPayout(id: string, memberId: string, by: string) {
    void by;
    const b = batchOf(id);
    const r = b.rows.find(x => x.memberId === memberId); if (!r) throw notFound('Payout row');
    r.status = 'Paid'; delete r.reason;
    b.history.push([new Date().toISOString(), `Retried transfer to ${r.memberName}`, 'System']);
    completeBatchIfDone(b);
    return delay(b, 600);
  }
  async markPayoutPaid(id: string, memberId: string, opts: { method: string; proof: string; note: string; by: string }) {
    const b = batchOf(id);
    const r = b.rows.find(x => x.memberId === memberId); if (!r) throw notFound('Payout row');
    if (!opts.proof || !opts.note.trim()) throw new Error('Proof and a note are required.');
    r.status = 'Paid manually'; r.proof = opts.proof; delete r.reason;
    b.history.push([new Date().toISOString(), `Marked ${r.memberName} as paid manually (${opts.method})`, opts.by]);
    completeBatchIfDone(b);
    return delay(b);
  }
  async runReport(kind: ReportKind, year: number, month?: number | 'all', status?: string): Promise<ReportResult> {
    void year;
    const money = (kobo: number) => formatNaira(kobo);
    if (kind === 'collections') {
      const rows = MONTHS_SHORT.map((m, i) => {
        const txs = transactions.filter(t => t.kind === 'Contribution' && t.status === 'Successful' && new Date(t.createdAt).getMonth() === i);
        return [m, String(txs.length), money(txs.reduce((s, t) => s + t.amountKobo, 0))];
      });
      return delay({ headers: ['Month', 'Payments', 'Total saved'], rows }, 120);
    }
    if (kind === 'charges') {
      const rows = transactions.filter(t => t.platformChargeKobo > 0 && (month === undefined || month === 'all' || new Date(t.createdAt).getMonth() === month))
        .map(t => [t.createdAt.slice(0, 10), t.memberName, money(t.amountKobo), money(t.platformChargeKobo)]);
      return delay({ headers: ['Date', 'Member', 'Amount', 'Platform charge'], rows }, 120);
    }
    if (kind === 'eligibility') {
      const rows = memberSummaries.filter(m => !status || status === 'All' || m.eligibility === status)
        .map(m => [m.name, money(m.savedKobo), `${m.monthsPaid} of 11`, m.eligibility, m.forfeitReason ?? '—']);
      return delay({ headers: ['Member', 'Saved', 'Months saved', 'Status', 'Reason'], rows }, 120);
    }
    const rows = memberSummaries.filter(m => !status || status === 'All' || m.eligibility === status)
      .map(m => [m.name, m.id, `${m.monthsPaid} of 11`, money(m.savedKobo), m.currentMonthStatus, m.eligibility]);
    return delay({ headers: ['Member', 'Member ID', 'Months saved', 'Saved', 'September', 'Interest'], rows }, 120);
  }
  async referralGroups() {
    const map = new Map<string, { name: string; date: string; status: 'Saving' | 'Pending' | 'Inactive' | 'Not started' }[]>();
    const push = (referrer: string, e: { name: string; date: string; status: 'Saving' | 'Pending' | 'Inactive' | 'Not started' }) => {
      if (!referrer || referrer === '—') return;
      map.set(referrer, [...(map.get(referrer) ?? []), e]);
    };
    memberSummaries.forEach(m => push(m.referredBy ?? '', { name: m.name, date: m.joinedOn,
      status: m.status === 'Suspended' ? 'Inactive' : m.monthsPaid > 0 ? 'Saving' : 'Not started' }));
    registrations.filter(r => r.status === 'New').forEach(r => push(r.referredBy ?? '', { name: `${r.firstName} ${r.lastName}`, date: r.submittedAt, status: 'Pending' }));
    return delay([...map.entries()].map(([referrer, referred]) => ({ referrer, referred })).sort((a, b) => b.referred.length - a.referred.length), 120);
  }
  async listAuditLog() { return delay(auditEntries, 120); }
  async logAudit(e: { at: string; actor: string; role: string; action: string; entity: string; change: string; category: AuditEntry['category'] }) {
    const entry: AuditEntry = { ...e, id: `A${auditEntries.length + 1}` };
    auditEntries.unshift(entry); return delay(entry, 50);
  }
  async listAdmins(): Promise<AdminListItem[]> { return delay(adminUsers, 80); }
  async inviteAdmin(input: { name: string; email: string; role: AdminListItem['role'] }) {
    if (!/^\S+@\S+\.\S+$/.test(input.email)) throw new Error('Enter a valid work email.');
    if (adminUsers.some(a => a.email.toLowerCase() === input.email.toLowerCase())) throw new Error('An admin with this email already exists.');
    const created: AdminListItem = { ...input, id: `A-${adminUsers.length + 1}`, status: 'Invited', lastActive: '—' };
    adminUsers.push(created);
    admins.push({ id: created.id, name: created.name, email: created.email, role: created.role, status: created.status });
    return delay(created);
  }
  async setAdminStatus(id: string, status: AdminListItem['status']) {
    const a = adminUsers.find(x => x.id === id); if (!a) throw notFound('Admin user');
    a.status = status;
    const auth = admins.find(x => x.id === id); if (auth) auth.status = status;
    return delay(a);
  }
  async getNotifications() { return delay(notifications, 80); }
  async saveNotifications(s: NotificationSettings) { Object.assign(notifications, structuredClone(s)); return delay(notifications, 80); }
  async currentAdmin(role: AdminUser['role']) { return delay(admins.find(a => a.role === role)!); }
}
