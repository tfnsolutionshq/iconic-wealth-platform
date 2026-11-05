import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@/data/api/httpClient';
import { ValidationError } from '@/domain/errors';
import { HttpAuthRepository } from './index';

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

function bodyOf(call: unknown[]): Record<string, unknown> {
  return JSON.parse(String((call[1] as RequestInit).body)) as Record<string, unknown>;
}

function repoWithToken(initial: string | null = null) {
  let token = initial;
  const repo = new HttpAuthRepository(
    new HttpClient('https://api.example.com/api/v1', () => token),
    (next) => { token = next; },
  );
  return { repo, token: () => token };
}

afterEach(() => vi.unstubAllGlobals());

describe('HttpAuthRepository.login', () => {
  it('signs in staff with the API login field and stores the Bearer token', async () => {
    const fetchMock = stubFetch(200, {
      success: true,
      message: 'Signed in successfully.',
      data: {
        user: {
          id: '01a18c60-cb29-7243-82e4-12766bca0706',
          member_id: null,
          first_name: 'Super',
          last_name: 'Admin',
          full_name: 'Super Admin',
          email: 'superadmin@iconic.test',
          phone: '+2348000000000',
          user_type: 'staff',
          status: 'active',
          roles: ['super-admin'],
          created_at: '2026-10-30T02:35:16+00:00',
        },
        token: '01a1a115-ea71-712e-9e03-184bba69a74f|secret',
        token_type: 'Bearer',
      },
      errors: null,
      meta: null,
    });

    const { repo, token } = repoWithToken();
    const session = await repo.login('superadmin@iconic.test', 'Password123');

    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://api.example.com/api/v1/auth/login',
    );
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      login: 'superadmin@iconic.test',
      password: 'Password123',
    });
    expect(session).toMatchObject({
      kind: 'admin',
      admin: {
        id: '01a18c60-cb29-7243-82e4-12766bca0706',
        name: 'Super Admin',
        email: 'superadmin@iconic.test',
        role: 'SuperAdmin',
        status: 'Active',
      },
    });
    expect(token()).toBe('01a1a115-ea71-712e-9e03-184bba69a74f|secret');
  });

  it('maps a non-super staff account to an Administrator', async () => {
    stubFetch(200, {
      success: true,
      message: 'Signed in successfully.',
      data: {
        user: {
          id: 'staff-1', member_id: null, first_name: 'Admin', last_name: 'One',
          full_name: 'Admin One', email: 'admin1@iconic.test', phone: '+2348000000001',
          user_type: 'staff', status: 'active', roles: ['admin'],
        },
        token: 'admin-token',
      },
      errors: null,
      meta: null,
    });

    const { repo } = repoWithToken();
    const session = await repo.login('admin1@iconic.test', 'Password123');

    expect(session.kind).toBe('admin');
    if (session.kind === 'admin') expect(session.admin.role).toBe('Administrator');
  });

  it('maps an active member with their profile and member id', async () => {
    stubFetch(200, {
      success: true,
      message: 'Signed in successfully.',
      data: {
        user: {
          id: '01a1a0b0-0f75-7100-ad22-c17fa89bdc5e',
          member_id: 'RGQAVH',
          first_name: 'Azubogu',
          last_name: 'Kosiso',
          full_name: 'Azubogu Kosiso',
          dob: '1995-05-10',
          gender: 'female',
          email: 'azuboguko@gmail.com',
          phone: '+2348031234520',
          state_of_residence: 'Lagos',
          residential_address: '12 Marina Road, Lagos Island',
          how_heard_about_us: 'Friend',
          next_of_kin: { name: 'John Obi', relationship: 'Brother', phone: '+2348098765402' },
          user_type: 'member',
          status: 'active',
          roles: ['member'],
          created_at: '2026-11-03T09:14:15+00:00',
        },
        token: 'member-token',
      },
      errors: null,
      meta: null,
    });

    const { repo, token } = repoWithToken();
    const session = await repo.login('azuboguko@gmail.com', 'Password1');

    expect(session).toMatchObject({
      kind: 'member',
      member: {
        id: 'RGQAVH',
        firstName: 'Azubogu',
        lastName: 'Kosiso',
        email: 'azuboguko@gmail.com',
        phone: '+2348031234520',
        stateOfResidence: 'Lagos',
        address: '12 Marina Road, Lagos Island',
        joinedOn: '2026-11-03',
        nextOfKin: { name: 'John Obi', relationship: 'Brother', phone: '+2348098765402' },
        status: 'Active',
      },
    });
    expect(token()).toBe('member-token');
  });

  it('sends an unapproved member to the awaiting-approval session', async () => {
    stubFetch(200, {
      success: true,
      message: 'Signed in successfully.',
      data: {
        user: {
          id: 'u2', member_id: 'RGQAVH', first_name: 'Ada', last_name: 'Obi',
          email: 'ada@example.com', phone: '+2348031234567',
          user_type: 'member', status: 'pending_approval', roles: ['member'],
          created_at: '2026-11-03T09:14:15+00:00',
        },
        token: 'pending-token',
      },
      errors: null,
      meta: null,
    });

    const { repo } = repoWithToken();
    const session = await repo.login('ada@example.com', 'Password1');

    expect(session).toMatchObject({
      kind: 'pending',
      registration: { id: 'u2', email: 'ada@example.com', status: 'New', memberId: 'RGQAVH' },
    });
  });

  it('rejects a suspended member instead of opening a session', async () => {
    stubFetch(200, {
      success: true,
      message: 'Signed in successfully.',
      data: {
        user: {
          id: 'u3', member_id: 'RGQAVH', first_name: 'Ada', last_name: 'Obi',
          email: 'ada@example.com', user_type: 'member', status: 'suspended',
        },
        token: 'suspended-token',
      },
      errors: null,
      meta: null,
    });

    const { repo, token } = repoWithToken();
    await expect(repo.login('ada@example.com', 'Password1')).rejects.toThrow(
      /suspended/i,
    );
    // A rejected session must not leave a usable token behind.
    expect(token()).toBeNull();
  });

  it('turns login validation failures into field-level errors', async () => {
    stubFetch(422, {
      success: false,
      message: 'Validation failed.',
      data: null,
      errors: { login: ['The provided credentials are incorrect.'] },
      meta: null,
    });

    const { repo, token } = repoWithToken();
    const error = await repo
      .login('superadmin@iconic.test', 'wrong-password')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fields).toEqual({
      login: ['The provided credentials are incorrect.'],
    });
    expect(token()).toBeNull();
  });

  it('uses the stored token as a Bearer header on later requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            message: 'Signed in successfully.',
            data: {
              user: {
                id: 'staff-1', member_id: null, first_name: 'Super', last_name: 'Admin',
                full_name: 'Super Admin', email: 'superadmin@iconic.test',
                user_type: 'staff', status: 'active', roles: ['super-admin'],
              },
              token: 'bearer-token',
            },
            errors: null,
            meta: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    let token: string | null = null;
    const http = new HttpClient('https://api.example.com/api/v1', () => token);
    const repo = new HttpAuthRepository(http, (next) => { token = next; });

    await repo.login('superadmin@iconic.test', 'Password123');
    await http.get('/members/1');

    const headers = (fetchMock.mock.calls[1][1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer bearer-token');
  });

  it('clears the local token even when the logout request fails', async () => {
    stubFetch(500, {
      success: false,
      message: 'The server is unavailable right now. Please try again.',
      data: null,
      errors: null,
      meta: null,
    });

    const { repo, token } = repoWithToken('member-token');
    await expect(repo.logout()).rejects.toBeInstanceOf(Error);
    expect(token()).toBeNull();
  });
});
