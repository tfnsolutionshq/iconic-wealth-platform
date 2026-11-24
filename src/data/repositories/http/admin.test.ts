import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@/data/api/httpClient';
import { HttpAdminRepository } from './index';

function stubFetch(status: number, payload: unknown) {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const repo = () =>
  new HttpAdminRepository(
    new HttpClient('https://api.example.com/api/v1', () => 'token'),
  );

const envelope = (data: unknown, meta: unknown = null) => ({
  success: true,
  message: 'OK',
  data,
  errors: null,
  meta,
});

afterEach(() => vi.unstubAllGlobals());

describe('HttpAdminRepository', () => {
  it('unwraps and normalises the paginated member list', async () => {
    const meta = {
      current_page: 1,
      per_page: 20,
      last_page: 1,
      total: 19,
    };
    stubFetch(
      200,
      envelope([
        {
          id: '1',
          member_id: 'IWH-00001',
          first_name: 'Ada',
          last_name: 'Obi',
          full_name: 'Ada Obi',
          email: 'ada@example.com',
          status: 'active',
          created_at: '2026-01-02T10:00:00Z',
          referred_by: null,
        },
      ], meta),
    );

    const page = await repo().listMembers({ tab: 'All', search: '' });

    expect(page).toEqual({
      data: [
        {
          id: 'IWH-00001',
          name: 'Ada Obi',
          status: 'Active',
          accountStatus: 'active',
          joinedOn: '2026-01-02',
          referredBy: undefined,
        },
      ],
      meta,
    });
  });

  it('requests the selected page', async () => {
    const fetchMock = stubFetch(
      200,
      envelope([], { current_page: 2, per_page: 20, last_page: 2, total: 21 }),
    );

    const page = await repo().listMembers({ tab: 'All', search: '', page: 2 });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(url).toContain('page=2');
    expect(page.meta.current_page).toBe(2);
  });

  it('sends the status and baseline filters', async () => {
    const fetchMock = stubFetch(200, envelope([], { current_page: 1, per_page: 20, last_page: 1, total: 0 }));

    await repo().listMembers({
      tab: 'All',
      search: '',
      status: 'pending_approval',
      baseline: 'above-50000',
    });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(url).toContain('status=pending_approval');
    expect(url).toContain('baseline=above-50000');
  });

  it('unwraps the member counts', async () => {
    stubFetch(
      200,
      envelope({ All: 10, Active: 8, Suspended: 2, NotPaid: 3, Forfeited: 1 }),
    );

    await expect(repo().countMembers()).resolves.toEqual({
      All: 10,
      Active: 8,
      Suspended: 2,
      NotPaid: 3,
      Forfeited: 1,
    });
  });

  it('unwraps and normalises the interest year list', async () => {
    stubFetch(
      200,
      envelope([
        {
          year: '2026',
          status: 'draft',
          rate: '12.5',
          rate_mode: 'fixed',
          eligible: '120',
          forfeited: '3',
          total_contributions: '5000000.00',
          total_interest: '625000.00',
          maker: 'Ada Obi',
          approved_by: null,
        },
      ]),
    );

    await expect(repo().listInterest()).resolves.toEqual([
      {
        year: 2026,
        status: 'Draft',
        rate: 12.5,
        rateMode: 'Fixed rate',
        eligible: 120,
        forfeited: 3,
        contributionsKobo: 500_000_000,
        interestKobo: 62_500_000,
        maker: 'Ada Obi',
      },
    ]);
  });

  it('accepts an interest list wrapped in a named collection', async () => {
    stubFetch(
      200,
      envelope({
        years: [
          {
            savings_year: 2025,
            status: 'paid_out',
            eligible_members: 40,
            contributions_kobo: 1_000_000,
            interest_kobo: 50_000,
          },
        ],
      }),
    );

    const [year] = await repo().listInterest();

    expect(year).toMatchObject({
      year: 2025,
      status: 'Paid out',
      eligible: 40,
      contributionsKobo: 1_000_000,
      interestKobo: 50_000,
    });
  });

  it('unwraps interest detail into a workflow and preview', async () => {
    stubFetch(
      200,
      envelope({
        workflow: {
          year: 2026,
          status: 'pending_approval',
          stage: '4',
          done: '3',
          start: '2026-01-01',
          end: '2026-12-31',
          close: '2027-01-15',
          rate: '10',
          eligible: 2,
          interest_kobo: 25_000,
          bands: [],
          selected_members: ['IWH-00001'],
          excluded_member_ids: [],
          history: [
            ['2026-11-01T10:00:00Z', 'Saved period setup', 'Ada Obi'],
          ],
        },
        preview: [
          {
            member_id: 'IWH-00001',
            member_name: 'Ada Obi',
            contributions: '150000.00',
            share_pct: '60',
            interest: '15000.00',
            eligible: true,
          },
        ],
      }),
    );

    const detail = await repo().getInterest(2026);

    expect(detail.workflow).toMatchObject({
      year: 2026,
      status: 'Pending approval',
      rateMode: 'Fixed rate',
      stage: 4,
      done: 3,
      selectedMemberIds: ['IWH-00001'],
      excludedMemberIds: [],
      eligible: 2,
      interestKobo: 25_000,
      history: [['2026-11-01T10:00:00Z', 'Saved period setup', 'Ada Obi']],
    });
    expect(detail.preview).toEqual([
      {
        memberId: 'IWH-00001',
        memberName: 'Ada Obi',
        contributionsKobo: 15_000_000,
        sharePct: 60,
        interestKobo: 1_500_000,
        eligible: true,
      },
    ]);
  });
});

describe('HttpAdminRepository referrals dashboard', () => {
  it('maps an empty dashboard without throwing', async () => {
    stubFetch(
      200,
      envelope({
        summary: {
          total_referred: 0,
          saving_now: 0,
          pending: 0,
          top_referrer: null,
        },
        referrers: [],
        referred_members: null,
      }),
    );

    await expect(repo().referralDashboard()).resolves.toEqual({
      summary: {
        totalReferred: 0,
        savingNow: 0,
        pending: 0,
        topReferrer: undefined,
      },
      groups: [],
    });
  });

  it('projects referrer rows and their referred members', async () => {
    const fetchMock = stubFetch(
      200,
      envelope({
        summary: {
          total_referred: 3,
          saving_now: 2,
          pending: 1,
          top_referrer: { name: 'Ada Obi', total_referred: 2 },
        },
        referrers: [
          {
            referrer: 'Ada Obi',
            total_referred: 2,
            saving_now: 1,
            pending: 1,
            latest: '2026-10-02',
            referred_members: [
              {
                name: 'Test Member A',
                joined_at: '2026-10-02',
                status: 'saving',
              },
              {
                first_name: 'Test',
                last_name: 'Member B',
                submitted_at: '2026-09-01',
                status: 'pending_approval',
              },
            ],
          },
          {
            referrer: 'Ngozi Obi',
            total_referred: 1,
            saving_now: 1,
            pending: 0,
            referred_members: [
              {
                name: 'Test Member C',
                date: '2026-08-15',
                status: 'active',
              },
            ],
          },
        ],
        referred_members: null,
      }),
    );

    const dashboard = await repo().referralDashboard();
    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(url).toContain('/admin/referrals-dashboard');
    expect(dashboard.summary).toMatchObject({
      totalReferred: 3,
      savingNow: 2,
      pending: 1,
      topReferrer: 'Ada Obi',
    });
    expect(dashboard.groups).toHaveLength(2);
    expect(dashboard.groups[0]).toMatchObject({
      referrer: 'Ada Obi',
      total: 2,
      saving: 1,
      pending: 1,
      latest: '2026-10-02',
      referred: [
        { name: 'Test Member A', date: '2026-10-02', status: 'Saving' },
        { name: 'Test Member B', date: '2026-09-01', status: 'Pending' },
      ],
    });

    await expect(repo().referralGroups()).resolves.toHaveLength(2);
  });

  it('groups a flat referred-members list when referrers are absent', async () => {
    stubFetch(
      200,
      envelope({
        summary: null,
        referrers: null,
        referred_members: [
          {
            referrer: 'Ada Obi',
            name: 'Test Member A',
            joined_at: '2026-10-02',
            status: 'saving',
          },
        ],
      }),
    );

    const dashboard = await repo().referralDashboard();

    expect(dashboard.groups).toEqual([
      {
        referrer: 'Ada Obi',
        referred: [
          { name: 'Test Member A', date: '2026-10-02', status: 'Saving' },
        ],
        total: 1,
        saving: 1,
        pending: 0,
        latest: '2026-10-02',
      },
    ]);
    expect(dashboard.summary).toMatchObject({
      totalReferred: 1,
      savingNow: 1,
      pending: 0,
      topReferrer: 'Ada Obi',
    });
  });

  it('sends the optional referral_id and search filters', async () => {
    const fetchMock = stubFetch(
      200,
      envelope({
        summary: null,
        referrers: [],
        referred_members: null,
      }),
    );

    await repo().referralDashboard({
      referral_id: 'ref-123',
      search: 'Ada Obi',
    });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(url).toContain('referral_id=ref-123');
    expect(url).toContain('search=Ada+Obi');
  });

  it('omits blank filters from the request', async () => {
    const fetchMock = stubFetch(
      200,
      envelope({ summary: null, referrers: [], referred_members: null }),
    );

    await repo().referralDashboard({ referral_id: '  ', search: '' });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(url).not.toContain('?');
/** Shape returned by GET /admin/reports: summary + filters + member rows. */
const platformReportPayload = {
  success: true,
  message: 'Platform report generated successfully.',
  data: {
    summary: {
      monthly_compliance: {
        month: 8,
        month_name: 'August',
        paid: 2,
        not_paid: 0,
        total_members: 2,
        compliance_rate: 100,
      },
      collections: { year_total: 351100, month_total: 30900, currency: 'NGN' },
      interest_eligibility: { eligible: 0, forfeited: 2, total: 2 },
      platform_charges: { year_total: 2600, month_total: 200, currency: 'NGN' },
    },
    filters: {
      year: 2026,
      month: 8,
      month_name: 'August',
      eligibility: 'all',
      search: null,
    },
    members: [
      {
        id: 'm-1',
        member: 'Test Member A',
        member_id: 'TEST01',
        months_saved: 11,
        total_months: 11,
        months_saved_label: '11 of 11',
        total_saved: 188600,
        total_saved_formatted: '₦188,600.00',
        month_status: 'Paid',
        interest: 'Forfeited',
        interest_status: 'forfeited',
        forfeiture_reason: 'Paid January to October after the 5th',
      },
      {
        id: 'm-2',
        member: 'Test Member B',
        member_id: 'TEST02',
        months_saved: 11,
        total_months: 11,
        months_saved_label: '11 of 11',
        total_saved: 162500,
        total_saved_formatted: '₦162,500.00',
        month_status: 'Paid',
        interest: 'Forfeited',
        interest_status: 'forfeited',
        forfeiture_reason: 'Paid January to October after the 5th',
      },
    ],
  },
  errors: null,
  meta: { current_page: 1, per_page: 15, last_page: 1, total: 2 },
};

describe('HttpAdminRepository reports', () => {
  it('projects the platform payload into all six report tables', async () => {
    const fetchMock = stubFetch(200, platformReportPayload);

    const result = await repo().getReports({ year: 2026, month: 8 });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(url).toContain('year=2026');
    expect(url).toContain('month=8');
    expect(result.year).toBe(2026);
    for (const key of [
      'compliance',
      'eligibility',
      'charges',
      'payout',
      'late',
      'savings',
    ] as const) {
      expect(result.reports[key].rows).toHaveLength(2);
    }
    expect(result.reports.compliance.rows[0]).toEqual([
      'TEST01',
      'Test Member A',
      'August 2026',
      'Paid',
    ]);
    expect(result.reports.eligibility.rows[0]).toEqual([
      'TEST01',
      'Test Member A',
      'Forfeited',
      'Paid January to October after the 5th',
    ]);
    expect(result.reports.savings.rows[0]).toEqual([
      'TEST01',
      'Test Member A',
      '—',
      '11 of 11',
      '₦188,600',
      'Paid',
    ]);
  });

  it('passes the all-months filter to the API', async () => {
    const fetchMock = stubFetch(200, platformReportPayload);

    await repo().getReports({ year: 2026, month: 'all' });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(url).toContain('month=all');
  });
});

describe('HttpAdminRepository audit logs', () => {
  const auditPayload = envelope(
    [
      {
        id: 'log-1',
        when: '19 Nov, 19:53',
        created_at: '2026-11-19T19:53:32+00:00',
        who: {
          id: 'u-1',
          name: 'Test Admin',
          role: 'Super Administrator',
          roles: ['super-admin'],
        },
        action: 'interest.config.approved',
        action_label: 'Approved interest config',
        summary: 'Test Admin - Approved interest config',
        record: 'record-1',
        change: '—',
        type: 'financial',
        type_label: 'Financial',
      },
    ],
    {
      current_page: 2,
      per_page: 15,
      last_page: 17,
      total: 247,
      counts: { all: 247, financial: 232, members: 13, access: 1, roles: 1 },
    },
  );

  it('maps the audit log payload and sends the filters', async () => {
    const fetchMock = stubFetch(200, auditPayload);

    const page = await repo().listAuditLog({
      type: 'financial',
      date: 'last_7_days',
      search: 'interest',
      per_page: 15,
      page: 2,
    });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(url).toContain('/admin/audit-logs?');
    expect(url).toContain('type=financial');
    expect(url).toContain('date=last_7_days');
    expect(url).toContain('search=interest');
    expect(url).toContain('per_page=15');
    expect(url).toContain('page=2');
    expect(page.rows).toEqual([
      {
        id: 'log-1',
        at: '2026-11-19T19:53:32+00:00',
        actor: 'Test Admin',
        role: 'Super Administrator',
        action: 'Approved interest config',
        entity: 'record-1',
        change: '—',
        category: 'Financial',
      },
    ]);
    expect(page.meta).toMatchObject({
      current_page: 2,
      last_page: 17,
      total: 247,
      counts: { all: 247, financial: 232 },
    });
  });

  it('omits blank filters from the request', async () => {
    const fetchMock = stubFetch(200, auditPayload);

    await repo().listAuditLog({ type: 'all', date: 'all', search: '  ' });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(url).toContain('type=all');
    expect(url).toContain('date=all');
    expect(url).not.toContain('search=');
  });
});
