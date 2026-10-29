import { useEffect, useState } from "react";
import { Check, Clock, Download, Landmark } from "lucide-react";
import type { Transaction } from "@/domain/entities";
import { formatNaira } from "@/domain/rules";
import { useAuth } from "../../../contexts/AuthContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { Button, ButtonLink, Card, KeyValue, Pill } from "../../../design-system";
import { paths } from "../../../routes/paths";
import {
  TX_STATUS_TONE,
  downloadFile,
  fmtDateTime,
  receiptHtml,
} from "./TransactionParts";

/** MEM-19: payout status page shown on payout day and on the year-end payout overview once withdrawn. */
export function PayoutStatusView({
  payout,
  onUpdated,
}: {
  payout: Transaction;
  onUpdated?: () => void;
}) {
  const { session } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const member = session?.kind === "member" ? session.member : null;
  const [current, setCurrent] = useState(payout);
  const [busy, setBusy] = useState(false);

  useEffect(() => setCurrent(payout), [payout]);

  if (!member) return null;

  const received = current.status === "Successful";
  const wallet = current.payoutDestination === "Wallet";
  const accountLabel = wallet
    ? "Iconic Wealth Hub wallet"
    : member.payoutAccount
      ? `${member.payoutAccount.bankName} •••• ${member.payoutAccount.accountNumber.slice(-4)}`
      : "Bank account";

  const text = wallet
    ? `${formatNaira(current.amountKobo)} has been added to your wallet. You can spend it or withdraw it to your bank.`
    : received
      ? `${formatNaira(current.amountKobo)} has arrived in your bank account.`
      : `${formatNaira(current.amountKobo)} is being sent to your bank. We’ll notify you when it arrives.`;

  const timeline: [string, string, React.ReactNode, string][] = [
    [
      "Withdrawal requested",
      fmtDateTime(current.createdAt),
      <Check size={15} strokeWidth={2.4} />,
      "bg-ok-tint text-ok",
    ],
    [
      "Approved by Iconic Wealth Hub",
      "Payout batch approved",
      <Check size={15} strokeWidth={2.4} />,
      "bg-ok-tint text-ok",
    ],
    [
      wallet ? "Sent to your wallet" : "Sent to your bank",
      received ? "Completed" : "Processing now",
      received ? (
        <Check size={15} strokeWidth={2.4} />
      ) : (
        <Clock size={15} strokeWidth={2.4} />
      ),
      received ? "bg-ok-tint text-ok" : "bg-pending-tint text-pending",
    ],
    [
      wallet ? "Available in your wallet" : "Arrives in your account",
      received ? "Received" : "Usually within a few hours",
      received ? (
        <Check size={15} strokeWidth={2.4} />
      ) : (
        <Landmark size={15} strokeWidth={2.4} />
      ),
      received ? "bg-ok-tint text-ok" : "bg-soft text-mute",
    ],
  ];

  const markReceived = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await repos.member.markPayoutReceived(
        member.id,
        current.id,
      );
      setCurrent(updated);
      toast("Payout received in your account.");
      onUpdated?.();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const statement = () => {
    downloadFile(
      `payout-${current.reference}.html`,
      receiptHtml(current, `${member.firstName} ${member.lastName}`),
    );
    toast("Payout statement downloaded.");
  };

  return (
    <div className="mx-auto flex max-w-140 flex-col gap-4 pt-2">
      <span className="mx-auto flex size-21 items-center justify-center rounded-[28px] bg-ok-tint text-ok">
        <Check size={40} strokeWidth={2.2} />
      </span>
      <h1 className="text-center text-[26px] font-extrabold tracking-tight">
        {received ? "Payout received" : "Withdrawal on its way"}
      </h1>
      <p className="text-center leading-relaxed text-mute">{text}</p>
      <div className="flex justify-center">
        <Pill tone={TX_STATUS_TONE[current.status]}>{current.status}</Pill>
      </div>

      <Card className="flex flex-col">
        {timeline.map(([title, sub, icon, tile]) => (
          <div
            key={title}
            className="flex items-center gap-3 py-1.5 last:pb-0"
          >
            <span
              className={`flex size-7.5 shrink-0 items-center justify-center rounded-full ${tile}`}
            >
              {icon}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-sm">{title}</b>
              <span className="text-xs font-semibold text-mute">{sub}</span>
            </span>
          </div>
        ))}
      </Card>

      <Card className="flex flex-col">
        <KeyValue label="Amount" value={formatNaira(current.amountKobo)} />
        <KeyValue label="Paid to" value={accountLabel} />
        <KeyValue
          label="Reference"
          value={<span className="font-mono text-sm">{current.reference}</span>}
        />
      </Card>

      {!received && (
        <Button
          variant="outline"
          full
          disabled={busy}
          onClick={() => void markReceived()}
        >
          Demo: mark as received
        </Button>
      )}
      <ButtonLink to={paths.member.home} full>
        Done
      </ButtonLink>
      <Button
        variant="outline"
        full
        icon={<Download size={18} />}
        onClick={statement}
      >
        Download payout statement
      </Button>
    </div>
  );
}
