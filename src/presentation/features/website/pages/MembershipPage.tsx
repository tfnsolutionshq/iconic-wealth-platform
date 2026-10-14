import { Bell, Check, FileText, PiggyBank, Users } from "lucide-react";
import { ButtonLink, OpenDecisionTag } from "../../../design-system";
import { paths } from "../../../routes/paths";

const CHECKLIST = [
  "First and last name, phone number and email (verified by code)",
  "Residential address",
  "Next of kin",
  "Bank account for year-end payout (added at first login)",
  "Referrer, if someone invited you",
] as const;

const NEXT_STEPS = [
  [
    FileText,
    "An admin reviews your details",
    "You’ll get an email and SMS when your account opens.",
  ],
  [
    PiggyBank,
    "Set up and make your first payment",
    "Add your payout account, set a monthly target and pay at least ₦10,000.",
  ],
  [
    Users,
    "Join the WhatsApp community",
    "Unlocks once your first payment is confirmed.",
  ],
  [Bell, "Get monthly reminders", "Before each deadline on the 5th."],
] as const;

export function MembershipPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-soft px-5 pt-16 pb-10 lg:px-16">
        <div className="mx-auto max-w-360">
          <h1 className="max-w-[18ch] font-display text-5xl leading-[1.04] tracking-tight lg:text-[60px]">
            Membership
          </h1>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-[#474252]">
            Iconic Wealth Hub is open to individuals who agree to save every
            month under Iconic Wealth Hub’s guidelines.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-360 items-start gap-10 px-5 py-14 lg:grid-cols-2 lg:gap-16 lg:px-16">
        <div className="flex flex-col gap-4">
          <h2 className="text-[28px] font-extrabold tracking-tight">
            Who can join
          </h2>
          <p className="leading-relaxed text-mute">
            Eligibility criteria approved by an admin appear here.
          </p>
          <div>
            <OpenDecisionTag code="OD-01">
              Other eligibility criteria pending
            </OpenDecisionTag>
          </div>
          <h2 className="mt-4 text-[28px] font-extrabold tracking-tight">
            What you’ll need
          </h2>
          <ul>
            {CHECKLIST.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 border-b border-line py-3 text-[15px] font-semibold last:border-0"
              >
                <Check size={20} className="shrink-0 text-brand" />
                {item}
              </li>
            ))}
          </ul>
          <span className="text-[13px] font-semibold text-mute">
            Sample fields. Final list confirmed with the client.
          </span>
        </div>

        <div className="flex flex-col gap-4 rounded-card border border-line bg-white p-7">
          <h2 className="text-[19px] font-extrabold">After you register</h2>
          {NEXT_STEPS.map(([Icon, title, body]) => (
            <div
              key={title}
              className="flex items-center gap-3 border-b border-line py-3 last:border-0"
            >
              <span className="flex size-10.5 shrink-0 items-center justify-center rounded-input bg-brand-tint text-brand-dark">
                <Icon size={20} />
              </span>
              <span className="flex flex-1 flex-col">
                <b>{title}</b>
                <span className="text-[13px] font-semibold text-mute">
                  {body}
                </span>
              </span>
            </div>
          ))}
          <ButtonLink to={paths.register} full>
            Join our savings community
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
