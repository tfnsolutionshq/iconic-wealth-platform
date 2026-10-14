import type { ReactNode } from "react";
import { Check, Clock, Info, RefreshCw, X } from "lucide-react";
import { cn } from "../cn";

export type Tone =
  | "ok"
  | "pending"
  | "fail"
  | "info"
  | "mute"
  | "gold"
  | "brand";
const tones: Record<Tone, string> = {
  ok: "bg-ok-tint text-ok",
  pending: "bg-pending-tint text-pending",
  fail: "bg-fail-tint text-fail",
  info: "bg-info-tint text-info",
  mute: "bg-soft text-[#474252]",
  gold: "bg-gold-tint text-[#7a4a00]",
  brand: "bg-brand-tint text-brand-dark",
};
const defaultIcon: Partial<Record<Tone, ReactNode>> = {
  ok: <Check size={12} strokeWidth={2.6} />,
  pending: <Clock size={12} strokeWidth={2.6} />,
  fail: <X size={12} strokeWidth={2.6} />,
  info: <RefreshCw size={12} strokeWidth={2.6} />,
};

/** Status pill: always icon + word, never colour alone (NFR-11). */
export function Pill({
  tone,
  children,
  icon,
}: {
  tone: Tone;
  children: ReactNode;
  icon?: ReactNode | false;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 text-xs font-bold",
        tones[tone],
      )}
    >
      {icon === false ? null : (icon ?? defaultIcon[tone])}
      {children}
    </span>
  );
}

/** Marks behaviour that depends on an open client decision (PRD section 22). Remove when decided. */
export function OpenDecisionTag({
  code,
  children = "Pending client decision",
}: {
  code: string;
  children?: ReactNode;
}) {
  return (
    <span className="inline-flex w-max items-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-gold bg-[#fffbf2] px-2.5 py-1 text-xs font-bold text-pending">
      <Info size={13} />
      {children} · {code}
    </span>
  );
}

export function Banner({
  tone = "info",
  icon,
  children,
}: {
  tone?: "info" | "warn" | "fail" | "neutral";
  icon?: ReactNode;
  children: ReactNode;
}) {
  const t = {
    info: "bg-brand-tint text-[#3b1580]",
    warn: "bg-pending-tint text-[#5a3700]",
    fail: "bg-fail-tint text-[#7a1a12]",
    neutral: "bg-soft text-[#474252]",
  }[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm leading-relaxed",
        t,
      )}
    >
      {icon}
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-9 text-center text-mute">
      {icon}
      <b className="text-ink">{title}</b>
      {children}
    </div>
  );
}
