# Project Research Summary

**Project:** DeltaFlow — Personal Finance PWA (Venezuelan multi-currency market)
**Domain:** Mobile-first personal finance with offline-first architecture and live exchange rate integration
**Researched:** 2026-03-04
**Confidence:** MEDIUM (web tools unavailable; all findings from training data through Aug 2025 — verify versions before building)

## Executive Summary

DeltaFlow is a specialized personal finance tracker built for the Venezuelan economic reality: dual exchange rates (BCV official vs. parallel market), rampant VES inflation, unreliable internet, and a user base that transacts daily across USD cash, USDT, Zelle, pagomovil, and VES simultaneously. The research confirms that no existing consumer finance app addresses this combination of requirements. Building DeltaFlow correctly means treating the Venezuelan context as a first-class constraint, not an afterthought — the data model, offline architecture, and rate infrastructure must all reflect this from day one or the app will require a rewrite.

The recommended approach is a client-heavy PWA on Next.js 15 + Supabase + Vercel, with three technical pillars that must be built in strict dependency order: (1) a server-side rate aggregation layer (BCV scraping + Binance + CoinGecko, cached in Supabase), (2) a dual-currency transaction schema that snapshots the exchange rate at write time, and (3) an IndexedDB offline queue with UUID-based idempotency for reliable offline sync. The stack is deliberately lean — no Redux, no complex state management, no bank sync — because the Venezuelan market requires simplicity and speed on mid-range Android hardware.

The top risks are not architectural but operational: BCV's HTML scraper will break without a fallback strategy, JavaScript floating-point arithmetic will corrupt financial totals without `decimal.js`, and naive PWA service worker setup for Next.js App Router will break offline behavior entirely. Each of these pitfalls has a clear prevention path, but all three must be addressed in Phase 1, before any user-facing code is written. The rate snapshot on transactions and the client-generated UUID idempotency pattern are data model decisions that cannot be retrofitted — they must be in the schema from the first migration.

---

## Key Findings

### Recommended Stack

DeltaFlow's stack is Next.js 15 (App Router) + React 19 + TypeScript 5 + Tailwind CSS + shadcn/ui on the front end, with Supabase (PostgreSQL + Auth + Realtime) as the sole backend service and Vercel as the host. The project's `PROJECT.md` specifies Next.js 14, but Next.js 15 is the current stable release and its changed caching defaults (fetch is no longer cached by default) are actually more appropriate for exchange rate freshness. Upgrading to Next.js 15 before the first commit is recommended.

The most technically distinctive parts of the stack are the exchange rate layer and the offline queue. For rates: `cheerio` + native `fetch` in a Next.js API route handles BCV HTML scraping; Binance public REST API provides parallel market USDT/VES; CoinGecko provides BTC/ETH in USD (multiplied by Binance USDT/VES to derive VES equivalents). All three are cached in a Supabase `exchange_rates` table and refreshed by a Vercel cron job every hour. For offline: `dexie.js` (IndexedDB wrapper) queues transactions locally when offline, synced to Supabase on reconnect using client-generated UUIDs to prevent duplicates. Background Sync API is explicitly avoided due to unreliable iOS WebKit support.

**Core technologies:**
- **Next.js 15 (App Router):** Framework, routing, API routes, SSR — Vercel-optimized; App Router is the current standard
- **React 19 + TypeScript 5:** UI runtime with full type coverage — ships with Next.js 15
- **Tailwind CSS + shadcn/ui:** Utility styling + accessible component primitives — shadcn copies components into codebase (no bundle bloat)
- **Supabase (PostgreSQL + Auth + Realtime):** Single free-tier product covering DB, magic link auth, and Realtime broadcast
- **`@supabase/ssr`:** Required for correct cookie-based auth in App Router — replaces deprecated `auth-helpers-nextjs`
- **TanStack Query v5:** Server state, cache, background refetch — handles stale-while-revalidate and retry logic
- **React Hook Form + Zod:** Form performance and schema validation — used for transaction entry and API response validation
- **`cheerio`:** Lightweight HTML scraping for BCV rate — compatible with Vercel serverless (unlike Puppeteer)
- **`dexie.js`:** IndexedDB wrapper for offline transaction queue — clean version/migration API
- **`decimal.js`:** Arbitrary-precision arithmetic for all financial calculations — mandatory to prevent floating-point drift
- **`date-fns` 3.x:** Date formatting with `es-VE` locale — tree-shakeable, no Moment.js
- **Serwist (via `@ducanh2912/next-pwa`):** App Router-compatible PWA service worker — original `next-pwa` is abandoned and incompatible
- **Vercel (Hobby):** Hosting with 1 cron job/hour on free tier — cron used for rate refresh + Supabase keep-alive

