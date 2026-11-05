/** Composition root: the only place that chooses concrete data-layer implementations. */
import type { Repositories } from "@/domain/repositories";
import { fixedClock, systemClock, type Clock } from "@/domain/services/clock";
import { HttpClient } from "@/data/api/httpClient";
import {
  HttpAdminRepository,
  HttpAuthRepository,
  HttpContributionRepository,
  HttpMemberRepository,
  HttpPayoutAccountRepository,
  HttpRegistrationRepository,
  HttpSavingsDashboardRepository,
  HttpSavingsTargetRepository,
  HttpSettingsRepository,
  HttpTestimonialRepository,
} from "@/data/repositories/http";
import {
  MockAdminRepository,
  MockAuthRepository,
  MockContributionRepository,
  MockMemberRepository,
  MockPayoutAccountRepository,
  MockRegistrationRepository,
  MockSavingsDashboardRepository,
  MockSavingsTargetRepository,
  MockSettingsRepository,
  MockTestimonialRepository,
  MockWalletRepository,
} from "@/data/repositories/mock";
import { DemoGateway, PaystackInlineGateway } from "@/data/gateways";
import { DEMO_TODAY } from "@/data/mock/seed";
import { env } from "@/app/config/env";

export interface Container {
  repos: Repositories;
  clock: Clock;
  demoGateway: DemoGateway | null;
}

export function createContainer(): Container {
  const useMock = !env.apiBaseUrl;
  const clock = useMock ? fixedClock(DEMO_TODAY) : systemClock;
  const demoGateway =
    env.demoMode || !env.paystackPublicKey ? new DemoGateway() : null;
  const gateway =
    demoGateway ?? new PaystackInlineGateway(env.paystackPublicKey);

  const readStoredToken = (): string | null => {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("iwh.token");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (typeof parsed === "string" && parsed) return parsed;
        } catch {
          return raw;
        }
      }
    }
    return typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("iwh.token")
      : null;
  };

  let token: string | null = readStoredToken();
  const setToken = (t: string | null) => {
    token = t;
    if (typeof sessionStorage !== "undefined") {
      if (t) sessionStorage.setItem("iwh.token", t);
      else sessionStorage.removeItem("iwh.token");
    }
    if (typeof localStorage !== "undefined") {
      if (t) localStorage.setItem("iwh.token", JSON.stringify(t));
      else localStorage.removeItem("iwh.token");
    }
  };
  const httpFor = (baseUrl: string) => new HttpClient(baseUrl, () => token);

  // Registration (and sign-in, which shares the same API) can be live while the
  // rest of the app remains on mock data. Setting VITE_API_BASE_URL switches every
  // API-backed repository to HTTP.
  const apiHttp = useMock ? null : httpFor(env.apiBaseUrl);
  const registrationHttp = env.registrationApiBaseUrl
    ? httpFor(env.registrationApiBaseUrl)
    : null;
  const authHttp = apiHttp ?? registrationHttp;
  // Payout setup and the monthly target can use the live API even while the rest of the member data stays mock.
  const liveHttp = apiHttp ?? registrationHttp;

  if (import.meta.env.DEV) {
    console.info(
      liveHttp
        ? `[iwh] Registration, auth, payout, savings target and dashboard API: ${env.registrationApiBaseUrl || env.apiBaseUrl}`
        : "[iwh] Registration, auth, payout, savings target and dashboard use mock data. Set VITE_REGISTRATION_API_BASE_URL (or VITE_API_BASE_URL) to call the API.",
    );
  }

  const repos: Repositories = {
    auth: authHttp
      ? new HttpAuthRepository(authHttp, setToken)
      : new MockAuthRepository(),
    registration: registrationHttp
      ? // Email verification returns the token needed to finish the profile.
        new HttpRegistrationRepository(registrationHttp, setToken)
      : new MockRegistrationRepository(clock),
    member: apiHttp
      ? new HttpMemberRepository(apiHttp)
      : new MockMemberRepository(clock),
    payout: liveHttp
      ? new HttpPayoutAccountRepository(liveHttp)
      : new MockPayoutAccountRepository(clock),
    savingsTarget: liveHttp
      ? new HttpSavingsTargetRepository(liveHttp)
      : new MockSavingsTargetRepository(),
    savingsDashboard: liveHttp
      ? new HttpSavingsDashboardRepository(liveHttp)
      : new MockSavingsDashboardRepository(clock),
    settings: apiHttp
      ? new HttpSettingsRepository(apiHttp)
      : new MockSettingsRepository(),
    testimonials: apiHttp
      ? new HttpTestimonialRepository(apiHttp)
      : new MockTestimonialRepository(),
    contribution: apiHttp
      ? new HttpContributionRepository(apiHttp)
      : new MockContributionRepository(
          clock,
          (ref) => demoGateway?.outcomeFor(ref) ?? "Successful",
        ),
    admin: authHttp
      ? new HttpAdminRepository(authHttp)
      : new MockAdminRepository(),
    gateway,
    // No wallet API yet: the wallet stays local so it never makes a network request.
    wallet: new MockWalletRepository(clock),
  };

  return { clock, demoGateway, repos };
}
