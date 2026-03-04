# Phase 1: Foundation - Research

**Researched:** 2026-03-04
**Domain:** Next.js 16 + Supabase + Vercel infrastructure, BCV scraping, rate aggregation, database schema
**Confidence:** HIGH (all critical claims verified against official docs; web tools available)

---

## Summary

Phase 1 delivers the non-retrofittable foundation: a deployed Next.js project, a correct production-grade Supabase schema, and a working rate aggregator. Every subsequent phase depends on decisions made here — NUMERIC(24,8) columns, UUID client_id, the pooler connection string, and the BCV fallback strategy cannot be added after data exists without migrations and risk.

**Three findings from live research require immediate decision before planning begins:**

1. **Vercel Hobby cron jobs run once per day, not hourly.** The success criterion "Vercel cron triggers /api/rates/refresh hourly" is impossible on Hobby plan. The minimum cron interval on Hobby is once per day. Hourly refresh requires either a Pro plan upgrade or an alternative trigger mechanism (Supabase Edge Function cron, external cron service, or client-triggered refresh fallback). This is the single most impactful constraint on Phase 1 architecture.

2. **Binance USDTVES does not exist as a spot pair.** The symbol `USDTVES` is not available on Binance's spot market API (`/api/v3/ticker/price`). USDT/VES trading on Binance is P2P only. The rate aggregator cannot use the spot endpoint for this pair. An alternative must be chosen: `dolarapi.com` (open-source, MIT-licensed Venezuelan rate API) is the most viable substitute and provides both official BCV and parallel rates in a single JSON endpoint.

3. **Next.js 16 is now current (released October 2025).** The project decisions reference Next.js 15. Next.js 16 has significant breaking changes (middleware renamed to `proxy`, fully async params/searchParams, Turbopack by default, React 19.2). Starting on Next.js 15 is still valid and supported, but the planner should be aware that `create-next-app@latest` will scaffold Next.js 16. Pin to Next.js 15 explicitly if that is the desired version, or upgrade the decision to Next.js 16 and account for its breaking changes.

**Primary recommendation:** Address the cron frequency constraint before writing Plan 01-03. Use `dolarapi.com` as the primary parallel rate source. Scaffold with Next.js 15 (explicit version pin) unless the team decides to adopt Next.js 16 now.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x (pin explicitly — `next@15`) | App framework, routing, API routes | Vercel-optimized; team decision locked on 15; Next.js 16 is current but has breaking changes |
| React | 19.x (ships with Next.js 15) | UI runtime | Ships automatically with Next.js 15 |
| TypeScript | 5.x | Type safety | Project-specified |
| `@supabase/supabase-js` | 2.x | Supabase JS client | Current major version; typed client |
| `@supabase/ssr` | latest | Next.js App Router auth integration | Official Supabase recommendation; replaces deprecated `auth-helpers-nextjs` |
| `cheerio` | 1.x | HTML parsing for BCV scraping | Lightweight, Node.js-compatible; no headless browser needed |
| `decimal.js` | 10.x | Arbitrary-precision financial arithmetic | Mandatory — IEEE 754 float drift is a correctness failure in financial data |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 4.x (via `create-next-app`) | Utility CSS | Default in Next.js 15 scaffold; shadcn/ui fully compatible with v4 as of 2025 |
| shadcn/ui | latest (`npx shadcn@latest init`) | Component library | Copy-paste model; no version lock; components copied into codebase |
| `date-fns` | 3.x | Date formatting, relative time | Tree-shakeable, `es-VE` locale support |
| `uuid` | 9.x | Client-side UUID generation for `client_id` | Required for offline idempotency pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cheerio` for BCV | Regex on raw HTML | Regex is more fragile; cheerio is purpose-built for HTML parsing |
| `dolarapi.com` for parallel rate | Manual Binance P2P scraping | P2P page scraping is more fragile; dolarapi.com is maintained and MIT-licensed |
| Next.js 15 | Next.js 16 | Next.js 16 has breaking changes (proxy rename, fully async params); 15 is still supported; team decision was 15 |
| Vercel cron (once/day on Hobby) | Supabase Edge Function cron, external cron service | Vercel Hobby cannot run hourly — requires architecture change |

**Installation:**

```bash
# Scaffold (explicit Next.js 15 pin)
npx create-next-app@15 deltaflow --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Financial precision (mandatory from day 1)
npm install decimal.js

