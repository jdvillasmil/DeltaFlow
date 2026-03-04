# Domain Pitfalls

**Domain:** Personal Finance PWA — Venezuelan multi-currency (VES/USD/crypto)
**Researched:** 2026-03-04
**Confidence note:** External tools (WebSearch, WebFetch, Bash) were unavailable during research. All findings are from training knowledge (cutoff August 2025). Confidence levels are lowered accordingly where live-doc verification was not possible.

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or project abandonment.

---

### Pitfall 1: Floating-Point Arithmetic in Financial Calculations

**What goes wrong:** JavaScript's native `number` type uses IEEE 754 double-precision floating point. Currency arithmetic accumulates rounding errors that become visible in financial totals. Classic examples: `0.1 + 0.2 === 0.30000000000000004`. For VES, which has very large nominal values (e.g., a transaction of Bs. 3,650,000), multiplied by crypto rates expressed in many decimal places (e.g., BTC at 0.0000000043 BTC/VES), compounding errors can produce meaningfully wrong balances.

**Why it happens:** Developers reach for `parseFloat()` and arithmetic operators habitually. The error is invisible in unit tests unless specifically tested at boundary values.

**Consequences:**
- Displayed balances differ by small amounts that grow over transaction history
- Currency conversion round-trips (VES → USD → VES) accumulate drift
- Tax or accounting exports are wrong — destroys user trust permanently
- Crypto denominations (8 decimal places) magnify the problem

**Prevention:**
- Use `decimal.js` or `big.js` for ALL financial arithmetic — no exceptions
- Store monetary values in PostgreSQL as `NUMERIC(24, 8)` — never `FLOAT` or `DOUBLE PRECISION`
- Store VES amounts as integer microbolívares (×1,000,000) to avoid decimals at the storage layer
- Establish a conversion layer: raw input → Decimal object → arithmetic → round to display precision → store as NUMERIC
- Write unit tests explicitly for `0.1 + 0.2`, large VES values, and crypto precision (8 decimal places)

**Detection (warning signs):**
- Any `parseFloat()` call in a file that does financial math
- Any PostgreSQL column typed `FLOAT`, `REAL`, or `DOUBLE PRECISION` storing money
- Balance totals that drift by small amounts when re-aggregated

**Phase to address:** Phase 1 (data model + transaction creation) — must be correct before any data is stored.

---

### Pitfall 2: BCV Scraping Fragility and No Fallback Strategy

**What goes wrong:** BCV (Banco Central de Venezuela) publishes official exchange rates on `bcv.org.ve` as rendered HTML — there is no official API. The page structure changes without notice, frequently and without announcement. Scrapers written against a specific DOM structure silently return `null`, `NaN`, or stale values when the HTML changes. Because the scrape happens server-side (Next.js API route or Vercel cron), a silent scrape failure means users see wrong rates with no indication.

**Why it happens:** Developers write a scraper that works today and ship it without any health-check or staleness detection. The BCV site also blocks aggressive scrapers (user-agent filtering, rate limiting, occasional CAPTCHA on some pages).

**Consequences:**
- App shows stale VES rates — users make real financial decisions on wrong data
- All automatic conversions silently compute incorrect amounts
- No error surfaced to user; they discover the problem through real-world discrepancy
- BCV site may temporarily block Vercel's IP range

**Prevention:**
- Parse the rate AND a timestamp from the BCV page; reject any scrape result older than 24 hours
- Store last-known-good rate in Supabase with `scraped_at` timestamp; always fall back to it on scrape failure
- Set realistic User-Agent header matching a real browser; rotate if needed
- Add a health-check API endpoint that alerts if `scraped_at` is > 2 hours old
- Display `scraped_at` prominently in UI so users can see rate freshness
- Implement exponential backoff: on scrape failure, retry at 5min, 15min, 60min — never hammer the server
- Consider `dolarapi.com` or similar aggregators as a secondary source if BCV is unreachable (verify their licensing terms)
- Do NOT scrape more than once per hour — BCV rates update at business hours only (not real-time)

**Detection (warning signs):**
- Scraper returns `null` or empty string with no exception thrown
- No `scraped_at` column in the rates table
- No monitoring/alerting on scrape success rate
- Cheerio/Playwright selector targeting a class like `div.tipo-cambio` without a version-pinned snapshot test

**Legal note:** Web scraping publicly available government data in Venezuela is in a legal gray zone, but BCV rates are public information used widely by apps and media. No enforcement action is known against public-rate scrapers (LOW confidence — no legal verification performed). The practical risk is technical (blocking), not legal for this use case.

