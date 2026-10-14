import { lazy, Suspense, type ReactElement } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { SCREENS } from './screens';
import { AuthLayout, SiteLayout } from '../layouts/SiteLayout';
import { MemberLayout } from '../layouts/MemberLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { ScaffoldPage } from '../features/ScaffoldPage';
import { HomePage } from '../features/website/pages/HomePage';
import { AboutPage } from '../features/website/pages/AboutPage';
import { HowItWorksPage } from '../features/website/pages/HowItWorksPage';
import { SavingsPage } from '../features/website/pages/SavingsPage';
import { MembershipPage } from '../features/website/pages/MembershipPage';
import { FAQPage } from '../features/website/pages/FAQPage';
import { ContactPage } from '../features/website/pages/ContactPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { AwaitingApprovalPage, RegistrationDonePage } from '../features/auth/pages/StatusPages';
const MemberHomePage = lazy(() => import('../features/member/pages/MemberHomePage').then(m => ({ default: m.MemberHomePage })));
const ContributePage = lazy(() => import('../features/member/pages/ContributePage').then(m => ({ default: m.ContributePage })));
const ReviewPaymentPage = lazy(() => import('../features/member/pages/ReviewPaymentPage').then(m => ({ default: m.ReviewPaymentPage })));
const PaymentResultPage = lazy(() => import('../features/member/pages/PaymentResultPage').then(m => ({ default: m.PaymentResultPage })));
const MemberSavingsPage = lazy(() => import('../features/member/pages/SavingsPage').then(m => ({ default: m.SavingsPage })));
const ActivityPage = lazy(() => import('../features/member/pages/ActivityPage').then(m => ({ default: m.ActivityPage })));
const ReceiptPage = lazy(() => import('../features/member/pages/ReceiptPage').then(m => ({ default: m.ReceiptPage })));
const NotificationsPage = lazy(() => import('../features/member/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const ProfilePage = lazy(() => import('../features/member/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const SupportPage = lazy(() => import('../features/member/pages/SupportPage').then(m => ({ default: m.SupportPage })));
const PayoutPage = lazy(() => import('../features/member/pages/PayoutPage').then(m => ({ default: m.PayoutPage })));
const AdminDashboardPage = lazy(() => import('../features/admin/pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const MembersPage = lazy(() => import('../features/admin/pages/MembersPage').then(m => ({ default: m.MembersPage })));
const RegistrationsPage = lazy(() => import('../features/admin/pages/RegistrationsPage').then(m => ({ default: m.RegistrationsPage })));
const AdminSavingsPage = lazy(() => import('../features/admin/pages/SavingsPage').then(m => ({ default: m.AdminSavingsPage })));
const AdminTransactionsPage = lazy(() => import('../features/admin/pages/TransactionsPage').then(m => ({ default: m.AdminTransactionsPage })));
const InterestPage = lazy(() => import('../features/admin/pages/InterestPage').then(m => ({ default: m.InterestPage })));
const InterestWorkflowPage = lazy(() => import('../features/admin/pages/InterestWorkflowPage').then(m => ({ default: m.InterestWorkflowPage })));
const PayoutsPage = lazy(() => import('../features/admin/pages/PayoutsPage').then(m => ({ default: m.PayoutsPage })));
const PayoutBatchPage = lazy(() => import('../features/admin/pages/PayoutBatchPage').then(m => ({ default: m.PayoutBatchPage })));
const ReportsPage = lazy(() => import('../features/admin/pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const ReferralsPage = lazy(() => import('../features/admin/pages/ReferralsPage').then(m => ({ default: m.ReferralsPage })));
const AuditLogPage = lazy(() => import('../features/admin/pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const SettingsPage = lazy(() => import('../features/admin/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ContentPage = lazy(() => import('../features/admin/pages/ContentPage').then(m => ({ default: m.ContentPage })));

/** Implemented pages. Any screen in SCREENS without an entry here renders ScaffoldPage. */
const PAGES: Record<string, ReactElement> = {
  '/': <HomePage />, '/about': <AboutPage />, '/how-it-works': <HowItWorksPage />, '/savings': <SavingsPage />, '/membership': <MembershipPage />, '/faqs': <FAQPage />, '/contact': <ContactPage />, '/login': <LoginPage />, '/register': <RegisterPage />, '/register/done': <RegistrationDonePage />, '/login/pending': <AwaitingApprovalPage />,
  '/member': <MemberHomePage />, '/member/savings': <MemberSavingsPage />, '/member/contribute': <ContributePage />, '/member/contribute/review': <ReviewPaymentPage />, '/member/contribute/result': <PaymentResultPage />,
  '/member/activity': <ActivityPage />, '/member/activity/:id': <ReceiptPage />, '/member/notifications': <NotificationsPage />,
  '/member/profile': <ProfilePage />, '/member/support': <SupportPage />, '/member/payout': <PayoutPage />,
  '/admin': <AdminDashboardPage />, '/admin/members': <MembersPage />, '/admin/registrations': <RegistrationsPage />,
  '/admin/savings': <AdminSavingsPage />, '/admin/transactions': <AdminTransactionsPage />,
  '/admin/interest': <InterestPage />, '/admin/interest/:year': <InterestWorkflowPage />,
  '/admin/payouts': <PayoutsPage />, '/admin/payouts/:id': <PayoutBatchPage />,
  '/admin/reports': <ReportsPage />, '/admin/referrals': <ReferralsPage />, '/admin/audit-log': <AuditLogPage />,
  '/admin/settings': <SettingsPage />, '/admin/content': <ContentPage />,
};
/** Member and admin pages load on demand (separate chunks) so website visitors don't download portal code. */
const element = (path: string) => <Suspense fallback={<p className="p-8 text-mute">Loading…</p>}>{PAGES[path] ?? <ScaffoldPage path={path} />}</Suspense>;
const children = (filter: (p: string) => boolean): RouteObject[] => SCREENS.filter(s => filter(s.path)).map(s => ({ path: s.path, element: element(s.path) }));
const AUTH_ONLY = ['/login', '/register'];

export const router = createBrowserRouter([
  { element: <SiteLayout />, children: children(p => !p.startsWith('/member') && !p.startsWith('/admin') && !AUTH_ONLY.includes(p)) },
  { element: <AuthLayout />, children: children(p => AUTH_ONLY.includes(p)) },
  { element: <MemberLayout />, children: children(p => p.startsWith('/member')) },
  { element: <AdminLayout />, children: children(p => p.startsWith('/admin')) },
  { path: '*', element: <Navigate to="/" replace /> },
]);