**Critical version verifications needed before build:**
- `@ducanh2912/next-pwa` — confirm Next.js 15 compatibility
- `recharts` — confirm React 19 compatibility
- Tailwind CSS v4 — confirm shadcn/ui `init` compatibility (may need to stay on v3)
- Supabase free tier pause behavior and connection limits (known to change)
- Vercel Hobby plan function timeout (research says 10s — verify)

### Expected Features

The Venezuelan user context drives every priority. Users transact across 6+ payment rails daily, operate under two official/parallel rates simultaneously, and cannot rely on stable internet. Features that feel optional in other markets (offline entry, parallel rate display, rate-at-transaction-time storage) are table stakes here.

**Must have (table stakes):**
- Multi-currency transaction entry (USD, VES, USDT; EUR, BTC, ETH secondary) — per-transaction currency, not per-account
- BCV rate display with source timestamp — legal/official reference; every Venezuelan checks it daily
- Parallel (dolar paralelo) rate display — the actual rate used in 80%+ of commerce; Binance USDT/VES as source
- Exchange rate auto-refresh (hourly) with "last updated" display — rates change intraday during volatile periods
- Offline transaction entry with sync — unreliable internet is a structural constraint, not an edge case
- Quick-add transaction (FAB, minimal fields) — point-of-sale speed on mobile is critical
- Transaction history with filter by currency and category
- Basic monthly spending summary (totals by currency)
- PWA installability (manifest, service worker, HTTPS)
- Magic link authentication — no passwords
- Mobile-optimized numeric input (type="decimal")

**Should have (differentiators — build within v1 at low cost):**
- Rate-at-transaction-time storage — schema decision that must happen in v1 or v2 is a rewrite
- BCV vs. parallel rate delta indicator — one line of math, high user value
- Rate source transparency labels (BCV / Binance / CoinGecko) on every displayed rate — builds trust
- Payment method tagging per transaction (Zelle, efectivo USD, USDT, pagomovil, bolivares efectivo, transferencia)
- Income tracking (same UI as expenses, opposite sign)
- Quick currency converter widget — high daily-use driver, very low complexity

**Defer to v2+:**
- Rate change push notifications (requires push permission UX + service worker plumbing)
- Current-rate vs. at-time-rate toggle on dashboard (useful but adds UI complexity)
- Full analytics, charts, month-over-month comparison
- CSV/PDF export
- Budget alerts and projections
- Crypto portfolio/investment tracking (explicitly out of scope in PROJECT.md)
- Recurring transaction automation

### Architecture Approach

DeltaFlow is a client-heavy PWA with a thin serverless backend: Next.js App Router handles routing and API routes on Vercel; Supabase handles persistence and auth; a Serwist service worker with an IndexedDB queue handles offline. The key architectural constraint is that all rate fetching and scraping must be server-side only — the client never calls BCV, Binance, or CoinGecko directly. This protects free-tier API limits, prevents CORS issues with BCV, and centralizes rate freshness logic.

The data model has two non-negotiable design decisions that cannot be changed after data is stored: (1) every transaction stores both the original currency/amount AND a VES snapshot at write time (with the rate and source recorded), and (2) every transaction is assigned a client-generated UUID before any network call, enabling idempotent insert-on-conflict for safe offline sync retries.

**Major components:**
1. **Service Worker (Serwist)** — Caches app shell (StaleWhileRevalidate), API routes (NetworkFirst), and static assets (CacheFirst); does NOT handle transaction sync directly
2. **Offline Queue (Dexie/IndexedDB)** — Stores pending transactions as structured objects with `client_id`, drains on `window.online` event, retries safely via UUID dedup
3. **Rate Aggregator (`/api/rates` + `/api/rates/refresh`)** — Server-side only; scrapes BCV, fetches Binance/CoinGecko, upserts to Supabase `exchange_rates` table; Vercel cron triggers hourly
4. **Transaction API (`/api/transactions`)** — Server-side rate lookup at write time; computes `amount_ves` and `rate_at_time` before insert; `ON CONFLICT (client_id) DO NOTHING` for idempotency
5. **Supabase (PostgreSQL + RLS)** — Two primary tables: `exchange_rates` (upserted hourly, one row per currency/source pair) and `transactions` (user-scoped via RLS, dual-currency columns)
6. **Next.js App Router pages** — Auth-gated routes via middleware; `useExchangeRates` hook polls `/api/rates` every 60 minutes; `useOfflineSync` hook drains IndexedDB queue on reconnect