**Phase to address:** Phase 1 (rate infrastructure) — design the fallback and staleness model before writing the first scraper.

---

### Pitfall 3: Supabase Free Tier Connection Exhaustion

**What goes wrong:** Supabase free tier provides a PostgreSQL database with a connection limit of 60 direct connections (as of mid-2025). Next.js serverless functions on Vercel create a new database connection per invocation. Under any meaningful traffic, the app exhausts Postgres connections and returns 500 errors to all users simultaneously.

**Why it happens:** Developers write standard `new Pool()` or `createClient()` calls inside API route handlers, which work fine in development (one persistent server) but create a new connection per cold-start in serverless.

**Consequences:**
- "too many connections" Postgres error under light-to-moderate traffic
- Difficult to reproduce in development; only surfaces in production
- Can cause cascading failures where all API routes fail simultaneously

**Prevention:**
- Use Supabase's built-in connection pooler (Supavisor) via the pooler connection string (port 6543), NOT the direct connection string (port 5432), for all serverless API routes
- The Supabase JS client (`@supabase/supabase-js`) handles pooling correctly when initialized via the service role key with the pooler URL
- Never use raw `pg` Pool inside serverless functions without the pooler
- Limit realtime subscriptions — each Realtime channel holds a connection; free tier limits to 200 concurrent realtime connections
- Keep Supabase client initialization outside the request handler (module scope) to reuse across warm invocations

**Detection (warning signs):**
- `FATAL: remaining connection slots are reserved` error in Supabase logs
- Direct Postgres connection string (port 5432) used in environment variables for serverless functions
- `pg.Pool` initialized inside an API route handler function body

**Phase to address:** Phase 1 (infrastructure setup) — use the correct connection string from day one.

---

### Pitfall 4: Next.js 14 App Router PWA Service Worker Conflicts

**What goes wrong:** Next.js 14's App Router uses React Server Components, streaming, and a complex caching system that conflicts with naive service worker implementations. `next-pwa` (based on Workbox) was designed for Pages Router and has known incompatibilities with App Router's RSC payload format and the `/_next/` chunk splitting behavior. Service workers that cache RSC payloads can serve stale server-rendered content indefinitely, or break navigation entirely after a deployment.

**Why it happens:** Developers copy PWA setup guides written for Next.js 12/13 Pages Router. `next-pwa` is the most-searched package but has incomplete App Router support. Service worker registration in App Router requires explicit handling through `layout.tsx` or a dedicated client component.

**Consequences:**
- Users see stale app version long after deployment (cached RSC payloads)
- Back/forward navigation breaks with cached fetch responses from previous builds
- Offline fallback serves wrong page shell
- PWA installability passes but offline mode fails silently on first use

**Prevention:**
- Use `@ducanh2912/next-pwa` (maintained fork of `next-pwa` with App Router support) or `serwist/next` as the PWA wrapper — not the original `next-pwa`
- Alternatively, write a minimal custom service worker using Workbox's `generateSW` mode, explicitly excluding `/_next/static/chunks/app/` RSC payloads from the runtime cache
- Cache strategy: `CacheFirst` for static assets (`/_next/static/`), `NetworkFirst` for page navigations, `StaleWhileRevalidate` for API routes that return exchange rates
- Register service worker from a Client Component (`"use client"`) in the root layout, not in a Server Component
- Test offline mode explicitly: DevTools → Network → Offline, then navigate to all key routes
- Implement a "new version available" banner using the service worker `waiting` event — don't rely on auto-update

**Detection (warning signs):**
- Using `next-pwa` (original) with Next.js 14 App Router without verifying App Router support
- `navigator.serviceWorker.register()` called in a Server Component
- No test of offline behavior after deployment (only tested in dev)
- Lighthouse PWA score passes but "works offline" check fails

**Phase to address:** Phase 2 (PWA shell + offline support) — get service worker strategy right before building offline transaction queue.

---

### Pitfall 5: Offline Transaction Sync Conflicts and Duplication

**What goes wrong:** When users add transactions offline (Venezuelan internet is unreliable), the local queue must sync to Supabase on reconnection. Naive implementations cause: (a) duplicate transactions if sync is retried after a partial success, (b) wrong transaction ordering because client timestamps differ from server `created_at`, (c) sync storms when many devices reconnect simultaneously after an outage.

**Why it happens:** Developers implement "save to IndexedDB, then POST on reconnect" without idempotency keys. If the POST succeeds on the server but the client loses connection before receiving the 200 response, the client retries and creates a duplicate.

