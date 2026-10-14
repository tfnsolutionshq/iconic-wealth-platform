# Frontend handover: Iconic Wealth Hub Phase One

**For:** Kosi (frontend lead), Steve (associate) · **Backend contract:** Promise, Dumebi · **PM:** Olabode
**Design source of truth:** `iconic-wealth-hub.html` (approved clickable build, v5 — requirements review of 5 Oct 2026) · **Requirements:** Master PRD/BRD v4.0 · **Tests:** UAT Manual v1.0

This repository converts the approved build into the agreed stack and architecture. The foundation, design system, routing, state management, domain rules and three complete vertical slices are built and tested; every other screen is wired (route, layout, guard) and scaffolded with its requirement IDs and design reference, ready to build.

---

## 1. Stack (pinned)

| Requirement | Version used | Notes |
| --- | --- | --- |
| React + TypeScript | react 19.3.0, typescript 5.9.3 | See difference D2 (TypeScript 7) |
| Tailwind CSS | 4.3.2 (+ @tailwindcss/vite 4.3.2) | CSS-first `@theme` tokens in `src/styles/index.css` |
| framer-motion | 14.0.0 | Modals, toasts, mobile menu, home steps micro-interactions |
| react-router-dom | 7.18.4 | See difference D3 |
| lucide-react | 1.51.0 | Icon mapping in section 7 |
| recharts | 3.10.1 | Admin dashboard chart; to be used on Admin › Savings and Reports |
| Context API | — | Services (DI), Auth, Toast, Contribution draft |
| Build | vite 8.3.2, @vitejs/plugin-react 6.1.1 | Code-split: member and admin load on demand |
| Tests | vitest 5.0.3 | Addition, see difference D6 |

## 2. Differences from your spec and from the approved build (please review)

| # | Difference | What we did | Decision needed? |
| --- | --- | --- | --- |
| D1 | **Tailwind 4.3.2** is not the latest patch (4.3.3 is out) | Pinned 4.3.2 as specified | Optional: bump to 4.3.3 |
| D2 | npm “latest” TypeScript is **7.0** (the new native compiler) | Pinned **5.9.3** for tooling compatibility | Confirm 5.9 |
| D3 | **react-router-dom stops at v7.18.4**; React Router’s current line is `react-router` v8 (no separate “-dom” package) | Used react-router-dom 7.18.4 as specified. Migrating later means changing imports from `react-router-dom` to `react-router` | Confirm v7, or approve `react-router` v8 |
| D4 | framer-motion has been republished as **`motion`** (same 14.0.0) | Used `framer-motion` as specified; imports are the same API | None |
| D5 | **lucide-react v1** removed some old icon aliases | Used current names (`House`, `TriangleAlert`, `Funnel`, `ChartColumn`, `Ellipsis`). All icons from the design have lucide equivalents (section 7) | None |
| D6 | **Testing** isn’t in the spec | Added Vitest (dev only) for business rules and repositories: 19 tests | Keep (recommended) |
| D7 | **Linting/formatting** isn’t in the spec | Not added. Recommend ESLint (typescript-eslint, react-hooks) + Prettier in Sprint 0 | Approve |
| D8 | **Fonts**: design uses Fraunces (display) + Manrope (UI) from Google Fonts | Loaded via `<link>` in `index.html` | Optional: self-host with `@fontsource/*` (privacy/offline) |
| D9 | **Routing**: build used hash URLs (`#/member`) | Clean URLs with `createBrowserRouter`. **Hosting must rewrite all paths to `/index.html`** (section 10) | None |
| D10 | **Paystack**: build used a stand-in page | `PaystackInlineGateway` loads Paystack Inline v2 at runtime (no npm package). Demo stand-in kept behind `VITE_DEMO_MODE` | Backend must verify every payment server-side |
| D11 | **Demo-only features** in the build | Demo log-in chips, Paystack outcome picker, admin role switcher, “Preview payout day” are gated by `VITE_DEMO_MODE`. **Must be `false` in production** | None |
| D12 | **Global state**: build used one mutable object and module arrays | Context API + repositories; seed data moved to `src/data/mock/seed.ts` | None |
| D13 | **Fixed demo date** (2 Oct 2026) in the build | Injected `Clock`: fixed date in mock mode, real clock with an API | None |
| D14 | **Charts**: build drew bars with CSS | recharts on the admin dashboard; use recharts for Admin › Savings and Reports previews | None |
| D15 | **Forms**: no form library in the spec | Plain controlled inputs + pure validators in `domain/rules` (no Zod/React Hook Form) | Optional |
| D16 | **Platform charge** is a flat ₦100 per payment (v5); gateway fee treatment still open (OD-06/07/08) | `domain/rules/charges.ts`; shown only as the total at review | Client / finance |
| D17 | **Savings model v5** replaces baseline + multiples | Monthly buckets, oldest-open-month allocation, auto-close on the 5th, member lock, catch-up, targets: `domain/rules/savings.ts` with tests | None |

