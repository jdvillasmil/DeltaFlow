# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Real-time visibility into personal finances across VES, USD, and crypto — so users always know what they have, in any currency, right now.
**Current focus:** Phase 1 - Foundation

## Current Position

Phase: 1 of 6 (Foundation)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-03-05 — Plan 01-01 executed (Next.js 15 scaffold, Supabase clients, Vitest, shadcn/ui); Task 1 complete, Task 2 is checkpoint:human-verify for Vercel deployment

Progress: [██░░░░░░░░] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 1 (01-02 partial — Task 1 complete, Task 2 awaiting human-verify)
- Average duration: 7 min
- Total execution time: 0.12 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 1 of 3 | 7 min | 7 min |

**Recent Trend:**
- Last 5 plans: 01-02 (7 min)
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-build]: Use Next.js 15 (not 14) — Next.js 15 fetch-no-cache default is better for rate freshness
- [Pre-build]: Use @ducanh2912/next-pwa (Serwist) — original next-pwa is abandoned and App Router incompatible
- [Pre-build]: Supabase pooler port 6543 mandatory — direct port 5432 exhausts free-tier connections in serverless
- [Pre-build]: NUMERIC(24,8) for all financial columns — IEEE 754 float drift is unacceptable in financial data
- [Pre-build]: Client-generated UUID (client_id UNIQUE) on transactions — enables idempotent offline sync retries
- [01-01]: vitest v4 has no envFile config option — setup.ts manually loads .env.local for local test runs
- [01-01]: force-dynamic on /api/health prevents static caching of keep-alive response
- [01-01]: shadcn/ui initialized with Slate style + CSS variables (default)
- [01-02]: NUMERIC(24, 8) for all financial columns confirmed in migration — enforced by automated schema test
- [01-02]: RLS on transactions only; exchange_rates are public read — no RLS
- [01-02]: TypeScript NUMERIC fields are string type — Supabase JS client returns NUMERIC as string, not number
- [01-02]: rate_at_time stored immutably on transactions — historical VES values never recalculated from current rates

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: BCV HTML structure must be inspected live before writing cheerio selectors — scraper is the highest operational risk
- [Phase 1]: Verify Binance USDT/VES pair (`USDTVES`) exists on public API before building rate aggregator
- [Phase 1]: Verify CoinGecko free tier still works without API key — may now require Demo key registration
- [Phase 1]: Verify Vercel Hobby function timeout (expected 10s) and Supabase free-tier pause behavior before infrastructure setup
- [Phase 6]: Verify @ducanh2912/next-pwa Next.js 15 compatibility before starting PWA phase

## Session Continuity

Last session: 2026-03-05
Stopped at: Plan 01-01 Task 1 complete (Next.js 15 scaffold, pooler URL TDD tests GREEN). Task 2 is checkpoint:human-verify — deploy to Vercel with real Supabase credentials.
Resume file: None
