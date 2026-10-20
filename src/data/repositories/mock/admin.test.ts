import { describe, expect, it } from 'vitest';
import { MockAdminRepository, MockSettingsRepository, MockTestimonialRepository } from './index';

describe('MockAdminRepository transactions & registrations', () => {
  const admin = new MockAdminRepository();
  it('lists failed, pending and payout transactions', async () => {
    const txs = await admin.listTransactions();
    expect(txs.some(t => t.status === 'Failed')).toBe(true);
    expect(txs.some(t => t.status === 'Pending')).toBe(true);
    expect(txs.some(t => t.kind === 'Payout')).toBe(true);
  });
  it('rejects decisions without a reason or on decided registrations', async () => {
    await expect(admin.decideRegistration('R-1041', 'Rejected')).rejects.toThrow();
    await expect(admin.decideRegistration('R-1040', 'Approved')).rejects.toThrow();
  });
  it('approves a new registration and opens an account', async () => {
    const r = await admin.decideRegistration('R-1041', 'Approved');
    expect(r.status).toBe('Approved');
    expect(r.memberId).toMatch(/^IWH-/);
  });
});

describe('MockAdminRepository savings, reports, referrals, audit', () => {
  const admin = new MockAdminRepository();
  it('returns savings rows and 12 monthly counts', async () => {
    const d = await admin.savingsOverview(2026);
    expect(d.rows.length).toBeGreaterThan(0);
    expect(d.monthly).toHaveLength(12);
  });
  it('runs each report kind', async () => {
    for (const kind of ['compliance', 'collections', 'eligibility', 'charges'] as const) {
      const r = await admin.runReport(kind, 2026, 'all', 'All');
      expect(r.headers.length).toBeGreaterThan(0);
      expect(r.rows.length).toBeGreaterThan(0);
    }
  });
  it('builds referral groups with pending registrations', async () => {
    const groups = await admin.referralGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.flatMap(g => g.referred).some(r => r.status === 'Pending')).toBe(true);
  });
  it('appends audit entries', async () => {
    const before = (await admin.listAuditLog()).length;
    await admin.logAudit({ at: new Date().toISOString(), actor: 'Test Admin', role: 'Administrator', action: 'Test action', entity: 'T-1', change: '—', category: 'Access' });
    expect((await admin.listAuditLog()).length).toBe(before + 1);
  });
});

describe('MockAdminRepository interest → payout flow', () => {
  const admin = new MockAdminRepository();
  it('runs the 8-stage workflow with maker-checker', async () => {
    await admin.saveInterestPeriod(2026, { start: '2026-01-01', end: '2026-11-30', close: '2027-01-05' });
    const rules = await admin.saveInterestRules(2026, { rate: 10, rounding: 'Nearest naira', scope: 'All members', selectedMemberIds: [] });
    expect(rules.rate).toBe(10);
    expect(rules.scope).toBe('All members');
    const calc = await admin.runInterestCalculation(2026);
    expect(calc.calc).toBe(true);
    expect(calc.eligible + calc.forfeited).toBeGreaterThan(0);
    const submitted = await admin.submitInterest(2026, 'Looks good', 'Adaeze Okafor');
    expect(submitted.status).toBe('Pending approval');
    await expect(admin.decideInterest(2026, 'Approved', { by: 'Adaeze Okafor' })).rejects.toThrow();
    const approved = await admin.decideInterest(2026, 'Approved', { by: 'Olumide Bakare' });
    expect(approved.status).toBe('Approved');
    const batch = await admin.createPayoutBatch(2026, 'Adaeze Okafor');
    expect(batch.status).toBe('Awaiting approval');
    expect(batch.rows.length).toBeGreaterThan(0);
    await admin.decideBatch(batch.id, 'Approved', { by: 'Olumide Bakare' });
    const disbursed = await admin.startDisbursement(batch.id, 'Adaeze Okafor');
    expect(['Partial', 'Completed']).toContain(disbursed.status);
    for (const row of disbursed.rows.filter(r => r.status === 'Failed')) {
      await admin.retryPayout(batch.id, row.memberId, 'Adaeze Okafor');
    }
    const done = await admin.getPayoutBatch(batch.id);
    expect(done.status).toBe('Completed');
    const notified = await admin.notifyInterest(2026, 'Adaeze Okafor');
    expect(notified.notified).toBe(true);
    expect(notified.done).toBe(8);
  });
  it('lets a Super Admin make and approve their own interest request, but not other roles', async () => {
    await admin.saveInterestPeriod(2026, { start: '2026-01-01', end: '2026-11-30', close: '2027-01-05' });
    await admin.saveInterestRules(2026, { rate: 12, rounding: 'Nearest kobo', scope: 'All members', selectedMemberIds: [] });
    await admin.runInterestCalculation(2026);
    await admin.submitInterest(2026, 'Self review', 'Olumide Bakare');
    await expect(admin.decideInterest(2026, 'Approved', { by: 'Olumide Bakare', role: 'Administrator' })).rejects.toThrow('Only a Super Admin');
    await expect(admin.decideInterest(2026, 'Approved', { by: 'Olumide Bakare' })).rejects.toThrow('approve your own work');
    const approved = await admin.decideInterest(2026, 'Approved', { by: 'Olumide Bakare', role: 'SuperAdmin' });
    expect(approved.status).toBe('Approved');
    expect(approved.checker).toBe('Olumide Bakare');
  });
});

describe('MockTestimonialRepository admin', () => {
  const repo = new MockTestimonialRepository();
  it('adds, publishes, reorders and deletes', async () => {
    const created = await repo.save({ name: 'Test T.', descriptor: 'Member since 2026 · Lagos', quote: 'A long enough testimonial for testing.', status: 'Draft' });
    await repo.setStatus(created.id, 'Published');
    expect((await repo.listAll()).some(t => t.id === created.id && t.status === 'Published')).toBe(true);
    await repo.move(created.id, -1);
    await repo.remove(created.id);
    expect((await repo.listAll()).some(t => t.id === created.id)).toBe(false);
  });
});

describe('MockSettingsRepository save', () => {
  const repo = new MockSettingsRepository();
  it('updates the minimum for a year', async () => {
    const s = await repo.save({ minimumByYear: { 2027: 15000 } });
    expect(s.minimumByYear[2027]).toBe(15000);
  });
});