## 3. Architecture (Clean Architecture)

```
src/
  domain/            ← business core. No React, no fetch, no Tailwind.
    entities/        types: Member, SavingsYear, Transaction, Registration, Session …
    rules/           pure functions: charges, contribution (baseline, multiples), calendar (deadlines, late), registration, passwords
    repositories/    PORTS (interfaces) the app depends on: Auth, Registration, Member, Contribution, Admin, PaymentGateway
    services/        Clock port (system / fixed)
    usecases/        orchestration, e.g. ContributeUseCase: validate → initiate → gateway → verify
  data/              ← implements the ports
    mock/seed.ts     sample data from the approved build
    repositories/mock   in-memory adapters (demo, local dev, tests)
    repositories/http   REST adapters (proposed contract, section 9)
    gateways/        PaystackInlineGateway, DemoGateway
    api/httpClient.ts
  presentation/      ← React only
    design-system/   tokens are in styles/index.css; components: Button, ButtonLink, TextField, SelectField, Checkbox, Pill, OpenDecisionTag, Banner, EmptyState, Card, Kpi, KeyValue, Modal, Chips, YearStrip, Logo, DataTable
    contexts/        ServicesContext (DI), AuthContext, ToastContext, ContributionDraftContext, DemoCheckoutHost
    hooks/           useSavingsYear
    layouts/         SiteLayout / AuthLayout, MemberLayout (guard + onboarding), AdminLayout (+ AdminPageHeader)
    routes/          screens.ts (registry), paths.ts (URL helpers), router.tsx (generated from the registry)
    features/        website | auth | member | admin  → pages/ and components/
  app/               ← composition root
    di/container.ts  the ONLY place that picks mock vs http and real vs demo gateway
    config/env.ts    typed environment
    providers/       AppProviders
```

**Dependency rule (enforce in review):** `presentation → domain ← data`, wired in `app/`.
- `domain` imports nothing outside `domain`.
- `data` imports `domain` only.
- `presentation` imports `domain` and gets implementations from `useServices()`; it never imports `data/repositories/*` (only `data/mock/seed` for demo chips, and the `DemoOutcome` type).
- Money is integer **kobo** everywhere; format only at the edge with `formatNaira()`.

## 4. State management (Context API)

| Context | Holds | Used by |
| --- | --- | --- |
| `ServicesContext` | repositories, clock, demo gateway | everything (`useServices()`) |
| `AuthContext` | session (`member` / `admin` / `pending`), login, logout, `updateMember`, demo role switch | layouts, auth pages, onboarding |
| `ToastContext` | transient messages | everywhere (`useToast()`) |
| `ContributionDraftContext` | chosen amount, last transaction | Contribute → Review → Result (scoped inside `MemberLayout`) |

Keep server data in pages/hooks (fetch via repositories, `reload()` after changes); add a context only when state must be shared across routes. Session is kept in `sessionStorage` (token in `sessionStorage` for the HTTP adapter); agree with backend whether to move to an httpOnly cookie.

## 5. Conventions

- **Files:** `PascalCase.tsx` for components/pages, `camelCase.ts` for logic; one exported page per file in `features/<area>/pages`.
- **Names:** pages end in `Page`, use cases in `UseCase`, ports in `Repository`/`Gateway`, adapters prefixed `Mock`/`Http`.
- **Styling:** Tailwind utilities with design tokens (`bg-brand`, `text-mute`, `rounded-card`, `shadow-lift`). No hex values in components except the few documented one-offs; add new tokens to `@theme` instead.
- **Reuse before writing:** check `design-system/index.ts` first. New shared UI goes there with a short doc comment.
- **Business rules live in `domain/rules`** with a test. UI must not re-implement rules (e.g. charges, baselines, deadlines).
- **Accessibility:** status = icon + word (`Pill`), labelled inputs (`TextField`/`SelectField`), focus-visible styles, keyboard-usable rows, modals with `aria-modal`.
- **Open decisions:** use `<OpenDecisionTag code="OD-xx">` where behaviour depends on a pending decision; remove when decided.

