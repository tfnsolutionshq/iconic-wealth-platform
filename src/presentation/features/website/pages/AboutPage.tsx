import {
  BadgeCheck,
  Landmark,
  Lock,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { OpenDecisionTag } from "../../../design-system";

const STATS = [
  ["4th", "year running"],
  ["11", "savings months a year"],
  ["100%", "women-led community"],
] as const;

const OBJECTIVE_STEPS = [
  [
    "Save monthly",
    "Members save every month from January to November, at least ₦10,000 per payment, towards their own monthly target.",
  ],
  [
    "Pool together",
    "Savings are pooled, which gives the hub stronger negotiating power.",
  ],
  [
    "Invest jointly",
    "Pooled funds are invested with trusted financial institutions.",
  ],
  [
    "Grow with discipline",
    "Savings, plus a share of the returns for on-time savers, are paid out at year-end.",
  ],
] as const;

const ASSURANCES = [
  [
    Landmark,
    "Trusted financial partners",
    "We work with trusted financial institutions to keep members’ savings protected.",
  ],
  [
    Users,
    "Stronger together",
    "The more we pool, the better the returns we can negotiate for the community.",
  ],
  [
    BadgeCheck,
    "A proven track record",
    "This is our fourth year running, and the hub has had a strong run so far.",
  ],
  [
    Lock,
    "Protected on the platform",
    "Payments are verified before they count, records are private, and every action is logged.",
  ],
] as const;

const FOUNDERS = [
  {
    initials: "BA",
    role: "Co-founder and visionary",
    name: "Pastor Mrs. Benny Amedu",
    body: [
      "Pastor Mrs. Benny Amedu is the visionary behind Iconic Wealth Hub. She is the First Lady of House on the Rock, Awka, and the CEO of Yophi Cakes, a leading confectionery brand in the South East.",
      "Her mission is to see women live their God-given destiny and become financially free. She leads with integrity and purpose.",
    ],
  },
  {
    initials: "CT",
    role: "Co-founder and wealth manager",
    name: "Mrs. Chizoba Tevin-Anyali",
    body: [
      "Mrs. Chizoba Tevin-Anyali is the wealth manager behind Iconic Wealth Hub. She has over a decade of experience in the finance industry, with a strong background in fund management and sales.",
      "She lectures in Economics with a focus on development economics, is a certified product manager and is well versed in investment opportunities. She brings credibility and a passion for raising wealth-oriented women.",
    ],
  },
] as const;

export function AboutPage() {
  return (
    <>
      {/* Hero + quote */}
      <section className="bg-soft px-5 pt-18 pb-16 lg:px-16">
        <div className="mx-auto flex max-w-360 flex-col items-center gap-10 lg:flex-row">
          <div className="flex flex-1 flex-col gap-5">
            <span className="w-max rounded-pill bg-gold-tint px-3 py-1 text-[13px] font-bold text-[#7a5410]">
              About us
            </span>
            <h1 className="max-w-[14ch] font-display text-5xl leading-[1.04] tracking-tight lg:text-[64px]">
              Where women build and multiply wealth
            </h1>
            <p className="max-w-[56ch] text-lg leading-relaxed text-[#474252]">
              Iconic Wealth Hub is an exclusive wealth community for women who
              want to turn their financial dreams into reality. Saving comes
              first here, and there’s no room for slacking: we keep every member
              motivated and on track.
            </p>
            <div className="mt-2 flex gap-8">
              {STATS.map(([v, k]) => (
                <span key={k} className="flex flex-col gap-0.5">
                  <b className="font-display text-[34px] leading-none text-brand-dark">
                    {v}
                  </b>
                  <span className="text-[13px] font-semibold text-mute">
                    {k}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <figure className="w-110 max-w-full shrink-0 rounded-sheet bg-linear-to-br from-night to-[#3b1580] p-10 text-white shadow-lift">
            <span
              aria-hidden
              className="font-display text-[80px] leading-[0.6] text-gold"
            >
              “
            </span>
            <blockquote className="mt-1.5 mb-4.5 font-display text-[30px] leading-tight">
              In 2027, we’re set to take charge of our finances and lay up gold
              as dust.
            </blockquote>
            <figcaption className="font-bold text-white/70">
              — Iconic Wealth Queens
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Mission / vision */}
      <section className="mx-auto max-w-360 px-5 py-16 lg:px-16">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-card border border-line border-t-4 border-t-brand bg-white p-7.5 transition duration-300 hover:-translate-y-1.5 hover:shadow-lift">
            <span className="flex size-13 items-center justify-center rounded-2xl bg-brand-tint text-brand-dark">
              <ShieldCheck size={24} />
            </span>
            <span className="text-[13px] font-extrabold text-brand-dark">
              OUR MISSION
            </span>
            <p className="font-display text-[26px] leading-[1.3]">
              To build a strong savings culture among women through consistent
              monthly saving and the joint investment of pooled funds, so every
              member grows lasting wealth.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-card border border-line border-t-4 border-t-gold bg-white p-7.5 transition duration-300 hover:-translate-y-1.5 hover:shadow-lift">
            <span className="flex size-13 items-center justify-center rounded-2xl bg-gold-tint text-[#7a5410]">
              <TrendingUp size={24} />
            </span>
            <span className="text-[13px] font-extrabold text-pending">
              OUR VISION
            </span>
            <p className="font-display text-[26px] leading-[1.3]">
              A community of financially free women, living their God-given
              destiny and building and multiplying wealth together.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <OpenDecisionTag code="CI-01">
            Mission and vision drafted for client approval
          </OpenDecisionTag>
        </div>
      </section>

      {/* Objective */}
      <section className="mx-auto flex max-w-360 flex-col gap-10 px-5 pb-20 lg:flex-row lg:px-16">
        <div className="flex w-105 max-w-full flex-col gap-3.5">
          <span className="w-max rounded-pill bg-brand-tint px-3 py-1 text-[11px] font-extrabold tracking-wider text-brand-dark uppercase">
            Our objective
          </span>
          <h2 className="font-display text-4xl leading-tight lg:text-[42px]">
            A savings-to-investment hub, not a money-doubling scheme
          </h2>
          <p className="leading-relaxed text-mute">
            Our primary goal is a strong savings culture: consistent monthly
            saving, with the funds invested jointly. Saving ₦100,000 isn’t about
            getting ₦100,000 back at year-end. It’s about building the financial
            discipline that grows wealth.
          </p>
        </div>
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          {OBJECTIVE_STEPS.map(([t, d]) => (
            <div
              key={t}
              className="flex flex-col gap-2 rounded-card border border-line bg-white p-5 transition duration-300 hover:-translate-y-1.5 hover:shadow-lift"
            >
              <b className="text-[17px]">{t}</b>
              <span className="text-[14.5px] leading-relaxed text-mute">
                {d}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Is your money secure? */}
      <section className="bg-night px-5 py-20 text-white lg:px-16">
        <div className="mx-auto flex max-w-360 flex-col gap-10 lg:flex-row">
          <div className="flex w-90 max-w-full flex-col gap-3.5">
            <span className="w-max rounded-pill bg-gold/15 px-3 py-1 text-[11px] font-extrabold tracking-wider text-[#f7c97e] uppercase">
              Is your money secure?
            </span>
            <h2 className="font-display text-4xl leading-tight lg:text-[42px]">
              Rest assured, your funds are in safe hands
            </h2>
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            {ASSURANCES.map(([Icon, t, d]) => (
              <div
                key={t}
                className="flex flex-col gap-2.5 rounded-card border border-white/10 bg-white/6 p-6 transition duration-300 hover:-translate-y-1.5"
              >
                <span className="flex size-13 items-center justify-center rounded-2xl bg-gold/15 text-[#f7c97e]">
                  <Icon size={24} />
                </span>
                <b className="text-[17px]">{t}</b>
                <span className="text-[14.5px] leading-relaxed text-white/70">
                  {d}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founders */}
      <section className="mx-auto max-w-360 px-5 py-20 lg:px-16">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="w-max rounded-pill bg-brand-tint px-3 py-1 text-[11px] font-extrabold tracking-wider text-brand-dark uppercase">
            Our team
          </span>
          <h2 className="font-display text-4xl lg:text-5xl">
            Meet the founders
          </h2>
          <p className="max-w-[60ch] leading-relaxed text-mute">
            Two women with a shared purpose: to raise a generation of
            financially free, wealth-oriented women.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {FOUNDERS.map((f) => (
            <article
              key={f.name}
              className="overflow-hidden rounded-[26px] border border-line bg-white transition duration-300 hover:-translate-y-1.5 hover:shadow-lift"
            >
              <div
                role="img"
                aria-label={`Portrait of ${f.name}`}
                className="flex h-56 items-center justify-center bg-linear-to-br from-brand-tint via-soft to-gold-tint"
              >
                <span className="flex size-24 items-center justify-center rounded-full bg-night font-display text-4xl text-gold">
                  {f.initials}
                </span>
              </div>
              <div className="flex flex-col gap-2.5 px-7 py-6.5 pb-7.5">
                <span className="w-max rounded-pill bg-gold-tint px-3 py-1 text-[11px] font-extrabold tracking-wider text-pending uppercase">
                  {f.role}
                </span>
                <h3 className="font-display text-[30px]">{f.name}</h3>
                {f.body.map((p) => (
                  <p
                    key={p.slice(0, 24)}
                    className="text-[15px] leading-relaxed text-mute"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
