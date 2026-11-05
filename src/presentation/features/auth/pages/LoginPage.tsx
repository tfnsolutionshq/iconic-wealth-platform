import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { ValidationError } from "@/domain/errors";
import { mapLoginErrors, type LoginErrors } from "@/domain/rules";
import { useAuth } from "../../../contexts/AuthContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { Button, Logo, TextField } from "../../../design-system";
import { YearCard } from "../../website/components/HomePageComponents/YearCard";
import { DEMO_ACCOUNTS } from "@/data/mock/seed";
import { env } from "@/app/config/env";
import { paths } from "../../../routes/paths";

export function LoginPage() {
  const { login } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const navigate = useNavigate();
  // Demo identities only make sense while sign-in is served by the mock repository.
  const demoCredentials = env.demoMode && !env.registrationApiBaseUrl;
  const [identifier, setIdentifier] = useState(
    demoCredentials ? DEMO_ACCOUNTS[0].identifier : "",
  );
  const [password, setPassword] = useState(
    demoCredentials ? "demo-password" : "",
  );
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const errorMessage = [errors.login, errors.password, errors.form]
    .filter(Boolean)
    .join(" ");
  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const s = await login(identifier, password);
      navigate(
        s.kind === "admin"
          ? paths.admin.home
          : s.kind === "pending"
            ? paths.pending
            : paths.member.home,
      );
    } catch (e) {
      if (e instanceof ValidationError) {
        const mapped = mapLoginErrors(e.fields);
        setErrors(Object.keys(mapped).length ? mapped : { form: e.message });
      } else {
        setErrors({
          form:
            e instanceof Error
              ? e.message
              : "We couldn’t log you in. Please try again.",
        });
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col px-5 py-10 lg:px-16">
        <Logo />
        <form
          className="m-auto flex w-full max-w-110 flex-col gap-5 py-10"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h1 className="font-display text-4xl sm:text-5xl">Welcome back</h1>
          <p className="text-mute">Log in to your member or admin account.</p>
          <TextField
            label="Email or phone number"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setErrors((current) => ({
                ...current,
                login: undefined,
                form: undefined,
              }));
            }}
            autoComplete="username"
            aria-invalid={!!errorMessage}
            aria-describedby={errorMessage ? "login-error" : undefined}
          />
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((current) => ({
                ...current,
                password: undefined,
                form: undefined,
              }));
            }}
            autoComplete="current-password"
            aria-invalid={!!errorMessage}
            aria-describedby={errorMessage ? "login-error" : undefined}
            trailing={
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
                className="flex size-9 items-center justify-center rounded-full text-mute transition hover:bg-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            }
          />
          {errorMessage && (
            <p
              id="login-error"
              role="alert"
              className="flex items-start gap-1.5 text-[13px] font-bold text-fail"
            >
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              {errorMessage}
            </p>
          )}
          <button
            type="button"
            className="self-end text-sm font-bold text-brand"
            onClick={async () => {
              await repos.auth.requestPasswordReset(identifier);
              toast("Password reset link sent to your email.");
            }}
          >
            Forgot password?
          </button>
          <Button full type="submit" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </Button>
          <p className="text-center text-[13px] font-semibold text-mute">
            New here?{" "}
            <Link className="font-bold text-brand" to={paths.register}>
              Become a member
            </Link>
          </p>
        </form>
      </div>
      <div className="hidden w-155 flex-col justify-center bg-brand-tint p-14 lg:flex">
        <YearCard />
      </div>
    </div>
  );
}
