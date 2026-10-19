import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Chips } from "../../../design-system";
import { paths } from "../../../routes/paths";

type Category =
  | "All"
  | "Registration"
  | "Savings"
  | "Payments"
  | "Interest and payout";
const CATEGORIES: Category[] = [
  "All",
  "Registration",
  "Savings",
  "Payments",
  "Interest and payout",
];

const FAQS: { category: Exclude<Category, "All">; q: string; a: string }[] = [
  {
    category: "Registration",
    q: "Who can join Iconic Wealth Hub?",
    a: "Women aged 18 and above who agree to save every month under the savings community’s guidelines. Every registration is reviewed and approved by an admin.",
  },
  {
    category: "Registration",
    q: "How long does approval take?",
    a: "Usually 1–2 working days. You’ll get an email and SMS as soon as your account opens.",
  },
  {
    category: "Registration",
    q: "When do I get into the WhatsApp community?",
    a: "After your first payment of at least ₦10,000 is confirmed. The community link appears in your portal straight away.",
  },
  {
    category: "Savings",
    q: "How much do I have to save?",
    a: "At least ₦10,000 per payment. Save as much as you can each month, in as many payments as you like.",
  },
  {
    category: "Savings",
    q: "What is a monthly savings target?",
    a: "An optional goal you set for each month. We track your progress, remind you until you reach it and celebrate when you do. It’s never enforced.",
  },
  {
    category: "Savings",
    q: "When does a month close?",
    a: "A month opens on the 1st and closes automatically at the end of the 5th of the next month. You can also lock it early once it has at least ₦10,000, so your next payments count toward the following month.",
  },
  {
    category: "Savings",
    q: "I joined mid-year. Do I start from January?",
    a: "If you’re approved by the end of September, you first clear the earlier months (₦10,000 each) as catch-up. Approved after September? Your savings start the next January.",
  },
  {
    category: "Savings",
    q: "Which months do we save in?",
    a: "January to November. December is the payout month.",
  },
  {
    category: "Savings",
    q: "Can I withdraw before year-end?",
    a: "No. Savings are paid out once a year, on payout day in December.",
  },
  {
    category: "Payments",
    q: "Is there a charge on my payments?",
    a: "Yes, a ₦100 platform charge on each payment. It’s included in the total before you pay.",
  },
  {
    category: "Payments",
    q: "My payment shows pending. What now?",
    a: "We’re waiting for Paystack to confirm it. Your savings update only after confirmation. Don’t pay again.",
  },
  {
    category: "Interest and payout",
    q: "How is interest decided?",
    a: "Interest is decided each year by Iconic Wealth Hub. Your portal shows the amount you’ll receive with your payout.",
  },
  {
    category: "Interest and payout",
    q: "When is payout day?",
    a: "On or before 14 December. The exact date is announced each year.",
  },
];

export function FAQPage() {
  const [category, setCategory] = useState<Category>("All");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const list = FAQS.filter(
    (f) =>
      (category === "All" || f.category === category) &&
      (!q || `${f.q} ${f.a}`.toLowerCase().includes(q)),
  );
  return (
    <>
      {/* Hero + search */}
      <section className="bg-soft px-5 pt-14 pb-8 lg:px-16">
        <div className="mx-auto max-w-360">
          <h1 className="font-display text-4xl leading-[1.04] tracking-tight sm:text-5xl lg:text-[60px]">
            FAQs
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <label className="flex h-10.5 w-105 max-w-full items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3 text-mute focus-within:border-brand">
              <Search size={20} className="shrink-0" />
              <span className="sr-only">Search questions</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-mute"
              />
            </label>
            <Chips
              value={category}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              onChange={setCategory}
            />
          </div>
        </div>
      </section>

      {/* Questions */}
      <section className="mx-auto max-w-240 px-5 pt-4 pb-14 lg:px-16">
        {list.length ? (
          list.map((f) => {
            const isOpen = open === f.q;
            return (
              <div key={f.q} className="border-b border-line py-4.5">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : f.q)}
                  className="flex w-full items-center justify-between gap-4 bg-transparent text-left text-[17px] font-extrabold"
                >
                  {f.q}
                  {isOpen ? (
                    <ChevronDown size={20} className="shrink-0" />
                  ) : (
                    <ChevronRight size={20} className="shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-2.5 max-w-[68ch] text-[15px] leading-relaxed text-[#474252]">
                    {f.a}
                  </p>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-9 text-center text-mute">
            <Search size={28} />
            <b className="text-ink">No questions match “{query.trim()}”</b>
            <span>
              Try another word, or{" "}
              <Link to={paths.contact} className="font-bold text-brand">
                contact us
              </Link>
              .
            </span>
          </div>
        )}
      </section>
    </>
  );
}
