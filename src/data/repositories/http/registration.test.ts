import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@/data/api/httpClient';
import { UnauthorizedError, ValidationError } from '@/domain/errors';
import type { RegistrationDetails } from '@/domain/rules';
import { HttpRegistrationRepository } from './index';

const details: RegistrationDetails = {
  firstName: 'Ada',
  lastName: 'Obi',
  dateOfBirth: '1995-05-10',
  email: 'ada@example.com',
  phone: '0803 123 4567',
  stateOfResidence: 'Lagos',
  address: '12 Marina Road, Lagos Island',
  heardAboutUs: 'Friend',
  referredBy: '',
};

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

afterEach(() => vi.unstubAllGlobals());

describe('HttpRegistrationRepository', () => {
  it('starts registration with the API field names and confirms the code was sent', async () => {
    const fetchMock = stubFetch(201, {
      success: true,
      message: 'Registration started. A verification code has been sent to your email.',
      data: {
        user: {
          id: 'u1', member_id: 'ERL4GP', first_name: 'Ada', last_name: 'Obi',
          email: 'ada@example.com', phone: '+2348031234567',
          status: 'pending_email_verification',
        },
        verification: { expires_at: '2026-11-03T08:57:23+00:00', resend_available_in_seconds: 60 },
      },
      errors: null,
      meta: null,
    });

    const repo = new HttpRegistrationRepository(new HttpClient('https://api.example.com/api/v1', () => null));
    const started = await repo.start(details);

    expect(started).toMatchObject({
      emailSent: true,
      user: { memberId: 'ERL4GP', status: 'pending_email_verification' },
      verification: { resendAvailableInSeconds: 60 },
    });
    expect(bodyOf(fetchMock.mock.calls[0])).toMatchObject({
      first_name: 'Ada',
      last_name: 'Obi',
      dob: '1995-05-10',
      gender: 'female',
      email: 'ada@example.com',
      phone: '08031234567',
      state_of_residence: 'Lagos',
      residential_address: '12 Marina Road, Lagos Island',
      how_heard_about_us: 'Friend',
    });
    expect(bodyOf(fetchMock.mock.calls[0])).not.toHaveProperty('referred_by');
  });

  it('does not claim the email was sent when the verification block is missing', async () => {
    stubFetch(201, {
      success: true,
      message: 'Registration started.',
      data: { user: { id: 'u1', member_id: 'ERL4GP', first_name: 'Ada', last_name: 'Obi', email: 'ada@example.com', phone: '', status: 'pending_email_verification' } },
      errors: null,
      meta: null,
    });

    const repo = new HttpRegistrationRepository(new HttpClient('https://api.example.com/api/v1', () => null));
    await expect(repo.start(details)).resolves.toMatchObject({ emailSent: false });
  });

  it('turns API validation failures into field-level errors', async () => {
    stubFetch(422, {
      success: false,
      message: 'Validation failed.',
      data: null,
      errors: {
        email: ['The email has already been taken.'],
        phone: ['The phone has already been taken.'],
      },
      meta: null,
    });

    const repo = new HttpRegistrationRepository(new HttpClient('https://api.example.com/api/v1', () => null));
    const error = await repo.start(details).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fields).toEqual({
      email: ['The email has already been taken.'],
      phone: ['The phone has already been taken.'],
    });
  });

  it('stores the token returned after email verification', async () => {
    stubFetch(200, {
      success: true,
      message: 'Email verified successfully.',
      data: { token: 'verification-token' },
      errors: null,
      meta: null,
    });

    let token: string | null = null;
    const repo = new HttpRegistrationRepository(
      new HttpClient('https://api.example.com/api/v1', () => token),
      (next) => { token = next; },
    );

    await expect(repo.verifyEmailCode('ada@example.com', '123456')).resolves.toBe(true);
    expect(token).toBe('verification-token');
  });

  it('completes the profile with the flattened next-of-kin fields', async () => {
    const fetchMock = stubFetch(200, {
      success: true,
      message: 'Registration completed successfully.',
      data: null,
      errors: null,
      meta: null,
    });

    const repo = new HttpRegistrationRepository(new HttpClient('https://api.example.com/api/v1', () => null));
    const registration = await repo.submit({
      ...details,
      nextOfKin: { name: 'Ngozi Obi', relationship: 'Sibling', phone: '0803 123 8888' },
      password: 'Savings2027',
    });

    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://api.example.com/api/v1/auth/member/register/complete',
    );
    expect(bodyOf(fetchMock.mock.calls[0])).toMatchObject({
      password: 'Savings2027',
      password_confirmation: 'Savings2027',
      next_of_kin_name: 'Ngozi Obi',
      relationship: 'Sibling',
      next_of_kin_phone: '08031238888',
    });
    expect(registration).toMatchObject({ email: 'ada@example.com', status: 'New' });
  });

  it('returns the member record from the completed registration', async () => {
    stubFetch(200, {
      success: true,
      message: 'Registration completed successfully. Your account is awaiting administrator approval.',
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
          status: 'pending_approval',
          email_verified_at: '2026-11-03T09:40:55+00:00',
          roles: ['member'],
          permissions: ['profile:update'],
          created_at: '2026-11-03T09:14:15+00:00',
        },
      },
      errors: null,
      meta: null,
    });

    let token: string | null = 'verification-token';
    const repo = new HttpRegistrationRepository(
      new HttpClient('https://api.example.com/api/v1', () => token),
      (next) => { token = next; },
    );

    const registration = await repo.submit({
      ...details,
      nextOfKin: { name: 'John Obi', relationship: 'Brother', phone: '08098765432' },
      password: 'Password1',
    });

    expect(registration).toMatchObject({
      id: '01a1a0b0-0f75-7100-ad22-c17fa89bdc5e',
      memberId: 'RGQAVH',
      firstName: 'Azubogu',
      lastName: 'Kosiso',
      email: 'azuboguko@gmail.com',
      phone: '+2348031234520',
      nextOfKin: { name: 'John Obi', relationship: 'Brother', phone: '+2348098765402' },
      status: 'New',
    });
    // The verification token is not a member session; it must not be reused after completion.
    expect(token).toBeNull();
  });

  it('asks the member to verify their email again when the token is rejected', async () => {
    stubFetch(401, {
      success: false,
      message: 'Unauthenticated.',
      data: null,
      errors: null,
      meta: null,
    });

    let token: string | null = 'expired-token';
    const repo = new HttpRegistrationRepository(
      new HttpClient('https://api.example.com/api/v1', () => token),
      (next) => { token = next; },
    );

    const error = await repo.submit({
      ...details,
      nextOfKin: { name: 'Ngozi Obi', relationship: 'Sibling', phone: '0803 123 8888' },
      password: 'Savings2027',
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as UnauthorizedError).message).toMatch(/verify your email/i);
    expect(token).toBeNull();
  });
});
