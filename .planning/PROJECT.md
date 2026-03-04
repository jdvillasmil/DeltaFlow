# DeltaFlow

## What This Is

A mobile-first web application for personal finance management in Venezuela's multi-currency economy. Users track expenses and income across USD, VES, EUR, BTC, ETH, and USDT, with automatic conversion using live exchange rates from BCV, Binance, and CoinGecko. Built for Venezuelan professionals and freelancers who must manage money across multiple currencies daily.

## Core Value

Real-time visibility into personal finances across VES, USD, and crypto — so users always know what they have, in any currency, right now.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Users can add and categorize transactions in any supported currency (USD, VES, EUR, BTC, ETH, USDT)
- [ ] Transactions automatically convert to VES using current exchange rates
- [ ] Live exchange rates fetched from BCV (official), Binance (USDT/VES), and CoinGecko (BTC, ETH)
- [ ] Rates auto-update hourly with change notifications
- [ ] Users can view spending by category and currency
- [ ] Quick-add floating button for rapid transaction entry on mobile
- [ ] User authentication via email magic links (Supabase Auth)
- [ ] Mobile-first responsive design with PWA installability
- [ ] Offline support for quick transaction entry

### Out of Scope (v1)

- Crypto investment portfolio tracking — deferred to v2
- Analytics & reports (monthly breakdown, M-o-M comparison, export) — deferred to v2
- OAuth / social login — email magic links sufficient for v1
- Budget alerts and projections — deferred to v2

## Context

- Previous attempt was a Python/Streamlit scaffold (empty — deleted on project init)
- Target users are Venezuelan professionals who earn in USD/crypto and spend in VES
- Venezuela has dual/parallel exchange rates (BCV official vs parallel market) — both matter
- BCV rate requires web scraping (no official API)
- Free-tier infrastructure constraint: Vercel (hosting) + Supabase (DB + auth)
- App must work well on mobile (Android primary) — this is the primary device for target users
- Offline capability critical because Venezuelan internet is unreliable

## Constraints

- **Tech Stack**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts — decided upfront
- **Backend**: Next.js API Routes + Supabase (PostgreSQL + Auth + Realtime)
- **Auth**: Supabase magic links only — no passwords, no OAuth for v1
- **Hosting**: Vercel + Supabase free tier — no paid infrastructure for MVP
- **APIs**: BCV scraping, Binance public API, CoinGecko free tier — no paid API keys
- **Performance**: Load time < 2s, mobile Lighthouse > 90
- **Mobile**: Must work on mobile as primary device; PWA installable

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js 14 App Router | Modern React patterns, serverless API routes, Vercel-optimized | — Pending |
| Supabase over custom backend | Auth + DB + realtime in one free-tier service | — Pending |
| Magic links only (no passwords) | Simpler UX, no password reset flows, good enough for v1 | — Pending |
| BCV rate via scraping | BCV has no official API; scraping is the only option | — Pending |
| Portfolio deferred to v2 | Keeps v1 focused on daily-use core (tracking + rates) | — Pending |
| VES as base currency | All conversions anchor to VES — the lived reality of Venezuelan users | — Pending |

---
*Last updated: 2026-03-04 after initialization*
