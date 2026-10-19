import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ChevronLeft, Info, Lock } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useContributionDraft } from "../../../contexts/ContributionDraftContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { useSavings } from "../../../hooks/useSavings";
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  KeyValue,
  OpenDecisionTag,
} from "../../../design-system";
import {
  MONTHS,
  chargeBreakdown,
  formatNaira,
  isCatchUp,
  planAllocation,
} from "@/domain/rules";
import { ContributeUseCase } from "@/domain/usecases/contribute";
import { paths } from "../../../routes/paths";

/** MEM-09/10 (v5): one total, including the ₦100 platform charge. No separate charge line elsewhere. */
export function ReviewPaymentPage() {
  const { session, updateMember } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const navigate = useNavigate();
  const draft = useContributionDraft();
  const member = session?.kind === "member" ? session.member : null;
  const { data } = useSavings(member);
  const [busy, setBusy] = useState(false);
  if (!draft.amount) return <Navigate to={paths.member.contribute} replace />;
  if (!member || !data) return <p className="text-mute">Loading…</p>;
  const { year, txs, now, settings } = data;
  const plan = planAllocation(draft.amount, year, txs, now, settings);
  if (!plan.ok) return <Navigate to={paths.member.contribute} replace />;
  const b = chargeBreakdown(draft.amount, settings.platformCharge);
  const a = plan.allocations;
  const goesTo =
    a.length > 1
      ? `${MONTHS[a[0].month]} – ${MONTHS[a[a.length - 1].month]} ${year.year}`
      : `${MONTHS[a[0].month]} ${year.year}`;
  const pay = async () => {
    setBusy(true);
    try {
      const r = await new ContributeUseCase(
        repos.contribution,
        repos.gateway,
      ).pay(member.id, year, txs, draft.amount!, now, settings);
      if (r.communityUnlocked)
        updateMember({ ...member, community: "Eligible" });
      draft.setResult(r);
      navigate(paths.member.result);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto flex max-w-140 flex-col gap-4">
      <div className="flex h-13 items-center gap-3">
        <Link
          to={paths.member.contribute}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line bg-white"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-[19px] font-extrabold">Review payment</h1>
      </div>
      <div className="flex flex-col items-center gap-1 py-3">
        <span className="text-[13px] font-semibold text-mute">
          Total to pay
        </span>
        <span className="text-3xl font-extrabold break-words tabular-nums sm:text-[44px]">
          {formatNaira(b.total)}
        </span>
        <span className="text-[13px] font-semibold text-mute">
          Includes the {formatNaira(b.platformCharge)} platform charge
        </span>
      </div>
      <Card>
        <KeyValue label="Goes to" value={goesTo} />
        <KeyValue label="Amount saved" value={formatNaira(b.amount)} />
        {a.length > 1 &&
          a.map((x) => (
            <KeyValue
              key={x.month}
              label={`· ${MONTHS[x.month]}${isCatchUp(year, x.month) ? " (catch-up)" : ""}`}
              value={formatNaira(x.amountKobo)}
            />
          ))}
      </Card>
      <Banner tone="neutral" icon={<Info size={20} />}>
        You’ll pay on Paystack’s secure page. Your savings update only after
        Paystack confirms the payment.
      </Banner>
      <Button full icon={<Lock size={18} />} disabled={busy} onClick={pay}>
        {busy
          ? "Opening Paystack…"
          : `Pay ${formatNaira(b.total)} with Paystack`}
      </Button>
      <ButtonLink to={paths.member.contribute} variant="outline" full>
        Change amount
      </ButtonLink>
      <OpenDecisionTag code="OD-06/07">
        Gateway fee and platform charge treatment
      </OpenDecisionTag>
    </div>
  );
}
