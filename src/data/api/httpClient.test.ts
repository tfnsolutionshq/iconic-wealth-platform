import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, HttpClient } from './httpClient';

afterEach(() => vi.unstubAllGlobals());

describe('HttpClient', () => {
  it('applies the base URL once and sends JSON', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const http = new HttpClient('https://api.example.com/api/v1/', () => null);
    await http.post('/auth/member/register', { first_name: 'Ada' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/auth/member/register',
      expect.objectContaining({ method: 'POST', body: '{"first_name":"Ada"}' }),
    );
  });

  it('normalises the validation envelope into an ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: false,
            message: 'Validation failed.',
            data: null,
            errors: { email: ['The email has already been taken.'] },
            meta: null,
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const http = new HttpClient('https://api.example.com/api/v1', () => null);
    const error = await http.post('/auth/member/register', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      message: 'Validation failed.',
      errors: { email: ['The email has already been taken.'] },
    });
  });

  it('reports an unreachable server clearly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    const http = new HttpClient('https://api.example.com/api/v1', () => null);
    await expect(http.get('/auth/member/register')).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('couldn’t reach the server'),
    });
  });
});
