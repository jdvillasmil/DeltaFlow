# Roadmap: DeltaFlow

## Overview

DeltaFlow is built in six phases that respect a strict technical dependency chain. The schema and infrastructure must be correct before any user-facing code is written — rate snapshots, NUMERIC(24,8) columns, and the Supabase pooler connection cannot be retrofitted without data migrations. Auth gates all user data. The rate aggregator must produce data before transactions can snapshot it. Transactions must exist before the dashboard can aggregate them. PWA installability and theme support are layered on top of a complete, working app as the final phase.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Project scaffold, Supabase schema with RLS, and rate aggregator infrastructure
- [ ] **Phase 2: Authentication** - Magic link auth flow, session persistence, and auth-gated routing
- [ ] **Phase 3: Exchange Rates** - Rate display UI with BCV, Binance, CoinGecko, hourly refresh, and source transparency
- [ ] **Phase 4: Transactions** - Full transaction CRUD with multi-currency entry, categories, payment methods, and history
- [ ] **Phase 5: Dashboard** - Home screen with balance summary, spending chart, recent transactions, and live rates
- [ ] **Phase 6: PWA and Polish** - App installability, dark/light mode toggle, and mobile viewport correctness

## Phase Details

### Phase 1: Foundation
**Goal**: A deployable Next.js 15 project wired to Supabase, with a correct production-grade schema, rate aggregator infrastructure, and all critical pitfalls addressed before any user-facing code is written
**Depends on**: Nothing (first phase)
**Requirements**: None (infrastructure phase — enables RATE-01..05, TRANS-02, and all user-facing phases; non-retrofittable schema decisions made here)
**Success Criteria** (what must be TRUE):
  1. `npx vercel deploy` succeeds and the deployed URL returns a 200 with no runtime errors in the Vercel function log
  2. Supabase schema migrations run cleanly and the `transactions` table has `amount_ves NUMERIC(24,8)`, `rate_at_time NUMERIC(24,8)`, and `client_id UUID UNIQUE` columns from the first migration
  3. `/api/rates/refresh` fetches BCV (via cheerio scraping), Binance USDT/VES, and CoinGecko BTC/ETH and upserts results to the `exchange_rates` table — including fallback to last-known-good rate if BCV scrape fails
  4. Vercel cron triggers `/api/rates/refresh` hourly and a keep-alive ping reaches Supabase to prevent free-tier project pause
  5. All serverless functions connect via the Supabase pooler (port 6543) — direct Postgres port 5432 is never used
**Plans**: TBD

Plans:
- [ ] 01-01: Next.js 15 project scaffold with TypeScript, Tailwind CSS, shadcn/ui, and Vercel deployment
- [ ] 01-02: Supabase schema — exchange_rates and transactions tables with RLS, NUMERIC(24,8), UUID client_id
- [ ] 01-03: Rate aggregator — BCV scraper, Binance API, CoinGecko API, Supabase upsert, Vercel cron

### Phase 2: Authentication
**Goal**: Users can securely access their accounts via email magic link, with sessions that persist and proper auth-gating on all future routes
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. User receives a magic link email after entering their address on the sign-in page and can click it to land in the app as an authenticated session
  2. User refreshes the browser and remains logged in — no re-authentication required
  3. User can click a logout control from any page and is immediately redirected to the sign-in screen with session cleared
  4. Unauthenticated requests to any protected route redirect to sign-in via Next.js middleware — no user data is accessible without a valid session
**Plans**: TBD

Plans:
- [ ] 02-01: Supabase Auth integration with @supabase/ssr, magic link flow, and Next.js middleware for route protection
- [ ] 02-02: Sign-in page, auth callback handler, session persistence, and logout from any layout

### Phase 3: Exchange Rates
**Goal**: Users see live BCV, Binance parallel, and CoinGecko crypto rates on demand, with source attribution and staleness display, refreshing automatically in the background
**Depends on**: Phase 2
**Requirements**: RATE-01, RATE-02, RATE-03, RATE-04, RATE-05
**Success Criteria** (what must be TRUE):
  1. User can see the current BCV official USD/VES rate with a "BCV" label and a "last updated X minutes ago" timestamp on the rates page
  2. User can see the current Binance parallel USDT/VES rate with a "Binance" label and staleness timestamp alongside the BCV rate
  3. User can see current BTC and ETH prices in USD with a "CoinGecko" label and staleness timestamp
  4. Rates on screen update automatically without any user action — the display refreshes within 60 minutes of a new rate being cached
  5. If a rate source fails, the UI shows the last-known-good rate with a visible "stale" indicator rather than an error or empty state
