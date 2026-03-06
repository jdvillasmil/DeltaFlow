---
phase: 01-foundation
plan: 03
subsystem: api
tags: [cheerio, decimal.js, coingecko, dolarapi, bcv, supabase, edge-functions, rate-aggregator]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js 15 scaffold with Supabase clients and Vitest setup
  - phase: 01-02
    provides: exchange_rates table with NUMERIC(24,8) and UNIQUE(currency,source) constraint

provides:
  - BCV HTML scraper (cheerio, div#dolar strong selector, null-on-failure)
  - dolarapi.com parallel USD/VES rate fetcher (null-on-failure)
  - CoinGecko BTC/ETH USD price fetcher with Demo API key support (null-on-failure)
  - refreshAllRates() orchestrator with Promise.allSettled and Supabase upsert
  - toVes() helper for decimal.js currency conversion (8-digit precision)
  - GET/POST /api/rates/refresh endpoint protected by CRON_SECRET
  - GET /api/rates endpoint returning cached rates from exchange_rates
  - Supabase Edge Function (Deno) for hourly cron trigger (0 * * * *)
  - 15 passing unit tests (bcv-scraper, rates, decimal-math)

affects: [Phase 3 rate display, Phase 5 transaction amounts, all VES conversion logic]

# Tech tracking
tech-stack:
  added: [tsx (dev - BCV inspection scripts), decimal.js (already in deps - confirmed usage)]
  patterns: [null-on-failure fetchers, Promise.allSettled for parallel fetch, last-known-good cache via no-delete upsert]

key-files:
  created:
    - src/lib/rates/bcv-scraper.ts
    - src/lib/rates/dolarapi.ts
    - src/lib/rates/coingecko.ts
    - src/lib/rates/refresh-rates.ts
    - src/app/api/rates/refresh/route.ts
    - src/app/api/rates/route.ts
    - supabase/functions/refresh-rates/index.ts
    - src/tests/bcv-scraper.test.ts
    - src/tests/rates.test.ts
    - src/tests/decimal-math.test.ts
    - src/tests/__mocks__/server-only.ts
    - scripts/inspect-bcv.ts
  modified:
    - vitest.config.ts (added server-only mock alias)
    - tsconfig.json (excluded supabase/ from Next.js TypeScript compilation)

key-decisions:
  - "BCV selector confirmed live on 2026-03-06: div#dolar strong — rate was 431.01130000 VES/USD"
  - "dolarapi.com (not Binance) for parallel USD/VES rate — USDTVES does not exist on Binance spot"
  - "All fetchers return null on failure — never throw — callers use last-known-good from Supabase"
  - "Promise.allSettled used in refreshAllRates — partial failure acceptable, any source failure does not break refresh"
  - "supabase/ excluded from tsconfig.json — Deno types not compatible with Next.js TypeScript compilation"
  - "server-only package mocked in vitest via resolve.alias — throws outside Next.js server context"
  - "Supabase Edge Function cron at 0 * * * * (hourly) — Vercel Hobby is daily-only, not usable for hourly"
  - "CoinGecko BTC/ETH stored in USD values in rate_ves column (not converted to VES) — conversion happens at display time"

patterns-established:
  - "Null-on-failure pattern: all external API fetchers catch internally and return null"
  - "toVes(amount, rate): always pass string args to Decimal constructor — never pass raw JS floats"
  - "Decimal.set({ precision: 28 }) called once at module scope in refresh-rates.ts"
  - "CRON_SECRET auth: Bearer token checked in handleRefresh() — endpoint unprotected only if env var not set"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-03-06
---

# Phase 1 Plan 3: Rate Aggregator Summary

**BCV cheerio scraper (div#dolar strong, live-verified 431.01 VES/USD), dolarapi.com parallel rate, CoinGecko BTC/ETH, refreshAllRates() orchestrator with decimal.js, /api/rates/refresh and /api/rates endpoints, Supabase Edge Function hourly cron**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-06T15:57:24Z
- **Completed:** 2026-03-06T16:02:43Z
- **Tasks:** 2 of 3 complete (Task 3 awaiting human-verify checkpoint)
- **Files modified:** 14

## Accomplishments
- Live BCV HTML inspection confirmed selector `div#dolar strong` returns `431,01130000` (2026-03-06 rate)
- All 15 new unit tests + 12 prior tests pass (27 total) — full test suite green
- `npx next build` exits with code 0, three API routes compiled
- Partial-failure-safe architecture: any single source down leaves last-known-good row in Supabase untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: BCV scraper, dolarapi, CoinGecko, toVes, unit tests (TDD)** - `e8eeabe` (feat)
2. **Task 2: refresh orchestrator, API endpoints, Supabase Edge Function** - `9e31a20` (feat)
3. **Task 3: human-verify checkpoint** - awaiting

## Files Created/Modified
- `src/lib/rates/bcv-scraper.ts` - BCV HTML scraper with 6s timeout, cheerio, null-on-failure
- `src/lib/rates/dolarapi.ts` - dolarapi.com parallel USD/VES rate, 5s timeout, null-on-failure
- `src/lib/rates/coingecko.ts` - CoinGecko BTC/ETH price fetcher with Demo API key, null-on-failure
- `src/lib/rates/refresh-rates.ts` - refreshAllRates() orchestrator + toVes() decimal helper
- `src/app/api/rates/refresh/route.ts` - GET/POST rate refresh, CRON_SECRET protection
- `src/app/api/rates/route.ts` - GET cached rates from exchange_rates (revalidate 3600s)
- `supabase/functions/refresh-rates/index.ts` - Deno Edge Function for hourly cron
- `src/tests/bcv-scraper.test.ts` - 4 tests: success, empty selector, non-200, network error
- `src/tests/rates.test.ts` - 7 tests: dolarapi and coingecko fetchers
- `src/tests/decimal-math.test.ts` - 4 tests: 0.1+0.2 precision, toVes calculations
- `src/tests/__mocks__/server-only.ts` - Mock to allow vitest to import server-only modules
- `scripts/inspect-bcv.ts` - One-off BCV HTML inspection script
- `vitest.config.ts` - Added server-only mock alias
- `tsconfig.json` - Excluded supabase/ from Next.js TypeScript compilation

## BCV Selector Inspection Results (2026-03-06)

**URL:** https://www.bcv.org.ve/
**Selector used:** `div#dolar strong`
**Live rate found:** `431,01130000` = 431.01130000 VES/USD
**HTML structure:**
```html
<div id="dolar">
  <div class="field-content">
    <div class="row recuadrotsmc">
      <div class="col-sm-6 col-xs-6"><span> USD</span></div>
      <div class="col-sm-6 col-xs-6 centrado"><strong> 431,01130000 </strong></div>
    </div>
  </div>
</div>
```
**Normalization:** comma decimal separator → replace `,` with `.`, strip `.` thousands separator

## Decisions Made
- BCV selector `div#dolar strong` confirmed live — not placeholder
- dolarapi.com used for parallel rate (Binance USDTVES does not exist on spot market)
- Promise.allSettled for parallel fetching — individual source failure does not block refresh
- server-only package mocked in vitest via vitest.config.ts resolve.alias
- supabase/ directory excluded from tsconfig.json to prevent Deno type errors in Next.js build
- Supabase Edge Function cron (not Vercel) for hourly refresh — Vercel Hobby is daily-only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] server-only package throws in vitest environment**
- **Found during:** Task 1 (GREEN phase — running tests after implementing modules)
- **Issue:** `server-only` package throws "This module cannot be imported from a Client Component module" in Node.js test environment (outside Next.js server context)
- **Fix:** Added `server-only` mock (`src/tests/__mocks__/server-only.ts`) and resolve alias in `vitest.config.ts`
- **Files modified:** `vitest.config.ts`, `src/tests/__mocks__/server-only.ts`
- **Verification:** All 15 tests pass after fix
- **Committed in:** `e8eeabe` (Task 1 commit)

**2. [Rule 1 - Bug] Test mock.calls[0] index wrong for CoinGecko API key test**
- **Found during:** Task 1 (GREEN phase — 14/15 tests passing)
- **Issue:** Test `appends COINGECKO_API_KEY as x_cg_demo_api_key query param` checked `calls[0]` but shared mock had prior dolarapi calls at index 0; actual CoinGecko call was at last index
- **Fix:** Changed `calls[0]` to `calls[calls.length - 1]` to get the most recent call
- **Files modified:** `src/tests/rates.test.ts`
- **Verification:** All 15 tests pass
- **Committed in:** `e8eeabe` (Task 1 commit)

**3. [Rule 3 - Blocking] Deno types in supabase/ caused Next.js TypeScript build failure**
- **Found during:** Task 2 (build verification)
- **Issue:** `npx next build` failed with "Cannot find name 'Deno'" because tsconfig `include: ["**/*.ts"]` picked up supabase/functions/refresh-rates/index.ts
- **Fix:** Added `"supabase"` to tsconfig.json `exclude` array
- **Files modified:** `tsconfig.json`
- **Verification:** `npx next build` exits with code 0
- **Committed in:** `9e31a20` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 3 blocking, 1 Rule 1 bug)
**Impact on plan:** All fixes essential for test execution and build correctness. No scope creep.

