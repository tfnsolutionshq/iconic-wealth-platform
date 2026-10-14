import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  MessageCircle,
  Users,
} from "lucide-react";
import { formatNaira, formatShortDate, minimumFor } from "@/domain/rules";
import { useAuth } from "../../../contexts/AuthContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useSavings } from "../../../hooks/useSavings";
import { Card, cn } from "../../../design-system";
import { paths } from "../../../routes/paths";
import { env } from "@/app/config/env";

/** MEM-16: community access, WhatsApp support and member FAQs. */
export function SupportPage() {
  const { session, updateMember } = useAuth();
  const { repos } = useServices();
  const member = session?.kind === "member" ? session.member : null;
  const { data } = useSavings(member);
  const [open, setOpen] = useState<string | null>(null);

  if (!member || !data) return <p className="text-mute">Loading…</p>;
  const { settings, year } = data;
  const min = minimumFor(settings, year.year);
  const payout = new Date(
    `${settings.payoutDates[year.year] ?? `${year.year}-12-14`}T10:00`,
  );

  const faqs = [
    {
      q: "How much do I have to save?",
      a: `At least ${formatNaira(min)} per payment. Save as much as you can each month, in as many payments as you like.`,
    },
    {
      q: "What is a monthly savings target?",
      a: "An optional goal you set for each month. We track your progress, remind you until you reach it and celebrate when you do. It’s never enforced.",
    },
    {
      q: "When does a month close?",
      a: `A month opens on the 1st and closes automatically at the end of the 5th of the next month. You can also lock it early once it has at least ${formatNaira(min)}, so your next payments count toward the following month.`,
    },
    {
      q: "I joined mid-year. Do I start from January?",
      a: `If you’re approved by the end of September, you first clear the earlier months (${formatNaira(min)} each) as catch-up. Approved after September? Your savings start the next January.`,
    },
    {
      q: "Which months do we save in?",
      a: "January to November. December is the payout month.",
    },
    {
      q: "Can I withdraw before year-end?",
      a: "No. Savings are paid out once a year, on payout day in December.",
    },
    {
      q: "Is there a charge on my payments?",
      a: `Yes, a ${formatNaira(settings.platformCharge)} platform charge on each payment. It’s included in the total before you pay.`,
    },
    {
      q: "My payment shows pending. What now?",
      a: "We’re waiting for Paystack to confirm it. Your savings update only after confirmation. Don’t pay again.",
    },
    {
      q: "When is payout day?",
      a: `On or before ${formatShortDate(payout)}. The exact date is announced each year.`,
    },
    {
      q: "When do I get into the WhatsApp community?",
      a: `After your first payment of at least ${formatNaira(min)} is confirmed. The community link appears in your portal straight away.`,
    },
  ];

  const join = async () => {
    await repos.member.markCommunityJoined(member.id);
    updateMember({ ...member, community: "Granted" });
  };

  return (
    <div className="mx-auto flex max-w-140 flex-col gap-4">
      <h1 className="text-[28px] font-extrabold tracking-tight">Support</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {member.community === "Locked" ? (
          <Card className="flex flex-col gap-2.5 opacity-85">
            <span className="flex size-10.5 items-center justify-center rounded-input bg-soft">
              <Lock size={22} />
            </span>
            <b>Join community</b>
            <span className="text-[13px] font-semibold text-mute">
              Unlocks after your first payment of at least {formatNaira(min)} is
              confirmed.
            </span>
            <Link
              to={paths.member.contribute}
              className="text-sm font-bold text-brand"
            >
              Make your first payment ›
            </Link>
          </Card>
        ) : (
          <Card className="flex flex-col gap-2.5">
            <span className="flex size-10.5 items-center justify-center rounded-input bg-brand-tint text-brand-dark">
              <Users size={22} />
            </span>
            <b>Join community</b>
            <span className="text-[13px] font-semibold text-mute">
              Members’ WhatsApp community for reminders and announcements.
            </span>
            <a
              href={env.waCommunityUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={join}
              className="inline-flex h-9 items-center self-start rounded-pill bg-brand px-3.5 text-[13px] font-bold text-white"
            >
              Open WhatsApp ›
            </a>
          </Card>
        )}
        <Card className="flex flex-col gap-2.5">
          <span className="flex size-10.5 items-center justify-center rounded-input bg-gold-tint text-[#7a5410]">
            <MessageCircle size={22} />
          </span>
          <b>Contact support</b>
          <span className="text-[13px] font-semibold text-mute">
            Chat with the support team on WhatsApp.
          </span>
          <a
            href={env.waSupportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center self-start rounded-pill border-[1.5px] border-line bg-white px-3.5 text-[13px] font-bold"
          >
            Start a chat ›
          </a>
        </Card>
      </div>

      <h2 className="pt-1.5 text-[19px] font-extrabold">FAQs</h2>
      <Card className="px-5 py-1">
        {faqs.map((f) => {
          const isOpen = open === f.q;
          return (
            <div
              key={f.q}
              className="border-b border-line py-3.5 last:border-b-0"
            >
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
                <p
                  className={cn(
                    "mt-2.5 max-w-[68ch] text-[15px] leading-relaxed text-[#474252]",
                  )}
                >
                  {f.a}
                </p>
              )}
            </div>
          );
        })}
      </Card>
      <span className="text-[13px] font-semibold text-mute">
        WhatsApp links are placeholders until Iconic Wealth Hub shares its
        community and support numbers.
      </span>
    </div>
  );
}