# HTML scraping (BCV)
npm install cheerio

# UUID for client_id generation
npm install uuid
npm install -D @types/uuid

# shadcn/ui (interactive CLI - not npm install)
npx shadcn@latest init
```

---

## Architecture Patterns

### Recommended Project Structure

```
deltaflow/
├── app/
│   ├── api/
│   │   ├── rates/
│   │   │   ├── route.ts          # GET cached rates from exchange_rates table
│   │   │   └── refresh/
│   │   │       └── route.ts      # POST trigger: fetches BCV/DolarApi/CoinGecko, upserts to Supabase
│   │   └── health/
│   │       └── route.ts          # GET simple 200 + SELECT 1 (keep-alive + Supabase ping)
│   ├── layout.tsx                 # Root layout (no auth here — Phase 1 is infra only)
│   └── page.tsx                   # Placeholder home (returns 200 for Vercel deploy check)
├── lib/
│   ├── rates/
│   │   ├── bcv-scraper.ts        # server-only: scrape bcv.org.ve with cheerio
│   │   ├── dolarapi.ts           # server-only: fetch from ve.dolarapi.com (parallel rate)
│   │   ├── coingecko.ts          # server-only: fetch BTC/ETH/USD from CoinGecko
│   │   └── refresh-rates.ts      # server-only: orchestrates all three, upserts to Supabase
│   └── supabase/
│       ├── client.ts             # Browser Supabase client (anonymous, for public reads)
│       └── server.ts             # Server Supabase client (service role, for writes)
├── supabase/
│   └── migrations/
│       └── 0001_initial_schema.sql  # exchange_rates + transactions tables, RLS
├── vercel.json                   # cron config (daily on Hobby; hourly requires Pro or alternative)
└── .env.local                    # SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, COINGECKO_API_KEY
```

### Pattern 1: Supabase Client Initialization (Module Scope)

**What:** Initialize Supabase client once at module scope, not inside request handlers.

**When to use:** Every API route and server utility that touches Supabase.

**Why:** Serverless functions on Vercel create new execution contexts per cold start. Initializing inside a handler body wastes the pooler connection on every warm invocation and can exhaust connections under concurrent load.

```typescript
// lib/supabase/server.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createClient } from '@supabase/supabase-js'
import 'server-only'

// Module-scope initialization — reused across warm invocations
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      // CRITICAL: Use pooler URL (port 6543), never direct (port 5432)
      // Set SUPABASE_URL to the pooler connection string in .env
    },
  }
)
```

**Environment variable rule:** `SUPABASE_URL` must be the **pooler URL** (port 6543), not the direct Postgres URL (port 5432). The Supabase JS client uses this URL for all database operations. Set this from day one — changing it later means updating all deployed environment variables.

### Pattern 2: BCV Scraper with Fallback

**What:** Scrape BCV HTML with cheerio, fall back to last-known-good rate in Supabase if scrape fails.

**When to use:** Inside `/api/rates/refresh` route only — never on user-facing requests.

```typescript
// lib/rates/bcv-scraper.ts
import * as cheerio from 'cheerio'
import 'server-only'

const BCV_URL = 'https://www.bcv.org.ve/'
const FETCH_TIMEOUT_MS = 6000 // 6s — fail fast, use cached value

export interface BcvRateResult {
  usd: number | null
  scraped_at: string
  error?: string
}

