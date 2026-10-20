import { useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import {
  Bell,
  Banknote,
  House,
  List,
  LogOut,
  Menu,
  MessageCircle,
  PiggyBank,
  Plus,
  User,
  X,
} from "lucide-react";
import type { Member } from "@/domain/entities";
import { useAuth } from "../contexts/AuthContext";
import { ContributionDraftProvider } from "../contexts/ContributionDraftContext";
import { Logo, cn } from "../design-system";
import { paths } from "../routes/paths";
import { OnboardingModal } from "../features/member/components/OnboardingModal";

const SIDE = [
  [House, "Home", paths.member.home],
  [PiggyBank, "Savings", paths.member.savings],
  [Plus, "Contribute", paths.member.contribute],
  [List, "Activity", paths.member.activity],
  [Banknote, "Year-end payout", paths.member.payout],
  [Bell, "Notifications", paths.member.notifications],
  [User, "Profile", paths.member.profile],
  [MessageCircle, "Support", paths.member.support],
] as const;

export function MemberLayout() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  if (session?.kind !== "member") return <Navigate to={paths.login} replace />;
  const m = session.member;
  return (
    <ContributionDraftProvider>
      <div className="min-h-screen bg-soft lg:flex lg:items-start">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white px-3.5 py-6 lg:flex">
          <Logo to={paths.member.home} className="h-13.5 w-auto" />
          <MemberNav />
          <MemberFooter m={m} />
        </aside>
        {/* Mobile drawer */}
        <div
          aria-hidden={!open}
          className={cn(
            "fixed inset-0 z-50 lg:hidden",
            !open && "pointer-events-none",
          )}
        >
          <div
            className={cn(
              "absolute inset-0 bg-ink/55 transition-opacity duration-300 ease-out",
              open ? "opacity-100" : "opacity-0",
            )}
            onClick={() => setOpen(false)}
          />
          <aside
            className={cn(
              "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto overscroll-y-contain border-r border-line bg-white px-3.5 py-6 transition-all duration-300 ease-out",
              open ? "translate-x-0" : "invisible -translate-x-full",
            )}
          >
            <div className="flex items-center justify-between gap-2 pr-1">
              <Logo to={paths.member.home} className="h-10 w-auto" />
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line"
              >
                <X size={18} />
              </button>
            </div>
            <MemberNav onNavigate={() => setOpen(false)} />
            <MemberFooter m={m} />
          </aside>
        </div>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:hidden">
            <button
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line"
            >
              <Menu size={20} />
            </button>
            <Logo to={paths.member.home} className="h-9 w-auto" />
            <NavLink
              to={paths.member.notifications}
              aria-label="Notifications"
              className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line"
            >
              <Bell size={20} />
            </NavLink>
          </header>
          <main className="px-5 pt-5 pb-10 lg:px-10 lg:pt-8 lg:pb-14">
            <Outlet />
          </main>
        </div>
        <OnboardingModal />
      </div>
    </ContributionDraftProvider>
  );
}

function MemberNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="mt-6 flex flex-col gap-1" aria-label="Member navigation">
      {SIDE.map(([Icon, label, to]) => (
        <NavLink
          key={to}
          to={to}
          end={to === paths.member.home}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex h-11 items-center gap-2.5 rounded-xl px-3 text-[15px]",
              isActive
                ? "bg-brand-tint font-extrabold text-brand-dark"
                : "font-semibold text-[#474252] hover:bg-soft",
            )
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function MemberFooter({
  m,
  onNavigate,
}: {
  m: Member;
  onNavigate?: () => void;
}) {
  const { logout } = useAuth();
  return (
    <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3.5">
      <div className="flex items-center gap-2.5 px-3 pb-2.5">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#e4d7fb] text-xs font-extrabold text-[#3b1580]">
          {m.firstName[0]}
          {m.lastName[0]}
        </span>
        <span className="flex flex-col">
          <b className="text-[13px]">
            {m.firstName} {m.lastName}
          </b>
          <span className="text-xs font-semibold text-mute">{m.id}</span>
        </span>
      </div>
      <NavLink
        to={paths.home}
        onClick={onNavigate}
        className="flex h-11 items-center gap-2.5 rounded-xl px-3 font-semibold text-[#474252] hover:bg-soft"
      >
        <House size={20} />
        Back to website
      </NavLink>
      <button
        onClick={logout}
        className="flex h-11 items-center gap-2.5 rounded-xl px-3 font-semibold text-fail hover:bg-soft"
      >
        <LogOut size={20} />
        Log out
      </button>
    </div>
  );
}