**Key patterns confirmed by research:**
- Store original currency + VES snapshot (never recalculate historical values from current rates)
- Client-generated UUIDs for offline dedup (`UNIQUE(client_id)` + `ON CONFLICT DO NOTHING`)
- Rate aggregator behind internal API route (client never calls external APIs)
- Optimistic UI for transaction submission (instant feedback on slow connections)
- Poll `/api/rates` every 60 min — do not use Supabase Realtime for rates (free tier limits 2 concurrent connections)

### Critical Pitfalls

1. **Floating-point arithmetic in financial calculations** — Use `decimal.js` for all financial math without exception; store as `NUMERIC(24, 8)` in Postgres (never `FLOAT`); any `parseFloat()` in financial code is a bug. Must be addressed in Phase 1 data model.

2. **BCV scraping fragility without fallback** — BCV's HTML structure changes without notice; scraper must always fall back to last-known-good rate in Supabase; always store `scraped_at` and show staleness in UI; implement exponential backoff; never call BCV from user-facing requests. Must be designed in Phase 1 before the scraper is written.

3. **Supabase free tier connection exhaustion** — Use the Supabase pooler connection string (port 6543), never the direct Postgres connection (port 5432), in all Vercel serverless functions. Initialize the client at module scope, not inside request handlers. Must be configured from day one.

4. **Next.js App Router PWA service worker conflicts** — Original `next-pwa` is incompatible with App Router RSC payloads and will silently serve stale content or break navigation. Use `@ducanh2912/next-pwa` or `serwist/next` only. Register service worker in a `"use client"` component. Test offline mode after every deployment.

5. **Offline transaction sync duplication** — Naive IndexedDB-to-POST sync creates duplicate transactions when POST succeeds on server but client loses connection before receiving the 200. Fix: client-generated UUIDs + `ON CONFLICT (client_id) DO NOTHING` on insert. This is a schema constraint that must exist before any offline code is written.

---

## Implications for Roadmap

The architecture research defines a clear build order based on component dependencies. The schema and infrastructure must be correct before any user-facing code is written, because RLS policies, rate snapshots, and UUID idempotency cannot be retrofitted without data migrations.

### Phase 1: Foundation — Schema, Auth, and Rate Infrastructure

**Rationale:** Everything else depends on these three components. Supabase schema with RLS determines the security model; changing it after data exists requires migrations and risk. Auth must be working before any user-scoped data can be tested. The rate aggregator must be working before transaction creation (which reads rates at write time). All critical pitfalls (floating-point, BCV fallback, connection pooling, rate snapshots) must be addressed here — they cannot be added later.

**Delivers:** Working Supabase schema with RLS, magic link auth flow, rate aggregation endpoint with BCV/Binance/CoinGecko, Vercel cron for hourly refresh, Supabase keep-alive ping, rate display UI (BCV + parallel + delta indicator)

**Addresses features:** BCV rate display, parallel rate display, exchange rate auto-refresh, magic link authentication, rate source transparency

**Must avoid:** Floating-point in schema (use NUMERIC), direct Postgres connection in serverless (use pooler), missing rate snapshot columns, BCV scraping without fallback, Supabase project pausing (set up keep-alive in this phase)

**Research flag:** NEEDS RESEARCH — BCV HTML structure should be inspected before writing the scraper; Binance USDT/VES pair availability should be verified live

### Phase 2: Core Transaction Experience (Online)

**Rationale:** With schema and rates working, transaction creation and history are buildable. The rate aggregator is already producing data that the transaction write handler needs. This phase establishes the full online happy path before offline complexity is added.

**Delivers:** Transaction entry form (quick-add FAB, multi-currency, payment method field, income/expense type), transaction history list with filters, basic monthly spending summary, quick currency converter widget

**Uses:** React Hook Form + Zod (form validation), TanStack Query (server state and cache), shadcn/ui (accessible mobile-optimized components), `decimal.js` (all arithmetic), `Intl.NumberFormat('es-VE')` (VES display)