export async function scrapeBcvRate(): Promise<BcvRateResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(BCV_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DeltaFlow/1.0)',
        'Accept': 'text/html',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`BCV returned HTTP ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // IMPORTANT: BCV HTML structure must be inspected live before
    // writing the production selector. The selector below is a placeholder.
    // Inspect https://www.bcv.org.ve/ and document the actual selector here
    // with the inspection date.
    //
    // Common pattern (verify before use):
    // div#dolar strong, or a table with rate cells
    // Last verified: NEEDS LIVE INSPECTION — see Phase 1 blocker note
    const rateText = $('SELECTOR_TO_BE_DETERMINED').text().trim()
    const usdRate = parseFloat(rateText.replace(',', '.'))

    if (isNaN(usdRate) || usdRate <= 0) {
      throw new Error(`BCV rate parse failed — got: "${rateText}"`)
    }

    return { usd: usdRate, scraped_at: new Date().toISOString() }
  } catch (err) {
    return {
      usd: null,
      scraped_at: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timeout)
  }
}
```

**Critical blocker:** The actual cheerio CSS selector for BCV's rate element must be determined by fetching and inspecting `bcv.org.ve` live before writing this code. The selector changes without notice. Task 01-03 must include a "fetch and inspect BCV HTML" step before writing the scraper.

### Pattern 3: Rate Upsert with Fallback Chain

**What:** Refresh all three rate sources, upsert successful results, fall back to cached value for any failures.

**When to use:** In `/api/rates/refresh` — triggered by cron or manual call.

```typescript
// lib/rates/refresh-rates.ts
import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/server'
import { scrapeBcvRate } from './bcv-scraper'
import { fetchDolarApiRates } from './dolarapi'
import { fetchCoinGeckoRates } from './coingecko'

export async function refreshAllRates() {
  const results = await Promise.allSettled([
    scrapeBcvRate(),
    fetchDolarApiRates(),
    fetchCoinGeckoRates(),
  ])

  const upserts = []

  // BCV official rate
  if (results[0].status === 'fulfilled' && results[0].value.usd) {
    upserts.push({
      currency: 'USD',
      rate_ves: results[0].value.usd,
      source: 'bcv',
      fetched_at: new Date().toISOString(),
    })
  }
  // else: leave existing BCV row — last-known-good remains in table

  // Parallel rate (DolarApi)
  if (results[1].status === 'fulfilled' && results[1].value.paralelo) {
    upserts.push({
      currency: 'USD',
      rate_ves: results[1].value.paralelo,
      source: 'dolarapi_paralelo',
      fetched_at: new Date().toISOString(),
    })
  }

  // CoinGecko BTC + ETH
  if (results[2].status === 'fulfilled') {
    const { btc_usd, eth_usd } = results[2].value
    if (btc_usd) upserts.push({ currency: 'BTC', rate_ves: btc_usd, source: 'coingecko', fetched_at: new Date().toISOString() })
    if (eth_usd) upserts.push({ currency: 'ETH', rate_ves: eth_usd, source: 'coingecko', fetched_at: new Date().toISOString() })
  }

  if (upserts.length > 0) {
    const { error } = await supabaseAdmin
      .from('exchange_rates')
      .upsert(upserts, { onConflict: 'currency,source' })

    if (error) throw new Error(`Supabase upsert failed: ${error.message}`)
  }

  return { updated: upserts.length, timestamp: new Date().toISOString() }
}
```

### Pattern 4: Vercel Cron Configuration

**What:** Configure `vercel.json` with cron schedule. On Hobby plan, maximum once per day.

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/rates/refresh",
      "schedule": "0 12 * * *"
    },
    {
      "path": "/api/health",
      "schedule": "0 8 * * *"
    }
  ]
}
```

**CRITICAL CONSTRAINT:** Hobby plan allows cron jobs once per day only (`0 * * * *` would fail deployment). The `/api/rates/refresh` cron will run once per day, not hourly. The success criterion "Vercel cron triggers /api/rates/refresh hourly" cannot be met on Hobby plan.

**Architecture decision required:** Choose one:
- Accept daily cron on Hobby (rates refresh once per day)
- Upgrade to Vercel Pro (enables once per minute)
- Use Supabase Edge Function cron (separate from Vercel limits; Supabase free tier supports scheduled Edge Functions)
- Use a free external cron service (cron-job.org, GitHub Actions scheduled workflow) to hit `/api/rates/refresh` hourly via HTTP

### Pattern 5: Financial Arithmetic with decimal.js

**What:** All arithmetic on monetary values uses `Decimal` objects, never native `number`.

**When to use:** Every calculation involving rates, amounts, or currency conversion.

```typescript
// Source: https://mikemcl.github.io/decimal.js/
import Decimal from 'decimal.js'

