import { useEffect, useRef, useState } from "react";
import { Check, Info } from "lucide-react";
import { Button, Checkbox, Modal, TextField } from "../../../design-system";
import { PASSWORD_RULES, isStrongPassword } from "@/domain/rules";
import { POLICIES, type PolicyKey } from "./policies";

export function PolicyModal({
  policy,
  onClose,
}: {
  policy: PolicyKey | null;
  onClose: () => void;
}) {
  const p = policy ? POLICIES[policy] : null;
  return (
    <Modal
      open={!!p}
      wide
      title={p?.title ?? ""}
      onClose={onClose}
      footer={
        <Button size="md" onClick={onClose}>
          Close
        </Button>
      }
    >
      {p && (
        <>
          <p className="text-mute">{p.lead}</p>
          {p.items.map(([h, t], i) => (
            <div
              key={h}
              className="flex flex-col gap-1 border-t border-line py-2.5"
            >
              <b>
                {i + 1}. {h}
              </b>
              <span className="text-[14.5px] leading-relaxed text-mute">
                {t}
              </span>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

/** Six digit boxes with auto-advance (BR-16 / BR-17). */
export function OtpModal({
  open,
  destination,
  title,
  confirmLabel,
  initialSeconds = 60,
  requireEmail = false,
  onCancel,
  onConfirm,
  onResend,
  customError,
}: {
  open: boolean;
  destination: string;
  title: string;
  confirmLabel: string;
  /** Seconds before the resend button becomes available. Defaults to 60. */
  initialSeconds?: number;
  /**
   * When true, shows an email input inside the modal and passes the entered
   * email to onConfirm instead of `destination`. Use this when the modal is
   * opened without having called the API first (e.g. "already have a code").
   */
  requireEmail?: boolean;
  onCancel: () => void;
  onConfirm: (code: string, email: string) => Promise<boolean>;
  /** Called when the user clicks "Resend code". */
  onResend?: () => Promise<void>;
  /** Optional error to display beneath the OTP input (e.g. expired code). */
  customError?: string | null;
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [emailInput, setEmailInput] = useState("");
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [resending, setResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state and start countdown whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setDigits(["", "", "", "", "", ""]);
    setEmailInput("");
    setError("");
    setSecondsLeft(initialSeconds);

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, initialSeconds, requireEmail]);

  const code = digits.join("");
  // The email used for verification: either the user-entered value (requireEmail)
  // or the destination passed in as a prop (normal flow).
  const effectiveEmail = requireEmail ? emailInput.trim() : destination;

  const setAt = (i: number, v: string) => {
    const d = [...digits];
    d[i] = v.replace(/\D/g, "").slice(-1);
    setDigits(d);
    setError("");
    if (d[i] && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };

  const handleResend = async () => {
    if (!onResend) return;
    setResending(true);
    try {
      await onResend();
      // Restart the countdown.
      if (timerRef.current) clearInterval(timerRef.current);
      setSecondsLeft(initialSeconds);
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      setDigits(["", "", "", "", "", ""]);
      setError("");
    } finally {
      setResending(false);
    }
  };

  const canSubmit = code.length === 6 && (!requireEmail || emailInput.trim().length > 0);

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="md"
            disabled={!canSubmit}
            onClick={async () => {
              if (!(await onConfirm(code, effectiveEmail)))
                setError("That code isn't right. Try again.");
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {requireEmail ? (
        <TextField
          label="Email address"
          type="email"
          value={emailInput}
          onChange={(e) => { setEmailInput(e.target.value); setError(""); }}
          hint="Enter the email address the code was sent to."
        />
      ) : (
        <p className="text-mute">
          Enter the 6-digit code we sent to{" "}
          <b className="text-ink">{destination}</b>.
        </p>
      )}
      <div className="flex gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            id={`otp-${i}`}
            aria-label={`Digit ${i + 1}`}
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) =>
              e.key === "Backspace" &&
              !d &&
              i > 0 &&
              document.getElementById(`otp-${i - 1}`)?.focus()
            }
            className="h-15 min-w-0 flex-1 rounded-input border-[1.5px] border-line text-center text-2xl font-extrabold outline-none focus:border-2 focus:border-brand"
          />
        ))}
      </div>
      {error || customError ? (
        <p className="text-[13px] font-bold text-fail">{error || customError}</p>
      ) : secondsLeft > 0 ? (
        <p className="text-[13px] font-semibold text-mute">
          Didn't get it? Resend in {secondsLeft}s.
        </p>
      ) : onResend ? (
        <button
          type="button"
          disabled={resending}
          onClick={handleResend}
          className="text-[13px] font-bold text-brand hover:underline disabled:opacity-50"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      ) : (
        <p className="text-[13px] font-semibold text-mute">
          Didn't get it? Please try again.
        </p>
      )}
    </Modal>
  );
}

export function CreatePasswordModal({
  open,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  error?: string | null;
  onBack: () => void;
  onSubmit: (password: string) => void;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [show, setShow] = useState(false);
  const ok = isStrongPassword(a) && a === b;
  return (
    <Modal
      open={open}
      title="Create your password"
      onClose={onBack}
      footer={
        <>
          <Button variant="outline" size="md" onClick={onBack}>
            Back
          </Button>
          <Button size="md" disabled={!ok || busy} onClick={() => onSubmit(a)}>
            Create password and submit
          </Button>
        </>
      }
    >
      <p className="text-mute">
        Last step. You'll use this password with your email or phone number to
        log in.
      </p>
      <TextField
        label="Password"
        type={show ? "text" : "password"}
        value={a}
        onChange={(e) => setA(e.target.value)}
      />
      <ul className="flex flex-col gap-1">
        {PASSWORD_RULES.map((r) => (
          <li
            key={r.label}
            className={`flex items-center gap-1.5 text-[13px] font-semibold ${r.test(a) ? "text-ok" : "text-mute"}`}
          >
            {r.test(a) ? <Check size={14} /> : <Info size={14} />}
            {r.label}
          </li>
        ))}
      </ul>
      <TextField
        label="Confirm password"
        type={show ? "text" : "password"}
        value={b}
        onChange={(e) => setB(e.target.value)}
        error={b && b !== a ? "Passwords don't match." : undefined}
      />
      {error && (
        <p role="alert" className="text-[13px] font-bold text-fail">
          {error}
        </p>
      )}
      <Checkbox checked={show} onChange={setShow}>
        Show password
      </Checkbox>
    </Modal>
  );
}
