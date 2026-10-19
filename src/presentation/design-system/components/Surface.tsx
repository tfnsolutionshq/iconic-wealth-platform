import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export function Card({
  tone = "white",
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "white" | "soft" | "night" | "tint";
}) {
  const t = {
    white: "bg-white border border-line",
    soft: "bg-soft",
    night: "bg-night text-white",
    tint: "bg-brand-tint",
  }[tone];
  return <div className={cn("rounded-card p-4.5", t, className)} {...rest} />;
}

export function Kpi({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const c =
    tone === "good"
      ? "text-ok"
      : tone === "warn"
        ? "text-pending"
        : tone === "bad"
          ? "text-fail"
          : "";
  return (
    <div className="flex flex-col gap-1.5 rounded-[18px] border border-line bg-white px-4.5 py-4">
      <span className="text-[13px] font-bold text-mute">{label}</span>
      <span
        className={cn(
          "text-[26px] font-extrabold tracking-tight tabular-nums",
          c,
        )}
      >
        {value}
      </span>
      {note && <span className="text-xs font-semibold text-mute">{note}</span>}
    </div>
  );
}

export function KeyValue({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-2.5 text-[15px] sm:flex-row sm:justify-between sm:gap-3">
      <span className="shrink-0 font-semibold text-mute">{label}</span>
      <span className="min-w-0 font-extrabold wrap-break-word sm:text-right">
        {value}
      </span>
    </div>
  );
}
