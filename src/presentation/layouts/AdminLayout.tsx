import { useState, type ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet } from "react-router-dom";
import {
  Banknote,
  Bell,
  Check,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  FileText,
  History,
  House,
  Link2,
  List,
  LogOut,
  Percent,
  PiggyBank,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Logo, cn } from "../design-system";
import { paths } from "../routes/paths";
import { env } from "@/app/config/env";

const GROUPS = [
  [
    "Operate",
    [
      [House, "Dashboard", paths.admin.home],
      [Users, "Members", paths.admin.members],
      [Check, "Registrations", paths.admin.registrations],
      [PiggyBank, "Savings", paths.admin.savings],
      [List, "Transactions", paths.admin.transactions],
    ],
  ],
  [
    "Annual cycle",
    [
      [Percent, "Interest", paths.admin.interest],
      [Banknote, "Payouts", paths.admin.payouts],
    ],
  ],
  [
    "Insight",
    [
      [ChartColumn, "Reports", paths.admin.reports],
      [Link2, "Referrals", paths.admin.referrals],
      [History, "Audit log", paths.admin.audit],
    ],
  ],
  [
    "Platform",
    [
      [Settings, "Settings", paths.admin.settings],
      [FileText, "Content", paths.admin.content],
    ],
  ],
] as const;

export function AdminLayout() {
  const { session, logout } = useAuth();
  if (session?.kind !== "admin") return <Navigate to={paths.login} replace />;
  const a = session.admin;
  return (
    <div className="flex min-h-screen items-start bg-[#fbfafd]">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col gap-0.5 overflow-y-auto bg-night px-3.5 py-5 text-white">
        <div className="mb-3 ml-2.5">
          <Logo white to={paths.admin.home} className="h-12.5 w-auto" />
        </div>
        {GROUPS.map(([g, items]) => (
          <div key={g} className="flex flex-col gap-0.5">
            <span className="px-3 pt-3.5 pb-1.5 text-[11px] font-extrabold tracking-widest text-white/45 uppercase">
              {g}
            </span>
            {items.map(([Icon, label, to]) => (
              <NavLink
                key={to}
                to={to}
                end={to === paths.admin.home}
                className={({ isActive }) =>
                  cn(
                    "flex h-7 items-center gap-2.5 rounded-[10px] px-3 text-sm",
                    isActive
                      ? "bg-white/10 font-extrabold text-white"
                      : "font-semibold text-white/75 hover:text-white",
                  )
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="mt-auto flex items-center gap-2.5 rounded-input bg-white/5 p-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-[#f1dfb9] text-xs font-extrabold text-[#6e4a0c]">
            {a.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </span>
          <span className="flex flex-col">
            <b className="text-[13px]">{a.name}</b>
            <span className="text-xs font-semibold text-white/65">
              {a.role === "SuperAdmin" ? "Super Admin" : "Administrator"}
            </span>
          </span>
        </div>
        <button
          onClick={logout}
          className="mt-1.5 flex h-9.5 items-center gap-2.5 rounded-[10px] px-3 text-sm font-semibold text-white/75 hover:text-white"
        >
          <LogOut size={18} />
          Log out
        </button>
      </aside>
      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}

/** Page header for every admin page: title, subtitle, optional back link and actions, notifications and (demo) role switcher. */
export function AdminPageHeader({
  title,
  sub,
  back,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  back?: string;
  actions?: ReactNode;
}) {
  const { session, switchAdminRole } = useAuth();
  const [menu, setMenu] = useState(false);
  const admin = session?.kind === "admin" ? session.admin : null;
  return (
    <div className="relative z-30 flex h-20 shrink-0 items-center gap-4 border-b border-line bg-white px-8">
      {back && (
        <Link
          to={back}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line"
        >
          <ChevronLeft size={20} />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {sub && (
          <div className="text-[13px] font-semibold text-mute">{sub}</div>
        )}
      </div>
      {actions}
      <button
        aria-label="Notifications"
        className="relative flex size-11 items-center justify-center rounded-full border-[1.5px] border-line"
      >
        <Bell size={20} />
        <span className="absolute top-2 right-2.5 size-2.5 rounded-full border-2 border-white bg-gold" />
      </button>
      {admin && (
        <div className="relative">
          <button
            onClick={() => env.demoMode && setMenu(!menu)}
            className="flex items-center gap-2 rounded-pill border-[1.5px] border-line bg-white py-1 pr-2.5 pl-1"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-[#f1dfb9] text-xs font-extrabold text-[#6e4a0c]">
              {admin.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
            <span className="flex flex-col text-left">
              <b className="text-[13px]">{admin.name}</b>
              <span className="text-[11px] font-semibold text-mute">
                {admin.role === "SuperAdmin" ? "Super Admin" : "Administrator"}
              </span>
            </span>
            {env.demoMode && <ChevronDown size={16} />}
          </button>
          {menu && (
            <div className="absolute top-12 right-0 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
              <div className="px-3.5 pt-3 pb-1.5 text-xs font-semibold text-mute">
                Switch role (demo of maker-checker)
              </div>
              {(["Administrator", "SuperAdmin"] as const).map((r) => (
                <button
                  key={r}
                  onClick={async () => {
                    await switchAdminRole(r);
                    setMenu(false);
                  }}
                  className="flex w-full items-center justify-between border-t border-line px-3.5 py-3 text-left text-sm font-bold hover:bg-soft"
                >
                  {r === "SuperAdmin"
                    ? "Super Admin · checker"
                    : "Administrator · maker"}
                  {admin.role === r && <Check size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
