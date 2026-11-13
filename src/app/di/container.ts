/** Composition root: the only place that chooses concrete data-layer implementations. */
import type { Repositories } from "@/domain/repositories";
import { systemClock, type Clock } from "@/domain/services/clock";
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
import { MockWalletRepository } from "@/data/repositories/mock";
import { DemoGateway, PaystackInlineGateway } from "@/data/gateways";
import { env } from "@/app/config/env";

export interface Container {
  repos: Repositories;
  clock: Clock;
  demoGateway: DemoGateway | null;
}

export function createContainer(): Container {
  const clock = systemClock;
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

  // Every API-backed repository shares one client, so all requests go to the
  // same server base URL in development and production.
  const http = new HttpClient(env.apiBaseUrl, () => token);

  if (import.meta.env.DEV) {
    console.info(`[iwh] API base URL: ${env.apiBaseUrl}`);
  }

  const repos: Repositories = {
    auth: new HttpAuthRepository(http, setToken),
    // Email verification returns the token needed to finish the profile.
    registration: new HttpRegistrationRepository(http, setToken),
    member: new HttpMemberRepository(http),
    payout: new HttpPayoutAccountRepository(http),
    savingsTarget: new HttpSavingsTargetRepository(http),
    savingsDashboard: new HttpSavingsDashboardRepository(http),
    settings: new HttpSettingsRepository(http),
    testimonials: new HttpTestimonialRepository(http),
    contribution: new HttpContributionRepository(http),
    admin: new HttpAdminRepository(http),
    gateway,
    // No wallet API yet: the wallet stays local so it never makes a network request.
    wallet: new MockWalletRepository(clock),
  };

  return { clock, demoGateway, repos };
}