// Configure precision globally (do this once at app startup)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })

// Computing VES equivalent — NEVER use: amount * rate
export function toVes(amount: string | number, rateVes: string | number): string {
  return new Decimal(amount).mul(new Decimal(rateVes)).toFixed(8)
}

// Correct: 0.1 + 0.2 = 0.3 (not 0.30000000000000004)
const sum = new Decimal('0.1').plus(new Decimal('0.2')) // Decimal('0.3')
```

### Anti-Patterns to Avoid

- **Direct Postgres connection (port 5432) in serverless:** Use pooler (port 6543) — direct connections exhaust free-tier connection limit under concurrent requests.
- **`parseFloat()` on financial values:** Every `parseFloat()` in financial code is a latent correctness bug. Use `new Decimal(value)`.
- **BCV scraping on user-facing requests:** Only scrape in the cron-triggered refresh route. User requests read from Supabase cache.
- **`FLOAT` or `DOUBLE PRECISION` columns for money:** Use `NUMERIC(24,8)` — float types accumulate rounding errors.
- **Supabase client initialized inside request handler body:** Initialize at module scope; handlers reuse the connection from the warm execution context.
- **Assuming hourly cron on Hobby Vercel:** Hobby plan maximum is once per day. Plan the refresh frequency accordingly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Arbitrary-precision arithmetic | Custom big-number implementation | `decimal.js` | IEEE 754 float drift; crypto requires 8+ decimal places; edge cases around VES's large nominal values |
| HTML parsing for BCV | Regex on raw HTML | `cheerio` | HTML structure changes, nested elements, encoding issues; cheerio handles all of these correctly |
| UUID generation | `Math.random()`-based IDs | `uuid` v4 or `crypto.randomUUID()` | Native crypto.randomUUID() is available in modern Node.js and browsers; use it |
| Supabase client setup for App Router | Custom cookie/session logic | `@supabase/ssr` | Handles cookie parsing, refresh token rotation, and session sync across server/client correctly |
| Connection pooling in serverless | Manual `pg.Pool` management | Supabase pooler URL (port 6543) | Supabase's Supavisor pooler handles transaction-mode pooling for serverless correctly |
| Rate cache invalidation | Custom TTL logic | Supabase `fetched_at` column + server-side TTL check | Simple, auditable, no additional infrastructure |

**Key insight:** The financial arithmetic and connection pooling constraints in this domain look simple but have non-obvious failure modes. Both have caused rewrites in production financial apps. Use the established solutions from day one.

---

## Common Pitfalls

### Pitfall 1: Vercel Hobby Cron Frequency Limit

**What goes wrong:** Developer configures `"schedule": "0 * * * *"` (hourly) in `vercel.json`. Deployment fails with error: *"Hobby accounts are limited to daily cron jobs. This cron expression would run more than once per day."*

**Why it happens:** Training data and older documentation stated the Hobby limit was "minimum 1 hour." The current (verified 2026-03-04) limit is **once per day** on Hobby.

**How to avoid:** Choose an architecture that does not depend on Vercel cron for hourly refresh. Options: Supabase Edge Function cron (free tier supports scheduled functions at any frequency), GitHub Actions scheduled workflow calling `/api/rates/refresh`, or upgrade to Vercel Pro.

**Warning signs:** `0 * * * *` or any cron expression that runs more than once per day in `vercel.json` on a Hobby account.

### Pitfall 2: Binance Spot API USDTVES Does Not Exist

**What goes wrong:** Developer calls `https://api.binance.com/api/v3/ticker/price?symbol=USDTVES`. The API returns an error: `{"code":-1121,"msg":"Invalid symbol."}`. The rate aggregator fails with no parallel rate.

