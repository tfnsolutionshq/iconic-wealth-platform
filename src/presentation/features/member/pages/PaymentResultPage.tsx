import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Clock, Download, Star, Users, X } from "lucide-react";
import type { MonthIndex, Transaction } from "@/domain/entities";
import type { VerifiedContribution } from "@/domain/repositories";
import { useAuth } from "../../../contexts/AuthContext";
import { useContributionDraft } from "../../../contexts/ContributionDraftContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { Button, ButtonLink, Card, KeyValue, Pill, cn } from "../../../design-system";
import { MONTHS, formatNaira } from "@/domain/rules";
import { paths } from "../../../routes/paths";
import { env } from "@/app/config/env";
import { downloadReceiptPdf } from "../components/TransactionParts";


export function PaymentResultPage() {
  const { result } = useContributionDraft();
  const { session } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const reduce = useReducedMotion();
  const [searchParams] = useSearchParams();

  const member = session?.kind === "member" ? session.member : null;
  const urlRef = searchParams.get("reference") || searchParams.get("trxref");

  const [verifying, setVerifying] = useState(Boolean(urlRef && !result));
  const [verifiedData, setVerifiedData] = useState<VerifiedContribution | null>(null);

  useEffect(() => {
    if (!urlRef || result) return;
    let active = true;
    repos.contribution
      .verify(urlRef)
      .then((res) => {
        if (active) {
          setVerifiedData(res);
          setVerifying(false);
        }
      })
      .catch(() => {
        if (active) setVerifying(false);
      });
    return () => {
      active = false;
    };
  }, [urlRef, result, repos]);

  if (!result && !urlRef) {
    return <ButtonLink to={paths.member.home} full>Return to dashboard</ButtonLink>;
  }

  if (verifying) {
    return (
      <div className="mx-auto flex max-w-140 flex-col items-center gap-4 pt-16 text-center">
        <span className="flex size-21 items-center justify-center rounded-sheet bg-brand-tint text-brand-dark animate-pulse">
          <Clock size={40} />
        </span>
        <h1 className="text-[28px] font-extrabold">Verifying your payment…</h1>
        <p className="max-w-[40ch] text-mute">
          We are confirming your transaction with Paystack. This only takes a moment.
        </p>
      </div>
    );
  }

  const now = new Date();
  const currentMonth = Math.min(now.getMonth(), 10);
  const currentYear = now.getFullYear();

  const t = verifiedData?.transaction ?? result?.transaction;
  const o: "success" | "pending" | "failed" = verifiedData
    ? (t?.status === "Successful"
        ? "success"
        : t?.status === "Failed"
          ? "failed"
          : "pending")
    : (result?.outcome ?? (urlRef ? "failed" : "success"));

  const reference =
    t?.reference ?? urlRef ?? `IWH-C-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // Use net amount saved if available, else total amount
  const amountSavedKobo = verifiedData?.savingsMonth?.savedAmount || t?.amountKobo || 10_000_00;
  const amountPaidKobo = (t?.amountKobo || 0) + (t?.platformChargeKobo || 0) || amountSavedKobo;

  const monthName =
    verifiedData?.savingsMonth?.monthName ||
    (t?.allocations?.[0] ? MONTHS[t.allocations[0].month] : MONTHS[currentMonth]);
  const appliedYear = verifiedData?.savingsMonth?.year || t?.year || currentYear;
  const targetMet =
    o === "success" &&
    Boolean(verifiedData?.targetMet || (result && result.targetMetMonth !== null));

  const downloadReceipt = () => {
    if (!member) return;
    const tx: Transaction = t ?? {
      id: reference,
      reference,
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`,
      kind: "Contribution",
      year: appliedYear,
      allocations: [{ month: currentMonth as MonthIndex, amountKobo: amountSavedKobo }],
      amountKobo: amountPaidKobo,
      platformChargeKobo: t?.platformChargeKobo ?? 0,
      status: "Successful",
      late: false,
      createdAt: now.toISOString(),
      paymentMethod: "Online",
    };
    downloadReceiptPdf(tx, `${member.firstName} ${member.lastName}`);
    toast("Receipt downloaded.");
  };

  const view = {
    success: {
      icon: <Check size={40} />,
      tile: "bg-brand-tint text-brand-dark",
      title: "Contribution recorded",
      body: `${formatNaira(amountSavedKobo)} has been added to your ${monthName} savings.`,
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
      body: t?.failureReason && t.failureReason.includes("No money was taken")
        ? t.failureReason
        : `${t?.failureReason ? `${t.failureReason.replace(/\.+$/, "")}. ` : "Declined by your bank: insufficient funds. "}No money was taken and nothing was added to your savings.`,
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

      {targetMet && (
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
              {monthName} target met!
            </b>
            <span className="text-sm text-mute">
              Well done. Keep the streak going next month.
            </span>
          </Card>
        </motion.div>
      )}

      {result?.communityUnlocked && (
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

      {(o === "success" || o === "failed") && (
        <Card className="w-full text-left">
          <KeyValue label="Amount paid" value={formatNaira(amountPaidKobo)} />
          <KeyValue
            label="Applied to"
            value={`${monthName} ${appliedYear}`}
          />
          <KeyValue
            label="Reference"
            value={<span className="font-mono text-sm">{reference}</span>}
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
          <>
            <ButtonLink to={paths.member.home} full>
              Done
            </ButtonLink>
            {o === "success" && member && (
              <Button
                variant="outline"
                full
                icon={<Download size={18} />}
                onClick={downloadReceipt}
              >
                Download receipt
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
