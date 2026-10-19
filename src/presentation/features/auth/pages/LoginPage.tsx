import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useServices } from "../../../contexts/ServicesContext";
import { useToast } from "../../../contexts/ToastContext";
import { Button, Logo, TextField, cn } from "../../../design-system";
import { YearCard } from "../../website/components/HomePageComponents/YearCard";
import { DEMO_ACCOUNTS } from "@/data/mock/seed";
import { env } from "@/app/config/env";
import { paths } from "../../../routes/paths";

export function LoginPage() {
  const { login } = useAuth();
  const { repos } = useServices();
  const toast = useToast();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(
    env.demoMode ? DEMO_ACCOUNTS[0].identifier : "",
  );
  const [password, setPassword] = useState(env.demoMode ? "demo-password" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
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
      setError((e as Error).message);
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
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            error={error || undefined}
          />
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
          {env.demoMode && (
            <div className="flex flex-col gap-2 rounded-[18px] border-2 border-dashed border-gold bg-[#fffaf0] p-3.5">
              <b className="text-sm">Demo accounts</b>
              <div className="flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    type="button"
                    key={a.key}
                    onClick={() => setIdentifier(a.identifier)}
                    className={cn(
                      "h-9.5 rounded-pill border-[1.5px] px-4 text-sm font-bold",
                      identifier === a.identifier
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-white",
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <span className="text-xs font-semibold text-mute">
                Demo mode only (VITE_DEMO_MODE). Hidden in production.
              </span>
            </div>
          )}
        </form>
      </div>
      <div className="hidden w-155 flex-col justify-center bg-brand-tint p-14 lg:flex">
        <YearCard />
      </div>
    </div>
  );
}