**Why it happens:** USDT/VES on Binance is P2P-only. There is no USDTVES spot market pair. The symbol does not exist on the public spot API.

**How to avoid:** Use `ve.dolarapi.com` (open-source, MIT-licensed, provides both BCV official and parallel rate in JSON). Alternatively, use `dolartoday.com` or similar aggregators. Do not attempt to scrape Binance P2P pages — the P2P page is JavaScript-rendered and requires a headless browser, which is incompatible with Vercel serverless.

**Warning signs:** Any reference to `USDTVES` as a Binance spot API symbol in the codebase.

### Pitfall 3: Supabase Pooler URL Not Set from Day One

**What goes wrong:** Developer uses the direct Postgres connection string (port 5432) in `SUPABASE_URL`. Works in development (single process, persistent connection). Fails in production under any concurrent load with `FATAL: remaining connection slots are reserved`.

**How to avoid:** In the Supabase dashboard, copy the **Session mode pooler** or **Transaction mode pooler** connection string (port 6543). Set this as `SUPABASE_URL` in `.env.local` and in Vercel environment variables from the first deployment.

**Warning signs:** `SUPABASE_URL` contains port 5432. Direct Postgres URL instead of pooler URL in any server-side client initialization.

### Pitfall 4: BCV Selector Fails Silently

**What goes wrong:** BCV's HTML structure changes. Cheerio selector returns empty string. `parseFloat('')` returns `NaN`. NaN is upserted to Supabase silently (or the upsert fails silently). Rate display shows a 1-3 day old rate with no staleness indicator.

**How to avoid:** Validate the parsed rate before upserting — `isNaN(rate) || rate <= 0` must throw an error, not silently skip. Always store `scraped_at` and show it in the UI. Log scrape failures to a monitoring endpoint. The BCV selector must be verified by live inspection before implementing — it changes without notice.

**Warning signs:** No `isNaN` check after `parseFloat` on BCV output. No `scraped_at` column. Scraper that does not distinguish between "no new rate" and "scrape failed."

### Pitfall 5: NUMERIC Column Precision Mismatch

**What goes wrong:** Schema uses `NUMERIC(20, 2)` for `amount_ves`. A BTC transaction with 8 decimal places of precision gets truncated to 2 decimal places on insert. Postgres silently rounds, not errors — the amount stored is wrong.

**How to avoid:** Use `NUMERIC(24, 8)` for all financial columns as specified in the requirements. The `8` in `NUMERIC(24, 8)` preserves 8 decimal places — sufficient for crypto (BTC uses satoshi = 1e-8). The `24` total digits handles VES's large nominal values.

**Warning signs:** Any `NUMERIC(n, 2)` column on a table that stores crypto amounts. Any `FLOAT` or `REAL` column type in the schema.

### Pitfall 6: Supabase Project Pausing

**What goes wrong:** Project is inactive for 7 days (no database queries). Supabase pauses the free-tier project. Next request takes 30-60 seconds to resume. Vercel function times out waiting for Supabase. Users see a 500 error.

**How to avoid:** Include a `SELECT 1` keep-alive query in the daily cron job (same execution as rate refresh). Alternatively, check if "Disable pausing" is available in the Supabase free tier dashboard settings (this option exists but availability varies). A daily cron ping is sufficient since pause threshold is 7 days.

**Warning signs:** No scheduled keep-alive mechanism. No handling for slow Supabase cold-start in API routes.

### Pitfall 7: Next.js 16 Breaking Changes If Upgrading

**What goes wrong:** Developer runs `create-next-app@latest` which scaffolds Next.js 16. Phase 1 tasks written for Next.js 15 patterns fail because:
- `middleware.ts` is renamed to `proxy.ts` in Next.js 16
- `params` and `searchParams` must be awaited (fully async, no compatibility shim)
- Turbopack is the default bundler (webpack configs ignored by default)

**How to avoid:** Pin explicitly to Next.js 15: `npx create-next-app@15`. If choosing Next.js 16, update all task plans to account for the proxy rename, async params pattern, and Turbopack-by-default.

---

## Code Examples

