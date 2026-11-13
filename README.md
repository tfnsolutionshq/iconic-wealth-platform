# Iconic Wealth Hub — Web (React + TypeScript)

Production codebase for the public website, member portal and admin portal.
Full handover guide: **[docs/HANDOVER.md](docs/HANDOVER.md)** (architecture, conventions, screen status, API contract, deployment).

```bash
npm install
cp .env.example .env      # configured for the deployed API
npm run dev               # http://localhost:5173
npm test                  # business-rule and repository tests (Vitest)
npm run build             # type-check + production build to dist/
```

Every API request in development and production goes to `https://api.iconicwealth.tfnsolutions.us/api/v1/`. `VITE_API_BASE_URL` may override it for a specific environment; when it is empty, the application falls back to that canonical URL. The base URL is defined once in `src/app/config/env.ts` and all endpoint paths live in `src/data/api/`.
