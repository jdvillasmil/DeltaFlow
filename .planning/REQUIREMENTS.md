# Requirements: DeltaFlow

**Defined:** 2026-03-04
**Core Value:** Real-time visibility into personal finances across VES, USD, and crypto — so users always know what they have, in any currency, right now.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can sign up and log in via email magic link (no password)
- [ ] **AUTH-02**: User session persists across browser refresh without re-authentication
- [ ] **AUTH-03**: User can log out from any page in the app

### Exchange Rates

- [ ] **RATE-01**: App displays current BCV official USD/VES exchange rate (sourced via web scraping)
- [ ] **RATE-02**: App displays current Binance parallel USDT/VES rate (sourced via Binance public API)
- [ ] **RATE-03**: App displays current BTC and ETH prices in USD (sourced via CoinGecko)
- [ ] **RATE-04**: Rates auto-refresh hourly in the background without user action
- [ ] **RATE-05**: Rate display shows the data source (BCV / Binance / CoinGecko) and how old the cached rate is

### Transactions

- [ ] **TRANS-01**: User can add a transaction in any supported currency (USD, VES, EUR, BTC, ETH, USDT)
- [ ] **TRANS-02**: Each transaction automatically stores the VES equivalent using the rate at the moment of entry (immutable rate snapshot)
- [ ] **TRANS-03**: User can edit their own transactions after creation
- [ ] **TRANS-04**: User can delete their own transactions
- [ ] **TRANS-05**: User can tag each transaction with a category (customizable list)
- [ ] **TRANS-06**: User can tag each transaction with a payment method (Zelle, USDT, pagomovil, USD cash, bank transfer, other)
- [ ] **TRANS-07**: User can view a filterable and sortable list of their transaction history

### Dashboard

- [ ] **DASH-01**: User can view a balance summary showing total income vs. expenses per currency for the current period
- [ ] **DASH-02**: User can view a spending breakdown chart by category for the current period
- [ ] **DASH-03**: User can view their 5–10 most recent transactions directly on the home screen
- [ ] **DASH-04**: User can view current BCV, Binance, and BTC/ETH rates at a glance from the home screen

### Mobile & PWA

- [ ] **PWA-01**: App is installable as a PWA (add to home screen on Android and iOS)
- [ ] **PWA-02**: App supports dark mode and light mode with a user-controlled toggle

## v2 Requirements

### Offline Support

- **OFFLN-01**: User can add transactions while offline; entries sync automatically on reconnect
- **OFFLN-02**: Offline entries are deduplicated on sync (no duplicate transactions after reconnect)

### Quick Entry

- **QE-01**: Floating quick-add button available on all screens for rapid transaction entry
- **QE-02**: Standalone currency converter widget for quick calculations without creating a transaction

### Crypto Portfolio

- **PORT-01**: User can record crypto holdings (BTC, ETH, USDT) with purchase price
- **PORT-02**: User can view current portfolio value vs. cost basis with ROI calculation
- **PORT-03**: User can view a portfolio performance chart over time

### Analytics & Reports

- **ANLYT-01**: User can view monthly spending breakdown by category with charts
- **ANLYT-02**: User can view month-over-month spending comparison
- **ANLYT-03**: User can export transaction history to Excel
- **ANLYT-04**: User can set monthly budget limits per category and receive alerts when approaching them

### Notifications

- **NOTIF-01**: User receives in-app notifications when exchange rates change significantly (configurable threshold)
- **NOTIF-02**: User receives budget alert when spending approaches category limit

## Out of Scope

| Feature | Reason |
|---------|--------|
| OAuth / social login (Google, GitHub) | Magic links sufficient for v1; adds complexity |
| Password-based authentication | Magic links are the auth strategy |
| Supabase Realtime subscriptions for rates | Free tier has 2-connection limit; polling is sufficient |
| Desktop-first layout optimization | Mobile is primary device for target users |
| Multi-user / shared budgets | Single-user scope for MVP |
| Bank account integrations / open banking | No Venezuelan bank APIs available |
| SMS / push notifications | Requires additional infrastructure; deferred to v2 |

## Traceability

*Populated during roadmap creation.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| RATE-01 | — | Pending |
| RATE-02 | — | Pending |
| RATE-03 | — | Pending |
| RATE-04 | — | Pending |
| RATE-05 | — | Pending |
| TRANS-01 | — | Pending |
| TRANS-02 | — | Pending |
| TRANS-03 | — | Pending |
| TRANS-04 | — | Pending |
| TRANS-05 | — | Pending |
| TRANS-06 | — | Pending |
| TRANS-07 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |
| PWA-01 | — | Pending |
| PWA-02 | — | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 21 ⚠️

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after initial definition*