### Database Schema (Verified Pattern)

```sql
-- Migration: supabase/migrations/0001_initial_schema.sql

-- exchange_rates: one row per currency/source pair, upserted hourly
CREATE TABLE exchange_rates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  currency    TEXT NOT NULL,              -- 'USD', 'BTC', 'ETH', 'USDT', 'EUR'
  rate_ves    NUMERIC(24, 8) NOT NULL,    -- price in VES — NEVER FLOAT
  source      TEXT NOT NULL,              -- 'bcv', 'dolarapi_paralelo', 'coingecko'
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (currency, source)               -- upsert conflict target
);

CREATE INDEX idx_exchange_rates_fetched ON exchange_rates(fetched_at DESC);
CREATE INDEX idx_exchange_rates_currency_source ON exchange_rates(currency, source);

-- No RLS on exchange_rates — public read is intentional (rates are not user data)
-- API routes use service role for writes; anon key for reads

-- transactions: user-scoped financial records
CREATE TABLE transactions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         UUID NOT NULL,              -- client-generated, for offline dedup
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount            NUMERIC(24, 8) NOT NULL,    -- original amount in original currency
  currency          TEXT NOT NULL,              -- 'USD', 'VES', 'EUR', 'BTC', 'ETH', 'USDT'
  amount_ves        NUMERIC(24, 8),             -- VES snapshot at time of entry — NEVER recalculate
  rate_at_time      NUMERIC(24, 8),             -- rate used for VES snapshot — for auditing
  rate_source       TEXT,                       -- 'bcv', 'dolarapi_paralelo', 'coingecko'
  type              TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category          TEXT NOT NULL,
  payment_method    TEXT,                       -- 'zelle', 'usdt', 'pagomovil', 'usd_cash', 'transfer', 'other'
  description       TEXT,
  transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id)                            -- idempotent insert: ON CONFLICT (client_id) DO NOTHING
);

-- Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_transactions"
  ON transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_category ON transactions(user_id, category);
CREATE INDEX idx_transactions_client_id ON transactions(client_id);
```

### DolarApi Rate Fetch

```typescript
// lib/rates/dolarapi.ts
// Source: https://ve.dolarapi.com (MIT license, open source)
import 'server-only'

interface DolarApiResponse {
  promedio: number
  fechaActualizacion: string
}

export async function fetchDolarApiParalelo(): Promise<{ paralelo: number; fetched_at: string } | null> {
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) throw new Error(`DolarApi returned ${response.status}`)

    const data: DolarApiResponse = await response.json()

    if (typeof data.promedio !== 'number' || data.promedio <= 0) {
      throw new Error('DolarApi returned invalid rate')
    }

    return { paralelo: data.promedio, fetched_at: new Date().toISOString() }
  } catch {
    return null // caller falls back to cached value
  }
}
```

### CoinGecko Rate Fetch

```typescript
// lib/rates/coingecko.ts
// Source: https://docs.coingecko.com/reference/simple-price
// REQUIRES: COINGECKO_API_KEY env var (free Demo key from coingecko.com)
import 'server-only'

export async function fetchCoinGeckoRates(): Promise<{ btc_usd: number; eth_usd: number } | null> {
  const apiKey = process.env.COINGECKO_API_KEY
  const url = new URL('https://api.coingecko.com/api/v3/simple/price')
  url.searchParams.set('ids', 'bitcoin,ethereum')
  url.searchParams.set('vs_currencies', 'usd')
  if (apiKey) url.searchParams.set('x_cg_demo_api_key', apiKey)

  try {
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`)

    const data = await response.json()
    const btc_usd = data?.bitcoin?.usd
    const eth_usd = data?.ethereum?.usd

    if (!btc_usd || !eth_usd) throw new Error('CoinGecko response missing prices')

    return { btc_usd, eth_usd }
  } catch {
    return null
  }
}
```

### Route: /api/rates/refresh

```typescript
// app/api/rates/refresh/route.ts
import { NextResponse } from 'next/server'
import { refreshAllRates } from '@/lib/rates/refresh-rates'

