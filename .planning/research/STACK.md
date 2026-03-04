# Technology Stack

**Project:** DeltaFlow — Personal Finance PWA (Venezuelan multi-currency market)
**Researched:** 2026-03-04
**Research mode:** Training data only (web tools restricted). Confidence levels reflect this limitation.

---

## Important Confidence Note

Web search and WebFetch were unavailable during this research session. All version numbers and library recommendations are based on training data with cutoff August 2025. Before starting development, verify current versions of each library via `npm info [package] version` or the official changelog. Flags are placed inline where verification is most critical.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x (verify — was released Oct 2024) | App framework, routing, API routes, SSR/SSG | Vercel-optimized, App Router is the current standard. Next.js 15 is stable as of late 2024 with React 19 support. Project specifies "14" but 15 is current — **upgrade recommended before build starts.** |
| React | 19.x | UI runtime | Ships with Next.js 15. Required for new hooks (useFormStatus, useOptimistic) that improve offline-first UX patterns. |
| TypeScript | 5.x | Type safety | Project-specified. Current major is 5.x; no reason to stay on 4.x. |

**Confidence:** MEDIUM — Next.js 15 was stable at training cutoff. Verify current patch version.

**Note on "Next.js 14" in PROJECT.md:** The project specifies Next.js 14 (App Router) but this was released Oct 2023. Next.js 15 shipped Oct 2024 with important improvements: stable React 19, improved caching defaults (fetch is no longer cached by default — which matters for exchange rate freshness), and better Partial Prerendering. **Recommend upgrading to Next.js 15 before first commit.**

---

### Styling and UI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first styling | Tailwind v4 released early 2025, significant rewrite — uses CSS-first config (no tailwind.config.js). Faster build times. Project specifies Tailwind without version; **use v4 unless shadcn/ui compatibility is confirmed.** |
| shadcn/ui | Latest (no npm package — copy-paste model) | Component library | Project-specified. Not a versioned dependency — you `npx shadcn@latest init` and components are copied into your codebase. This means no version lock issues. Uses Radix UI primitives under the hood. |
| Radix UI | (transitive via shadcn) | Accessible headless primitives | Included automatically by shadcn. Do not import directly unless extending. |
| Recharts | 2.x | Chart library | Project-specified for spending visualizations. Recharts 2.x is React 18 compatible; verify React 19 compatibility before use. Alternative: `tremor` (built on Recharts, more opinionated) or `chart.js` via `react-chartjs-2`. |

**Confidence:** MEDIUM for Tailwind v4 (was in active release at training cutoff). LOW for Recharts/React 19 compat — verify.

**Critical Tailwind v4 Warning:** shadcn/ui had ongoing compatibility work with Tailwind v4 at training cutoff. If shadcn/ui's `init` command does not yet support Tailwind v4 fully, stay on Tailwind v3 (3.4.x). Check `npx shadcn@latest` output on init. Do not mix v3 and v4 config patterns.

---

### Database and Backend

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | Free tier (hosted) | PostgreSQL + Auth + Realtime | Project-specified. Free tier provides: 500MB database, 50MB file storage, 50,000 MAU auth, 2GB bandwidth. Sufficient for MVP with <500 users. |
| `@supabase/supabase-js` | 2.x | JS client | Use v2 (current). Provides typed client generation from your schema. |
| `@supabase/ssr` | Latest | Next.js App Router integration | Required for correct cookie-based auth in Next.js App Router. Replaces the deprecated `@supabase/auth-helpers-nextjs`. **Do not use auth-helpers — it is deprecated.** |
| Next.js API Routes | (built-in) | Server-side logic, scraping, rate aggregation | Used for BCV scraping proxy (to avoid CORS) and exchange rate caching. |

**Confidence:** HIGH for Supabase JS v2. MEDIUM for free tier limits (verify current limits at supabase.com/pricing — these changed in 2024).

**Supabase Free Tier Constraints for DeltaFlow:**
- Projects on free tier pause after 1 week of inactivity — implement a lightweight keep-alive ping (cron via Vercel) if needed during development.
- 500MB DB is generous for personal finance data (text + numbers). A single user with 10 years of daily transactions is ~5MB.
- Realtime connections: 200 concurrent on free tier. Sufficient for MVP.
- Row-level security (RLS) is mandatory — every table needs a policy or data is inaccessible by default.

---

### Authentication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Auth | (built into `@supabase/ssr`) | Email magic links | Project-specified. Magic links require zero password management, no reset flows. Works well for the target audience (tech-savvy professionals). |

**What NOT to use:** Do not add NextAuth.js / Auth.js. It adds complexity and a separate session store. Supabase Auth with `@supabase/ssr` is the correct choice for this Supabase-native stack.