**Implements:** Transaction API route (`/api/transactions` with server-side rate lookup), optimistic UI pattern, `useExchangeRates` polling hook

**Avoids:** Client-side rate computation trusted by server (server always computes `amount_ves`), converting everything to VES at display time (store original), BCV scraping on every request

**Research flag:** Standard patterns — skip research-phase; React Hook Form + TanStack Query patterns are well-documented

### Phase 3: PWA Shell and Offline Support

**Rationale:** Offline is an enhancement layer on top of the existing transaction flow, not a foundation. Adding service worker complexity before the online flow works correctly creates debugging confusion. This phase adds installability and offline capability in the correct order: PWA shell first (service worker, manifest), then offline queue (IndexedDB), then sync logic.

**Delivers:** PWA installability (manifest, icons, standalone mode), Serwist service worker with correct caching strategies, IndexedDB offline transaction queue (Dexie.js), sync-on-reconnect with UUID dedup, offline status UI indicators, "saved offline" toast and sync status per transaction

**Uses:** `@ducanh2912/next-pwa` or `serwist/next` (App Router-compatible service worker), `dexie.js` (IndexedDB with versioned schema), `100dvh` for mobile viewport, `next-themes` with `enableSystem: true`

**Implements:** `useOfflineSync` hook (drains IndexedDB on `window.online` event), service worker registration in `"use client"` component, `StaleWhileRevalidate` for app shell, `NetworkFirst` for API routes

**Avoids:** Original `next-pwa` (abandoned, App Router incompatible), Background Sync API (no Safari support), missing maskable icon (breaks Android installability), `100vh` on mobile (address bar overflow), server-side SW registration

**Research flag:** NEEDS RESEARCH — Verify current Next.js 15 compatibility of `@ducanh2912/next-pwa` and confirm Serwist setup instructions match the current App Router conventions; test iOS PWA behavior

### Phase 4: Dashboard and Analytics

**Rationale:** Read-only aggregation on top of existing transaction data. Deferred until enough transactions exist to make charts meaningful. Recharts compatibility with React 19 must be confirmed before this phase begins.

**Delivers:** Spending dashboard with category breakdown, dual-currency totals (VES + USD side-by-side), monthly summary charts (bar/line via Recharts), BTC/ETH VES equivalents in summary

**Uses:** Recharts (project-specified; verify React 19 compat before this phase), `decimal.js` for aggregation math, TanStack Query for dashboard data fetching

**Avoids:** Recalculating historical transaction values with current rates (use stored `rate_at_time`), real-time Supabase subscriptions for rate display (polling is sufficient and free-tier safe)

**Research flag:** Standard patterns — skip research-phase; but verify Recharts React 19 compatibility before starting

### Phase Ordering Rationale

- Schema before auth before rates before transactions before UI: this is the strict dependency chain from ARCHITECTURE.md
- Offline after online: service workers debug much more cleanly when the underlying online path is verified first
- Dashboard last: it is pure aggregation on top of existing data with no new schema requirements
- Rate snapshot and UUID idempotency must be Phase 1 schema decisions — they require zero user-facing work but protect all subsequent phases from data integrity failures
- All critical pitfalls identified in PITFALLS.md cluster in Phase 1 — getting Phase 1 right is disproportionately important

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (BCV scraper):** BCV's current HTML structure must be inspected before writing the cheerio selectors; this is the highest operational risk in the project
- **Phase 1 (Binance pair):** Verify `USDTVES` is a valid ticker on Binance public API at build time — pairs can be delisted
- **Phase 3 (PWA compatibility):** Verify `@ducanh2912/next-pwa` supports Next.js 15 and that Serwist setup docs match current App Router behavior; iOS PWA behavior for offline queue needs explicit testing

