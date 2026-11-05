import { Navigate, Outlet } from 'react-router-dom';
import { CtaBand, SiteFooter, SiteHeader } from '../features/website/components/SiteChrome';
import { useAuth } from '../contexts/AuthContext';
import { paths } from '../routes/paths';

/** Public website pages: header, page, call to action, footer. */
export function SiteLayout() {
  const { session } = useAuth();
  if (session?.kind === 'admin') return <Navigate to={paths.admin.home} replace />;
  return <div className="min-w-0 overflow-x-clip"><SiteHeader /><main className="min-w-0 overflow-x-clip"><Outlet /></main><CtaBand /><SiteFooter /></div>;
}

/**
 * Log in and register: their own split layout, footer only.
 * Redirects already-authenticated users straight to their dashboard
 * so they never see the login form while a session is active.
 */
export function AuthLayout() {
  const { session } = useAuth();
  if (session?.kind === 'admin') return <Navigate to={paths.admin.home} replace />;
  if (session?.kind === 'member') return <Navigate to={paths.member.home} replace />;
  return <div className="min-w-0 overflow-x-clip"><main className="min-w-0 overflow-x-clip"><Outlet /></main><SiteFooter /></div>;
}
