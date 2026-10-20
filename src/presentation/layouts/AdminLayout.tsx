import { useEffect, useRef, useState, type ReactNode } from "react";
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
  Menu,
  Percent,
  PiggyBank,
  Settings,
  Users,
  X,
} from "lucide-react";
import type { AdminRole } from "@/domain/entities";
import { useAuth } from "../contexts/AuthContext";
import { useServices } from "../contexts/ServicesContext";
import { useToast } from "../contexts/ToastContext";
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

type AdminNotice = {
  id: string;
  icon: ReactNode;
  title: string;
  body: string;
  to: string;
  tone: "brand" | "gold" | "fail";
};

const NOTICE_TILE: Record<AdminNotice["tone"], string> = {
  brand: "bg-brand-tint text-brand-dark",
  gold: "bg-gold-tint text-[#7a4a00]",
  fail: "bg-fail-tint text-fail",
};

export function AdminLayout() {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (session?.kind !== "admin") return <Navigate to={paths.login} replace />;
  const a = session.admin;
  return (
    <div className="flex min-h-screen items-start bg-[#fbfafd]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-0.5 overflow-y-auto bg-night px-3.5 py-5 text-white lg:flex">
        <div className="mb-3 ml-2.5">
          <Logo white to={paths.admin.home} className="h-12.5 w-auto" />
        </div>
        <AdminNav />
        <div className="mt-auto flex items-center gap-2.5 rounded-input bg-white/5 p-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f1dfb9] text-xs font-extrabold text-[#6e4a0c]">
            {a.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </span>
          <span className="flex min-w-0 flex-col">
            <b className="truncate text-[13px]">{a.name}</b>
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
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/55"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-0.5 overflow-y-auto bg-night px-3.5 py-5 text-white">
            <div className="mb-3 ml-2.5 flex items-center justify-between gap-2">
              <Logo white to={paths.admin.home} className="h-12.5 w-auto" />
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20"
              >
                <X size={18} />
              </button>
            </div>
            <AdminNav onNavigate={() => setOpen(false)} />
            <div className="mt-auto flex items-center gap-2.5 rounded-input bg-white/5 p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f1dfb9] text-xs font-extrabold text-[#6e4a0c]">
                {a.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
              <span className="flex min-w-0 flex-col">
                <b className="truncate text-[13px]">{a.name}</b>
                <span className="text-xs font-semibold text-white/65">
                  {a.role === "SuperAdmin" ? "Super Admin" : "Administrator"}
                </span>
              </span>
            </div>
            <button
              onClick={logout}
              className="mt-1.5 flex h-11 items-center gap-2.5 rounded-[10px] px-3 text-sm font-semibold text-white/75 hover:text-white"
            >
              <LogOut size={18} />
              Log out
            </button>
          </aside>
        </div>
      )}
      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-4 lg:hidden">
          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line"
          >
            <Menu size={20} />
          </button>
          <Logo to={paths.admin.home} className="h-9 w-auto" />
        </div>
        <Outlet />
      </main>
    </div>
  );
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
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
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-sm",
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
    </>
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
  const { repos } = useServices();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notices, setNotices] = useState<AdminNotice[] | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [people, setPeople] = useState<Partial<Record<AdminRole, string>>>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const admin = session?.kind === "admin" ? session.admin : null;
  /** The role switcher is a demo of maker-checker: available in demo mode and whenever the in-memory mock backend is in use. */
  const canSwitch = env.demoMode || !env.apiBaseUrl;
  const roleLabel = (r: AdminRole) => (r === "SuperAdmin" ? "Super Admin" : "Administrator");

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (!menu || people.Administrator) return;
    let live = true;
    Promise.all([repos.admin.currentAdmin("Administrator"), repos.admin.currentAdmin("SuperAdmin")])
      .then(([maker, checker]) => {
        if (live) setPeople({ Administrator: maker?.name, SuperAdmin: checker?.name });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [menu, people.Administrator, repos.admin]);

  useEffect(() => {
    if (!notifOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!notifRef.current?.contains(e.target as Node)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNotifOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen || notices) return;
    let live = true;
    Promise.all([
      repos.admin.listRegistrations(),
      repos.admin.listInterest(),
      repos.admin.listPayoutBatches(),
    ])
      .then(([registrations, years, batches]) => {
        if (!live) return;
        const items: AdminNotice[] = [];
        registrations
          .filter((r) => r.status === "New")
          .slice(0, 3)
          .forEach((r) =>
            items.push({
              id: `reg-${r.id}`,
              icon: <Users size={18} />,
              title: "New registration",
              body: `${r.firstName} ${r.lastName} is awaiting review.`,
              to: paths.admin.registrations,
              tone: "gold",
            }),
          );
        years
          .filter((y) => y.status === "Pending approval" || y.status === "Returned")
          .slice(0, 3)
          .forEach((y) =>
            items.push({
              id: `interest-${y.year}`,
              icon: <Percent size={18} />,
              title: y.status === "Returned" ? `Interest ${y.year} returned` : `Interest ${y.year} needs approval`,
              body: y.rate != null ? `${y.rate}% · ${y.eligible.toLocaleString()} eligible members` : "Awaiting review.",
              to: paths.admin.interestYear(y.year),
              tone: y.status === "Returned" ? "fail" : "brand",
            }),
          );
        batches
          .filter((b) => b.status === "Awaiting approval" || b.status === "Returned to maker" || b.status === "Partial")
          .slice(0, 3)
          .forEach((b) =>
            items.push({
              id: `payout-${b.id}`,
              icon: <Banknote size={18} />,
              title: b.status === "Partial" ? `Payout ${b.id} has failures` : `Payout ${b.id} needs attention`,
              body: `${b.month} ${b.year} · ${b.count.toLocaleString()} members`,
              to: paths.admin.payoutBatch(b.id),
              tone: b.status === "Partial" ? "fail" : b.status === "Returned to maker" ? "gold" : "brand",
            }),
          );
        setNotices(items.slice(0, 8));
      })
      .catch(() => {
        if (live) setNotices([]);
      });
    return () => {
      live = false;
    };
  }, [notifOpen, notices, repos.admin]);

  const switchTo = async (r: AdminRole) => {
    try {
      await switchAdminRole(r);
      setMenu(false);
      toast(`Now acting as ${people[r] ?? roleLabel(r)} (${roleLabel(r)}).`);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div className="relative z-30 flex min-h-20 shrink-0 flex-wrap items-center gap-x-4 gap-y-3 border-b border-line bg-white px-4 py-3 sm:px-8">
      {back && (
        <Link
          to={back}
          aria-label="Back"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line"
        >
          <ChevronLeft size={20} />
        </Link>
      )}
      <div className="min-w-0 flex-1 basis-40">
        <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>
        {sub && (
          <div className="truncate text-[13px] font-semibold text-mute">{sub}</div>
        )}
      </div>
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
      )}
      <div ref={notifRef} className="relative shrink-0">
        <button
          aria-label="Notifications"
          aria-haspopup="menu"
          aria-expanded={notifOpen}
          onClick={() => setNotifOpen((v) => !v)}
          className="relative flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line hover:border-brand"
        >
          <Bell size={20} />
          <span className="absolute top-2 right-2.5 size-2.5 rounded-full border-2 border-white bg-gold" />
        </button>
        {notifOpen && (
          <div
            role="menu"
            className="absolute top-12 right-0 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-xl"
          >
            <div className="px-3.5 pt-3 pb-2 text-xs font-semibold text-mute">
              Notifications
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notices === null ? (
                <p className="border-t border-line px-3.5 py-3 text-sm font-semibold text-mute">
                  Loading notifications…
                </p>
              ) : notices.length === 0 ? (
                <p className="border-t border-line px-3.5 py-3 text-sm font-semibold text-mute">
                  You’re all caught up.
                </p>
              ) : (
                notices.map((n) => (
                  <Link
                    key={n.id}
                    to={n.to}
                    role="menuitem"
                    onClick={() => setNotifOpen(false)}
                    className="flex items-start gap-2.5 border-t border-line px-3.5 py-3 no-underline hover:bg-soft"
                  >
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", NOTICE_TILE[n.tone])}>
                      {n.icon}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="truncate text-[13px] text-ink">{n.title}</b>
                      <span className="text-xs font-semibold leading-snug text-mute">{n.body}</span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {admin && (
        <div ref={wrapRef} className="relative shrink-0">
          <button
            onClick={() => canSwitch && setMenu((m) => !m)}
            aria-haspopup="menu"
            aria-expanded={menu}
            className={cn(
              "flex items-center gap-2 rounded-pill border-[1.5px] border-line bg-white py-1 pr-2.5 pl-1",
              canSwitch && "hover:border-brand",
            )}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-[#f1dfb9] text-xs font-extrabold text-[#6e4a0c]">
              {admin.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
            <span className="hidden flex-col text-left sm:flex">
              <b className="text-[13px]">{admin.name}</b>
              <span className="text-[11px] font-semibold text-mute">
                {roleLabel(admin.role)}
              </span>
            </span>
            {canSwitch && (
              <ChevronDown size={16} className={cn("transition", menu && "rotate-180")} />
            )}
          </button>
          {menu && (
            <div
              role="menu"
              className="absolute top-12 right-0 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-xl"
            >
              <div className="px-3.5 pt-3 pb-1.5 text-xs font-semibold text-mute">
                Switch role (demo of maker-checker)
              </div>
              {(["Administrator", "SuperAdmin"] as const).map((r) => {
                const name = people[r] ?? roleLabel(r);
                return (
                  <button
                    key={r}
                    role="menuitem"
                    onClick={() => switchTo(r)}
                    className="flex w-full items-center gap-2.5 border-t border-line px-3.5 py-3 text-left text-sm font-bold hover:bg-soft"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f1dfb9] text-[11px] font-extrabold text-[#6e4a0c]">
                      {name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="truncate text-[13px]">{name}</b>
                      <span className="text-[11px] font-semibold text-mute">
                        {roleLabel(r)} · {r === "SuperAdmin" ? "checker" : "maker"}
                      </span>
                    </span>
                    {admin.role === r && <Check size={16} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