Phases with standard patterns (skip research-phase):
- **Phase 2 (transaction CRUD):** React Hook Form + TanStack Query + Zod + Supabase CRUD are extremely well-documented; no research needed
- **Phase 4 (dashboard):** Recharts + aggregation queries are standard; only blocker is a version compat check before the phase starts

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core framework choices (Next.js, Supabase, TanStack Query) are HIGH confidence; PWA tooling (`@ducanh2912/next-pwa` vs Serwist) is MEDIUM — community-maintained, verify current status; Recharts React 19 compat is LOW — must verify before Phase 4 |
| Features | HIGH | Venezuelan market context (dollarization, dual rates, payment methods, offline need) is well-established economic reality; feature gap analysis (no existing app covers all four differentiators) is MEDIUM — competitor feature sets from training data only |
| Architecture | MEDIUM-HIGH | Data flow patterns (rate aggregator, offline queue, dual-currency schema) are established practices; specific Supabase free tier limits (connections, pausing policy) are MEDIUM — known to change, must verify before Phase 1 |
| Pitfalls | HIGH | Floating-point IEEE 754 behavior is immutable; UUID idempotency pattern is a distributed systems standard; BCV fragility is well-established operational reality; Next.js App Router service worker conflicts are documented community issues |

**Overall confidence:** MEDIUM — the research is directionally solid and the recommendations are internally consistent. The main uncertainty is in third-party library compatibility (PWA wrapper, Recharts, Tailwind v4 + shadcn) and infrastructure limits (Vercel timeout, Supabase connection cap) that require live verification before each phase begins.

### Gaps to Address

- **Tailwind CSS v4 vs v3 with shadcn/ui:** Research flags this as potentially requiring a stay on v3. Run `npx shadcn@latest init` on a blank project to verify before committing to v4. If v4 works, proceed; if not, pin Tailwind 3.4.x for the entire project.
- **Binance USDT/VES pair existence:** Run a live check against `https://api.binance.com/api/v3/ticker/price?symbol=USDTVES` before Phase 1. If the pair does not exist, alternative parallel rate sources (DolarToday API, manual aggregators) must be evaluated — this changes the rate architecture.
- **BCV HTML structure:** Write a throwaway script to fetch and inspect `bcv.org.ve` before writing the production scraper. Document the selectors in a comment with the date inspected. Add a format-change health check to detect selector drift early.
- **Vercel Hobby cron + function timeout:** Verify current limits at `vercel.com/docs/limits` before Phase 1 infrastructure setup. If the 10s timeout still applies and BCV is consistently slow from US servers, plan the Supabase Edge Function fallback immediately.
- **Supabase free tier inactivity pause:** Verify whether the "disable pausing" option exists in the current Supabase free tier dashboard. If not, the Vercel cron keep-alive ping is mandatory from Phase 1.
- **CoinGecko API key requirement:** Free-tier CoinGecko may now require a Demo API key (was optional at training cutoff). Verify before Phase 1 rate aggregator build — if a key is needed, set up the env variable and rate limit budget.

---

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` — project-defined constraints, technology choices, scope boundaries
- Venezuelan economic context (BCV dual-rate system, dollarization since 2019, USDT as digital USD) — well-established macroeconomic reality through training cutoff
- BCV rate scraping as only option — official site has no API; scraping is community-established practice
- IEEE 754 floating-point behavior — immutable specification
- UUID idempotency for distributed sync — standard distributed systems pattern

### Secondary (MEDIUM confidence)
- Next.js 15 changelog and App Router behavior — training data through Aug 2025
- `@supabase/ssr` for Next.js App Router auth — official Supabase recommendation
- `@ducanh2912/next-pwa` as App Router-compatible PWA wrapper — community recommendation as of 2024-2025
- Serwist as alternative PWA layer (referenced in Next.js official docs) — MEDIUM
- Dexie.js for IndexedDB with versioned schema — established library
- TanStack Query v5 for server state — stable, widely adopted
- Binance USDT/VES as parallel rate proxy — community practice in Venezuelan fintech ecosystem
- CoinGecko free tier (30 req/min, no key) — training data; verify current plan

### Tertiary (LOW confidence — verify before use)
- Vercel Hobby plan: 10s function timeout, 1 cron job minimum 1-hour frequency — training data; check `vercel.com/docs/limits`
- Supabase free tier: 60 direct connections, 7-day inactivity pause — training data; check `supabase.com/docs/guides/platform/quotas`
- Recharts React 19 compatibility — not verified; run `npm info recharts` and check React peerDeps before Phase 4
- Tailwind CSS v4 + shadcn/ui compatibility — was in active resolution at training cutoff; run `npx shadcn@latest init` to verify
- CoinGecko USDT/VES pair availability — training data; `https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ves` may not work; derive from USDT/USD × Binance USDT/VES as fallback

---
*Research completed: 2026-03-04*
*Ready for roadmap: yes*