## 6. Screen status (generated from `src/presentation/routes/screens.ts`)

Implemented end to end and tested in the browser (v5): **website home (with testimonials), log in, register, registration received, awaiting approval, member onboarding (payout → target), member home (open month with Pay now + Lock, target card, community gating), contribute (amount only, catch-up split) → review (total incl. ₦100) → Paystack (demo) → result (target celebration, community unlock), admin dashboard, admin members**. Every other screen renders `ScaffoldPage`, which shows its requirement IDs and the reference-build route.

| Area | Route | Screen | Status | Requirements | Reference build |
| --- | --- | --- | --- | --- | --- |
| website | `/` | Home | ✅ Implemented | WEB-01, WEB-02 | `#/` |
| website | `/about` | About | 🧱 Scaffold | WEB-03 | `#/about` |
| website | `/how-it-works` | How it works | 🧱 Scaffold | WEB-04 | `#/how-it-works` |
| website | `/savings` | Savings | 🧱 Scaffold | WEB-05 | `#/savings` |
| website | `/membership` | Membership | 🧱 Scaffold | WEB-06 | `#/membership` |
| website | `/faqs` | FAQs | 🧱 Scaffold | WEB-07 | `#/faqs` |
| website | `/contact` | Contact | 🧱 Scaffold | WEB-08 | `#/contact` |
| website | `/sitemap` | Site map | 🧱 Scaffold | WEB-15 | `#/sitemap` |
| auth | `/login` | Log in | ✅ Implemented | WEB-13 | `#/login` |
| auth | `/login/pending` | Awaiting approval | ✅ Implemented | WEB-12 | `#/login/pending` |
| auth | `/register` | Register | ✅ Implemented | WEB-09 to WEB-11, BR-16 | `#/register` |
| auth | `/register/done` | Registration received | ✅ Implemented | WEB-12 | `#/register/done` |
| member | `/member` | Member home | ✅ Implemented | MEM-01 to MEM-05 (v5) | `#/member` |
| member | `/member/savings` | Savings log | 🧱 Scaffold | MEM-06 (v5) | `#/member/savings` |
| member | `/member/contribute` | Contribute | ✅ Implemented | MEM-07, MEM-08 (v5) | `#/member/contribute` |
| member | `/member/contribute/review` | Review payment | ✅ Implemented | MEM-09, MEM-10 | `#/member/contribute/review` |
| member | `/member/contribute/result` | Payment result | ✅ Implemented | MEM-11 | `#/member/contribute/result/<id>` |
| member | `/member/activity` | Activity | 🧱 Scaffold | MEM-12 | `#/member/activity` |
| member | `/member/activity/:id` | Receipt | 🧱 Scaffold | MEM-13 | `#/member/activity/<id>` |
| member | `/member/notifications` | Notifications | 🧱 Scaffold | MEM-14 | `#/member/notifications` |
| member | `/member/profile` | Profile | 🧱 Scaffold | MEM-15 | `#/member/profile` |
| member | `/member/support` | Support | 🧱 Scaffold | MEM-16 | `#/member/support` |
| member | `/member/payout` | Year-end payout | 🧱 Scaffold | MEM-17 | `#/member/payout` |
| member | `/member/payout/payout-day` | Payout day | 🧱 Scaffold | MEM-18, MEM-19 | `#/member/payout/payout-day` |
| admin | `/admin` | Dashboard | ✅ Implemented | ADM-02, ADM-03 | `#/admin` |
| admin | `/admin/members` | Members | ✅ Implemented | ADM-04 | `#/admin/members` |
| admin | `/admin/members/:id` | Member record | 🧱 Scaffold | ADM-08 to ADM-11 | `#/admin/members/IWH-00412` |
| admin | `/admin/registrations` | Registrations | ✅ Implemented | ADM-12 | `#/admin/registrations` |
| admin | `/admin/savings` | Savings | ✅ Implemented | ADM-13 | `#/admin/savings` |
| admin | `/admin/transactions` | Transactions | ✅ Implemented | ADM-14 | `#/admin/transactions` |
| admin | `/admin/interest` | Interest | ✅ Implemented | ADM-15 | `#/admin/interest` |
| admin | `/admin/interest/:year` | Interest workflow | ✅ Implemented | ADM-16, ADM-17 | `#/admin/interest/2026` |
| admin | `/admin/payouts` | Payouts | ✅ Implemented | ADM-18 | `#/admin/payouts` |
| admin | `/admin/payouts/:id` | Payout batch | ✅ Implemented | ADM-19, ADM-20 | `#/admin/payouts/PB-2025-12` |
| admin | `/admin/reports` | Reports | ✅ Implemented | ADM-21 | `#/admin/reports` |
| admin | `/admin/referrals` | Referrals | ✅ Implemented | ADM-22 | `#/admin/referrals` |
| admin | `/admin/audit-log` | Audit log | ✅ Implemented | ADM-23 | `#/admin/audit-log` |
| admin | `/admin/settings` | Settings | ✅ Implemented | ADM-24 to ADM-27 (v5) | `#/admin/settings` |
| admin | `/admin/content` | Content (testimonials) | ✅ Implemented | ADM-28 (v5) | `#/admin/content` |

