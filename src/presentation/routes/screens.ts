/**
 * Screen registry: every screen in the approved build, its PRD requirement IDs and the matching
 * route in the reference build (iconic-wealth-hub.html#<ref>). `status` tracks handover progress:
 *   implemented = built to the design in this starter;  scaffold = route, layout and guard are wired, page to build.
 */
export type Area = 'website' | 'auth' | 'member' | 'admin';
export interface Screen { path: string; title: string; area: Area; status: 'implemented' | 'scaffold'; prd: string; ref: string; notes?: string }

export const SCREENS: Screen[] = [
  { path: '/', title: 'Home', area: 'website', status: 'implemented', prd: 'WEB-01, WEB-02', ref: '#/' },
  { path: '/about', title: 'About', area: 'website', status: 'implemented', prd: 'WEB-03', ref: '#/about', notes: 'Hero + quote, mission/vision (draft CI-01), objective 2×2, “Is your money secure?”, founders.' },
  { path: '/how-it-works', title: 'How it works', area: 'website', status: 'implemented', prd: 'WEB-04', ref: '#/how-it-works', notes: 'Month at a glance (4 interactive glance cards) + year strip with autoplay highlight and December payout pulse.' },
  { path: '/savings', title: 'Savings', area: 'website', status: 'implemented', prd: 'WEB-05', ref: '#/savings', notes: 'Explainers + charges table computed with chargeBreakdown(); interest card (OD-01/02).' },
  { path: '/membership', title: 'Membership', area: 'website', status: 'implemented', prd: 'WEB-06', ref: '#/membership', notes: 'Who can join (OD-01), checklist, after-you-register card.' },
  { path: '/faqs', title: 'FAQs', area: 'website', status: 'implemented', prd: 'WEB-07', ref: '#/faqs', notes: 'Category chips, live search, accordion.' },
  { path: '/contact', title: 'Contact', area: 'website', status: 'implemented', prd: 'WEB-08', ref: '#/contact', notes: 'Validated form with toast; WhatsApp + contact details card (CI-01).' },
  { path: '/sitemap', title: 'Site map', area: 'website', status: 'scaffold', prd: 'WEB-15', ref: '#/sitemap' },
  { path: '/login', title: 'Log in', area: 'auth', status: 'implemented', prd: 'WEB-13', ref: '#/login' },
  { path: '/login/pending', title: 'Awaiting approval', area: 'auth', status: 'implemented', prd: 'WEB-12', ref: '#/login/pending' },
  { path: '/register', title: 'Register', area: 'auth', status: 'implemented', prd: 'WEB-09 to WEB-11, BR-16', ref: '#/register' },
  { path: '/register/done', title: 'Registration received', area: 'auth', status: 'implemented', prd: 'WEB-12', ref: '#/register/done' },
  { path: '/member', title: 'Member home', area: 'member', status: 'implemented', prd: 'MEM-01 to MEM-05 (v5)', ref: '#/member', notes: 'Open-month card with Pay now + Lock, target card, community gating.' },
  { path: '/member/savings', title: 'Savings log', area: 'member', status: 'implemented', prd: 'MEM-06 (v5)', ref: '#/member/savings', notes: 'Month rows with totals; expand months with several payments; Pay now + Lock on the open month; December = payout. Reuses OpenMonthCard/TargetCard and rules/savings.ts.' },
  { path: '/member/contribute', title: 'Contribute', area: 'member', status: 'implemented', prd: 'MEM-07, MEM-08 (v5)', ref: '#/member/contribute', notes: 'Amount only; minimum per payment; allocation preview for catch-up.' },
  { path: '/member/contribute/review', title: 'Review payment', area: 'member', status: 'implemented', prd: 'MEM-09, MEM-10', ref: '#/member/contribute/review' },
  { path: '/member/contribute/result', title: 'Payment result', area: 'member', status: 'implemented', prd: 'MEM-11', ref: '#/member/contribute/result/<id>' },
  { path: '/member/wallet', title: 'Wallet', area: 'member', status: 'implemented', prd: 'PRD pending (wallet)', ref: '#/member/wallet', notes: 'Spendable balance plus financial overview: available balance, pending deposits and withdrawals, fund wallet, withdraw to the verified payout account, filterable ledger with CSV statement. Mock data only until the wallet API ships.' },
  { path: '/member/activity', title: 'Activity', area: 'member', status: 'implemented', prd: 'MEM-12', ref: '#/member/activity', notes: 'Search, Contributions/Payouts/Pending/Failed filters, CSV statement download. Receipt rows shared via TransactionParts.' },
  { path: '/member/activity/:id', title: 'Receipt', area: 'member', status: 'implemented', prd: 'MEM-13', ref: '#/member/activity/<id>', notes: 'Status + on-time/late pills, applied-to months, references, HTML receipt download.' },
  { path: '/member/notifications', title: 'Notifications', area: 'member', status: 'implemented', prd: 'MEM-14', ref: '#/member/notifications', notes: 'Server items plus payment updates derived from transactions; local mark-read.' },
  { path: '/member/profile', title: 'Profile', area: 'member', status: 'implemented', prd: 'MEM-15', ref: '#/member/profile', notes: 'State of residence, address and next of kin editable; name, DOB, phone, email and payout account read-only with “Request a change” (repos.member.requestChange).' },
  { path: '/member/support', title: 'Support', area: 'member', status: 'implemented', prd: 'MEM-16', ref: '#/member/support', notes: 'Community gating, WhatsApp support links, member FAQ accordion.' },
  { path: '/member/payout', title: 'Year-end payout', area: 'member', status: 'implemented', prd: 'MEM-17', ref: '#/member/payout', notes: 'Saved-so-far card, payout steps, interest eligibility, payout account and date, past payouts. Interest shown as eligibility only (no rate).' },
  { path: '/member/payout/payout-day', title: 'Payout day', area: 'member', status: 'scaffold', prd: 'MEM-18, MEM-19', ref: '#/member/payout/payout-day', notes: 'Interest shown as an amount only (no rate). Payout date from platform settings.' },
  { path: '/admin', title: 'Dashboard', area: 'admin', status: 'implemented', prd: 'ADM-02, ADM-03', ref: '#/admin' },
  { path: '/admin/members', title: 'Members', area: 'admin', status: 'implemented', prd: 'ADM-04', ref: '#/admin/members', notes: 'Add, Import and Export buttons are wired to toasts; build the modals (ADM-05 to ADM-07).' },
  { path: '/admin/members/:id', title: 'Member record', area: 'admin', status: 'scaffold', prd: 'ADM-08 to ADM-11', ref: '#/admin/members/IWH-00412', notes: 'KPI tiles 2×2; interest exception request (Administrator) and approval (Super Admin).' },
  { path: '/admin/registrations', title: 'Registrations', area: 'admin', status: 'implemented', prd: 'ADM-12', ref: '#/admin/registrations', notes: 'Status tabs with counts, search, date filter; two-pane review with approve (opens account), request-changes toast and reject-with-reason modal.' },
  { path: '/admin/savings', title: 'Savings', area: 'admin', status: 'implemented', prd: 'ADM-13', ref: '#/admin/savings', notes: 'KPIs, recharts BarChart of members saving per month, status tabs, search, export.' },
  { path: '/admin/transactions', title: 'Transactions', area: 'admin', status: 'implemented', prd: 'ADM-14', ref: '#/admin/transactions', notes: 'Status tabs with counts, type and date filters, receipt preview modal with download, export.' },
  { path: '/admin/interest', title: 'Interest', area: 'admin', status: 'implemented', prd: 'ADM-15', ref: '#/admin/interest', notes: 'Year list with progress and CTA; one configuration per year.' },
  { path: '/admin/interest/:year', title: 'Interest workflow', area: 'admin', status: 'implemented', prd: 'ADM-16, ADM-17', ref: '#/admin/interest/2026', notes: '8 stages; maker-checker; past years read-only.' },
  { path: '/admin/payouts', title: 'Payouts', area: 'admin', status: 'implemented', prd: 'ADM-18', ref: '#/admin/payouts', notes: 'Batch list with status and year filters.' },
  { path: '/admin/payouts/:id', title: 'Payout batch', area: 'admin', status: 'implemented', prd: 'ADM-19, ADM-20', ref: '#/admin/payouts/PB-2025-12', notes: 'KPIs, member rows with retry and mark-paid-manually, history, maker-checker approval.' },
  { path: '/admin/reports', title: 'Reports', area: 'admin', status: 'implemented', prd: 'ADM-21', ref: '#/admin/reports', notes: 'Compliance, collections, eligibility and charges reports with filters and CSV export.' },
  { path: '/admin/referrals', title: 'Referrals', area: 'admin', status: 'implemented', prd: 'ADM-22', ref: '#/admin/referrals', notes: 'Referrer table with counts plus referred-by detail card.' },
  { path: '/admin/audit-log', title: 'Audit log', area: 'admin', status: 'implemented', prd: 'ADM-23', ref: '#/admin/audit-log', notes: 'Category tabs, date and search filters, export. Entries are append-only.' },
  { path: '/admin/settings', title: 'Settings', area: 'admin', status: 'implemented', prd: 'ADM-24 to ADM-27 (v5)', ref: '#/admin/settings', notes: 'Roles matrix; platform settings (Super Admin, audited); admin users; notification matrix.' },
  { path: '/admin/content', title: 'Content (testimonials)', area: 'admin', status: 'implemented', prd: 'ADM-28 (v5)', ref: '#/admin/content', notes: 'Add, edit, publish/unpublish, reorder, delete; consent tick. Website reads TestimonialRepository.listPublished().' },
];
export const screenFor = (path: string) => SCREENS.find(s => s.path === path);
