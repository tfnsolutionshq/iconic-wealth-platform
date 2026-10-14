import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { Bell, Banknote, House, List, LogOut, MessageCircle, PiggyBank, Plus, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ContributionDraftProvider } from '../contexts/ContributionDraftContext';
import { Logo, cn } from '../design-system';
import { paths } from '../routes/paths';
import { OnboardingModal } from '../features/member/components/OnboardingModal';

const SIDE = [[House, 'Home', paths.member.home], [PiggyBank, 'Savings', paths.member.savings], [Plus, 'Contribute', paths.member.contribute], [List, 'Activity', paths.member.activity],
  [Banknote, 'Year-end payout', paths.member.payout], [Bell, 'Notifications', paths.member.notifications], [User, 'Profile', paths.member.profile], [MessageCircle, 'Support', paths.member.support]] as const;

export function MemberLayout() {
  const { session, logout } = useAuth();
  if (session?.kind !== 'member') return <Navigate to={paths.login} replace />;
  const m = session.member;
  return <ContributionDraftProvider>
    <div className="min-h-screen bg-soft lg:flex lg:items-start">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white px-3.5 py-6 lg:flex">
        <Logo to={paths.member.home} className="h-[54px] w-auto" />
        <nav className="mt-6 flex flex-col gap-1">{SIDE.map(([Icon, label, to]) => <NavLink key={to} to={to} end={to === paths.member.home}
          className={({ isActive }) => cn('flex h-11 items-center gap-2.5 rounded-xl px-3 text-[15px]', isActive ? 'bg-brand-tint font-extrabold text-brand-dark' : 'font-semibold text-[#474252] hover:bg-soft')}><Icon size={20} />{label}</NavLink>)}</nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3.5">
          <div className="flex items-center gap-2.5 px-3 pb-2.5"><span className="flex size-8 items-center justify-center rounded-full bg-[#e4d7fb] text-xs font-extrabold text-[#3b1580]">{m.firstName[0]}{m.lastName[0]}</span>
            <span className="flex flex-col"><b className="text-[13px]">{m.firstName} {m.lastName}</b><span className="text-xs font-semibold text-mute">{m.id}</span></span></div>
          <NavLink to={paths.home} className="flex h-11 items-center gap-2.5 rounded-xl px-3 font-semibold text-[#474252] hover:bg-soft"><House size={20} />Back to website</NavLink>
          <button onClick={logout} className="flex h-11 items-center gap-2.5 rounded-xl px-3 font-semibold text-fail hover:bg-soft"><LogOut size={20} />Log out</button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white px-5 py-3 lg:hidden"><Logo to={paths.member.home} className="h-10 w-auto" />
          <NavLink to={paths.member.notifications} aria-label="Notifications" className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-line"><Bell size={20} /></NavLink></header>
        <main className="px-5 pt-5 pb-32 lg:px-10 lg:pt-8 lg:pb-14"><Outlet /></main>
      </div>
      <nav aria-label="Member navigation" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white/95 px-2 pt-1.5 pb-6 lg:hidden">
        {([[House, 'Home', paths.member.home], [PiggyBank, 'Savings', paths.member.savings], null, [List, 'Activity', paths.member.activity], [User, 'Me', paths.member.profile]] as const).map((t, i) => t
          ? <NavLink key={t[2]} to={t[2]} end={t[2] === paths.member.home} className={({ isActive }) => cn('flex flex-1 flex-col items-center gap-1 text-[11px] font-bold', isActive ? 'text-brand' : 'text-[#8a958f]')}>{(() => { const I = t[0]; return <I size={22} />; })()}{t[1]}</NavLink>
          : <NavLink key={i} to={paths.member.contribute} aria-label="Contribute" className="flex flex-1 justify-center"><span className="-mt-4 flex size-12 items-center justify-center rounded-full bg-brand text-white shadow-lift"><Plus size={24} /></span></NavLink>)}
      </nav>
      <OnboardingModal />
    </div>
  </ContributionDraftProvider>;
}
