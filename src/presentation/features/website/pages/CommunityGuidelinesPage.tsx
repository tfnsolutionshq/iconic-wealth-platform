import { AlertCircle, Mail, Phone, ShieldCheck } from "lucide-react";
import { ButtonLink } from "../../../design-system";
import { paths } from "../../../routes/paths";
import { COMMUNITY_GUIDELINES } from "../content/communityGuidelines";

export function CommunityGuidelinesPage() {
  const g = COMMUNITY_GUIDELINES;

  return (
    <>
      <section className="border-b border-line bg-soft px-5 py-16 lg:px-16 lg:py-20">
        <div className="mx-auto flex max-w-260 flex-col gap-5">
          <span className="w-max rounded-pill bg-brand-tint px-3.5 py-1 text-xs font-extrabold tracking-wide text-brand-dark uppercase">
            {g.title}
          </span>
          <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
            {g.greeting}
          </h1>
          <div className="flex flex-col gap-3 text-[17px] leading-relaxed text-mute">
            {g.intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-260 flex-col gap-12 px-5 py-16 lg:px-16">
        <div className="grid gap-5 md:grid-cols-3">
          {g.overview.map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-2.5 rounded-card border border-line bg-white p-6"
            >
              <h2 className="text-lg font-extrabold text-ink">{item.title}</h2>
              <p className="text-[15px] leading-relaxed text-mute">
                {item.body}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand-dark">
              <ShieldCheck size={20} />
            </span>
            <h2 className="font-display text-3xl text-ink">Key Guidelines</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {g.keyGuidelines.map((item, idx) => (
              <div
                key={item.title}
                className="flex flex-col gap-2 rounded-card border border-line bg-white p-6"
              >
                <span className="text-xs font-extrabold tracking-wide text-brand uppercase">
                  0{idx + 1} · {item.title}
                </span>
                <p className="text-[15px] leading-relaxed text-mute">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-card border border-gold/40 bg-gold-tint/50 p-6">
          <AlertCircle size={22} className="mt-0.5 shrink-0 text-[#7a5410]" />
          <div className="flex flex-col gap-1">
            <b className="text-base text-ink">Important Reminder</b>
            <p className="text-[15px] leading-relaxed text-[#5a3d0a]">
              {g.importantReminder}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6 rounded-card bg-night p-8 text-white sm:p-10">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-3xl">Getting started</h2>
            <p className="max-w-[60ch] text-[15.5px] leading-relaxed text-white/80">
              {g.gettingStarted}
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-sm font-semibold text-white/90">
            <a
              href={`tel:${g.contact.phone.replace(/\s+/g, "")}`}
              className="flex items-center gap-2 text-white no-underline hover:text-gold"
            >
              <Phone size={16} />
              Phone / WhatsApp: {g.contact.phone}
            </a>
            <a
              href={`mailto:${g.contact.email}`}
              className="flex items-center gap-2 text-white no-underline hover:text-gold"
            >
              <Mail size={16} />
              Email: {g.contact.email}
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-6">
            <div className="flex flex-col gap-0.5">
              <b className="text-base text-gold">{g.signoff}</b>
              <span className="text-xs text-white/70">
                ICONIC WEALTH HUB · {g.tagline} · {g.closing}
              </span>
            </div>
            <ButtonLink to={paths.register} variant="gold">
              Become a member
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