// Force dynamic — no caching on this route
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Optional: verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await refreshAllRates()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Refresh failed' },
      { status: 500 }
    )
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-pwa` for PWA | Serwist (`@ducanh2912/next-pwa`) | 2023 | `next-pwa` is abandoned and App Router incompatible; Phase 6 must use Serwist |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers is deprecated; `@supabase/ssr` is current |
| Next.js 15 | Next.js 16 (current) | October 2025 | Next.js 16: middleware→proxy, fully async params, Turbopack by default; project is pinning to 15 |
| Tailwind v3 + shadcn | Tailwind v4 + shadcn | Early 2025 | shadcn/ui is fully v4 compatible as of 2025; v3 also works |
| Binance USDTVES spot API | dolarapi.com | N/A | USDTVES never existed as a spot pair; parallel rate from dolarapi.com is the correct source |
| Vercel 10s timeout (without fluid compute) | 300s default (with fluid compute, now default) | 2025 | Fluid compute is now enabled by default on Vercel; BCV scraping timeout is no longer a hard blocker |
| Vercel hourly cron on Hobby | Daily only on Hobby | Verified 2026 | Hourly cron requires Pro plan or alternative mechanism |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: deprecated, replaced by `@supabase/ssr`
- `next-pwa` (original): unmaintained since 2022, App Router incompatible
- Binance USDTVES spot ticker: never existed; P2P only
- Vercel 10s function timeout: superseded by fluid compute (300s on Hobby)
- `serverRuntimeConfig` / `publicRuntimeConfig` in Next.js: removed in Next.js 16

---

## Open Questions

1. **Cron frequency decision**
   - What we know: Vercel Hobby allows once per day maximum. Success criterion requires hourly refresh.
   - What's unclear: Which alternative mechanism the team prefers (Supabase Edge Function cron, GitHub Actions, external service, or Pro plan upgrade).
   - Recommendation: Decide before Plan 01-03. Supabase Edge Functions cron is the simplest free alternative — it runs server-side, has no Vercel dependency, and Supabase free tier supports scheduled functions.

2. **BCV selector must be determined by live inspection**
   - What we know: BCV publishes USD/VES on `bcv.org.ve`. Cheerio is the correct tool. The selector changes without notice.
   - What's unclear: The current HTML structure and the correct CSS selector.
   - Recommendation: Plan 01-03 must include a step to fetch and inspect BCV's HTML live before writing the scraper. Document the selector with date. This is the highest operational risk in Phase 1.

3. **Next.js 15 vs 16 decision**
   - What we know: `create-next-app@latest` now scaffolds Next.js 16. Project decisions reference 15. Next.js 16 has meaningful breaking changes.
   - What's unclear: Whether to pin to 15 or adopt 16 now.
   - Recommendation: Pin to Next.js 15 for this project (use `create-next-app@15`). Next.js 15 is fully supported. Adopting Next.js 16 now adds scope to Phase 1 (middleware→proxy rename, async params pattern) that is not in the current plan.

4. **Supabase "Disable pausing" dashboard option**
   - What we know: This option was added to the free tier dashboard in 2024.
   - What's unclear: Whether it is still available in 2026.
   - Recommendation: Check the Supabase dashboard during Phase 1 setup. If available, enable it. If not, the daily keep-alive cron is mandatory.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (to be installed — Wave 0 gap) |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

Phase 1 has no user-facing requirements (infrastructure phase). Tests validate success criteria directly:

| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC-1 | `npx vercel deploy` returns 200 | smoke | Manual — requires live Vercel deploy | N/A |
| SC-2a | `transactions` table has `amount_ves NUMERIC(24,8)` | integration | `npx vitest run tests/schema.test.ts` | Wave 0 |
| SC-2b | `transactions` table has `rate_at_time NUMERIC(24,8)` | integration | `npx vitest run tests/schema.test.ts` | Wave 0 |
| SC-2c | `transactions` table has `client_id UUID UNIQUE` | integration | `npx vitest run tests/schema.test.ts` | Wave 0 |
| SC-3a | `/api/rates/refresh` upserts BCV rate (or fallback) | integration | `npx vitest run tests/rates.test.ts` | Wave 0 |
| SC-3b | `/api/rates/refresh` upserts DolarApi parallel rate | integration | `npx vitest run tests/rates.test.ts` | Wave 0 |
| SC-3c | `/api/rates/refresh` upserts CoinGecko BTC/ETH | integration | `npx vitest run tests/rates.test.ts` | Wave 0 |
| SC-3d | BCV scrape failure falls back to last-known-good | unit | `npx vitest run tests/bcv-scraper.test.ts` | Wave 0 |
| SC-5 | Supabase client uses pooler URL (port 6543) | unit | `npx vitest run tests/supabase-client.test.ts` | Wave 0 |
| FIN-1 | `decimal.js` arithmetic produces correct results | unit | `npx vitest run tests/decimal-math.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/[relevant-test].test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/schema.test.ts` — validates column types on `transactions` and `exchange_rates` tables via Supabase client
- [ ] `tests/rates.test.ts` — integration tests for rate refresh endpoint (mock external APIs)
- [ ] `tests/bcv-scraper.test.ts` — unit tests for BCV parser and fallback behavior
- [ ] `tests/decimal-math.test.ts` — unit tests verifying `decimal.js` is used and produces correct results
- [ ] `tests/supabase-client.test.ts` — unit test verifying pooler URL is used (not port 5432)
- [ ] `vitest.config.ts` — vitest configuration with Next.js compatibility
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react @testing-library/react`

