import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "../../../../design-system";

export interface Step {
  title: string;
  body: string;
  tag: string;
}

/**
 * Home "How saving with Iconic Wealth Hub works": original layout (number, title, text under a rule)
 * with micro-interactions — autoplay highlight, hover/focus/tap to pick a step, rule fill, number scale, card lift, scroll reveal.
 */
export function HowItWorksSteps({ steps }: { steps: Step[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (reduce || hold || !inView) return;
    const t = window.setInterval(
      () => setActive((a) => (a + 1) % steps.length),
      2600,
    );
    return () => window.clearInterval(t);
  }, [reduce, hold, inView, steps.length]);
  return (
    <div
      ref={ref}
      className="grid gap-6 md:grid-cols-4"
      onMouseLeave={() => setHold(false)}
    >
      {steps.map((s, i) => {
        const on = i === active;
        const done = i <= active;
        return (
          <motion.div
            key={s.title}
            tabIndex={0}
            role="button"
            aria-pressed={on}
            initial={{ opacity: 0, y: 14 }}
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
            className="relative z-0 flex cursor-pointer flex-col gap-3 px-1 pb-1.5 outline-none"
          >
            <motion.span
              aria-hidden
              className="absolute -inset-x-3.5 -top-4 -bottom-3.5 -z-10 rounded-card bg-white shadow-lift"
              animate={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.97 }}
              transition={{ duration: 0.35 }}
            />
            <span className="block h-0.75 overflow-hidden rounded-full bg-line">
              <motion.i
                className="block h-full bg-linear-to-r from-brand to-gold"
                animate={{ width: done ? "100%" : "0%" }}
                transition={{ duration: 0.7 }}
              />
            </span>
            <div className="flex items-end justify-between">
              <motion.span
                className="origin-bottom-left font-display text-[30px]"
                animate={{
                  scale: on ? 1.3 : 1,
                  color: on ? "#f2a93b" : "#6c2bd9",
                }}
              >
                {i + 1}
              </motion.span>
              <span
                className={cn(
                  "text-[10.5px] font-extrabold tracking-wider uppercase transition-colors",
                  on ? "text-brand-dark" : "text-mute-2",
                )}
              >
                {s.tag}
              </span>
            </div>
            <h3
              className={cn(
                "text-[19px] font-extrabold transition-colors",
                on && "text-brand-dark",
              )}
            >
              {s.title}
            </h3>
            <p className="leading-relaxed text-mute">{s.body}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
