# The Kalyan Chronicle

An interactive engineering broadsheet for Saragadam Kalyan: project profiles, architecture and tools, a GitHub/Substack digest, grounded RAG, package analysis, and a developer workbench.

## Live edition

- **GitHub Pages (verified):** [kalyan870.github.io/the-kalyan-chronicle](https://kalyan870.github.io/the-kalyan-chronicle/)
- **Vercel (verified):** [kalyan-chronicle.vercel.app](https://kalyan-chronicle.vercel.app/)
- **Netlify (verified):** [the-kalyan-chronicle.netlify.app](https://the-kalyan-chronicle.netlify.app/)
- **Repository:** [github.com/kalyan870/the-kalyan-chronicle](https://github.com/kalyan870/the-kalyan-chronicle)

GitHub Pages serves the static edition. Vercel and Netlify have server adapters for API routes; server features depend on each host's environment variables.

### Live screenshot

![The Kalyan Chronicle live desktop edition](docs/screenshots/chronicle-home.png)

### Portfolio editions

| V1 — side-by-side | V2 — full-screen |
| --- | --- |
| [Open V1](https://kalyannexus.vercel.app/) · ![V1 screenshot](docs/screenshots/portfolio-v1.webp) | [Open V2](https://kalyanportfolio-five.vercel.app/) · ![V2 screenshot](docs/screenshots/portfolio-v2.webp) |

## Stack

- React 19, TypeScript, Vite, Tailwind CSS, Motion, and a PWA service worker
- Express API with Helmet security headers, request limits, input validation, and protected mutations
- Clerk sessions when Clerk keys are configured; Firebase Google sign-in is the ready-to-run fallback
- Neon Postgres and Cloudflare R2 are optional server-side services; local mode falls back to Firestore/local storage where implemented
- Gemini and Resend are optional server-side integrations

## Architecture

```mermaid
flowchart LR
  Browser[Visitor browser] --> Vite[React and TypeScript UI]
  Vite --> Features[Sections, typed portfolio data, and media]
  Vite --> Adapters[Host adapters]
  Adapters --> Vercel[Vercel API]
  Adapters --> Netlify[Netlify function]
  Vite --> Static[Static build: GitHub Pages and Cloudflare]
  Vercel --> Express[Express app: src/server/createApp.ts]
  Netlify --> Express
  Express --> Auth[authGate and security middleware]
  Auth --> Firebase[Firebase or Clerk session]
  Express --> Data[Neon Postgres and local fallback]
  Express --> Media[Cloudflare R2 signed uploads]
  Express --> Services[Gemini and Resend]
  Static --> Archive[Curated digest and optimized WebP media]
```

- `src/components` renders the newspaper sections; `src/data` owns the typed project and fallback-digest content; `src/utils` contains safe URL, print, and public-asset helpers.
- `src/server/createApp.ts` owns API routes. `api/index.ts` adapts it for Vercel, `netlify/functions/api.ts` adapts it for Netlify, and `server.ts` runs it locally.
- Static builds use a base-aware media resolver and a bundled archive. They do not poll API routes that static hosts cannot serve. The GitHub Pages build uses `/the-kalyan-chronicle/` as its base path.
- Protected writes verify Firebase or Clerk identity on the server. Optional Neon and R2 integrations stay behind that boundary; static portfolios and demos do not gain artificial service dependencies.

### Repository map

| Path | Responsibility |
| --- | --- |
| `src/components/` | Newspaper sections, project cards, controls, and responsive presentation |
| `src/data/` | Typed profile, project, and curated fallback edition data |
| `src/lib/` and `src/utils/` | Auth client, API clients, safe URL handling, base-aware media, print/export helpers |
| `src/server/` | Express routes, validation, auth gates, provider integrations, and security middleware |
| `api/`, `netlify/functions/`, `server.ts` | Vercel, Netlify, and local Express entry points |
| `public/` | PWA metadata, optimized static images, and offline edition assets |
| `.github/workflows/` | CI, GitHub Pages publishing, and opt-in provider deploy workflows |

The request path is **browser → React feature/UI → host adapter → Express API → server auth/security → optional data, media, or external service**. Static hosting stops at the bundled frontend and curated edition; it does not pretend server APIs are available.

### Invariants and side effects

- Browser bundles contain no server credentials; auth tokens are verified before protected writes.
- Public media paths are resolved from Vite's configured base path; the lead image loads eagerly, while below-the-fold plates load lazily.
- API routes may write to Neon, R2, Firebase, or Resend only when those integrations are configured.
- `bun run lint`, `bun run test`, `bun run build`, `bun audit --production --audit-level=high`, and `bunx tsx scripts/verify-all-services.ts` cover the source and service contracts.

## Run locally

Requirements: Node.js 22 or later and Bun 1.4 or later.

```sh
bun install --frozen-lockfile
Copy-Item .env.example .env
bun run dev
```

The UI can be explored without paid AI services. Configure only the services you use. Never put server secrets in a `VITE_` variable. The Firebase browser config contains a public API key; protect its data with Firebase Security Rules and restrict the key in Google Cloud.

## Authentication and security

The frontend presents Clerk sign-in when both `VITE_CLERK_PUBLISHABLE_KEY` and server-side `CLERK_SECRET_KEY` are set. The backend verifies Clerk sessions before reader mutations. Without those keys, the Firebase sign-in UI is used; server routes verify Firebase ID token signature, issuer, audience, expiry, and verified-email status. Firestore access is denied by default and scoped to the authenticated owner in `firestore.rules`.

Mutating API routes enforce same-origin checks, schema validation, request-size limits, rate limits, and server-only credentials. R2 upload grants are short-lived and restrict content types and size. Neon, R2, Gemini, Resend, Clerk, and cron secrets belong in each host's secret/environment-variable manager; do not commit `.env` files.

## Verify

```sh
bun run lint
bun test
bun run build
```

## Hosting

### Verified live URLs

| Provider | URL | Verification |
| --- | --- | --- |
| GitHub Pages | [https://kalyan870.github.io/the-kalyan-chronicle/](https://kalyan870.github.io/the-kalyan-chronicle/) | HTTP 200; publish workflow passed for `77577b2`. |
| Vercel | [https://kalyan-chronicle.vercel.app/](https://kalyan-chronicle.vercel.app/) | HTTP 200 on 2026-11-24. |
| Netlify | [https://the-kalyan-chronicle.netlify.app/](https://the-kalyan-chronicle.netlify.app/) | HTTP 200 on 2026-11-24. |

### Other deployment targets

| Host | Deployment shape | Notes |
| --- | --- | --- |
| Cloudflare Pages | Static frontend | Opt-in workflow requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the `CLOUDFLARE_PAGES_PROJECT` repository variable. No live Pages URL is configured. Pages does not run this Express server, so API routes need a compatible API origin. |
| GitHub Pages | Static Vite/PWA frontend | Live link above; server API features need an external API deployment. |

Provider workflows require secrets before they can publish. A workflow/build passing alone is not treated as a live deployment; the provider URL must respond.

## Environment variables

See `.env.example` for the full set. Minimum server-side auth options are either both Clerk keys or the Firebase project configuration already present in `firebase-applet-config.json`. Add `GEMINI_API_KEY`, `DATABASE_URL`, R2 credentials, and email/cron credentials only when enabling those services.