---

### PWA and Offline Support

This is the highest-risk area for the stack — getting this wrong means a rewrite.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `next-pwa` | **DO NOT USE** | — | Unmaintained. Last release was 2022. Incompatible with Next.js App Router. |
| `@ducanh2912/next-pwa` | 10.x | Service worker, PWA manifest | Community-maintained fork of `next-pwa`, App Router compatible. Wraps Workbox. Active maintenance as of 2024. |
| Workbox | (via next-pwa wrapper) | Cache strategies, offline queuing | Google's service worker library. Powers the offline cache strategies. |

**Confidence:** MEDIUM for `@ducanh2912/next-pwa` — this was the recommended App Router solution at training cutoff. Verify current maintenance status.

**Alternative to consider:** Build a custom `next.config.js` + `public/sw.js` using Workbox directly (no wrapper). More work but no dependency on a third-party fork. For a personal project on free infrastructure, the fork is acceptable.

**PWA Strategy for DeltaFlow (prescriptive):**

```
Cache Strategy: Stale-while-revalidate for app shell
Offline Queue: Background sync for transaction creation
Exchange Rates: Cache last-known rates with timestamp; show staleness indicator
Manifest: Add to home screen, standalone display, theme color matching app design
```

**Service Worker Cache Tiers:**

1. **App shell (HTML, JS, CSS)** — Cache-first. These never change between deploys.
2. **Exchange rate API responses** — Network-first with 1-hour TTL cache fallback. Show "last updated X minutes ago" when serving from cache.
3. **Transaction POST requests** — Background sync queue. If offline, queue the request and replay when connection restores.
4. **Supabase reads (transaction list)** — Cache-first with background revalidation. User sees stale data instantly, fresh data loads silently.

**manifest.json required fields for Android PWA:**
```json
{
  "name": "DeltaFlow",
  "short_name": "DeltaFlow",
  "display": "standalone",
  "start_url": "/",
  "background_color": "#...",
  "theme_color": "#...",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
The `maskable` icon is required for Android adaptive icons.

---

### Exchange Rate Fetching

This is the most Venezuela-specific and technically unique part of the stack.

| Source | Method | Library | Notes |
|--------|--------|---------|-------|
| BCV (Banco Central de Venezuela) | Web scraping | `cheerio` + `node-fetch` (or native `fetch`) | BCV publishes rates on bcv.org.ve — HTML scraping only. Run in a Next.js API route (server-side) to avoid CORS. |
| Binance | REST API | Native `fetch` | Public endpoint: `https://api.binance.com/api/v3/ticker/price?symbol=USDTVES` (or USDTUSDT as anchor). No API key required for public price data. |
| CoinGecko | REST API | Native `fetch` | Free tier: 30 calls/minute, 10,000 calls/month. More than sufficient for hourly polling. Use `/simple/price` endpoint. No API key required for free tier. |

**Recommended scraping library:**

| Library | Why |
|---------|-----|
| `cheerio` 1.x | jQuery-like HTML parsing, runs in Node.js (Next.js API routes), lightweight. No browser required. |

**Do NOT use:** Puppeteer / Playwright for BCV scraping. Both require a headless browser — incompatible with Vercel serverless function limits (250MB zip size limit, ephemeral filesystem). If BCV changes their markup and cheerio fails, the fallback is `@extractus/article-extractor` or regex on the raw HTML.

**BCV Scraping Architecture:**

```
Vercel Cron Job (hourly)
  → Next.js API Route /api/rates/refresh
    → Scrape BCV (cheerio)
    → Fetch Binance USDT/VES
    → Fetch CoinGecko BTC/USD, ETH/USD
    → Write to Supabase `exchange_rates` table
    → Supabase Realtime broadcasts rate update to connected clients
```

**Vercel Cron on Free Tier:** Free tier supports cron jobs at minimum 1-hour intervals. This matches the project requirement of hourly rate updates.

**Rate caching in Supabase schema:**
```sql
CREATE TABLE exchange_rates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  currency text NOT NULL,        -- 'USD', 'EUR', 'BTC', 'ETH', 'USDT'
  rate_ves numeric NOT NULL,     -- rate in VES
  source text NOT NULL,          -- 'bcv', 'binance', 'coingecko'
  fetched_at timestamptz DEFAULT now(),
  is_parallel boolean DEFAULT false  -- true for parallel/Binance rate vs BCV official
);
```

