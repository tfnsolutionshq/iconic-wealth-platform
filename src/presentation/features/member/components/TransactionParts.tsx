import { Link } from "react-router-dom";
import { Banknote, Clock, Landmark, X } from "lucide-react";
import type { Transaction } from "@/domain/entities";
import { MONTHS, formatNaira } from "@/domain/rules";
import { Pill } from "../../../design-system";
import { paths } from "../../../routes/paths";

export const TX_STATUS_TONE = {
  Successful: "ok",
  Pending: "pending",
  Failed: "fail",
  Processing: "info",
} as const;

/** "August contribution" or "June – August contribution" or "2026 year-end payout". */
export function describeTx(t: Transaction): string {
  if (t.kind === "Payout") return `${t.year} year-end payout`;
  const ms = [...new Set(t.allocations.map((a) => a.month))].sort(
    (a, b) => a - b,
  );
  if (!ms.length) return "Contribution";
  return ms.length > 1
    ? `${MONTHS[ms[0]]} – ${MONTHS[ms[ms.length - 1]]} contribution`
    : `${MONTHS[ms[0]]} contribution`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function tileFor(t: Transaction): { cls: string; icon: React.ReactNode } {
  if (t.kind === "Payout")
    return {
      cls: "bg-brand-tint text-brand-dark",
      icon: <Banknote size={20} />,
    };
  if (t.status === "Failed")
    return { cls: "bg-fail-tint text-fail", icon: <X size={20} /> };
  if (t.status === "Pending" || t.status === "Processing")
    return { cls: "bg-pending-tint text-pending", icon: <Clock size={20} /> };
  return { cls: "bg-brand-tint text-brand-dark", icon: <Landmark size={20} /> };
}

/** One transaction row linking to its receipt. Shared by home, savings drill-downs, activity and payout. */
export function TxRow({ t }: { t: Transaction }) {
  const tile = tileFor(t);
  const months =
    t.kind === "Contribution"
      ? new Set(t.allocations.map((a) => a.month)).size
      : 0;
  return (
    <Link
      to={paths.member.receipt(t.id)}
      className="flex items-center gap-3 border-b border-line py-3 no-underline last:border-b-0 hover:bg-soft"
    >
      <span
        className={`flex size-10.5 shrink-0 items-center justify-center rounded-input ${tile.cls}`}
      >
        {tile.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-[15px] text-ink">{describeTx(t)}</b>
        <span className="text-[13px] font-semibold text-mute">
          {fmtDateTime(t.createdAt)}
          {months > 1 ? ` · split across ${months} months` : ""}
          {t.failureReason ? ` · ${t.failureReason}` : ""}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <b className="text-[15px] tabular-nums text-ink">
          {formatNaira(t.amountKobo)}
        </b>
        <Pill tone={TX_STATUS_TONE[t.status]}>{t.status}</Pill>
      </span>
    </Link>
  );
}

/** Total the member actually paid (savings + platform charge). */
export const totalPaid = (t: Transaction) =>
  t.amountKobo + t.platformChargeKobo;

export function downloadFile(
  filename: string,
  text: string,
  mime = "text/html;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Printable receipt, mirroring the reference build's receipt download. */
export function receiptHtml(t: Transaction, memberName: string): string {
  const rows: [string, string][] = [
    ["Member", `${memberName} (${t.memberId})`],
    ["Description", describeTx(t)],
    ["Amount", formatNaira(t.amountKobo)],
    ["Platform charge", formatNaira(t.platformChargeKobo)],
    ["Total paid", formatNaira(totalPaid(t))],
    ["Status", t.status],
    ["Date", fmtDateTime(t.createdAt)],
    ["Our reference", t.reference],
    ["Paystack reference", t.gatewayReference ?? "—"],
  ];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><meta charset="utf-8"><title>Receipt ${esc(t.reference)}</title><body style="font-family:Arial,sans-serif;max-width:520px;margin:40px auto;color:#16131D"><h2 style="color:#6C2BD9">Iconic Wealth Hub</h2><h3>${t.kind === "Payout" ? "Payout" : "Contribution"} receipt</h3><table style="width:100%;border-collapse:collapse">${rows.map((r) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd;color:#686273">${r[0]}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right"><b>${esc(r[1])}</b></td></tr>`).join("")}</table></body>`;
}
