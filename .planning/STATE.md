# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Real-time visibility into personal finances across VES, USD, and crypto — so users always know what they have, in any currency, right now.
**Current focus:** Phase 1 - Foundation

## Current Position

Phase: 1 of 6 (Foundation)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-03-04 — Roadmap created; 21 v1 requirements mapped across 6 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: — min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: BCV HTML structure must be inspected live before writing cheerio selectors — scraper is the highest operational risk
- [Phase 1]: Verify Binance USDT/VES pair (`USDTVES`) exists on public API before building rate aggregator
- [Phase 1]: Verify CoinGecko free tier still works without API key — may now require Demo key registration
- [Phase 1]: Verify Vercel Hobby function timeout (expected 10s) and Supabase free-tier pause behavior before infrastructure setup
- [Phase 6]: Verify @ducanh2912/next-pwa Next.js 15 compatibility before starting PWA phase

## Session Continuity

Last session: 2026-03-04
Stopped at: Roadmap created, STATE.md initialized — ready to begin /gsd:plan-phase 1
Resume file: None