**To build a scaffolded screen:** create the page in `features/<area>/pages`, add it to `PAGES` in `routes/router.tsx`, set `status: 'implemented'` in `screens.ts`, reuse design-system components, add any missing port methods (domain) and adapters (mock + http), and test against the matching UAT scripts (UAT-WEB/MEM/ADM-xx).

## 7. Icon mapping (design → lucide-react 1.51)

| Design | lucide | Design | lucide | Design | lucide |
| --- | --- | --- | --- | --- | --- |
| home | `House` | jar (savings) | `PiggyBank` | plus | `Plus` |
| list | `List` | user / users | `User` / `Users` | bell | `Bell` |
| search | `Search` | check | `Check` | clock | `Clock` |
| x | `X` | alert | `TriangleAlert` | info | `Info` |
| lock | `Lock` | chevrons | `ChevronRight/Left/Down` | download / upload | `Download` / `Upload` |
| filter | `Funnel` | shield | `ShieldCheck` | chart | `ChartColumn` |
| cog | `Settings` | file | `FileText` | refresh | `RefreshCw` |
| calendar | `Calendar` | card | `CreditCard` | bank | `Landmark` |
| logout | `LogOut` | eye | `Eye` | link | `Link2` |
| percent | `Percent` | cash | `Banknote` | mail / phone / pin | `Mail` / `Phone` / `MapPin` |
| menu | `Menu` | more | `Ellipsis` | wifi / ban | `Wifi` / `Ban` |
| message | `MessageCircle` | key | `KeyRound` | history | `History` |

Logos are PNG assets in `src/assets/brand` (main and white). Favicon: `public/favicon.png`.

## 8. Business rules implemented in `domain/rules` (v5, with tests)

| Rule | Function | Where it shows |
| --- | --- | --- |
| Savings months January–November; December = payout | `PlatformSettings.lastSavingsMonth`, `monthState` → `payout` | Year strip, savings log |
| Minimum **per payment** (₦10,000, admin-set per year) | `minimumFor`, `planAllocation` | Contribute |
| Payment goes to the **oldest open month** | `openMonth`, `planAllocation` | Contribute, Review |
| Month closes at the end of the 5th of the next month | `isLocked`, `deadlineFor` | Open-month card |
| Member may **lock** the open month once it has the minimum | `canLock` (+ `MemberRepository.lockMonth`) | Open-month card |
| Mid-year joiners: catch-up months take the minimum each, extra flows on; approved after the cut-off → next January | `isCatchUp`, `planAllocation`, `autoLocksAfter`, `savingsStartFor` | Contribute (allocation preview) |
| Monthly Savings Target (optional), progress resets monthly, streak, months met | `targetFor`, `targetHistory`, `targetStreak`, `validateTarget` | Target card, result celebration |
| Interest affected when a month closes with nothing saved (exception overrides) | `interestOnTrack` | Home pill |
| Flat ₦100 platform charge | `chargeBreakdown` | Review total only |
| Registration: 18+, state, address, referral only for member referrals | `validateDetails` | Register |

