import { Outlet } from 'react-router-dom';
import { CtaBand, SiteFooter, SiteHeader } from '../features/website/components/SiteChrome';

/** Public website pages: header, page, call to action, footer. */
export function SiteLayout() {
  return <><SiteHeader /><main><Outlet /></main><CtaBand /><SiteFooter /></>;
}
/** Log in and register: their own split layout, footer only (no call to action pointing back at themselves). */
export function AuthLayout() {
  return <><main><Outlet /></main><SiteFooter /></>;
}