## User Setup Required

Before Task 3 (human-verify) can be completed, the following environment variables and Supabase configuration are needed:

**Environment variables to add to Vercel:**
- `CRON_SECRET` — a secure random string (e.g., `openssl rand -hex 32`)
- `COINGECKO_API_KEY` — free Demo key from https://coingecko.com/en/api/pricing

**Supabase Edge Function deployment:**
```bash
# Deploy the Edge Function
npx supabase functions deploy refresh-rates --project-ref YOUR_PROJECT_REF

# Set required secrets on the Edge Function
npx supabase secrets set NEXTJS_APP_URL=https://your-app.vercel.app --project-ref YOUR_PROJECT_REF
npx supabase secrets set CRON_SECRET=your_cron_secret --project-ref YOUR_PROJECT_REF
```

Then in Supabase dashboard > Edge Functions > refresh-rates > Schedule: set `0 * * * *`

## Issues Encountered

- **BCV HTTPS certificate error in Node.js**: `NODE_TLS_REJECT_UNAUTHORIZED=0` was required to run the inspection script locally due to corporate proxy SSL interception. This is a local dev environment issue only — production (Vercel) does not have this issue.

## Next Phase Readiness
- Rate aggregator fully implemented and tested locally
- Awaiting human-verify checkpoint: deploy to Vercel, trigger refresh, confirm 4 rows in Supabase
- Once checkpoint passes, Phase 1 foundation is complete
- Phases 3 and 5 can consume `/api/rates` for display and transaction amount conversion

---
*Phase: 01-foundation*
*Completed: 2026-03-06*
