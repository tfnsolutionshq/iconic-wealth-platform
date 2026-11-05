import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@/data/api/httpClient';
import { HttpSavingsTargetRepository } from './index';

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
  new HttpSavingsTargetRepository(
    new HttpClient('https://api.example.com/api/v1', () => 'token'),
  );

afterEach(() => vi.unstubAllGlobals());

describe('HttpSavingsTargetRepository', () => {
  it('posts the monthly target in naira to /savings/target', async () => {
    const fetchMock = stubFetch(200, {
      success: true,
      message: 'Target saved.',
      data: null,
      errors: null,
      meta: null,
    });

    await repo().setTarget('IWH-1', 2026, 1_500_000);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    expect(url).toBe('https://api.example.com/api/v1/savings/target');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ target_amount: 15000 });
  });
});
