import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, TriangleAlert } from "lucide-react";
import { UnauthorizedError, ValidationError } from "@/domain/errors";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  Banner,
  Button,
  Checkbox,
  Logo,
  SelectField,
  TextField,
  cn,
} from "../../../design-system";
import {
  HEARD_OPTIONS,
  NG_STATES,
  REFERRAL_OPTION,
  isPhone,
  mapRegistrationErrors,
  validateDetails,
  type FieldErrors,
  type RegistrationDetails,
} from "@/domain/rules";
import {
  CreatePasswordModal,
  OtpModal,
  PolicyModal,
} from "../components/AuthModals";
import type { PolicyKey } from "../components/policies";
import { paths } from "../../../routes/paths";

const EMPTY: RegistrationDetails = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  email: "",
  phone: "",
  stateOfResidence: "",
  address: "",
  heardAboutUs: "",
  referredBy: "",
};
const STEPS = ["Your details", "Verify your email", "Next of kin and password"];

/** WEB-09 to WEB-12: details → email code → next of kin + agreement → create password (modal) → submit. */
export function RegisterPage() {
  const { repos, clock } = useServices();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [d, setD] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<RegistrationDetails>>({});
  const [kin, setKin] = useState({
    name: "",
    relationship: "Spouse",
    phone: "",
  });
  const [kinErr, setKinErr] = useState<{
    name?: string;
    phone?: string;
    agree?: string;
  }>({});
  const [agree, setAgree] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpRequireEmail, setOtpRequireEmail] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpErrorCodes, setOtpErrorCodes] = useState<string[]>([]);
  const [resendBlocked, setResendBlocked] = useState(false);
  const [resendBlockedSeconds, setResendBlockedSeconds] = useState(0);
  const [policy, setPolicy] = useState<PolicyKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);
  const [verified, setVerified] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(60);
  const set = (k: keyof RegistrationDetails) => (v: string) => {
    setD({
      ...d,
      [k]: v,
      ...(k === "heardAboutUs" && v !== REFERRAL_OPTION
        ? { referredBy: "" }
        : {}),
    });
    setErrors({ ...errors, [k]: undefined });
    setFormError(null);
  };

  const continueStep1 = async () => {
    if (verified) {
      setStep(3);
      return;
    }
    if (started) {
      // The account already exists; re-submitting would create a duplicate registration.
      setStep(2);
      setOtpOpen(true);
      return;
    }

    const e = validateDetails(d, clock.now());
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;

    setStarting(true);
    try {
      const result = await repos.registration.start(d);
      if (!result.emailSent) {
        setFormError(
          result.message ||
            "We couldn’t send the verification code. Please try again.",
        );
        return;
      }
      setStarted(true);
      setStep(2);
      setOtpOpen(true);
      setOtpRequireEmail(false);
      setOtpError(null);
      setOtpErrorCodes([]);
      setResendBlocked(false);
      setResendBlockedSeconds(0);
      if (result.verification?.resendAvailableInSeconds) {
        setResendSeconds(result.verification.resendAvailableInSeconds);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        const fieldErrors = mapRegistrationErrors(error.fields);
        setErrors((current) => ({ ...current, ...fieldErrors }));
        // Field-level messages are shown inline; only show the banner for anything else.
        setFormError(Object.keys(fieldErrors).length ? null : error.message);
      } else {
        setFormError(
          error instanceof Error
            ? error.message
            : "We couldn’t start your registration. Please try again.",
        );
      }
    } finally {
      setStarting(false);
    }
  };
  const continueStep3 = () => {
    const e: typeof kinErr = {};
    if (!kin.name.trim()) e.name = "Enter your next of kin’s name.";
    if (!isPhone(kin.phone)) e.phone = "Enter an 11-digit phone number.";
    if (!agree)
      e.agree = "Please accept the savings guidelines and privacy policy.";
    setKinErr(e);
    if (Object.keys(e).length) return;
    setPwError(null);
    setPwOpen(true);
  };
  const submit = async (password: string) => {
    setBusy(true);
    setPwError(null);
    try {
      const r = await repos.registration.submit({
        ...d,
        nextOfKin: kin,
        password,
      });
      navigate(paths.registerDone, { state: { registration: r } });
    } catch (error) {
      // The verification token has expired (or was never stored): send a fresh code and
      // take the member back through verification instead of leaving them stuck here.
      if (error instanceof UnauthorizedError) {
        setPwOpen(false);
        setVerified(false);
        setStep(2);
        setOtpOpen(true);
        try {
          const resent = await repos.registration.resendEmailCode(d.email);
          const notice = resent.emailSent
            ? "Your email verification expired. Enter the new code we’ve sent to continue."
            : resent.message ||
              "We couldn’t send a new code. Please try again.";
          setFormError(notice);
          toast(notice);
        } catch (resendError) {
          const notice =
            resendError instanceof Error
              ? resendError.message
              : "We couldn’t send a new code. Please try again.";
          setFormError(notice);
          toast(notice);
        }
        return;
      }
      const message =
        error instanceof ValidationError
          ? [error.message, ...Object.values(error.fields).flat()].join(" ")
          : error instanceof Error
            ? error.message
            : "We couldn’t finish your registration. Please try again.";
      // The modal stays open for the member to correct the password and retry.
      setPwError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex flex-col gap-6 bg-night px-5 py-6 text-white lg:w-125 lg:px-14 lg:py-12">
        <Logo white className="h-14.5 w-auto" />
        <h1 className="font-display text-3xl lg:mt-auto lg:text-5xl">
          Join our savings community
        </h1>
        <p className="hidden leading-relaxed text-white/75 lg:block">
          Membership is open to women. Your details are reviewed by an admin
          before your account opens.
        </p>
        <ol className="mb-auto hidden flex-col gap-3 lg:flex">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = n < step;
            const cur = n === step;
            return (
              <li key={s} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border-[1.5px] text-[13px] font-extrabold",
                    done
                      ? "border-[#9b6bf2] bg-[#9b6bf2]"
                      : cur
                        ? "border-white bg-white text-night"
                        : "border-white/45",
                  )}
                >
                  {done ? <Check size={14} /> : n}
                </span>
                <b className={cn(!done && !cur && "opacity-60")}>{s}</b>
              </li>
            );
          })}
        </ol>
      </aside>
      <div className="flex max-w-215 flex-1 flex-col gap-5 px-5 py-6 lg:px-24 lg:py-12">
        <div className="flex justify-between text-[13px] font-semibold text-mute">
          <span>Step {step} of 3</span>
          <span>
            Already a member?{" "}
            <Link to={paths.login} className="font-bold text-brand">
              Log in
            </Link>
          </span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <i
              key={n}
              className={cn(
                "h-1 flex-1 rounded-full",
                n <= step ? "bg-brand" : "bg-line",
              )}
            />
          ))}
        </div>
        {step !== 3 ? (
          <>
            {formError && (
              <Banner tone="fail" icon={<TriangleAlert size={18} />}>
                {formError}
              </Banner>
            )}
            <h2 className="text-[28px] font-extrabold">Your details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="First name"
                value={d.firstName}
                onChange={(e) => set("firstName")(e.target.value)}
                error={errors.firstName}
              />
              <TextField
                label="Last name"
                value={d.lastName}
                onChange={(e) => set("lastName")(e.target.value)}
                error={errors.lastName}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Date of birth"
                type="date"
                value={d.dateOfBirth}
                onChange={(e) => set("dateOfBirth")(e.target.value)}
                error={errors.dateOfBirth}
                hint="You must be 18 or older."
              />
              <SelectField
                label="Gender"
                options={["Female"]}
                value="Female"
                onChange={() => {}}
                hint="Membership is open to women only."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Email"
                type="email"
                value={d.email}
                onChange={(e) => set("email")(e.target.value)}
                error={errors.email}
                hint="We’ll send a code to verify it."
              />
              <TextField
                label="Phone number"
                inputMode="tel"
                placeholder="0803 000 0000"
                value={d.phone}
                onChange={(e) => set("phone")(e.target.value)}
                error={errors.phone}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="State of residence"
                options={NG_STATES}
                placeholder="Select your state"
                value={d.stateOfResidence}
                onChange={(e) => set("stateOfResidence")(e.target.value)}
                error={errors.stateOfResidence}
              />
              <TextField
                label="Residential address"
                placeholder="House number, street, area"
                value={d.address}
                onChange={(e) => set("address")(e.target.value)}
                error={errors.address}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="How did you hear about us?"
                options={HEARD_OPTIONS}
                placeholder="Select an option"
                value={d.heardAboutUs}
                onChange={(e) => set("heardAboutUs")(e.target.value)}
                error={errors.heardAboutUs}
              />
              {d.heardAboutUs === REFERRAL_OPTION && (
                <TextField
                  label="Who referred you?"
                  placeholder="Member ID or phone number"
                  value={d.referredBy}
                  onChange={(e) => set("referredBy")(e.target.value)}
                  error={errors.referredBy}
                  hint="We record the referral. There’s no reward in this phase."
                />
              )}
            </div>
            <Button
              className="self-start"
              onClick={continueStep1}
              disabled={starting}
            >
              {starting ? "Sending code…" : "Continue"}
            </Button>
            <button
              type="button"
              className="self-start text-sm font-semibold text-brand hover:underline"
              onClick={() => { setOtpRequireEmail(true); setOtpOpen(true); }}
            >
              Have you received a code already?
            </button>
          </>
        ) : (
          <>
            <Banner icon={<Check size={20} />}>
              <b>{d.email}</b> is verified.
            </Banner>
            <h2 className="text-[28px] font-extrabold">Next of kin</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Next of kin name"
                value={kin.name}
                onChange={(e) => setKin({ ...kin, name: e.target.value })}
                error={kinErr.name}
              />
              <SelectField
                label="Relationship"
                options={["Spouse", "Parent", "Sibling", "Child", "Other"]}
                value={kin.relationship}
                onChange={(e) =>
                  setKin({ ...kin, relationship: e.target.value })
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Next of kin phone"
                inputMode="tel"
                value={kin.phone}
                onChange={(e) => setKin({ ...kin, phone: e.target.value })}
                error={kinErr.phone}
              />
            </div>
            <Checkbox checked={agree} onChange={setAgree}>
              I agree to Iconic Wealth Hub’s{" "}
              <button
                type="button"
                className="font-bold text-brand underline"
                onClick={(e) => {
                  e.preventDefault();
                  setPolicy("guidelines");
                }}
              >
                savings guidelines
              </button>{" "}
              and{" "}
              <button
                type="button"
                className="font-bold text-brand underline"
                onClick={(e) => {
                  e.preventDefault();
                  setPolicy("privacy");
                }}
              >
                privacy policy
              </button>
              .
            </Checkbox>
            {kinErr.agree && (
              <p className="text-[13px] font-bold text-fail">{kinErr.agree}</p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={continueStep3}>
                Continue to create password
              </Button>
            </div>
          </>
        )}
      </div>
      <OtpModal
        open={otpOpen}
        destination={d.email}
        title="Verify your email"
        confirmLabel="Verify email"
        initialSeconds={resendSeconds}
        requireEmail={otpRequireEmail}
        onCancel={() => {
          setOtpOpen(false);
          setStep(1);
        }}
        onResend={async () => {
          const resent = await repos.registration.resendEmailCode(d.email);
          if (resent.verification?.resendAvailableInSeconds) {
            setResendSeconds(resent.verification.resendAvailableInSeconds);
          }
        }}
        onConfirm={async (code, email) => {
          try {
            const ok = await repos.registration.verifyEmailCode(email, code);
            if (ok) {
              setOtpOpen(false);
              setOtpRequireEmail(false);
              setVerified(true);
              setStep(3);
              toast("Email verified.");
            }
            return ok;
          } catch (error) {
            toast(
              error instanceof Error
                ? error.message
                : "We couldn’t verify that code. Please try again.",
            );
            return false;
          }
        }}
      />
      <CreatePasswordModal
        open={pwOpen}
        busy={busy}
        error={pwError}
        onBack={() => {
          setPwOpen(false);
          setPwError(null);
        }}
        onSubmit={submit}
      />
      <PolicyModal policy={policy} onClose={() => setPolicy(null)} />
    </div>
  );
}
