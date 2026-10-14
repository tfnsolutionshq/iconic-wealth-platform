import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Download, Shield, TriangleAlert } from "lucide-react";
import type { Transaction } from "@/domain/entities";
import { MONTHS, formatNaira } from "@/domain/rules";
import { useAuth } from "../../../contexts/AuthContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { Banner, Button, Card, KeyValue, Pill } from "../../../design-system";
import { paths } from "../../../routes/paths";
import {
  TX_STATUS_TONE,
  describeTx,
  downloadFile,
  fmtDateTime,
  receiptHtml,
  totalPaid,
} from "../components/TransactionParts";

/** MEM-13: receipt for one contribution or payout, with download. */
export function ReceiptPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const member = session?.kind === "member" ? session.member : null;
  const [tx, setTx] = useState<Transaction | null | undefined>(undefined);

  useEffect(() => {
    if (member && id)
      repos.member
        .listTransactions(member.id)
        .then((all) => setTx(all.find((t) => t.id === id) ?? null));
  }, [repos, member, id]);

  if (!member || tx === undefined) return <p className="text-mute">Loading…</p>;
  if (tx === null) {
    return (
      <div className="mx-auto flex max-w-140 flex-col gap-4">
        <div className="flex h-13 items-center gap-3">
          <Link
            to={paths.member.activity}
            aria-label="Back"
            className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line bg-white"
          >
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-[19px] font-extrabold">Receipt</h1>
        </div>
        <Card>
          <b>We couldn’t find that receipt.</b>
          <p className="text-sm text-mute">
            It may belong to a different account.
          </p>
        </Card>
      </div>
    );
  }

  const applied =
    tx.kind === "Payout"
      ? `Year ${tx.year}`
      : `${tx.allocations.map((a) => MONTHS[a.month]).join(", ")} ${tx.year}`;

  const download = () => {
    downloadFile(
      `receipt-${tx.reference}.html`,
      receiptHtml(tx, `${member.firstName} ${member.lastName}`),
    );
    toast("Receipt downloaded.");
  };

  return (
    <div className="mx-auto flex max-w-140 flex-col gap-4">
      <div className="flex h-13 items-center gap-3">
        <Link
          to={paths.member.activity}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line bg-white"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-[19px] font-extrabold">Receipt</h1>
      </div>

      <Card className="flex flex-col items-center gap-2 p-6">
        <span className="text-[13px] font-semibold text-mute">
          {describeTx(tx)}
        </span>
        <span className="text-[34px] font-extrabold tabular-nums">
          {formatNaira(tx.amountKobo)}
        </span>
        <span className="flex gap-2">
          <Pill tone={TX_STATUS_TONE[tx.status]}>{tx.status}</Pill>
          {tx.kind === "Contribution" && tx.status === "Successful" && (
            <Pill tone={tx.late ? "pending" : "ok"} icon={<Shield size={12} />}>
              {tx.late ? "Late" : "On time"}
            </Pill>
          )}
        </span>
      </Card>

      <Card>
        <KeyValue
          label="Member"
          value={`${member.firstName} ${member.lastName} · ${member.id}`}
        />
        <KeyValue label="Applied to" value={applied} />
        <KeyValue
          label="Platform charge"
          value={formatNaira(tx.platformChargeKobo)}
        />
        <KeyValue label="Total paid" value={formatNaira(totalPaid(tx))} />
        <KeyValue
          label="Date"
          value={`${fmtDateTime(tx.createdAt)} ${new Date(tx.createdAt).getFullYear()}`}
        />
        <KeyValue
          label="Our reference"
          value={<span className="font-mono text-sm">{tx.reference}</span>}
        />
        <KeyValue
          label="Paystack reference"
          value={
            <span className="font-mono text-sm">
              {tx.gatewayReference ?? "—"}
            </span>
          }
        />
        {tx.failureReason && (
          <Banner tone="fail" icon={<TriangleAlert size={20} />}>
            <b>Reason:</b> {tx.failureReason}
          </Banner>
        )}
      </Card>

      <Button
        variant="outline"
        full
        icon={<Download size={18} />}
        onClick={download}
      >
        Download receipt
      </Button>
    </div>
  );
}
