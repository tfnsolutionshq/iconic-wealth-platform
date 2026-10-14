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

Demo log-ins (VITE_DEMO_MODE=true, any password): existing member, first-time member, awaiting approval, administrator — chips on the login page.
