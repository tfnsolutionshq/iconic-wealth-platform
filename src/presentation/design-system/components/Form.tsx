import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "../cn";

const control =
  "w-full h-[52px] rounded-input border-[1.5px] bg-white px-3.5 text-[15px] font-semibold text-ink outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand/15 read-only:bg-soft read-only:text-mute";

interface FieldShell {
  label?: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
}
function Shell({
  id,
  label,
  error,
  hint,
  optional,
  children,
}: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
        {optional && (
          <span className="font-semibold text-mute"> (optional)</span>
        )}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-err`}
          className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold text-fail"
        >
          <TriangleAlert size={16} />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] font-semibold leading-snug text-mute">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  optional,
  className,
  ...rest
}: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} optional={optional}>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={cn(
          control,
          error ? "border-fail" : "border-line",
          className,
        )}
        {...rest}
      />
    </Shell>
  );
}

export type Option = string | { value: string; label: string };
export function SelectField({
  label,
  error,
  hint,
  options,
  placeholder,
  ...rest
}: FieldShell &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options: readonly Option[];
    placeholder?: string;
  }) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        aria-invalid={!!error}
        className={cn(control, error ? "border-fail" : "border-line")}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          return (
            <option key={v} value={v}>
              {typeof o === "string" ? o : o.label}
            </option>
          );
        })}
      </select>
    </Shell>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold leading-snug">
      <input
        type="checkbox"
        className="mt-0.5 size-4.5 shrink-0 accent-brand"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