**Consequences:**
- User's balance is wrong (higher than reality due to duplicate income, or lower due to duplicate expenses)
- Data corruption that requires manual correction — erodes trust catastrophically in a financial app
- Duplicates are hard to detect and merge after the fact

**Prevention:**
- Generate a UUID client-side at transaction creation time and use it as the `id` primary key (UUID v4/v7)
- INSERT with `ON CONFLICT (id) DO NOTHING` or `ON CONFLICT (id) DO UPDATE SET ...` — idempotent by design
- The client retries the same UUID; the server silently ignores duplicates
- Store `client_created_at` (device clock) and `server_created_at` (database `now()`) separately — use `client_created_at` for display ordering
- Implement sync status per transaction: `pending | syncing | synced | failed`
- Show sync status in UI — a pending indicator on each unsynced transaction makes the system legible
- Do not use Supabase Realtime for the sync mechanism — use explicit REST POST with idempotency

**Detection (warning signs):**
- Transaction IDs generated server-side (auto-increment or database UUID) instead of client-side
- No `ON CONFLICT` clause in the INSERT query
- No sync status tracking per transaction in IndexedDB
- Sync triggered by `online` event without deduplication logic

**Phase to address:** Phase 2 (offline support) — design idempotency model before writing any offline queue code.

---

## Moderate Pitfalls

### Pitfall 6: Vercel Hobby Plan Function Timeout on BCV Scrape

**What goes wrong:** Vercel Hobby (free) plan limits serverless function execution to 10 seconds (as of 2025). BCV's website can be slow (3-8 seconds response time from Vercel's US-based edge nodes, plus Venezuela's geographic latency). A Playwright/Puppeteer-based scraper that renders JavaScript adds another 5-10 seconds of headless browser startup. The function times out, returns a 504, and the rate update is silently dropped.

**Prevention:**
- Use a lightweight HTML-only scraper (Cheerio + `node-fetch`) — BCV's rate page is static HTML, no JavaScript rendering needed
- Pre-warm the scrape via a Vercel Cron Job (free tier allows 1 cron job, minimum 1-hour frequency on Hobby plan) and cache the result in Supabase
- The API route that clients call returns the cached Supabase value, not a live scrape — scraping only happens in the cron job
- Set a 6-second fetch timeout inside the scraper to fail fast and use cached value
- If the scraper must run on-demand, use Vercel Edge Functions (different execution model, no timeout limit but limited APIs) only for lightweight tasks

**Detection (warning signs):**
- Playwright or Puppeteer dependency in a Vercel serverless function
- BCV scrape called directly from a user-facing API route (not a background cron)
- No cached rate fallback — every request triggers a live scrape

**Phase to address:** Phase 1 (rate infrastructure) — architecture decision that prevents the timeout problem entirely.

---

### Pitfall 7: CoinGecko and Binance API Rate Limiting

**What goes wrong:** CoinGecko free tier (Demo plan) limits to 30 calls/minute as of 2025. Binance public API allows 1200 requests per minute but limits specific endpoints. If multiple users trigger rate fetches simultaneously (no shared cache), the app hits rate limits and returns stale or missing crypto rates.

**Why it happens:** Developers fetch rates per-user request instead of per-app. On a small app this seems fine until 10+ simultaneous users each trigger a rate check.

**Prevention:**
- Cache all external API rates in Supabase — the cron job fetches once per hour and stores in a `exchange_rates` table; all client requests read from Supabase, never from CoinGecko/Binance directly
- CoinGecko: fetch BTC/VES, ETH/VES, USDT/VES in a single API call using the `/simple/price` endpoint with multiple `ids` — do not make separate calls per coin
- Binance: use the `/api/v3/ticker/price` endpoint for USDT/VES pair if available, or derive from USDT/USD + BCV USD/VES
- Add a `Cache-Control: max-age=3600` response header on the internal rates API endpoint
- Implement exponential backoff with jitter on rate-limit errors (HTTP 429)

**Detection (warning signs):**
- External API call (CoinGecko/Binance URL) appearing in client-side code
- External API call triggered in a user-facing API route without checking a cache timestamp
- No `exchange_rates` table in the database schema

**Phase to address:** Phase 1 (rate infrastructure).

---

### Pitfall 8: Supabase Free Tier Project Pausing

**What goes wrong:** Supabase pauses free tier projects after 7 days of inactivity (no database queries). A paused project takes 30-60 seconds to resume on the next request, resulting in a cold-start failure that looks like a 500 error to users.

