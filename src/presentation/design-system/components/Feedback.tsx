import type { ReactNode } from "react";
import { Check, Clock, Info, RefreshCw, X } from "lucide-react";
import iconMain from "@/assets/brand/icon-main.png";
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

/** Branded loading indicator with the Iconic Wealth Hub logo and a violet-gold spinner ring. */
export function LoadingSpinner({
  label,
  size = "md",
  className,
}: {
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const outer = size === "sm" ? "size-14" : "size-20";
  const inner = size === "sm" ? "size-10" : "size-14";
  const img = size === "sm" ? "size-8" : "size-11";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label || "Loading"}
    >
      <div className={cn("relative flex items-center justify-center", outer)}>
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-[3px] border-brand-tint"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-brand border-r-gold"
        />
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-white shadow-xs",
            inner,
          )}
        >
          <img
            src={iconMain}
            alt="Iconic Wealth Hub"
            className={cn("object-contain", img)}
          />
        </span>
      </div>
      {label && (
        <span className="text-sm font-semibold text-mute">{label}</span>
      )}
    </div>
  );
}

/** Full-area centered branded loading screen for pages and route suspense fallbacks. */
export function LoadingScreen({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[45vh] w-full items-center justify-center py-12",
        className,
      )}
    >
      <LoadingSpinner label={label} />
    </div>
  );
}
