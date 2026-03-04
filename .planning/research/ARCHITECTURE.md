# Architecture Patterns

**Domain:** Personal Finance PWA — Multi-Currency (Venezuelan market)
**Project:** DeltaFlow
**Researched:** 2026-03-04
**Confidence:** MEDIUM-HIGH

---

## Recommended Architecture

DeltaFlow is a client-heavy PWA with a thin serverless backend. The architecture has three logical tiers:

1. **Client Layer** — Next.js App Router + Serwist service worker + IndexedDB offline queue
2. **API Layer** — Next.js API Routes on Vercel (serverless functions)
3. **Data Layer** — Supabase (PostgreSQL + Auth + Realtime)

Exchange rate data flows through a server-side caching layer before reaching the client, keeping API keys and scraping logic server-side and protecting the free-tier rate limits.

```
[Mobile Browser / PWA]
       |
  [Service Worker (Serwist)]
       |  (offline queue via IndexedDB)
       |
  [Next.js App Router (Vercel)]
       |
       +--[/api/rates]---->[Rate Aggregator]
       |                        |
       |                   [BCV Scraper]
       |                   [Binance API]
       |                   [CoinGecko API]
       |                        |
       |                   [Supabase: exchange_rates table]
       |
       +--[/api/transactions]-->[Supabase: transactions table]
       |
       +--[Supabase Auth]------>[Magic Link Email]
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Next.js App Router pages | UI rendering, route handling, auth guards | Supabase client, API routes |
| Service Worker (Serwist) | Cache static assets, intercept failed requests, background sync | IndexedDB, Next.js fetch |
| Offline Queue (IndexedDB) | Store pending transactions when offline | Service worker, sync manager |
| Rate Aggregator (`/api/rates`) | Fetch from BCV/Binance/CoinGecko, cache in DB, return to client | BCV scraper, external APIs, Supabase |
| BCV Scraper (server-only) | Scrape `bcv.org.ve`, parse USD/VES rate | Rate aggregator only |
| Transaction API (`/api/transactions`) | CRUD for transactions, apply rate snapshot on write | Supabase transactions table |
| Supabase Auth | Magic link issue and verification, session management | Next.js middleware |
| Supabase Realtime | Push rate changes to connected clients | Client subscription hook |

**Boundary rules:**
- BCV scraper MUST run server-side only — never expose scraping to client
- Rate logic MUST go through `/api/rates` — client never calls external rate APIs directly
- Auth session MUST be verified in Next.js middleware before any API route executes

---

## Data Flow

### Exchange Rate Data Flow

```
[Cron trigger or client request]
        |
        v
[/api/rates route]
        |
        +-- Check Supabase exchange_rates WHERE fetched_at > NOW() - INTERVAL '1 hour'
        |       |
        |  [CACHE HIT] --> Return cached rates
        |       |
        |  [CACHE MISS]
        |       |
        |       +-- Fetch BCV (scrape HTML)
        |       +-- Fetch Binance /api/v3/ticker/price?symbol=USDTVES
        |       +-- Fetch CoinGecko /simple/price?ids=bitcoin,ethereum&vs_currencies=usd
        |       |
        |       +-- Upsert into exchange_rates table
        |       |
        |       +-- Return fresh rates
        |
        v
[Client: useExchangeRates hook]
        |
        v
[Zustand store: ratesStore]
        |
        v
[Transaction form, dashboard totals, conversion displays]
```

### Transaction Write Data Flow (Online)

```
[User submits transaction form]
        |
        v
[Client validation (Zod)]
        |
        v
[POST /api/transactions]
        |
        +-- Read current rates from exchange_rates table
        +-- Compute amount_ves = original_amount * rate_at_time
        +-- Insert transaction row (stores both values)
        |
        v
[Supabase: transactions table]
        |
        v
[Supabase Realtime broadcasts INSERT]
        |
        v
