# Iconic Wealth Hub — Web (React + TypeScript)

Production codebase for the public website, member portal and admin portal.
Full handover guide: **[docs/HANDOVER.md](docs/HANDOVER.md)** (architecture, conventions, screen status, API contract, deployment).

```bash
npm install
cp .env.example .env      # demo mode with in-memory data; no backend needed
npm run dev               # http://localhost:5173
npm test                  # business-rule and repository tests (Vitest)
npm run build             # type-check + production build to dist/
```

Demo log-ins (VITE_DEMO_MODE=true with no API base URL, any password): existing member, first-time member, awaiting approval, administrator — the form is prefilled with the demo account in that mode.

To send **registration and sign-in only** to the live API while everything else stays on mock data, set `VITE_REGISTRATION_API_BASE_URL=/api/v1` in development (Vite proxies it to `https://api.iconicwealth.tfnsolutions.us`, avoiding CORS). To point **all** API-backed repositories at the live API, set `VITE_API_BASE_URL` instead. The base URLs and all endpoint paths are defined once in `src/app/config/env.ts` and `src/data/api/`.
