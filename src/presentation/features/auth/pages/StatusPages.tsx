import { Navigate, useLocation } from "react-router-dom";
import { Check, Clock, Lock, MessageCircle, X } from "lucide-react";
import type { Registration } from "@/domain/entities";
import { useAuth } from "../../../contexts/AuthContext";
import {
  Banner,
  ButtonLink,
  Card,
  KeyValue,
  OpenDecisionTag,
  Pill,
  cn,
} from "../../../design-system";
import { env } from "@/app/config/env";
import { paths } from "../../../routes/paths";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function RegistrationDonePage() {
  const r = (useLocation().state as { registration?: Registration } | null)
    ?.registration;
  if (!r) return <Navigate to={paths.register} replace />;
  return (
    <>
      <section className="flex flex-col items-center gap-5 px-5 py-24 text-center">
        <span className="flex size-21 items-center justify-center rounded-sheet bg-pending-tint text-pending">
          <Clock size={40} />
        </span>
        <h1 className="font-display text-4xl sm:text-5xl">Registration received</h1>
        <p className="max-w-[52ch] text-lg text-[#474252]">
          Thanks, {r.firstName}. An admin reviews every new member. We’ll email{" "}
          {r.email} when your account opens.
        </p>
        <Card className="w-full max-w-115 text-left">
          <KeyValue label="Submitted" value={fmt(r.submittedAt)} />
          <KeyValue
            label="Status"
            value={<Pill tone="pending">Under review</Pill>}
          />
          <KeyValue label="Referred by" value={r.referredBy ?? "—"} />
        </Card>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:justify-center">
          <ButtonLink to={paths.login}>Go to log in</ButtonLink>
          <ButtonLink to={paths.home} variant="outline">
            Back to home
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

/** Shown after login while an admin reviews the registration (or with the reason if not approved). */
export function AwaitingApprovalPage() {
  const { session } = useAuth();
  if (session?.kind !== "pending") return <Navigate to={paths.login} replace />;
  const r = session.registration;
  const rejected = r.status === "Rejected";
  const steps: [string, string, "ok" | "cur" | "fail" | "todo"][] = [
    ["Registration submitted", fmt(r.submittedAt), "ok"],
    ["Email verified", "Verified with a one-time code", "ok"],
    [
      "Admin review",
      rejected ? "Not approved" : "In progress · usually 1–2 working days",
      rejected ? "fail" : "cur",
    ],
    ["Account opens", rejected ? "—" : "We’ll email and text you", "todo"],
  ];
  const dot = {
    ok: ["bg-brand-tint text-brand-dark", <Check size={15} key="o" />],
    cur: ["bg-pending-tint text-pending", <Clock size={15} key="c" />],
    fail: ["bg-fail-tint text-fail", <X size={15} key="f" />],
    todo: ["bg-soft", <Lock size={15} key="t" />],
  } as const;
  return (
    <>
      <section className="flex justify-center bg-soft px-5 py-14">
        <div className="flex w-full max-w-155 flex-col gap-5">
          <span
            className={cn(
              "flex size-19 items-center justify-center self-center rounded-3xl",
              rejected
                ? "bg-fail-tint text-fail"
                : "bg-pending-tint text-pending",
            )}
          >
            {rejected ? <X size={36} /> : <Clock size={36} />}
          </span>
          <div className="flex flex-col items-center gap-2 text-center">
            <Pill tone={rejected ? "fail" : "pending"}>
              {rejected ? "Not approved" : "Awaiting approval"}
            </Pill>
            <h1 className="font-display text-3xl leading-tight sm:text-[44px]">
              {rejected
                ? "Your registration wasn’t approved"
                : "Your account is awaiting approval"}
            </h1>
            <p className="max-w-[52ch] text-mute">
              {rejected
                ? `Thanks for your interest, ${r.firstName}. Contact support if you’d like to discuss the reason below.`
                : `Thanks for registering, ${r.firstName}. You’ll get an email and SMS as soon as you’re approved.`}
            </p>
          </div>
          {rejected && (
            <Banner tone="fail">
              <b>Reason:</b> {r.reason ?? "Not provided"}
            </Banner>
          )}
          <Card>
            <KeyValue label="Name" value={`${r.firstName} ${r.lastName}`} />
            <KeyValue label="Email" value={r.email} />
            <KeyValue label="Phone" value={r.phone} />
            <KeyValue label="State of residence" value={r.stateOfResidence} />
            <KeyValue
              label="Status"
              value={
                <Pill tone={rejected ? "fail" : "pending"}>
                  {rejected ? "Not approved" : "Under review"}
                </Pill>
              }
            />
          </Card>
          <Card className="flex flex-col gap-1">
            {steps.map(([t, s, k]) => (
              <div key={t} className="flex items-center gap-3 py-1.5">
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full",
                    dot[k][0],
                  )}
                >
                  {dot[k][1]}
                </span>
                <span className="flex flex-col">
                  <b className="text-sm">{t}</b>
                  <span className="text-xs font-semibold text-mute">{s}</span>
                </span>
              </div>
            ))}
          </Card>
          <div className="flex flex-wrap justify-center gap-2.5">
            <ButtonLink
              to={env.waSupportUrl}
              external
              icon={<MessageCircle size={18} />}
            >
              Contact support on WhatsApp
            </ButtonLink>
            <ButtonLink to={paths.home} variant="outline">
              Return to website
            </ButtonLink>
          </div>
          <OpenDecisionTag code="OD-01">Approval policy</OpenDecisionTag>
        </div>
      </section>
    </>
  );
}