[Client: transactions list re-renders]
```

### Transaction Write Data Flow (Offline)

```
[User submits transaction form]
        |
        v
[Client validation (Zod)]
        |
        v
[navigator.onLine === false detected]
        |
        v
[Write to IndexedDB: pending_transactions queue]
[Show "Saved offline — will sync when connected" toast]
        |
        v
[navigator.onLine event fires (reconnect)]
        |
        v
[Sync manager drains IndexedDB queue]
        |
        +-- For each pending transaction:
        |       Fetch current rates (may differ from offline time)
        |       POST /api/transactions with stored original_amount + currency
        |
        v
[Clear synced records from IndexedDB]
[Show "X transactions synced" notification]
```

---

## Database Schema

### `exchange_rates` table

```sql
CREATE TABLE exchange_rates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  currency    TEXT NOT NULL,           -- 'USD', 'EUR', 'BTC', 'ETH', 'USDT'
  rate_ves    NUMERIC(20, 6) NOT NULL, -- price in VES
  source      TEXT NOT NULL,           -- 'bcv', 'binance', 'coingecko'
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (currency, source)            -- upsert target
);

CREATE INDEX idx_exchange_rates_currency ON exchange_rates(currency);
CREATE INDEX idx_exchange_rates_fetched ON exchange_rates(fetched_at DESC);
```

**Design rationale:** One row per currency/source pair, upserted on each refresh. Simple TTL check: `WHERE fetched_at > NOW() - INTERVAL '1 hour'`. BCV provides the official USD/VES rate; Binance provides parallel market USDT/VES rate. Both are stored separately so UI can display both.

### `transactions` table

```sql
CREATE TABLE transactions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount            NUMERIC(20, 8) NOT NULL,   -- original amount in original_currency
  currency          TEXT NOT NULL,              -- 'USD', 'VES', 'EUR', 'BTC', 'ETH', 'USDT'
  amount_ves        NUMERIC(20, 2),             -- snapshot in VES at time of entry
  rate_at_time      NUMERIC(20, 6),             -- rate used for conversion snapshot
  rate_source       TEXT,                       -- 'bcv', 'binance', 'coingecko'
  type              TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category          TEXT NOT NULL,
  description       TEXT,
  transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at         TIMESTAMPTZ,               -- NULL if created offline, set on server sync
  client_id         UUID,                      -- client-generated ID for dedup on offline sync
  UNIQUE (client_id)                           -- prevents duplicate inserts on retry
);

-- Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own transactions"
  ON transactions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_category ON transactions(user_id, category);
```

**Design rationale for dual-currency storage:** Store both `amount` (original currency) and `amount_ves` (snapshot). This is the correct approach for Venezuelan context:
- `amount_ves` at time of entry shows what things actually cost in local reality at that moment
- `amount` in original currency allows recalculation with current rates for "what is this worth now?"
- `rate_at_time` enables auditing and historical accuracy
- Never lose the original denomination — a $50 purchase should always show as $50, not 200,000 VES

### `categories` table (optional, can start as enum)

```sql
-- Start with application-level enum, promote to table if users need custom categories
-- Predefined: 'food', 'transport', 'utilities', 'rent', 'income_salary',
--             'income_freelance', 'entertainment', 'health', 'other'
```

---

## Offline Sync Strategy

### Recommended: IndexedDB Queue + Online Event Sync

Use the `idb` library (typed wrapper around IndexedDB) for the offline queue. Do not use Background Sync API — it is unreliable on Android Chrome and has no Safari support.

**Implementation pattern:**

```typescript
// lib/offline-queue.ts
import { openDB } from 'idb'

const DB_NAME = 'deltaflow-offline'
const STORE = 'pending_transactions'

export interface PendingTransaction {
  client_id: string       // UUID generated client-side
  amount: number
  currency: string
  type: 'income' | 'expense'
  category: string
  description?: string
  transaction_date: string
  queued_at: string       // ISO timestamp
}

