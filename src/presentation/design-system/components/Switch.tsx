import type { InputHTMLAttributes } from "react";
import { cn } from "../cn";

/** Pill toggle matching the prototype's `.sw` control (42×24, 18px thumb). */
export function Switch({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("relative inline-block h-6 w-10.5 shrink-0", className)}>
      <input
        type="checkbox"
        role="switch"
        className="peer absolute size-0 opacity-0"
        {...rest}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 rounded-pill bg-[#D6D1DD] transition-colors duration-200",
          "before:absolute before:left-[3px] before:top-[3px] before:size-[18px] before:rounded-full before:bg-white before:transition-transform before:duration-200",
          "peer-checked:bg-brand peer-checked:before:translate-x-[18px]",
          "peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-[#B794F6] peer-focus-visible:outline-offset-2",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
        )}
      />
    </label>
  );
}
