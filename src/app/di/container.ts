/** Composition root: the only place that chooses concrete data-layer implementations. */
import type { Repositories } from "@/domain/repositories";
import { fixedClock, systemClock, type Clock } from "@/domain/services/clock";
import { HttpClient } from "@/data/api/httpClient";
import {
  HttpAdminRepository,
  HttpAuthRepository,
  HttpContributionRepository,
  HttpMemberRepository,
  HttpRegistrationRepository,
  HttpSettingsRepository,
  HttpTestimonialRepository,
} from "@/data/repositories/http";
import {
  MockAdminRepository,
  MockAuthRepository,
  MockContributionRepository,
  MockMemberRepository,
  MockRegistrationRepository,
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
  if (useMock) {
    return {
      clock,
      demoGateway,
      repos: {
        auth: new MockAuthRepository(),
        registration: new MockRegistrationRepository(clock),
        member: new MockMemberRepository(clock),
        settings: new MockSettingsRepository(),
        testimonials: new MockTestimonialRepository(),
        contribution: new MockContributionRepository(
          clock,
          (ref) => demoGateway?.outcomeFor(ref) ?? "Successful",
        ),
        admin: new MockAdminRepository(),
        gateway,
        wallet: new MockWalletRepository(clock),
      },
    };
  }
  let token: string | null = sessionStorage.getItem("iwh.token");
  const http = new HttpClient(env.apiBaseUrl, () => token);
  return {
    clock,
    demoGateway,
    repos: {
      auth: new HttpAuthRepository(http, (t) => {
        token = t;
        if (t) sessionStorage.setItem("iwh.token", t);
        else sessionStorage.removeItem("iwh.token");
      }),
      registration: new HttpRegistrationRepository(http),
      member: new HttpMemberRepository(http),
      contribution: new HttpContributionRepository(http),
      settings: new HttpSettingsRepository(http),
      testimonials: new HttpTestimonialRepository(http),
      admin: new HttpAdminRepository(http),
      gateway,
      // No wallet API yet: the wallet stays local so it never makes a network request.
      wallet: new MockWalletRepository(clock),
    },
  };
}
