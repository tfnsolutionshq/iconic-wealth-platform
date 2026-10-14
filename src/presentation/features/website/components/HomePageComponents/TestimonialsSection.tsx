import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { Testimonial } from "@/domain/entities";
import { useServices } from "../../../../contexts/ServicesContext";

/**
 * Admin-managed testimonials (Admin › Content). Up to 3: compact grid. More than 3: every testimonial scrolls
 * continuously (nothing truncated), pausing on hover/focus; reduced motion → swipeable row instead.
 */
export function TestimonialsSection() {
  const { repos } = useServices();
  const [items, setItems] = useState<Testimonial[]>([]);
  useEffect(() => {
    repos.testimonials.listPublished().then(setItems);
  }, [repos]);
  if (!items.length) return null;
  const scroll = items.length > 3;
  return (
    <section className="mx-auto max-w-360 px-5 py-11 lg:px-16">
      <div className="mb-4.5 flex flex-col gap-2">
        <span className="w-max rounded-pill bg-brand-tint px-3 py-1 text-[11px] font-extrabold tracking-wider text-brand-dark uppercase">
          Testimonials
        </span>
        <h2 className="font-display text-4xl lg:text-[40px]">
          What members say
        </h2>
      </div>
      {scroll ? (
        <Marquee items={items} />
      ) : (
        <div className="grid gap-3.5 md:grid-cols-3">
          {items.map((t) => (
            <Card key={t.id} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}

function Card({ t, hidden }: { t: Testimonial; hidden?: boolean }) {
  return (
    <figure
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : 0}
      className="flex w-70 shrink-0 flex-col gap-3 rounded-card border border-line bg-white p-5.5 transition duration-300 hover:-translate-y-1.5 hover:shadow-lift md:w-90 md:shrink md:in-[.grid_&]:w-auto"
    >
      <span className="font-display text-5xl leading-[.5] text-gold">“</span>
      <q className="font-display text-[17.5px] leading-snug">{t.quote}</q>
      <figcaption className="mt-auto flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-[#e4d7fb] text-xs font-extrabold text-[#3b1580]">
          {t.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </span>
        <span className="flex flex-col">
          <b className="text-sm">{t.name}</b>
          <span className="text-xs font-semibold text-mute">
            {t.descriptor}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/** CSS animation so pausing on hover/focus resumes from the same point (no jump). */
function Marquee({ items }: { items: Testimonial[] }) {
  const reduce = useReducedMotion();
  if (reduce)
    return (
      <div className="flex snap-x gap-3.5 overflow-x-auto pb-2">
        {items.map((t) => (
          <div key={t.id} className="snap-start">
            <Card t={t} />
          </div>
        ))}
      </div>
    );
  return (
    <div
      aria-label="Member testimonials"
      className="group overflow-hidden py-2.5 mask-[linear-gradient(90deg,transparent,#000_5%,#000_95%,transparent)]"
    >
      <div
        className="testimonial-track flex w-max gap-3.5 pr-3.5 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]"
        style={{ animationDuration: `${items.length * 8}s` }}
      >
        {[...items, ...items].map((t, k) => (
          <Card key={`${t.id}-${k}`} t={t} hidden={k >= items.length} />
        ))}
      </div>
    </div>
  );
}
