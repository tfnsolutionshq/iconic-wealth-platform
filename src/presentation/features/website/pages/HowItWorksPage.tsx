import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { CalendarDays, Check, Lock, PiggyBank } from "lucide-react";
import { cn } from "../../../design-system";

const MONTH_STEPS = [
  [
    CalendarDays,
    "The month opens",
    "On the 1st, a new savings month opens. Every payment of at least ₦10,000 is added to it.",
  ],
  [
    PiggyBank,
    "Save as you can",
    "Pay once or several times. Your monthly target shows how close you are, and we remind you until you reach it.",
  ],
  [
    Lock,
    "Lock it early (optional)",
    "Once the month has ₦10,000 or more, you can lock it. Your next payments then count toward the following month.",
  ],
  [
    Check,
    "It closes on the 5th",
    "At the end of the 5th of the next month, the month closes automatically and its total is saved.",
  ],
] as const;

const YEAR_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
] as const;

/**
 * "Your year at a glance": the prototype's 12-month strip (`yg-track`,
 * `data-speed="850"`). Completed months fill purple (`.done`), the current
 * month lifts (`.on`), and December pulses gold (`paypulse`) when reached.
 * Hover/focus/tap picks a month and holds the autoplay, like the month cards.
 */
function YearGlance() {
  const months = [...YEAR_MONTHS, "Dec"];
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (reduce || hold || !inView) return;
    const t = window.setInterval(
      () => setActive((a) => (a + 1) % months.length),
      850,
    );
    return () => window.clearInterval(t);
  }, [reduce, hold, inView, months.length]);
  return (
    <ol
      ref={ref}
      className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-12"
      onMouseLeave={() => setHold(false)}
    >
      {months.map((m, i) => {
        const pay = m === "Dec";
        const done = i <= active;
        const on = i === active;
        return (
          <li key={m}>
            <button
              type="button"
              aria-pressed={on}
              onMouseEnter={() => {
                setHold(true);
                setActive(i);
              }}
              onFocus={() => {
                setHold(true);
                setActive(i);
              }}
              onClick={() => {
                setHold(true);
                setActive(i);
              }}
              className={cn(
                "flex w-full flex-col items-center gap-1 rounded-xl py-3 transition duration-300 hover:-translate-y-1",
                pay
                  ? "bg-gold text-[#2a1a00]"
                  : done
                    ? "bg-brand text-white"
                    : "bg-brand-tint text-brand-dark",
                on &&
                  "-translate-y-1 shadow-[0_14px_26px_-14px_rgb(108_43_217/0.6)]",
                pay && on && !reduce && "paypulse",
              )}
            >
              <b className="text-sm">{m}</b>
              <small className="text-[11px] font-bold opacity-75">
                {pay ? "Payout" : "Save"}
              </small>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * "Your month at a glance": the prototype's 4 glance cards with the same
 * micro-interactions as the home steps — autoplay highlight, hover/focus/tap
 * to pick a card, progress fill, tile pop, scroll reveal.
 */
function MonthGlance() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (reduce || hold || !inView) return;
    const t = window.setInterval(
      () => setActive((a) => (a + 1) % MONTH_STEPS.length),
      2600,
    );
    return () => window.clearInterval(t);
  }, [reduce, hold, inView]);
  return (
    <div
      ref={ref}
      className="grid gap-4 md:grid-cols-4"
      onMouseLeave={() => setHold(false)}
    >
      {MONTH_STEPS.map(([Icon, title, body], i) => {
        const on = i === active;
        return (
          <motion.div
            key={title}
            tabIndex={0}
            role="button"
            aria-pressed={on}
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.11, duration: 0.5 }}
            onMouseEnter={() => {
              setHold(true);
              setActive(i);
            }}
            onFocus={() => {
              setHold(true);
              setActive(i);
            }}
            onClick={() => {
              setHold(true);
              setActive(i);
            }}
            className={cn(
              "relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-card border bg-white p-5.5 outline-none transition duration-300 hover:-translate-y-1.5 hover:shadow-lift",
              on
                ? "-translate-y-1.5 border-[#d9c7fb] shadow-lift"
                : "border-line",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-4 right-4.5 font-display text-[34px] leading-none transition-colors",
                on ? "text-gold" : "text-brand-tint",
              )}
            >
              {i + 1}
            </span>
            <motion.span
              className="flex size-13 items-center justify-center rounded-2xl bg-brand-tint text-brand-dark"
              animate={
                on ? { rotate: -6, scale: 1.08 } : { rotate: 0, scale: 1 }
              }
              transition={{ duration: 0.35 }}
            >
              <Icon size={24} />
            </motion.span>
            <b className="text-[17px]">{title}</b>
            <span className="text-[14.5px] leading-relaxed text-mute">
              {body}
            </span>
            <span className="absolute inset-x-0 bottom-0 h-0.75">
              <motion.i
                className="block h-full bg-linear-to-r from-brand to-gold"
                animate={{ width: on ? "100%" : "0%" }}
                transition={{ duration: on ? 2.6 : 0.3, ease: "linear" }}
              />
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

export function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-soft px-5 pt-16 pb-10 lg:px-16">
        <div className="mx-auto max-w-360">
          <h1 className="max-w-[18ch] font-display text-5xl leading-[1.04] tracking-tight lg:text-[60px]">
            How it works
          </h1>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-[#474252]">
            How a savings month works, and how the year runs from your first
            payment to payout day.
          </p>
        </div>
      </section>

      {/* Month at a glance */}
      <section className="mx-auto max-w-360 px-5 pt-14 lg:px-16">
        <div className="mb-6 flex flex-col gap-2.5">
          <span className="w-max rounded-pill bg-brand-tint px-3 py-1 text-[11px] font-extrabold tracking-wider text-brand-dark uppercase">
            Your month at a glance
          </span>
          <h2 className="font-display text-4xl lg:text-[40px]">
            How a savings month works
          </h2>
        </div>
        <MonthGlance />
      </section>

      {/* Year at a glance */}
      <section className="mx-auto max-w-360 px-5 py-14 lg:px-16">
        <div className="flex flex-col gap-4 rounded-card border border-line bg-white p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2.5">
              <span className="w-max rounded-pill bg-brand-tint px-3 py-1 text-[11px] font-extrabold tracking-wider text-brand-dark uppercase">
                Your year at a glance
              </span>
              <h2 className="text-[28px] font-extrabold tracking-tight">
                Eleven months of saving, one payout
              </h2>
            </div>
            <p className="max-w-[46ch] leading-relaxed text-mute">
              Approved by the end of September? You first clear the earlier
              months as catch-up. Approved later in the year? Your savings start
              the next January.
            </p>
          </div>
          <YearGlance />
        </div>
      </section>
    </>
  );
}
