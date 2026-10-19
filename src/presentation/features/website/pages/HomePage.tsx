import { Link } from "react-router-dom";
import {
  Check,
  ChevronRight,
  History,
  Lock,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { ButtonLink } from "../../../design-system";
import { YearCard } from "../components/HomePageComponents/YearCard";
import { TestimonialsSection } from "../components/HomePageComponents/TestimonialsSection";
import {
  HowItWorksSteps,
  type Step,
} from "../components/HomePageComponents/HowItWorksSteps";
import { paths } from "../../../routes/paths";

const STEPS: Step[] = [
  {
    title: "Become a member",
    body: "Register online in about five minutes. Your membership is reviewed and approved by an admin.",
    tag: "5 minutes",
  },
  {
    title: "Set your monthly target",
    body: "Choose how much you aim to save each month. Every payment is at least ₦10,000.",
    tag: "At sign-up",
  },
  {
    title: "Save through the month",
    body: "Pay as often as you like from the 1st. Each month closes after the 5th of the next, or lock it early yourself.",
    tag: "January–November",
  },
  {
    title: "Collect on payout day",
    body: "Receive your savings, plus any interest due, on or before 14 December.",
    tag: "December",
  },
];
const RULES = [
  [
    "₦10,000",
    "Minimum per payment. Save as much as you can, as often as you like.",
  ],
  ["5th", "Each month closes at the end of the 5th of the next month."],
  ["₦100", "Platform charge per payment, shown in the total before you pay."],
  [
    "14 Dec",
    "Savings months run January to November. Payout is on or before 14 December.",
  ],
];
const TRUST = [
  [
    Lock,
    "Private to you",
    "Only you and authorised Iconic Wealth Hub staff can see your balance and contributions.",
  ],
  [
    ShieldCheck,
    "Verified before it counts",
    "A payment is credited only after Paystack confirms it.",
  ],
  [
    History,
    "Every action recorded",
    "Changes to records are logged with who made them and when.",
  ],
] as const;

export function HomePage() {
  return (
    <>
      <section className="mx-auto flex max-w-360 flex-col items-center gap-16 px-5 pt-16 pb-24 lg:flex-row lg:px-16 lg:pt-20">
        <div className="flex flex-1 flex-col gap-6">
          <span className="w-max rounded-pill bg-gold-tint px-3 py-1 text-[13px] font-bold text-[#7a5410]">
            Members-only savings community
          </span>
          <h1 className="max-w-[11ch] font-display text-4xl leading-[1.04] tracking-tight sm:text-5xl lg:text-[76px]">
            Save every month. Collect it all at year-end.
          </h1>
          <p className="max-w-[46ch] text-lg leading-relaxed text-[#474252]">
            Save from ₦10,000 at a time, follow every payment online, and
            receive your savings with your share of annual interest on payout
            day.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to={paths.register}>Become a member</ButtonLink>
            <ButtonLink to={paths.howItWorks} variant="outline">
              See how it works
            </ButtonLink>
          </div>
          <div className="flex flex-wrap gap-6 text-[13px] font-semibold text-mute">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={18} />
              Payments by Paystack
            </span>
            <span className="flex items-center gap-1.5">
              <Lock size={18} />
              Your balance is private
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={18} />
              Verified before credited
            </span>
          </div>
        </div>
        <YearCard />
      </section>
      <section className="bg-soft px-5 py-20 lg:px-16">
        <div className="mx-auto max-w-360">
          <div className="mb-11 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="max-w-[16ch] font-display text-4xl lg:text-5xl">
              How saving with Iconic Wealth Hub works
            </h2>
            <Link
              to={paths.howItWorks}
              className="shrink-0 text-sm font-bold text-brand"
            >
              Full walkthrough
            </Link>
          </div>
          <HowItWorksSteps steps={STEPS} />
        </div>
      </section>
      <section className="bg-night px-5 py-20 text-white lg:px-16">
        <div className="mx-auto flex max-w-360 flex-col gap-10 lg:flex-row">
          <div className="flex flex-col gap-4 lg:w-95">
            <h2 className="font-display text-4xl sm:text-5xl">The rules, up front</h2>
            <p className="leading-relaxed text-white/70">
              These come from Iconic Wealth Hub’s operational guidelines. You’ll
              see them again before every payment.
            </p>
            <div className="flex gap-3 rounded-2xl bg-gold/15 p-4 text-sm text-[#f3d9a6]">
              <TriangleAlert size={20} className="shrink-0" />
              If a month closes with nothing saved, it may affect your interest
              for that year. Your savings always stay yours.
            </div>
          </div>
          <div className="grid flex-1 gap-3.5 text-ink sm:grid-cols-2">
            {RULES.map(([a, b]) => (
              <div key={a} className="rounded-card bg-white p-6">
                <span className="font-display text-[40px]">{a}</span>
                <p className="text-mute">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-360 gap-10 px-5 py-20 md:grid-cols-3 lg:px-16">
        {TRUST.map(([Icon, t, d]) => (
          <div key={t} className="flex flex-col gap-3">
            <span className="flex size-13 items-center justify-center rounded-2xl bg-brand-tint text-brand-dark">
              <Icon size={24} />
            </span>
            <h3 className="text-[19px] font-extrabold">{t}</h3>
            <p className="max-w-[34ch] leading-relaxed text-mute">{d}</p>
          </div>
        ))}
      </section>
      <TestimonialsSection />
      <section className="mx-auto flex max-w-360 flex-col gap-10 px-5 lg:flex-row lg:px-16">
        <div className="flex flex-col gap-3 lg:w-95">
          <h2 className="font-display text-4xl lg:text-[44px]">
            Questions members ask
          </h2>
          <Link to={paths.faqs} className="text-sm font-bold text-brand">
            All FAQs
          </Link>
        </div>
        <div className="flex-1">
          {[
            "Can I withdraw before year-end?",
            "Can I pay more than once a month?",
            "When do I join the WhatsApp community?",
          ].map((q) => (
            <Link
              key={q}
              to={paths.faqs}
              className="flex items-center justify-between gap-4 border-b border-line py-4.5 text-[17px] font-extrabold"
            >
              <span className="min-w-0">{q}</span>
              <ChevronRight size={20} className="shrink-0" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
