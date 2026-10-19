import { Outlet } from 'react-router-dom';
import { CtaBand, SiteFooter, SiteHeader } from '../features/website/components/SiteChrome';

/** Public website pages: header, page, call to action, footer. */
export function SiteLayout() {
  return <div className="min-w-0 overflow-x-clip"><SiteHeader /><main className="min-w-0 overflow-x-clip"><Outlet /></main><CtaBand /><SiteFooter /></div>;
}
/** Log in and register: their own split layout, footer only (no call to action pointing back at themselves). */
export function AuthLayout() {
  return <div className="min-w-0 overflow-x-clip"><main className="min-w-0 overflow-x-clip"><Outlet /></main><SiteFooter /></div>;
}
