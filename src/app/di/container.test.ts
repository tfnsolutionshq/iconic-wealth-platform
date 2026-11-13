import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('createContainer API wiring', () => {
  it('uses the HTTP repositories for every API-backed repository', async () => {
    vi.stubEnv(
      'VITE_API_BASE_URL',
      'https://api.iconicwealth.tfnsolutions.us/api/v1/',
    );
    const { createContainer } = await import('./container');
    const { repos } = createContainer();

    expect(repos.auth.constructor.name).toBe('HttpAuthRepository');
    expect(repos.registration.constructor.name).toBe(
      'HttpRegistrationRepository',
    );
    expect(repos.member.constructor.name).toBe('HttpMemberRepository');
    expect(repos.payout.constructor.name).toBe('HttpPayoutAccountRepository');
    expect(repos.savingsTarget.constructor.name).toBe(
      'HttpSavingsTargetRepository',
    );
    expect(repos.savingsDashboard.constructor.name).toBe(
      'HttpSavingsDashboardRepository',
    );
    expect(repos.settings.constructor.name).toBe('HttpSettingsRepository');
    expect(repos.testimonials.constructor.name).toBe(
      'HttpTestimonialRepository',
    );
    expect(repos.contribution.constructor.name).toBe(
      'HttpContributionRepository',
    );
    expect(repos.admin.constructor.name).toBe('HttpAdminRepository');
  });

  it('reads the API base URL from VITE_API_BASE_URL', async () => {
    vi.stubEnv(
      'VITE_API_BASE_URL',
      'https://api.iconicwealth.tfnsolutions.us/api/v1/',
    );
    const { env } = await import('../config/env');

    expect(env.apiBaseUrl).toBe(
      'https://api.iconicwealth.tfnsolutions.us/api/v1/',
    );
  });

  it('does not fall back when VITE_API_BASE_URL is empty', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { env } = await import('../config/env');

    expect(env.apiBaseUrl).toBe('');
  });
});