export async function queueTransaction(tx: PendingTransaction) {
  const db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE, { keyPath: 'client_id' })
    },
  })
  await db.put(STORE, tx)
}

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await openDB(DB_NAME, 1)
  return db.getAll(STORE)
}

export async function clearSynced(client_id: string) {
  const db = await openDB(DB_NAME, 1)
  await db.delete(STORE, client_id)
}
```

**Sync trigger (in a client-side hook):**

```typescript
// hooks/useOfflineSync.ts
useEffect(() => {
  const handleOnline = async () => {
    const pending = await getPendingTransactions()
    if (pending.length === 0) return

    for (const tx of pending) {
      try {
        await fetch('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(tx),
        })
        await clearSynced(tx.client_id)
      } catch {
        // leave in queue, retry next reconnect
      }
    }
  }

  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}, [])
```

**Server-side dedup:** The `client_id` unique constraint on the transactions table prevents duplicate inserts if the client retries.

### Rate freshness during offline sync

When syncing queued transactions, the server should use the rate at time of submission (from `queued_at` timestamp) if a rate exists in the `exchange_rates` table within a reasonable window (e.g., nearest rate within 2 hours). If no historical rate exists, use the current rate and flag the transaction with a note. Do not block the sync.

---

## Exchange Rate Caching Layer

### Three-source architecture

| Source | Currency Pair | Method | Update Frequency | Free Tier |
|--------|---------------|--------|-----------------|-----------|
| BCV | USD/VES (official) | HTML scrape of `bcv.org.ve` | Daily (BCV updates once/day) | No cost |
| Binance | USDT/VES (parallel market) | REST `/api/v3/ticker/price` | Hourly | No key needed |
| CoinGecko | BTC/USD, ETH/USD | REST `/simple/price` | Hourly | 30 req/min (Demo key) |

**VES as computed base:** CoinGecko returns prices in USD. Multiply by Binance USDT/VES rate to get BTC/VES and ETH/VES. This avoids needing a direct BTC/VES pair.

```
BTC/VES = BTC/USD (CoinGecko) × USDT/VES (Binance)
ETH/VES = ETH/USD (CoinGecko) × USDT/VES (Binance)
```

### Server-side caching in Supabase

```typescript
// lib/rates/get-rates.ts (server-only)
import 'server-only'