## 9. Proposed API contract (agree with backend in Sprint 0)

All amounts in kobo. Auth: `Authorization: Bearer <token>`. Implemented in `src/data/repositories/http/index.ts`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | `{ identifier, password }` → `{ token, session }` (session kind: member, admin, pending) |
| POST | `/auth/logout`, `/auth/password-reset` | Log out; send reset link |
| POST | `/registrations/email-code`, `/registrations/email-code/verify` | Send / verify 6-digit email code |
| POST | `/registrations` | Submit registration (details, next of kin, password) |
| GET | `/members/{id}` | Member profile |
| GET | `/members/{id}/savings/{year}` | Savings year (baseline, month statuses, eligibility) |
| PUT | `/members/{id}/payout-account` | Save payout account (server resolves and stores account name) |
| GET | `/banks/{bankCode}/resolve?account=` | Resolve account name |
| PUT | `/members/{id}/savings/{year}/target` | Monthly target (`{ month, amountKobo, applyToFollowing }`) |
| POST | `/members/{id}/savings/{year}/months/{month}/lock` | Member locks the open month (server checks minimum) |
| POST | `/members/{id}/community/joined`, `/members/{id}/onboarding/complete` | Community and onboarding |
| POST | `/members/{id}/change-requests` | Phone, email or payout account change request |
| GET | `/settings/platform` | Minimum per payment by year, cut-off month, payout dates, charge |
| GET | `/content/testimonials?status=Published` | Website testimonials |
| GET | `/members/{id}/transactions`, `/members/{id}/notifications` | Activity, notifications |
| POST | `/contributions` | Create intent + reference; server re-plans the allocation (`{ memberId, year, amountKobo }` → allocations) |
| POST | `/contributions/{reference}/verify` | Server-side verification → `{ transaction, communityUnlocked }`; applies catch-up auto-locks |
| GET | `/admin/dashboard?year=`, `/admin/members?…`, `/admin/members/counts`, `/admin/registrations`, `/admin/me` | Admin |
| POST | `/admin/registrations/{id}/decision` | Approve (`{ decision: 'Approved' }` → opens account) or reject (`{ decision: 'Rejected', reason }`) a registration |

Extend the ports in `domain/repositories` first, then both adapters (mock and http), for every new endpoint.

## 10. Environments and production deployment

| Variable | Dev / staging | Production |
| --- | --- | --- |
| `VITE_API_BASE_URL` | empty = mock data, or staging API | production API |
| `VITE_PAYSTACK_PUBLIC_KEY` | `pk_test_…` | `pk_live_…` |
| `VITE_DEMO_MODE` | `true` (demos) | **`false`** |
| `VITE_WA_COMMUNITY_URL`, `VITE_WA_SUPPORT_URL` | placeholders | cooperative’s real links |

- `npm run build` → static `dist/`. Serve from any static host or CDN.
- **SPA rewrite:** route every unknown path to `/index.html` (Nginx `try_files $uri /index.html;`, Netlify `/* /index.html 200`, S3/CloudFront 403/404 → `/index.html`).
- **CSP** must allow `https://js.paystack.co` (script), `https://checkout.paystack.com` (frame), and Google Fonts (or self-host, D8).
- Cache `/assets/*` (hashed) for a year; never cache `index.html`.

## 11. Suggested build order (maps to the work plan)

1. **Sprint 0:** D2/D3/D7 decisions; ESLint + Prettier; agree API contract; CI (`npm ci && npm test && npm run build`).
2. **Sprint 1:** website content pages (About, How it works, Savings, Membership, FAQs, Contact, Site map); member profile and support; admin member record, add/import/export, registrations.
3. **Sprint 2:** member savings, activity, receipt, notifications; admin savings (recharts), transactions; switch to HTTP adapters as endpoints land.
4. **Sprint 3:** member payout and withdrawal; admin interest workflow, payout batches, reports, referrals, audit log, settings.

Each screen is done when it matches the reference build at 1440 px and 390 px, passes its UAT scripts, has no type errors, and business logic is in `domain` with tests.
