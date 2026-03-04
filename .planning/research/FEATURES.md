# Feature Landscape

**Domain:** Personal finance management — Venezuelan multi-currency / high-inflation economy
**Project:** DeltaFlow
**Researched:** 2026-03-04
**Confidence:** MEDIUM (external search tools unavailable; findings based on training data through Aug 2025, Venezuela market knowledge, and analogous high-inflation markets: Argentina, Turkey, Zimbabwe)

---

## Context: The Venezuelan User's Reality

Before categorizing features, the lived context shapes every priority decision:

- **Dollarization is the norm.** Since 2019 the majority of Venezuelan commerce operates in USD, but prices are often quoted in both USD and VES simultaneously.
- **Two exchange rates exist in parallel.** The BCV (Banco Central de Venezuela) official rate is legal but typically diverges significantly from the parallel ("dolar paralelo") market rate. Users need BOTH rates because different transactions settle at different rates.
- **VES is inflationary.** VES loses value rapidly — users think in USD but the government requires some VES-denominated activity. Crypto (especially USDT) serves as USD on-ramp/off-ramp when banking is inaccessible.
- **Internet is unreliable.** CANTV/Movilnet outages are frequent. Apps must function offline.
- **Mobile is the primary device.** Laptop ownership is low; Android is dominant. App must be fast on mid-range hardware with data constraints.
- **Cash is king + digital is growing.** Physical USD bills, Zelle, bank transfers (pagomovil), and crypto coexist. Users transact in multiple "rails" per day.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or users abandon at onboarding.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-currency transaction entry | Core job-to-be-done: users transact in USD, VES, USDT daily | Medium | Must support at minimum: USD, VES, USDT. EUR, BTC, ETH can follow. Currency must be selectable per-transaction, not per-account. |
| Display balance/totals in a chosen base currency | Users want to know "what do I have in USD?" not just VES | Low | Toggle between VES and USD view; conversion uses stored rate at time of query |
| BCV rate display | BCV rate is the legal/official reference. Every Venezuelan checks it daily. | Medium | Requires scraping (no official API). Must show timestamp of last update. |
| Parallel (dolar paralelo) rate display | The real market rate used in 80%+ of commerce. Apps that only show BCV feel useless. | Medium | Source: Binance USDT/VES P2P or average of monitored rate aggregators. Must show source clearly. |
| Exchange rate auto-refresh | Rates change significantly intraday during volatile periods | Medium | Hourly refresh is acceptable baseline; show "last updated" prominently |
| Expense categorization | Standard in all personal finance apps; users expect to filter by food/transport/etc. | Low | Default categories must reflect Venezuelan spending patterns (efectivo, divisas, pagomovil, etc.) |
| Transaction history list | View past transactions; ability to scroll back through history | Low | Pagination required; filter by currency and category |
| Quick-add transaction entry | Speed matters on mobile. Users add transactions at point-of-sale. | Medium | Floating action button (FAB); minimal required fields (amount + currency + category). Optional: note field. |
| Offline transaction entry | Venezuelan internet is unreliable. If the app can't record a transaction offline, users stop using it. | High | Queue transactions locally (IndexedDB/service worker); sync when connection restored |
| PWA installability | Android users expect to "install" the web app to home screen for native feel | Medium | Requires proper manifest.json, service worker, HTTPS |
| Mobile-optimized numeric keyboard | Amount entry must trigger numeric keypad on mobile, not alpha keyboard | Low | Input type="decimal" or custom keypad; critical UX detail that kills conversions if missing |
| Basic spending summary | "How much did I spend this month?" — minimum viable dashboard | Low | Total by period; breakdown by currency; no charts required for v1 |
| User authentication | Required to persist data across devices | Low | Magic links sufficient; avoid passwords |

---

## Differentiators

