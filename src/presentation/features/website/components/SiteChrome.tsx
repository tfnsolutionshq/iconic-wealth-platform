import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Menu, X } from "lucide-react";
import { ButtonLink, Logo, cn } from "../../../design-system";
import { paths } from "../../../routes/paths";

const NAV = [
  ["About", paths.about],
  ["How it works", paths.howItWorks],
  ["Savings", paths.savings],
  ["Membership", paths.membership],
  ["FAQs", paths.faqs],
  ["Contact", paths.contact],
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-360 items-center gap-7 px-5 lg:px-16">
        <Logo />
        <nav className="ml-6 hidden gap-6 lg:flex">
          {NAV.map(([l, to]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "text-[15px] font-bold",
                  isActive ? "text-brand" : "text-[#474252] hover:text-brand",
                )
              }
            >
              {l}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2.5 lg:flex">
          <ButtonLink to={paths.admin.home} variant="outline" size="md">
            Admin portal
          </ButtonLink>
          <ButtonLink to={paths.login} variant="outline" size="md">
            Log in
          </ButtonLink>
          <ButtonLink to={paths.register} size="md">
            Become a member
          </ButtonLink>
        </div>
        <button
          className="ml-auto flex size-11 items-center justify-center rounded-full border-[1.5px] border-line lg:hidden"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu size={20} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 bg-ink/55 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.nav
              className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-5 pb-8"
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <b className="text-lg">Menu</b>
                <button
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="flex size-10 items-center justify-center rounded-full border border-line"
                >
                  <X size={18} />
                </button>
              </div>
              {[
                ["Home", paths.home],
                ...NAV,
                ["Log in", paths.login],
                ["Become a member", paths.register],
                ["Admin portal", paths.admin.home],
              ].map(([l, to]) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between border-b border-line py-3 font-bold last:border-0"
                >
                  {l}
                  <ChevronRight size={18} />
                </Link>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function CtaBand() {
  return (
    <section className="mx-5 my-10 flex flex-col justify-between gap-5 rounded-sheet bg-brand-tint p-8 lg:mx-16 lg:flex-row lg:items-center lg:px-14 lg:py-12">
      <div className="flex flex-col gap-2">
        <span className="w-max rounded-pill bg-white px-3 py-1 text-[11px] font-extrabold tracking-wider text-brand-dark uppercase">
          Iconic Wealth Queens
        </span>
        <h2 className="font-display text-[34px] leading-tight lg:text-[40px]">
          Ready to build and multiply your wealth?
        </h2>
        <p className="text-mute">
          Join a community of women saving with discipline. Registration takes
          about five minutes.
        </p>
      </div>
      <div className="flex gap-3">
        <ButtonLink to={paths.register}>Join our savings community</ButtonLink>
        <ButtonLink to={paths.login} variant="outline">
          Log in
        </ButtonLink>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const cols: [string, [string, string][]][] = [
    [
      "Community",
      [
        ["About", paths.about],
        ["How it works", paths.howItWorks],
        ["Membership", paths.membership],
      ],
    ],
    [
      "Savings",
      [
        ["Savings rules", paths.savings],
        ["FAQs", paths.faqs],
        ["Member login", paths.login],
        ["Admin portal", paths.admin.home],
      ],
    ],
    [
      "Contact",
      [
        ["Send a message", paths.contact],
        ["Site map", paths.sitemap],
      ],
    ],
  ];
  return (
    <footer className="bg-night px-5 py-12 text-white/75 lg:px-16">
      <div className="mx-auto flex max-w-360 flex-col gap-10 lg:flex-row">
        <div className="flex max-w-75 flex-col gap-3">
          <Logo white className="h-14.5 w-auto" />
          <p className="text-sm leading-relaxed">
            A members-only savings community. Save monthly, receive your savings
            at year-end.
          </p>
        </div>
        <div className="flex flex-wrap gap-12 lg:ml-auto">
          {cols.map(([h, links]) => (
            <div key={h}>
              <h4 className="mb-3 text-sm font-bold text-white">{h}</h4>
              {links.map(([l, to]) => (
                <Link
                  key={l}
                  to={to}
                  className="block text-sm leading-8 hover:text-white"
                >
                  {l}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
