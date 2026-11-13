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
});