**Prevention:**
- Set up a Vercel cron job (the same one used for rate scraping) to ping the Supabase database at minimum once every 5 days via a simple `SELECT 1` health check query
- Alternatively, use the "disable pausing" option available in Supabase free tier settings (verify this option still exists — it was added in 2024)
- Display a loading state that handles slow first-response gracefully rather than timing out

**Detection (warning signs):**
- No cron job or scheduled activity keeping the database alive
- First request to app after days of inactivity returns 504 or connection timeout

**Phase to address:** Phase 1 (infrastructure) — set up the keep-alive cron at project start.

---

### Pitfall 9: VES Inflation Rate Drift Breaking UX

**What goes wrong:** VES experiences high inflation — the BCV rate changes daily and sometimes multiple times per day. Transactions recorded yesterday in VES have a different USD equivalent today. If the app recalculates historical USD value using today's rate, it shows the user that their yesterday-expense "increased" in USD, which is confusing and technically wrong.

**Why it happens:** Developers store transactions with only the nominal amount and no snapshot of the rate at transaction time, then compute USD value dynamically from current rates.

**Prevention:**
- Store the exchange rate AT transaction time as a snapshot column: `rate_at_time NUMERIC(24, 8)` and `rate_source VARCHAR` (BCV / Binance / CoinGecko)
- Historical views use the stored rate snapshot — never recompute historical values from current rates
- Current balance conversion uses current rates
- Show the user both: "original amount" and "current equivalent" where relevant
- This is also legally correct for accounting purposes in Venezuela

**Detection (warning signs):**
- No rate snapshot column in the transactions table
- Transaction display computes `amount / current_rate` for historical records

**Phase to address:** Phase 1 (data model) — the schema must include rate snapshots before any transactions are stored.

---

### Pitfall 10: Magic Link Auth UX Failure on Mobile in Venezuela

**What goes wrong:** Supabase magic links are sent via email. In Venezuela, email deliverability is poor (Gmail/Yahoo are common; corporate email is rare). More critically, magic links are single-use and expire in 1 hour. On slow/intermittent connections, users may: open the link after it expires, follow the link in a browser different from the one that initiated the flow (WhatsApp link preview), or receive the email after a long delay. This produces auth errors that are opaque to users.

**Prevention:**
- Set magic link expiry to maximum (24 hours) in Supabase Auth settings
- Configure the redirect URL to the app's PWA URL to ensure the link opens in the correct context
- Add a clear "check your spam folder / try again" UI with a resend button visible immediately after the link is sent
- Implement PKCE flow (Supabase default since 2024) — do not disable it — it prevents token interception in link preview scenarios
- Display the email address the link was sent to in the confirmation screen
- Test the flow explicitly on Android Chrome with a Gmail account under slow network (3G throttle in DevTools)

**Detection (warning signs):**
- Magic link expiry left at default 1 hour without explicit verification it works for target users
- No resend button in the auth UI
- PKCE disabled in Supabase Auth config

**Phase to address:** Phase 1 (auth) — test this flow with real users in Venezuela before other features are built.

---

## Minor Pitfalls

### Pitfall 11: Next.js 14 App Router Caching Over-Aggressiveness

**What goes wrong:** Next.js 14 App Router caches `fetch()` responses by default with `force-cache`. An API route that returns exchange rates gets cached at the CDN layer and serves stale rates to all users. This is the opposite of what financial data needs.

**Prevention:**
- Add `export const dynamic = 'force-dynamic'` or `export const revalidate = 0` to any route that returns live financial data
- Use `{ cache: 'no-store' }` option on any `fetch()` calls to external rate APIs inside Server Components
- Do not use `generateStaticParams` for any route that depends on real-time rates

**Phase to address:** Phase 1 (API routes) — set correct cache directives from the first route.

---

### Pitfall 12: IndexedDB Schema Migrations Without a Migration Library

**What goes wrong:** IndexedDB schema changes (adding stores, changing indices) require manual version bump and `onupgradeneeded` handling. Developers who don't use a library (like `idb` or `Dexie.js`) write fragile upgrade paths that break for users with old cached versions.

**Prevention:**
- Use `Dexie.js` for all IndexedDB access — it provides a clean version/migration API and TypeScript support
- Define the schema in one place and increment version numbers explicitly for each schema change

**Phase to address:** Phase 2 (offline support).

---

### Pitfall 13: PWA Manifest and Icon Requirements Missed

**What goes wrong:** Android Chrome requires specific icon sizes (512x512 maskable, 192x192) and a `start_url` that matches the scope for "Add to Home Screen" to appear. Missing even one requirement silently disables installability.

