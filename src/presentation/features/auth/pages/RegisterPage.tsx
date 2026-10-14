import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  Banner,
  Button,
  Checkbox,
  Logo,
  OpenDecisionTag,
  SelectField,
  TextField,
  cn,
} from "../../../design-system";
import {
  HEARD_OPTIONS,
  NG_STATES,
  REFERRAL_OPTION,
  isPhone,
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
  const [step, setStep] = useState<1 | 3>(1);
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
  const [pwOpen, setPwOpen] = useState(false);
  const [policy, setPolicy] = useState<PolicyKey | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof RegistrationDetails) => (v: string) => {
    setD({
      ...d,
      [k]: v,
      ...(k === "heardAboutUs" && v !== REFERRAL_OPTION
        ? { referredBy: "" }
        : {}),
    });
    setErrors({ ...errors, [k]: undefined });
  };

  const continueStep1 = async () => {
    const e = validateDetails(d, clock.now());
    setErrors(e);
    if (Object.keys(e).length) return;
    await repos.registration.sendEmailCode(d.email);
    setOtpOpen(true);
  };
  const continueStep3 = () => {
    const e: typeof kinErr = {};
    if (!kin.name.trim()) e.name = "Enter your next of kin’s name.";
    if (!isPhone(kin.phone)) e.phone = "Enter an 11-digit phone number.";
    if (!agree)
      e.agree = "Please accept the savings guidelines and privacy policy.";
    setKinErr(e);
    if (!Object.keys(e).length) setPwOpen(true);
  };
  const submit = async (password: string) => {
    setBusy(true);
    try {
      const r = await repos.registration.submit({
        ...d,
        nextOfKin: kin,
        password,
      });
      navigate(paths.registerDone, { state: { registration: r } });
    } catch (e) {
      toast((e as Error).message);
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
            const done = n < step || (n === 2 && step === 3);
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
                n <= (step === 3 ? 3 : 1) ? "bg-brand" : "bg-line",
              )}
            />
          ))}
        </div>
        {step === 1 ? (
          <>
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
            <Button className="self-start" onClick={continueStep1}>
              Continue
            </Button>
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
        <OpenDecisionTag code="OD-01">
          Final registration fields pending
        </OpenDecisionTag>
      </div>
      <OtpModal
        open={otpOpen}
        destination={d.email}
        title="Verify your email"
        confirmLabel="Verify email"
        onCancel={() => setOtpOpen(false)}
        onConfirm={async (code) => {
          const ok = await repos.registration.verifyEmailCode(d.email, code);
          if (ok) {
            setOtpOpen(false);
            setStep(3);
            toast("Email verified.");
          }
          return ok;
        }}
      />
      <CreatePasswordModal
        open={pwOpen}
        busy={busy}
        onBack={() => setPwOpen(false)}
        onSubmit={submit}
      />
      <PolicyModal policy={policy} onClose={() => setPolicy(null)} />
    </div>
  );
}
