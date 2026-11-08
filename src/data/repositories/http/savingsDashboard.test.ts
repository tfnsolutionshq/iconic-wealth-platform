import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@/data/api/httpClient';
import { HttpSavingsDashboardRepository } from './index';

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
  new HttpSavingsDashboardRepository(
    new HttpClient('https://api.example.com/api/v1', () => 'token'),
  );

afterEach(() => vi.unstubAllGlobals());

describe('HttpSavingsDashboardRepository', () => {
  it('fetches the months for a year and maps naira to kobo', async () => {
    const fetchMock = stubFetch(200, {
      success: true,
      message: 'Months retrieved.',
      data: [
        {
          id: 'm-1',
          year: 2026,
          month: 1,
          period: '2026-01',
          month_name: 'January',
          status: 'saved',
          status_label: 'Saved',
          target_amount: '20000.00',
          saved_amount: '25000.00',
          remaining_amount: '0.00',
          progress_percentage: 100,
          target_met: true,
          contributions_count: 2,
          close_note: 'Closed automatically after 6 Feb 2026',
          deadline: '2026-02-05T23:59:59+01:00',
        },
        {
          id: null,
          year: 2026,
          month: 11,
          period: '2026-11',
          month_name: 'November',
          status: 'upcoming',
          status_label: 'Upcoming',
          target_amount: null,
          saved_amount: '0.00',
          remaining_amount: '0.00',
          progress_percentage: null,
          target_met: false,
          contributions_count: 0,
          close_note: '',
          deadline: '2026-12-05T23:59:59+01:00',
        },
      ],
      errors: null,
      meta: null,
    });

    const months = await repo().getMonths(2026);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(url).toBe('https://api.example.com/api/v1/savings/months?year=2026');
    expect(months).toHaveLength(2);
    expect(months[0]).toMatchObject({
      id: 'm-1',
      year: 2026,
      month: 1,
      period: '2026-01',
      monthName: 'January',
      status: 'saved',
      targetAmount: 2_000_000,
      savedAmount: 2_500_000,
      remainingAmount: 0,
      progressPercentage: 100,
      targetMet: true,
      contributionsCount: 2,
      closeNote: 'Closed automatically after 6 Feb 2026',
    });
    expect(months[1]).toMatchObject({
      id: null,
      month: 11,
      targetAmount: null,
      savedAmount: 0,
    });
  });
});