**Confidence:** HIGH for Binance/CoinGecko API approach. MEDIUM for BCV cheerio scraping (BCV's HTML structure can change — needs a resilience strategy). LOW for Vercel cron free tier specifics — verify at vercel.com/docs/cron-jobs.

---

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Context + `useReducer` | (built-in React) | Local UI state (currency selector, filter state) | No external state library needed for MVP. |
| TanStack Query (React Query) | 5.x | Server state, cache, background refetch | For fetching transactions and exchange rates on the client. Handles stale-while-revalidate, background sync, and retry logic out of the box. Better than raw `useEffect` + `fetch`. |
| Zustand | 5.x | Optional: offline queue state | Only add if TanStack Query's built-in mutation queuing is insufficient for offline scenario. Do not add speculatively. |

**What NOT to use:** Redux / Redux Toolkit — significant boilerplate overhead for a personal finance app with straightforward data models. Not worth it.

**Confidence:** HIGH for TanStack Query v5 (stable, widely adopted).

---

### Forms

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Hook Form | 7.x | Transaction entry form, category management | Best-in-class form performance (uncontrolled inputs). Less re-renders than Formik. |
| Zod | 3.x | Schema validation | Pairs with React Hook Form via `@hookform/resolvers`. Also used for validating exchange rate API responses (defensive coding). |

**Confidence:** HIGH for both — stable, mature libraries.

---

### Date and Number Handling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `date-fns` | 3.x | Date formatting, relative time | Lightweight, tree-shakeable, locale-aware. Venezuela uses es-VE locale. Do NOT use `moment.js` (deprecated). |
| Native `Intl.NumberFormat` | (browser built-in) | Currency formatting | Use `Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' })` for VES display. For USD/EUR/BTC, use appropriate locale. No library needed. |

**Multi-currency number display:** BTC and ETH have 8+ decimal places. `Intl.NumberFormat` handles this via `maximumFractionDigits`. USDT should display like USD (2 decimal places).

**Confidence:** HIGH for both.

---

### Hosting and Deployment

| Technology | Purpose | Free Tier Limit | Notes |
|------------|---------|-----------------|-------|
| Vercel | Next.js hosting, serverless functions, cron | 100GB bandwidth/month, 100 deployments/day, 10s function timeout | **10-second timeout is critical** — BCV scraping must complete within 10s or use Edge runtime (30s max). |
| Supabase | DB + Auth + Realtime | 500MB DB, 50MB storage, 50K MAU, 2GB bandwidth | Pauses after 1 week inactivity on free tier. |

**Vercel Function Timeout Mitigation for BCV Scraping:**

The BCV website can be slow (Venezuelan infrastructure). If a single scraping call takes >8s, the Vercel function will timeout. Options:
1. Use `next.config.js` to set the function to run on Edge runtime (30s timeout) — but Edge does not support Node.js APIs. `cheerio` requires Node.js. Not compatible.
2. Keep scraping in Node.js runtime, set aggressive timeouts on the `fetch` call (5s), and return stale data if scraping fails.
3. Use Supabase Edge Functions (Deno) for the cron job instead of Vercel API routes — Supabase Edge Functions have a longer execution window and the project already uses Supabase.

**Recommendation:** Start with Vercel API route + 5s fetch timeout. If BCV timeouts become frequent, migrate to Supabase Edge Function for the rate refresh job.

**Confidence:** MEDIUM for timeout specifics — verify current Vercel free tier function limits.

---

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | 2.x | Unit and integration tests | Fast, Vite-native, compatible with Next.js projects. Better DX than Jest for modern setups. |
| `@testing-library/react` | 16.x | Component testing | Standard for React component tests. |
| Playwright | 1.x | E2E tests | For critical flows: transaction creation, offline behavior, PWA install. |

**Note:** Testing is explicitly not in v1 scope per PROJECT.md but the stack should not block it. Vitest + Testing Library requires zero configuration changes to the recommended stack.

---

## Alternatives Considered

| Category | Recommended | Alternative Considered | Why Not |
|----------|-------------|----------------------|---------|
| Framework | Next.js 15 | Remix / SvelteKit | Project constraint specifies Next.js. Also: Vercel is Next.js-optimized, no benefit to switching. |
| Database | Supabase | PlanetScale, Neon, Firebase | Supabase gives DB + Auth + Realtime in one free-tier product. Firebase is NoSQL (worse for financial data). PlanetScale/Neon don't include auth. |
| UI Components | shadcn/ui | Mantine, Chakra UI, Ant Design | shadcn copies components into your codebase (no bundle bloat from unused components). Best fit for mobile-optimized, custom-branded UI. |
| Charts | Recharts | Chart.js, Victory, D3 | Project-specified. Recharts is React-native (not a wrapper). Lightweight enough for mobile. |
| PWA Layer | @ducanh2912/next-pwa | Custom service worker | Fork is maintained and saves significant boilerplate. Custom SW gives more control but requires deep Workbox knowledge. |
| State | TanStack Query | SWR | TanStack Query v5 is more full-featured (mutations, offline, devtools). SWR is simpler but lacks offline queue support needed here. |
| Scraping | cheerio | Playwright/Puppeteer | Cheerio is serverless-compatible. Puppeteer requires a headless browser — impossible on Vercel. |
| Forms | React Hook Form | Formik, native forms | RHF is faster (uncontrolled), better maintained, and integrates cleanly with Zod. |

---

## Complete Package List

### Production Dependencies
```bash
# Core framework (verify version on init)
npm install next@latest react@latest react-dom@latest

# TypeScript
npm install -D typescript @types/node @types/react @types/react-dom

# Styling
npm install tailwindcss @tailwindcss/postcss postcss
# Tailwind v4 ships differently — use: npx @tailwindcss/cli init

# shadcn/ui (not npm — use CLI)
npx shadcn@latest init

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Data fetching / server state
npm install @tanstack/react-query

# Forms + validation
npm install react-hook-form zod @hookform/resolvers

# Charts
npm install recharts

# Date utilities
npm install date-fns

# HTML scraping (for BCV rate)
npm install cheerio

# PWA (verify compatibility with your Next.js version)
npm install @ducanh2912/next-pwa
```

### Dev Dependencies
```bash
npm install -D \
  eslint \
  eslint-config-next \
  prettier \
  prettier-plugin-tailwindcss \
  vitest \
  @testing-library/react \
  @testing-library/jest-dom \
  @vitejs/plugin-react
```

---

## Version Verification Checklist

Before starting development, run these checks:

```bash
# Check current stable versions
npm info next version
npm info @supabase/supabase-js version
npm info @supabase/ssr version
npm info @tanstack/react-query version
npm info react-hook-form version
npm info zod version
npm info cheerio version
npm info @ducanh2912/next-pwa version
npm info recharts version
npm info date-fns version
```

**Highest priority to verify:**
1. `@ducanh2912/next-pwa` — active maintenance, Next.js 15 compatibility
2. `recharts` — React 19 compatibility
3. Tailwind CSS v4 vs v3 — shadcn/ui compatibility
4. Supabase free tier inactivity pause behavior

---

## Key Decisions Not in PROJECT.md

### 1. Next.js 14 → 15 Upgrade Recommended
PROJECT.md specifies Next.js 14 but 15 is stable. The caching behavior change in Next.js 15 (no default fetch caching) is actually better for exchange rate freshness. Migrate now before building.

### 2. BCV Scraping Resilience
BCV's site is unstable. The scraping layer needs:
- A 5-second fetch timeout (abort if BCV is slow)
- Try/catch with fallback to last known rate in Supabase
- Staleness indicator in the UI (show "BCV rate from 3 hours ago")
- Consideration: Add `paralelo` rate from an alternative source (ExchangeRate monitor sites) as a secondary BCV parallel rate source

### 3. Offline Transaction Queue
Do not rely only on the service worker's Background Sync API — browser support is inconsistent on iOS WebKit (Safari). Implement a dual strategy:
- **IndexedDB queue** (via `idb` or `dexie.js`) for offline transactions
- **Service worker Background Sync** as enhancement when available
- On reconnect, flush the IndexedDB queue via a Supabase batch insert

```bash
# For IndexedDB offline queue
npm install dexie
```

### 4. Venezuelan Market: Two Exchange Rates Matter
The app needs to track both:
- **BCV official rate** (used for legal/formal transactions, typically undervalued)
- **Parallel market rate** (Binance USDT/VES = the real rate Venezuelans use)

The database schema and UI must distinguish which rate was used for each transaction's conversion. This is a data integrity requirement, not a feature.

---

## Sources

- Next.js changelog: https://nextjs.org/blog (training data through Aug 2025)
- Supabase documentation: https://supabase.com/docs (training data)
- @ducanh2912/next-pwa: https://github.com/ducanh2912/next-pwa (training data)
- TanStack Query docs: https://tanstack.com/query/latest (training data)
- Dexie.js (IndexedDB): https://dexie.org (training data)
- BCV website: https://www.bcv.org.ve (structure subject to change)
- Binance public API: https://api.binance.com/api/v3/ticker/price (no auth required)
- CoinGecko API: https://api.coingecko.com/api/v3/simple/price (free tier, 30 req/min)
- Vercel cron jobs: https://vercel.com/docs/cron-jobs (verify free tier limits)

**All sources: MEDIUM confidence (training data, web tools unavailable). Verify versions before building.**