Features that set DeltaFlow apart in the Venezuelan market. Not universally expected, but highly valued by target users.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Rate-at-transaction-time storage | Store what rate was used WHEN a VES transaction was recorded. Retroactively re-calculating at today's rate is misleading and frustrating. | Medium | Every transaction record must include: original currency, original amount, conversion rate used, converted amount. Never recalculate historical conversions. |
| BCV vs parallel rate delta indicator | Show the spread between BCV and parallel rate as a % — tells users how much arbitrage risk they're carrying | Low | Simple arithmetic, but displayed prominently. Venezuelan users care deeply about this number. |
| Rate source transparency | Label every displayed rate with its source (BCV, Binance, CoinGecko) and timestamp. | Low | Builds trust. Venezuelan users are savvy about rate manipulation and will distrust unlabeled rates. |
| Payment method tagging per transaction | "How did I pay?" (Zelle, efectivo USD, pagomovil, USDT, bolivares efectivo) is as important as category. Each method has tax/rate implications. | Low | Add `payment_method` field with Venezuelan-specific defaults |
| Income tracking (not just expenses) | Freelancers and remote workers need to track income sources in USD/crypto separately from VES expenses | Low | Dual transaction type (income/expense); income often in USD, expenses often in VES |
| Rate change notifications | Alert when BCV or parallel rate moves >X% — users need this for time-sensitive decisions | Medium | Push notifications via PWA; user-configurable threshold. Differentiating because no simple finance app does this for Venezuelan rates specifically. |
| Spending totals converted at CURRENT rate vs AT-TIME rate toggle | Let users see: "I spent $X at today's rate" vs "I spent $X at the rate when I transacted" — these are very different numbers in high-inflation environments | Medium | UI toggle on dashboard. Useful for understanding real purchasing power loss. |
| Quick currency converter widget | Standalone "how much is $X in VES right now?" calculator without creating a transaction | Low | Dead-simple, extremely high utility. Many Venezuelans use Google for this; owning it in-app increases daily active use. |
| Category spending in dual currency | Show category totals in both VES and USD side by side — not just one currency | Low | VES for local context, USD for inflation-normalized understanding |

---

## Anti-Features

Features to explicitly NOT build in v1. Including these increases complexity and delays shipping without proportional user value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Crypto portfolio / investment tracking | Completely different product (portfolio P&L, market charts). Scope creep that delays MVP. Defined out-of-scope in PROJECT.md. | Track USDT as a spending currency only. Portfolio tracking is v2. |
| Budget alerts / projections | Requires historical data, trend analysis, and notification plumbing. Better when users have 2-3 months of data. | Ship it in v2 once baseline transaction data exists. |
| Bank account sync / open banking | Venezuelan banks have no open banking API. Screen scraping Venezuelan banks is fragile and legally grey. | Manual transaction entry only. |
| Multiple "accounts" or "wallets" per user | Adds organizational complexity (which account? transfer between accounts?). Most target users don't need this for v1. | Single ledger per user. Currency field per transaction handles the multi-currency reality. |
| Social / sharing features | Not a social product. Adds auth complexity, privacy surface, and distracts from core finance UX. | Never. Not in roadmap. |
| Recurring transaction automation | Useful feature, but Venezuelan salaries/expenses are rarely fixed (VES inflation makes "recurring" meaningless at a fixed amount). | Defer until user demand is validated post-launch. |
| CSV / PDF export | Useful for accountants but not a daily-use feature. Adds download/file-handling complexity. | Defer to v2 analytics milestone. |
| Multiple base currency toggles (full) | Supporting any-to-any conversion matrix in the UI adds combinatorial complexity. Users want USD or VES, not EUR-to-BTC reports. | VES as base, USD as primary alternate. Other currencies stored but reports are VES/USD only. |
| OAuth / social login | Magic links cover the auth use case. Adding Google/Facebook login means social SDK dependency, callback flows, and provider-specific bugs. | Magic links only (already decided in PROJECT.md). |
| Web (desktop) optimization | Target users are on Android. Desktop-responsive is acceptable but don't design for desktop-first. | Mobile-first always; desktop is a bonus. |

---

## Feature Dependencies

```
Auth (magic link) → Transaction entry (user-scoped data)
Transaction entry → Transaction history (something to show)
Exchange rate fetch (BCV) → Currency conversion display
Exchange rate fetch (Binance) → Parallel rate display
Exchange rate fetch + transaction entry → Rate-at-transaction-time storage
Transaction history → Basic spending summary
Offline transaction entry → Service worker (PWA required first)
PWA installability → Service worker
Rate change notifications → PWA installability + push permission
Quick currency converter → Exchange rate fetch
```

---

## Venezuelan Market-Specific Requirements

### BCV Rate
- **Source:** `www.bcv.org.ve` — requires HTML scraping, no API
- **Update frequency:** BCV publishes rates business days; may not update on weekends/holidays
- **Display requirement:** Show VES per 1 USD (e.g., "1 USD = 36.50 VES (BCV)")
- **Trust signal:** Must show date/time of publication, not just fetch time
- **Confidence:** HIGH — BCV website is the authoritative source; scraping is well-established community practice

### Parallel (Dolar Paralelo) Rate
- **Source:** Binance USDT/VES P2P average is the most reliable programmatic source (public API, no auth required)
- **Alternatives considered:** DolarToday (popular but rate may be inflated), MonitorDolar (another aggregator)
- **Recommended:** Binance P2P as primary, DolarToday as fallback label if Binance unavailable
- **Display requirement:** Show clearly as "Mercado paralelo" NOT as official rate; show source
- **Confidence:** MEDIUM — Binance P2P as parallel rate proxy is community-validated but not independently verified post-Aug 2025

