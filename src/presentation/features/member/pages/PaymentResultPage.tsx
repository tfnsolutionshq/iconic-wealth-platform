import { Navigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Clock, Star, Users, X } from "lucide-react";
import { useContributionDraft } from "../../../contexts/ContributionDraftContext";
import { ButtonLink, Card, KeyValue, Pill, cn } from "../../../design-system";
import { MONTHS, formatNaira } from "@/domain/rules";
import { paths } from "../../../routes/paths";
import { env } from "@/app/config/env";

/** MEM-11 (v5): success (with target celebration and community unlock), pending ("don't pay again"), failed. */
export function PaymentResultPage() {
  const { result } = useContributionDraft();
  const reduce = useReducedMotion();
  if (!result) return <Navigate to={paths.member.home} replace />;
  const t = result.transaction;
  const o = result.outcome;
  const view = {
    success: {
      icon: <Check size={40} />,
      tile: "bg-brand-tint text-brand-dark",
      title: "Contribution recorded",
      body: t
        ? `${formatNaira(t.amountKobo)} has been added to your savings.`
        : "",
    },
    pending: {
      icon: <Clock size={40} />,
      tile: "bg-pending-tint text-pending",
      title: "Confirming your payment",
      body: "We’re waiting for Paystack to confirm. This usually takes under a minute. Please don’t pay again.",
    },
    failed: {
      icon: <X size={40} />,
      tile: "bg-fail-tint text-fail",
      title: "Payment didn’t go through",
      body: `${t?.failureReason ?? "Your bank declined the payment"}. No money was taken and nothing was added to your savings.`,
    },
  }[o];
  return (
    <div className="mx-auto flex max-w-140 flex-col items-center gap-4 pt-8 text-center">
      <span
        className={cn(
          "flex size-21 items-center justify-center rounded-sheet",
          view.tile,
        )}
      >
        {view.icon}
      </span>
      <h1 className="text-[28px] font-extrabold">{view.title}</h1>
      <p className="max-w-[40ch] text-[#474252]">{view.body}</p>
      <Pill
        tone={o === "success" ? "ok" : o === "pending" ? "pending" : "fail"}
      >
        {o === "success"
          ? "Successful"
          : o === "pending"
            ? "Pending"
            : "Failed"}
      </Pill>
      {result.targetMetMonth !== null && (
        <motion.div
          className="w-full"
          initial={reduce ? false : { scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <Card className="flex flex-col items-center gap-1.5 border-[#f6d9a4] bg-linear-to-b from-[#fff8ea] to-white">
            <span className="flex size-13 items-center justify-center rounded-2xl bg-gold-tint text-[#7a5410]">
              <Star size={26} />
            </span>
            <b className="text-[19px]">
              {MONTHS[result.targetMetMonth]} target met!
            </b>
            <span className="text-sm text-mute">
              Well done. Keep the streak going next month.
            </span>
          </Card>
        </motion.div>
      )}
      {result.communityUnlocked && (
        <Card className="flex w-full flex-wrap items-center gap-3 border-[#cdb8f6] bg-linear-to-b from-[#f7f2fe] to-white text-left">
          <span className="flex size-10.5 shrink-0 items-center justify-center rounded-input bg-brand-tint text-brand-dark">
            <Users size={20} />
          </span>
          <span className="flex min-w-0 flex-1 basis-40 flex-col">
            <b>WhatsApp community unlocked</b>
            <span className="text-[13px] font-semibold text-mute">
              Join other members for reminders and support.
            </span>
          </span>
          <ButtonLink to={env.waCommunityUrl} external size="sm">
            Join
          </ButtonLink>
        </Card>
      )}
      {t && (
        <Card className="w-full text-left">
          <KeyValue
            label="Amount paid"
            value={formatNaira(t.amountKobo + t.platformChargeKobo)}
          />
          <KeyValue
            label="Applied to"
            value={`${t.allocations.map((a) => MONTHS[a.month]).join(", ")} ${t.year}`}
          />
          <KeyValue
            label="Reference"
            value={<span className="font-mono text-sm">{t.reference}</span>}
          />
        </Card>
      )}
      <div className="flex w-full flex-col gap-2.5">
        {o === "failed" ? (
          <>
            <ButtonLink to={paths.member.contribute} full>
              Try again
            </ButtonLink>
            <ButtonLink to={env.waSupportUrl} external variant="outline" full>
              Contact support
            </ButtonLink>
          </>
        ) : (
          <ButtonLink to={paths.member.home} full>
            Done
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