**Prevention:**
- Generate icons from a single SVG using `pwa-asset-generator` or Maskable.app
- Test installability with Lighthouse PWA audit in Chrome DevTools before the phase is considered done
- Ensure `manifest.json` has `display: "standalone"`, `background_color`, `theme_color`, and both required icon sizes with `purpose: "maskable"` on the 512x512 icon

**Phase to address:** Phase 2 (PWA shell).

---

### Pitfall 14: Tailwind/shadcn Dark Mode and Mobile Viewport Issues

**What goes wrong:** `shadcn/ui` uses `next-themes` for dark mode, which applies the theme class on `<html>`. On mobile PWA in standalone mode, the system dark mode preference may not be respected if `next-themes` is initialized with `defaultTheme: "light"` without `enableSystem: true`. Additionally, the `100vh` CSS unit behaves incorrectly on mobile Chrome (doesn't account for address bar), causing layout overflow on the transaction entry screen.

**Prevention:**
- Initialize `next-themes` with `enableSystem: true` and `attribute: "class"`
- Use `100dvh` (dynamic viewport height) instead of `100vh` for full-screen containers on mobile
- Test the quick-add transaction sheet on Android Chrome in both browser and standalone (PWA installed) mode

**Phase to address:** Phase 2 (UI shell).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Data model design | No rate snapshot on transactions | Add `rate_at_time` and `rate_source` columns from day one |
| Transaction arithmetic | Floating-point errors in JS | Use `decimal.js`; store as `NUMERIC(24, 8)` in Postgres |
| Supabase connection | Direct Postgres connection in serverless | Use pooler connection string (port 6543) always |
| BCV rate scraping | Silent scrape failure with no fallback | Always store last-known-good + staleness check |
| Vercel cron setup | Cron not keeping Supabase alive | Schedule a keep-alive query in same cron job as rate fetch |
| PWA service worker | `next-pwa` incompatibility with App Router | Use `@ducanh2912/next-pwa` or `serwist/next` |
| Offline transaction queue | Duplicate transactions on sync retry | Client-generated UUIDs + `ON CONFLICT DO NOTHING` |
| Auth flow | Magic link expiry on slow Venezuelan networks | Set 24h expiry, implement resend, use PKCE |
| Exchange rate display | VES inflation makes historical amounts confusing | Store rate snapshot at transaction time |
| Crypto rate fetching | CoinGecko rate limit on free tier | Cache in Supabase; never call CoinGecko from user requests |

---

## Sources

**Note:** External web tools were unavailable during this research session. All findings are from training knowledge (cutoff August 2025). The following represent the authoritative sources that should be verified against their current documentation before implementation:

- Supabase free tier limits: https://supabase.com/docs/guides/platform/quotas (verify connection limits and pausing policy — known to change)
- Vercel Hobby plan limits: https://vercel.com/docs/limits/overview (verify 10s function timeout and cron frequency)
- CoinGecko API rate limits: https://docs.coingecko.com/reference/introduction (verify free tier request limits)
- `@ducanh2912/next-pwa` App Router support: https://github.com/DuCanhGH/next-pwa
- `serwist/next` documentation: https://serwist.pages.dev/docs/next
- Decimal.js documentation: https://mikemcl.github.io/decimal.js/
- Dexie.js documentation: https://dexie.org/docs/
- BCV official site: https://www.bcv.org.ve/ (verify current HTML structure for scraping)

| Claim | Confidence | Basis |
|-------|------------|-------|
| Supabase free tier: 60 direct connections | MEDIUM | Training data; verify at supabase.com/docs/guides/platform/quotas |
| Supabase pausing after 7 days inactivity | MEDIUM | Training data; known behavior as of mid-2025 |
| Vercel Hobby: 10s function timeout | MEDIUM | Training data; verify at vercel.com/docs/limits |
| Vercel Hobby: 1 cron job max | MEDIUM | Training data; verify current plan limits |
| CoinGecko free tier: 30 calls/min | MEDIUM | Training data as of 2025; verify current limits |
| BCV scraping: no official API | HIGH | Well-established fact, unchanged |
| Floating-point IEEE 754 behavior | HIGH | Fundamental, immutable |
| UUID idempotency pattern for offline sync | HIGH | Standard distributed systems pattern |
| next-pwa App Router incompatibilities | MEDIUM | Known community issue as of 2024-2025; verify with current releases |
| `decimal.js` as financial precision solution | HIGH | Established library, well-documented |
