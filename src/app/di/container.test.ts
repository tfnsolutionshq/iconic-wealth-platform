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

describe('createContainer registration wiring', () => {
  it('uses the HTTP registration and auth repositories when a registration API base URL is set', async () => {
    vi.stubEnv('VITE_REGISTRATION_API_BASE_URL', '/api/v1');
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { createContainer } = await import('./container');
    const { repos } = createContainer();

    expect(repos.registration.constructor.name).toBe(
      'HttpRegistrationRepository',
    );
    expect(repos.auth.constructor.name).toBe('HttpAuthRepository');
    // Payout setup, the monthly target and the dashboard follow the live API even though the rest of member data stays mock.
    expect(repos.payout.constructor.name).toBe('HttpPayoutAccountRepository');
    expect(repos.savingsTarget.constructor.name).toBe('HttpSavingsTargetRepository');
    expect(repos.savingsDashboard.constructor.name).toBe('HttpSavingsDashboardRepository');
  });

  it('uses the mock repositories when no API base URL is set', async () => {
    vi.stubEnv('VITE_REGISTRATION_API_BASE_URL', '');
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { createContainer } = await import('./container');
    const { repos } = createContainer();

    expect(repos.registration.constructor.name).toBe(
      'MockRegistrationRepository',
    );
    expect(repos.auth.constructor.name).toBe('MockAuthRepository');
    expect(repos.payout.constructor.name).toBe('MockPayoutAccountRepository');
    expect(repos.savingsTarget.constructor.name).toBe('MockSavingsTargetRepository');
    expect(repos.savingsDashboard.constructor.name).toBe('MockSavingsDashboardRepository');
  });
});