### Crypto Rates (BTC, ETH)
- **Source:** CoinGecko free tier (no API key required at lower rate limits)
- **Purpose:** Convert BTC/ETH holdings to USD/VES equivalent for display in spending summary
- **Rate limits:** CoinGecko free tier: ~30 calls/minute. Hourly caching is sufficient.
- **Confidence:** HIGH — CoinGecko free API is well-documented and widely used

### Payment Method Context
Venezuelan-specific payment methods that users tag transactions with:
- `USD Efectivo` — physical USD bills (most trusted)
- `USDT` — Tether crypto, used as digital USD
- `Zelle` — dominant P2P USD transfer method
- `Pagomovil` — Venezuelan mobile banking transfer (VES)
- `Transferencia bancaria` — bank transfer (VES)
- `Bolivares efectivo` — physical VES cash
- `Punto de venta` — card terminal (VES, increasingly USD)

---

## MVP Recommendation

### Prioritize for v1:
1. **Transaction entry** (multi-currency, quick-add FAB, offline queue)
2. **Exchange rate display** (BCV + parallel rate, with source/timestamp)
3. **Rate-at-transaction-time storage** (critical for data integrity in inflation context)
4. **Transaction history** (list, filter by currency/category)
5. **Basic spending summary** (monthly totals by currency)
6. **PWA + installability** (offline transaction entry is blocked on this)
7. **Income tracking** (same UI as expenses, opposite sign — low cost, high value for freelancers)
8. **Quick currency converter widget** (high daily-use driver; very low complexity)

### Defer to v2:
- Rate change push notifications (requires push permission UX, service worker plumbing)
- Spending totals current-rate vs at-time-rate toggle (useful but adds UI complexity)
- Full analytics (charts, M-o-M, export)
- Budget alerts and projections
- Crypto portfolio tracking

### Differentiators to build WITHIN v1 (low cost, high signal):
- **Rate source transparency labels** — show "BCV" or "Binance" on every displayed rate
- **BCV vs parallel delta** — one line of math, huge UX value
- **Payment method field** — one extra dropdown on transaction form
- **Rate-at-transaction-time storage** — schema decision, not UI; must be made in v1 or v2 is painful

---

## Competitive Landscape (MEDIUM confidence — training data, no live verification)

| App | Used in Venezuela? | Multi-currency? | Venezuelan rates? | Offline? |
|-----|-------------------|-----------------|-------------------|----------|
| Spendee | Sometimes | Yes | No | Partial |
| Wallet (BudgetBakers) | Sometimes | Yes | No | Yes |
| Money Manager | Yes | Yes | No | Yes |
| Spiink (Venezuelan) | Yes | USD/VES basic | BCV only | Unknown |
| DolarToday app | Rates only | N/A | Yes (rates display) | No |

**Gap identified:** No existing app combines (1) Venezuelan-specific rate sources, (2) offline-first, (3) USDT as a first-class spending currency, and (4) payment method context (Zelle/pagomovil). DeltaFlow's combination of these is the differentiator.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Venezuelan market context (dollarization, rates, payment methods) | HIGH | Well-documented economic reality; consistent with PROJECT.md constraints |
| BCV scraping as only option | HIGH | Official BCV site has no API; training data confirms scraping approach |
| Binance P2P as parallel rate source | MEDIUM | Community practice as of training data; no live verification available |
| CoinGecko for crypto rates | HIGH | Official API is stable and well-documented |
| Competitor feature gaps | MEDIUM | Based on training data; live app stores not verified |
| PWA offline-first as required | HIGH | Unreliable internet is documented Venezuelan infrastructure reality |

---

## Sources

- Project context: `.planning/PROJECT.md` (project-defined constraints and decisions)
- Venezuelan economic context: Domain knowledge through training cutoff Aug 2025 (BCV dual-rate system, dollarization since 2019)
- BCV rate source: `https://www.bcv.org.ve` (official, scraping required — no API)
- Binance P2P rate proxy: Community practice in Venezuelan fintech ecosystem
- CoinGecko API: `https://www.coingecko.com/en/api` (free tier, no auth required for basic endpoints)
- High-inflation UX patterns: Argentina (Mercado Pago, Ualá), Turkey (fintech dollarization patterns), Zimbabwe (multi-currency app design) — analogous markets
- Note: External search tools were unavailable during this research session. All findings derive from training data (cutoff Aug 2025) plus project-provided context. Findings should be validated against live app stores and Venezuelan fintech community forums (e.g., r/vzla, Venezuelan Telegram finance groups) before finalizing v1 scope.
