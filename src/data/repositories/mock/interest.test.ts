import { describe, expect, it } from 'vitest';
import { naira } from '@/domain/rules';
import { MockAdminRepository } from './index';

describe('MockAdminRepository contribution-range interest', () => {
  const admin = new MockAdminRepository();

  it('applies the rate for the band a member’s savings fall into', async () => {
    await admin.saveInterestPeriod(2026, { start: '2026-01-01', end: '2026-11-30', close: '2027-01-05' });
    const rules = await admin.saveInterestRules(2026, {
      rateMode: 'Contribution ranges',
      rate: null,
      bands: [
        { minKobo: naira(10_000), maxKobo: naira(100_000), rate: 8 },
        { minKobo: naira(100_001), maxKobo: null, rate: 12 },
      ],
      rounding: 'Nearest naira',
      scope: 'All members',
      selectedMemberIds: [],
    });
    expect(rules.rateMode).toBe('Contribution ranges');
    expect(rules.rate).toBeNull();
    expect(rules.bands).toHaveLength(2);

    await admin.runInterestCalculation(2026);
    const { preview } = await admin.getInterest(2026);
    const funmi = preview.find((p) => p.memberId === 'IWH-00412');
    expect(funmi?.rate).toBe(12);
    expect(funmi?.interestKobo).toBe(naira(235_000 * 12 / 100));
  });

  it('requires the lowest band to start at ₦10,000 and rejects overlaps', async () => {
    await expect(admin.saveInterestRules(2026, {
      rateMode: 'Contribution ranges',
      rate: null,
      bands: [{ minKobo: naira(5_000), maxKobo: null, rate: 10 }],
      rounding: 'Nearest naira',
      scope: 'All members',
      selectedMemberIds: [],
    })).rejects.toThrow(/10,000/);

    await expect(admin.saveInterestRules(2026, {
      rateMode: 'Contribution ranges',
      rate: null,
      bands: [
        { minKobo: naira(10_000), maxKobo: naira(50_000), rate: 8 },
        { minKobo: naira(50_000), maxKobo: null, rate: 12 },
      ],
      rounding: 'Nearest naira',
      scope: 'All members',
      selectedMemberIds: [],
    })).rejects.toThrow(/overlap/i);
  });

  it('removes a member from the preview and the payout batch, and can restore them', async () => {
    const before = await admin.getInterest(2026);
    expect(before.preview.find((p) => p.memberId === 'IWH-00412')?.eligible).toBe(true);

    const excluded = await admin.setInterestExclusions(2026, ['IWH-00412']);
    expect(excluded.excludedMemberIds).toContain('IWH-00412');
    expect(excluded.eligible).toBe(before.workflow.eligible - 1);
    expect((await admin.getInterest(2026)).preview.some((p) => p.memberId === 'IWH-00412')).toBe(false);

    const restored = await admin.setInterestExclusions(2026, []);
    expect(restored.excludedMemberIds).toEqual([]);
    expect((await admin.getInterest(2026)).preview.some((p) => p.memberId === 'IWH-00412')).toBe(true);

    await admin.setInterestExclusions(2026, ['IWH-00412']);
    await admin.submitInterest(2026, '', 'Adaeze Okafor');
    const approved = await admin.decideInterest(2026, 'Approved', { by: 'Olumide Bakare', role: 'SuperAdmin' });
    const batch = await admin.createPayoutBatch(2026, 'Adaeze Okafor');
    expect(batch.rows.some((r) => r.memberId === 'IWH-00412')).toBe(false);
    expect(batch.rows).toHaveLength(approved.eligible);
  });
});
