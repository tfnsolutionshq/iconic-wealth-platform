import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Check, ChevronDown, TriangleAlert } from "lucide-react";
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

type ChangeHandler = (e: React.ChangeEvent<HTMLSelectElement>) => void;

function normalizeOptions(options: readonly Option[]): { value: string; label: string }[] {
  return options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

function emitChange(onChange: ChangeHandler | undefined, value: string) {
  onChange?.({ target: { value } } as unknown as React.ChangeEvent<HTMLSelectElement>);
}

const triggerBase =
  "flex w-full items-center justify-between gap-2 border-[1.5px] bg-white font-semibold text-ink outline-none transition disabled:cursor-not-allowed disabled:bg-soft disabled:text-mute";

const triggerSizes = {
  field: "h-[52px] rounded-input px-3.5 text-[15px]",
  filter: "h-10.5 min-h-[42px] rounded-xl px-3 text-sm",
} as const;

type TriggerSize = keyof typeof triggerSizes;

function CustomSelectUI({
  id,
  value,
  options,
  placeholder,
  disabled,
  invalid,
  size,
  ariaLabel,
  labelledBy,
  className,
  onChange,
  name,
}: {
  id?: string;
  value?: string;
  options: readonly Option[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  size: TriggerSize;
  ariaLabel?: string;
  labelledBy?: string;
  className?: string;
  onChange?: ChangeHandler;
  name?: string;
}) {
  const items = normalizeOptions(options);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(() =>
    Math.max(0, items.findIndex((o) => o.value === (value ?? ""))),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = items.find((o) => o.value === (value ?? ""));

  useEffect(() => {
    if (!open) return;
    setHighlight(Math.max(0, items.findIndex((o) => o.value === (value ?? ""))));
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && highlight >= 0) {
      listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }, [highlight, open]);

  const pick = (v: string) => {
    if (v !== (value ?? "")) emitChange(onChange, v);
    setOpen(false);
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else if (e.key === "Enter" || e.key === " ") {
        const item = items[highlight];
        if (item) pick(item.value);
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[highlight];
      if (item) pick(item.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelledBy}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        className={cn(
          triggerBase,
          triggerSizes[size],
          invalid
            ? "border-fail focus:border-fail focus:ring-[3px] focus:ring-fail/15"
            : open
              ? "border-brand ring-[3px] ring-brand/15"
              : "border-line hover:border-brand/60 focus:border-brand focus:ring-[3px] focus:ring-brand/15",
          !selected && "font-semibold text-mute",
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {selected ? selected.label : (placeholder ?? "Select…")}
        </span>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full transition",
            open ? "bg-brand text-white" : "bg-soft text-brand-dark",
          )}
        >
          <ChevronDown size={16} strokeWidth={2.5} className={cn("transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && !disabled && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel ?? placeholder ?? "Options"}
          tabIndex={-1}
          onKeyDown={onListKey}
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-64 overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-lift"
        >
          {placeholder && (
            <li role="option" aria-selected={(value ?? "") === ""} data-index={-1}>
              <button
                type="button"
                onClick={() => pick("")}
                onMouseEnter={() => setHighlight(-1)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition",
                  (value ?? "") === "" ? "bg-brand-tint font-bold text-brand-dark" : "font-semibold text-mute hover:bg-soft hover:text-ink",
                  highlight === -1 && "bg-soft",
                )}
              >
                <span className="truncate">{placeholder === "Any" ? "Any" : placeholder}</span>
                {(value ?? "") === "" && <Check size={16} className="shrink-0 text-brand" />}
              </button>
            </li>
          )}
          {items.map((o, i) => {
            const active = o.value === (value ?? "");
            return (
              <li key={o.value || o.label} role="option" aria-selected={active} data-index={i}>
                <button
                  type="button"
                  onClick={() => pick(o.value)}
                  onMouseEnter={() => setHighlight(i)}
                  onFocus={() => setHighlight(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    active
                      ? "bg-brand-tint font-bold text-brand-dark"
                      : "font-semibold text-ink hover:bg-soft",
                    highlight === i && !active && "bg-soft",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {active && <Check size={16} className="shrink-0 text-brand" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SelectField({
  label,
  error,
  hint,
  optional,
  options,
  placeholder,
  value,
  onChange,
  disabled,
  className,
  id: idProp,
  name,
  ...rest
}: FieldShell & {
  options: readonly Option[];
  placeholder?: string;
  value?: string;
  onChange?: ChangeHandler;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  [k: string]: unknown;
}) {
  const autoId = useId();
  const id = (idProp as string | undefined) ?? autoId;
  const labelId = label ? `${id}-label` : undefined;
  const ariaLabel = (rest["aria-label"] as string | undefined) ?? label;
  return (
    <Shell id={id} label={label} error={error} hint={hint} optional={optional}>
      {label && <span id={labelId} className="sr-only">{label}</span>}
      <CustomSelectUI
        id={id}
        name={name}
        value={value as string | undefined}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        invalid={!!error}
        size="field"
        ariaLabel={ariaLabel}
        labelledBy={labelId}
        className={className}
        onChange={onChange}
      />
    </Shell>
  );
}

/** Label-less custom dropdown for filter bars and compact placements. Same brand styling as SelectField. */
export function Select({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  id,
  name,
  size = "filter",
  ...rest
}: {
  options: readonly Option[];
  value?: string;
  onChange?: ChangeHandler;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  size?: TriggerSize;
  [k: string]: unknown;
}) {
  const ariaLabel = rest["aria-label"] as string | undefined;
  return (
    <CustomSelectUI
      id={id}
      name={name}
      value={value as string | undefined}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      size={size}
      ariaLabel={ariaLabel}
      className={className}
      onChange={onChange}
    />
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
