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
        <b className="text-[15px] break-words text-ink">{describeTx(t)}</b>
        <span className="text-[13px] font-semibold break-words text-mute">
          {fmtDateTime(t.createdAt)}
          {months > 1 ? ` · split across ${months} months` : ""}
          {t.failureReason ? ` · ${t.failureReason}` : ""}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
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
    ...(t.payoutDestination
      ? ([["Paid to", t.payoutDestination === "Wallet" ? "Iconic Wealth Hub wallet" : "Bank account"]] as [string, string][])
      : []),
    ["Amount", formatNaira(t.amountKobo)],
    ["Platform charge", formatNaira(t.platformChargeKobo)],
    ["Total paid", formatNaira(totalPaid(t))],
    ["Paid with", t.paymentMethod ?? "—"],
    ["Status", t.status],
    ["Date", fmtDateTime(t.createdAt)],
    ["Our reference", t.reference],
    ["Gateway reference", t.gatewayReference ?? "—"],
  ];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><meta charset="utf-8"><title>Receipt ${esc(t.reference)}</title><body style="font-family:Arial,sans-serif;max-width:520px;margin:40px auto;color:#16131D"><h2 style="color:#6C2BD9">Iconic Wealth Hub</h2><h3>${t.kind === "Payout" ? "Payout" : "Contribution"} receipt</h3><table style="width:100%;border-collapse:collapse">${rows.map((r) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd;color:#686273">${r[0]}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right"><b>${esc(r[1])}</b></td></tr>`).join("")}</table></body>`;
}

/** Generates and downloads a single-page PDF receipt (`receipt-<reference>.pdf`). */
export function downloadReceiptPdf(t: Transaction, memberName: string) {
  const rows: [string, string][] = [
    ["Member", t.memberId ? `${memberName} (${t.memberId})` : memberName],
    ["Description", describeTx(t)],
    ...(t.payoutDestination
      ? ([["Paid to", t.payoutDestination === "Wallet" ? "Iconic Wealth Hub wallet" : "Bank account"]] as [string, string][])
      : []),
    ["Amount saved", formatNaira(t.amountKobo)],
    ["Platform charge", formatNaira(t.platformChargeKobo)],
    ["Total paid", formatNaira(totalPaid(t))],
    ["Paid with", t.paymentMethod ?? "Online"],
    ["Status", t.status],
    ["Date", `${fmtDateTime(t.createdAt)} ${new Date(t.createdAt).getFullYear()}`],
    ["Reference", t.reference],
    ...(t.gatewayReference ? ([["Gateway reference", t.gatewayReference]] as [string, string][]) : []),
  ];

  const scale = 2;
  const width = 595;
  const rowHeight = 38;
  const height = Math.max(540, 220 + rows.length * rowHeight + 80);

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  // Page background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // Top brand accent bar
  ctx.fillStyle = "#6C2BD9";
  ctx.fillRect(0, 0, width, 8);

  const padX = 48;
  let y = 56;

  // Header
  ctx.fillStyle = "#6C2BD9";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("ICONIC WEALTH HUB", padX, y);

  y += 28;
  ctx.fillStyle = "#16131D";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText(
    `${t.kind === "Payout" ? "Payout" : "Contribution"} Receipt`,
    padX,
    y,
  );

  // Amount highlight box
  y += 24;
  ctx.fillStyle = "#F7F2FE";
  ctx.beginPath();
  ctx.roundRect(padX, y, width - padX * 2, 74, 12);
  ctx.fill();

  ctx.fillStyle = "#686273";
  ctx.font = "600 12px Arial, sans-serif";
  ctx.fillText("TOTAL PAID", padX + 20, y + 26);

  ctx.fillStyle = "#16131D";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText(formatNaira(totalPaid(t)), padX + 20, y + 56);

  // Status badge on right of highlight box
  ctx.fillStyle = t.status === "Successful" ? "#0E7A4B" : "#B45309";
  ctx.font = "bold 13px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(t.status.toUpperCase(), width - padX - 20, y + 45);

  y += 96;

  // Rows
  for (const [label, value] of rows) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#686273";
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText(label, padX, y + 22);

    ctx.textAlign = "right";
    ctx.fillStyle = "#16131D";
    ctx.font = "bold 14px Arial, sans-serif";
    ctx.fillText(value, width - padX, y + 22);

    ctx.strokeStyle = "#ECE8F4";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y + rowHeight);
    ctx.lineTo(width - padX, y + rowHeight);
    ctx.stroke();

    y += rowHeight;
  }

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "#948DA0";
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText(
    "Generated by Iconic Wealth Hub · Keep this receipt for your records.",
    width / 2,
    height - 30,
  );

  // Encode JPEG into valid PDF 1.4 container
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const base64 = dataUrl.split(",")[1] ?? "";
  const binStr = atob(base64);
  const jpegBytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    jpegBytes[i] = binStr.charCodeAt(i);
  }

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;

  const pushStr = (s: string) => {
    const b = enc.encode(s);
    chunks.push(b);
    byteLength += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    byteLength += b.length;
  };
  const startObj = (id: number) => {
    offsets[id] = byteLength;
    pushStr(`${id} 0 obj\n`);
  };
  const endObj = () => pushStr("\nendobj\n");

  pushStr("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

  startObj(1);
  pushStr("<< /Type /Catalog /Pages 2 0 R >>");
  endObj();

  startObj(2);
  pushStr("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  endObj();

  startObj(3);
  pushStr(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  endObj();

  startObj(4);
  pushStr(
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  pushBytes(jpegBytes);
  pushStr("\nendstream");
  endObj();

  const contentStream = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
  startObj(5);
  pushStr(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
  endObj();

  const xrefOffset = byteLength;
  pushStr("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) {
    pushStr(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  const pdfBytes = new Uint8Array(byteLength);
  let pos = 0;
  for (const c of chunks) {
    pdfBytes.set(c, pos);
    pos += c.length;
  }

  const url = URL.createObjectURL(
    new Blob([pdfBytes], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt-${t.reference}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