export async function getCachedRates() {
  const { data } = await supabase
    .from('exchange_rates')
    .select('*')
    .gt('fetched_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

  if (data && data.length > 0) return data

  return await refreshRates()
}
```

### Vercel Cron for background refresh

Add a cron job in `vercel.json` to refresh rates hourly, reducing latency for the first user each hour:

```json
{
  "crons": [
    {
      "path": "/api/rates/refresh",
      "schedule": "0 * * * *"
    }
  ]
}
```

This keeps the cache warm so `/api/rates` always hits the DB, not the external APIs, on user-facing requests.

---

## PWA Service Worker Strategy

### Use Serwist (recommended by Next.js official docs)

Next.js 14 App Router does not include a built-in service worker solution. The official Next.js documentation explicitly recommends **Serwist** for offline support. next-pwa is no longer actively maintained.

**Serwist caching strategy for DeltaFlow:**

| Asset Type | Strategy | Rationale |
|------------|----------|-----------|
| App shell (JS, CSS, fonts) | `StaleWhileRevalidate` | Fast load + background update |
| API routes (`/api/transactions`) | `NetworkFirst` with fallback | Prefer fresh, fallback to cache |
| API rates (`/api/rates`) | `NetworkFirst`, 60-min cache | Rates change hourly |
| Images/icons | `CacheFirst` | Static, rarely change |
| Navigation (HTML pages) | `NetworkFirst` | Always try fresh shell |

**Service worker setup (Next.js App Router):**

The service worker lives at `public/sw.js` and is registered in the root layout. Serwist handles precaching of the app shell automatically when integrated via the Next.js plugin.

**Key consideration:** Next.js App Router with webpack is required for Serwist (noted in official docs). Do not use Turbopack for production builds when Serwist is active.

---

## Patterns to Follow

### Pattern 1: Store Original Currency, Snapshot VES

**What:** When writing a transaction, always store both the original amount/currency AND the VES equivalent at that moment.

**When:** Every transaction write.

**Why:** In Venezuela's volatile exchange market, a transaction's VES value changes daily. The snapshot preserves historical accuracy (what you actually paid in VES) while keeping the source currency for "current value" recalculations.

```typescript
// In /api/transactions POST handler
const rates = await getCachedRates()
const rateEntry = rates.find(r => r.currency === transaction.currency)

await supabase.from('transactions').insert({
  ...transaction,
  amount_ves: transaction.amount * rateEntry.rate_ves,
  rate_at_time: rateEntry.rate_ves,
  rate_source: rateEntry.source,
})
```

### Pattern 2: Client-Generated UUIDs for Offline Dedup

**What:** Generate a `client_id` UUID on the client before submitting any transaction (online or offline).

**When:** Every transaction form submission.

**Why:** When offline transactions sync, the server needs to detect retries. A `UNIQUE(client_id)` constraint makes POST idempotent — retry storms don't create duplicates.

```typescript
import { v4 as uuidv4 } from 'uuid'
const client_id = uuidv4() // generated in the form, before any network call
```

### Pattern 3: Rate Aggregator Behind Internal API Route

**What:** Exchange rates are only accessible through `/api/rates`. No client component calls BCV/Binance/CoinGecko directly.

**When:** All rate fetching.

**Why:** Keeps scraping and API logic server-side, protects free-tier limits, enables server-side caching, and means rate freshness logic lives in one place.

### Pattern 4: Optimistic UI for Transaction Submission

**What:** Add transaction to local state immediately on form submit, then confirm/rollback based on API response.

**When:** Transaction create flow (online).

**Why:** Mobile users on slow connections (common in Venezuela) get instant feedback. If sync fails, show an error and revert.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Real-Time Rates in Client via Supabase Realtime

**What:** Subscribing to `exchange_rates` table changes via Supabase Realtime websocket on the client.

**Why bad:** Supabase free tier has a 2 concurrent realtime connection limit per project. With multiple users, connections will be dropped. Exchange rates change hourly — polling is sufficient and far cheaper.

**Instead:** Poll `/api/rates` every 60 minutes using a `useEffect` interval or SWR with `refreshInterval`. Use Supabase Realtime only if the app grows to need it and tier is upgraded.

### Anti-Pattern 2: Converting Everything to VES on Display

**What:** Storing only VES amounts and reconverting to display original currency.

**Why bad:** Precision loss on floating point. Crypto amounts (BTC, ETH) need 8 decimal places. VES amounts need 2. Round-tripping through division will produce artifacts. Also loses the transaction's original denomination context.

**Instead:** Store original amount + currency + VES snapshot. Display original, show VES equivalent.

### Anti-Pattern 3: BCV Scraping on Every Request

**What:** Calling the BCV scraper on every user-facing page load.

**Why bad:** BCV only updates rates once per business day. Scraping on every request wastes compute, risks IP bans, and creates latency for the user.

**Instead:** Cache in Supabase `exchange_rates` table with 1-hour TTL. Refresh via cron.

### Anti-Pattern 4: Client-Side Rate Calculation Without Server Validation

**What:** Letting the client compute `amount_ves` and trusting it on the server.

**Why bad:** Client can send any rate value. Stored historical data becomes unreliable.

**Instead:** Server always computes `amount_ves` from the authoritative cached rate at insert time. Client can show a preview, but the server value wins.

---

## Suggested Build Order (Phase Dependencies)

The components have these dependencies:

```
1. Supabase schema + RLS (foundation for everything)
        |
        v
2. Auth flow (magic links, session middleware)
        |
        v
3. Rate aggregator (/api/rates, BCV scraper, Binance, CoinGecko)
        |
        v
4. Transaction API (/api/transactions — needs rates for VES snapshot)
        |
        v
5. Core UI (transaction list, add form — needs auth + transactions API)
        |
        v
6. PWA + offline queue (enhances existing transaction flow)
        |
        v
7. Dashboard / charts (needs enough transactions to be useful)
```

**Why this order:**
- Schema first: RLS policies define security model; changing them after is risky
- Auth before any data: Supabase RLS requires `auth.uid()` in all policies
- Rates before transactions: transaction insert handler needs rates available
- Offline after online: offline queue is an enhancement layer, not a foundation
- Dashboard last: it is read-only aggregation on top of transaction data

---

## Scalability Considerations

| Concern | At 100 users (MVP) | At 10K users | At 1M users |
|---------|-------------------|--------------|-------------|
| Rate fetching | Single cron + Supabase table | Same, add Redis cache | Dedicated rate microservice |
| BCV scraping | Single server function | Add retry/circuit breaker | Mirror BCV data to own store |
| Supabase Realtime | Avoid (free tier limits) | Enable for rate push | Switch to dedicated infra |
| Transaction queries | No optimization needed | Add DB indexes (already in schema) | Partition by user_id |
| Vercel cold starts | Not noticeable | Use Vercel Edge for `/api/rates` | Warm cache strategy |

The schema and architecture are designed for free-tier MVP but do not create hard blockers at scale. VES-as-base-currency decision holds at any scale.

---

## File Structure Implications

```
deltaflow/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx          -- magic link form
│   ├── (app)/
│   │   ├── layout.tsx               -- auth guard middleware
│   │   ├── dashboard/page.tsx       -- totals by currency
│   │   └── transactions/page.tsx    -- list + add form
│   ├── api/
│   │   ├── rates/
│   │   │   ├── route.ts             -- GET cached rates
│   │   │   └── refresh/route.ts     -- POST from cron
│   │   └── transactions/
│   │       └── route.ts             -- GET list, POST create
│   └── manifest.ts                  -- PWA manifest
├── lib/
│   ├── rates/
│   │   ├── bcv-scraper.ts           -- server-only
│   │   ├── binance.ts               -- server-only
│   │   ├── coingecko.ts             -- server-only
│   │   └── get-rates.ts             -- server-only, caching logic
│   ├── offline-queue.ts             -- client-side, IndexedDB
│   ├── supabase/
│   │   ├── client.ts                -- browser client
│   │   └── server.ts                -- server client (cookies)
│   └── validations/
│       └── transaction.ts           -- Zod schemas
├── hooks/
│   ├── useExchangeRates.ts          -- polls /api/rates
│   └── useOfflineSync.ts            -- drains IndexedDB queue on reconnect
├── public/
│   └── sw.js                        -- Serwist service worker output
└── vercel.json                       -- cron config for rate refresh
```

---

## Sources

| Source | URL | Confidence |
|--------|-----|------------|
| Next.js PWA official guide | https://nextjs.org/docs/app/guides/progressive-web-apps | HIGH |
| Next.js data fetching | https://nextjs.org/docs/app/getting-started/fetching-data | HIGH |
| Serwist for Next.js (mentioned in official docs) | https://github.com/serwist/serwist/tree/main/examples/next-basic | MEDIUM |
| Multi-currency storage pattern (store original + snapshot) | Training data, established accounting practice | MEDIUM |
| IndexedDB offline queue pattern | Training data, standard PWA offline pattern | MEDIUM |
| Binance public API USDT/VES pair | Training data (verify pair exists at build time) | MEDIUM |
| CoinGecko free tier limits (30 req/min) | Training data (verify current limits at build time) | LOW — verify |
| BCV rate update frequency (once/business day) | Training data (verify current behavior) | MEDIUM |