---

## Sources

### Primary (HIGH confidence)

- [Vercel Function Duration Docs](https://vercel.com/docs/functions/configuring-functions/duration) — verified 2026-03-04: Hobby plan max 300s with fluid compute (default); 60s max without fluid compute
- [Vercel Cron Jobs Usage and Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — verified 2026-03-04: Hobby plan minimum interval is **once per day**; hourly cron fails deployment
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) — verified 2026-03-04: middleware→proxy rename, fully async params, Turbopack by default
- [Next.js 15.5 Blog Post](https://nextjs.org/blog/next-15-5) — published August 2025: deprecation warnings for Next.js 16 features
- [shadcn/ui Tailwind v4 Docs](https://ui.shadcn.com/docs/tailwind-v4) — verified 2026-03-04: full Tailwind v4 and React 19 compatibility confirmed
- [DolarApi.com Venezuela](https://dolarapi.com/docs/venezuela/) — verified 2026-03-04: provides BCV official and parallel rates; MIT-licensed; base URL `https://ve.dolarapi.com`
- [Supabase Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) — pooler port 6543 confirmed; transaction mode for serverless recommended
- Supabase free tier 7-day inactivity pause — MEDIUM confidence (multiple community sources consistent, 2025-2026)
- Binance USDTVES P2P-only — MEDIUM confidence (search results confirm P2P platform shows pair, spot API does not)

### Secondary (MEDIUM confidence)

- CoinGecko Demo API key requirement — free Demo plan requires registration for reliable access; `x_cg_demo_api_key` query param
- `@supabase/ssr` as replacement for `auth-helpers-nextjs` — official Supabase recommendation as of 2024, confirmed in docs

### Tertiary (LOW confidence — verify at build time)

- BCV HTML selector — must be inspected live; changes without notice; no reliable documentation
- Binance P2P USDT/VES exact rate — confirmed to exist on P2P platform; exact API access method unverified
- Supabase "Disable pausing" dashboard option — reported to exist in 2024; verify in current dashboard

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against official docs (Next.js, shadcn/ui, Supabase, Vercel)
- Architecture: HIGH — patterns derived from official docs and verified constraints
- Pitfalls: HIGH — critical pitfalls (cron frequency, Binance pair, pooler URL) verified against official sources
- Rate aggregator specifics: MEDIUM — DolarApi.com endpoint structure verified; BCV selector requires live inspection

**Research date:** 2026-03-04
**Valid until:** 2026-06-04 for stable parts (Next.js, Supabase, Vercel limits); BCV selector must be re-verified at implementation time regardless of date
