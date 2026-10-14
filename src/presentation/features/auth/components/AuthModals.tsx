import { useState } from "react";
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
  onCancel,
  onConfirm,
}: {
  open: boolean;
  destination: string;
  title: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (code: string) => Promise<boolean>;
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const code = digits.join("");
  const setAt = (i: number, v: string) => {
    const d = [...digits];
    d[i] = v.replace(/\D/g, "").slice(-1);
    setDigits(d);
    setError("");
    if (d[i] && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };
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
            disabled={code.length !== 6}
            onClick={async () => {
              if (!(await onConfirm(code)))
                setError("That code isn’t right. Try again.");
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-mute">
        Enter the 6-digit code we sent to{" "}
        <b className="text-ink">{destination}</b>.
      </p>
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
      {error ? (
        <p className="text-[13px] font-bold text-fail">{error}</p>
      ) : (
        <p className="text-[13px] font-semibold text-mute">
          Didn’t get it? Resend in 60 seconds.
        </p>
      )}
    </Modal>
  );
}

export function CreatePasswordModal({
  open,
  busy,
  onBack,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
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
        Last step. You’ll use this password with your email or phone number to
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
        error={b && b !== a ? "Passwords don’t match." : undefined}
      />
      <Checkbox checked={show} onChange={setShow}>
        Show password
      </Checkbox>
    </Modal>
  );
}