**Plans**: TBD

Plans:
- [ ] 03-01: /api/rates GET endpoint and useExchangeRates polling hook with TanStack Query
- [ ] 03-02: Rate display UI — BCV, Binance, CoinGecko cards with source label, staleness, and delta indicator

### Phase 4: Transactions
**Goal**: Users can record, edit, delete, and browse their income and expense transactions in any supported currency, with automatic VES conversion at the moment of entry
**Depends on**: Phase 3
**Requirements**: TRANS-01, TRANS-02, TRANS-03, TRANS-04, TRANS-05, TRANS-06, TRANS-07
**Success Criteria** (what must be TRUE):
  1. User can add a transaction by choosing a currency (USD, VES, EUR, BTC, ETH, USDT), entering an amount, selecting income or expense, picking a category and payment method, and submitting — the entry appears immediately in the list
  2. The stored transaction shows both the original amount/currency and the VES equivalent calculated using the exchange rate at the exact moment of submission — editing the transaction later does not change the stored VES snapshot
  3. User can tap any transaction in the list and edit its amount, category, payment method, or notes, then save — the change is reflected immediately
  4. User can delete a transaction and it disappears from the list immediately with no orphaned data in the database
  5. User can filter the transaction history by category, currency, or type (income/expense) and sort by date or amount — the list updates instantly with matching results
**Plans**: TBD

Plans:
- [ ] 04-01: /api/transactions POST/PUT/DELETE with server-side rate lookup, VES snapshot, and UUID idempotency
- [ ] 04-02: Transaction entry form — React Hook Form + Zod, multi-currency input, category and payment method fields
- [ ] 04-03: Transaction history list with filter, sort, optimistic UI, and edit/delete actions

### Phase 5: Dashboard
**Goal**: Users land on a home screen that immediately shows their financial position — income vs. expenses, spending by category, recent activity, and live rates — without navigating anywhere
**Depends on**: Phase 4
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. User sees a balance summary showing total income vs. total expenses for the current period, displayed in the transaction's original currency and in VES equivalent, without navigating away from the home screen
  2. User sees a spending breakdown chart by category for the current period — hovering or tapping a segment shows the category name and amount
  3. User sees their 5-10 most recent transactions directly on the home screen with amount, currency, category, and date visible without opening each one
  4. User sees current BCV, Binance, and BTC/ETH rates in a compact widget on the home screen — rates match what is shown on the full rates page
**Plans**: TBD

Plans:
- [ ] 05-01: Dashboard data API — balance summary and category aggregation queries using stored rate_at_time values
- [ ] 05-02: Dashboard UI — balance summary, Recharts category chart, recent transactions list, and rates widget

### Phase 6: PWA and Polish
**Goal**: The app is installable to the Android home screen, supports dark and light themes, and renders correctly on mobile without viewport overflow or broken navigation
**Depends on**: Phase 5
**Requirements**: PWA-01, PWA-02
**Success Criteria** (what must be TRUE):
  1. On Android Chrome, the browser shows an "Add to Home Screen" prompt or the user can manually install the app — once installed, the app opens in standalone mode (no browser chrome) with the correct app name and icon
  2. User can toggle between dark mode and light mode using a control in the app — the selected theme persists across page refreshes and app restarts
  3. All pages render without horizontal scroll or content clipping on a 360px-wide mobile viewport — the address bar on mobile does not cause layout overflow
  4. Offline navigation within the app shell works without a network connection — cached pages load from the service worker and the user sees an offline status indicator rather than a browser error page
**Plans**: TBD

Plans:
- [ ] 06-01: Serwist service worker setup with manifest, icons, caching strategies, and PWA installability
- [ ] 06-02: Dark/light mode toggle with next-themes, mobile viewport fixes, and offline status UI

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Not started | - |
| 2. Authentication | 0/2 | Not started | - |
| 3. Exchange Rates | 0/2 | Not started | - |
| 4. Transactions | 0/3 | Not started | - |
| 5. Dashboard | 0/2 | Not started | - |
| 6. PWA and Polish | 0/2 | Not started | - |
