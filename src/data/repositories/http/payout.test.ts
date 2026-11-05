import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@/data/api/httpClient';
import { HttpPayoutAccountRepository } from './index';

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
  new HttpPayoutAccountRepository(new HttpClient('https://api.example.com/api/v1', () => 'token'));

afterEach(() => vi.unstubAllGlobals());

describe('HttpPayoutAccountRepository', () => {
  it('loads active banks from the envelope and maps their code and name', async () => {
    const fetchMock = stubFetch(200, {
      success: true,
      message: 'Banks retrieved successfully.',
      data: [
        { id: 925, name: '5TT MFB', code: '51455', active: true, is_deleted: false },
        { id: 1, name: 'Closed Bank', code: '999', active: false, is_deleted: false },
        { id: 2, name: 'Deleted Bank', code: '998', active: true, is_deleted: true },
        { id: 174, name: 'Abbey Mortgage Bank', code: '404', active: true },
      ],
      errors: null,
      meta: null,
    });

    const banks = await repo().listBanks();
    const [url] = fetchMock.mock.calls[0] as unknown as [string];

    expect(url).toBe('https://api.example.com/api/v1/payout-account/banks');
    expect(banks).toEqual([
      { name: '5TT MFB', code: '51455' },
      { name: 'Abbey Mortgage Bank', code: '404' },
    ]);
  });

  it('saves the payout account with bank_code and account_number', async () => {
    const fetchMock = stubFetch(200, {
      success: true,
      message: 'Payout account saved.',
      data: {
        bank_code: '044',
        bank_name: 'Access Bank',
        account_number: '0085147684',
        account_name: 'KOSISO AZUBOGU',
        verified_at: '2026-11-05T10:00:00Z',
      },
      errors: null,
      meta: null,
    });

    const saved = await repo().savePayoutAccount('IWH-1', {
      bankCode: '044',
      bankName: 'Access Bank',
      accountNumber: '0085147684',
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    expect(url).toBe('https://api.example.com/api/v1/payout-account');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      bank_code: '044',
      account_number: '0085147684',
    });
    expect(saved).toEqual({
      bankCode: '044',
      bankName: 'Access Bank',
      accountNumber: '0085147684',
      accountName: 'KOSISO AZUBOGU',
      verifiedAt: '2026-11-05T10:00:00Z',
    });
  });

  it('falls back to the submitted details when the API returns no account data', async () => {
    stubFetch(200, {
      success: true,
      message: 'Payout account saved.',
      data: null,
      errors: null,
      meta: null,
    });

    const saved = await repo().savePayoutAccount('IWH-1', {
      bankCode: '044',
      bankName: 'Access Bank',
      accountNumber: '0085147684',
    });

    expect(saved).toEqual({
      bankCode: '044',
      bankName: 'Access Bank',
      accountNumber: '0085147684',
      accountName: '',
      verifiedAt: undefined,
    });
  });
});
